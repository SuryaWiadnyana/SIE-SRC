package delivery

import (
	"SIE-SRC/domain"
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

func NewHttpDeliveryProduk(app fiber.Router, HTTP domain.ProdukUseCase) {
	handler := HttpDeliveryProduk{
		HTTP: HTTP,
	}

	group := app.Group("/produk")
	group.Post("/createproduk", handler.CreateProduk)
	group.Get("/getallproduk", handler.GetAllProduk)
	group.Get("/by-id/:id_produk", handler.GetProdukById)
	group.Get("/by-name/:nama_produk", handler.GetProdukByName)
	group.Put("/update/:id_produk", handler.UpdateProduk)
	group.Delete("/delete/:id_produk", handler.DeleteProduk)
	group.Post("/importdata", handler.ImportProduk)
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
	id := c.Params("id_produk")
	if id == "" {
		return c.Status(http.StatusBadRequest).JSON(fiber.Map{
			"error": "ID diperlukan",
		})
	}

	data, err := d.HTTP.GetProdukById(context.Background(), id)
	if err != nil {
		return c.Status(http.StatusInternalServerError).JSON(fiber.Map{
			"error": "Gagal untuk mendapatkan data",
		})
	}

	return c.Status(http.StatusOK).JSON(fiber.Map{
		"message": "Data ditemukan",
		"data":    data,
	})
}

func (d *HttpDeliveryProduk) GetProdukByName(c *fiber.Ctx) error {
	nama := c.Params("nama_produk")
	if nama == "" {
		return c.Status(http.StatusBadRequest).JSON(fiber.Map{
			"error": "Nama produk diperlukan",
		})
	}

	data, err := d.HTTP.GetProdukByName(context.Background(), nama)
	if err != nil {
		return c.Status(http.StatusInternalServerError).JSON(fiber.Map{
			"error": "Gagal untuk mendapatkan data",
		})
	}

	return c.Status(http.StatusOK).JSON(fiber.Map{
		"message": "Data ditemukan",
		"data":    data,
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
				Harga:       harga,
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
				Harga:       harga,
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
