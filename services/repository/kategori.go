package repository

import (
	"SIE-SRC/domain"
	"context"
	"fmt"
	"log"
	"strconv"
	"strings"

	"go.mongodb.org/mongo-driver/bson"
	"go.mongodb.org/mongo-driver/mongo"
	"go.mongodb.org/mongo-driver/mongo/options"
)

type mongoRepoKategori struct {
	DB *mongo.Database
}

func NewMongoRepoKategori(client *mongo.Database) domain.KategoriRepository {
	return &mongoRepoKategori{
		DB: client,
	}
}

var _KategoriCollection = "kategori"

// GenerateNextID menghasilkan ID kategori berikutnya
func (rp *mongoRepoKategori) GenerateNextID(ctx context.Context) (string, error) {
	collection := rp.DB.Collection(_KategoriCollection)

	// Mencari dokumen terakhir diurutkan berdasarkan id_kategori secara menurun
	opts := options.FindOne().SetSort(bson.M{"id_kategori": -1})
	var lastKategori domain.Kategori

	err := collection.FindOne(ctx, bson.M{}, opts).Decode(&lastKategori)
	if err != nil {
		if err == mongo.ErrNoDocuments {
			// Jika tidak ada dokumen, mulai dengan "KT001"
			return "KT001", nil
		}
		return "", fmt.Errorf("error mencari kategori terakhir: %v", err)
	}

	// Parse ID terakhir dan tambahkan
	numStr := lastKategori.IDKategori[2:] // Mengambil angka setelah "KT"
	num, err := strconv.Atoi(numStr)
	if err != nil {
		return "", fmt.Errorf("error parsing ID terakhir: %v", err)
	}

	// Format ID baru dengan padding nol di depan
	newID := fmt.Sprintf("KT%03d", num+1)
	return newID, nil
}

// CreateNewKategori membuat kategori baru
func (rp *mongoRepoKategori) CreateNewKategori(ctx context.Context, k *domain.Kategori) (domain.Kategori, error) {
	collection := rp.DB.Collection(_KategoriCollection)

	// Cek apakah nama kategori sudah ada (case insensitive)
	// Dapatkan semua kategori terlebih dahulu
	cursor, err := collection.Find(ctx, bson.M{})
	if err != nil {
		return domain.Kategori{}, fmt.Errorf("error saat mencari kategori: %v", err)
	}
	defer cursor.Close(ctx)

	var kategoris []domain.Kategori
	if err := cursor.All(ctx, &kategoris); err != nil {
		return domain.Kategori{}, fmt.Errorf("error saat mendecode kategori: %v", err)
	}

	// Cek secara manual apakah nama kategori sudah ada (case insensitive)
	namaKategoriLower := strings.ToLower(k.NamaKategori)
	for _, existingKategori := range kategoris {
		if strings.ToLower(existingKategori.NamaKategori) == namaKategoriLower {
			return domain.Kategori{}, fmt.Errorf("kategori dengan nama %s sudah ada", k.NamaKategori)
		}
	}

	// Generate ID jika kosong
	if k.IDKategori == "" {
		nextID, err := rp.GenerateNextID(ctx)
		if err != nil {
			return domain.Kategori{}, fmt.Errorf("gagal generate ID: %v", err)
		}
		k.IDKategori = nextID
	}

	// Insert kategori baru
	_, err = collection.InsertOne(ctx, k)
	if err != nil {
		log.Printf("Gagal menyimpan kategori: %v", err)
		return domain.Kategori{}, fmt.Errorf("gagal menyimpan kategori: %v", err)
	}

	return *k, nil
}

// GetAll mendapatkan semua kategori
func (rp *mongoRepoKategori) GetAll(ctx context.Context) ([]domain.Kategori, error) {
	collection := rp.DB.Collection(_KategoriCollection)

	cursor, err := collection.Find(ctx, bson.M{})
	if err != nil {
		return nil, fmt.Errorf("error mendapatkan kategori: %v", err)
	}
	defer cursor.Close(ctx)

	var kategoris []domain.Kategori
	if err := cursor.All(ctx, &kategoris); err != nil {
		return nil, fmt.Errorf("error decoding kategori: %v", err)
	}

	return kategoris, nil
}

// GetByID mendapatkan kategori berdasarkan ID
func (rp *mongoRepoKategori) GetByID(ctx context.Context, id string) (*domain.Kategori, error) {
	collection := rp.DB.Collection(_KategoriCollection)

	var kategori domain.Kategori
	err := collection.FindOne(ctx, bson.M{"id_kategori": id}).Decode(&kategori)
	if err != nil {
		if err == mongo.ErrNoDocuments {
			return nil, fmt.Errorf("kategori dengan ID %s tidak ditemukan", id)
		}
		return nil, fmt.Errorf("error mendapatkan kategori: %v", err)
	}

	return &kategori, nil
}

// Delete menghapus kategori berdasarkan ID
func (rp *mongoRepoKategori) Delete(ctx context.Context, id string) error {
	collection := rp.DB.Collection(_KategoriCollection)

	// Periksa apakah kategori digunakan oleh produk
	produkCollection := rp.DB.Collection("produk")
	count, err := produkCollection.CountDocuments(ctx, bson.M{"kategori": id})
	if err != nil {
		return fmt.Errorf("error memeriksa penggunaan kategori: %v", err)
	}
	if count > 0 {
		return fmt.Errorf("kategori tidak dapat dihapus karena masih digunakan oleh %d produk", count)
	}

	// Hapus semua subkategori yang terkait dengan kategori ini
	subKategoriRepo := NewMongoRepoSubKategori(rp.DB)
	err = subKategoriRepo.DeleteByKategoriID(ctx, id)
	if err != nil {
		return fmt.Errorf("error menghapus subkategori: %v", err)
	}

	// Hapus kategori
	result, err := collection.DeleteOne(ctx, bson.M{"id_kategori": id})
	if err != nil {
		return fmt.Errorf("error menghapus kategori: %v", err)
	}

	if result.DeletedCount == 0 {
		return fmt.Errorf("kategori dengan ID %s tidak ditemukan", id)
	}

	return nil
}

// Update memperbarui kategori berdasarkan ID
func (rp *mongoRepoKategori) Update(ctx context.Context, k *domain.Kategori) error {
	collection := rp.DB.Collection(_KategoriCollection)

	// Periksa apakah kategori dengan ID tersebut ada
	existingKategori, err := rp.GetByID(ctx, k.IDKategori)
	if err != nil {
		return fmt.Errorf("kategori dengan ID %s tidak ditemukan", k.IDKategori)
	}

	// Cek apakah nama kategori baru sudah digunakan oleh kategori lain
	if k.NamaKategori != existingKategori.NamaKategori {
		// Dapatkan semua kategori terlebih dahulu
		cursor, err := collection.Find(ctx, bson.M{})
		if err != nil {
			return fmt.Errorf("error saat mencari kategori: %v", err)
		}
		defer cursor.Close(ctx)

		var kategoris []domain.Kategori
		if err := cursor.All(ctx, &kategoris); err != nil {
			return fmt.Errorf("error saat mendecode kategori: %v", err)
		}

		// Cek secara manual apakah nama kategori sudah ada (case insensitive)
		namaKategoriLower := strings.ToLower(k.NamaKategori)
		for _, otherKategori := range kategoris {
			if otherKategori.IDKategori != k.IDKategori && // bukan kategori yang sedang diupdate
				strings.ToLower(otherKategori.NamaKategori) == namaKategoriLower {
				return fmt.Errorf("kategori dengan nama %s sudah ada", k.NamaKategori)
			}
		}
	}

	// Perbarui kategori
	filter := bson.M{"id_kategori": k.IDKategori}
	update := bson.M{
		"$set": bson.M{
			"nama_kategori": k.NamaKategori,
		},
	}

	result, err := collection.UpdateOne(ctx, filter, update)
	if err != nil {
		return fmt.Errorf("gagal memperbarui kategori: %v", err)
	}

	if result.MatchedCount == 0 {
		return fmt.Errorf("kategori dengan ID %s tidak ditemukan", k.IDKategori)
	}

	log.Printf("Kategori dengan ID %s berhasil diperbarui", existingKategori.IDKategori)
	return nil
}
