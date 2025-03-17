package delivery

import (
	"SIE-SRC/domain"
	"SIE-SRC/middleware"
	"context"
	"fmt"
	"net/http"

	"github.com/gofiber/fiber/v2"
)

type HttpDeliveryKategori struct {
	KategoriUseCase domain.KategoriUseCase
}

func NewHttpDeliveryKategori(app fiber.Router, ku domain.KategoriUseCase) {
	handler := HttpDeliveryKategori{
		KategoriUseCase: ku,
	}

	// Routes untuk kategori
	kategoriRoutes := app.Group("/kategori")

	// Routes publik
	kategoriRoutes.Get("/getall", handler.GetAll)
	kategoriRoutes.Get("/getbyid/:id_kategori", handler.GetByID)

	// Routes khusus admin
	adminRoutes := kategoriRoutes.Group("/admin")
	adminRoutes.Use(middleware.AuthMiddleware("admin"))
	adminRoutes.Post("/create-kategori", handler.CreateKategori)
	adminRoutes.Put("/update-kategori/:id_kategori", handler.UpdateKategori)
}

// CreateKategori menangani pembuatan kategori baru
func (d *HttpDeliveryKategori) CreateKategori(c *fiber.Ctx) error {
	var kategori domain.Kategori
	if err := c.BodyParser(&kategori); err != nil {
		return c.Status(http.StatusBadRequest).JSON(fiber.Map{
			"error": "Format request tidak valid",
		})
	}

	// Validasi data kategori
	if kategori.NamaKategori == "" {
		return c.Status(http.StatusBadRequest).JSON(fiber.Map{
			"error": "Nama kategori harus diisi",
		})
	}

	// Jika ID kategori tidak diisi, generate ID baru
	if kategori.IDKategori == "" {
		id, err := d.KategoriUseCase.GenerateNextID(context.Background())
		if err != nil {
			return c.Status(http.StatusInternalServerError).JSON(fiber.Map{
				"error": fmt.Sprintf("Gagal generate ID: %v", err),
			})
		}
		kategori.IDKategori = id
	}

	// Buat kategori baru
	result, err := d.KategoriUseCase.CreateNewKategori(context.Background(), &kategori)
	if err != nil {
		return c.Status(http.StatusInternalServerError).JSON(fiber.Map{
			"error": fmt.Sprintf("Gagal membuat kategori: %v", err),
		})
	}

	return c.Status(http.StatusCreated).JSON(fiber.Map{
		"message": "Kategori berhasil dibuat",
		"data":    result,
	})
}

// GetAll menangani pengambilan semua kategori
func (d *HttpDeliveryKategori) GetAll(c *fiber.Ctx) error {
	kategoris, err := d.KategoriUseCase.GetAll(context.Background())
	if err != nil {
		return c.Status(http.StatusInternalServerError).JSON(fiber.Map{
			"error": fmt.Sprintf("Gagal mendapatkan kategori: %v", err),
		})
	}

	return c.Status(http.StatusOK).JSON(fiber.Map{
		"data": kategoris,
	})
}

// GetByID menangani pengambilan kategori berdasarkan ID
func (d *HttpDeliveryKategori) GetByID(c *fiber.Ctx) error {
	id := c.Params("id_kategori")
	if id == "" {
		return c.Status(http.StatusBadRequest).JSON(fiber.Map{
			"error": "ID kategori harus diisi",
		})
	}

	kategori, err := d.KategoriUseCase.GetByID(context.Background(), id)
	if err != nil {
		return c.Status(http.StatusNotFound).JSON(fiber.Map{
			"error": fmt.Sprintf("Kategori tidak ditemukan: %v", err),
		})
	}

	return c.Status(http.StatusOK).JSON(fiber.Map{
		"data": kategori,
	})
}

// UpdateKategori menangani pembaruan kategori berdasarkan ID
func (d *HttpDeliveryKategori) UpdateKategori(c *fiber.Ctx) error {
	id := c.Params("id_kategori")
	if id == "" {
		return c.Status(http.StatusBadRequest).JSON(fiber.Map{
			"error": "ID kategori harus diisi",
		})
	}

	// Periksa apakah kategori dengan ID tersebut ada
	_, err := d.KategoriUseCase.GetByID(context.Background(), id)
	if err != nil {
		return c.Status(http.StatusNotFound).JSON(fiber.Map{
			"error": fmt.Sprintf("Kategori tidak ditemukan: %v", err),
		})
	}

	// Parse body request
	var kategori domain.Kategori
	if err := c.BodyParser(&kategori); err != nil {
		return c.Status(http.StatusBadRequest).JSON(fiber.Map{
			"error": "Format request tidak valid",
		})
	}

	// Pastikan ID kategori sesuai dengan parameter
	kategori.IDKategori = id

	// Validasi data kategori
	if kategori.NamaKategori == "" {
		return c.Status(http.StatusBadRequest).JSON(fiber.Map{
			"error": "Nama kategori harus diisi",
		})
	}

	// Update kategori
	err = d.KategoriUseCase.Update(context.Background(), &kategori)
	if err != nil {
		return c.Status(http.StatusInternalServerError).JSON(fiber.Map{
			"error": fmt.Sprintf("Gagal memperbarui kategori: %v", err),
		})
	}

	return c.Status(http.StatusOK).JSON(fiber.Map{
		"message": "Kategori berhasil diperbarui",
	})
}
