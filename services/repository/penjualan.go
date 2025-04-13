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

	// Find all penjualan IDs
	cursor, err := ListPenjualan.Find(ctx, bson.M{}, options.Find().SetProjection(bson.M{"_id": 1}))
	if err != nil {
		return "", fmt.Errorf("error finding penjualan: %v", err)
	}
	defer cursor.Close(ctx)

	// Get all IDs and find the highest number
	highestNum := 0
	for cursor.Next(ctx) {
		var doc struct {
			IDPenjualan string `bson:"_id"`
		}
		if err := cursor.Decode(&doc); err != nil {
			continue
		}
		// Extract number from PJxxx format
		numStr := doc.IDPenjualan[2:] // Skip 'PJ' prefix
		num, err := strconv.Atoi(numStr)
		if err != nil {
			continue
		}
		if num > highestNum {
			highestNum = num
		}
	}

	// If no documents found, start with PJ001
	if highestNum == 0 {
		return "PJ001", nil
	}

	// Generate new ID by incrementing the highest number found
	newID := fmt.Sprintf("PJ%d", highestNum+1)

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
			"_id":      nextID,
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
	ListPenjualan := rp.DB.Collection(_Penjualan)
	var penjualanList []domain.Penjualan

	cursor, err := ListPenjualan.Find(ctx, bson.M{})
	if err != nil {
		log.Printf("Error getting all penjualan: %v", err)
		return nil, fmt.Errorf("error getting all penjualan: %v", err)
	}
	defer cursor.Close(ctx)

	if err = cursor.All(ctx, &penjualanList); err != nil {
		log.Printf("Error decoding penjualan: %v", err)
		return nil, fmt.Errorf("error decoding penjualan: %v", err)
	}

	if penjualanList == nil {
		penjualanList = []domain.Penjualan{} // Return empty slice instead of nil
	}

	return penjualanList, nil
}

// GetByID mendapatkan produk berdasarkan ID.
func (rp *mongoRepoPenjualan) GetByID(ctx context.Context, id string) (*domain.Penjualan, error) {
	penjualanProduk := rp.DB.Collection(_Penjualan)

	var penjualan domain.Penjualan
	err := penjualanProduk.FindOne(ctx, bson.M{"_id": id}).Decode(&penjualan)
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
		err := penjualanProduk.FindOne(sc, bson.M{"_id": id}).Decode(&existingSales)
		if err != nil {
			if err == mongo.ErrNoDocuments {
				return fmt.Errorf("penjualan dengan ID %s tidak ditemukan", id)
			}
			return fmt.Errorf("gagal mengambil data penjualan: %v", err)
		}

		// Hapus penjualan
		_, err = penjualanProduk.DeleteOne(sc, bson.M{"_id": id})
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

	// Ensure index exists for tanggal_penjualan
	_, err := collection.Indexes().CreateOne(
		ctx,
		mongo.IndexModel{
			Keys:    bson.D{{Key: "tanggal_penjualan", Value: 1}},
			Options: options.Index().SetBackground(true),
		},
	)
	if err != nil {
		log.Printf("Warning: Failed to ensure index on tanggal_penjualan: %v", err)
	}

	// Build pipeline stages with optimization
	pipeline := []bson.M{
		{
			"$match": bson.M{
				"tanggal_penjualan": bson.M{
					"$gte": startDate,
					"$lte": endDate,
				},
			},
		},
		// Project only needed fields before lookup
		{
			"$project": bson.M{
				"_id":               1,
				"tanggal_penjualan": 1,
				"jumlah_produk":     1,
				"total":             1,
			},
		},
		{
			"$lookup": bson.M{
				"from":         "produk",
				"localField":   "_id",
				"foreignField": "_id",
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
				"produk.kategori._id": kategoriID,
			},
		})
	}

	// Add subkategori filter if provided
	if subkategoriID != 0 {
		pipeline = append(pipeline, bson.M{
			"$match": bson.M{
				"produk.subkategori._id": subkategoriID,
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

	// Add pagination and limit
	pipeline = append(pipeline, bson.M{
		"$limit": 1000, // Limit to 1000 documents per page
	})

	// Execute pipeline with timeout
	ctx, cancel := context.WithTimeout(ctx, 30*time.Second)
	defer cancel()

	cursor, err := collection.Aggregate(ctx, pipeline, options.Aggregate().SetAllowDiskUse(true))
	if err != nil {
		return nil, fmt.Errorf("aggregate error: %v", err)
	}
	defer cursor.Close(ctx)

	var penjualanList []domain.Penjualan
	if err = cursor.All(ctx, &penjualanList); err != nil {
		return nil, fmt.Errorf("cursor error: %v", err)
	}

	return penjualanList, nil
}
