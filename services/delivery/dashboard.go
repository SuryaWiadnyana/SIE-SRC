package delivery

import (
	"SIE-SRC/domain"
	"SIE-SRC/middleware"
	"context"
	"net/http"
	"sort"
	"strconv"
	"time"

	"github.com/gofiber/fiber/v2"
)

type HttpDeliveryDashboard struct {
	PenjualanUC       domain.PenjualanUseCase
	DetailPenjualanUC domain.DetailPenjualanUseCase
	ProdukUC          domain.ProdukUseCase
	KategoriUC        domain.KategoriUseCase
	SubKategoriUC     domain.SubKategoriUseCase
}

func NewHttpDeliveryDashboard(app fiber.Router, penjualanUC domain.PenjualanUseCase, detailPenjualanUC domain.DetailPenjualanUseCase, produkUC domain.ProdukUseCase, kategoriUC domain.KategoriUseCase, subKategoriUC domain.SubKategoriUseCase) {
	handler := &HttpDeliveryDashboard{
		PenjualanUC:       penjualanUC,
		DetailPenjualanUC: detailPenjualanUC,
		ProdukUC:          produkUC,
		KategoriUC:        kategoriUC,
		SubKategoriUC:     subKategoriUC,
	}

	protected := app.Group("/dashboard")
	protected.Use(middleware.AuthMiddleware("owner"))
	protected.Get("/getdata", handler.GetDashboardData)
	protected.Get("/sales", handler.GetSalesData)
	protected.Get("/category-sales", handler.GetCategorySales)
	protected.Get("/stock", handler.GetStockByCategory)
}

// GetDashboardData mengambil data untuk dashboard
func (d *HttpDeliveryDashboard) GetDashboardData(c *fiber.Ctx) error {
	// Mengambil filter dari parameter query
	year := c.Query("year", strconv.Itoa(time.Now().Year()))
	month := c.Query("month", "")
	kategoriID := c.Query("kategori", "")

	// Mengambil semua data penjualan
	penjualanList, err := d.PenjualanUC.GetAll(context.Background())
	if err != nil {
		return c.Status(http.StatusInternalServerError).JSON(fiber.Map{
			"success": false,
			"error":   "Gagal mengambil data penjualan",
		})
	}

	// Mengambil semua produk
	productList, err := d.ProdukUC.GetAllProduk(context.Background())
	if err != nil {
		return c.Status(http.StatusInternalServerError).JSON(fiber.Map{
			"success": false,
			"error":   "Gagal mengambil data produk",
		})
	}

	// Menghitung total penjualan
	var totalSales float64
	var totalProducts int
	var totalStock int
	var totalSold int

	yearInt, _ := strconv.Atoi(year)
	monthInt, _ := strconv.Atoi(month)

	// Menghitung total penjualan
	for _, sale := range penjualanList {
		saleYear := sale.Tanggal_Penjualan.Year()
		saleMonth := int(sale.Tanggal_Penjualan.Month())

		if saleYear == yearInt {
			if month == "" || saleMonth == monthInt {
				totalSales += float64(sale.Total)
				totalSold += sale.JumlahProduk
			}
		}
	}

	// Menghitung total produk dan stok
	for _, product := range productList {
		if kategoriID == "" || product.Kategori.IDKategori == kategoriID {
			totalProducts++
			totalStock += product.Stok
		}
	}

	// Menyiapkan response
	return c.JSON(fiber.Map{
		"success": true,
		"data": fiber.Map{
			"total_sales":    totalSales,
			"total_products": totalProducts,
			"total_stock":    totalStock,
			"total_sold":     totalSold,
		},
	})
}

// GetSalesData mengambil data penjualan berdasarkan filter
func (d *HttpDeliveryDashboard) GetSalesData(c *fiber.Ctx) error {
	// Mengambil parameter filter dari query
	year := c.Query("year", strconv.Itoa(time.Now().Year()))
	month := c.Query("month", "")
	kategoriID := c.Query("kategori", "")
	limit := c.Query("limit", "0")

	// Mengambil semua data penjualan
	penjualanList, err := d.PenjualanUC.GetAll(context.Background())
	if err != nil {
		return c.Status(http.StatusInternalServerError).JSON(fiber.Map{
			"success": false,
			"error":   "Gagal mengambil data penjualan",
		})
	}

	// Mengurai parameter filter
	yearInt, _ := strconv.Atoi(year)
	monthInt, _ := strconv.Atoi(month)
	limitInt, _ := strconv.Atoi(limit)

	// Membuat map untuk mengumpulkan data penjualan
	salesData := make(map[string]float64)
	productSales := make(map[string]int)

	// Memproses data penjualan
	for _, sale := range penjualanList {
		saleYear := sale.Tanggal_Penjualan.Year()
		saleMonth := int(sale.Tanggal_Penjualan.Month())

		// Menerapkan filter
		if saleYear != yearInt {
			continue
		}
		if month != "" && saleMonth != monthInt {
			continue
		}

		// Mengambil detail penjualan
		details, err := d.DetailPenjualanUC.GetByPenjualanID(context.Background(), sale.IDPenjualan)
		if err != nil {
			continue
		}

		for _, detail := range details {
			for _, product := range detail.Produk {
				// Cek kategori jika filter kategori aktif
				if kategoriID != "" && product.Kategori.IDKategori != kategoriID {
					continue
				}

				dateKey := sale.Tanggal_Penjualan.Format("2006-01-02")
				salesData[dateKey] += float64(detail.TotalPendapatan)
				productSales[product.NamaProduk]++
			}
		}
	}

	// Mengubah data penjualan ke array
	var result []fiber.Map
	if limitInt > 0 {
		// Mengembalikan produk terlaris
		type ProductSale struct {
			NamaProduk    string
			JumlahTerjual int
		}
		var productList []ProductSale
		for name, quantity := range productSales {
			productList = append(productList, ProductSale{name, quantity})
		}

		// Mengurutkan berdasarkan jumlah terjual
		sort.Slice(productList, func(i, j int) bool {
			return productList[i].JumlahTerjual > productList[j].JumlahTerjual
		})

		// Membatasi hasil
		if len(productList) > limitInt {
			productList = productList[:limitInt]
		}

		// Mengubah ke format result
		for _, p := range productList {
			result = append(result, fiber.Map{
				"nama_produk":    p.NamaProduk,
				"jumlah_terjual": p.JumlahTerjual,
			})
		}
	} else {
		// Mengembalikan data penjualan harian
		for date, value := range salesData {
			result = append(result, fiber.Map{
				"date":  date,
				"value": value,
			})
		}

		// Mengurutkan berdasarkan tanggal
		sort.Slice(result, func(i, j int) bool {
			return result[i]["date"].(string) < result[j]["date"].(string)
		})
	}

	return c.JSON(fiber.Map{
		"success": true,
		"data":    result,
	})
}

// GetCategorySales mengambil data penjualan per kategori
func (d *HttpDeliveryDashboard) GetCategorySales(c *fiber.Ctx) error {
	// Mengambil parameter filter dari query
	year := c.Query("year", strconv.Itoa(time.Now().Year()))
	month := c.Query("month", "")

	// Mengambil semua data penjualan
	penjualanList, err := d.PenjualanUC.GetAll(context.Background())
	if err != nil {
		return c.Status(http.StatusInternalServerError).JSON(fiber.Map{
			"success": false,
			"error":   "Gagal mengambil data penjualan",
		})
	}

	// Mengambil semua kategori
	kategoriList, err := d.KategoriUC.GetAll(context.Background())
	if err != nil {
		return c.Status(http.StatusInternalServerError).JSON(fiber.Map{
			"success": false,
			"error":   "Gagal mengambil data kategori",
		})
	}

	// Inisialisasi map penjualan per kategori
	categorySales := make(map[string]float64)
	for _, kategori := range kategoriList {
		categorySales[kategori.NamaKategori] = 0
	}

	// Mengurai parameter filter
	yearInt, _ := strconv.Atoi(year)
	monthInt, _ := strconv.Atoi(month)

	// Memproses data penjualan
	for _, sale := range penjualanList {
		saleYear := sale.Tanggal_Penjualan.Year()
		saleMonth := int(sale.Tanggal_Penjualan.Month())

		// Menerapkan filter
		if saleYear != yearInt {
			continue
		}
		if month != "" && saleMonth != monthInt {
			continue
		}

		// Mengambil detail penjualan
		details, err := d.DetailPenjualanUC.GetByPenjualanID(context.Background(), sale.IDPenjualan)
		if err != nil {
			continue
		}

		for _, detail := range details {
			// Hitung total pendapatan per kategori
			for _, product := range detail.Produk {
				categorySales[product.Kategori.NamaKategori] += float64(detail.TotalPendapatan) / float64(len(detail.Produk))
			}
		}
	}

	// Mengubah ke format result
	var result []fiber.Map
	for category, value := range categorySales {
		if value > 0 {
			result = append(result, fiber.Map{
				"category": category,
				"value":    value,
			})
		}
	}

	return c.JSON(fiber.Map{
		"success": true,
		"data":    result,
	})
}

// GetStockByCategory mengambil data stok per kategori
func (d *HttpDeliveryDashboard) GetStockByCategory(c *fiber.Ctx) error {
	// Mengambil parameter filter dari query
	kategoriID := c.Query("kategori", "")
	limit := c.Query("limit", "5") // Default limit 5 produk

	// Mengambil semua produk
	productList, err := d.ProdukUC.GetAllProduk(context.Background())
	if err != nil {
		return c.Status(http.StatusInternalServerError).JSON(fiber.Map{
			"success": false,
			"error":   "Gagal mengambil data produk",
		})
	}

	// Filter produk berdasarkan kategori
	var filteredProducts []domain.Produk
	for _, product := range productList {
		if kategoriID == "" || product.Kategori.IDKategori == kategoriID {
			filteredProducts = append(filteredProducts, product)
		}
	}

	// Mengurutkan produk berdasarkan stok (ascending)
	sort.Slice(filteredProducts, func(i, j int) bool {
		return filteredProducts[i].Stok < filteredProducts[j].Stok
	})

	// Mengambil limit
	limitInt, _ := strconv.Atoi(limit)
	if limitInt > len(filteredProducts) {
		limitInt = len(filteredProducts)
	}

	// Mengambil hanya produk yang dibatasi
	filteredProducts = filteredProducts[:limitInt]

	// Mengubah ke format result
	var result []fiber.Map
	for _, product := range filteredProducts {
		result = append(result, fiber.Map{
			"category":     product.Kategori.NamaKategori,
			"product_name": product.NamaProduk,
			"stock":        product.Stok,
		})
	}

	return c.JSON(fiber.Map{
		"success": true,
		"data":    result,
	})
}
