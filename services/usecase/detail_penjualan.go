package usecase

import (
	"SIE-SRC/domain"
	"context"
	"fmt"
)

type detailPenjualanUsecase struct {
	detailPenjualanRepo domain.DetailPenjualanRepository
}

func NewDetailPenjualanUsecase(repo domain.DetailPenjualanRepository) domain.DetailPenjualanUseCase {
	return &detailPenjualanUsecase{
		detailPenjualanRepo: repo,
	}
}

func (uc *detailPenjualanUsecase) CreateDetails(ctx context.Context, dp *domain.DetailPenjualan) (*domain.DetailPenjualan, error) {
	// Validasi data penjualan
	if dp.Penjualan.IDPenjualan == "" {
		return nil, fmt.Errorf("id penjualan tidak boleh kosong")
	}

	// Validasi array produk
	if len(dp.Produk) == 0 {
		return nil, fmt.Errorf("data produk tidak boleh kosong")
	}

	// Validasi setiap produk dalam array
	for _, produk := range dp.Produk {
		if produk.IDProduk == "" {
			return nil, fmt.Errorf("id produk tidak boleh kosong")
		}
	}

	// Panggil repository untuk menyimpan detail penjualan
	return uc.detailPenjualanRepo.CreateDetails(ctx, dp)
}

func (uc *detailPenjualanUsecase) GetAll(ctx context.Context) ([]domain.DetailPenjualan, error) {
	return uc.detailPenjualanRepo.GetAll(ctx)
}

func (uc *detailPenjualanUsecase) Delete(ctx context.Context, id string) error {
	if id == "" {
		return fmt.Errorf("id detail penjualan tidak boleh kosong")
	}
	return uc.detailPenjualanRepo.Delete(ctx, id)
}

func (uc *detailPenjualanUsecase) GetByPenjualanID(ctx context.Context, idPenjualan string) ([]domain.DetailPenjualan, error) {
	if idPenjualan == "" {
		return nil, fmt.Errorf("ID penjualan tidak boleh kosong")
	}

	return uc.detailPenjualanRepo.GetByPenjualanID(ctx, idPenjualan)
}
