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
var Produk domain.Produk

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
	if rp.RepoProduk == nil {
		return nil, fmt.Errorf("produk repository tidak tersedia")
	}

	ListPenjualan := rp.DB.Collection(_Penjualan)

	sesi, err := rp.DB.Client().StartSession()
	if err != nil {
		return nil, fmt.Errorf("gagal memulai sesi: %v", err)
	}
	defer sesi.EndSession(ctx)

	err = mongo.WithSession(ctx, sesi, func(sc mongo.SessionContext) error {
		if err := sesi.StartTransaction(); err != nil {
			return fmt.Errorf("gagal memulai transaksi: %v", err)
		}

		// Generate satu ID untuk semua produk
		nextID, err := rp.GenerateNextID(ctx)
		if err != nil {
			return fmt.Errorf("gagal generate ID: %v", err)
		}

		var totalJumlahProduk int
		var Total int
		var Subtotal int

		// Hitung total dan jumlah produk
		for _, p := range bd {
			if p.User.Username == "" {
				return fmt.Errorf("username tidak boleh kosong")
			}

			totalJumlahProduk += p.JumlahProduk
			Subtotal += p.SubTotal
			Total = Subtotal
		}

		// Parse tanggal dari string ke time.Time
		parsedTime, err := time.Parse("2006-01-02", bd[0].Tanggal_Penjualan.Format("2006-01-02"))
		if err != nil {
			return fmt.Errorf("gagal parse tanggal: %v", err)
		}

		// Buat satu dokumen penjualan untuk semua produk
		penjualanDoc := bson.M{
			"id_penjualan":      nextID,
			"user":              bd[0].User,
			"tanggal_penjualan": parsedTime,
			"jumlah_produk":     totalJumlahProduk,
			"subtotal":          Subtotal,
			"total":             Total,
			"updated_at":        time.Now(),
		}

		// Insert satu dokumen penjualan
		_, err = ListPenjualan.InsertOne(sc, penjualanDoc)
		if err != nil {
			return fmt.Errorf("gagal menyimpan data penjualan: %v", err)
		}

		if err := sesi.CommitTransaction(sc); err != nil {
			return fmt.Errorf("gagal commit transaksi: %v", err)
		}

		// Buat satu hasil penjualan untuk response
		result := domain.Penjualan{
			IDPenjualan:       nextID,
			User:              bd[0].User,
			Tanggal_Penjualan: parsedTime,
			JumlahProduk:      totalJumlahProduk,
			SubTotal:          Subtotal,
			Total:             Total,
			UpdatedAt:         time.Now(),
		}

		// Update bd untuk response
		bd = []domain.Penjualan{result}

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

	return &penjualan, nil
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

		// Hapus penjualan
		_, err = penjualanProduk.DeleteOne(sc, bson.M{"id_penjualan": id})
		if err != nil {
			return fmt.Errorf("gagal menghapus penjualan: %v", err)
		}

		return sesi.CommitTransaction(sc)
	})

	return err
}

// GetLaporanPenjualan retrieves sales report data with filters
func (rp *mongoRepoPenjualan) GetLaporanPenjualan(ctx context.Context, startDate, endDate time.Time, kategoriID, subkategoriID uint, sort string) ([]domain.Penjualan, error) {
	collection := rp.DB.Collection(_Penjualan)

	// Build pipeline stages
	pipeline := []bson.M{
		{
			"$match": bson.M{
				"tanggal_penjualan": bson.M{
					"$gte": startDate,
					"$lte": endDate,
				},
			},
		},
		{
			"$lookup": bson.M{
				"from":         "produk",
				"localField":   "id_produk",
				"foreignField": "id_produk",
				"as":           "produk",
			},
		},
		{
			"$unwind": "$produk",
		},
	}

	// Add kategori filter if provided
	if kategoriID != 0 {
		pipeline = append(pipeline, bson.M{
			"$match": bson.M{
				"produk.kategori.id_kategori": kategoriID,
			},
		})
	}

	// Add subkategori filter if provided
	if subkategoriID != 0 {
		pipeline = append(pipeline, bson.M{
			"$match": bson.M{
				"produk.subkategori.id_subkategori": subkategoriID,
			},
		})
	}

	// Add sort stage
	sortStage := bson.M{
		"$sort": bson.M{},
	}

	if sort != "" {
		switch sort {
		case "tanggal_asc":
			sortStage["$sort"] = bson.M{"tanggal_penjualan": 1}
		case "tanggal_desc":
			sortStage["$sort"] = bson.M{"tanggal_penjualan": -1}
		case "total_asc":
			sortStage["$sort"] = bson.M{"total": 1}
		case "total_desc":
			sortStage["$sort"] = bson.M{"total": -1}
		}
	} else {
		// Default sort by tanggal_penjualan descending
		sortStage["$sort"] = bson.M{"tanggal_penjualan": -1}
	}

	pipeline = append(pipeline, sortStage)

	// Execute pipeline
	cursor, err := collection.Aggregate(ctx, pipeline)
	if err != nil {
		return nil, err
	}
	defer cursor.Close(ctx)

	var penjualanList []domain.Penjualan
	if err = cursor.All(ctx, &penjualanList); err != nil {
		return nil, err
	}

	return penjualanList, nil
}
