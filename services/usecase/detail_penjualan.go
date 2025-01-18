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

	if dp.Produk.IDProduk == "" {
		return nil, fmt.Errorf("data produk tidak boleh kosong")
	}

	if dp.TotalPendapatan <= 0 {
		return nil, fmt.Errorf("total pendapatan tidak valid")
	}

	// Panggil repository untuk menyimpan detail penjualan
	return uc.detailPenjualanRepo.CreateDetails(ctx, dp)
}

func (uc *detailPenjualanUsecase) UpdateDetails(ctx context.Context, dp *domain.DetailPenjualan) error {
	if dp.ID_DetailPenjualan == "" {
		return fmt.Errorf("id detail penjualan tidak boleh kosong")
	}
	return uc.detailPenjualanRepo.UpdateDetails(ctx, dp)
}

func (uc *detailPenjualanUsecase) GetAllDetails(ctx context.Context) ([]domain.DetailPenjualan, error) {
	return uc.detailPenjualanRepo.GetAllDetails(ctx)
}

func (uc *detailPenjualanUsecase) GetByID(ctx context.Context, id string) (*domain.DetailPenjualan, error) {
	if id == "" {
		return nil, fmt.Errorf("id detail penjualan tidak boleh kosong")
	}
	return uc.detailPenjualanRepo.GetByID(ctx, id)
}

func (uc *detailPenjualanUsecase) Delete(ctx context.Context, id string) error {
	if id == "" {
		return fmt.Errorf("id detail penjualan tidak boleh kosong")
	}
	return uc.detailPenjualanRepo.Delete(ctx, id)
}
