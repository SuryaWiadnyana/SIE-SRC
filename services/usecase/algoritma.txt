package usecase

import (
	"SIE-SRC/domain"
)

type AlgoritmaUsecase interface {
	GetRekomendasiProduk(transactions [][]string, product string, minSupport float64) ([]domain.Algoritma, error)
}

type algoritmaUsecase struct {
	algoritmaRepo domain.AlgoritmaRepository
}

func NewAlgoritmaUsecase(ar domain.AlgoritmaRepository) AlgoritmaUsecase {
	return &algoritmaUsecase{
		algoritmaRepo: ar,
	}
}

func (au *algoritmaUsecase) GetRekomendasiProduk(transactions [][]string, product string, minSupport float64) ([]domain.Algoritma, error) {
	return au.algoritmaRepo.GetRekomendasiProduk(transactions, product, minSupport), nil
}
