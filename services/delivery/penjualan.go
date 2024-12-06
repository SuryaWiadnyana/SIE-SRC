package delivery

import (
	"SIE-SRC/domain"
	"context"
	"log"
	"net/http"

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
		log.Printf("Error getting all sales: %v", err)
		return c.Status(http.StatusInternalServerError).JSON(fiber.Map{
			"error": "Gagal mendapatkan data penjualan",
		})
	}

	return c.Status(http.StatusOK).JSON(fiber.Map{
		"message": "Data penjualan berhasil diambil",
		"data":    val,
	})
}

func (d *HttpDeliveryPenjualan) CreateBulk(c *fiber.Ctx) error {
	var sales []domain.Penjualan

	if err := c.BodyParser(&sales); err != nil {
		log.Printf("Error parsing request body: %v", err)
		return c.Status(http.StatusBadRequest).JSON(fiber.Map{
			"error": "Format data tidak valid",
		})
	}

	// Validasi data penjualan
	for i, sale := range sales {
		if sale.NamaPenjual == "" {
			return c.Status(http.StatusBadRequest).JSON(fiber.Map{
				"error": "Nama penjual tidak boleh kosong",
				"index": i,
			})
		}

		if len(sale.Produk) == 0 {
			return c.Status(http.StatusBadRequest).JSON(fiber.Map{
				"error": "Minimal harus ada satu produk",
				"index": i,
			})
		}

		for j, item := range sale.Produk {
			if item.IDProduk == "" {
				return c.Status(http.StatusBadRequest).JSON(fiber.Map{
					"error":     "ID produk tidak boleh kosong",
					"saleIndex": i,
					"itemIndex": j,
				})
			}

			if item.Quantity <= 0 {
				return c.Status(http.StatusBadRequest).JSON(fiber.Map{
					"error":     "Quantity produk harus lebih dari 0",
					"saleIndex": i,
					"itemIndex": j,
				})
			}
		}
	}

	// Logging untuk debugging
	log.Printf("Processing %d sales records", len(sales))

	createdSales, err := d.HTTP.CreateBulk(context.Background(), sales)
	if err != nil {
		log.Printf("Error creating sales: %v", err)
		return c.Status(http.StatusInternalServerError).JSON(fiber.Map{
			"error": err.Error(),
		})
	}

	return c.Status(http.StatusCreated).JSON(fiber.Map{
		"message": "Data penjualan berhasil disimpan",
		"data":    createdSales,
	})
}

func (d *HttpDeliveryPenjualan) Delete(c *fiber.Ctx) error {
	id := c.Params("id_penjualan")
	if id == "" {
		return c.Status(http.StatusBadRequest).JSON(fiber.Map{
			"error": "ID penjualan diperlukan",
		})
	}

	err := d.HTTP.Delete(context.Background(), id)
	if err != nil {
		log.Printf("Error deleting sale %s: %v", id, err)
		return c.Status(http.StatusInternalServerError).JSON(fiber.Map{
			"error": err.Error(),
		})
	}

	return c.Status(http.StatusOK).JSON(fiber.Map{
		"message": "Data penjualan berhasil dihapus",
		"id":      id,
	})
}

func (d *HttpDeliveryPenjualan) Update(c *fiber.Ctx) error {
	id := c.Params("id_penjualan")
	if id == "" {
		return c.Status(http.StatusBadRequest).JSON(fiber.Map{
			"error": "ID penjualan diperlukan",
		})
	}

	var sale domain.Penjualan
	if err := c.BodyParser(&sale); err != nil {
		log.Printf("Error parsing request body: %v", err)
		return c.Status(http.StatusBadRequest).JSON(fiber.Map{
			"error": "Format data tidak valid",
		})
	}

	// Validasi data penjualan
	if sale.NamaPenjual == "" {
		return c.Status(http.StatusBadRequest).JSON(fiber.Map{
			"error": "Nama penjual tidak boleh kosong",
		})
	}

	if len(sale.Produk) == 0 {
		return c.Status(http.StatusBadRequest).JSON(fiber.Map{
			"error": "Minimal harus ada satu produk",
		})
	}

	for i, item := range sale.Produk {
		if item.IDProduk == "" {
			return c.Status(http.StatusBadRequest).JSON(fiber.Map{
				"error":     "ID produk tidak boleh kosong",
				"itemIndex": i,
			})
		}

		if item.Quantity <= 0 {
			return c.Status(http.StatusBadRequest).JSON(fiber.Map{
				"error":     "Quantity produk harus lebih dari 0",
				"itemIndex": i,
			})
		}
	}

	sale.IDPenjualan = id
	err := d.HTTP.Update(context.Background(), &sale)
	if err != nil {
		log.Printf("Error updating sale %s: %v", id, err)
		return c.Status(http.StatusInternalServerError).JSON(fiber.Map{
			"error": err.Error(),
		})
	}

	return c.Status(http.StatusOK).JSON(fiber.Map{
		"message": "Data penjualan berhasil diperbarui",
		"id":      id,
	})
}

func (d *HttpDeliveryPenjualan) GetByID(c *fiber.Ctx) error {
	id := c.Params("id_penjualan")
	if id == "" {
		return c.Status(http.StatusBadRequest).JSON(fiber.Map{
			"error": "ID penjualan diperlukan",
		})
	}

	data, err := d.HTTP.GetByID(context.Background(), id)
	if err != nil {
		log.Printf("Error getting sale %s: %v", id, err)
		return c.Status(http.StatusInternalServerError).JSON(fiber.Map{
			"error": err.Error(),
		})
	}

	return c.Status(http.StatusOK).JSON(fiber.Map{
		"message": "Data penjualan ditemukan",
		"data":    data,
	})
}
