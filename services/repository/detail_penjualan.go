package repository

import (
	"SIE-SRC/domain"
	"context"
	"fmt"
	"log"

	"go.mongodb.org/mongo-driver/bson"
	"go.mongodb.org/mongo-driver/mongo"
)

type mongoRepoDetailPenjualan struct {
	DB *mongo.Database
}

func NewMongoRepoDetailPenjualan(client *mongo.Database) domain.DetailPenjualanRepository {
	return &mongoRepoDetailPenjualan{
		DB: client,
	}
}

func (r *mongoRepoDetailPenjualan) CreateDetails(ctx context.Context, dp *domain.DetailPenjualan) (*domain.DetailPenjualan, error) {
	id, err := r.GenerateNextID(ctx)
	if err != nil {
		log.Printf("Error generating ID: %v", err)
		return nil, fmt.Errorf("gagal generate ID: %v", err)
	}

	log.Printf("Creating detail penjualan with ID %s for penjualan ID %s", id, dp.Penjualan.IDPenjualan)

	// Set ID for detail penjualan
	dp.ID_DetailPenjualan = id

	collection := r.DB.Collection("detail_penjualan")

	// Buat dokumen detail penjualan
	detailDoc := bson.M{
		"id_details":       id,
		"penjualan":       dp.Penjualan,
		"produk":          dp.Produk,
		"total_pendapatan": dp.TotalPendapatan,
	}

	// Insert ke koleksi detail penjualan
	_, err = collection.InsertOne(ctx, detailDoc)
	if err != nil {
		log.Printf("Error inserting detail penjualan: %v", err)
		return nil, fmt.Errorf("gagal menyimpan detail penjualan: %v", err)
	}

	log.Printf("Successfully created detail penjualan with ID %s", id)
	return dp, nil
}

func (r *mongoRepoDetailPenjualan) UpdateDetails(ctx context.Context, dp *domain.DetailPenjualan) error {
	collection := r.DB.Collection("detail_penjualan")

	_, err := collection.UpdateOne(ctx, bson.M{"id_details": dp.ID_DetailPenjualan}, bson.M{"$set": dp})
	if err != nil {
		return fmt.Errorf("gagal memperbarui detail penjualan: %v", err)
	}

	return nil
}

func (r *mongoRepoDetailPenjualan) GetAll(ctx context.Context) ([]domain.DetailPenjualan, error) {
	collection := r.DB.Collection("detail_penjualan")
	var details []domain.DetailPenjualan

	cursor, err := collection.Find(ctx, bson.M{})
	if err != nil {
		return nil, err
	}
	defer cursor.Close(ctx)

	for cursor.Next(ctx) {
		var detail domain.DetailPenjualan
		if err := cursor.Decode(&detail); err != nil {
			log.Println("Error decoding detail penjualan:", err)
			continue
		}
		details = append(details, detail)
	}

	return details, nil
}

func (r *mongoRepoDetailPenjualan) GetByID(ctx context.Context, id string) (*domain.DetailPenjualan, error) {
	collection := r.DB.Collection("detail_penjualan")

	var detail domain.DetailPenjualan
	err := collection.FindOne(ctx, bson.M{"id_details": id}).Decode(&detail)
	if err != nil {
		if err == mongo.ErrNoDocuments {
			return nil, fmt.Errorf("detail penjualan dengan ID %s tidak ditemukan", id)
		}
		return nil, fmt.Errorf("gagal mengambil detail penjualan: %v", err)
	}

	return &detail, nil
}

func (r *mongoRepoDetailPenjualan) Delete(ctx context.Context, id string) error {
	collection := r.DB.Collection("detail_penjualan")

	_, err := collection.DeleteOne(ctx, bson.M{"id_details": id})
	if err != nil {
		return fmt.Errorf("gagal menghapus detail penjualan: %v", err)
	}

	return nil
}

func (r *mongoRepoDetailPenjualan) GenerateNextID(ctx context.Context) (string, error) {
	collection := r.DB.Collection("detail_penjualan")

	// Get the count of existing documents
	count, err := collection.CountDocuments(ctx, bson.M{})
	if err != nil {
		log.Printf("Error counting documents: %v", err)
		return "", fmt.Errorf("gagal menghitung dokumen: %v", err)
	}

	// Generate next ID with format DP001, DP002, etc.
	nextID := fmt.Sprintf("DP%03d", count+1)
	log.Printf("Generated next ID: %s", nextID)
	return nextID, nil
}

func (r *mongoRepoDetailPenjualan) GetByPenjualanID(ctx context.Context, idPenjualan string) ([]domain.DetailPenjualan, error) {
	collection := r.DB.Collection("detail_penjualan")
	filter := bson.M{"penjualan.id_penjualan": idPenjualan}
	cursor, err := collection.Find(ctx, filter)
	if err != nil {
		log.Printf("Error finding detail penjualan: %v", err)
		return nil, fmt.Errorf("gagal mencari detail penjualan: %v", err)
	}
	defer cursor.Close(ctx)

	var details []domain.DetailPenjualan
	if err := cursor.All(ctx, &details); err != nil {
		log.Printf("Error decoding detail penjualan: %v", err)
		return nil, fmt.Errorf("gagal decode detail penjualan: %v", err)
	}

	return details, nil
}
