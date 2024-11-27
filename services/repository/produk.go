package repository

import (
	"SIE-SRC/domain"
	"context"
	"fmt"
	"log"
	"time"

	"go.mongodb.org/mongo-driver/bson"
	"go.mongodb.org/mongo-driver/mongo"
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

// Membuat Data Produk
func (rp *mongoRepoProduk) CreateProduk(Ctx context.Context, bd *domain.Produk) (domain.Produk, error) {
	DataProduk := rp.DB.Collection(_Produk)

	if bd.IDProduk == "" {
		return domain.Produk{}, fmt.Errorf("ID Produk cannot be")
	}

	CheckingProductByID, err := rp.GetProdukById(Ctx, bd.IDProduk)
	if err == nil {
		return domain.Produk{}, fmt.Errorf("ID produk sudah digunakan oleh produk: %s", fmt.Sprintf("%s %s", bd.IDProduk, CheckingProductByID.IDProduk))
	} else if err.Error() != fmt.Sprintf("produk dengan ID %s tidak ditemukan", bd.IDProduk) {
		return domain.Produk{}, fmt.Errorf("gagal untuk mengecek apakah produk dengan ID: %v sudah digunakan", bd.IDProduk)
	}

	_, err = DataProduk.InsertOne(Ctx, bd)
	if err != nil {
		return domain.Produk{}, err
	}

	return *bd, nil
}

// Memunculkan Semua Data Produk
func (rp *mongoRepoProduk) GetAllProduk(Ctx context.Context) ([]domain.Produk, error) {
	DataProduk := rp.DB.Collection(_Produk)

	var ListProduk []domain.Produk

	data, err := DataProduk.Find(Ctx, bson.M{"is_deleted": nil})
	if err != nil {
		return nil, err
	}
	defer data.Close(Ctx)

	for data.Next(Ctx) {
		var Produk domain.Produk
		if err := data.Decode(&Produk); err != nil {
			log.Println("Error decoding Product:", err)
			continue
		}
		ListProduk = append(ListProduk, Produk)
	}

	if err := data.Err(); err != nil {
		return nil, err
	}

	return ListProduk, err
}

// Mencari Data Produk Berdasarkan ID Produk
func (rp *mongoRepoProduk) GetProdukById(Ctx context.Context, id string) (*domain.Produk, error) {
	DataProduk := rp.DB.Collection(_Produk)

	var ListProduk domain.Produk
	err := DataProduk.FindOne(Ctx, bson.M{"id_produk": id, "is_deleted": nil}).Decode(&ListProduk)
	if err != nil {
		if err == mongo.ErrNoDocuments {
			return nil, fmt.Errorf("produk dengan ID %s tidak ditemukan", id)
		}
		return nil, fmt.Errorf("gagal untuk mendapatkan produk: %v", err)
	}

	return &ListProduk, nil
}

// Mencari Data Produk Berdasarkan Nama Produk
func (rp *mongoRepoProduk) GetProdukByName(Ctx context.Context, nama string) (*domain.Produk, error) {
	DataProduk := rp.DB.Collection(_Produk)

	var ListProduk domain.Produk
	err := DataProduk.FindOne(Ctx, bson.M{"nama_produk": nama, "is deleted": nil}).Decode(&ListProduk)
	if err != nil {
		if err == mongo.ErrNoDocuments {
			return nil, fmt.Errorf("produk dengan Nama %s tidak ditemukan", nama)
		}
		return nil, fmt.Errorf("gagal untuk mendapatkan produk: %v", err)
	}

	return &ListProduk, nil
}

// Memperbarui Data Produk
func (rp *mongoRepoProduk) UpdateProduk(Ctx context.Context, bd *domain.Produk) error {
	DataProduk := rp.DB.Collection(_Produk)

	bd.UpdatedAt = time.Now()

	filter := bson.M{
		"$or": []bson.M{
			{"id_produk": bd.IDProduk},
			{"nama_produk": bd.NamaProduk},
		},
	}

	var existingProduct domain.Produk
	err := DataProduk.FindOne(Ctx, filter).Decode(&existingProduct)
	if err != nil {
		if err == mongo.ErrNoDocuments {
			return fmt.Errorf("produk dengan id %s atau dengan nama %s tidak ditemukan", bd.IDProduk, bd.NamaProduk)
		}
		return fmt.Errorf("gagal untuk mengecek produk: %v", err)
	}

	update := bson.M{
		"$set": bson.M{
			"id_produk":      bd.IDProduk,
			"nama_produk":    bd.NamaProduk,
			"kategori":       bd.Kategori,
			"sub_kategori":   bd.SubKategori,
			"barcode_produk": bd.KodeProduk,
			"stok_barang":    bd.Stok,
			"updated_at":     bd.UpdatedAt,
		},
	}

	_, err = DataProduk.UpdateOne(Ctx, filter, update)
	if err != nil {
		return err
	}

	return nil
}

// Menghapus Data Produk Dengan ID atau Nama Produk
func (rp *mongoRepoProduk) DeleteProduk(Ctx context.Context, id, nama string) error {
	DataProduk := rp.DB.Collection(_Produk)

	// Menentukan filter berdasarkan ID atau nama produk
	filter := bson.M{}
	if id != "" {
		filter["id_produk"] = id
	}
	if nama != "" {
		filter["nama_produk"] = nama
	}

	// Memastikan filter tidak kosong
	if len(filter) == 0 {
		return fmt.Errorf("ID atau nama produk diperlukan untuk menghapus data")
	}

	// Mengecek apakah produk yang akan dihapus ada
	var CheckingProduct domain.Produk
	err := DataProduk.FindOne(Ctx, filter).Decode(&CheckingProduct)
	if err != nil {
		if err == mongo.ErrNoDocuments {
			return fmt.Errorf("produk dengan ID %s atau nama %s tidak ditemukan", id, nama)
		}
		return fmt.Errorf("gagal untuk mengecek produk: %v", err)
	}

	update := bson.M{
		"$set": bson.M{
			"is_deleted": true,
			"updated_at": time.Now(),
		},
	}

	// Menghapus data produk
	_, err = DataProduk.UpdateOne(Ctx, filter, update)
	if err != nil {
		return fmt.Errorf("gagal untuk menghapus produk: %v", err)
	}

	return nil
}

func (rp *mongoRepoProduk) DecreaseProdukStock(ctx context.Context, id string, quantity int) error {
	DataProduk := rp.DB.Collection(_Produk)

	filter := bson.M{"id_produk": id, "is_deleted": nil}

	update := bson.M{
		"$inc": bson.M{
			"stok_barang": -quantity,
		},
		"$set": bson.M{
			"updated_at": time.Now(),
		},
	}

	result, err := DataProduk.UpdateOne(ctx, filter, update)
	if err != nil {
		return fmt.Errorf("gagal mengurangi stok produk: %v", err)
	}

	if result.MatchedCount == 0 {
		return fmt.Errorf("produk dengan ID %s tidak ditemukan atau sudah dihapus", id)
	}

	return nil

}

func (rp *mongoRepoProduk) ImportData(ctx context.Context, produkList []domain.Produk) error {
	for _, produk := range produkList {
		_, err := rp.DB.Collection("produk").InsertOne(ctx, produk) // Sesuaikan dengan koleksi Anda
		if err != nil {
			return err
		}
	}
	return nil
}

// Menghapus Data Produk Dengan Nama Produk
// func (rp *mongoRepoProduk) DeleteProdukByName(Ctx context.Context, nama string) error {
// 	DataProduk := rp.DB.Collection(_Produk)

// 	//Mengecek ID Produk yang akan dihapus
// 	var CheckingProductByName domain.Produk
// 	err := DataProduk.FindOne(Ctx, bson.M{"nama_produk": nama}).Decode(&CheckingProductByName)
// 	if err != nil {
// 		if err == mongo.ErrNoDocuments {
// 			return fmt.Errorf("produk dengan ID %s tidak ditemukan", err)
// 		}
// 		return fmt.Errorf("gagal untuk mengecek produk: %v", err)
// 	}

// 	//Menghapus Data Produk
// 	_, err = DataProduk.DeleteOne(Ctx, bson.M{"id_produk": nama})
// 	if err != nil {
// 		return err
// 	}

// 	return nil
// }
