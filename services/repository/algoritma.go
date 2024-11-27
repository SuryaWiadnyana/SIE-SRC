package repository

import (
	"SIE-SRC/domain"
	"time"
)

type AlgoritmaRepository struct{}

func NewMongoAlgoritmaRepo(Ar domain.Algoritma, T time.Duration) domain.AlgoritmaRepository {
	return &AlgoritmaRepository{}
}

func (rp *AlgoritmaRepository) FindFrequentItemsets(Transaksi [][]string, minSupport float64) []domain.Algoritma {
	HitungItemset := make(map[string]int)
	totalTransaksi := len(Transaksi)

	for _, transaksi := range Transaksi {
		for _, item := range transaksi {
			HitungItemset[item]++
		}
	}

	var rules []domain.Algoritma
	for item, hitung := range HitungItemset {
		support := float64(hitung) / float64(totalTransaksi)
		if support <= minSupport {
			rules = append(rules, domain.Algoritma{
				Items:   []string{item},
				Support: support,
			})
		}
	}

	return rules
}

func (rp *AlgoritmaRepository) GetRekomendasiProduk(transaksi [][]string, produk string, minSupport float64) []domain.Algoritma {
	rules := rp.FindFrequentItemsets(transaksi, minSupport)

	var rekomendasi []domain.Algoritma
	for _, rule := range rules {
		for _, item := range rule.Items {
			if item == produk {
				rekomendasi = append(rekomendasi, rule)
			}
		}
	}

	return rekomendasi
}
