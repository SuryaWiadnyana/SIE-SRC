package domain

import (
	"context"
)

type DetailPenjualan struct {
	Penjual
	Produk
	ID_DetailPenjualan string `json:"id_details" bson:"id_details"`
	TotalPendapatan    int    `json:"total_pendapatan" bson:"total_pendapatan"`
}

type DetailPenjualanRepository interface {
	CreateDetails(ctx context.Context, bd []DetailPenjualan) ([]DetailPenjualan, error)
	UpdateDetails(ctx context.Context, bd *DetailPenjualan) error
	GetAllDetails(ctx context.Context) ([]DetailPenjualan, error)
	GetByID(ctx context.Context, id string) (*DetailPenjualan, error)
	Delete(ctx context.Context, id string) error
	GenerateNextID(ctx context.Context) (string, error)
}

type DetailPenjualanUseCase interface {
	CreateDetails(ctx context.Context, bd []DetailPenjualan) ([]DetailPenjualan, error)
	UpdateDetails(ctx context.Context, bd *DetailPenjualan) error
	GetAllDetails(ctx context.Context) ([]DetailPenjualan, error)
	GetByID(ctx context.Context, id string) (*DetailPenjualan, error)
	Delete(ctx context.Context, id string) error
}
