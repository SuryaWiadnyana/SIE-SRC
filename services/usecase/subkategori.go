package usecase

import (
	"SIE-SRC/domain"
	"context"
	"time"
)

type SubKategoriUseCase struct {
	SubKategoriRepository domain.SubKategoriRepository
	contextTimeout        time.Duration
}

func NewSubKategoriUseCase(skr domain.SubKategoriRepository, timeout time.Duration) domain.SubKategoriUseCase {
	return &SubKategoriUseCase{
		SubKategoriRepository: skr,
		contextTimeout:        timeout,
	}
}

// CreateNewSubKategori membuat subkategori baru
func (uc *SubKategoriUseCase) CreateNewSubKategori(ctx context.Context, subK *domain.SubKategori) (domain.SubKategori, error) {
	return uc.SubKategoriRepository.CreateNewSubKategori(ctx, subK)
}

// GetAll mendapatkan semua subkategori
func (uc *SubKategoriUseCase) GetAll(ctx context.Context) ([]domain.SubKategori, error) {
	return uc.SubKategoriRepository.GetAll(ctx)
}

// GetByID mendapatkan subkategori berdasarkan ID
func (uc *SubKategoriUseCase) GetByID(ctx context.Context, id string) (*domain.SubKategori, error) {
	return uc.SubKategoriRepository.GetByID(ctx, id)
}

// GetByName mendapatkan subkategori berdasarkan nama
func (uc *SubKategoriUseCase) GetByName(ctx context.Context, name string) (*domain.SubKategori, error) {
	return uc.SubKategoriRepository.GetByName(ctx, name)
}

// Delete menghapus subkategori berdasarkan ID
func (uc *SubKategoriUseCase) Delete(ctx context.Context, id string) error {
	return uc.SubKategoriRepository.Delete(ctx, id)
}

// UpdateSubKategori memperbarui subkategori berdasarkan ID
func (uc *SubKategoriUseCase) UpdateSubKategori(ctx context.Context, subK *domain.SubKategori) error {
	return uc.SubKategoriRepository.UpdateSubKategori(ctx, subK)
}

// GenerateNextID menghasilkan ID subkategori berikutnya
func (uc *SubKategoriUseCase) GenerateNextID(ctx context.Context) (string, error) {
	return uc.SubKategoriRepository.GenerateNextID(ctx)
}

// GetByKategoriID mendapatkan subkategori berdasarkan ID kategori
func (uc *SubKategoriUseCase) GetByKategoriID(ctx context.Context, kategoriID string) ([]domain.SubKategori, error) {
	ctx, cancel := context.WithTimeout(ctx, uc.contextTimeout)
	defer cancel()
	return uc.SubKategoriRepository.GetByKategoriID(ctx, kategoriID)
}

// DeleteByKategoriID menghapus semua subkategori berdasarkan ID kategori
func (uc *SubKategoriUseCase) DeleteByKategoriID(ctx context.Context, kategoriID string) error {
	return uc.SubKategoriRepository.DeleteByKategoriID(ctx, kategoriID)
}
