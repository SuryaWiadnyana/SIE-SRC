package domain

import (
	"context"
)

type DetailPenjualan struct {
	ID_DetailPenjualan string    `json:"id_details" bson:"id_details"`
	Penjualan          Penjualan `json:"penjualan" bson:"penjualan"`
	Produk             Produk    `json:"produk" bson:"produk"`
	TotalPendapatan    int       `json:"total_pendapatan" bson:"total_pendapatan"`
}

type DetailPenjualanRepository interface {
	CreateDetails(ctx context.Context, dp *DetailPenjualan) (*DetailPenjualan, error)
	UpdateDetails(ctx context.Context, dp *DetailPenjualan) error
	GetAllDetails(ctx context.Context) ([]DetailPenjualan, error)
	GetByID(ctx context.Context, id string) (*DetailPenjualan, error)
	Delete(ctx context.Context, id string) error
	GenerateNextID(ctx context.Context) (string, error)
}

type DetailPenjualanUseCase interface {
	CreateDetails(ctx context.Context, dp *DetailPenjualan) (*DetailPenjualan, error)
	UpdateDetails(ctx context.Context, dp *DetailPenjualan) error
	GetAllDetails(ctx context.Context) ([]DetailPenjualan, error)
	GetByID(ctx context.Context, id string) (*DetailPenjualan, error)
	Delete(ctx context.Context, id string) error
}
