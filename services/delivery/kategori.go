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

// NewHttpDeliveryKategori membuat instance baru HttpDeliveryKategori dan mendaftarkan routes
func NewHttpDeliveryKategori(app fiber.Router, ku domain.KategoriUseCase) {
	handler := HttpDeliveryKategori{
		KategoriUseCase: ku,
	}

	// Mendaftarkan routes untuk kategori
	kategoriRoutes := app.Group("/kategori")

	// Mendaftarkan routes publik
	kategoriRoutes.Get("/getall", handler.GetAll)
	kategoriRoutes.Get("/getbyid/:_id", handler.GetByID)
	kategoriRoutes.Get("/getbynama/:nama_kategori", handler.GetByName)

	// Mendaftarkan routes khusus admin
	adminRoutes := kategoriRoutes.Group("/admin")
	adminRoutes.Use(middleware.AuthMiddleware("admin"))
	adminRoutes.Post("/create-kategori", handler.CreateKategori)
	adminRoutes.Put("/update-kategori/:_id", handler.UpdateKategori)
	adminRoutes.Delete("/delete-kategori/:_id", handler.DeleteKategori)
}

// CreateKategori menangani pembuatan kategori baru
func (d *HttpDeliveryKategori) CreateKategori(c *fiber.Ctx) error {
	// Parsing body request
	var kategori domain.Kategori
	if err := c.BodyParser(&kategori); err != nil {
		return c.Status(http.StatusBadRequest).JSON(fiber.Map{
			"success": false,
			"error": "Format request tidak valid",
		})
	}

	// Validasi data kategori
	if kategori.NamaKategori == "" {
		return c.Status(http.StatusBadRequest).JSON(fiber.Map{
			"success": false,
			"error": "Nama kategori harus diisi",
		})
	}

	// Generate ID baru jika ID kategori tidak diisi
	if kategori.IDKategori == "" {
		id, err := d.KategoriUseCase.GenerateNextID(context.Background())
		if err != nil {
			return c.Status(http.StatusInternalServerError).JSON(fiber.Map{
				"success": false,
				"error": fmt.Sprintf("Gagal generate ID: %v", err),
			})
		}
		kategori.IDKategori = id
	}

	// Membuat kategori baru
	result, err := d.KategoriUseCase.CreateNewKategori(context.Background(), &kategori)
	if err != nil {
		return c.Status(http.StatusInternalServerError).JSON(fiber.Map{
			"success": false,
			"error": fmt.Sprintf("Gagal membuat kategori: %v", err),
		})
	}

	return c.Status(http.StatusCreated).JSON(fiber.Map{
		"success": true,
		"message": "Kategori berhasil dibuat",
		"data":    result,
	})
}

// GetAll mengambil semua data kategori
func (d *HttpDeliveryKategori) GetAll(c *fiber.Ctx) error {
	// Mengambil semua kategori dari database
	kategoris, err := d.KategoriUseCase.GetAll(context.Background())
	if err != nil {
		return c.Status(http.StatusInternalServerError).JSON(fiber.Map{
			"success": false,
			"error": fmt.Sprintf("Gagal mendapatkan kategori: %v", err),
		})
	}

	return c.Status(http.StatusOK).JSON(fiber.Map{
		"success": true,
		"data": kategoris,
	})
}

// GetByID mengambil kategori berdasarkan ID
func (d *HttpDeliveryKategori) GetByID(c *fiber.Ctx) error {
	// Mengambil ID dari parameter URL
	id := c.Params("_id")
	if id == "" {
		return c.Status(http.StatusBadRequest).JSON(fiber.Map{
			"success": false,
			"error": "ID kategori harus diisi",
		})
	}

	// Mencari kategori berdasarkan ID
	kategori, err := d.KategoriUseCase.GetByID(context.Background(), id)
	if err != nil {
		return c.Status(http.StatusNotFound).JSON(fiber.Map{
			"success": false,
			"error": fmt.Sprintf("Kategori tidak ditemukan: %v", err),
		})
	}

	return c.Status(http.StatusOK).JSON(fiber.Map{
		"success": true,
		"data": kategori,
	})
}

// GetByName mengambil kategori berdasarkan nama
func (d *HttpDeliveryKategori) GetByName(c *fiber.Ctx) error {
	// Mengambil nama kategori dari parameter URL
	namaKategori := c.Params("nama_kategori")
	if namaKategori == "" {
		return c.Status(http.StatusBadRequest).JSON(fiber.Map{
			"success": false,
			"error": "Nama kategori harus diisi",
		})
	}

	// Mencari kategori berdasarkan nama
	kategori, err := d.KategoriUseCase.GetByName(context.Background(), namaKategori)
	if err != nil {
		return c.Status(http.StatusInternalServerError).JSON(fiber.Map{
			"success": false,
			"error": fmt.Sprintf("Gagal mendapatkan kategori: %v", err),
		})
	}

	if kategori == nil {
		return c.Status(http.StatusNotFound).JSON(fiber.Map{
			"success": false,
			"error": "Kategori tidak ditemukan",
		})
	}

	return c.JSON(fiber.Map{
		"success": true,
		"data": kategori,
	})
}

// UpdateKategori memperbarui data kategori berdasarkan ID
func (d *HttpDeliveryKategori) UpdateKategori(c *fiber.Ctx) error {
	// Mengambil ID dari parameter URL
	id := c.Params("_id")
	if id == "" {
		return c.Status(http.StatusBadRequest).JSON(fiber.Map{
			"success": false,
			"error": "ID kategori harus diisi",
		})
	}

	// Memeriksa keberadaan kategori
	_, err := d.KategoriUseCase.GetByID(context.Background(), id)
	if err != nil {
		return c.Status(http.StatusNotFound).JSON(fiber.Map{
			"success": false,
			"error": fmt.Sprintf("Kategori tidak ditemukan: %v", err),
		})
	}

	// Parsing body request
	var kategori domain.Kategori
	if err := c.BodyParser(&kategori); err != nil {
		return c.Status(http.StatusBadRequest).JSON(fiber.Map{
			"success": false,
			"error": "Format request tidak valid",
		})
	}

	// Memastikan ID kategori sesuai
	kategori.IDKategori = id

	// Validasi data kategori
	if kategori.NamaKategori == "" {
		return c.Status(http.StatusBadRequest).JSON(fiber.Map{
			"success": false,
			"error": "Nama kategori harus diisi",
		})
	}

	// Memperbarui kategori
	err = d.KategoriUseCase.Update(context.Background(), &kategori)
	if err != nil {
		return c.Status(http.StatusInternalServerError).JSON(fiber.Map{
			"success": false,
			"error": fmt.Sprintf("Gagal memperbarui kategori: %v", err),
		})
	}

	return c.Status(http.StatusOK).JSON(fiber.Map{
		"success": true,
		"message": "Kategori berhasil diperbarui",
	})
}

// DeleteKategori menghapus kategori berdasarkan ID
func (d *HttpDeliveryKategori) DeleteKategori(c *fiber.Ctx) error {
	// Mengambil ID dari parameter URL
	id := c.Params("_id")
	if id == "" {
		return c.Status(http.StatusBadRequest).JSON(fiber.Map{
			"success": false,
			"error": "ID kategori harus diisi",
		})
	}

	// Memeriksa keberadaan kategori
	_, err := d.KategoriUseCase.GetByID(context.Background(), id)
	if err != nil {
		return c.Status(http.StatusNotFound).JSON(fiber.Map{
			"success": false,
			"error": fmt.Sprintf("Kategori tidak ditemukan: %v", err),
		})
	}

	// Menghapus kategori
	err = d.KategoriUseCase.Delete(context.Background(), id)
	if err != nil {
		return c.Status(http.StatusInternalServerError).JSON(fiber.Map{
			"success": false,
			"error": fmt.Sprintf("Gagal menghapus kategori: %v", err),
		})
	}

	return c.Status(http.StatusOK).JSON(fiber.Map{
		"success": true,
		"message": "Kategori berhasil dihapus",
	})
}
