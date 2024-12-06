package domain

import (
	"context"
	"time"
)

type Produk struct {
	IDProduk    string     `json:"id_produk" bson:"_id"`
	NamaProduk  string     `json:"nama_produk" bson:"nama_produk"`
	Kategori    string     `json:"kategori" bson:"kategori"`
	SubKategori string     `json:"sub_kategori" bson:"sub_kategori"`
	KodeProduk  string     `json:"barcode_produk" bson:"barcode_produk"`
	Harga       int        `json:"harga" bson:"harga"`
	Stok        int        `json:"stok_barang" bson:"stok_barang"`
	UpdatedAt   time.Time  `json:"updated_at" bson:"updated_at"`
	IsDeleted   *time.Time `json:"is_deleted" bson:"is_deleted"`
}

type ProdukRepository interface {
	CreateProduk(ctx context.Context, bd *Produk) (Produk, error)
	GetAllProduk(ctx context.Context) ([]Produk, error)
	GetProdukById(ctx context.Context, id string) (*Produk, error)
	GetProdukByName(ctx context.Context, nama string) (*Produk, error)
	UpdateProduk(ctx context.Context, bd *Produk) error
	DeleteProduk(ctx context.Context, id string) error
	DecreaseProdukStock(ctx context.Context, id string, quantity int) error
	IncreaseProdukStock(ctx context.Context, id string, quantity int) error
	ImportData(ctx context.Context, produkList []Produk) error
	GenerateNextID(ctx context.Context) (string, error)  // Tambah fungsi baru
}

type ProdukUseCase interface {
	CreateProduk(ctx context.Context, bd *Produk) (Produk, error)
	GetAllProduk(ctx context.Context) ([]Produk, error)
	GetProdukById(ctx context.Context, id string) (*Produk, error)
	GetProdukByName(ctx context.Context, nama string) (*Produk, error)
	UpdateProduk(ctx context.Context, bd *Produk) error
	DeleteProduk(ctx context.Context, id string) error
	ImportData(ctx context.Context, produkList []Produk) error
}
