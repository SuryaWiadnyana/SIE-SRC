package db

import (
	"context"
	"errors"
	"fmt"
	"log"
	"SIE-SRC/config"

	"github.com/pandeptwidyaop/golog"

	"go.mongodb.org/mongo-driver/mongo"
	"go.mongodb.org/mongo-driver/mongo/options"
)

var Mongodb *mongo.Database
var Mongocontext context.Context

func InitMongoDB() {
	connection := config.GetMongoConnString()
	fmt.Println(connection)
	database := config.GetMongoDatabase()
	fmt.Println(connection)
	fmt.Println(database)

	if connection == "" {
		e := errors.New("undefined MONGODB_CONNECTION")
		golog.Slack.Error("Undefined MONGODB_CONNECTION", e)
		log.Fatal(e)
	}
	if database == "" {
		e := errors.New("undefined MONGODB_DATABASE")
		golog.Slack.Error("Undefined MONGODB_DATABASE", e)
		log.Fatal(e)
	}
	err := Connect(connection, database)

	if err != nil {
		golog.Slack.Error("Error when initialize mongodb", err)
		log.Fatal(err)
	}
}

func Connect(connection string, collection string) error {
	if Mongodb == nil {
		Mongocontext = context.Background()
		clientOptions := options.Client()
		clientOptions.ApplyURI(connection)
		client, err := mongo.Connect(Mongocontext, clientOptions)

		if err != nil {
			return err
		}
		Mongodb = client.Database(collection)
	}

	return nil
}
