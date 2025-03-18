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
	result, err := uc.KategoriRepository.CreateNewKategori(ctx, k)
	if err != nil {
		return domain.Kategori{}, err
	}

	return result, nil
}

// GetAll mendapatkan semua kategori
func (uc *KategoriUseCase) GetAll(ctx context.Context) ([]domain.Kategori, error) {
	return uc.KategoriRepository.GetAll(ctx)
}

// GetByID mendapatkan kategori berdasarkan ID
func (uc *KategoriUseCase) GetByID(ctx context.Context, id string) (*domain.Kategori, error) {
	return uc.KategoriRepository.GetByID(ctx, id)
}

// GetByName mendapatkan kategori berdasarkan nama
func (uc *KategoriUseCase) GetByName(ctx context.Context, name string) (*domain.Kategori, error) {
	return uc.KategoriRepository.GetByName(ctx, name)
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
