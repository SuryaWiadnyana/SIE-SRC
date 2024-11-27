package repository

import (
	"SIE-SRC/domain"
	"context"
	"fmt"
	"log"
	"time"

	"go.mongodb.org/mongo-driver/bson"
	"go.mongodb.org/mongo-driver/bson/primitive"
	"go.mongodb.org/mongo-driver/mongo"
)

type mongoRepoPenjualan struct {
	DB         *mongo.Database
	RepoProduk domain.ProdukRepository
}

func NewMongoRepoPenjualan(client *mongo.Database) domain.PenjualanRepository {
	return &mongoRepoPenjualan{
		DB: client,
	}
}

var _Penjualan = "penjualan"

// Create menambahkan Penjualan baru ke dalam koleksi.
func (rp *mongoRepoPenjualan) CreateBulk(ctx context.Context, bd []domain.Penjualan) ([]domain.Penjualan, error) {
	ListPenjualan := rp.DB.Collection(_Penjualan)
	var PenjualanDocs []interface{}

	sesi, err := rp.DB.Client().StartSession()
	if err != nil {
		return nil, fmt.Errorf("gagal untuk memulai sesi: %v", err)
	}
	defer sesi.EndSession(ctx)

	err = mongo.WithSession(ctx, sesi, func(sc mongo.SessionContext) error {
		for _, penjualan := range bd {
			if penjualan.IDPenjualan == "" {
				return fmt.Errorf("ID penjualan tidak boleh kosong")
			}

			PenjualanDocs = append(PenjualanDocs, penjualan)

			for _, item := range penjualan.Produk {
				err := rp.RepoProduk.DecreaseProdukStock(sc, item.IDProduk, item.Quantity)
				if err != nil {
					log.Printf("gagal untuk mengurangu stok untuk produk %s: %v", item.IDProduk, err)
					sesi.AbortTransaction(sc)
					return fmt.Errorf("gagal untuk mengurangi stok untuk produk %s: %v", item.IDProduk, err)
				}
			}
		}
		result, err := ListPenjualan.InsertMany(sc, PenjualanDocs)
		if err != nil {
			sesi.AbortTransaction(sc)
			return fmt.Errorf("failed to insert data: %v", err)
		}

		for i, id := range result.InsertedIDs {
			bd[i].IDPenjualan = id.(primitive.ObjectID).Hex()
		}

		return sesi.CommitTransaction(sc)
	})

	if err != nil {
		return nil, err
	}

	return bd, nil
}

// GetAll mendapatkan semua produk dari koleksi.
func (rp *mongoRepoPenjualan) GetAll(ctx context.Context) ([]domain.Penjualan, error) {
	penjualanProduk := rp.DB.Collection(_Penjualan)

	var ListPenjualan []domain.Penjualan
	data, err := penjualanProduk.Find(ctx, bson.M{})
	if err != nil {
		return nil, err
	}
	defer data.Close(ctx)

	for data.Next(ctx) {
		var Sells domain.Penjualan
		if err := data.Decode(&Sells); err != nil {
			log.Println("Error decoding product:", err)
			continue
		}
		ListPenjualan = append(ListPenjualan, Sells)
	}

	if err := data.Err(); err != nil {
		return nil, err
	}

	return ListPenjualan, err
}

// GetByID mendapatkan produk berdasarkan ID.
func (rp *mongoRepoPenjualan) GetByID(ctx context.Context, id string) (*domain.Penjualan, error) {
	penjualanProduk := rp.DB.Collection(_Penjualan)

	var Penjualan domain.Penjualan
	err := penjualanProduk.FindOne(ctx, bson.M{"idpenjualan": id}).Decode(&Penjualan)
	if err != nil {
		if err == mongo.ErrNoDocuments {
			return nil, fmt.Errorf("product with ID %s not found", id)
		}
		return nil, fmt.Errorf("failed to retrieve product: %v", err)
	}

	return &Penjualan, nil
}

// Update memperbarui produk yang ada.
func (rp *mongoRepoPenjualan) Update(ctx context.Context, bd *domain.Penjualan) error {
	penjualanProduk := rp.DB.Collection(_Penjualan)

	bd.UpdatedAt = time.Now()

	filter := bson.M{"idpenjualan": bd.IDPenjualan}

	var existingProduct domain.Penjualan
	err := penjualanProduk.FindOne(ctx, filter).Decode(&existingProduct)
	if err != nil {
		if err == mongo.ErrNoDocuments {
			return fmt.Errorf("product with ID %s not found", bd.IDPenjualan)
		}
		return fmt.Errorf("failed to check existing product: %v", err)
	}

	update := bson.M{
		"$set": bson.M{
			"nama_penjual":  bd.NamaPenjual,
			"tanggal":       bd.Tanggal,
			"nama_produk":   bd.NamaProduk,
			"jumlah_produk": bd.JumlahProduk,
			"total":         bd.Total,
			"updated_at":    bd.UpdatedAt,
		},
	}

	_, err = penjualanProduk.UpdateOne(ctx, filter, update)
	if err != nil {
		return err
	}

	return nil
}

// Delete data penjualan berdasarkan ID.
func (rp *mongoRepoPenjualan) Delete(ctx context.Context, id string) error {
	penjualanProduk := rp.DB.Collection(_Penjualan)

	// Pastikan ID produk yang ingin dihapus ada
	var existingSales domain.Penjualan
	err := penjualanProduk.FindOne(ctx, bson.M{"idpenjualan": id}).Decode(&existingSales)
	if err != nil {
		if err == mongo.ErrNoDocuments {
			return fmt.Errorf("sales with ID %s not found", id)
		}
		return fmt.Errorf("failed to check existing sales: %v", err)
	}

	// Menghapus produk berdasarkan ID
	_, err = penjualanProduk.DeleteOne(ctx, bson.M{"idpenjualan": id})
	if err != nil {
		return err
	}

	return nil
}
