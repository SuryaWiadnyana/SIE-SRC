package repository_test

import (
	"context"
	"testing"
	"time"

	"SIE-SRC/domain"
	"SIE-SRC/services/repository"

	"github.com/stretchr/testify/assert"
	"go.mongodb.org/mongo-driver/bson"
	"go.mongodb.org/mongo-driver/mongo"
	"go.mongodb.org/mongo-driver/mongo/options"
	"go.mongodb.org/mongo-driver/mongo/readpref"
)

func setupTestDB(t *testing.T) (*mongo.Database, func()) {
	uri := "mongodb+srv://SIE-SRC:hebI5AnhguRxKFIk@sie-src-environtment.01asg.mongodb.net/"

	ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
	defer cancel()

	client, err := mongo.Connect(ctx, options.Client().ApplyURI(uri))
	if err != nil {
		t.Fatalf("Failed to connect to MongoDB: %v", err)
	}

	err = client.Ping(ctx, readpref.Primary())
	if err != nil {
		t.Fatalf("Failed to ping MongoDB: %v", err)
	}

	db := client.Database("test_db")

	return db, func() {
	}
}

func cleanupCollection(ctx context.Context, db *mongo.Database, collectionName string) {
	collection := db.Collection(collectionName)
	_, err := collection.DeleteMany(ctx, bson.M{})
	if err != nil {
		panic(err)
	}
}

func TestMongoRepoPenjualan_CreateBulk(t *testing.T) {
	db, cleanup := setupTestDB(t)
	defer cleanup()

	repo := repository.NewMongoRepoPenjualan(db)

	sales := []domain.Penjualan{
		{IDPenjualan: "12345", NamaProduk: "Produk Test 1", JumlahProduk: 10, Total: 100000, UpdatedAt: time.Now()},
		{IDPenjualan: "67890", NamaProduk: "Produk Test 2", JumlahProduk: 20, Total: 200000, UpdatedAt: time.Now()},
	}

	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()

	createdSales, err := repo.CreateBulk(ctx, sales)
	assert.NoError(t, err)
	assert.Equal(t, len(sales), len(createdSales))
	assert.Equal(t, "12345", createdSales[0].IDPenjualan)
	assert.Equal(t, "67890", createdSales[1].IDPenjualan)
}

func TestMongoRepoPenjualan_GetAll(t *testing.T) {
	db, cleanup := setupTestDB(t)
	defer cleanup()

	repo := repository.NewMongoRepoPenjualan(db)

	produk1 := domain.Penjualan{
		IDPenjualan: "12345",
		NamaProduk:  "Produk Test 1",
		JumlahProduk:      10,
		Total:       100000,
	}

	produk2 := domain.Penjualan{
		IDPenjualan: "67890",
		NamaProduk:  "Produk Test 2",
		JumlahProduk:      20,
		Total:       200000,
	}

	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()

	_, err := repo.CreateBulk(ctx, []domain.Penjualan{produk1, produk2})
	assert.NoError(t, err)

	produkList, err := repo.GetAll(ctx)
	assert.NoError(t, err)
	assert.Len(t, produkList, 2)
}

func TestMongoRepoPenjualan_GetByID(t *testing.T) {
	db, cleanup := setupTestDB(t)
	defer cleanup()

	repo := repository.NewMongoRepoPenjualan(db)

	produk := domain.Penjualan{
		IDPenjualan: "12345",
		NamaProduk:  "Produk Test",
		JumlahProduk:      10,
		Total:       100000,
	}

	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()

	_, err := repo.CreateBulk(ctx, []domain.Penjualan{produk})
	assert.NoError(t, err)

	fetchedProduk, err := repo.GetByID(ctx, produk.IDPenjualan)
	assert.NoError(t, err)
	assert.Equal(t, "12345", fetchedProduk.IDPenjualan)
	assert.Equal(t, "Produk Test", fetchedProduk.NamaProduk)
	assert.Equal(t, 10, fetchedProduk.JumlahProduk)
	assert.Equal(t, 100000, fetchedProduk.Total)
}

func TestMongoRepoPenjualan_Update(t *testing.T) {
	db, cleanup := setupTestDB(t)
	defer cleanup()

	ctx := context.Background()
	cleanupCollection(ctx, db, "penjualan")

	repo := repository.NewMongoRepoPenjualan(db)

	produk := domain.Penjualan{
		IDPenjualan: "12345",
		NamaProduk:  "Produk Test",
		JumlahProduk:      10,
		Total:       100000,
	}

	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()

	_, err := repo.CreateBulk(ctx, []domain.Penjualan{produk})
	assert.NoError(t, err)

	produk.NamaProduk = "Produk Test Updated"
	produk.JumlahProduk = 20
	produk.Total = 200000

	err = repo.Update(ctx, &produk)
	assert.NoError(t, err)

	fetchedProduk, err := repo.GetByID(ctx, produk.IDPenjualan)
	assert.NoError(t, err)
	assert.Equal(t, "Produk Test Updated", fetchedProduk.NamaProduk)
	assert.Equal(t, 20, fetchedProduk.JumlahProduk)
	assert.Equal(t, 200000, fetchedProduk.Total)

	cleanupCollection(ctx, db, "penjualan")
}

func TestMongoRepoPenjualan_Delete(t *testing.T) {
	db, cleanup := setupTestDB(t)
	defer cleanup()

	repo := repository.NewMongoRepoPenjualan(db)

	produk := domain.Penjualan{
		IDPenjualan: "12345",
		NamaProduk:  "Produk Test",
		JumlahProduk:      10,
		Total:       100000,
	}

	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()

	_, err := repo.CreateBulk(ctx, []domain.Penjualan{produk})
	assert.NoError(t, err)

	err = repo.Delete(ctx, produk.IDPenjualan)
	assert.NoError(t, err)

	fetchedProduk, err := repo.GetByID(ctx, produk.IDPenjualan)
	assert.Error(t, err)
	assert.Nil(t, fetchedProduk)
}
