package usecase

import (
	"SIE-SRC/domain"
	"context"
	"fmt"
	"time"

	"golang.org/x/crypto/bcrypt"
)

type UserUseCase struct {
	UserRepository domain.UserRepository
	contextTimeout time.Duration
}

func NewMongoUseCaseUser(Ur domain.UserRepository, T time.Duration) domain.UserUseCase {
	return &UserUseCase{
		UserRepository: Ur,
		contextTimeout: T,
	}
}

func (uc *UserUseCase) RegisterUser(ctx context.Context, user *domain.User) (domain.User, error) {

	hashedPassword, err := bcrypt.GenerateFromPassword([]byte(user.Password), bcrypt.DefaultCost)
	if err != nil {
		return domain.User{}, fmt.Errorf("gagal menenkripsi password: %v", err)
	}

	user.Password = string(hashedPassword)

	return uc.UserRepository.RegisterUser(ctx, user)
}

func (uc *UserUseCase) AuthenticateUser(ctx context.Context, username, password string) (*domain.User, error) {
	// Ambil user berdasarkan username
	user, err := uc.UserRepository.GetUserByUsername(ctx, username)
	if err != nil {
		return nil, fmt.Errorf("username tidak ditemukan")
	}

	// Verifikasi password yang dimasukkan dengan password yang disimpan (ter-hash)
	err = bcrypt.CompareHashAndPassword([]byte(user.Password), []byte(password))
	if err != nil {
		return nil, fmt.Errorf("password tidak valid")
	}

	return user, nil
}

func (uc *UserUseCase) GetUserById(ctx context.Context, id string) (*domain.User, error) {
	return uc.UserRepository.GetUserById(ctx, id)
}

func (uc *UserUseCase) GetUserByUsername(ctx context.Context, username string) (*domain.User, error) {
	return uc.UserRepository.GetUserByUsername(ctx, username)
}

func (uc *UserUseCase) GetAll(ctx context.Context) ([]domain.User, error) {
	return uc.UserRepository.GetAll(ctx)
}

func (uc *UserUseCase) DeleteUser(ctx context.Context, id string) error {
	return uc.UserRepository.DeleteUser(ctx, id)
}

// UpdateUser updates user data
func (uc *UserUseCase) UpdateUser(ctx context.Context, username string, updateData *domain.User) error {
	// Validasi username
	if username == "" {
		return fmt.Errorf("username is required")
	}

	// Cek apakah user ada
	existingUser, err := uc.UserRepository.GetUserByUsername(ctx, username)
	if err != nil {
		return err
	}
	if existingUser == nil {
		return fmt.Errorf("user not found")
	}

	// Update user
	return uc.UserRepository.UpdateUser(ctx, username, updateData)
}
