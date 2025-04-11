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

	"time"

	"github.com/gofiber/fiber/v2"
	"github.com/xuri/excelize/v2"
)

type HttpDeliveryProduk struct {
	HTTP               domain.ProdukUseCase
	KategoriUseCase    domain.KategoriUseCase
	SubKategoriUseCase domain.SubKategoriUseCase
}

type ImportRequest struct {
	Produk []domain.Produk `json:"produk"`
}

func NewHttpDeliveryProduk(app fiber.Router, HTTP domain.ProdukUseCase, kuc domain.KategoriUseCase, sku domain.SubKategoriUseCase) {
	handler := HttpDeliveryProduk{
		HTTP:               HTTP,
		KategoriUseCase:    kuc,
		SubKategoriUseCase: sku,
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
	// group.Get("/getbestselling", handler.GetBestSellingProducts)
	group.Get("/getloweststock", handler.GetProdukWithLowestStock)
	group.Get("/getnearexpiry/:days", handler.GetProductsNearExpiry)
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

	// Ambil frequent itemsets dengan minimum support 20%
	itemsets, err := d.HTTP.GetFrequentItemsets(c.Context(), 0.2)
	if err != nil {
		// Jika gagal mendapatkan itemsets, tetap kembalikan produk
		return c.Status(http.StatusOK).JSON(fiber.Map{
			"data": products,
		})
	}

	// Buat map untuk menyimpan produk terkait untuk setiap produk
	productRelatedMap := make(map[string][]map[string]interface{})

	// Untuk setiap produk, cari produk terkait dari itemsets
	for _, product := range products {
		var relatedItems []map[string]interface{}
		// Map untuk melacak produk terkait yang sudah ditambahkan (mencegah duplikasi)
		relatedProductsMap := make(map[string]bool)

		for _, itemset := range itemsets {
			// Pastikan itemset memiliki setidaknya 2 produk
			if len(itemset.Produk) < 2 {
				continue
			}

			// Cari indeks produk saat ini dalam itemset
			currentProductIndex := -1
			for i, produkId := range itemset.Produk {
				if produkId == product.IDProduk {
					currentProductIndex = i
					break
				}
			}

			// Jika produk ditemukan dalam itemset
			if currentProductIndex != -1 {
				// Ambil semua produk lain dari itemset
				for i, produkId := range itemset.Produk {
					// Lewati produk saat ini
					if i == currentProductIndex {
						continue
					}

					// Lewati jika produk ini sudah ditambahkan sebelumnya
					if _, exists := relatedProductsMap[produkId]; exists {
						continue
					}

					// Tambahkan informasi produk terkait
					relatedItems = append(relatedItems, map[string]interface{}{
						"id_produk":   produkId,
						"nama_produk": itemset.ProdukList[i],
						"support":     itemset.Support,
						"confidence":  itemset.Confidence,
					})
					relatedProductsMap[produkId] = true
				}
			}
		}
		if len(relatedItems) > 0 {
			productRelatedMap[product.IDProduk] = relatedItems
		}
	}

	// Format response dengan produk dan produk terkaitnya
	type ProductWithRelated struct {
		Produk        domain.Produk            `json:"produk"`
		ProdukTerkait []map[string]interface{} `json:"produk_terkait,omitempty"`
	}

	// Buat slice untuk menyimpan semua produk dengan produk terkaitnya
	productsWithRelated := make([]ProductWithRelated, len(products))
	for i, product := range products {
		productsWithRelated[i] = ProductWithRelated{
			Produk:        product,
			ProdukTerkait: productRelatedMap[product.IDProduk],
		}
	}

	return c.Status(http.StatusOK).JSON(fiber.Map{
		"message": "Data produk berhasil diambil",
		"data":    productsWithRelated,
	})
}

func (d *HttpDeliveryProduk) CreateProduk(c *fiber.Ctx) error {
	// Log request body sebelum parsing
	reqBody := c.Body()
	log.Printf("Raw request body: %s", string(reqBody))

	body := new(domain.Produk)
	log.Printf("Empty body struct: %+v", body)

	if err := c.BodyParser(body); err != nil {
		log.Printf("Error parsing body: %v", err)
		return c.Status(http.StatusBadRequest).JSON(fiber.Map{
			"error": "Format request tidak valid",
		})
	}

	log.Printf("Parsed body: %+v", body)

	// Validasi data produk
	if body.NamaProduk == "" {
		return c.Status(http.StatusBadRequest).JSON(fiber.Map{
			"error": "Nama produk harus diisi",
		})
	}

	// Trim whitespace dari nama produk
	body.NamaProduk = strings.TrimSpace(body.NamaProduk)

	if body.KodeProduk == "" {
		return c.Status(http.StatusBadRequest).JSON(fiber.Map{
			"error": "Kode produk harus diisi",
		})
	}

	// Cek apakah kode produk atau nama produk sudah ada
	allProducts, err := d.HTTP.GetAllProduk(context.Background())
	if err != nil {
		return c.Status(http.StatusInternalServerError).JSON(fiber.Map{
			"error": fmt.Sprintf("Gagal mendapatkan data produk: %v", err),
		})
	}

	// Debug log
	log.Printf("Checking for duplicate products. New product name: '%s'", body.NamaProduk)

	for _, prod := range allProducts {
		// Debug log
		log.Printf("Comparing with existing product: '%s'", prod.NamaProduk)

		if prod.KodeProduk == body.KodeProduk {
			return c.Status(http.StatusBadRequest).JSON(fiber.Map{
				"error": "Kode produk sudah ada",
			})
		}

		// Trim whitespace dan bandingkan nama produk (case insensitive)
		existingName := strings.TrimSpace(prod.NamaProduk)
		newName := strings.TrimSpace(body.NamaProduk)

		if strings.EqualFold(existingName, newName) {
			log.Printf("Duplicate product name found: '%s' matches '%s'", existingName, newName)
			return c.Status(http.StatusBadRequest).JSON(fiber.Map{
				"error": fmt.Sprintf("Nama produk '%s' sudah ada", body.NamaProduk),
			})
		}
	}

	// Generate ID produk baru menggunakan repository
	body.UpdatedAt = time.Now()

	// Buat produk
	ctx := context.Background()
	createdProduct, err := d.HTTP.CreateProduk(ctx, body)
	if err != nil {
		return c.Status(http.StatusInternalServerError).JSON(fiber.Map{
			"error": fmt.Sprintf("Gagal membuat produk: %v", err),
		})
	}

	return c.Status(http.StatusCreated).JSON(fiber.Map{
		"message": "Produk berhasil dibuat",
		"data":    createdProduct,
	})
}

func (d *HttpDeliveryProduk) GetProdukById(c *fiber.Ctx) error {
	id := c.Params("id_produk")
	if id == "" {
		return c.Status(http.StatusBadRequest).JSON(fiber.Map{
			"error": "ID produk tidak boleh kosong",
		})
	}

	produk, err := d.HTTP.GetProdukById(c.Context(), id)
	if err != nil {
		return c.Status(http.StatusInternalServerError).JSON(fiber.Map{
			"error": "Gagal mendapatkan data produk",
		})
	}

	if produk == nil {
		return c.Status(http.StatusNotFound).JSON(fiber.Map{
			"message": "Data produk tidak ditemukan",
		})
	}

	// Ambil frequent itemsets untuk mendapatkan produk terkait
	itemsets, err := d.HTTP.GetFrequentItemsets(c.Context(), 0.2)
	if err != nil {
		return c.Status(http.StatusOK).JSON(fiber.Map{
			"message": "Data produk berhasil diambil",
			"data": fiber.Map{
				"produk":         produk,
				"produk_terkait": nil,
			},
		})
	}

	// Cari produk terkait dari itemsets
	var relatedProducts []domain.Produk
	relatedProductsMap := make(map[string]bool)

	for _, itemset := range itemsets {
		if len(itemset.Produk) < 2 {
			continue
		}

		// Cari apakah produk ini ada dalam itemset
		found := false
		for _, produkId := range itemset.Produk {
			if produkId == id {
				found = true
				break
			}
		}

		// Jika produk ditemukan dalam itemset
		if found {
			// Tambahkan produk lain dari itemset sebagai produk terkait
			for _, produkId := range itemset.Produk {
				if produkId != id && !relatedProductsMap[produkId] {
					relatedProduk, err := d.HTTP.GetProdukById(c.Context(), produkId)
					if err == nil && relatedProduk != nil {
						relatedProducts = append(relatedProducts, *relatedProduk)
						relatedProductsMap[produkId] = true
					}
				}
			}
		}
	}

	return c.Status(http.StatusOK).JSON(fiber.Map{
		"message": "Data produk berhasil diambil",
		"data": fiber.Map{
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

	// Ambil frequent itemsets dengan minimum support 20%
	itemsets, err := d.HTTP.GetFrequentItemsets(c.Context(), 0.2)
	if err != nil {
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{
			"message": fmt.Sprintf("Gagal mendapatkan itemset yang sering muncul: %v", err),
		})
	}

	var relatedProducts []domain.Produk
	for _, itemset := range itemsets {
		// Pastikan itemset memiliki setidaknya 2 produk
		if len(itemset.Produk) < 2 {
			continue
		}

		// Cari indeks produk saat ini dalam itemset
		currentProductIndex := -1
		for i, item := range itemset.Produk {
			if strings.Contains(strings.ToLower(item), strings.ToLower(namaProduk)) {
				currentProductIndex = i
				break
			}
		}

		// Jika produk ditemukan dalam itemset
		if currentProductIndex != -1 {
			// Ambil semua produk lain dari itemset
			for i, produkId := range itemset.Produk {
				// Lewati produk saat ini
				if i == currentProductIndex {
					continue
				}

				// Ambil detail produk terkait
				relatedProduk, err := d.HTTP.GetProdukById(c.Context(), produkId)
				if err == nil {
					relatedProducts = append(relatedProducts, *relatedProduk)
				}
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

	// Cek apakah produk dengan ID tersebut ada
	existingProduk, err := d.HTTP.GetProdukById(context.Background(), id)
	if err != nil {
		return c.Status(http.StatusNotFound).JSON(fiber.Map{
			"error": fmt.Sprintf("Produk dengan ID %s tidak ditemukan", id),
		})
	}

	// Log request body sebelum parsing
	reqBody := c.Body()
	log.Printf("Raw request body: %s", string(reqBody))

	body := new(domain.Produk)
	log.Printf("Empty body struct: %+v", body)

	if err := c.BodyParser(body); err != nil {
		log.Printf("Error parsing body: %v", err)
		return c.Status(http.StatusBadRequest).JSON(fiber.Map{
			"error": "Gagal untuk mem-parsing request body",
		})
	}

	log.Printf("Parsed body: %+v", body)

	// Validasi data produk
	if body.NamaProduk == "" {
		return c.Status(http.StatusBadRequest).JSON(fiber.Map{
			"error": "Nama produk harus diisi",
		})
	}

	if body.KodeProduk == "" {
		return c.Status(http.StatusBadRequest).JSON(fiber.Map{
			"error": "Kode produk harus diisi",
		})
	}

	// Validasi kode produk unik (kecuali jika kode produk tidak berubah)
	if body.KodeProduk != existingProduk.KodeProduk {
		allProducts, err := d.HTTP.GetAllProduk(context.Background())
		if err != nil {
			return c.Status(http.StatusInternalServerError).JSON(fiber.Map{
				"error": fmt.Sprintf("Gagal mendapatkan data produk: %v", err),
			})
		}

		for _, existingProduct := range allProducts {
			if strings.EqualFold(existingProduct.KodeProduk, body.KodeProduk) {
				return c.Status(http.StatusBadRequest).JSON(fiber.Map{
					"error": fmt.Sprintf("Kode produk '%s' sudah digunakan oleh produk lain", body.KodeProduk),
				})
			}
		}
	}

	if body.HargaProduk <= 0 {
		return c.Status(http.StatusBadRequest).JSON(fiber.Map{
			"error": "Harga produk harus lebih dari 0",
		})
	}

	if body.Stok < 0 {
		return c.Status(http.StatusBadRequest).JSON(fiber.Map{
			"error": "Stok tidak boleh negatif",
		})
	}

	// Validasi kategori dan subkategori
	if body.Kategori != (domain.Kategori{}) {
		// Cari kategori berdasarkan nama
		allKategori, err := d.KategoriUseCase.GetAll(context.Background())
		if err != nil {
			return c.Status(http.StatusInternalServerError).JSON(fiber.Map{
				"error": fmt.Sprintf("Gagal mendapatkan data kategori: %v", err),
			})
		}

		kategoriFound := false
		for _, kategori := range allKategori {
			if strings.EqualFold(kategori.NamaKategori, body.Kategori.NamaKategori) {
				kategoriFound = true
				break
			}
		}

		if !kategoriFound {
			return c.Status(http.StatusBadRequest).JSON(fiber.Map{
				"error": fmt.Sprintf("Kategori dengan nama '%s' tidak ditemukan", body.Kategori),
			})
		}
	} else {
		return c.Status(http.StatusBadRequest).JSON(fiber.Map{
			"error": "Nama kategori harus diisi",
		})
	}

	// Cari subkategori berdasarkan nama
	if body.SubKategori != (domain.SubKategori{}) {
		// Cari subkategori berdasarkan nama
		allSubKategori, err := d.SubKategoriUseCase.GetAll(context.Background())
		if err != nil {
			return c.Status(http.StatusInternalServerError).JSON(fiber.Map{
				"error": fmt.Sprintf("Gagal mendapatkan data subkategori: %v", err),
			})
		}

		subKategoriFound := false
		for _, subKategori := range allSubKategori {
			if strings.EqualFold(subKategori.NamaSubKategori, body.SubKategori.NamaSubKategori) {
				// Pastikan subkategori ini berada di bawah kategori yang dipilih
				if strings.EqualFold(subKategori.Kategori.NamaKategori, body.Kategori.NamaKategori) {
					subKategoriFound = true
					body.SubKategori.IDSubKategori = subKategori.IDSubKategori // Simpan ID subkategori
					break
				}
			}
		}

		if !subKategoriFound {
			return c.Status(http.StatusBadRequest).JSON(fiber.Map{
				"error": fmt.Sprintf("Subkategori dengan nama '%s' tidak ditemukan dalam kategori '%s'", body.SubKategori.NamaSubKategori, body.Kategori.NamaKategori),
			})
		}
	} else {
		return c.Status(http.StatusBadRequest).JSON(fiber.Map{
			"error": "Nama subkategori harus diisi",
		})
	}

	body.IDProduk = id

	err = d.HTTP.UpdateProduk(context.Background(), body)
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

			// Get kategori by ID
			kategori, err := d.KategoriUseCase.GetByID(c.Context(), strings.TrimSpace(record[1]))
			if err != nil {
				log.Printf("Baris %d: kategori tidak ditemukan: kategori dengan ID %s tidak ditemukan", i+1, strings.TrimSpace(record[1]))
				continue
			}

			// Get subkategori by ID
			subkategori, err := d.SubKategoriUseCase.GetByID(c.Context(), strings.TrimSpace(record[2]))
			if err != nil {
				log.Printf("Baris %d: subkategori tidak ditemukan: subkategori dengan ID %s tidak ditemukan", i+1, strings.TrimSpace(record[2]))
				continue
			}

			// Verify subkategori belongs to the kategori
			if subkategori.Kategori.IDKategori != kategori.IDKategori {
				log.Printf("Baris %d: subkategori tidak sesuai dengan kategori", i+1)
				continue
			}

			produk := domain.Produk{
				NamaProduk:  strings.TrimSpace(record[0]),
				Kategori:    *kategori,
				SubKategori: *subkategori,
				KodeProduk:  strings.TrimSpace(record[3]),
				HargaProduk: harga,
				Stok:        stok,
			}

			// Proses tanggal kedaluwarsa jika ada
			if len(record) > 6 && strings.TrimSpace(record[6]) != "" {
				tanggalKedaluwarsa, err := time.Parse("2006-01-02", strings.TrimSpace(record[6]))
				if err == nil {
					produk.TanggalKedaluwarsa = tanggalKedaluwarsa
				} else {
					log.Printf("Baris %d: format tanggal kedaluwarsa tidak valid, gunakan format YYYY-MM-DD", i+1)
				}
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

			// Get kategori by ID
			kategori, err := d.KategoriUseCase.GetByID(c.Context(), strings.TrimSpace(row[1]))
			if err != nil {
				log.Printf("Baris %d: kategori tidak ditemukan: kategori dengan ID %s tidak ditemukan", i+1, strings.TrimSpace(row[1]))
				continue
			}

			// Get subkategori by ID
			subkategori, err := d.SubKategoriUseCase.GetByID(c.Context(), strings.TrimSpace(row[2]))
			if err != nil {
				log.Printf("Baris %d: subkategori tidak ditemukan: subkategori dengan ID %s tidak ditemukan", i+1, strings.TrimSpace(row[2]))
				continue
			}

			// Verify subkategori belongs to the kategori
			if subkategori.Kategori.IDKategori != kategori.IDKategori {
				log.Printf("Baris %d: subkategori tidak sesuai dengan kategori", i+1)
				continue
			}

			produk := domain.Produk{
				NamaProduk:  strings.TrimSpace(row[0]),
				Kategori:    *kategori,
				SubKategori: *subkategori,
				KodeProduk:  strings.TrimSpace(row[3]),
				HargaProduk: harga,
				Stok:        stok,
			}

			// Proses tanggal kedaluwarsa jika ada
			if len(row) > 6 && strings.TrimSpace(row[6]) != "" {
				tanggalKedaluwarsa, err := time.Parse("2006-01-02", strings.TrimSpace(row[6]))
				if err == nil {
					produk.TanggalKedaluwarsa = tanggalKedaluwarsa
				} else {
					log.Printf("Baris %d: format tanggal kedaluwarsa tidak valid, gunakan format YYYY-MM-DD", i+1)
				}
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
	// Log request body sebelum parsing
	reqBody := c.Body()
	log.Printf("Raw request body: %s", string(reqBody))

	body := new(ImportRequest)
	log.Printf("Empty body struct: %+v", body)

	if err := c.BodyParser(body); err != nil {
		log.Printf("Error parsing body: %v", err)
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{
			"error": "Invalid request body",
		})
	}

	log.Printf("Parsed body: %+v", body)

	// Validasi data
	for i, produk := range body.Produk {
		if produk.NamaProduk == "" {
			return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{
				"error": fmt.Sprintf("Produk ke-%d tidak memiliki nama", i+1),
			})
		}
		if produk.KodeProduk == "" {
			return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{
				"error": fmt.Sprintf("Produk ke-%d tidak memiliki kode", i+1),
			})
		}
	}

	// Import data
	err := d.HTTP.ImportData(c.Context(), body.Produk)
	if err != nil {
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{
			"error": fmt.Sprintf("Gagal import data: %v", err),
		})
	}

	return c.Status(fiber.StatusOK).JSON(fiber.Map{
		"message": fmt.Sprintf("Berhasil import %d produk", len(body.Produk)),
	})
}

func (d *HttpDeliveryProduk) GetFrequentItemsets(c *fiber.Ctx) error {
	claims := c.Locals("claims")
	if claims == nil {
		return c.Status(http.StatusUnauthorized).JSON(fiber.Map{
			"error": "Token autentikasi tidak ditemukan",
		})
	}

	// Set nilai minimum support sesuai kebutuhan aplikasi
	minSupport := 0.2

	itemsets, err := d.HTTP.GetFrequentItemsets(c.Context(), minSupport)
	if err != nil {
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{
			"message": fmt.Sprintf("Gagal mendapatkan itemset yang sering muncul: %v", err),
		})
	}

	response := make([]map[string]interface{}, len(itemsets))
	for i, itemset := range itemsets {
		response[i] = map[string]interface{}{
			"produk":      itemset.Produk,
			"nama_produk": itemset.ProdukList,
			"support":     itemset.Support,
			"confidence":  itemset.Confidence,
		}
	}

	return c.Status(fiber.StatusOK).JSON(fiber.Map{
		"message": "Berhasil mendapatkan itemset yang sering muncul",
		"data": map[string]interface{}{
			"min_support":    minSupport,
			"min_confidence": 0.3, // 30%
			"itemsets":       response,
		},
	})
}

// func (d *HttpDeliveryProduk) GetBestSellingProducts(c *fiber.Ctx) error {
// 	// Ambil parameter limit dari query, default 10 jika tidak ada
// 	limitStr := c.Query("limit", "10")
// 	limitProduk, err := strconv.Atoi(limitStr)
// 	if err != nil || limitProduk <= 0 {
// 		limitProduk = 10 // Default limit jika parameter tidak valid
// 	}

// 	// Panggil use case untuk mendapatkan produk terlaris
// 	bestSellingProducts, err := d.HTTP.GetBestSellingProducts(c.Context(), limitProduk)
// 	if err != nil {
// 		log.Printf("Error getting best selling products: %v", err)
// 		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{
// 			"success": false,
// 			"error":   "Gagal mendapatkan data produk terlaris",
// 		})
// 	}

// 	return c.Status(fiber.StatusOK).JSON(fiber.Map{
// 		"success": true,
// 		"message": "Data produk terlaris berhasil diambil",
// 		"data":    bestSellingProducts,
// 	})
// }

func (d *HttpDeliveryProduk) GetProdukWithLowestStock(c *fiber.Ctx) error {
	// Default limit 5 produk dengan stok terendah
	limitStr := c.Query("limit", "5")
	limit, err := strconv.Atoi(limitStr)
	if err != nil || limit <= 0 {
		limit = 5 // Default limit jika parameter tidak valid
	}

	produk, err := d.HTTP.GetProdukWithLowestStock(c.Context(), limit)
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

func (d *HttpDeliveryProduk) GetProductsNearExpiry(c *fiber.Ctx) error {
	daysStr := c.Params("days")
	days, err := strconv.Atoi(daysStr)
	if err != nil || days <= 0 {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{
			"error": "Jumlah hari harus valid dan lebih dari 0",
		})
	}

	produk, err := d.HTTP.GetProductsNearExpiry(c.Context(), days)
	if err != nil {
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{
			"error": "Gagal mendapatkan produk yang mendekati kedaluwarsa",
		})
	}

	return c.Status(fiber.StatusOK).JSON(fiber.Map{
		"message": "Data produk yang mendekati kedaluwarsa berhasil diambil",
		"data":    produk,
	})
}
