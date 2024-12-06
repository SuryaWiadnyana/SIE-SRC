package repository

import (
	"SIE-SRC/domain"
	"context"
	"fmt"
	"log"
	"strconv"
	"time"

	"go.mongodb.org/mongo-driver/bson"
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

	// Find the last document sorted by _id in descending order
	opts := options.FindOne().SetSort(bson.M{"_id": -1})
	var lastProduct domain.Produk

	err := DataProduk.FindOne(ctx, bson.M{}, opts).Decode(&lastProduct)
	if err != nil {
		if err == mongo.ErrNoDocuments {
			// If no documents exist, start with "001"
			return "001", nil
		}
		return "", fmt.Errorf("error finding last product: %v", err)
	}

	// Parse the last ID and increment
	lastID, err := strconv.Atoi(lastProduct.IDProduk)
	if err != nil {
		return "", fmt.Errorf("error parsing last ID: %v", err)
	}

	// Format new ID with leading zeros
	newID := fmt.Sprintf("%03d", lastID+1)
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

	filter := bson.M{
		"is_deleted": nil, // Only get non-deleted products
	}

	cursor, err := DataProduk.Find(ctx, filter)
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
	err := DataProduk.FindOne(ctx, bson.M{"_id": id, "is_deleted": nil}).Decode(&product)
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

// Memperbarui Data Produk
func (rp *mongoRepoProduk) UpdateProduk(ctx context.Context, bd *domain.Produk) error {
	DataProduk := rp.DB.Collection(_Produk)

	bd.UpdatedAt = time.Now()

	filter := bson.M{"_id": bd.IDProduk}
	update := bson.M{
		"$set": bson.M{
			"nama_produk":    bd.NamaProduk,
			"kategori":       bd.Kategori,
			"sub_kategori":   bd.SubKategori,
			"barcode_produk": bd.KodeProduk,
			"harga":          bd.Harga,
			"stok_barang":    bd.Stok,
			"updated_at":     bd.UpdatedAt,
		},
	}

	result, err := DataProduk.UpdateOne(ctx, filter, update)
	if err != nil {
		return fmt.Errorf("error updating product: %v", err)
	}

	if result.MatchedCount == 0 {
		return fmt.Errorf("produk dengan ID %s tidak ditemukan", bd.IDProduk)
	}

	return nil
}

// Menghapus Data Produk
func (rp *mongoRepoProduk) DeleteProduk(ctx context.Context, id string) error {
	DataProduk := rp.DB.Collection(_Produk)

	now := time.Now()
	filter := bson.M{"_id": id}
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
		return fmt.Errorf("produk dengan ID %s tidak ditemukan", id)
	}

	return nil
}

// DecreaseProdukStock mengurangi stok produk
func (rp *mongoRepoProduk) DecreaseProdukStock(ctx context.Context, id string, quantity int) error {
	DataProduk := rp.DB.Collection(_Produk)

	var product domain.Produk
	err := DataProduk.FindOne(ctx, bson.M{"_id": id, "is_deleted": nil}).Decode(&product)
	if err != nil {
		if err == mongo.ErrNoDocuments {
			return fmt.Errorf("produk dengan ID %s tidak ditemukan", id)
		}
		return fmt.Errorf("gagal untuk mendapatkan produk: %v", err)
	}

	if product.Stok < quantity {
		return fmt.Errorf("stok tidak mencukupi, stok tersedia: %d, permintaan: %d", product.Stok, quantity)
	}

	update := bson.M{
		"$inc": bson.M{"stok_barang": -quantity},
		"$set": bson.M{"updated_at": time.Now()},
	}

	result, err := DataProduk.UpdateOne(ctx, bson.M{"_id": id}, update)
	if err != nil {
		return fmt.Errorf("gagal mengupdate stok: %v", err)
	}

	if result.MatchedCount == 0 {
		return fmt.Errorf("produk dengan ID %s tidak ditemukan", id)
	}

	return nil
}

// IncreaseProdukStock menambah stok produk
func (rp *mongoRepoProduk) IncreaseProdukStock(ctx context.Context, id string, quantity int) error {
	DataProduk := rp.DB.Collection(_Produk)

	var existingProduct domain.Produk
	err := DataProduk.FindOne(ctx, bson.M{"_id": id}).Decode(&existingProduct)
	if err != nil {
		if err == mongo.ErrNoDocuments {
			return fmt.Errorf("produk dengan ID %s tidak ditemukan", id)
		}
		return fmt.Errorf("gagal mendapatkan data produk: %v", err)
	}

	if quantity <= 0 {
		return fmt.Errorf("quantity harus lebih dari 0")
	}

	update := bson.M{
		"$inc": bson.M{
			"stok_barang": quantity,
		},
		"$set": bson.M{
			"updated_at": time.Now(),
		},
	}

	_, err = DataProduk.UpdateOne(ctx, bson.M{"_id": id}, update)
	if err != nil {
		return fmt.Errorf("gagal menambah stok produk: %v", err)
	}

	log.Printf("Berhasil menambah stok produk %s sebanyak %d", id, quantity)
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
	err := DataProduk.FindOne(ctx, bson.M{}, options.FindOne().SetSort(bson.M{"_id": -1})).Decode(&lastProduct)
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

	// 2. Cek duplikat barcode
	barcodes := make([]string, 0)
	for _, produk := range produkList {
		if produk.KodeProduk != "" {
			barcodes = append(barcodes, produk.KodeProduk)
		}
	}

	existingBarcodes := make(map[string]bool)
	if len(barcodes) > 0 {
		cursor, err := DataProduk.Find(ctx, bson.M{
			"barcode_produk": bson.M{"$in": barcodes},
			"is_deleted":     nil,
		})
		if err != nil {
			return fmt.Errorf("error checking existing barcodes: %v", err)
		}
		defer cursor.Close(ctx)

		for cursor.Next(ctx) {
			var existing domain.Produk
			if err := cursor.Decode(&existing); err != nil {
				return fmt.Errorf("error decoding existing product: %v", err)
			}
			existingBarcodes[existing.KodeProduk] = true
			log.Printf("Found existing barcode: %s", existing.KodeProduk)
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

		// Cek duplikat barcode
		if existingBarcodes[produk.KodeProduk] {
			log.Printf("Skip produk #%d: barcode %s sudah ada", i+1, produk.KodeProduk)
			skippedCount++
			continue
		}

		// Set ID dan metadata
		idStr := fmt.Sprintf("%03d", currentID)
		log.Printf("Assigning ID %s to product %s", idStr, produk.NamaProduk)

		doc := bson.D{
			{Key: "_id", Value: idStr},
			{Key: "nama_produk", Value: produk.NamaProduk},
			{Key: "kategori", Value: produk.Kategori},
			{Key: "sub_kategori", Value: produk.SubKategori},
			{Key: "barcode_produk", Value: produk.KodeProduk},
			{Key: "harga", Value: produk.Harga},
			{Key: "stok_barang", Value: produk.Stok},
			{Key: "updated_at", Value: now},
			{Key: "is_deleted", Value: nil},
		}

		operation := mongo.NewInsertOneModel().SetDocument(doc)
		operations = append(operations, operation)
		currentID++

		// Tandai barcode sebagai sudah digunakan
		existingBarcodes[produk.KodeProduk] = true
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
