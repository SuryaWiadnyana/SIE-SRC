package delivery

import (
	"SIE-SRC/domain"
	"SIE-SRC/middleware"
	"context"
	"log"
	"net/http"
	"sort"
	"time"

	"github.com/gofiber/fiber/v2"
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
	// Parse date range
	startDate, err := time.Parse("2006-01-02", c.Query("tanggal_mulai"))
	if err != nil {
		return c.Status(http.StatusBadRequest).JSON(fiber.Map{
			"error": "Format tanggal mulai tidak valid. Gunakan format YYYY-MM-DD",
		})
	}

	endDate, err := time.Parse("2006-01-02", c.Query("tanggal_akhir"))
	if err != nil {
		return c.Status(http.StatusBadRequest).JSON(fiber.Map{
			"error": "Format tanggal akhir tidak valid. Gunakan format YYYY-MM-DD",
		})
	}

	// Validate date range
	if endDate.Before(startDate) {
		return c.Status(http.StatusBadRequest).JSON(fiber.Map{
			"error": "Tanggal akhir tidak boleh sebelum tanggal mulai",
		})
	}

	// Get optional filters
	kategoriID := c.Query("_id")
	subkategoriID := c.Query("_id")
	sortOption := c.Query("sort")

	// Get all sales data
	penjualanList, err := d.PenjualanUC.GetAll(context.Background())
	if err != nil {
		log.Printf("Error getting sales data: %v", err)
		return c.Status(http.StatusInternalServerError).JSON(fiber.Map{
			"error": "Gagal mengambil data penjualan: " + err.Error(),
		})
	}

	// Filter and process sales data
	var filteredData []map[string]interface{}
	for _, penjualan := range penjualanList {
		// Apply date filter
		if penjualan.Tanggal_Penjualan.Before(startDate) || penjualan.Tanggal_Penjualan.After(endDate) {
			continue
		}

		// Get detail penjualan
		details, err := d.DetailPenjualanUC.GetByPenjualanID(context.Background(), penjualan.IDPenjualan)
		if err != nil {
			log.Printf("Error getting sale details for ID %s: %v", penjualan.IDPenjualan, err)
			continue
		}

		// Process each detail
		for _, detail := range details {
			for _, produk := range detail.Produk {
				// Get product details
				produkDetail, err := d.ProdukUC.GetProdukById(context.Background(), produk.IDProduk)
				if err != nil {
					log.Printf("Error getting product details for ID %s: %v", produk.IDProduk, err)
					continue
				}

				// Apply category filter
				if kategoriID != "" && produkDetail.Kategori.IDKategori != kategoriID {
					continue
				}

				// Apply subcategory filter
				if subkategoriID != "" && produkDetail.SubKategori.IDSubKategori != subkategoriID {
					continue
				}

				// Create report item
				reportItem := map[string]interface{}{
					"_id":               penjualan.IDPenjualan,
					"tanggal_penjualan": penjualan.Tanggal_Penjualan.Format("2006-01-02"),
					"kode_produk":       produkDetail.KodeProduk,
					"nama_produk":       produkDetail.NamaProduk,
					"kategori":          produkDetail.Kategori.NamaKategori,
					"subkategori":       produkDetail.SubKategori.NamaSubKategori,
					"jumlah_produk":     penjualan.JumlahProduk,
					"total":             penjualan.Total,
				}

				filteredData = append(filteredData, reportItem)
			}
		}
	}

	// Apply sorting
	switch sortOption {
	case "date_asc":
		sort.Slice(filteredData, func(i, j int) bool {
			dateI, okI := filteredData[i]["tanggal_penjualan"].(string)
			dateJ, okJ := filteredData[j]["tanggal_penjualan"].(string)
			if !okI || !okJ {
				log.Printf("Error: tanggal_penjualan is not a string for index %d and %d", i, j)
				return false
			}
			return dateI < dateJ
		})
	case "date_desc":
		sort.Slice(filteredData, func(i, j int) bool {
			dateI, okI := filteredData[i]["tanggal_penjualan"].(string)
			dateJ, okJ := filteredData[j]["tanggal_penjualan"].(string)
			if !okI || !okJ {
				log.Printf("Error: tanggal_penjualan is not a string for index %d and %d", i, j)
				return false
			}
			return dateI > dateJ
		})
	case "quantity_asc":
		sort.Slice(filteredData, func(i, j int) bool {
			quantityI, okI := filteredData[i]["jumlah_produk"].(int)
			quantityJ, okJ := filteredData[j]["jumlah_produk"].(int)
			if !okI || !okJ {
				log.Printf("Error: jumlah_produk is not an int for index %d and %d", i, j)
				return false
			}
			return quantityI < quantityJ
		})
	case "quantity_desc":
		sort.Slice(filteredData, func(i, j int) bool {
			quantityI, okI := filteredData[i]["jumlah_produk"].(int)
			quantityJ, okJ := filteredData[j]["jumlah_produk"].(int)
			if !okI || !okJ {
				log.Printf("Error: jumlah_produk is not an int for index %d and %d", i, j)
				return false
			}
			return quantityI > quantityJ
		})
	default:
		// Default sort by date ascending for sales report
		sort.Slice(filteredData, func(i, j int) bool {
			dateI, okI := filteredData[i]["tanggal_penjualan"].(string)
			dateJ, okJ := filteredData[j]["tanggal_penjualan"].(string)
			if !okI || !okJ {
				log.Printf("Error: tanggal_penjualan is not a string for index %d and %d", i, j)
				return false
			}
			return dateI < dateJ
		})
	}

	return c.Status(http.StatusOK).JSON(fiber.Map{
		"status": "success",
		"data":   filteredData,
	})
}

func (d *HttpDeliveryLaporan) GetLaporanProduk(c *fiber.Ctx) error {
	// Get filters
	kategoriIDStr := c.Query("kategori_id")
	subkategoriIDStr := c.Query("subkategori_id")
	sortOption := c.Query("sort")

	log.Printf("Received kategori_id: %s", kategoriIDStr)
	log.Printf("Received subkategori_id: %s", subkategoriIDStr)

	// Get string IDs
	kategoriID := kategoriIDStr
	subkategoriID := subkategoriIDStr

	// Get filtered products using repository function
	products, err := d.ProdukUC.GetLaporanProduk(context.Background(), kategoriID, subkategoriID, sortOption)
	if err != nil {
		log.Printf("Error getting product data: %v", err)
		return c.Status(http.StatusInternalServerError).JSON(fiber.Map{
			"error": "Gagal mengambil data produk: " + err.Error(),
		})
	}

	// Process product data
	var filteredData []map[string]interface{}
	for _, product := range products {
		// Create report item
		reportItem := map[string]interface{}{
			"kode_produk":     product.KodeProduk,
			"nama_produk":     product.NamaProduk,
			"kategori":        product.Kategori.NamaKategori,
			"kategori_id":     product.Kategori.IDKategori,
			"subkategori":     product.SubKategori.NamaSubKategori,
			"subkategori_id":  product.SubKategori.IDSubKategori,
			"stok":            product.Stok,
			"harga":           product.HargaProduk,
			"tanggal_expired": product.TanggalKedaluwarsa,
		}

		filteredData = append(filteredData, reportItem)
	}

	// Apply sorting
	switch sortOption {
	case "name_asc":
		sort.Slice(filteredData, func(i, j int) bool {
			nameI, okI := filteredData[i]["nama_produk"].(string)
			nameJ, okJ := filteredData[j]["nama_produk"].(string)
			if !okI || !okJ {
				log.Printf("Error: nama_produk is not a string for index %d and %d", i, j)
				return false
			}
			return nameI < nameJ
		})
	case "name_desc":
		sort.Slice(filteredData, func(i, j int) bool {
			nameI, okI := filteredData[i]["nama_produk"].(string)
			nameJ, okJ := filteredData[j]["nama_produk"].(string)
			if !okI || !okJ {
				log.Printf("Error: nama_produk is not a string for index %d and %d", i, j)
				return false
			}
			return nameI > nameJ
		})
	case "stock_asc":
		sort.Slice(filteredData, func(i, j int) bool {
			stockI, okI := filteredData[i]["stok"].(int)
			stockJ, okJ := filteredData[j]["stok"].(int)
			if !okI || !okJ {
				log.Printf("Error: stok is not an int for index %d and %d", i, j)
				return false
			}
			return stockI < stockJ
		})
	case "stock_desc":
		sort.Slice(filteredData, func(i, j int) bool {
			stockI, okI := filteredData[i]["stok"].(int)
			stockJ, okJ := filteredData[j]["stok"].(int)
			if !okI || !okJ {
				log.Printf("Error: stok is not an int for index %d and %d", i, j)
				return false
			}
			return stockI > stockJ
		})
	default:
		// Default sort by name ascending for product report
		sort.Slice(filteredData, func(i, j int) bool {
			nameI, okI := filteredData[i]["nama_produk"].(string)
			nameJ, okJ := filteredData[j]["nama_produk"].(string)
			if !okI || !okJ {
				log.Printf("Error: nama_produk is not a string for index %d and %d", i, j)
				return false
			}
			return nameI < nameJ
		})
	}

	return c.Status(http.StatusOK).JSON(fiber.Map{
		"status": "success",
		"data":   filteredData,
	})
}
