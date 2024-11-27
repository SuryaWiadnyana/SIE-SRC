package delivery

import (
	"SIE-SRC/domain"
	"context"
	"encoding/csv"
	"log"
	"mime/multipart"
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
	group.Put("/update/{id_produk}?nama_produk={nama_produk}", handler.UpdateProduk)
	group.Delete("/delete/{id_produk}?nama_produk={nama_produk}", handler.DeleteProduk)
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
	nama := c.Params("nama_produk")

	if id == "" && nama == "" {
		return c.Status(http.StatusBadRequest).JSON(fiber.Map{
			"error": "ID atau nama produk diperlukan",
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

	if id != "" {
		body.IDProduk = id
	}
	if nama != "" {
		body.NamaProduk = nama
	}

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
	nama := c.Params("nama_produk")

	if id == "" && nama == "" {
		return c.Status(http.StatusBadRequest).JSON(fiber.Map{
			"error": "ID atau nama produk diperlukan",
		})
	}

	err := d.HTTP.DeleteProduk(context.Background(), id, nama)
	if err != nil {
		return c.Status(http.StatusInternalServerError).JSON(fiber.Map{
			"error": "Gagal untuk menghapus data" + err.Error(),
		})
	}

	return c.Status(http.StatusOK).JSON(fiber.Map{
		"message": "Data berhasil dihapus",
	})
}

func (d *HttpDeliveryProduk) ImportFromCSV(file *multipart.FileHeader) error {
	f, err := file.Open()
	if err != nil {
		return err
	}
	defer f.Close()

	reader := csv.NewReader(f)
	records, err := reader.ReadAll()
	if err != nil {
		return err
	}

	for _, record := range records {
		stok, err := strconv.Atoi(record[5])
		if err != nil {
			// Tangani error parsing, misalnya dengan log atau abaikan produk ini
			continue
		}

		produk := domain.Produk{
			IDProduk:    record[0],
			NamaProduk:  record[1],
			Kategori:    record[2],
			SubKategori: record[3],
			KodeProduk:  record[4],
			Stok:        stok,
		}

		// Memanggil use case untuk menyimpan produk
		_, err = d.HTTP.CreateProduk(context.Background(), &produk)
		if err != nil {
			log.Println("Gagal menambah produk:", err)
		}
	}
	return nil
}

func (d *HttpDeliveryProduk) ImportFromExcel(file multipart.File) error {
	f, err := excelize.OpenReader(file)
	if err != nil {
		return err
	}

	rows, err := f.GetRows("Sheet1") // Ganti dengan nama sheet yang sesuai
	if err != nil {
		return err
	}

	for _, row := range rows[1:] { // Mulai dari baris kedua untuk lewati header
		stok, _ := strconv.Atoi(row[5]) // Ubah sesuai indeks stok dalam Excel
		produk := domain.Produk{
			IDProduk:    row[0],
			NamaProduk:  row[1],
			Kategori:    row[2],
			SubKategori: row[3],
			KodeProduk:  row[4],
			Stok:        stok,
		}

		// Memanggil use case untuk menyimpan produk
		_, err = d.HTTP.CreateProduk(context.Background(), &produk)
		if err != nil {
			log.Println("Gagal menambah produk:", err)
		}
	}

	return nil
}

func (d *HttpDeliveryProduk) ImportProduk(c *fiber.Ctx) error {
	fileHeader, err := c.FormFile("file")
	if err != nil {
		return c.Status(http.StatusBadRequest).JSON(fiber.Map{
			"error": "File tidak ditemukan",
		})
	}

	file, err := fileHeader.Open()
	if err != nil {
		return c.Status(http.StatusInternalServerError).JSON(fiber.Map{
			"error": "Gagal membuka file",
		})
	}
	defer file.Close()

	// Tentukan apakah file CSV atau Excel
	if strings.HasSuffix(fileHeader.Filename, ".csv") {
		err = d.ImportFromCSV(fileHeader)
	} else if strings.HasSuffix(fileHeader.Filename, ".xlsx") {
		err = d.ImportFromExcel(file)
	} else {
		return c.Status(http.StatusBadRequest).JSON(fiber.Map{
			"error": "Format file tidak didukung",
		})
	}

	if err != nil {
		return c.Status(http.StatusInternalServerError).JSON(fiber.Map{
			"error": "Gagal mengimpor produk",
		})
	}

	return c.Status(http.StatusOK).JSON(fiber.Map{
		"message": "Produk berhasil diimpor",
	})
}
