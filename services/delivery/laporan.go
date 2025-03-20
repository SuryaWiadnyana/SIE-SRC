package delivery

import (
	"SIE-SRC/domain"
	"SIE-SRC/middleware"
	"context"
	"fmt"
	"log"
	"net/http"
	"time"

	"github.com/gofiber/fiber/v2"
	"github.com/xuri/excelize/v2"
)

type HttpDeliveryLaporan struct {
	PenjualanUC       domain.PenjualanUseCase
	DetailPenjualanUC domain.DetailPenjualanUseCase
	ProdukUC          domain.ProdukUseCase
	KategoriUC        domain.KategoriUseCase
	SubKategoriUC     domain.SubKategoriUseCase
}

func NewHttpDeliveryLaporan(app fiber.Router, penjualanUC domain.PenjualanUseCase, detailPenjualanUC domain.DetailPenjualanUseCase, produkUC domain.ProdukUseCase, kategoriUC domain.KategoriUseCase, subKategoriUC domain.SubKategoriUseCase) {
	handler := &HttpDeliveryLaporan{
		PenjualanUC:       penjualanUC,
		DetailPenjualanUC: detailPenjualanUC,
		ProdukUC:          produkUC,
		KategoriUC:        kategoriUC,
		SubKategoriUC:     subKategoriUC,
	}

	protected := app.Group("/laporan")
	protected.Use(middleware.AuthMiddleware("admin", "owner"))
	protected.Get("/penjualan", handler.GetLaporanPenjualan)
	protected.Get("/produk", handler.GetLaporanProduk)
}

func (d *HttpDeliveryLaporan) GetLaporanPenjualan(c *fiber.Ctx) error {
	// Parse query parameters
	startDate := c.Query("tanggal_mulai")
	endDate := c.Query("tanggal_akhir")
	kategoriID := c.Query("id_kategori")
	subkategoriID := c.Query("id_subkategori")
	sortParam := c.Query("sort")
	format := c.Query("format") // New parameter for format

	// Validate required parameters
	if startDate == "" || endDate == "" {
		return c.Status(http.StatusBadRequest).JSON(fiber.Map{
			"error": "Parameter tanggal_mulai dan tanggal_akhir wajib diisi",
		})
	}

	// Parse dates
	parsedStartDate, err := time.Parse("2006-01-02", startDate)
	if err != nil {
		return c.Status(http.StatusBadRequest).JSON(fiber.Map{
			"error": "Format tanggal_mulai tidak valid (gunakan YYYY-MM-DD)",
		})
	}

	parsedEndDate, err := time.Parse("2006-01-02", endDate)
	if err != nil {
		return c.Status(http.StatusBadRequest).JSON(fiber.Map{
			"error": "Format tanggal_akhir tidak valid (gunakan YYYY-MM-DD)",
		})
	}

	// Get all sales details
	details, err := d.DetailPenjualanUC.GetAll(context.Background())
	if err != nil {
		log.Printf("Error getting sales details: %v", err)
		return c.Status(http.StatusInternalServerError).JSON(fiber.Map{
			"error": "Gagal mendapatkan data penjualan",
		})
	}

	// Process and filter data
	reportItems, categoryStats := d.processReportData(details, parsedStartDate, parsedEndDate, kategoriID, subkategoriID)

	// Sort data if specified
	if sortParam == "date_asc" {
		sortReportItemsByDate(reportItems, true)
	} else if sortParam == "date_desc" {
		sortReportItemsByDate(reportItems, false)
	}

	// Return Excel if requested
	if format == "excel" {
		return d.generateExcelReport(c, reportItems, categoryStats, parsedStartDate, parsedEndDate)
	}

	return c.Status(http.StatusOK).JSON(fiber.Map{
		"message": "Data laporan penjualan berhasil diambil",
		"data":    reportItems,
		"stats":   categoryStats,
	})
}

func sortReportItemsByDate(items []domain.ResponseSalesReportItem, ascending bool) {
	if ascending {
		for i := 0; i < len(items)-1; i++ {
			for j := i + 1; j < len(items); j++ {
				if items[i].TanggalPenjualan.After(items[j].TanggalPenjualan) {
					items[i], items[j] = items[j], items[i]
				}
			}
		}
	} else {
		for i := 0; i < len(items)-1; i++ {
			for j := i + 1; j < len(items); j++ {
				if items[i].TanggalPenjualan.Before(items[j].TanggalPenjualan) {
					items[i], items[j] = items[j], items[i]
				}
			}
		}
	}
}

func (d *HttpDeliveryLaporan) processReportData(details []domain.DetailPenjualan, startDate, endDate time.Time, kategoriID, subkategoriID string) ([]domain.ResponseSalesReportItem, map[string]domain.CategoryStats) {
	var reportItems []domain.ResponseSalesReportItem
	categoryStats := make(map[string]domain.CategoryStats)

	for _, detail := range details {
		// Skip if sale is outside date range
		if detail.Penjualan.Tanggal_Penjualan.Before(startDate) || detail.Penjualan.Tanggal_Penjualan.After(endDate) {
			continue
		}

		for _, product := range detail.Produk {
			// Skip if product is deleted
			if product.IsDeleted != nil {
				continue
			}

			// Validate kategori data - only check nama_kategori since we might not have id_kategori
			if product.Kategori.NamaKategori == "" {
				// Skip products with no category name
				continue
			}

			// If kategori filter is active, match by name since we might not have ID
			if kategoriID != "" {
				// Try to get kategori by ID first
				kategori, err := d.KategoriUC.GetByID(context.Background(), kategoriID)
				if err != nil || kategori.NamaKategori != product.Kategori.NamaKategori {
					continue
				}
			}

			// If subkategori filter is active, match by name since we might not have ID
			if subkategoriID != "" {
				// Try to get subkategori by ID first
				subkategori, err := d.SubKategoriUC.GetByID(context.Background(), subkategoriID)
				if err != nil || subkategori.NamaSubKategori != product.SubKategori.NamaSubKategori {
					continue
				}
			}

			// Update category statistics using nama_kategori as key since id might be empty
			catKey := product.Kategori.NamaKategori
			if _, ok := categoryStats[catKey]; !ok {
				categoryStats[catKey] = domain.CategoryStats{
					KategoriNama: catKey,
				}
			}
			stats := categoryStats[catKey]
			stats.TotalPenjualan += float64(detail.Penjualan.Total)
			stats.JumlahProduk += detail.Penjualan.JumlahProduk
			categoryStats[catKey] = stats

			// Create report item
			reportItem := domain.ResponseSalesReportItem{
				TanggalPenjualan: detail.Penjualan.Tanggal_Penjualan,
				KodeProduk:       product.KodeProduk,
				NamaProduk:       product.NamaProduk,
				Kategori:         product.Kategori,
				SubKategori:      product.SubKategori,
				JumlahProduk:     detail.Penjualan.JumlahProduk,
				Total:            detail.Penjualan.Total,
			}
			reportItems = append(reportItems, reportItem)
		}
	}

	// Log statistik untuk debugging
	log.Printf("Ditemukan %d data produk", len(reportItems))
	for _, stats := range categoryStats {
		log.Printf("Kategori %s: Total penjualan %.2f, Produk terjual: %d",
			stats.KategoriNama, stats.TotalPenjualan, stats.JumlahProduk)
	}

	return reportItems, categoryStats
}

func (d *HttpDeliveryLaporan) generateExcelReport(c *fiber.Ctx, reportItems []domain.ResponseSalesReportItem, categoryStats map[string]domain.CategoryStats, startDate, endDate time.Time) error {
	f := excelize.NewFile()
	defer f.Close()

	// Create Data sheet
	sheetName := "Data Penjualan"
	f.SetSheetName("Sheet1", sheetName)

	// Set headers
	headers := []string{"Tanggal", "Kode Produk", "Nama Produk", "Kategori", "Sub Kategori", "Jumlah", "Total"}
	for i, header := range headers {
		cell := fmt.Sprintf("%c1", 'A'+i)
		f.SetCellValue(sheetName, cell, header)
	}

	// Add data
	for i, item := range reportItems {
		row := i + 2
		f.SetCellValue(sheetName, fmt.Sprintf("A%d", row), item.TanggalPenjualan.Format("2006-01-02"))
		f.SetCellValue(sheetName, fmt.Sprintf("B%d", row), item.KodeProduk)
		f.SetCellValue(sheetName, fmt.Sprintf("C%d", row), item.NamaProduk)
		f.SetCellValue(sheetName, fmt.Sprintf("D%d", row), item.Kategori.NamaKategori)
		f.SetCellValue(sheetName, fmt.Sprintf("E%d", row), item.SubKategori.NamaSubKategori)
		f.SetCellValue(sheetName, fmt.Sprintf("F%d", row), item.JumlahProduk)
		f.SetCellValue(sheetName, fmt.Sprintf("G%d", row), item.Total)
	}

	// Create Grafik sheet
	chartSheet := "Grafik Penjualan"
	f.NewSheet(chartSheet)

	// Add category statistics for chart
	f.SetCellValue(chartSheet, "A1", "Kategori")
	f.SetCellValue(chartSheet, "B1", "Total Penjualan")
	f.SetCellValue(chartSheet, "C1", "Jumlah Produk")

	row := 2
	for _, stats := range categoryStats {
		f.SetCellValue(chartSheet, fmt.Sprintf("A%d", row), stats.KategoriNama)
		f.SetCellValue(chartSheet, fmt.Sprintf("B%d", row), stats.TotalPenjualan)
		f.SetCellValue(chartSheet, fmt.Sprintf("C%d", row), stats.JumlahProduk)
		row++
	}

	// Create bar charts
	err := d.CreateBarChart(f, chartSheet, len(categoryStats)+1)
	if err != nil {
		return c.Status(http.StatusInternalServerError).JSON(fiber.Map{
			"error": "Gagal membuat grafik",
		})
	}

	// Set response headers
	c.Set("Content-Type", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet")
	c.Set("Content-Disposition", fmt.Sprintf("attachment; filename=laporan_penjualan_%s_%s.xlsx",
		startDate.Format("2006-01-02"),
		endDate.Format("2006-01-02")))

	// Write to buffer and send
	buf, err := f.WriteToBuffer()
	if err != nil {
		return c.Status(http.StatusInternalServerError).JSON(fiber.Map{
			"error": "Gagal membuat file Excel",
		})
	}

	return c.Send(buf.Bytes())
}

func (d *HttpDeliveryLaporan) CreateBarChart(f *excelize.File, sheet string, dataRows int) error {
	// Create bar chart for total penjualan
	err := f.AddChart(sheet, "E2", &excelize.Chart{
		Type: excelize.Col,
		Series: []excelize.ChartSeries{
			{
				Name:       "Total Penjualan",
				Categories: fmt.Sprintf("%s!$A$2:$A$%d", sheet, dataRows),
				Values:     fmt.Sprintf("%s!$B$2:$B$%d", sheet, dataRows),
			},
		},
		Format: excelize.GraphicOptions{
			ScaleX:  1.0,
			ScaleY:  1.0,
			OffsetX: 15,
			OffsetY: 10,
		},
		Legend: excelize.ChartLegend{
			Position: "bottom",
		},
		Title: []excelize.RichTextRun{
			{
				Text: "Total Penjualan per Kategori",
			},
		},
		PlotArea: excelize.ChartPlotArea{
			ShowBubbleSize:  false,
			ShowCatName:     false,
			ShowLeaderLines: false,
			ShowPercent:     false,
			ShowSerName:     true,
			ShowVal:         true,
		},
	})
	if err != nil {
		return err
	}

	// Create bar chart for jumlah produk
	err = f.AddChart(sheet, "E20", &excelize.Chart{
		Type: excelize.Col,
		Series: []excelize.ChartSeries{
			{
				Name:       "Jumlah Produk",
				Categories: fmt.Sprintf("%s!$A$2:$A$%d", sheet, dataRows),
				Values:     fmt.Sprintf("%s!$C$2:$C$%d", sheet, dataRows),
			},
		},
		Format: excelize.GraphicOptions{
			ScaleX:  1.0,
			ScaleY:  1.0,
			OffsetX: 15,
			OffsetY: 10,
		},
		Legend: excelize.ChartLegend{
			Position: "bottom",
		},
		Title: []excelize.RichTextRun{
			{
				Text: "Jumlah Produk Terjual per Kategori",
			},
		},
		PlotArea: excelize.ChartPlotArea{
			ShowBubbleSize:  false,
			ShowCatName:     false,
			ShowLeaderLines: false,
			ShowPercent:     false,
			ShowSerName:     true,
			ShowVal:         true,
		},
	})

	return err
}

func (d *HttpDeliveryLaporan) GetLaporanProduk(c *fiber.Ctx) error {
	// Parse query parameters
	kategoriID := c.Query("id_kategori")
	subkategoriID := c.Query("id_subkategori")
	sort := c.Query("sort")

	// Get all products
	products, err := d.ProdukUC.GetAllProduk(context.Background())
	if err != nil {
		log.Printf("Error getting product data: %v", err)
		return c.Status(http.StatusInternalServerError).JSON(fiber.Map{
			"error": "Gagal mendapatkan data produk",
		})
	}

	// Filter products based on parameters
	var filteredProducts []domain.Produk
	for _, product := range products {
		// Skip deleted products
		if product.IsDeleted != nil {
			continue
		}

		// Filter by kategori if specified
		if kategoriID != "" && product.Kategori.IDKategori != kategoriID {
			continue
		}

		// Filter by subkategori if specified
		if subkategoriID != "" && product.SubKategori.IDSubKategori != subkategoriID {
			continue
		}

		filteredProducts = append(filteredProducts, product)
	}

	// Sort data if specified
	switch sort {
	case "name_asc":
		// Implement name ascending sort
	case "name_desc":
		// Implement name descending sort
	case "stock_asc":
		// Implement stock ascending sort
	case "stock_desc":
		// Implement stock descending sort
	}

	return c.Status(http.StatusOK).JSON(fiber.Map{
		"message": "Data laporan produk berhasil diambil",
		"data":    filteredProducts,
	})
}
