package delivery

import (
	"SIE-SRC/domain"
	"context"
	"fmt"
	"log"
	"net/http"
	"time"

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
	var penjualanList []domain.Penjualan

	if err := c.BodyParser(&penjualanList); err != nil {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{
			"message": "Invalid request format",
			"error":   err.Error(),
		})
	}

	// Basic validation
	if len(penjualanList) == 0 {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{
			"message": "No sales data provided",
		})
	}

	// Set default values and validate each penjualan
	for i := range penjualanList {
		// Set creation time if not provided
		if penjualanList[i].Tanggal.IsZero() {
			penjualanList[i].Tanggal = time.Now()
		}

		// Basic validation for each sale
		if penjualanList[i].NamaPenjual == "" {
			return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{
				"message": fmt.Sprintf("Sale at index %d is missing seller name", i),
			})
		}

		if len(penjualanList[i].Produk) == 0 {
			return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{
				"message": fmt.Sprintf("Sale at index %d has no products", i),
			})
		}

		// Validate each product in the sale
		total := 0
		for j, prod := range penjualanList[i].Produk {
			if prod.IDProduk == "" {
				return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{
					"message": fmt.Sprintf("Product at index %d in sale %d is missing product ID", j, i),
				})
			}
			if prod.JumlahProduk <= 0 {
				return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{
					"message": fmt.Sprintf("Product at index %d in sale %d has invalid quantity", j, i),
				})
			}
			total += prod.Harga * prod.JumlahProduk
		}

		// Set the total
		penjualanList[i].Total = total
	}

	// Create the sales records
	result, err := d.HTTP.CreateBulk(c.Context(), penjualanList)
	if err != nil {
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{
			"message": "Failed to create sales records",
			"error":   err.Error(),
		})
	}

	return c.Status(fiber.StatusCreated).JSON(fiber.Map{
		"message": "Sales records created successfully",
		"data":    result,
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

		if item.JumlahProduk <= 0 {
			return c.Status(http.StatusBadRequest).JSON(fiber.Map{
				"error":     "Kuantitas produk harus lebih dari 0",
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
