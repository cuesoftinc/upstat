package repositories

import (
	"context"
	"github.com/CuesoftCloud/upstat/config"
	"github.com/CuesoftCloud/upstat/models"
	"go.mongodb.org/mongo-driver/bson"
	"go.mongodb.org/mongo-driver/mongo"
	"go.mongodb.org/mongo-driver/mongo/options"
	"log"
	"os"
	"time"
)

type TokenRepository interface {
	CreateToken(token models.Token) (*mongo.InsertOneResult, error)
	GetToken(userId string) (*models.Token, error)
}

type tokenRepository struct {
	connection *config.DB
}

func NewTokenRepository(db *config.DB) TokenRepository {
	return &tokenRepository{
		connection: db,
	}
}

func tokenCollection(db *config.DB) *mongo.Collection {
	// Get the collection name
	collectionName := "Token"

	// Access the collection
	collection := db.Client.Database(os.Getenv("MONGO_DB")).Collection(collectionName)

	// Create index if it doesn't exist
	indexModel := mongo.IndexModel{
		Keys:    bson.D{{"user_id", 1}},
		Options: options.Index().SetUnique(true),
	}

	ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
	defer cancel()

	_, err := collection.Indexes().CreateOne(ctx, indexModel)
	if err != nil {
		log.Println("Failed to create index:", err)
	}

	return collection
}

func (db *tokenRepository) CreateToken(token models.Token) (*mongo.InsertOneResult, error) {
	collection := tokenCollection(db.connection)
	ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
	defer cancel()

	newToken := models.Token{
		UserID:    token.UserID,
		Token:     token.Token,
		CreatedAt: time.Now(),
		UpdatedAt: time.Now(),
	}
	result, err := collection.InsertOne(ctx, newToken)
	if err != nil {
		return nil, err
	}

	return result, nil
}

func (db *tokenRepository) GetToken(userId string) (*models.Token, error) {
	collection := tokenCollection(db.connection)
	ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
	defer cancel()

	var result models.Token
	filter := bson.M{"user_id": userId}
	err := collection.FindOne(ctx, filter).Decode(&result)

	if err != nil {
		return nil, err
	}

	return &result, nil
}
