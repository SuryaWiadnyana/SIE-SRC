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

func (r *mongoRepoDetailPenjualan) CreateDetails(ctx context.Context, bd []domain.DetailPenjualan) ([]domain.DetailPenjualan, error) {
	collection := r.DB.Collection("detail_penjualan")
	var detailDocs []interface{}

	for _, detail := range bd {
		detailDocs = append(detailDocs, detail)
	}

	_, err := collection.InsertMany(ctx, detailDocs)
	if err != nil {
		return nil, fmt.Errorf("gagal menyimpan detail penjualan: %v", err)
	}

	return bd, nil
}

func (r *mongoRepoDetailPenjualan) UpdateDetails(ctx context.Context, bd *domain.DetailPenjualan) error {
	collection := r.DB.Collection("detail_penjualan")

	_, err := collection.UpdateOne(ctx, bson.M{"id_details": bd.ID_DetailPenjualan}, bson.M{"$set": bd})
	if err != nil {
		return fmt.Errorf("gagal memperbarui detail penjualan: %v", err)
	}

	return nil
}

func (r *mongoRepoDetailPenjualan) GetAllDetails(ctx context.Context) ([]domain.DetailPenjualan, error) {
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
	// Implementasi untuk menghasilkan ID berikutnya untuk detail penjualan
	return "DP001", nil // Placeholder
}
