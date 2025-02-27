package delivery

import (
	"SIE-SRC/domain"
	"context"
	"encoding/csv"
	"SIE-SRC/middleware"
	"fmt"
	"log"
	"net/http"
	"strconv"
	"strings"

	"github.com/asaskevich/govalidator"
	"github.com/gofiber/fiber/v2"
	"github.com/xuri/excelize/v2"
)

type HttpDeliveryProduk struct {
	HTTP domain.ProdukUseCase
}

type ImportRequest struct {
	Produk []domain.Produk `json:"produk"`
}

func NewHttpDeliveryProduk(app fiber.Router, HTTP domain.ProdukUseCase) {
	handler := HttpDeliveryProduk{
		HTTP: HTTP,
	}

	group := app.Group("/produk")
	group.Use(middleware.AuthMiddleware("admin", "owner"))
	group.Post("/createproduk", handler.CreateProduk)
	group.Get("/getallproduk", handler.GetAllProduk)
	group.Get("/by-id/:id_produk", handler.GetProdukById)
	group.Get("/by-name/:nama_produk", handler.GetProdukByName)
	group.Put("/update/:id_produk", handler.UpdateProduk)
	group.Delete("/delete/:id_produk", handler.DeleteProduk)
	group.Post("/importdata", handler.ImportProduk)
	group.Post("/importJSON", handler.ImportProdukJSON)
	group.Get("/getfrequentitemsets", handler.GetFrequentItemsets)
}

func (d *HttpDeliveryProduk) GetAllProduk(c *fiber.Ctx) error {
	val, err := d.HTTP.GetAllProduk(context.Background())
	if err != nil {
		return c.Status(http.StatusInternalServerError).JSON(fiber.Map{
			"error": "Gagal untuk mendapatkan Data",
		})
	}

	return c.Status(http.StatusOK).JSON(fiber.Map{
		"data": val,
	})
}

func (d *HttpDeliveryProduk) CreateProduk(c *fiber.Ctx) error {

	var product domain.Produk
	if err := c.BodyParser(&product); err != nil {
		return c.Status(http.StatusBadRequest).JSON(fiber.Map{
			"error": "Invalid request payload",
		})
	}

	// Logging untuk debugging
	log.Printf("Received data: %+v", product)

	createdProduct, err := d.HTTP.CreateProduk(context.Background(), &product)
	if err != nil {
		return c.Status(http.StatusInternalServerError).JSON(fiber.Map{
			"error":   "Failed to create product",
			"message": err.Error(), // Include error message for better debugging
		})
	}

	return c.Status(http.StatusOK).JSON(fiber.Map{
		"message": "Product created successfully",
		"data":    createdProduct,
	})
}

func (d *HttpDeliveryProduk) GetProdukById(c *fiber.Ctx) error {
	idProduk := c.Params("id_produk")

	produk, err := d.HTTP.GetProdukById(c.Context(), idProduk)
	if err != nil {
		return c.Status(fiber.StatusNotFound).JSON(fiber.Map{
			"message": err.Error(),
		})
	}

	// Ambil frequent itemsets dengan minimum support 0.3 (30%)
	itemsets, err := d.HTTP.GetFrequentItemsets(c.Context(), 0.3)
	if err != nil {
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{
			"message": fmt.Sprintf("Gagal mendapatkan itemset yang sering muncul: %v", err),
		})
	}

	// Filter itemsets yang mengandung produk yang dicari
	var relatedProducts []domain.Produk
	for _, itemset := range itemsets {
		for i, produkId := range itemset.Produk {
			if produkId == idProduk {
				// Ambil ID produk lainnya dari itemset
				otherProdukId := itemset.Produk[1-i] // Jika i=0 maka 1-i=1, jika i=1 maka 1-i=0
				// Ambil detail produk terkait
				relatedProduk, err := d.HTTP.GetProdukById(c.Context(), otherProdukId)
				if err == nil {
					relatedProducts = append(relatedProducts, *relatedProduk)
				}
				break
			}
		}
	}

	return c.Status(fiber.StatusOK).JSON(fiber.Map{
		"message": "Data produk berhasil diambil",
		"data": map[string]interface{}{
			"produk": produk,
			"produk_terkait": relatedProducts,
		},
	})
}

func (d *HttpDeliveryProduk) GetProdukByName(c *fiber.Ctx) error {
	namaProduk := c.Params("nama_produk")

	produk, err := d.HTTP.GetProdukByName(c.Context(), namaProduk)
	if err != nil {
		return c.Status(fiber.StatusNotFound).JSON(fiber.Map{
			"message": err.Error(),
		})
	}

	// Ambil frequent itemsets dengan minimum support 0.3 (30%)
	itemsets, err := d.HTTP.GetFrequentItemsets(c.Context(), 0.3)
	if err != nil {
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{
			"message": fmt.Sprintf("Gagal mendapatkan itemset yang sering muncul: %v", err),
		})
	}

	// Filter itemsets yang mengandung produk yang dicari
	var relatedProducts []domain.Produk
	for _, itemset := range itemsets {
		for i, item := range itemset.Produk {
			if strings.Contains(strings.ToLower(item), strings.ToLower(namaProduk)) {
				// Ambil ID produk lainnya dari itemset
				otherProdukId := itemset.Produk[1-i] // Jika i=0 maka 1-i=1, jika i=1 maka 1-i=0
				// Ambil detail produk terkait
				relatedProduk, err := d.HTTP.GetProdukById(c.Context(), otherProdukId)
				if err == nil {
					relatedProducts = append(relatedProducts, *relatedProduk)
				}
				break
			}
		}
	}

	return c.Status(fiber.StatusOK).JSON(fiber.Map{
		"message": "Data produk berhasil diambil",
		"data": map[string]interface{}{
			"produk": produk,
			"produk_terkait": relatedProducts,
		},
	})
}

func (d *HttpDeliveryProduk) UpdateProduk(c *fiber.Ctx) error {
	id := c.Params("id_produk")

	if id == "" {
		return c.Status(http.StatusBadRequest).JSON(fiber.Map{
			"error": "ID produk diperlukan",
		})
	}

	body := new(domain.Produk)
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

	body.IDProduk = id

	err := d.HTTP.UpdateProduk(context.Background(), body)
	if err != nil {
		return c.Status(http.StatusInternalServerError).JSON(fiber.Map{
			"error": "Gagal untuk memperbarui data",
		})
	}

	return c.Status(http.StatusOK).JSON(fiber.Map{
		"message": "Data berhasil diperbarui",
	})
}

func (d *HttpDeliveryProduk) DeleteProduk(c *fiber.Ctx) error {
	id := c.Params("id_produk")

	if id == "" {
		return c.Status(http.StatusBadRequest).JSON(fiber.Map{
			"error": "ID produk diperlukan",
		})
	}

	err := d.HTTP.DeleteProduk(context.Background(), id)
	if err != nil {
		return c.Status(http.StatusInternalServerError).JSON(fiber.Map{
			"error": "Gagal untuk menghapus data: " + err.Error(),
		})
	}

	return c.Status(http.StatusOK).JSON(fiber.Map{
		"message": "Data berhasil dihapus",
	})
}

func (d *HttpDeliveryProduk) ImportProduk(c *fiber.Ctx) error {
	// Ambil file dari request
	fileHeader, err := c.FormFile("file")
	if err != nil {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{
			"error": "File tidak ditemukan",
		})
	}

	// Buka file
	file, err := fileHeader.Open()
	if err != nil {
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{
			"error": "Gagal membuka file",
		})
	}
	defer file.Close()

	var produkList []domain.Produk
	filename := strings.ToLower(fileHeader.Filename)

	// Proses file berdasarkan ekstensi
	switch {
	case strings.HasSuffix(filename, ".csv"):
		// Baca file CSV
		reader := csv.NewReader(file)
		reader.FieldsPerRecord = -1 // Izinkan jumlah kolom fleksibel

		records, err := reader.ReadAll()
		if err != nil {
			return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{
				"error": "Gagal membaca file CSV",
			})
		}

		// Skip header row
		if len(records) > 1 {
			records = records[1:]
		}

		produkList = make([]domain.Produk, 0, len(records))
		for i, record := range records {
			if len(record) < 6 { // Minimal harus ada 6 kolom
				log.Printf("Baris %d: jumlah kolom tidak valid", i+1)
				continue
			}

			// Bersihkan dan konversi harga ke int
			hargaStr := strings.TrimSpace(strings.ReplaceAll(record[4], ",", ""))
			hargaFloat, err := strconv.ParseFloat(hargaStr, 64)
			if err != nil {
				log.Printf("Baris %d: harga tidak valid", i+1)
				continue
			}
			harga := int(hargaFloat)

			stok, err := strconv.Atoi(strings.TrimSpace(record[5]))
			if err != nil {
				log.Printf("Baris %d: stok tidak valid", i+1)
				continue
			}

			produk := domain.Produk{
				NamaProduk:  strings.TrimSpace(record[0]),
				Kategori:    strings.TrimSpace(record[1]),
				SubKategori: strings.TrimSpace(record[2]),
				KodeProduk:  strings.TrimSpace(record[3]),
				HargaProduk: harga,
				Stok:        stok,
			}
			produkList = append(produkList, produk)
		}

	case strings.HasSuffix(filename, ".xlsx"):
		// Baca file Excel
		xlsx, err := excelize.OpenReader(file)
		if err != nil {
			return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{
				"error": "Gagal membaca file Excel",
			})
		}

		// Ambil sheet pertama
		sheetName := xlsx.GetSheetName(0)
		rows, err := xlsx.GetRows(sheetName)
		if err != nil {
			return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{
				"error": "Gagal membaca sheet Excel",
			})
		}

		// Skip header row
		if len(rows) > 1 {
			rows = rows[1:]
		}

		produkList = make([]domain.Produk, 0, len(rows))
		for i, row := range rows {
			if len(row) < 6 { // Minimal harus ada 6 kolom
				log.Printf("Baris %d: jumlah kolom tidak valid", i+1)
				continue
			}

			// Bersihkan dan konversi harga ke int
			hargaStr := strings.TrimSpace(strings.ReplaceAll(row[4], ",", ""))
			hargaFloat, err := strconv.ParseFloat(hargaStr, 64)
			if err != nil {
				log.Printf("Baris %d: harga tidak valid", i+1)
				continue
			}
			harga := int(hargaFloat)

			stok, err := strconv.Atoi(strings.TrimSpace(row[5]))
			if err != nil {
				log.Printf("Baris %d: stok tidak valid", i+1)
				continue
			}

			produk := domain.Produk{
				NamaProduk:  strings.TrimSpace(row[0]),
				Kategori:    strings.TrimSpace(row[1]),
				SubKategori: strings.TrimSpace(row[2]),
				KodeProduk:  strings.TrimSpace(row[3]),
				HargaProduk: harga,
				Stok:        stok,
			}
			produkList = append(produkList, produk)
		}

	default:
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{
			"error": "Format file tidak didukung. Gunakan CSV atau XLSX",
		})
	}

	// Validasi jumlah data
	if len(produkList) == 0 {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{
			"error": "Tidak ada data valid untuk diimpor",
		})
	}

	// Import data ke database
	err = d.HTTP.ImportData(c.Context(), produkList)
	if err != nil {
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{
			"error": fmt.Sprintf("Gagal mengimpor data: %v", err),
		})
	}

	return c.Status(fiber.StatusOK).JSON(fiber.Map{
		"message": fmt.Sprintf("Berhasil mengimpor %d produk", len(produkList)),
	})
}

func (d *HttpDeliveryProduk) ImportProdukJSON(c *fiber.Ctx) error {
	var req ImportRequest
	if err := c.BodyParser(&req); err != nil {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{
			"error": "Format request tidak valid",
		})
	}

	if len(req.Produk) == 0 {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{
			"error": "Tidak ada data produk untuk diimpor",
		})
	}

	// Validasi data produk
	for i, produk := range req.Produk {
		if produk.NamaProduk == "" {
			return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{
				"error": fmt.Sprintf("Produk #%d: nama produk tidak boleh kosong", i+1),
			})
		}
		if produk.KodeProduk == "" {
			return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{
				"error": fmt.Sprintf("Produk #%d: kode produk tidak boleh kosong", i+1),
			})
		}
		if produk.HargaProduk <= 0 {
			return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{
				"error": fmt.Sprintf("Produk #%d: harga produk harus lebih dari 0", i+1),
			})
		}
		if produk.Stok < 0 {
			return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{
				"error": fmt.Sprintf("Produk #%d: stok tidak boleh negatif", i+1),
			})
		}
	}

	// Import data ke database
	err := d.HTTP.ImportData(c.Context(), req.Produk)
	if err != nil {
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{
			"error": fmt.Sprintf("Gagal mengimpor data: %v", err),
		})
	}

	// Ambil data produk yang baru diimpor
	importedProducts, err := d.HTTP.GetAllProduk(c.Context())
	if err != nil {
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{
			"error": fmt.Sprintf("Berhasil mengimpor tapi gagal mengambil data: %v", err),
		})
	}

	return c.Status(fiber.StatusOK).JSON(fiber.Map{
		"message": fmt.Sprintf("Berhasil mengimpor %d produk", len(req.Produk)),
		"data":    importedProducts,
	})
}

// GetFrequentItemsets mengembalikan itemset yang sering muncul dari data penjualan
func (d *HttpDeliveryProduk) GetFrequentItemsets(c *fiber.Ctx) error {
	// Validasi token
	claims := c.Locals("claims")
	if claims == nil {
		return c.Status(http.StatusUnauthorized).JSON(fiber.Map{
			"error": "Token autentikasi tidak ditemukan",
		})
	}

	// Mengambil nilai minimum support dari parameter query, nilai default 0.1 (10%)
	minSupport := 0.1
	if supportStr := c.Query("min_support"); supportStr != "" {
		support, err := strconv.ParseFloat(supportStr, 64)
		if err != nil {
			return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{
				"message": "Format min_support tidak valid",
			})
		}
		if support <= 0 || support > 1 {
			return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{
				"message": "min_support harus antara 0 dan 1",
			})
		}
		minSupport = support
	}

	// Memanggil fungsi GetFrequentItemsets dari usecase
	itemsets, err := d.HTTP.GetFrequentItemsets(c.Context(), minSupport)
	if err != nil {
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{
			"message": fmt.Sprintf("Gagal mendapatkan itemset yang sering muncul: %v", err),
		})
	}

	// Format response
	response := make([]map[string]interface{}, len(itemsets))
	for i, itemset := range itemsets {
		response[i] = map[string]interface{}{
			"produk": itemset.Produk,
		}
	}

	return c.Status(fiber.StatusOK).JSON(fiber.Map{
		"message": "Berhasil mendapatkan itemset yang sering muncul",
		"data": map[string]interface{}{
			"min_support": minSupport,
			"list_produk":    response,
		},
	})
}
