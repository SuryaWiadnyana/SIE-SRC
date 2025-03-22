package delivery

import (
	"SIE-SRC/domain"
	"SIE-SRC/utils"
	"SIE-SRC/middleware"
	"context"
	"fmt"
	"net/http"
	"time"

	"github.com/gofiber/fiber/v2"
)

type HttpDeliveryLaporan struct {
	PenjualanUsecase       domain.PenjualanUsecase
	DetailPenjualanUsecase domain.DetailPenjualanUsecase
	ProdukUsecase          domain.ProdukUsecase
	KategoriUsecase        domain.KategoriUsecase
	SubKategoriUsecase     domain.SubKategoriUsecase
}

func NewHttpDeliveryLaporan(router fiber.Router, penjualanUsecase domain.PenjualanUsecase, detailPenjualanUsecase domain.DetailPenjualanUsecase, produkUsecase domain.ProdukUsecase, kategoriUsecase domain.KategoriUsecase, subkategoriUsecase domain.SubKategoriUsecase) {
	handler := &HttpDeliveryLaporan{
		PenjualanUsecase:       penjualanUsecase,
		DetailPenjualanUsecase: detailPenjualanUsecase,
		ProdukUsecase:          produkUsecase,
		KategoriUsecase:        kategoriUsecase,
		SubKategoriUsecase:     subkategoriUsecase,
	}

	laporanRoute := router.Group("/laporan")
	laporanRoute.Use(middleware.AuthMiddleware("admin", "owner"))
	laporanRoute.Get("/penjualan", handler.GetLaporanPenjualan)
	laporanRoute.Get("/produk", handler.GetLaporanProduk)
}

func (h *HttpDeliveryLaporan) GetLaporanPenjualan(c *fiber.Ctx) error {
	// Parse query parameters
	idKategori := c.Query("id_kategori")
	idSubkategori := c.Query("id_subkategori")
	tanggalMulai := c.Query("tanggal_mulai")
	tanggalAkhir := c.Query("tanggal_akhir")
	sort := c.Query("sort")

	// Validate required parameters
	if tanggalMulai == "" || tanggalAkhir == "" {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{
			"message": "tanggal_mulai and tanggal_akhir are required",
		})
	}

	// Parse dates
	startDate, err := time.Parse("2006-01-02", tanggalMulai)
	if err != nil {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{
			"message": "invalid tanggal_mulai format",
		})
	}

	endDate, err := time.Parse("2006-01-02", tanggalAkhir)
	if err != nil {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{
			"message": "invalid tanggal_akhir format",
		})
	}

	// Get sales data within date range
	penjualanList, err := h.PenjualanUsecase.GetByDateRange(c.Context(), startDate, endDate)
	if err != nil {
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{
			"message": "failed to get sales data",
			"error":   err.Error(),
		})
	}

	// Filter by kategori and subkategori if provided
	var filteredPenjualan []domain.Penjualan
	for _, p := range penjualanList {
		shouldInclude := true
		if idKategori != "" || idSubkategori != "" {
			details, err := h.DetailPenjualanUsecase.GetByPenjualanID(c.Context(), p.IDPenjualan)
			if err != nil {
				continue
			}

			for _, detail := range details {
				for _, produk := range detail.Produk {
					if (idKategori != "" && produk.Kategori.IDKategori != idKategori) ||
						(idSubkategori != "" && produk.SubKategori.IDSubKategori != idSubkategori) {
						shouldInclude = false
						break
					}
				}
			}
		}
		if shouldInclude {
			filteredPenjualan = append(filteredPenjualan, p)
		}
	}

	// Sort data if requested
	if sort != "" {
		utils.SortPenjualan(filteredPenjualan, sort)
	}

	// Convert to report format
	var report []domain.ResponseSalesReportItem
	for _, p := range filteredPenjualan {
		item := domain.ResponseSalesReportItem{
			IDPenjualan:       p.IDPenjualan,
			TanggalPenjualan: p.Tanggal_Penjualan,
			Total:            p.Total,
		}
		report = append(report, item)
	}

	return c.Status(fiber.StatusOK).JSON(fiber.Map{
		"message": "success",
		"data":    report,
	})
}

func (h *HttpDeliveryLaporan) GetLaporanProduk(c *fiber.Ctx) error {
	// Parse query parameters
	idKategori := c.Query("id_kategori")
	idSubkategori := c.Query("id_subkategori")
	sort := c.Query("sort")

	// Get all products
	produkList, err := h.ProdukUsecase.GetAll(c.Context())
	if err != nil {
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{
			"message": "failed to get product data",
			"error":   err.Error(),
		})
	}

	// Filter by kategori and subkategori if provided
	var filteredProduk []domain.Produk
	for _, p := range produkList {
		if (idKategori == "" || p.Kategori.IDKategori == idKategori) &&
			(idSubkategori == "" || p.SubKategori.IDSubKategori == idSubkategori) {
			filteredProduk = append(filteredProduk, p)
		}
	}

	// Sort data if requested
	if sort != "" {
		utils.SortProduk(filteredProduk, sort)
	}

	// Convert to report format
	var report []domain.ResponseProductReportItem
	for _, p := range filteredProduk {
		item := domain.ResponseProductReportItem{
			IDProduk:    p.IDProduk,
			NamaProduk:  p.NamaProduk,
			HargaProduk: p.HargaProduk,
			Stok:        p.Stok,
		}
		report = append(report, item)
	}

	return c.Status(fiber.StatusOK).JSON(fiber.Map{
		"message": "success",
		"data":    report,
	})
}