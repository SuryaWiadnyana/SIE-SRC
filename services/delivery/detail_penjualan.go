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
	group.Post("/create", handler.CreateDetail)
	group.Get("/by-id/:id_penjualan", handler.GetByID)
	group.Get("/getall", handler.GetAll)
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

	for _, produk := range detailPenjualan.Produk {
		if produk.IDProduk == "" {
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
	id := c.Params("id_penjualan")
	if id == "" {
		return c.Status(http.StatusBadRequest).JSON(fiber.Map{
			"error": "ID Penjualan tidak boleh kosong",
		})
	}

	detail, err := d.HTTP.GetByPenjualanID(c.Context(), id)
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