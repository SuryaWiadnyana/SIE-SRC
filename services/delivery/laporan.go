package delivery

import (
	"SIE-SRC/domain"
	"SIE-SRC/middleware"
	"context"
	"log"
	"net/http"
	"time"

	"github.com/gofiber/fiber/v2"
)

type HttpDeliveryLaporan struct {
	PenjualanUC       domain.PenjualanUseCase
	DetailPenjualanUC domain.DetailPenjualanUseCase
	ProdukUC          domain.ProdukUseCase
}

func NewHttpDeliveryLaporan(app fiber.Router, penjualanUC domain.PenjualanUseCase, detailPenjualanUC domain.DetailPenjualanUseCase, produkUC domain.ProdukUseCase) {
	handler := &HttpDeliveryLaporan{
		PenjualanUC:       penjualanUC,
		DetailPenjualanUC: detailPenjualanUC,
		ProdukUC:          produkUC,
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
	sort := c.Query("sort")

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

	// Filter and format sales data
	var reportItems []domain.ResponseSalesReportItem
	for _, detail := range details {
		// Filter by date range
		if detail.Penjualan.Tanggal_Penjualan.Before(parsedStartDate) || detail.Penjualan.Tanggal_Penjualan.After(parsedEndDate) {
			continue
		}

		// Process each product in the sale
		for _, product := range detail.Produk {
			// Filter by kategori if specified
			if kategoriID != "" && product.Kategori.IDKategori != kategoriID {
				continue
			}

			// Filter by subkategori if specified
			if subkategoriID != "" && product.SubKategori.IDSubKategori != subkategoriID {
				continue
			}

			// Create report item
			reportItem := domain.ResponseSalesReportItem{
				TanggalPenjualan: detail.Penjualan.Tanggal_Penjualan,
				KodeProduk:      product.KodeProduk,
				NamaProduk:      product.NamaProduk,
				Kategori: domain.Kategori{
					IDKategori:   product.Kategori.IDKategori,
					NamaKategori: product.Kategori.NamaKategori,
				},
				SubKategori: domain.SubKategori{
					IDSubKategori:   product.SubKategori.IDSubKategori,
					NamaSubKategori: product.SubKategori.NamaSubKategori,
				},
				JumlahProduk: detail.Penjualan.JumlahProduk,
				Total:        detail.Penjualan.Total,
			}
			reportItems = append(reportItems, reportItem)
		}
	}

	// Sort data if specified
	if sort == "date_asc" {
		// Implement sorting by date ascending
	} else if sort == "date_desc" {
		// Implement sorting by date descending
	}

	return c.Status(http.StatusOK).JSON(fiber.Map{
		"message": "Data laporan penjualan berhasil diambil",
		"data":    reportItems,
	})
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
