package domain

import (
	"context"
)

type User struct {
	IDUser   string `json:"id_user" bson:"_id"`
	Username string `json:"username" bson:"username"`
	Password string `json:"password" bson:"password"`
	Role     string `json:"role" bson:"role"`
	Status   string `json:"status" bson:"status"`
}

type UserRepository interface {
	RegisterUser(ctx context.Context, user *User) (User, error)
	GetUserByUsername(ctx context.Context, username string) (*User, error)
	GetUserById(ctx context.Context, id string) (*User, error)
	StatusUser(ctx context.Context, id string, status string) error
	UpdateUser(ctx context.Context, username string, user *User) error
	GetAll(ctx context.Context) ([]User, error)
	GenerateNextID(ctx context.Context) (string, error)
}

type UserUseCase interface {
	RegisterUser(ctx context.Context, user *User) (User, error)
	GetUserByUsername(ctx context.Context, username string) (*User, error)
	GetUserById(ctx context.Context, id string) (*User, error)
	StatusUser(ctx context.Context, id string, status string) error
	UpdateUser(ctx context.Context, username string, user *User) error
	AuthenticateUser(ctx context.Context, username, password string) (*User, error)
	GetAll(ctx context.Context) ([]User, error)
}
