package usecase

import (
	"SIE-SRC/domain"
	"context"
	"errors"
	"time"
)

type ProdukUseCase struct {
	ProdukRepository domain.ProdukRepository
	// AlgoritmaRepository domain.AlgoritmaRepository
	PenjualanRepository domain.PenjualanRepository
	contextTimeout      time.Duration
}

func NewUseCaseProduk(PR domain.ProdukRepository, PJR domain.PenjualanRepository, T time.Duration) domain.ProdukUseCase {
	return &ProdukUseCase{
		ProdukRepository: PR,
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

	// Validasi harga dan stok tidak boleh negatif
	if bd.HargaProduk < 0 {
		return domain.Produk{}, errors.New("harga produk tidak boleh negatif")
	}

	if bd.Stok < 0 {
		return domain.Produk{}, errors.New("stok produk tidak boleh negatif")
	}

	// Generate ID produk jika belum ada
	if bd.IDProduk == "" {
		nextID, err := uc.ProdukRepository.GenerateNextID(ctx)
		if err != nil {
			return domain.Produk{}, errors.New("gagal menghasilkan ID produk: " + err.Error())
		}
		bd.IDProduk = nextID
	}

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

	// Validasi harga dan stok tidak boleh negatif
	if bd.HargaProduk < 0 {
		return errors.New("harga produk tidak boleh negatif")
	}

	if bd.Stok < 0 {
		return errors.New("stok produk tidak boleh negatif")
	}

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
func (uc *ProdukUseCase) GetFrequentItemsets(ctx context.Context, minSupport float64) ([]domain.FrequentItemsetResponse, error) {
	ctx, cancel := context.WithTimeout(context.Background(), uc.contextTimeout)
	defer cancel()
	return uc.ProdukRepository.GetFrequentItemsets(ctx, minSupport)
}

// GetBestSellingProducts mendapatkan daftar produk terlaris berdasarkan jumlah terjual
func (uc *ProdukUseCase) GetBestSellingProducts(ctx context.Context, limitProduk int) ([]map[string]interface{}, error) {
	ctx, cancel := context.WithTimeout(context.Background(), uc.contextTimeout)
	defer cancel()
	return uc.ProdukRepository.GetBestSellingProducts(ctx, limitProduk)
}

// GetProdukWithLowestStock mendapatkan daftar produk dengan stok paling sedikit
func (uc *ProdukUseCase) GetProdukWithLowestStock(ctx context.Context, limit int) ([]domain.Produk, error) {
	ctx, cancel := context.WithTimeout(context.Background(), uc.contextTimeout)
	defer cancel()

	return uc.ProdukRepository.GetProdukWithLowestStock(ctx, limit)
}

// GenerateNextID menghasilkan ID produk berikutnya
func (uc *ProdukUseCase) GenerateNextID(ctx context.Context) (string, error) {
	ctx, cancel := context.WithTimeout(context.Background(), uc.contextTimeout)
	defer cancel()

	return uc.ProdukRepository.GenerateNextID(ctx)
}

// GetProductsNearExpiry mengembalikan daftar produk yang mendekati tanggal kedaluwarsa
// daysThreshold adalah jumlah hari sebelum kedaluwarsa untuk memberikan peringatan
func (uc *ProdukUseCase) GetProductsNearExpiry(ctx context.Context, daysThreshold int) ([]domain.ProdukExpiryResponse, error) {
	ctx, cancel := context.WithTimeout(ctx, uc.contextTimeout)
	defer cancel()

	// Ambil semua produk
	allProducts, err := uc.ProdukRepository.GetAllProduk(ctx)
	if err != nil {
		return nil, err
	}

	// Filter produk yang mendekati kedaluwarsa
	var nearExpiryProducts []domain.ProdukExpiryResponse
	now := time.Now()
	thresholdDate := now.AddDate(0, 0, daysThreshold)

	for _, product := range allProducts {
		// Lewati produk yang tidak memiliki tanggal kedaluwarsa (zero time)
		if product.TanggalKedaluwarsa.IsZero() {
			continue
		}

		// Buat objek ProdukExpiry
		produkExpiry := domain.ProdukExpiryResponse{
			Produk: product,
		}

		// Jika produk sudah kedaluwarsa, tambahkan ke daftar
		if product.TanggalKedaluwarsa.Before(now) {
			produkExpiry.IsExpired = true
			produkExpiry.DaysUntilExpiry = 0
			nearExpiryProducts = append(nearExpiryProducts, produkExpiry)
			continue
		}

		// Jika produk mendekati kedaluwarsa (dalam threshold hari), tambahkan ke daftar
		if product.TanggalKedaluwarsa.Before(thresholdDate) {
			daysUntil := int(product.TanggalKedaluwarsa.Sub(now).Hours() / 24)
			produkExpiry.DaysUntilExpiry = daysUntil
			nearExpiryProducts = append(nearExpiryProducts, produkExpiry)
		}
	}

	return nearExpiryProducts, nil
}

// GetLaporanProduk retrieves product report data with filters
func (uc *ProdukUseCase) GetLaporanProduk(ctx context.Context, kategoriID, subkategoriID string, sort string) ([]domain.Produk, error) {
	// Get data from repository
	ctx, cancel := context.WithTimeout(context.Background(), uc.contextTimeout)
	defer cancel()

	produkList, err := uc.ProdukRepository.GetLaporanProduk(ctx, kategoriID, subkategoriID, sort)
	if err != nil {
		return nil, err
	}

	return produkList, nil
}
