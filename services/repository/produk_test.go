package repository_test

import (
	"SIE-SRC/domain"
	"SIE-SRC/services/repository"
	"context"
	"testing"
	"time"

	"github.com/stretchr/testify/assert"
	"go.mongodb.org/mongo-driver/mongo"
	"go.mongodb.org/mongo-driver/mongo/options"
)

var (
	client *mongo.Client
	repo   domain.ProdukRepository
)

func setup() {
	// Menghubungkan ke MongoDB lokal dengan database testdb
	ctx := context.Background()
	client, _ = mongo.Connect(ctx, options.Client().ApplyURI("mongodb+srv://SIE-SRC:hebI5AnhguRxKFIk@sie-src-environtment.01asg.mongodb.net/"))
	db := client.Database("testdb")

	// Menginisialisasi repository produk
	repo = repository.NewMongoRepoProduk(db)
}

func TestCreateProduk(t *testing.T) {
	setup()

	produk := domain.Produk{
		IDProduk:    "1234",
		NamaProduk:  "ProdukTest",
		Kategori:    "KategoriTest",
		SubKategori: "SubKategoriTest",
		Stok:        10,
		KodeProduk:  "0001",
	}

	createdProduk, err := repo.CreateProduk(context.Background(), &produk)
	assert.NoError(t, err)
	assert.Equal(t, produk.IDProduk, createdProduk.IDProduk)
}

func TestGetAllProduk(t *testing.T) {
	setup()

	produk := domain.Produk{
		IDProduk:    "123",
		NamaProduk:  "ProdukTest",
		Kategori:    "KategoriTest",
		SubKategori: "SubKategoriTest",
		Stok:        10,
		KodeProduk:  "0001",
	}
	_, _ = repo.CreateProduk(context.Background(), &produk)

	listProduk, err := repo.GetAllProduk(context.Background())
	assert.NoError(t, err)
	assert.NotEmpty(t, listProduk)
}

func TestGetProdukById(t *testing.T) {
	setup()

	produk := domain.Produk{
		IDProduk:    "123",
		NamaProduk:  "ProdukTest",
		Kategori:    "KategoriTest",
		SubKategori: "SubKategoriTest",
		Stok:        10,
		KodeProduk:  "0001",
	}
	_, _ = repo.CreateProduk(context.Background(), &produk)

	foundProduk, err := repo.GetProdukById(context.Background(), "123")
	assert.NoError(t, err)
	assert.Equal(t, produk.NamaProduk, foundProduk.NamaProduk)
}

func TestGetProdukByName(t *testing.T) {
	setup()

	produk := domain.Produk{
		IDProduk:    "123",
		NamaProduk:  "ProdukTest",
		Kategori:    "KategoriTest",
		SubKategori: "SubKategoriTest",
		Stok:        10,
		KodeProduk:  "0001",
	}
	_, _ = repo.CreateProduk(context.Background(), &produk)

	foundProduk, err := repo.GetProdukByName(context.Background(), "ProdukTest")
	assert.NoError(t, err)
	assert.Equal(t, produk.IDProduk, foundProduk.IDProduk)
}

func TestUpdateProduk(t *testing.T) {
	setup()

	produk := domain.Produk{
		IDProduk:    "123",
		NamaProduk:  "ProdukTest",
		Kategori:    "KategoriTest",
		SubKategori: "SubKategoriTest",
		Stok:        10,
		KodeProduk:  "0001",
	}
	_, _ = repo.CreateProduk(context.Background(), &produk)

	updatedProduk := domain.Produk{
		IDProduk:    "123",
		NamaProduk:  "ProdukUpdated",
		Kategori:    "KategoriTest",
		SubKategori: "SubKategoriTest",
		Stok:        20,
		KodeProduk:  "0001",
	}
	err := repo.UpdateProduk(context.Background(), &updatedProduk)
	assert.NoError(t, err)

	foundProduk, _ := repo.GetProdukById(context.Background(), "123")
	assert.Equal(t, "ProdukUpdated", foundProduk.NamaProduk)
	assert.Equal(t, 20, foundProduk.Stok)
}

func TestDeleteProduk(t *testing.T) {
	setup()

	produk := domain.Produk{
		IDProduk:    "123",
		NamaProduk:  "ProdukTest",
		Kategori:    "KategoriTest",
		SubKategori: "SubKategoriTest",
		Stok:        10,
		KodeProduk:  "0001",
		UpdatedAt:   time.Now(),
	}
	_, err := repo.CreateProduk(context.Background(), &produk)
	assert.NoError(t, err, "expected no error when creating a new product data")

	// Menghapus berdasarkan ID
	err = repo.DeleteProduk(context.Background(), "123")
	assert.NoError(t, err)

	_, err = repo.GetProdukById(context.Background(), "123")
	assert.Error(t, err)

	// Menghapus berdasarkan Nama
	_, err = repo.CreateProduk(context.Background(), &produk) // Recreate for the second deletion test
	assert.NoError(t, err, "expected no error when creating a new product again")
	err = repo.DeleteProduk(context.Background(), "",)
	assert.NoError(t, err, "expected no error when deleting product by name")

	_, err = repo.GetProdukByName(context.Background(), "ProdukTest")
	assert.Error(t, err)
}
