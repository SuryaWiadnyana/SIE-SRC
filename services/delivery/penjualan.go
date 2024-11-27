package delivery

import (
	"context"
	"log"
	"net/http"
	"SIE-SRC/domain"

	"github.com/asaskevich/govalidator"
	"github.com/gofiber/fiber/v2"
)

type HttpDeliveryPenjualan struct {
	HTTP domain.PenjualanUseCase
}

func NewHttpDeliveryPenjualan(app fiber.Router, HTTP domain.PenjualanUseCase) {
	handler := HttpDeliveryPenjualan{
		HTTP: HTTP,
	}

	group := app.Group("/penjualan")
	group.Get("/getall", handler.GetAll)
	group.Get("/by-id/:id_penjualan", handler.GetByID)
	group.Post("/create", handler.CreateBulk)
	group.Delete("/delete/:id_penjualan", handler.Delete)
	group.Put("/update/:id_penjualan", handler.Update)
}

func (d *HttpDeliveryPenjualan) GetAll(c *fiber.Ctx) error {
	val, err := d.HTTP.GetAll(context.Background())
	if err != nil {
		return c.Status(http.StatusInternalServerError).JSON(fiber.Map{
			"error": "Gagal untuk mendapatkan Data",
		})
	}

	return c.Status(http.StatusOK).JSON(fiber.Map{
		"data": val,
	})
}

func (d *HttpDeliveryPenjualan) CreateBulk(c *fiber.Ctx) error {
	var sales []domain.Penjualan

	if err := c.BodyParser(&sales); err != nil {
		return c.Status(http.StatusBadRequest).JSON(fiber.Map{
			"error": "Invalid request payload",
		})
	}

	// Logging untuk debugging
	log.Printf("Received data: %+v", sales)

	createdSales, err := d.HTTP.CreateBulk(context.Background(), sales)
	if err != nil {
		return c.Status(http.StatusInternalServerError).JSON(fiber.Map{
			"error":   "Failed to create product",
			"message": err.Error(), // Include error message for better debugging
		})
	}

	return c.Status(http.StatusOK).JSON(fiber.Map{
		"message": "Product created successfully",
		"data":    createdSales,
	})
}

func (d *HttpDeliveryPenjualan) Delete(c *fiber.Ctx) error {
	id := c.Params("id_penjualan")
	if id == "" {
		return c.Status(http.StatusBadRequest).JSON(fiber.Map{
			"error": "ID diperlukan",
		})
	}

	err := d.HTTP.Delete(context.Background(), id)
	if err != nil {
		return c.Status(http.StatusInternalServerError).JSON(fiber.Map{
			"error": "Gagal untuk menghapus data",
		})
	}

	return c.Status(http.StatusOK).JSON(fiber.Map{
		"message": "Data berhasil dihapus",
	})
}

func (d *HttpDeliveryPenjualan) Update(c *fiber.Ctx) error {
	id := c.Params("id_penjualan")
	if id == "" {
		return c.Status(http.StatusBadRequest).JSON(fiber.Map{
			"error": "ID diperlukan",
		})
	}

	body := new(domain.Penjualan)
	if err := c.BodyParser(body); err != nil {
		return c.Status(http.StatusBadRequest).JSON(fiber.Map{
			"error": "Gagal untuk mem-parsing request body",
		})
	}

	// Validasi request body
	if valid, err := govalidator.ValidateStruct(body); !valid {
		return c.Status(http.StatusBadRequest).JSON(fiber.Map{
			"error": "Validasi gagal: " + err.Error(),
		})
	}

	body.IDPenjualan = id
	err := d.HTTP.Update(context.Background(), body)
	if err != nil {
		return c.Status(http.StatusInternalServerError).JSON(fiber.Map{
			"error": "Gagal untuk memperbarui data",
		})
	}

	return c.Status(http.StatusOK).JSON(fiber.Map{
		"message": "Data berhasil diperbarui",
	})
}

func (d *HttpDeliveryPenjualan) GetByID(c *fiber.Ctx) error {
	id := c.Params("id_penjualan")
	if id == "" {
		return c.Status(http.StatusBadRequest).JSON(fiber.Map{
			"error": "ID diperlukan",
		})
	}

	data, err := d.HTTP.GetByID(context.Background(), id)
	if err != nil {
		return c.Status(http.StatusInternalServerError).JSON(fiber.Map{
			"error": "Gagal untuk mendapatkan data",
		})
	}

	return c.Status(http.StatusOK).JSON(fiber.Map{
		"message": "Data ditemukan",
		"data":    data,
	})
}
