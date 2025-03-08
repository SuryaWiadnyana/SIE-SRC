package delivery

import (
	"SIE-SRC/domain"
	"SIE-SRC/middleware"
	"context"
	"encoding/csv"
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
	group.Get("/getbestselling", handler.GetBestSellingProducts)
	group.Get("/getloweststock", handler.GetProdukWithLowestStock)
}

func (d *HttpDeliveryProduk) GetAllProduk(c *fiber.Ctx) error {

	// Ambil semua produk
	products, err := d.HTTP.GetAllProduk(context.Background())
	if err != nil {
		return c.Status(http.StatusInternalServerError).JSON(fiber.Map{
			"error": "Gagal untuk mendapatkan Data",
		})
	}

	if len(products) == 0 {
		return c.Status(http.StatusOK).JSON(fiber.Map{
			"message": "Tidak ada data produk",
			"data":    []domain.Produk{},
		})
	}

	// Ambil frequent itemsets dengan minimum support 0.3 (30%)
	itemsets, err := d.HTTP.GetFrequentItemsets(c.Context(), 0.3)
	if err != nil {
		// Jika gagal mendapatkan itemsets, tetap kembalikan produk
		return c.Status(http.StatusOK).JSON(fiber.Map{
			"data": products,
		})
	}

	// Buat map untuk menyimpan produk terkait untuk setiap produk
	relatedProductsMap := make(map[string][]domain.Produk)

	// Untuk setiap produk, cari produk terkait dari itemsets
	for _, product := range products {
		var relatedProducts []domain.Produk
		for _, itemset := range itemsets {
			for i, produkId := range itemset.Produk {
				if produkId == product.IDProduk {
					// Ambil ID produk lainnya dari itemset
					otherProdukId := itemset.Produk[1-i]
					// Ambil detail produk terkait
					relatedProduk, err := d.HTTP.GetProdukById(c.Context(), otherProdukId)
					if err == nil {
						relatedProducts = append(relatedProducts, *relatedProduk)
					}
					break
				}
			}
		}
		if len(relatedProducts) > 0 {
			relatedProductsMap[product.IDProduk] = relatedProducts
		}
	}

	// Format response dengan produk dan produk terkaitnya
	type ProductWithRelated struct {
		Produk        domain.Produk   `json:"produk"`
		ProdukTerkait []domain.Produk `json:"produk_terkait,omitempty"`
	}

	// Buat slice untuk menyimpan semua produk dengan produk terkaitnya
	productsWithRelated := make([]ProductWithRelated, len(products))
	for i, product := range products {
		var relatedProducts []domain.Produk
		for _, itemset := range itemsets {
			for j, produkId := range itemset.Produk {
				if produkId == product.IDProduk {
					otherProdukId := itemset.Produk[1-j]
					relatedProduk, err := d.HTTP.GetProdukById(c.Context(), otherProdukId)
					if err == nil {
						relatedProducts = append(relatedProducts, *relatedProduk)
					}
					break
				}
			}
		}

		productsWithRelated[i] = ProductWithRelated{
			Produk:        product,
			ProdukTerkait: relatedProductsMap[product.IDProduk],
		}
	}

	return c.Status(http.StatusOK).JSON(fiber.Map{
		"message": "Data produk berhasil diambil",
		"data":    productsWithRelated,
	})
}

func (d *HttpDeliveryProduk) CreateProduk(c *fiber.Ctx) error {

	var product domain.Produk
	if err := c.BodyParser(&product); err != nil {
		return c.Status(http.StatusBadRequest).JSON(fiber.Map{
			"error": "Invalid request payload",
		})
	}

	log.Printf("Received data: %+v", product)

	createdProduct, err := d.HTTP.CreateProduk(context.Background(), &product)
	if err != nil {
		return c.Status(http.StatusInternalServerError).JSON(fiber.Map{
			"error":   "Failed to create product",
			"message": err.Error(),
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

	itemsets, err := d.HTTP.GetFrequentItemsets(c.Context(), 0.3)
	if err != nil {
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{
			"message": fmt.Sprintf("Gagal mendapatkan itemset yang sering muncul: %v", err),
		})
	}

	var relatedProducts []domain.Produk
	for _, itemset := range itemsets {
		for i, produkId := range itemset.Produk {
			if produkId == idProduk {
				otherProdukId := itemset.Produk[1-i]
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
			"produk":         produk,
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

	itemsets, err := d.HTTP.GetFrequentItemsets(c.Context(), 0.3)
	if err != nil {
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{
			"message": fmt.Sprintf("Gagal mendapatkan itemset yang sering muncul: %v", err),
		})
	}

	var relatedProducts []domain.Produk
	for _, itemset := range itemsets {
		for i, item := range itemset.Produk {
			if strings.Contains(strings.ToLower(item), strings.ToLower(namaProduk)) {
				otherProdukId := itemset.Produk[1-i]
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
			"produk":         produk,
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
	fileHeader, err := c.FormFile("file")
	if err != nil {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{
			"error": "File tidak ditemukan",
		})
	}

	file, err := fileHeader.Open()
	if err != nil {
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{
			"error": "Gagal membuka file",
		})
	}
	defer file.Close()

	var produkList []domain.Produk
	filename := strings.ToLower(fileHeader.Filename)

	switch {
	case strings.HasSuffix(filename, ".csv"):
		reader := csv.NewReader(file)
		reader.FieldsPerRecord = -1

		records, err := reader.ReadAll()
		if err != nil {
			return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{
				"error": "Gagal membaca file CSV",
			})
		}

		if len(records) > 1 {
			records = records[1:]
		}

		produkList = make([]domain.Produk, 0, len(records))
		for i, record := range records {
			if len(record) < 6 {
				log.Printf("Baris %d: jumlah kolom tidak valid", i+1)
				continue
			}

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
		xlsx, err := excelize.OpenReader(file)
		if err != nil {
			return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{
				"error": "Gagal membaca file Excel",
			})
		}

		sheetName := xlsx.GetSheetName(0)
		rows, err := xlsx.GetRows(sheetName)
		if err != nil {
			return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{
				"error": "Gagal membaca sheet Excel",
			})
		}

		if len(rows) > 1 {
			rows = rows[1:]
		}

		produkList = make([]domain.Produk, 0, len(rows))
		for i, row := range rows {
			if len(row) < 6 {
				log.Printf("Baris %d: jumlah kolom tidak valid", i+1)
				continue
			}

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

	if len(produkList) == 0 {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{
			"error": "Tidak ada data valid untuk diimpor",
		})
	}

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

	err := d.HTTP.ImportData(c.Context(), req.Produk)
	if err != nil {
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{
			"error": fmt.Sprintf("Gagal mengimpor data: %v", err),
		})
	}

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

func (d *HttpDeliveryProduk) GetFrequentItemsets(c *fiber.Ctx) error {
	claims := c.Locals("claims")
	if claims == nil {
		return c.Status(http.StatusUnauthorized).JSON(fiber.Map{
			"error": "Token autentikasi tidak ditemukan",
		})
	}

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

	itemsets, err := d.HTTP.GetFrequentItemsets(c.Context(), minSupport)
	if err != nil {
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{
			"message": fmt.Sprintf("Gagal mendapatkan itemset yang sering muncul: %v", err),
		})
	}

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
			"list_produk": response,
		},
	})
}

func (d *HttpDeliveryProduk) GetBestSellingProducts(c *fiber.Ctx) error {
	// Ambil parameter limit dari query, default 10 jika tidak ada
	limitStr := c.Query("limit", "10")
	limitProduk, err := strconv.Atoi(limitStr)
	if err != nil || limitProduk <= 0 {
		limitProduk = 10 // Default limit jika parameter tidak valid
	}

	// Panggil use case untuk mendapatkan produk terlaris
	bestSellingProducts, err := d.HTTP.GetBestSellingProducts(c.Context(), limitProduk)
	if err != nil {
		log.Printf("Error getting best selling products: %v", err)
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{
			"success": false,
			"error":   "Gagal mendapatkan data produk terlaris",
		})
	}

	return c.Status(fiber.StatusOK).JSON(fiber.Map{
		"success": true,
		"message": "Data produk terlaris berhasil diambil",
		"data":    bestSellingProducts,
	})
}

func (d *HttpDeliveryProduk) GetProdukWithLowestStock(c *fiber.Ctx) error {
	produk, err := d.HTTP.GetProdukWithLowestStock(c.Context())
	if err != nil {
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{
			"error": "Gagal mendapatkan produk dengan stok terendah",
		})
	}

	return c.Status(fiber.StatusOK).JSON(fiber.Map{
		"message": "Data produk dengan stok terendah berhasil diambil",
		"data":    produk,
	})
}
