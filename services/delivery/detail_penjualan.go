package delivery

import (
	"SIE-SRC/domain"
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

	group := app.Group("/detail-penjualan")
	group.Get("/by-id/:id_penjualan", handler.GetByID)
	group.Get("/getall", handler.GetAllDetails)
	group.Post("/create", handler.CreateDetail)
}

func (d *HttpDeliveryDetailPenjualan) GetAllDetails(c *fiber.Ctx) error {
	details, err := d.HTTP.GetAllDetails(context.Background())
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
	id := c.Params("id_penjualan")
	if id == "" {
		return c.Status(http.StatusBadRequest).JSON(fiber.Map{
			"error": "ID Penjualan tidak boleh kosong",
		})
	}

	detail, err := d.HTTP.GetByID(c.Context(), id)
	if err != nil {
		log.Printf("Error getting sale detail %s: %v", id, err)
		return c.Status(http.StatusInternalServerError).JSON(fiber.Map{
			"error": fmt.Sprintf("Gagal mendapatkan detail penjualan: %v", err),
		})
	}

	if detail == nil {
		return c.Status(http.StatusNotFound).JSON(fiber.Map{
			"error": "Detail penjualan tidak ditemukan",
		})
	}

	return c.Status(http.StatusOK).JSON(fiber.Map{
		"message": "Detail penjualan berhasil diambil",
		"data":    detail,
	})
}

func (d *HttpDeliveryDetailPenjualan) CreateDetail(c *fiber.Ctx) error {
	var detailPenjualan domain.DetailPenjualan
	if err := c.BodyParser(&detailPenjualan); err != nil {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{
			"message": "Invalid request format",
			"error":   err.Error(),
		})
	}

	// Validate required fields
	if detailPenjualan.Penjualan.IDPenjualan == "" {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{
			"message": "ID Penjualan is required",
		})
	}

	if detailPenjualan.Produk.IDProduk == "" {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{
			"message": "ID Produk is required",
		})
	}

	result, err := d.HTTP.CreateDetails(c.Context(), &domain.DetailPenjualan{})
	if err != nil {
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{
			"message": "Failed to create sale detail",
			"error":   err.Error(),
		})
	}

	return c.Status(fiber.StatusCreated).JSON(fiber.Map{
		"message": "Sale detail created successfully",
		"data":    result,
	})
}
