package repository

import (
	"SIE-SRC/domain"
	"context"
	"fmt"
	"log"
	"sort"
	"strconv"
	"strings"
	"time"

	"go.mongodb.org/mongo-driver/bson"
	"go.mongodb.org/mongo-driver/bson/primitive"
	"go.mongodb.org/mongo-driver/mongo"
	"go.mongodb.org/mongo-driver/mongo/options"
)

type mongoRepoProduk struct {
	DB *mongo.Database
}

func NewMongoRepoProduk(client *mongo.Database) domain.ProdukRepository {
	return &mongoRepoProduk{
		DB: client,
	}
}

var _Produk = "produk"

// GenerateNextID generates the next available ID
func (rp *mongoRepoProduk) GenerateNextID(ctx context.Context) (string, error) {
	DataProduk := rp.DB.Collection(_Produk)

	// Pastikan menggunakan kolasi untuk pengurutan numerik yang benar
	opts := options.FindOne().SetSort(bson.M{"id_produk": -1}).SetCollation(&options.Collation{
		Locale:   "en",
		NumericOrdering: true,
	})
	var lastProduct domain.Produk

	err := DataProduk.FindOne(ctx, bson.M{}, opts).Decode(&lastProduct)
	if err != nil {
		if err == mongo.ErrNoDocuments {
			// If no documents exist, start with "001"
			return "001", nil
		}
		return "", fmt.Errorf("error finding last product: %v", err)
	}

	// Get last ID and increment
	lastID := lastProduct.IDProduk
	if lastID == "" {
		return "001", nil
	}

	// Check if the ID is in UUID format (contains hyphens)
	if strings.Contains(lastID, "-") {
		// If we have UUID format, start fresh with "001"
		return "001", nil
	}

	// Try to convert the entire ID to a number
	num, err := strconv.Atoi(lastID)
	if err != nil {
		// If conversion fails, start with "001"
		return "001", nil
	}

	// Format new ID with leading zeros
	newID := fmt.Sprintf("%03d", num+1)
	return newID, nil
}

// Membuat Data Produk
func (rp *mongoRepoProduk) CreateProduk(ctx context.Context, bd *domain.Produk) (domain.Produk, error) {
	DataProduk := rp.DB.Collection(_Produk)

	if bd.IDProduk == "" {
		// Generate ID if not provided
		nextID, err := rp.GenerateNextID(ctx)
		if err != nil {
			return domain.Produk{}, fmt.Errorf("error generating ID: %v", err)
		}
		bd.IDProduk = nextID
	}

	// Set current time for UpdatedAt
	bd.UpdatedAt = time.Now()

	// Insert document
	_, err := DataProduk.InsertOne(ctx, bd)
	if err != nil {
		return domain.Produk{}, fmt.Errorf("error inserting product: %v", err)
	}

	return *bd, nil
}

// Memunculkan Semua Data Produk
func (rp *mongoRepoProduk) GetAllProduk(ctx context.Context) ([]domain.Produk, error) {
	DataProduk := rp.DB.Collection(_Produk)

	// Add sort options for id_produk
	opts := options.Find().SetSort(bson.D{{Key: "id_produk", Value: 1}})

	filter := bson.M{
		"is_deleted": nil, // Only get non-deleted products
	}

	cursor, err := DataProduk.Find(ctx, filter, opts)
	if err != nil {
		return nil, err
	}
	defer cursor.Close(ctx)

	var products []domain.Produk
	if err = cursor.All(ctx, &products); err != nil {
		return nil, err
	}

	return products, nil
}

// Mencari Data Produk Berdasarkan ID Produk
func (rp *mongoRepoProduk) GetProdukById(ctx context.Context, id string) (*domain.Produk, error) {
	DataProduk := rp.DB.Collection(_Produk)

	var product domain.Produk
	err := DataProduk.FindOne(ctx, bson.M{"id_produk": id, "is_deleted": nil}).Decode(&product)
	if err != nil {
		if err == mongo.ErrNoDocuments {
			return nil, fmt.Errorf("produk dengan ID %s tidak ditemukan", id)
		}
		return nil, fmt.Errorf("gagal untuk mendapatkan produk: %v", err)
	}

	return &product, nil
}

// Mencari Data Produk Berdasarkan Nama Produk
func (rp *mongoRepoProduk) GetProdukByName(ctx context.Context, nama string) (*domain.Produk, error) {
	DataProduk := rp.DB.Collection(_Produk)

	var product domain.Produk
	err := DataProduk.FindOne(ctx, bson.M{"nama_produk": nama, "is_deleted": nil}).Decode(&product)
	if err != nil {
		if err == mongo.ErrNoDocuments {
			return nil, fmt.Errorf("produk dengan Nama %s tidak ditemukan", nama)
		}
		return nil, fmt.Errorf("gagal untuk mendapatkan produk: %v", err)
	}

	return &product, nil
}

// Mendapatkan produk dengan stok paling sedikit
func (rp *mongoRepoProduk) GetProdukWithLowestStock(ctx context.Context, StokProduk int) ([]domain.Produk, error) {
	DataProduk := rp.DB.Collection(_Produk)

	// Jika StokProduk tidak ditentukan atau 0, gunakan default 10
	if StokProduk <= 0 {
		StokProduk = 10
	}

	// Buat options untuk sorting berdasarkan stok_barang (ascending) dan StokProduk
	findOptions := options.Find()
	findOptions.SetSort(bson.D{{Key: "stok_barang", Value: 1}}) // 1 untuk ascending (dari kecil ke besar)
	findOptions.SetLimit(int64(StokProduk))

	// Query untuk mendapatkan produk yang tidak dihapus
	cursor, err := DataProduk.Find(ctx, bson.M{"is_deleted": nil}, findOptions)
	if err != nil {
		return nil, fmt.Errorf("gagal untuk mendapatkan produk dengan stok terendah: %v", err)
	}
	defer cursor.Close(ctx)

	// Decode hasil query ke slice domain.Produk
	var products []domain.Produk
	if err := cursor.All(ctx, &products); err != nil {
		return nil, fmt.Errorf("gagal untuk decode produk: %v", err)
	}

	// Jika tidak ada produk yang ditemukan
	if len(products) == 0 {
		return []domain.Produk{}, nil
	}

	return products, nil
}

// Memperbarui Data Produk
func (rp *mongoRepoProduk) UpdateProduk(ctx context.Context, bd *domain.Produk) error {
	DataProduk := rp.DB.Collection(_Produk)

	// Set current time for UpdatedAt
	bd.UpdatedAt = time.Now()

	// Update document
	filter := bson.M{"id_produk": bd.IDProduk}
	update := bson.M{
		"$set": bson.M{
			"nama_produk":        bd.NamaProduk,
			"kategori":           bd.Kategori,
			"subkategori":        bd.SubKategori,
			"kode_produk":        bd.KodeProduk,
			"harga_produk":       bd.HargaProduk,
			"stok_barang":        bd.Stok,
			"tanggal_kadaluarsa": bd.TanggalKadaluarsa,
			"updated_at":         bd.UpdatedAt,
		},
	}

	result, err := DataProduk.UpdateOne(ctx, filter, update)
	if err != nil {
		return fmt.Errorf("error updating product: %v", err)
	}

	if result.MatchedCount == 0 {
		return fmt.Errorf("product with ID %s not found", bd.IDProduk)
	}

	return nil
}

// Menghapus Data Produk
func (rp *mongoRepoProduk) DeleteProduk(ctx context.Context, id string) error {
	DataProduk := rp.DB.Collection(_Produk)

	now := time.Now()
	filter := bson.M{"id_produk": id}
	update := bson.M{
		"$set": bson.M{
			"is_deleted": now,
		},
	}

	result, err := DataProduk.UpdateOne(ctx, filter, update)
	if err != nil {
		return fmt.Errorf("error soft deleting product: %v", err)
	}

	if result.MatchedCount == 0 {
		return fmt.Errorf("product with ID %s not found", id)
	}

	return nil
}

// DecreaseProdukStock untuk mengurangi stok produk
func (rp *mongoRepoProduk) DecreaseProdukStock(ctx context.Context, id string, kuantitas int) error {
	DataProduk := rp.DB.Collection(_Produk)

	var product domain.Produk
	err := DataProduk.FindOne(ctx, bson.M{"id_produk": id, "is_deleted": nil}).Decode(&product)
	if err != nil {
		if err == mongo.ErrNoDocuments {
			return fmt.Errorf("produk dengan ID %s tidak ditemukan", id)
		}
		return fmt.Errorf("gagal untuk mendapatkan produk: %v", err)
	}

	if product.Stok < kuantitas {
		return fmt.Errorf("stok tidak mencukupi, stok tersedia: %d, permintaan: %d", product.Stok, kuantitas)
	}

	update := bson.M{
		"$inc": bson.M{"stok_barang": -kuantitas},
		"$set": bson.M{"updated_at": time.Now()},
	}

	result, err := DataProduk.UpdateOne(ctx, bson.M{"id_produk": id}, update)
	if err != nil {
		return fmt.Errorf("gagal mengupdate stok: %v", err)
	}

	if result.MatchedCount == 0 {
		return fmt.Errorf("produk dengan ID %s tidak ditemukan", id)
	}

	return nil
}

// IncreaseProdukStock menambah stok produk
func (rp *mongoRepoProduk) IncreaseProdukStock(ctx context.Context, id string, kuantitas int) error {
	DataProduk := rp.DB.Collection(_Produk)

	var existingProduct domain.Produk
	err := DataProduk.FindOne(ctx, bson.M{"id_produk": id}).Decode(&existingProduct)
	if err != nil {
		if err == mongo.ErrNoDocuments {
			return fmt.Errorf("produk dengan ID %s tidak ditemukan", id)
		}
		return fmt.Errorf("gagal mendapatkan data produk: %v", err)
	}

	if kuantitas <= 0 {
		return fmt.Errorf("kuantitas harus lebih dari 0")
	}

	update := bson.M{
		"$inc": bson.M{
			"stok_barang": kuantitas,
		},
		"$set": bson.M{
			"updated_at": time.Now(),
		},
	}

	_, err = DataProduk.UpdateOne(ctx, bson.M{"id_produk": id}, update)
	if err != nil {
		return fmt.Errorf("gagal menambah stok produk: %v", err)
	}

	log.Printf("Berhasil menambah stok produk %s sebanyak %d", id, kuantitas)
	return nil
}

// ImportData mengimpor data produk secara batch
func (rp *mongoRepoProduk) ImportData(ctx context.Context, produkList []domain.Produk) error {
	if len(produkList) == 0 {
		return nil
	}

	DataProduk := rp.DB.Collection(_Produk)

	// 1. Dapatkan ID terakhir dari database
	var lastProduct domain.Produk
	err := DataProduk.FindOne(ctx, bson.M{}, options.FindOne().SetSort(bson.M{"id_produk": -1})).Decode(&lastProduct)
	if err != nil && err != mongo.ErrNoDocuments {
		return fmt.Errorf("error finding last product: %v", err)
	}

	// Tentukan ID awal
	startID := 1
	if err != mongo.ErrNoDocuments {
		lastIDNum, err := strconv.Atoi(lastProduct.IDProduk)
		if err != nil {
			return fmt.Errorf("error parsing last ID: %v", err)
		}
		startID = lastIDNum + 1
	}

	// 2. Cek duplikat kode produk
	kodeProdukList := make([]string, 0)
	for _, produk := range produkList {
		if produk.KodeProduk != "" {
			kodeProdukList = append(kodeProdukList, produk.KodeProduk)
		}
	}

	existingKodeProduk := make(map[string]bool)
	if len(kodeProdukList) > 0 {
		cursor, err := DataProduk.Find(ctx, bson.M{
			"kode_produk": bson.M{"$in": kodeProdukList},
			"is_deleted":  nil,
		})
		if err != nil {
			return fmt.Errorf("error checking existing kode produk: %v", err)
		}
		defer cursor.Close(ctx)

		for cursor.Next(ctx) {
			var existing domain.Produk
			if err := cursor.Decode(&existing); err != nil {
				return fmt.Errorf("error decoding existing product: %v", err)
			}
			existingKodeProduk[existing.KodeProduk] = true
			log.Printf("Found existing kode produk: %s", existing.KodeProduk)
		}
	}

	// 3. Siapkan dokumen untuk bulk insert
	var operations []mongo.WriteModel
	skippedCount := 0
	currentID := startID
	now := time.Now()

	log.Printf("Starting import with ID: %d", currentID)

	for i, produk := range produkList {
		// Validasi data
		if produk.NamaProduk == "" || produk.KodeProduk == "" {
			log.Printf("Skip produk #%d: field wajib kosong", i+1)
			skippedCount++
			continue
		}

		// Cek duplikat kode produk
		if existingKodeProduk[produk.KodeProduk] {
			log.Printf("Skip produk #%d: kode produk %s sudah ada", i+1, produk.KodeProduk)
			log.Printf("Existing kode produk: %v", existingKodeProduk)
			skippedCount++
			continue
		}

		// Set ID dan metadata
		idStr := fmt.Sprintf("%03d", currentID)
		log.Printf("Assigning ID %s to product %s", idStr, produk.NamaProduk)

		doc := bson.D{
			{Key: "id_produk", Value: idStr},
			{Key: "nama_produk", Value: produk.NamaProduk},
			{Key: "kategori", Value: produk.Kategori},
			{Key: "subkategori", Value: produk.SubKategori},
			{Key: "kode_produk", Value: produk.KodeProduk},
			{Key: "harga_produk", Value: produk.HargaProduk},
			{Key: "stok_barang", Value: produk.Stok},
			{Key: "tanggal_kadaluarsa", Value: produk.TanggalKadaluarsa},
			{Key: "updated_at", Value: now},
			{Key: "is_deleted", Value: nil},
		}

		operation := mongo.NewInsertOneModel().SetDocument(doc)
		operations = append(operations, operation)
		currentID++

		// Tandai kode produk sebagai sudah digunakan
		existingKodeProduk[produk.KodeProduk] = true
	}

	if len(operations) == 0 {
		if skippedCount > 0 {
			return fmt.Errorf("semua produk (%d) dilewati karena duplikat atau tidak valid", skippedCount)
		}
		return fmt.Errorf("tidak ada data valid yang dapat diimpor")
	}

	// 4. Lakukan bulk insert
	bulkOpts := options.BulkWrite().SetOrdered(true)
	result, err := DataProduk.BulkWrite(ctx, operations, bulkOpts)
	if err != nil {
		if bulkErr, ok := err.(mongo.BulkWriteException); ok {
			for _, writeErr := range bulkErr.WriteErrors {
				log.Printf("Error pada dokumen %d: %v", writeErr.Index, writeErr.Message)
			}
			if result != nil && result.InsertedCount > 0 {
				log.Printf("Berhasil mengimpor sebagian: %d dari %d dokumen",
					result.InsertedCount, len(operations))
				return nil
			}
		}
		return fmt.Errorf("gagal mengimpor data: %v", err)
	}

	log.Printf("Berhasil mengimpor %d produk, %d produk dilewati",
		result.InsertedCount, skippedCount)
	return nil
}

// Mengimplementasikan algoritma Apriori untuk mencari itemset yang sering muncul
func (rp *mongoRepoProduk) GetFrequentItemsets(ctx context.Context, minSupport float64) ([]domain.FrequentItemset, error) {
	// Ambil semua data detail penjualan
	DetailPenjualan := rp.DB.Collection("detail_penjualan")

	cursor, err := DetailPenjualan.Find(ctx, bson.M{})
	if err != nil {
		return nil, fmt.Errorf("error saat mengambil data detail penjualan: %v", err)
	}
	defer cursor.Close(ctx)

	// Simpan semua transaksi
	var details []bson.M
	if err = cursor.All(ctx, &details); err != nil {
		return nil, fmt.Errorf("error saat decode data detail penjualan: %v", err)
	}

	// Hitung total transaksi
	totalTransactions := float64(len(details))
	if totalTransactions == 0 {
		return []domain.FrequentItemset{}, nil
	}

	// Map untuk menyimpan jumlah kemunculan setiap produk
	itemCounts := make(map[string]float64)
	itemNames := make(map[string]string) // Map untuk menyimpan nama produk

	// Hitung jumlah kemunculan untuk setiap produk
	for _, detail := range details {
		if products, ok := detail["produk"].(primitive.A); ok {
			// Set untuk mencegah duplikasi dalam satu transaksi
			seenItems := make(map[string]bool)

			for _, p := range products {
				if product, ok := p.(bson.M); ok {
					idProduk := product["id_produk"].(string)
					if !seenItems[idProduk] {
						itemCounts[idProduk]++
						itemNames[idProduk] = product["nama_produk"].(string)
						seenItems[idProduk] = true
					}
				}
			}
		}
	}

	// Filter produk yang memenuhi minimum support
	var frequentItems []string
	for item, count := range itemCounts {
		support := count / totalTransactions
		if support >= minSupport {
			frequentItems = append(frequentItems, item)
		}
	}

	var result []domain.FrequentItemset

	// Fungsi untuk mengecek apakah itemset muncul dalam transaksi
	checkItemsetInTransaction := func(itemset []string, products primitive.A) bool {
		itemPresent := make(map[string]bool)
		for _, p := range products {
			if product, ok := p.(bson.M); ok {
				idProduk := product["id_produk"].(string)
				itemPresent[idProduk] = true
			}
		}

		for _, item := range itemset {
			if !itemPresent[item] {
				return false
			}
		}
		return true
	}

	// Cari frequent itemset dengan 2 produk
	for i := 0; i < len(frequentItems); i++ {
		for j := i + 1; j < len(frequentItems); j++ {
			item1 := frequentItems[i]
			item2 := frequentItems[j]

			// Hitung support untuk pasangan produk
			pairCount := 0.0
			for _, detail := range details {
				if products, ok := detail["produk"].(primitive.A); ok {
					hasItem1 := false
					hasItem2 := false

					for _, p := range products {
						if product, ok := p.(bson.M); ok {
							idProduk := product["id_produk"].(string)
							if idProduk == item1 {
								hasItem1 = true
							}
							if idProduk == item2 {
								hasItem2 = true
							}
						}
					}

					if hasItem1 && hasItem2 {
						pairCount++
					}
				}
			}

			pairSupport := pairCount / totalTransactions
			if pairSupport >= minSupport {
				itemset := domain.FrequentItemset{
					Produk:     []string{item1, item2},
					Support:    pairSupport,
					ProdukList: []string{itemNames[item1], itemNames[item2]},
				}
				result = append(result, itemset)
			}
		}
	}

	// Cari frequent itemset dengan 3 produk
	for i := 0; i < len(frequentItems); i++ {
		for j := i + 1; j < len(frequentItems); j++ {
			for k := j + 1; k < len(frequentItems); k++ {
				item1 := frequentItems[i]
				item2 := frequentItems[j]
				item3 := frequentItems[k]

				// Hitung support untuk triplet produk
				tripletCount := 0.0
				for _, detail := range details {
					if products, ok := detail["produk"].(primitive.A); ok {
						triplet := []string{item1, item2, item3}
						if checkItemsetInTransaction(triplet, products) {
							tripletCount++
						}
					}
				}

				tripletSupport := tripletCount / totalTransactions
				if tripletSupport >= minSupport {
					itemset := domain.FrequentItemset{
						Produk:     []string{item1, item2, item3},
						Support:    tripletSupport,
						ProdukList: []string{itemNames[item1], itemNames[item2], itemNames[item3]},
					}
					result = append(result, itemset)
				}
			}
		}
	}

	// Urutkan berdasarkan nilai support tertinggi
	sort.Slice(result, func(i, j int) bool {
		return result[i].Support > result[j].Support
	})

	return result, nil
}

// GetBestSellingProducts mendapatkan daftar produk terlaris berdasarkan jumlah terjual
// Mengembalikan map dengan id_produk sebagai key dan jumlah terjual sebagai value
func (rp *mongoRepoProduk) GetBestSellingProducts(ctx context.Context, limitProduk int) ([]map[string]interface{}, error) {
	// Pastikan limit valid
	if limitProduk <= 0 {
		limitProduk = 10 // Default limit 10 produk terlaris
	}

	// Kita akan menggunakan collection detail_penjualan untuk mendapatkan data penjualan
	detailPenjualan := rp.DB.Collection("detail_penjualan")

	// Pipeline aggregation untuk mendapatkan produk terlaris
	produkBestSelling := []bson.M{
		{
			// Unwind produk array dalam detail_penjualan
			"$unwind": "$produk",
		},
		{
			// Group berdasarkan id_produk dan hitung total terjual
			"$group": bson.M{
				"_id": "$produk.id_produk",
				"total_terjual": bson.M{
					"$sum": "$penjualan.jumlah_produk",
				},
			},
		},
		{
			// Sort berdasarkan total_terjual (descending)
			"$sort": bson.M{
				"total_terjual": -1,
			},
		},
		{
			// Limit jumlah hasil
			"$limit": limitProduk,
		},
		{
			// Lookup untuk mendapatkan detail produk
			"$lookup": bson.M{
				"from":         "produk",
				"localField":   "_id",
				"foreignField": "id_produk",
				"as":           "produk_detail",
			},
		},
		{
			// Unwind produk_detail
			"$unwind": "$produk_detail",
		},
		{
			// Project untuk format hasil akhir
			"$project": bson.M{
				"_id":            0,
				"id_produk":      "$_id",
				"nama_produk":    "$produk_detail.nama_produk",
				"jumlah_terjual": "$total_terjual",
			},
		},
	}

	// Jalankan aggregation
	cursor, err := detailPenjualan.Aggregate(ctx, produkBestSelling)
	if err != nil {
		log.Printf("Error executing aggregation: %v", err)
		return nil, err
	}
	defer cursor.Close(ctx)

	// Hasil aggregation
	var HasilData []map[string]interface{}
	if err := cursor.All(ctx, &HasilData); err != nil {
		log.Printf("Error decoding results: %v", err)
		return nil, err
	}

	// Jika tidak ada hasil, coba pendekatan alternatif dengan collection penjualan
	if len(HasilData) == 0 {
		log.Println("No results from detail_penjualan, trying alternative approach with penjualan collection")

		// Pipeline alternatif menggunakan collection penjualan
		altPipeline := []bson.M{
			{
				// Group berdasarkan id_produk dari detail_penjualan
				"$group": bson.M{
					"_id": nil,
					"total_penjualan": bson.M{
						"$sum": "$jumlah_produk",
					},
				},
			},
		}

		// Jalankan aggregation alternatif
		altCursor, altErr := rp.DB.Collection("penjualan").Aggregate(ctx, altPipeline)
		if altErr != nil {
			log.Printf("Error executing alternative aggregation: %v", altErr)
			return HasilData, nil // Return hasil kosong daripada error
		}
		defer altCursor.Close(ctx)

		// Jika pendekatan alternatif juga tidak berhasil, kembalikan hasil kosong
		log.Println("Alternative approach also yielded no results, returning empty array")
	}

	return HasilData, nil
}
