package domain

import (
	"context"
	"time"
)

type Penjualan struct {
	IDPenjualan string `json:"id_penjualan" bson:"id_penjualan"`
	User        User   `json:"user" bson:"user"`
	// Produk            []Produk  `json:"produk" bson:"produk"`
	Tanggal_Penjualan time.Time `json:"tanggal_penjualan" bson:"tanggal_penjualan"`
	JumlahProduk      int       `json:"jumlah_produk" bson:"jumlah_produk"`
	SubTotal          int       `json:"subtotal" bson:"subtotal"`
	Total             int       `json:"total" bson:"total"`
	UpdatedAt         time.Time `json:"updated_at" bson:"updated_at"`
}

type PenjualanRepository interface {
	CreateBulk(ctx context.Context, p []Penjualan) ([]Penjualan, error)
	GetAll(ctx context.Context) ([]Penjualan, error)
	GetByID(ctx context.Context, id string) (*Penjualan, error)
	Delete(ctx context.Context, id string) error
	GenerateNextID(ctx context.Context) (string, error)
	GetLaporanPenjualan(ctx context.Context, startDate, endDate time.Time, kategoriID, subkategoriID uint, sort string) ([]Penjualan, error)
}

type PenjualanUseCase interface {
	CreateBulk(ctx context.Context, p []Penjualan) ([]Penjualan, error)
	GetAll(ctx context.Context) ([]Penjualan, error)
	GetByID(ctx context.Context, id string) (*Penjualan, error)
	Delete(ctx context.Context, id string) error
	GetLaporanPenjualan(ctx context.Context, startDate, endDate time.Time, kategoriID, subkategoriID uint, sort string) ([]Penjualan, error)
}
