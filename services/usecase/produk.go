package usecase

import (
	"SIE-SRC/domain"
	"context"
	"time"
)

type ProdukUseCase struct {
	ProdukRepository    domain.ProdukRepository
	AlgoritmaRepository domain.AlgoritmaRepository
	contextTimeout      time.Duration
}

func NewUseCaseProduk(PR domain.ProdukRepository, AR domain.AlgoritmaRepository, T time.Duration) domain.ProdukUseCase {
	return &ProdukUseCase{
		ProdukRepository:    PR,
		AlgoritmaRepository: AR,
		contextTimeout:      T,
	}
}

func (uc *ProdukUseCase) GetRekomendasiProduk(Ctx context.Context, transaksi [][]string, produk string, minSupport float64) ([]domain.Algoritma, error) {
	_, cancel := context.WithTimeout(context.Background(), uc.contextTimeout)
	defer cancel()

	// Memanggil AlgoritmaRepository untuk mendapatkan rekomendasi produk
	rekomendasi := uc.AlgoritmaRepository.GetRekomendasiProduk(transaksi, produk, minSupport)

	// Anda tidak perlu memeriksa error di sini karena tidak ada error yang dikembalikan
	return rekomendasi, nil
}

func (uc *ProdukUseCase) GetAllProduk(Ctx context.Context) ([]domain.Produk, error) {
	ctx, cancel := context.WithTimeout(context.Background(), uc.contextTimeout)
	defer cancel()

	return uc.ProdukRepository.GetAllProduk(ctx)
}

func (uc *ProdukUseCase) CreateProduk(Ctx context.Context, bd *domain.Produk) (domain.Produk, error) {
	ctx, cancel := context.WithTimeout(context.Background(), uc.contextTimeout)
	defer cancel()

	return uc.ProdukRepository.CreateProduk(ctx, bd)
}

func (uc *ProdukUseCase) GetProdukById(Ctx context.Context, id string) (*domain.Produk, error) {
	ctx, cancel := context.WithTimeout(context.Background(), uc.contextTimeout)
	defer cancel()

	return uc.ProdukRepository.GetProdukById(ctx, id)
}

func (uc *ProdukUseCase) GetProdukByName(Ctx context.Context, nama string) (*domain.Produk, error) {
	ctx, cancel := context.WithTimeout(context.Background(), uc.contextTimeout)
	defer cancel()

	return uc.ProdukRepository.GetProdukByName(ctx, nama)
}

func (uc *ProdukUseCase) UpdateProduk(Ctx context.Context, bd *domain.Produk) error {
	ctx, cancel := context.WithTimeout(context.Background(), uc.contextTimeout)
	defer cancel()

	return uc.ProdukRepository.UpdateProduk(ctx, bd)
}

func (uc *ProdukUseCase) DeleteProduk(Ctx context.Context, id, nama string) error {
	ctx, cancel := context.WithTimeout(context.Background(), uc.contextTimeout)
	defer cancel()

	return uc.ProdukRepository.DeleteProduk(ctx, id, nama)
}

func (uc *ProdukUseCase) ImportData(ctx context.Context, produkList []domain.Produk) error {
	return uc.ProdukRepository.ImportData(ctx, produkList)
}
