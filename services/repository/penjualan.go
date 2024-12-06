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
		if err := sesi.StartTransaction(); err != nil {
			return fmt.Errorf("gagal memulai transaksi: %v", err)
		}

		for _, penjualan := range bd {
			// Validasi data penjualan
			if penjualan.NamaPenjual == "" {
				return fmt.Errorf("nama penjual tidak boleh kosong")
			}

			if len(penjualan.Produk) == 0 {
				return fmt.Errorf("minimal harus ada satu produk")
			}

			// Set waktu dan ID
			penjualan.UpdatedAt = time.Now()
			if penjualan.Tanggal.IsZero() {
				penjualan.Tanggal = time.Now()
			}

			// Hitung total dan validasi stok
			total := 0
			for _, item := range penjualan.Produk {
				if item.Quantity <= 0 {
					return fmt.Errorf("quantity produk harus lebih dari 0")
				}

				// Cek stok dan harga produk
				produk, err := rp.RepoProduk.GetProdukById(sc, item.IDProduk)
				if err != nil {
					return fmt.Errorf("gagal mendapatkan info produk %s: %v", item.IDProduk, err)
				}

				if produk.Stok < item.Quantity {
					return fmt.Errorf("stok produk %s tidak mencukupi (tersedia: %d, diminta: %d)", 
						produk.NamaProduk, produk.Stok, item.Quantity)
				}

				// Kurangi stok
				err = rp.RepoProduk.DecreaseProdukStock(sc, item.IDProduk, item.Quantity)
				if err != nil {
					return fmt.Errorf("gagal mengurangi stok produk %s: %v", item.IDProduk, err)
				}

				total += produk.Harga * item.Quantity
			}

			penjualan.Total = total
			PenjualanDocs = append(PenjualanDocs, penjualan)
		}

		// Insert semua dokumen
		result, err := ListPenjualan.InsertMany(sc, PenjualanDocs)
		if err != nil {
			return fmt.Errorf("gagal menyimpan data penjualan: %v", err)
		}

		// Set ID yang digenerate MongoDB
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
	err := penjualanProduk.FindOne(ctx, bson.M{"id_penjualan": id}).Decode(&Penjualan)
	if err != nil {
		if err == mongo.ErrNoDocuments {
			return nil, fmt.Errorf("penjualan dengan ID %s tidak ditemukan", id)
		}
		return nil, fmt.Errorf("gagal mengambil data penjualan: %v", err)
	}

	return &Penjualan, nil
}

// Update memperbarui produk yang ada.
func (rp *mongoRepoPenjualan) Update(ctx context.Context, bd *domain.Penjualan) error {
	penjualanProduk := rp.DB.Collection(_Penjualan)

	sesi, err := rp.DB.Client().StartSession()
	if err != nil {
		return fmt.Errorf("gagal memulai sesi: %v", err)
	}
	defer sesi.EndSession(ctx)

	err = mongo.WithSession(ctx, sesi, func(sc mongo.SessionContext) error {
		if err := sesi.StartTransaction(); err != nil {
			return fmt.Errorf("gagal memulai transaksi: %v", err)
		}

		// Ambil data penjualan lama
		var existingSales domain.Penjualan
		err := penjualanProduk.FindOne(sc, bson.M{"id_penjualan": bd.IDPenjualan}).Decode(&existingSales)
		if err != nil {
			if err == mongo.ErrNoDocuments {
				return fmt.Errorf("penjualan dengan ID %s tidak ditemukan", bd.IDPenjualan)
			}
			return fmt.Errorf("gagal mengambil data penjualan: %v", err)
		}

		// Kembalikan stok produk lama
		for _, item := range existingSales.Produk {
			err := rp.RepoProduk.IncreaseProdukStock(sc, item.IDProduk, item.Quantity)
			if err != nil {
				return fmt.Errorf("gagal mengembalikan stok produk %s: %v", item.IDProduk, err)
			}
		}

		// Validasi dan update stok baru
		total := 0
		for _, item := range bd.Produk {
			if item.Quantity <= 0 {
				return fmt.Errorf("quantity produk harus lebih dari 0")
			}

			produk, err := rp.RepoProduk.GetProdukById(sc, item.IDProduk)
			if err != nil {
				return fmt.Errorf("gagal mendapatkan info produk %s: %v", item.IDProduk, err)
			}

			if produk.Stok < item.Quantity {
				return fmt.Errorf("stok produk %s tidak mencukupi (tersedia: %d, diminta: %d)", 
					produk.NamaProduk, produk.Stok, item.Quantity)
			}

			err = rp.RepoProduk.DecreaseProdukStock(sc, item.IDProduk, item.Quantity)
			if err != nil {
				return fmt.Errorf("gagal mengurangi stok produk %s: %v", item.IDProduk, err)
			}

			total += produk.Harga * item.Quantity
		}

		// Update penjualan
		bd.UpdatedAt = time.Now()
		bd.Total = total

		update := bson.M{
			"$set": bson.M{
				"nama_penjual":  bd.NamaPenjual,
				"tanggal":       bd.Tanggal,
				"produk":        bd.Produk,
				"total":         bd.Total,
				"updated_at":    bd.UpdatedAt,
			},
		}

		_, err = penjualanProduk.UpdateOne(sc, bson.M{"id_penjualan": bd.IDPenjualan}, update)
		if err != nil {
			return fmt.Errorf("gagal update penjualan: %v", err)
		}

		return sesi.CommitTransaction(sc)
	})

	return err
}

// Delete data penjualan berdasarkan ID.
func (rp *mongoRepoPenjualan) Delete(ctx context.Context, id string) error {
	penjualanProduk := rp.DB.Collection(_Penjualan)

	sesi, err := rp.DB.Client().StartSession()
	if err != nil {
		return fmt.Errorf("gagal memulai sesi: %v", err)
	}
	defer sesi.EndSession(ctx)

	err = mongo.WithSession(ctx, sesi, func(sc mongo.SessionContext) error {
		if err := sesi.StartTransaction(); err != nil {
			return fmt.Errorf("gagal memulai transaksi: %v", err)
		}

		// Ambil data penjualan yang akan dihapus
		var existingSales domain.Penjualan
		err := penjualanProduk.FindOne(sc, bson.M{"id_penjualan": id}).Decode(&existingSales)
		if err != nil {
			if err == mongo.ErrNoDocuments {
				return fmt.Errorf("penjualan dengan ID %s tidak ditemukan", id)
			}
			return fmt.Errorf("gagal mengambil data penjualan: %v", err)
		}

		// Kembalikan stok produk
		for _, item := range existingSales.Produk {
			err := rp.RepoProduk.IncreaseProdukStock(sc, item.IDProduk, item.Quantity)
			if err != nil {
				return fmt.Errorf("gagal mengembalikan stok produk %s: %v", item.IDProduk, err)
			}
		}

		// Hapus penjualan
		_, err = penjualanProduk.DeleteOne(sc, bson.M{"id_penjualan": id})
		if err != nil {
			return fmt.Errorf("gagal menghapus penjualan: %v", err)
		}

		return sesi.CommitTransaction(sc)
	})

	return err
}
