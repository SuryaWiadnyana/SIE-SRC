package domain

type Algoritma struct {
	Items   []string
	Support float64
}

type AlgoritmaRepository interface {
	FindFrequentItemsets(transaksi [][]string, minSupport float64) []Algoritma
	GetRekomendasiProduk(transaksi [][]string, produk string, minSupport float64) []Algoritma
}
