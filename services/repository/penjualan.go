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

type mongoRepoPenjualan struct {
	DB         *mongo.Database
	RepoProduk domain.ProdukRepository
}

func NewMongoRepoPenjualan(client *mongo.Database, produkRepo domain.ProdukRepository) domain.PenjualanRepository {
	return &mongoRepoPenjualan{
		DB:         client,
		RepoProduk: produkRepo,
	}
}

var _Penjualan = "penjualan"

// Generates the next available ID
func (rp *mongoRepoPenjualan) GenerateNextID(ctx context.Context) (string, error) {
	ListPenjualan := rp.DB.Collection(_Penjualan)

	opts := options.FindOne().SetSort(bson.M{"id_penjualan": -1})
	var lastPenjualan domain.Penjualan

	err := ListPenjualan.FindOne(ctx, bson.M{}, opts).Decode(&lastPenjualan)
	if err != nil {
		if err == mongo.ErrNoDocuments {
			return "PJ001", nil
		}
		return "", fmt.Errorf("error finding last penjualan: %v", err)
	}

	numStr := lastPenjualan.IDPenjualan[2:]
	num, err := strconv.Atoi(numStr)
	if err != nil {
		return "", fmt.Errorf("error parsing last ID number: %v", err)
	}

	newID := fmt.Sprintf("PJ%03d", num+1)
	return newID, nil
}

// Create menambahkan Penjualan baru ke dalam koleksi.
func (rp *mongoRepoPenjualan) CreateBulk(ctx context.Context, bd []domain.Penjualan) ([]domain.Penjualan, error) {
	ListPenjualan := rp.DB.Collection(_Penjualan)
	var PenjualanDocs []interface{}

	sesi, err := rp.DB.Client().StartSession()
	if err != nil {
		return nil, fmt.Errorf("gagal memulai sesi: %v", err)
	}
	defer sesi.EndSession(ctx)

	err = mongo.WithSession(ctx, sesi, func(sc mongo.SessionContext) error {
		if err := sesi.StartTransaction(); err != nil {
			return fmt.Errorf("gagal memulai transaksi: %v", err)
		}

		for i := range bd {
			if bd[i].IDPenjualan == "" {
				nextID, err := rp.GenerateNextID(ctx)
				if err != nil {
					return fmt.Errorf("gagal generate ID: %v", err)
				}
				bd[i].IDPenjualan = nextID
			}

			if bd[i].NamaPenjual == "" {
				return fmt.Errorf("nama penjual tidak boleh kosong pada data ke-%d", i+1)
			}

			if len(bd[i].Produk) == 0 {
				return fmt.Errorf("minimal harus ada satu produk pada data ke-%d", i+1)
			}

			total := 0
			for j, item := range bd[i].Produk {
				if item.IDProduk == "" {
					return fmt.Errorf("id produk tidak boleh kosong pada produk ke-%d, data ke-%d", j+1, i+1)
				}

				if item.JumlahProduk <= 0 {
					return fmt.Errorf("jumlah produk harus lebih dari 0 pada produk ke-%d, data ke-%d", j+1, i+1)
				}

				produk, err := rp.RepoProduk.GetProdukById(sc, item.IDProduk)
				if err != nil {
					return fmt.Errorf("gagal mendapatkan info produk: %v", err)
				}

				if produk.Stok < item.JumlahProduk {
					return fmt.Errorf("stok tidak mencukupi untuk produk %s (tersedia: %d, diminta: %d)",
						produk.NamaProduk, produk.Stok, item.JumlahProduk)
				}

				err = rp.RepoProduk.DecreaseProdukStock(sc, item.IDProduk, item.JumlahProduk)
				if err != nil {
					return fmt.Errorf("gagal mengurangi stok: %v", err)
				}

				bd[i].Produk[j].Harga = produk.Harga
				bd[i].Produk[j].Subtotal = produk.Harga * item.JumlahProduk
				total += bd[i].Produk[j].Subtotal
			}

			bd[i].Total = total
			bd[i].UpdatedAt = time.Now()
			if bd[i].Tanggal.IsZero() {
				bd[i].Tanggal = time.Now()
			}

			PenjualanDocs = append(PenjualanDocs, bd[i])
		}

		_, err := ListPenjualan.InsertMany(sc, PenjualanDocs)
		if err != nil {
			return fmt.Errorf("gagal menyimpan data penjualan: %v", err)
		}

		if err := sesi.CommitTransaction(sc); err != nil {
			return fmt.Errorf("gagal commit transaksi: %v", err)
		}

		return nil
	})

	if err != nil {
		abortErr := sesi.AbortTransaction(ctx)
		if abortErr != nil {
			log.Printf("Error saat abort transaksi: %v", abortErr)
		}
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

	var penjualan domain.Penjualan
	err := penjualanProduk.FindOne(ctx, bson.M{"id_penjualan": id}).Decode(&penjualan)
	if err != nil {
		if err == mongo.ErrNoDocuments {
			return nil, fmt.Errorf("penjualan dengan ID %s tidak ditemukan", id)
		}
		return nil, fmt.Errorf("gagal mengambil data penjualan: %v", err)
	}

	// Log jumlah produk yang diambil
	log.Printf("Jumlah produk yang diambil: %d", len(penjualan.Produk))

	return &penjualan, nil
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
			err := rp.RepoProduk.IncreaseProdukStock(sc, item.IDProduk, item.JumlahProduk)
			if err != nil {
				return fmt.Errorf("gagal mengembalikan stok produk %s: %v", item.IDProduk, err)
			}
		}

		// Validasi dan update stok baru
		total := 0
		for _, item := range bd.Produk {
			if item.JumlahProduk <= 0 {
				return fmt.Errorf("kuantitas produk harus lebih dari 0")
			}

			produk, err := rp.RepoProduk.GetProdukById(sc, item.IDProduk)
			if err != nil {
				return fmt.Errorf("gagal mendapatkan info produk %s: %v", item.IDProduk, err)
			}

			if produk.Stok < item.JumlahProduk {
				return fmt.Errorf("stok produk %s tidak mencukupi (tersedia: %d, diminta: %d)",
					produk.NamaProduk, produk.Stok, item.JumlahProduk)
			}

			err = rp.RepoProduk.DecreaseProdukStock(sc, item.IDProduk, item.JumlahProduk)
			if err != nil {
				return fmt.Errorf("gagal mengurangi stok produk %s: %v", item.IDProduk, err)
			}

			total += produk.Harga * item.JumlahProduk
		}

		// Update penjualan
		bd.UpdatedAt = time.Now()
		bd.Total = total

		update := bson.M{
			"$set": bson.M{
				"nama_penjual": bd.NamaPenjual,
				"tanggal":      bd.Tanggal,
				"produk":       bd.Produk,
				"total":        bd.Total,
				"updated_at":   bd.UpdatedAt,
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
			err := rp.RepoProduk.IncreaseProdukStock(sc, item.IDProduk, item.JumlahProduk)
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
