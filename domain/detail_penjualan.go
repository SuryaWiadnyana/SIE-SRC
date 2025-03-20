package domain

import (
	"context"
	"time"
)

type DetailPenjualan struct {
	ID_DetailPenjualan string    `json:"id_details" bson:"id_details"`
	Penjualan          Penjualan `json:"penjualan" bson:"penjualan"`
	Produk             []Produk  `json:"produk" bson:"produk"`
	TotalPendapatan    int       `json:"total_pendapatan" bson:"total_pendapatan"`
}

type ResponseSalesReportItem struct {
	TanggalPenjualan time.Time          `json:"tanggal_penjualan"`
	KodeProduk       string             `json:"kode_produk"`
	NamaProduk       string             `json:"nama_produk"`
	Kategori         Kategori           `json:"kategori"`
	SubKategori      SubKategori        `json:"subkategori"`
	JumlahProduk     int                `json:"jumlah_produk"`
	Total            int                `json:"total"`
}

type CategoryStats struct {
	KategoriNama   string  `json:"nama_kategori"`
	TotalPenjualan float64 `json:"total_penjualan"`
	JumlahProduk   int     `json:"jumlah_produk"`
}

type DetailPenjualanRepository interface {
	CreateDetails(ctx context.Context, bd *DetailPenjualan) (*DetailPenjualan, error)
	GetAll(ctx context.Context) ([]DetailPenjualan, error)
	GetByID(ctx context.Context, id string) (*DetailPenjualan, error)
	GetByPenjualanID(ctx context.Context, idPenjualan string) ([]DetailPenjualan, error)
	Delete(ctx context.Context, id string) error
	GenerateNextID(ctx context.Context) (string, error)
}

type DetailPenjualanUseCase interface {
	CreateDetails(ctx context.Context, bd *DetailPenjualan) (*DetailPenjualan, error)
	GetAll(ctx context.Context) ([]DetailPenjualan, error)
	GetByID(ctx context.Context, id string) (*DetailPenjualan, error)
	GetByPenjualanID(ctx context.Context, idPenjualan string) ([]DetailPenjualan, error)
	Delete(ctx context.Context, id string) error
}
