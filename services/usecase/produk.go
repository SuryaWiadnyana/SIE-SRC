package usecase

import (
	"SIE-SRC/domain"
	"context"
	"time"
)

type ProdukUseCase struct {
	ProdukRepository    domain.ProdukRepository
	// AlgoritmaRepository domain.AlgoritmaRepository
	PenjualanRepository domain.PenjualanRepository
	contextTimeout      time.Duration
}

func NewUseCaseProduk(PR domain.ProdukRepository, PJR domain.PenjualanRepository, T time.Duration) domain.ProdukUseCase {
	return &ProdukUseCase{
		ProdukRepository:    PR,
		// AlgoritmaRepository: AR,
		PenjualanRepository: PJR,
		contextTimeout:      T,
	}
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

func (uc *ProdukUseCase) DeleteProduk(Ctx context.Context, id string) error {
	ctx, cancel := context.WithTimeout(context.Background(), uc.contextTimeout)
	defer cancel()

	return uc.ProdukRepository.DeleteProduk(ctx, id)
}

func (uc *ProdukUseCase) ImportData(ctx context.Context, produkList []domain.Produk) error {
	return uc.ProdukRepository.ImportData(ctx, produkList)
}

// DecreaseProdukStock mengurangi stok produk
func (uc *ProdukUseCase) DecreaseProdukStock(ctx context.Context, id string, kuantitas int) error {
	return uc.ProdukRepository.DecreaseProdukStock(ctx, id, kuantitas)
}

// IncreaseProdukStock menambah stok produk
func (uc *ProdukUseCase) IncreaseProdukStock(ctx context.Context, id string, kuantitas int) error {
	return uc.ProdukRepository.IncreaseProdukStock(ctx, id, kuantitas)
}

// GetFrequentItemsets mengimplementasikan algoritma Apriori
func (uc *ProdukUseCase) GetFrequentItemsets(ctx context.Context, minSupport float64) ([]domain.FrequentItemset, error) {
	ctx, cancel := context.WithTimeout(context.Background(), uc.contextTimeout)
	defer cancel()
	return uc.ProdukRepository.GetFrequentItemsets(ctx, minSupport)
}
