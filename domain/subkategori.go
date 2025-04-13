package domain

import "context"

type SubKategori struct {
	IDSubKategori   string    `json:"id_subkategori" bson:"_id"`
	NamaSubKategori string    `json:"nama_subkategori" bson:"nama_subkategori"`
	Kategori        *Kategori `json:"kategori" bson:"kategori"`
}

type SubKategoriRepository interface {
	CreateNewSubKategori(ctx context.Context, subK *SubKategori) (SubKategori, error)
	GetAll(ctx context.Context) ([]SubKategori, error)
	GetByID(ctx context.Context, id string) (*SubKategori, error)
	GetByName(ctx context.Context, name string) (*SubKategori, error)
	UpdateSubKategori(ctx context.Context, subK *SubKategori) error
	Delete(ctx context.Context, id string) error
	GenerateNextID(ctx context.Context) (string, error)
	GetByKategoriID(ctx context.Context, kategoriID string) ([]SubKategori, error)
	DeleteByKategoriID(ctx context.Context, kategoriID string) error
}

type SubKategoriUseCase interface {
	CreateNewSubKategori(ctx context.Context, subK *SubKategori) (SubKategori, error)
	GetAll(ctx context.Context) ([]SubKategori, error)
	GetByID(ctx context.Context, id string) (*SubKategori, error)
	GetByName(ctx context.Context, name string) (*SubKategori, error)
	UpdateSubKategori(ctx context.Context, subK *SubKategori) error
	Delete(ctx context.Context, id string) error
	GenerateNextID(ctx context.Context) (string, error)
	GetByKategoriID(ctx context.Context, kategoriID string) ([]SubKategori, error)
	DeleteByKategoriID(ctx context.Context, kategoriID string) error
}
