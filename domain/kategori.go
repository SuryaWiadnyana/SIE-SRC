package domain

import "context"

type Kategori struct {
	IDKategori   string `json:"id_kategori" bson:"_id"`
	NamaKategori string `json:"nama_kategori" bson:"nama_kategori"`
}

type KategoriRepository interface {
	CreateNewKategori(ctx context.Context, k *Kategori) (Kategori, error)
	GetAll(ctx context.Context) ([]Kategori, error)
	GetByID(ctx context.Context, id string) (*Kategori, error)
	GetByName(ctx context.Context, name string) (*Kategori, error)
	Update(ctx context.Context, k *Kategori) error
	Delete(ctx context.Context, id string) error
	GenerateNextID(ctx context.Context) (string, error)
}

type KategoriUseCase interface {
	CreateNewKategori(ctx context.Context, k *Kategori) (Kategori, error)
	GetAll(ctx context.Context) ([]Kategori, error)
	GetByID(ctx context.Context, id string) (*Kategori, error)
	GetByName(ctx context.Context, name string) (*Kategori, error)
	Update(ctx context.Context, k *Kategori) error
	Delete(ctx context.Context, id string) error
	GenerateNextID(ctx context.Context) (string, error)
}
