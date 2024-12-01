package repository

import (
	"SIE-SRC/domain"
	"context"
	"fmt"
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

	// Cek produk ada dan stoknya cukup
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

	// Update stok
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

// ImportData mengimpor data produk secara batch
func (rp *mongoRepoProduk) ImportData(ctx context.Context, produkList []domain.Produk) error {
	if len(produkList) == 0 {
		return nil
	}

	DataProduk := rp.DB.Collection(_Produk)

	// Convert slice of Produk to slice of interface{}
	docs := make([]interface{}, len(produkList))
	for i, produk := range produkList {
		// Generate ID jika belum ada
		if produk.IDProduk == "" {
			nextID, err := rp.GenerateNextID(ctx)
			if err != nil {
				return fmt.Errorf("error generating ID for product %d: %v", i, err)
			}
			produk.IDProduk = nextID
		}
		produk.UpdatedAt = time.Now()
		docs[i] = produk
	}

	// Insert many
	_, err := DataProduk.InsertMany(ctx, docs)
	if err != nil {
		return fmt.Errorf("gagal mengimpor data: %v", err)
	}

	return nil
}
