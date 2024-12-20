package repository

import (
	"SIE-SRC/domain"
	"context"
	"fmt"
	"log"

	"go.mongodb.org/mongo-driver/bson"
	"go.mongodb.org/mongo-driver/bson/primitive"
	"go.mongodb.org/mongo-driver/mongo"
	"golang.org/x/crypto/bcrypt"
)

type mongoRepoUser struct {
	DB *mongo.Database
}

func NewMongoRepoUser(client *mongo.Database) domain.UserRepository {
	return &mongoRepoUser{
		DB: client,
	}
}

var _UserCollection = "users"

func (rp *mongoRepoUser) RegisterUser(ctx context.Context, user *domain.User) (domain.User, error) {
	collection := rp.DB.Collection(_UserCollection)

	// Log the registration attempt
	log.Printf("Attempting to register user: %s", user.Username)

	_, err := bcrypt.GenerateFromPassword([]byte(user.Password), bcrypt.DefaultCost)
	if err != nil {
		log.Printf("Error encrypting password for user %s: %v", user.Username, err)
		return domain.User{}, fmt.Errorf("gagal mengenkripsi password: %v", err)
	}

	// Log the password hashing success

	result, err := collection.InsertOne(ctx, user)
	if err != nil {
		log.Printf("Failed to insert user into the database: %v", err)
		return domain.User{}, fmt.Errorf("gagal membuat user: %v", err)
	}

	user.ID = result.InsertedID.(primitive.ObjectID)

	// Log user creation success
	log.Printf("User registered successfully: %s", user.Username)

	return *user, nil
}

func (rp *mongoRepoUser) LoginUser(ctx context.Context, username, password string) (domain.User, error) {
	collection := rp.DB.Collection(_UserCollection)

	log.Printf("Attempting to login user: %s", username)

	// Cari user berdasarkan username
	var user domain.User
	err := collection.FindOne(ctx, bson.M{"username": username}).Decode(&user)
	if err != nil {
		if err == mongo.ErrNoDocuments {
			log.Printf("Login failed for user %s: username not found", username)
			return domain.User{}, fmt.Errorf("username atau password tidak valid")
		}
		log.Printf("Error fetching user %s: %v", username, err)
		return domain.User{}, fmt.Errorf("gagal mencari user: %v", err)
	}

	// Log password comparison attempt
	log.Printf("Attempting to verify password for user: %s", username)

	// Periksa password
	err = bcrypt.CompareHashAndPassword([]byte(user.Password), []byte(password))
	if err != nil {
		return domain.User{}, fmt.Errorf("username atau password tidak valid")
	}

	// Log successful password verification
	log.Printf("Password verified successfully for user: %s", username)

	// Return user on successful login
	return user, nil
}

func (rp *mongoRepoUser) GetUserById(ctx context.Context, id string) (*domain.User, error) {
	collection := rp.DB.Collection(_UserCollection)

	var User domain.User
	err := collection.FindOne(ctx, bson.M{"id": id}).Decode(&User)
	if err != nil {
		if err == mongo.ErrNoDocuments {
			return nil, fmt.Errorf("user dengan ID %s tidak ditemukan", id)
		}
		return nil, fmt.Errorf("error mendapatkan user: %v", err)
	}

	return &User, nil
}

func (rp *mongoRepoUser) GetUserByUsername(ctx context.Context, username string) (*domain.User, error) {
	collection := rp.DB.Collection(_UserCollection)

	var user domain.User
	err := collection.FindOne(ctx, bson.M{"username": username}).Decode(&user)
	if err != nil {
		if err == mongo.ErrNoDocuments {
			return nil, fmt.Errorf("user dengan username %s tidak ditemukan", username)
		}
		return nil, fmt.Errorf("error mendapatkan user: %v", err)
	}

	return &user, nil
}

func (rp *mongoRepoUser) AuthenticateUser(ctx context.Context, username, password string) (*domain.User, error) {
	collection := rp.DB.Collection(_UserCollection)

	// Cari user berdasarkan username
	var user domain.User
	err := collection.FindOne(ctx, bson.M{"username": username}).Decode(&user)
	if err != nil {
		if err == mongo.ErrNoDocuments {
			return nil, fmt.Errorf("username atau password tidak valid")
		}
		return nil, fmt.Errorf("autentikasi gagal: %v", err)
	}

	// Verifikasi password dengan bcrypt
	err = bcrypt.CompareHashAndPassword([]byte(user.Password), []byte(password))
	if err != nil {
		return nil, fmt.Errorf("username atau password tidak valid")
	}
	log.Printf("User role retrieved for %s: %s", user.Username, user.Role)

	return &user, nil
}

func (rp *mongoRepoUser) GetAll(ctx context.Context) ([]domain.User, error) {
	collection := rp.DB.Collection(_UserCollection)

	cursor, err := collection.Find(ctx, bson.M{})
	if err != nil {
		return nil, fmt.Errorf("error getting users: %v", err)
	}
	defer cursor.Close(ctx)

	var users []domain.User
	if err := cursor.All(ctx, &users); err != nil {
		return nil, fmt.Errorf("error decoding users: %v", err)
	}

	return users, nil
}

func (rp *mongoRepoUser) DeleteUser(ctx context.Context, id string) error {
	collection := rp.DB.Collection(_UserCollection)

	objectID, err := primitive.ObjectIDFromHex(id)
	if err != nil {
		return fmt.Errorf("invalid id format: %v", err)
	}

	result, err := collection.DeleteOne(ctx, bson.M{"_id": objectID})
	if err != nil {
		return fmt.Errorf("error deleting user: %v", err)
	}

	if result.DeletedCount == 0 {
		return fmt.Errorf("user with id %s not found", id)
	}

	return nil
}

func (rp *mongoRepoUser) UpdateUser(ctx context.Context, username string, updateData *domain.User) error {
	collection := rp.DB.Collection(_UserCollection)

	// Buat update document
	update := bson.M{}
	if updateData.Password != "" {
		// Hash password baru jika ada
		hashedPassword, err := bcrypt.GenerateFromPassword([]byte(updateData.Password), bcrypt.DefaultCost)
		if err != nil {
			return fmt.Errorf("error hashing password: %v", err)
		}
		update["password"] = string(hashedPassword)
	}
	if updateData.Role != "" {
		update["role"] = updateData.Role
	}

	// Jika tidak ada yang diupdate
	if len(update) == 0 {
		return fmt.Errorf("no fields to update")
	}

	result, err := collection.UpdateOne(
		ctx,
		bson.M{"username": username},
		bson.M{"$set": update},
	)
	if err != nil {
		return fmt.Errorf("error updating user: %v", err)
	}

	if result.MatchedCount == 0 {
		return fmt.Errorf("user not found")
	}

	return nil
}
