package usecase

import (
	"SIE-SRC/domain"
	"context"
	"time"
)

type ProdukUseCase struct {
	ProdukRepository    domain.ProdukRepository
	AlgoritmaRepository domain.AlgoritmaRepository
	PenjualanRepository domain.PenjualanRepository
	contextTimeout      time.Duration
}

func NewUseCaseProduk(PR domain.ProdukRepository, AR domain.AlgoritmaRepository, PJR domain.PenjualanRepository, T time.Duration) domain.ProdukUseCase {
	return &ProdukUseCase{
		ProdukRepository:    PR,
		AlgoritmaRepository: AR,
		PenjualanRepository: PJR,
		contextTimeout:      T,
	}
}

// func (uc *ProdukUseCase) GetRekomendasiProduk(Ctx context.Context, produk string, minSupport float64) ([]domain.Algoritma, error) {
// 	ctx, cancel := context.WithTimeout(context.Background(), uc.contextTimeout)
// 	defer cancel()

// 	// Get all sales data
// 	sales, err := uc.PenjualanRepository.GetAll(ctx)
// 	if err != nil {
// 		return nil, err
// 	}

// 	// Transform sales data into transaction format
// 	var transactions [][]string
// 	for _, sale := range sales {
// 		var items []string
// 		for _, detail := range sale.Produk {
// 			items = append(items, detail.IDProduk)
// 		}
// 		transactions = append(transactions, items)
// 	}

// 	// Get recommendations using the algorithm
// 	rules := uc.AlgoritmaRepository.GetRekomendasiProduk(transactions, produk, minSupport)

// 	// Convert rules to product recommendations
// 	var recommendations []domain.Algoritma
// 	for _, rule := range rules {
// 		// Skip if no recommended items
// 		if len(rule.Items) == 0 {
// 			continue
// 		}

// 		// Add recommendation
// 		recommendations = append(recommendations, domain.Algoritma{
// 			Items:   rule.Items,
// 			Support: rule.Support,
// 		})
// 	}

// 	return recommendations, nil
// }

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
