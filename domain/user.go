package domain

import (
	"context"

	"go.mongodb.org/mongo-driver/bson/primitive"
)

type User struct {
	ID       primitive.ObjectID `json:"id" bson:"_id,omitempty"`
	Username string             `json:"username" bson:"username"`
	Password string             `json:"password" bson:"password"`
	Role     string             `json:"role" bson:"role"`
}

type UserRepository interface {
	RegisterUser(ctx context.Context, user *User) (User, error)
	GetUserByUsername(ctx context.Context, username string) (*User, error)
	GetUserById(ctx context.Context, id string) (*User, error)
	DeleteUser(ctx context.Context, id string) error
	UpdateUser(ctx context.Context, username string, user *User) error
	GetAll(ctx context.Context) ([]User, error)
}

type UserUseCase interface {
	RegisterUser(ctx context.Context, user *User) (User, error)
	GetUserByUsername(ctx context.Context, username string) (*User, error)
	GetUserById(ctx context.Context, id string) (*User, error)
	DeleteUser(ctx context.Context, id string) error
	UpdateUser(ctx context.Context, username string, user *User) error
	AuthenticateUser(ctx context.Context, username, password string) (*User, error)
	GetAll(ctx context.Context) ([]User, error)
}
