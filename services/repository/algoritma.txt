package repository

import (
	"SIE-SRC/domain"
	"fmt"
	"sort"
	"strings"
	"time"
)

type AlgoritmaRepository struct{}

func NewMongoAlgoritmaRepo(Ar domain.Algoritma, T time.Duration) domain.AlgoritmaRepository {
	return &AlgoritmaRepository{}
}

func (rp *AlgoritmaRepository) FindFrequentItemsets(Transaksi [][]string, minSupport float64) []domain.Algoritma {
	// Log input transactions
	fmt.Println("Transactions received:", Transaksi)

	pairCount := make(map[string]int)
	totalTransaksi := len(Transaksi)

	// Hitung frekuensi pasangan produk
	for _, transaksi := range Transaksi {
		// Skip transaksi dengan kurang dari 2 produk
		if len(transaksi) < 2 {
			continue
		}

		// Generate semua kombinasi pasangan produk
		for i := 0; i < len(transaksi)-1; i++ {
			for j := i + 1; j < len(transaksi); j++ {
				// Urutkan produk untuk konsistensi
				pair := []string{transaksi[i], transaksi[j]}
				sort.Strings(pair)
				pairKey := strings.Join(pair, ",")
				pairCount[pairKey]++
			}
		}
	}

	// Log pair counts
	fmt.Println("Pair counts:", pairCount)

	var rules []domain.Algoritma

	// Tambahkan item pairs yang memenuhi support
	for pairKey, count := range pairCount {
		support := float64(count) / float64(totalTransaksi)
		if support >= minSupport {
			items := strings.Split(pairKey, ",")
			rules = append(rules, domain.Algoritma{
				Items:   items,
				Support: support,
			})
		}
	}

	// Log generated rules
	fmt.Println("Generated rules:", rules)

	return rules
}

func (rp *AlgoritmaRepository) GetRekomendasiProduk(transaksi [][]string, produk string, minSupport float64) []domain.Algoritma {
	rules := rp.FindFrequentItemsets(transaksi, minSupport)

	var rekomendasi []domain.Algoritma
	for _, rule := range rules {
		// Cari rules yang mengandung produk target
		if contains(rule.Items, produk) {
			// Filter out produk target dari rekomendasi
			recommendedItems := []string{}
			for _, item := range rule.Items {
				if item != produk {
					recommendedItems = append(recommendedItems, item)
				}
			}

			// Tambahkan rekomendasi jika ada produk lain
			if len(recommendedItems) > 0 {
				rekomendasi = append(rekomendasi, domain.Algoritma{
					Items:   recommendedItems,
					Support: rule.Support,
				})
			}
		}
	}

	// Urutkan rekomendasi berdasarkan support tertinggi
	sort.Slice(rekomendasi, func(i, j int) bool {
		return rekomendasi[i].Support > rekomendasi[j].Support
	})

	return rekomendasi
}

// Helper function to check if slice contains string
func contains(s []string, str string) bool {
	for _, v := range s {
		if v == str {
			return true
		}
	}
	return false
}
