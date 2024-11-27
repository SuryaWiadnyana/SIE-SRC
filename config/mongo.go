package config

import "os"

func GetMongoConnString() string {
	return os.Getenv("MONGODB_CONNECTION")
}

func GetMongoDatabase() string {
	return os.Getenv("MONGODB_DATABASE")
}
