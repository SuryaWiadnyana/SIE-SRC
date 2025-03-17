package repository

import (
	"SIE-SRC/domain"
	"context"
	"fmt"
	"log"
	"strconv"

	"go.mongodb.org/mongo-driver/bson"
	"go.mongodb.org/mongo-driver/mongo"
	"go.mongodb.org/mongo-driver/mongo/options"
)

type mongoRepoSubKategori struct {
	DB *mongo.Database
}

func NewMongoRepoSubKategori(client *mongo.Database) domain.SubKategoriRepository {
	return &mongoRepoSubKategori{
		DB: client,
	}
}

var _SubKategoriCollection = "subkategori"

// GenerateNextID menghasilkan ID subkategori berikutnya
func (rp *mongoRepoSubKategori) GenerateNextID(ctx context.Context) (string, error) {
	collection := rp.DB.Collection(_SubKategoriCollection)

	// Mencari dokumen terakhir diurutkan berdasarkan id_subkategori secara menurun
	opts := options.FindOne().SetSort(bson.M{"id_subkategori": -1})
	var lastSubKategori domain.SubKategori

	err := collection.FindOne(ctx, bson.M{}, opts).Decode(&lastSubKategori)
	if err != nil {
		if err == mongo.ErrNoDocuments {
			// Jika tidak ada dokumen, mulai dengan "SK001"
			return "SK001", nil
		}
		return "", fmt.Errorf("error mencari subkategori terakhir: %v", err)
	}

	// Parse ID terakhir dan tambahkan
	numStr := lastSubKategori.IDSubKategori[2:] // Mengambil angka setelah "SK"
	num, err := strconv.Atoi(numStr)
	if err != nil {
		return "", fmt.Errorf("error parsing ID terakhir: %v", err)
	}

	// Format ID baru dengan padding nol di depan
	newID := fmt.Sprintf("SK%03d", num+1)
	return newID, nil
}

// CreateNewSubKategori membuat subkategori baru
func (rp *mongoRepoSubKategori) CreateNewSubKategori(ctx context.Context, subK *domain.SubKategori) (domain.SubKategori, error) {
	collection := rp.DB.Collection(_SubKategoriCollection)

	// Validasi kategori
	if subK.Kategori == nil || subK.Kategori.IDKategori == "" {
		return domain.SubKategori{}, fmt.Errorf("kategori harus diisi")
	}

	// Cek apakah kategori ada
	kategoriCollection := rp.DB.Collection("kategori")
	var kategori domain.Kategori
	err := kategoriCollection.FindOne(ctx, bson.M{"id_kategori": subK.Kategori.IDKategori}).Decode(&kategori)
	if err != nil {
		if err == mongo.ErrNoDocuments {
			return domain.SubKategori{}, fmt.Errorf("kategori dengan ID %s tidak ditemukan", subK.Kategori.IDKategori)
		}
		return domain.SubKategori{}, fmt.Errorf("error memeriksa kategori: %v", err)
	}

	// Set nama kategori
	subK.Kategori.NamaKategori = kategori.NamaKategori

	// Cek apakah nama subkategori sudah ada dalam kategori yang sama
	var existingSubKategori domain.SubKategori
	err = collection.FindOne(ctx, bson.M{
		"nama_subkategori":     subK.NamaSubKategori,
		"kategori.id_kategori": subK.Kategori.IDKategori,
	}).Decode(&existingSubKategori)
	if err == nil {
		return domain.SubKategori{}, fmt.Errorf("subkategori dengan nama %s sudah ada dalam kategori ini", subK.NamaSubKategori)
	} else if err != mongo.ErrNoDocuments {
		return domain.SubKategori{}, fmt.Errorf("error saat memeriksa subkategori: %v", err)
	}

	// Generate ID jika kosong
	if subK.IDSubKategori == "" {
		nextID, err := rp.GenerateNextID(ctx)
		if err != nil {
			return domain.SubKategori{}, fmt.Errorf("gagal generate ID: %v", err)
		}
		subK.IDSubKategori = nextID
	}

	// Insert subkategori baru
	_, err = collection.InsertOne(ctx, subK)
	if err != nil {
		log.Printf("Gagal menyimpan subkategori: %v", err)
		return domain.SubKategori{}, fmt.Errorf("gagal menyimpan subkategori: %v", err)
	}

	return *subK, nil
}

// GetAll mendapatkan semua subkategori
func (rp *mongoRepoSubKategori) GetAll(ctx context.Context) ([]domain.SubKategori, error) {
	collection := rp.DB.Collection(_SubKategoriCollection)

	cursor, err := collection.Find(ctx, bson.M{})
	if err != nil {
		return nil, fmt.Errorf("error mendapatkan subkategori: %v", err)
	}
	defer cursor.Close(ctx)

	var subKategoris []domain.SubKategori
	if err := cursor.All(ctx, &subKategoris); err != nil {
		return nil, fmt.Errorf("error decoding subkategori: %v", err)
	}

	return subKategoris, nil
}

// GetByID mendapatkan subkategori berdasarkan ID
func (rp *mongoRepoSubKategori) GetByID(ctx context.Context, id string) (*domain.SubKategori, error) {
	collection := rp.DB.Collection(_SubKategoriCollection)

	var subKategori domain.SubKategori
	err := collection.FindOne(ctx, bson.M{"id_subkategori": id}).Decode(&subKategori)
	if err != nil {
		if err == mongo.ErrNoDocuments {
			return nil, fmt.Errorf("subkategori dengan ID %s tidak ditemukan", id)
		}
		return nil, fmt.Errorf("error mendapatkan subkategori: %v", err)
	}

	return &subKategori, nil
}

// Delete menghapus subkategori berdasarkan ID
func (rp *mongoRepoSubKategori) Delete(ctx context.Context, id string) error {
	collection := rp.DB.Collection(_SubKategoriCollection)

	// Periksa apakah subkategori digunakan oleh produk
	produkCollection := rp.DB.Collection("produk")
	count, err := produkCollection.CountDocuments(ctx, bson.M{"sub_kategori": id})
	if err != nil {
		return fmt.Errorf("error memeriksa penggunaan subkategori: %v", err)
	}
	if count > 0 {
		return fmt.Errorf("subkategori tidak dapat dihapus karena masih digunakan oleh %d produk", count)
	}

	result, err := collection.DeleteOne(ctx, bson.M{"id_subkategori": id})
	if err != nil {
		return fmt.Errorf("error menghapus subkategori: %v", err)
	}

	if result.DeletedCount == 0 {
		return fmt.Errorf("subkategori dengan ID %s tidak ditemukan", id)
	}

	return nil
}

// Update memperbarui subkategori berdasarkan ID
func (rp *mongoRepoSubKategori) UpdateSubKategori(ctx context.Context, subK *domain.SubKategori) error {
	collection := rp.DB.Collection(_SubKategoriCollection)

	// Periksa apakah subkategori dengan ID tersebut ada
	existingSubKategori, err := rp.GetByID(ctx, subK.IDSubKategori)
	if err != nil {
		return fmt.Errorf("sub kategori dengan ID %s tidak ditemukan", subK.IDSubKategori)
	}

	// Perbarui subkategori
	filter := bson.M{"id_subkategori": subK.IDSubKategori}
	update := bson.M{
		"$set": bson.M{
			"nama_subkategori": subK.NamaSubKategori,
			"kategori":         subK.Kategori,
		},
	}

	result, err := collection.UpdateOne(ctx, filter, update)
	if err != nil {
		return fmt.Errorf("gagal memperbarui sub kategori: %v", err)
	}

	if result.MatchedCount == 0 {
		return fmt.Errorf("sub kategori dengan ID %s tidak ditemukan", subK.IDSubKategori)
	}

	log.Printf("Sub kategori dengan ID %s berhasil diperbarui", existingSubKategori.IDSubKategori)
	return nil
}

// GetByKategoriID mendapatkan subkategori berdasarkan ID kategori
func (rp *mongoRepoSubKategori) GetByKategoriID(ctx context.Context, kategoriID string) ([]domain.SubKategori, error) {
	collection := rp.DB.Collection(_SubKategoriCollection)
	filter := bson.M{"kategori.id_kategori": kategoriID}
	
	cursor, err := collection.Find(ctx, filter)
	if err != nil {
		return nil, err
	}
	defer cursor.Close(ctx)
	
	var subkategoriList []domain.SubKategori
	if err = cursor.All(ctx, &subkategoriList); err != nil {
		return nil, err
	}
	
	return subkategoriList, nil
}
