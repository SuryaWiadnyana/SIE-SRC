package delivery

import (
	"SIE-SRC/domain"
	"SIE-SRC/middleware"
	"context"
	"fmt"
	"net/http"

	"github.com/gofiber/fiber/v2"
)

type HttpDeliverySubKategori struct {
	SubKategoriUseCase domain.SubKategoriUseCase
	KategoriUseCase    domain.KategoriUseCase
}

func NewHttpDeliverySubKategori(app fiber.Router, sku domain.SubKategoriUseCase, ku domain.KategoriUseCase) {
	handler := HttpDeliverySubKategori{
		SubKategoriUseCase: sku,
		KategoriUseCase:    ku,
	}

	// Routes untuk subkategori
	subKategoriRoutes := app.Group("/subkategori")

	// Routes publik
	subKategoriRoutes.Get("/getall", handler.GetAll)
	subKategoriRoutes.Get("/getbyid/:id_subkategori", handler.GetByID)

	// Routes khusus admin
	adminRoutes := subKategoriRoutes.Group("/admin")
	adminRoutes.Use(middleware.AuthMiddleware("admin"))
	adminRoutes.Post("/create-subkategori", handler.CreateSubKategori)
	adminRoutes.Put("/update-subkategori/:id_subkategori", handler.UpdateSubKategori)
}

// CreateSubKategori menangani pembuatan subkategori baru
func (d *HttpDeliverySubKategori) CreateSubKategori(c *fiber.Ctx) error {
	var subKategori domain.SubKategori
	if err := c.BodyParser(&subKategori); err != nil {
		return c.Status(http.StatusBadRequest).JSON(fiber.Map{
			"error": "Format request tidak valid",
		})
	}

	// Validasi data subkategori
	if subKategori.NamaSubKategori == "" {
		return c.Status(http.StatusBadRequest).JSON(fiber.Map{
			"error": "Nama sub kategori harus diisi",
		})
	}

	// Validasi kategori
	if subKategori.Kategori == nil || subKategori.Kategori.IDKategori == "" {
		return c.Status(http.StatusBadRequest).JSON(fiber.Map{
			"error": "ID kategori harus diisi",
		})
	}

	// Periksa apakah kategori ada
	kategori, err := d.KategoriUseCase.GetByID(context.Background(), subKategori.Kategori.IDKategori)
	if err != nil {
		return c.Status(http.StatusBadRequest).JSON(fiber.Map{
			"error": fmt.Sprintf("Kategori tidak ditemukan: %v", err),
		})
	}

	// Set nama kategori
	subKategori.Kategori.NamaKategori = kategori.NamaKategori

	// Jika ID subkategori tidak diisi, generate ID baru
	if subKategori.IDSubKategori == "" {
		id, err := d.SubKategoriUseCase.GenerateNextID(context.Background())
		if err != nil {
			return c.Status(http.StatusInternalServerError).JSON(fiber.Map{
				"error": fmt.Sprintf("Gagal generate ID: %v", err),
			})
		}
		subKategori.IDSubKategori = id
	}

	// Buat subkategori baru
	result, err := d.SubKategoriUseCase.CreateNewSubKategori(context.Background(), &subKategori)
	if err != nil {
		return c.Status(http.StatusInternalServerError).JSON(fiber.Map{
			"error": fmt.Sprintf("Gagal membuat sub kategori: %v", err),
		})
	}

	return c.Status(http.StatusCreated).JSON(fiber.Map{
		"message": "Sub kategori berhasil dibuat",
		"data":    result,
	})
}

// GetAll menangani pengambilan semua subkategori
func (d *HttpDeliverySubKategori) GetAll(c *fiber.Ctx) error {
	subKategoris, err := d.SubKategoriUseCase.GetAll(context.Background())
	if err != nil {
		return c.Status(http.StatusInternalServerError).JSON(fiber.Map{
			"error": fmt.Sprintf("Gagal mendapatkan sub kategori: %v", err),
		})
	}

	return c.Status(http.StatusOK).JSON(fiber.Map{
		"data": subKategoris,
	})
}

// GetByID menangani pengambilan subkategori berdasarkan ID
func (d *HttpDeliverySubKategori) GetByID(c *fiber.Ctx) error {
	id := c.Params("id_subkategori")
	if id == "" {
		return c.Status(http.StatusBadRequest).JSON(fiber.Map{
			"error": "ID sub kategori harus diisi",
		})
	}

	subKategori, err := d.SubKategoriUseCase.GetByID(context.Background(), id)
	if err != nil {
		return c.Status(http.StatusNotFound).JSON(fiber.Map{
			"error": fmt.Sprintf("Sub kategori tidak ditemukan: %v", err),
		})
	}

	return c.Status(http.StatusOK).JSON(fiber.Map{
		"data": subKategori,
	})
}

// UpdateSubKategori menangani pembaruan subkategori berdasarkan ID
func (d *HttpDeliverySubKategori) UpdateSubKategori(c *fiber.Ctx) error {
	id := c.Params("id_subkategori")
	if id == "" {
		return c.Status(http.StatusBadRequest).JSON(fiber.Map{
			"error": "ID sub kategori harus diisi",
		})
	}

	// Periksa apakah subkategori dengan ID tersebut ada
	_, err := d.SubKategoriUseCase.GetByID(context.Background(), id)
	if err != nil {
		return c.Status(http.StatusNotFound).JSON(fiber.Map{
			"error": fmt.Sprintf("Sub kategori tidak ditemukan: %v", err),
		})
	}

	// Parse body request
	var subKategori domain.SubKategori
	if err := c.BodyParser(&subKategori); err != nil {
		return c.Status(http.StatusBadRequest).JSON(fiber.Map{
			"error": "Format request tidak valid",
		})
	}

	// Pastikan ID subkategori sesuai dengan parameter
	subKategori.IDSubKategori = id

	// Validasi data subkategori
	if subKategori.NamaSubKategori == "" {
		return c.Status(http.StatusBadRequest).JSON(fiber.Map{
			"error": "Nama sub kategori harus diisi",
		})
	}

	// Validasi kategori
	if subKategori.Kategori == nil || subKategori.Kategori.IDKategori == "" {
		return c.Status(http.StatusBadRequest).JSON(fiber.Map{
			"error": "ID kategori harus diisi",
		})
	}

	// Periksa apakah kategori ada
	kategori, err := d.KategoriUseCase.GetByID(context.Background(), subKategori.Kategori.IDKategori)
	if err != nil {
		return c.Status(http.StatusBadRequest).JSON(fiber.Map{
			"error": fmt.Sprintf("Kategori tidak ditemukan: %v", err),
		})
	}

	// Set nama kategori
	subKategori.Kategori.NamaKategori = kategori.NamaKategori

	// Update subkategori
	err = d.SubKategoriUseCase.UpdateSubKategori(context.Background(), &subKategori)
	if err != nil {
		return c.Status(http.StatusInternalServerError).JSON(fiber.Map{
			"error": fmt.Sprintf("Gagal memperbarui sub kategori: %v", err),
		})
	}

	return c.Status(http.StatusOK).JSON(fiber.Map{
		"message": "Sub kategori berhasil diperbarui",
	})
}
