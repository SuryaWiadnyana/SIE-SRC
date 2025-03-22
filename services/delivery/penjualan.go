package delivery

import (
	"SIE-SRC/domain"
	"SIE-SRC/middleware"
	"context"
	"fmt"
	"log"
	"net/http"
	"time"

	"github.com/gofiber/fiber/v2"
)

type HttpDeliveryPenjualan struct {
	HTTP            domain.PenjualanUseCase
	User            domain.UserUseCase
	DetailPenjualan domain.DetailPenjualanUseCase
	ProdukUC        domain.ProdukUseCase
}

type PenjualanRequest struct {
	Penjualan struct {
		ProdukTerjual     int    `json:"produk_terjual"`
		Tanggal_Penjualan string `json:"tanggal_penjualan"`
	} `json:"penjualan"`
	Produk domain.Produk `json:"produk"`
}

func NewHttpDeliveryPenjualan(app fiber.Router, HTTP domain.PenjualanUseCase, userUC domain.UserUseCase, detailUC domain.DetailPenjualanUseCase, produkUC domain.ProdukUseCase) {
	handler := &HttpDeliveryPenjualan{
		HTTP:            HTTP,
		User:            userUC,
		DetailPenjualan: detailUC,
		ProdukUC:        produkUC,
	}

	protected := app.Group("/penjualan")
	protected.Use(middleware.AuthMiddleware("admin", "owner"))
	protected.Post("/create", handler.CreateBulk)
	protected.Get("/getall", handler.GetAll)
	protected.Get("/by-id/:id_penjualan", handler.GetByID)
	protected.Delete("/delete/:id_penjualan", handler.Delete)
}

func (d *HttpDeliveryPenjualan) GetAll(c *fiber.Ctx) error {
	val, err := d.HTTP.GetAll(context.Background())
	if err != nil {
		log.Printf("Error getting all sales: %v", err)
		return c.Status(http.StatusInternalServerError).JSON(fiber.Map{
			"status":  http.StatusInternalServerError,
			"message": "Gagal mendapatkan data penjualan",
			"data":    nil,
		})
	}

	return c.JSON(fiber.Map{
		"status":  http.StatusOK,
		"message": "Data penjualan berhasil diambil",
		"data":    val,
	})
}

func (d *HttpDeliveryPenjualan) CreateBulk(c *fiber.Ctx) error {
	var requestList []PenjualanRequest

	if err := c.BodyParser(&requestList); err != nil {
		log.Printf("Error parsing request body: %v", err)
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{
			"status":  fiber.StatusBadRequest,
			"message": "Format request tidak valid",
			"data":    nil,
		})
	}

	// Get username from context
	username := c.Locals("username")
	if username == nil {
		return c.Status(fiber.StatusUnauthorized).JSON(fiber.Map{
			"status":  fiber.StatusUnauthorized,
			"message": "Unauthorized: Data pengguna tidak ditemukan",
			"data":    nil,
		})
	}

	usernameStr, ok := username.(string)
	if !ok || usernameStr == "" {
		return c.Status(fiber.StatusUnauthorized).JSON(fiber.Map{
			"status":  fiber.StatusUnauthorized,
			"message": "Data username tidak valid",
			"data":    nil,
		})
	}

	// Get user data
	user, err := d.User.GetUserByUsername(c.Context(), usernameStr)
	if err != nil {
		log.Printf("Error getting user: %v", err)
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{
			"status":  fiber.StatusInternalServerError,
			"message": fmt.Sprintf("Gagal mendapatkan data pengguna: %v", err),
			"data":    nil,
		})
	}

	// Convert request list to penjualan list
	var penjualanList []domain.Penjualan

	// Create a penjualan for each product with its quantity
	for _, req := range requestList {
		// Validasi ID Produk
		if req.Produk.IDProduk == "" {
			return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{
				"status":  fiber.StatusBadRequest,
				"message": "ID Produk tidak boleh kosong",
				"data":    nil,
			})
		}

		// Validasi tanggal
		if req.Penjualan.Tanggal_Penjualan == "" {
			return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{
				"status":  fiber.StatusBadRequest,
				"message": "Tanggal penjualan tidak boleh kosong",
				"data":    nil,
			})
		}

		// Parse tanggal dari format DD-MM-YYYY
		parsedTime, err := time.Parse("02-01-2006", req.Penjualan.Tanggal_Penjualan)
		if err != nil {
			log.Printf("Error parsing date: %v", err)
			return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{
				"status":  fiber.StatusBadRequest,
				"message": "Format tanggal tidak valid. Gunakan format DD-MM-YYYY",
				"data":    nil,
			})
		}

		// Set waktu ke 00:00:00
		parsedTime = time.Date(parsedTime.Year(), parsedTime.Month(), parsedTime.Day(), 0, 0, 0, 0, time.UTC)

		// Hitung subtotal
		subtotal := req.Penjualan.ProdukTerjual * req.Produk.HargaProduk

		penjualan := domain.Penjualan{
			User:              *user,
			Tanggal_Penjualan: parsedTime, // Ubah format tanggal ke time.Time
			JumlahProduk:      req.Penjualan.ProdukTerjual,
			SubTotal:          subtotal,
		}
		penjualanList = append(penjualanList, penjualan)
	}

	// Create penjualan
	result, err := d.HTTP.CreateBulk(c.Context(), penjualanList)
	if err != nil {
		log.Printf("Error creating sales: %v", err)
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{
			"status":  fiber.StatusInternalServerError,
			"message": fmt.Sprintf("Gagal membuat penjualan: %v", err),
			"data":    nil,
		})
	}

	// Create detail penjualan for each penjualan
	var details []domain.DetailPenjualan
	for _, penjualan := range result {
		var produkList []domain.Produk
		var totalPendapatan int

		// Collect all products and calculate total
		for _, req := range requestList {
			produkList = append(produkList, req.Produk)
			totalPendapatan += req.Penjualan.ProdukTerjual * req.Produk.HargaProduk

			// Kurangi stok produk setelah penjualan berhasil dibuat
			_, err := d.ProdukUC.GetProdukById(c.Context(), req.Produk.IDProduk)
			if err != nil {
				log.Printf("Error mendapatkan produk: %v", err)
				continue
			}

			if err := d.ProdukUC.DecreaseProdukStock(c.Context(), req.Produk.IDProduk, req.Penjualan.ProdukTerjual); err != nil {
				log.Printf("Error mengurangi stok produk: %v", err)
				continue
			}
		}

		// Create one detail with all products
		detail := domain.DetailPenjualan{
			Penjualan:       penjualan,
			Produk:          produkList,
			TotalPendapatan: penjualan.Total,
		}

		createdDetail, err := d.DetailPenjualan.CreateDetails(c.Context(), &detail)
		if err != nil {
			log.Printf("Error creating detail penjualan: %v", err)
			continue
		}
		if createdDetail != nil {
			details = append(details, *createdDetail)
		}
	}

	return c.JSON(fiber.Map{
		"status":  fiber.StatusCreated,
		"message": "Data penjualan berhasil dibuat",
		"data":    result,
	})
}

func (d *HttpDeliveryPenjualan) Delete(c *fiber.Ctx) error {
	id := c.Params("id_penjualan")
	if id == "" {
		return c.Status(http.StatusBadRequest).JSON(fiber.Map{
			"status":  http.StatusBadRequest,
			"message": "ID Penjualan tidak boleh kosong",
			"data":    nil,
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
			"status":  http.StatusInternalServerError,
			"message": fmt.Sprintf("Gagal menghapus penjualan: %v", err),
			"data":    nil,
		})
	}

	return c.JSON(fiber.Map{
		"status":  http.StatusOK,
		"message": "Penjualan berhasil dihapus",
		"data":    nil,
	})
}

func (d *HttpDeliveryPenjualan) GetByID(c *fiber.Ctx) error {
	id := c.Params("id_penjualan")
	if id == "" {
		return c.Status(http.StatusBadRequest).JSON(fiber.Map{
			"status":  http.StatusBadRequest,
			"message": "ID Penjualan tidak boleh kosong",
			"data":    nil,
		})
	}

	penjualan, err := d.HTTP.GetByID(c.Context(), id)
	if err != nil {
		return c.Status(http.StatusInternalServerError).JSON(fiber.Map{
			"status":  http.StatusInternalServerError,
			"message": fmt.Sprintf("Gagal mendapatkan penjualan: %v", err),
			"data":    nil,
		})
	}

	return c.JSON(fiber.Map{
		"status":  http.StatusOK,
		"message": "Data penjualan berhasil diambil",
		"data":    penjualan,
	})
}