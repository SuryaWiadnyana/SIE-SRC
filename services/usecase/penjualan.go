package usecase

import (
	"SIE-SRC/domain"
	"context"
	"time"
)

type PenjualanUseCase struct {
	PenjualanRepository domain.PenjualanRepository
	contextTimeout      time.Duration
}

func NewUseCasePenjualan(PR domain.PenjualanRepository, T time.Duration) domain.PenjualanUseCase {
	return &PenjualanUseCase{
		PenjualanRepository: PR,
		contextTimeout:      T,
	}
}

func (uc *PenjualanUseCase) GetAll(Ctx context.Context) ([]domain.Penjualan, error) {
	ctx, cancel := context.WithTimeout(context.Background(), uc.contextTimeout)
	defer cancel()

	return uc.PenjualanRepository.GetAll(ctx)
}

func (uc *PenjualanUseCase) CreateBulk(Ctx context.Context, bd []domain.Penjualan) ([]domain.Penjualan, error) {
	ctx, cancel := context.WithTimeout(context.Background(), uc.contextTimeout)
	defer cancel()

	return uc.PenjualanRepository.CreateBulk(ctx, bd)
}

func (uc *PenjualanUseCase) GetByID(Ctx context.Context, id string) (*domain.Penjualan, error) {
	ctx, cancel := context.WithTimeout(context.Background(), uc.contextTimeout)
	defer cancel()

	return uc.PenjualanRepository.GetByID(ctx, id)
}

func (uc *PenjualanUseCase) Update(Ctx context.Context, bd *domain.Penjualan) error {
	ctx, cancel := context.WithTimeout(context.Background(), uc.contextTimeout)
	defer cancel()

	return uc.PenjualanRepository.Update(ctx, bd)
}

func (uc *PenjualanUseCase) Delete(Ctx context.Context, id string) error {
	ctx, cancel := context.WithTimeout(context.Background(), uc.contextTimeout)
	defer cancel()

	return uc.PenjualanRepository.Delete(ctx, id)
}
