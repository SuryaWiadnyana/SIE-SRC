package domain

import (
	"context"
	"time"
)

type Produk struct {
	IDProduk          string                   `json:"id_produk" bson:"_id"`
	NamaProduk        string                   `json:"nama_produk" bson:"nama_produk"`
	Kategori          Kategori                 `json:"kategori" bson:"kategori"`
	SubKategori       SubKategori              `json:"subkategori" bson:"subkategori"`
	KodeProduk        string                   `json:"kode_produk" bson:"kode_produk"`
	HargaProduk       int                      `json:"harga_produk" bson:"harga_produk"`
	TanggalKedaluwarsa time.Time               `json:"tanggal_kedaluwarsa" bson:"tanggal_kedaluwarsa"`
	Stok              int                      `json:"stok_barang" bson:"stok_barang"`
	UpdatedAt         time.Time                `json:"updated_at" bson:"updated_at"`
	IsDeleted         *time.Time               `json:"is_deleted" bson:"is_deleted"`
}

type FrequentItemsetResponse struct {
	Produk     []string `json:"produk"`
	Support    float64  `json:"support"`
	Confidence float64  `json:"confidence"`
	ProdukList []string `json:"list_produk"`
	ProdukTerkait     []map[string]interface{} `json:"produk_terkait,omitempty" bson:"-"`
}

type ProdukExpiryResponse struct {
	Produk          Produk `json:"produk"`
	IsExpired       bool   `json:"is_expired"`
	DaysUntilExpiry int    `json:"days_until_expiry"`
}

type ProdukRepository interface {
	CreateProduk(ctx context.Context, bd *Produk) (Produk, error)
	GetAllProduk(ctx context.Context) ([]Produk, error)
	GetProdukById(ctx context.Context, id string) (*Produk, error)
	GetProdukByName(ctx context.Context, nama string) (*Produk, error)
	UpdateProduk(ctx context.Context, bd *Produk) error
	DeleteProduk(ctx context.Context, id string) error
	DecreaseProdukStock(ctx context.Context, id string, kuantitas int) error
	IncreaseProdukStock(ctx context.Context, id string, kuantitas int) error
	ImportData(ctx context.Context, produkList []Produk) error
	GenerateNextID(ctx context.Context) (string, error)
	GetFrequentItemsets(ctx context.Context, minSupport float64) ([]FrequentItemsetResponse, error)
	GetBestSellingProducts(ctx context.Context, limitProduk int) ([]map[string]interface{}, error)
	GetProdukWithLowestStock(ctx context.Context, limit int) ([]Produk, error)
	GetLaporanProduk(ctx context.Context, kategoriID, subkategoriID string, sort string) ([]Produk, error)
}

type ProdukUseCase interface {
	CreateProduk(ctx context.Context, bd *Produk) (Produk, error)
	GetAllProduk(ctx context.Context) ([]Produk, error)
	GetProdukById(ctx context.Context, id string) (*Produk, error)
	GetProdukByName(ctx context.Context, nama string) (*Produk, error)
	UpdateProduk(ctx context.Context, bd *Produk) error
	DeleteProduk(ctx context.Context, id string) error
	DecreaseProdukStock(ctx context.Context, id string, kuantitas int) error
	IncreaseProdukStock(ctx context.Context, id string, kuantitas int) error
	ImportData(ctx context.Context, produkList []Produk) error
	GenerateNextID(ctx context.Context) (string, error)
	GetFrequentItemsets(ctx context.Context, minSupport float64) ([]FrequentItemsetResponse, error)
	GetBestSellingProducts(ctx context.Context, limitProduk int) ([]map[string]interface{}, error)
	GetProdukWithLowestStock(ctx context.Context, limit int) ([]Produk, error)
	GetProductsNearExpiry(ctx context.Context, daysThreshold int) ([]ProdukExpiryResponse, error)
	GetLaporanProduk(ctx context.Context, kategoriID, subkategoriID string, sort string) ([]Produk, error)
}
