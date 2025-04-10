package delivery

import (
	"SIE-SRC/domain"
	"SIE-SRC/middleware"
	"context"
	"fmt"
	"log"
	"net/http"

	"github.com/gofiber/fiber/v2"
)

type HttpDeliveryDetailPenjualan struct {
	HTTP domain.DetailPenjualanUseCase
}

func NewHttpDeliveryDetailPenjualan(app fiber.Router, HTTP domain.DetailPenjualanUseCase) {
	handler := &HttpDeliveryDetailPenjualan{
		HTTP: HTTP,
	}

	protected := app.Group("/detail-penjualan")
	protected.Use(middleware.AuthMiddleware("admin", "owner"))
	protected.Post("/create", handler.CreateDetail)
	protected.Get("/by-id/:id_details", handler.GetByID)
	protected.Get("/getall", handler.GetAll)
	protected.Get("/by-penjualan-id/:id_penjualan", handler.GetByPenjualanID)
}

func (d *HttpDeliveryDetailPenjualan) CreateDetail(c *fiber.Ctx) error {
	var detailPenjualan domain.DetailPenjualan
	if err := c.BodyParser(&detailPenjualan); err != nil {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{
			"message": "Format data tidak valid",
			"error":   err.Error(),
		})
	}

	if detailPenjualan.Penjualan.IDPenjualan == "" {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{
			"message": "ID Penjualan diperlukan",
		})
	}

	if len(detailPenjualan.Produk) == 0 {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{
			"message": "Setidaknya satu produk diperlukan",
		})
	}

	for _, detail := range detailPenjualan.Produk {
		if detail.IDProduk == "" {
			return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{
				"message": "ID Produk diperlukan untuk semua produk",
			})
		}
	}

	result, err := d.HTTP.CreateDetails(c.Context(), &detailPenjualan)
	if err != nil {
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{
			"message": "Gagal membuat detail penjualan",
			"error":   err.Error(),
		})
	}

	return c.Status(fiber.StatusCreated).JSON(fiber.Map{
		"message": "Detail penjualan berhasil dibuat",
		"data":    result,
	})
}

func (d *HttpDeliveryDetailPenjualan) GetAll(c *fiber.Ctx) error {
	details, err := d.HTTP.GetAll(context.Background())
	if err != nil {
		log.Printf("Error getting all sale details: %v", err)
		return c.Status(http.StatusInternalServerError).JSON(fiber.Map{
			"error": "Gagal mendapatkan data detail penjualan",
		})
	}

	return c.Status(http.StatusOK).JSON(fiber.Map{
		"message": "Data detail penjualan berhasil diambil",
		"data":    details,
	})
}

func (d *HttpDeliveryDetailPenjualan) GetByID(c *fiber.Ctx) error {
	id := c.Params("id_details")
	if id == "" {
		return c.Status(http.StatusBadRequest).JSON(fiber.Map{
			"error": "ID tidak boleh kosong",
		})
	}

	detail, err := d.HTTP.GetByID(c.Context(), id)
	if err != nil {
		log.Printf("Error getting detail %s: %v", id, err)
		return c.Status(http.StatusInternalServerError).JSON(fiber.Map{
			"error": fmt.Sprintf("Gagal mendapatkan detail: %v", err),
		})
	}

	if detail == nil {
		return c.Status(http.StatusNotFound).JSON(fiber.Map{
			"error": "Detail tidak ditemukan",
		})
	}

	return c.Status(http.StatusOK).JSON(fiber.Map{
		"message": "Detail penjualan berhasil diambil",
		"data":    detail,
	})
}

func (d *HttpDeliveryDetailPenjualan) GetByPenjualanID(c *fiber.Ctx) error {
	id_penjualan := c.Params("id_penjualan")
	if id_penjualan == "" {
		return c.Status(http.StatusBadRequest).JSON(fiber.Map{
			"error": "ID Penjualan tidak boleh kosong",
		})
	}

	details, err := d.HTTP.GetByPenjualanID(c.Context(), id_penjualan)
	if err != nil {
		log.Printf("Error getting details for penjualan %s: %v", id_penjualan, err)
		return c.Status(http.StatusInternalServerError).JSON(fiber.Map{
			"error": fmt.Sprintf("Gagal mendapatkan detail: %v", err),
		})
	}

	if len(details) == 0 {
		return c.Status(http.StatusNotFound).JSON(fiber.Map{
			"error": "Detail penjualan tidak ditemukan",
		})
	}

	return c.Status(http.StatusOK).JSON(fiber.Map{
		"message": "Detail penjualan berhasil diambil",
		"data":    details,
	})
}
