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
	kategoriID := c.Query("id_kategori")
	subkategoriID := c.Query("id_subkategori")
	sortOption := c.Query("sort")

	// Get sales data
	details, err := d.DetailPenjualanUC.GetAll(context.Background())
	if err != nil {
		log.Printf("Error getting sales details: %v", err)
		return c.Status(http.StatusInternalServerError).JSON(fiber.Map{
			"error": "Gagal mengambil data penjualan: " + err.Error(),
		})
	}

	// Filter and process sales data
	var filteredData []map[string]interface{}
	for _, detail := range details {
		tanggalPenjualan := detail.Penjualan.Tanggal_Penjualan

		// Apply date filter
		if tanggalPenjualan.Before(startDate) || tanggalPenjualan.After(endDate) {
			continue
		}

		// Process each item in the sale
		for _, product := range detail.Produk {
			// Get product details
			produk, err := d.ProdukUC.GetProdukById(context.Background(), product.IDProduk)
			if err != nil {
				continue
			}

			// Apply category filter
			if kategoriID != "" && produk.Kategori.IDKategori != kategoriID {
				continue
			}

			// Apply subcategory filter
			if subkategoriID != "" && produk.SubKategori.IDSubKategori != subkategoriID {
				continue
			}

			// Create report item
			reportItem := map[string]interface{}{
				"tanggal_penjualan": detail.Penjualan.Tanggal_Penjualan,
				"kode_produk":       produk.KodeProduk,
				"nama_produk":       produk.NamaProduk,
				"kategori":          produk.Kategori,
				"subkategori":       produk.SubKategori,
				"jumlah_produk":     detail.Penjualan.JumlahProduk,
				"total":             detail.Penjualan.Total,
			}

			filteredData = append(filteredData, reportItem)
		}
	}

	// Apply sorting
	switch sortOption {
	case "date_asc":
		sort.Slice(filteredData, func(i, j int) bool {
			return filteredData[i]["tanggal_penjualan"].(string) < filteredData[j]["tanggal_penjualan"].(string)
		})
	case "date_desc":
		sort.Slice(filteredData, func(i, j int) bool {
			return filteredData[i]["tanggal_penjualan"].(string) > filteredData[j]["tanggal_penjualan"].(string)
		})
	case "quantity_asc":
		sort.Slice(filteredData, func(i, j int) bool {
			return filteredData[i]["jumlah_produk"].(int) < filteredData[j]["jumlah_produk"].(int)
		})
	case "quantity_desc":
		sort.Slice(filteredData, func(i, j int) bool {
			return filteredData[i]["jumlah_produk"].(int) > filteredData[j]["jumlah_produk"].(int)
		})
	}

	return c.Status(http.StatusOK).JSON(fiber.Map{
		"status": "success",
		"data":   filteredData,
	})
}

func (d *HttpDeliveryLaporan) GetLaporanProduk(c *fiber.Ctx) error {
	// Get filters
	kategoriID := c.Query("id_kategori")
	subkategoriID := c.Query("id_subkategori")
	sortOption := c.Query("sort")

	// Get all products
	products, err := d.ProdukUC.GetAllProduk(context.Background())
	if err != nil {
		log.Printf("Error getting product data: %v", err)
		return c.Status(http.StatusInternalServerError).JSON(fiber.Map{
			"error": "Gagal mengambil data produk: " + err.Error(),
		})
	}

	// Filter and process product data
	var filteredData []map[string]interface{}
	for _, product := range products {
		// Apply category filter
		if kategoriID != "" && product.Kategori.IDKategori != kategoriID {
			continue
		}

		// Apply subcategory filter
		if subkategoriID != "" && product.SubKategori.IDSubKategori != subkategoriID {
			continue
		}

		// Create report item
		reportItem := map[string]interface{}{
			"kode_produk": product.KodeProduk,
			"nama_produk": product.NamaProduk,
			"kategori":    product.Kategori,
			"subkategori": product.SubKategori,
			"stok":        product.Stok,
			"harga":       product.HargaProduk,
		}

		filteredData = append(filteredData, reportItem)
	}

	// Apply sorting
	switch sortOption {
	case "name_asc":
		sort.Slice(filteredData, func(i, j int) bool {
			return filteredData[i]["nama_produk"].(string) < filteredData[j]["nama_produk"].(string)
		})
	case "name_desc":
		sort.Slice(filteredData, func(i, j int) bool {
			return filteredData[i]["nama_produk"].(string) > filteredData[j]["nama_produk"].(string)
		})
	case "stock_asc":
		sort.Slice(filteredData, func(i, j int) bool {
			return filteredData[i]["stok"].(int) < filteredData[j]["stok"].(int)
		})
	case "stock_desc":
		sort.Slice(filteredData, func(i, j int) bool {
			return filteredData[i]["stok"].(int) > filteredData[j]["stok"].(int)
		})
	}

	return c.Status(http.StatusOK).JSON(fiber.Map{
		"status": "success",
		"data":   filteredData,
	})
}
