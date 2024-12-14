package domain

import (
	"context"
	"time"
)

type Penjual struct {
	NamaPenjual string    `json:"nama_penjual" bson:"nama_penjual"`
	Tanggal     time.Time `json:"tanggal" bson:"tanggal" `
}

type ProdukJual struct {
	IDProduk     string `json:"id_produk" bson:"id_produk"`
	NamaProduk   string `json:"nama_produk" bson:"nama_produk"`
	JumlahProduk int    `json:"jumlah_produk" bson:"jumlah_produk"`
	Harga        int    `json:"harga" bson:"harga"`
	Subtotal     int    `json:"subtotal" bson:"subtotal"`
}

type Penjualan struct {
	Penjual
	Produk      []ProdukJual `json:"produk" bson:"produk"`
	IDPenjualan string       `json:"id_penjualan" bson:"id_penjualan"`
	Total       int          `json:"total" bson:"total"`
	UpdatedAt   time.Time    `json:"updated_at" bson:"updated_at"`
}

type PenjualanRepository interface {
	CreateBulk(Ctx context.Context, bd []Penjualan) ([]Penjualan, error)
	Update(Ctx context.Context, bd *Penjualan) error
	GetAll(Ctx context.Context) ([]Penjualan, error)
	GetByID(Ctx context.Context, id string) (*Penjualan, error)
	Delete(Ctx context.Context, id string) error
	GenerateNextID(ctx context.Context) (string, error)
}

type PenjualanUseCase interface {
	CreateBulk(Ctx context.Context, bd []Penjualan) ([]Penjualan, error)
	Update(Ctx context.Context, bd *Penjualan) error
	GetAll(Ctx context.Context) ([]Penjualan, error)
	GetByID(Ctx context.Context, id string) (*Penjualan, error)
	Delete(Ctx context.Context, id string) error
}
