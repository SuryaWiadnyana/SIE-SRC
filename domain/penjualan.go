package domain

import (
	"context"
	"time"
)

type Penjual struct {
	IDUser            string    `json:"id_user" bson:"id_user"`
	NamaPenjual       string    `json:"nama_penjual" bson:"nama_penjual"`
	Tanggal_Penjualan time.Time `json:"tanggal_penjualan" bson:"tanggal_penjualan" `
}

type Penjualan struct {
	Penjual
	Produk       []Produk
	IDPenjualan  string    `json:"id_penjualan" bson:"id_penjualan"`
	JumlahProduk int       `json:"jumlah_produk" bson:"jumlah_produk"`
	Subtotal     int       `json:"subtotal" bson:"subtotal"`
	Total        int       `json:"total" bson:"total"`
	UpdatedAt    time.Time `json:"updated_at" bson:"updated_at"`
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
