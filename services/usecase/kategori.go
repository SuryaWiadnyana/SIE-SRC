package usecase

import (
	"SIE-SRC/domain"
	"context"
	"time"
)

type KategoriUseCase struct {
	KategoriRepository domain.KategoriRepository
	contextTimeout     time.Duration
}

func NewKategoriUseCase(kr domain.KategoriRepository, timeout time.Duration) domain.KategoriUseCase {
	return &KategoriUseCase{
		KategoriRepository: kr,
		contextTimeout:     timeout,
	}
}

// CreateNewKategori membuat kategori baru
func (uc *KategoriUseCase) CreateNewKategori(ctx context.Context, k *domain.Kategori) (domain.Kategori, error) {
	// Simpan kategori baru
	_, err := uc.KategoriRepository.CreateNewKategori(ctx, k)
	if err != nil {
		return domain.Kategori{}, err
	}

	// Dapatkan semua kategori setelah penambahan
	return uc.KategoriRepository.CreateNewKategori(ctx, k)
}

// GetAll mendapatkan semua kategori
func (uc *KategoriUseCase) GetAll(ctx context.Context) ([]domain.Kategori, error) {
	return uc.KategoriRepository.GetAll(ctx)
}

// GetByID mendapatkan kategori berdasarkan ID
func (uc *KategoriUseCase) GetByID(ctx context.Context, id string) (*domain.Kategori, error) {
	return uc.KategoriRepository.GetByID(ctx, id)
}

// Delete menghapus kategori berdasarkan ID
func (uc *KategoriUseCase) Delete(ctx context.Context, id string) error {
	return uc.KategoriRepository.Delete(ctx, id)
}

// Update memperbarui kategori berdasarkan ID
func (uc *KategoriUseCase) Update(ctx context.Context, k *domain.Kategori) error {
	return uc.KategoriRepository.Update(ctx, k)
}

// GenerateNextID menghasilkan ID kategori berikutnya
func (uc *KategoriUseCase) GenerateNextID(ctx context.Context) (string, error) {
	return uc.KategoriRepository.GenerateNextID(ctx)
}
