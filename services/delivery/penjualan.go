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

type HttpDeliveryPenjualan struct {
	HTTP            domain.PenjualanUseCase
	User            domain.UserUseCase
	DetailPenjualan domain.DetailPenjualanUseCase
}

type PenjualanRequest struct {
	Penjualan domain.Penjualan `json:"penjualan"`
	Produk    domain.Produk    `json:"produk"`
}

func NewHttpDeliveryPenjualan(app fiber.Router, HTTP domain.PenjualanUseCase, userUC domain.UserUseCase, detailUC domain.DetailPenjualanUseCase) {
	handler := &HttpDeliveryPenjualan{
		HTTP:            HTTP,
		User:            userUC,
		DetailPenjualan: detailUC,
	}

	group := app.Group("/penjualan")
	// Menambahkan middleware auth untuk semua endpoint penjualan
	group.Use(middleware.AuthMiddleware("admin", "owner"))
	group.Post("/create", handler.CreateBulk)
	group.Get("/getall", handler.GetAll)
	group.Get("/by-id/:id_penjualan", handler.GetByID)
	group.Delete("/delete/:id_penjualan", handler.Delete)
	// group.Put("/update/:id_penjualan", handler.Update)
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
	var requestList []PenjualanRequest

	if err := c.BodyParser(&requestList); err != nil {
		log.Printf("Error parsing request body: %v", err)
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{
			"message": "Format request tidak valid",
			"error":   err.Error(),
		})
	}

	if len(requestList) == 0 {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{
			"message": "Data penjualan tidak boleh kosong",
		})
	}

	username := c.Locals("username")
	if username == nil {
		return c.Status(fiber.StatusUnauthorized).JSON(fiber.Map{
			"message": "Unauthorized: Data pengguna tidak ditemukan",
		})
	}

	usernameStr, ok := username.(string)
	if !ok || usernameStr == "" {
		return c.Status(fiber.StatusUnauthorized).JSON(fiber.Map{
			"message": "Data username tidak valid",
		})
	}

	user, err := d.User.GetUserByUsername(c.Context(), usernameStr)
	if err != nil {
		log.Printf("Error getting user: %v", err)
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{
			"message": "Gagal mendapatkan data pengguna",
			"error":   err.Error(),
		})
	}

	// Extract penjualan list from request
	var penjualanList []domain.Penjualan
	for i, req := range requestList {
		penjualan := req.Penjualan
		penjualan.User = *user

		if penjualan.JumlahProduk <= 0 {
			return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{
				"message": fmt.Sprintf("Jumlah produk tidak valid pada data ke-%d", i+1),
			})
		}

		if penjualan.Total <= 0 {
			return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{
				"message": fmt.Sprintf("Total tidak valid pada data ke-%d", i+1),
			})
		}

		if req.Produk.IDProduk == "" {
			return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{
				"message": fmt.Sprintf("Data produk tidak valid pada data ke-%d", i+1),
			})
		}

		penjualanList = append(penjualanList, penjualan)
	}

	// Create penjualan records
	result, err := d.HTTP.CreateBulk(c.Context(), penjualanList)
	if err != nil {
		log.Printf("Error creating penjualan: %v", err)
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{
			"message": "Gagal membuat data penjualan",
			"error":   err.Error(),
		})
	}

	// Check if DetailPenjualan is initialized
	if d.DetailPenjualan == nil {
		log.Printf("Warning: DetailPenjualan use case is not initialized")
		return c.Status(fiber.StatusCreated).JSON(fiber.Map{
			"message": "Data penjualan berhasil dibuat (detail penjualan tidak tersedia)",
			"data":    result,
		})
	}

	log.Printf("Starting to create %d detail penjualan records", len(result))

	// Create detail penjualan for each penjualan
	var details []domain.DetailPenjualan
	for i, penjualan := range result {
		detail := domain.DetailPenjualan{
			Penjualan:       penjualan,
			Produk:         requestList[i].Produk,
			TotalPendapatan: penjualan.Total,
		}

		log.Printf("Creating detail penjualan for penjualan ID %s with produk ID %s", penjualan.IDPenjualan, requestList[i].Produk.IDProduk)
		createdDetail, err := d.DetailPenjualan.CreateDetails(c.Context(), &detail)
		if err != nil {
			log.Printf("Error creating detail penjualan for penjualan ID %s: %v", penjualan.IDPenjualan, err)
			continue
		}
		if createdDetail != nil {
			log.Printf("Successfully created detail penjualan with ID %s", createdDetail.ID_DetailPenjualan)
			details = append(details, *createdDetail)
		} else {
			log.Printf("Warning: detail is nil for penjualan ID %s", penjualan.IDPenjualan)
		}
	}

	log.Printf("Created %d detail penjualan records", len(details))

	return c.Status(fiber.StatusCreated).JSON(fiber.Map{
		"message": "Data penjualan dan detail berhasil dibuat",
		"data":    result,
		"details": details,
	})
}

func (d *HttpDeliveryPenjualan) Delete(c *fiber.Ctx) error {
	id := c.Params("id_penjualan")
	if id == "" {
		return c.Status(http.StatusBadRequest).JSON(fiber.Map{
			"error": "ID Penjualan tidak boleh kosong",
		})
	}

	// Hapus detail penjualan terlebih dahulu
	err := d.DetailPenjualan.Delete(c.Context(), id)
	if err != nil {
		log.Printf("Error deleting sale detail %s: %v", id, err)
		// Continue to delete the main sale
	}

	err = d.HTTP.Delete(c.Context(), id)
	if err != nil {
		return c.Status(http.StatusInternalServerError).JSON(fiber.Map{
			"error": fmt.Sprintf("Gagal menghapus penjualan: %v", err),
		})
	}

	return c.Status(http.StatusOK).JSON(fiber.Map{
		"message": "Penjualan berhasil dihapus",
	})
}

// func (d *HttpDeliveryPenjualan) Update(c *fiber.Ctx) error {
// 	id := c.Params("id_penjualan")
// 	if id == "" {
// 		return c.Status(http.StatusBadRequest).JSON(fiber.Map{
// 			"error": "ID Penjualan tidak boleh kosong",
// 		})
// 	}

// 	var updatedPenjualan domain.Penjualan
// 	if err := c.BodyParser(&updatedPenjualan); err != nil {
// 		return c.Status(http.StatusBadRequest).JSON(fiber.Map{
// 			"error": "Format data tidak valid",
// 		})
// 	}

// 	// Set ID from path parameter
// 	updatedPenjualan.IDPenjualan = id

// 	// Validate products and calculate total
// 	if len(updatedPenjualan.Produk) == 0 {
// 		return c.Status(http.StatusBadRequest).JSON(fiber.Map{
// 			"error": "Penjualan harus memiliki minimal satu produk",
// 		})
// 	}

// 	total := 0
// 	for i, prod := range updatedPenjualan.Produk {
// 		if prod.IDProduk == "" {
// 			return c.Status(http.StatusBadRequest).JSON(fiber.Map{
// 				"error": fmt.Sprintf("Produk pada index %d tidak memiliki ID", i),
// 			})
// 		}
// 		if prod.Stok <= 0 {
// 			return c.Status(http.StatusBadRequest).JSON(fiber.Map{
// 				"error": fmt.Sprintf("Produk pada index %d memiliki stok tidak valid", i),
// 			})
// 		}
// 		total += prod.HargaProduk * prod.Stok
// 	}
// 	updatedPenjualan.Total = total

// 	// Update penjualan
// 	err := d.HTTP.Update(c.Context(), &updatedPenjualan)
// 	if err != nil {
// 		return c.Status(http.StatusInternalServerError).JSON(fiber.Map{
// 			"error": fmt.Sprintf("Gagal mengupdate penjualan: %v", err),
// 		})
// 	}

// 	// Update detail penjualan
// 	err = d.DetailPenjualan.UpdateDetails(c.Context(), &domain.DetailPenjualan{
// 		Penjualan: updatedPenjualan,
// 	})
// 	if err != nil {
// 		log.Printf("Error updating sale detail %s: %v", id, err)
// 		// Continue as the main sale is already updated
// 	}

// 	return c.Status(http.StatusOK).JSON(fiber.Map{
// 		"message": "Penjualan berhasil diupdate",
// 		"data":    updatedPenjualan,
// 	})
// }

func (d *HttpDeliveryPenjualan) GetByID(c *fiber.Ctx) error {
	id := c.Params("id_penjualan")
	if id == "" {
		return c.Status(http.StatusBadRequest).JSON(fiber.Map{
			"error": "ID Penjualan tidak boleh kosong",
		})
	}

	penjualan, err := d.HTTP.GetByID(c.Context(), id)
	if err != nil {
		return c.Status(http.StatusInternalServerError).JSON(fiber.Map{
			"error": fmt.Sprintf("Gagal mendapatkan penjualan: %v", err),
		})
	}

	return c.Status(http.StatusOK).JSON(fiber.Map{
		"message": "Data penjualan berhasil diambil",
		"data":    penjualan,
	})
}
