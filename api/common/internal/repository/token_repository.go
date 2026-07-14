package repository

import (
	"context"
	"github.com/cuesoftinc/upstat/api/common/internal/config"
	"github.com/cuesoftinc/upstat/api/common/internal/model"
	"go.mongodb.org/mongo-driver/bson"
	"go.mongodb.org/mongo-driver/mongo"
	"go.mongodb.org/mongo-driver/mongo/options"
	"log/slog"
	"os"
	"time"
)

type TokenRepository interface {
	CreateToken(token model.Token) (*mongo.InsertOneResult, error)
	GetToken(userId string) (*model.Token, error)
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
		Keys:    bson.D{{Key: "user_id", Value: 1}},
		Options: options.Index().SetUnique(true),
	}

	ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
	defer cancel()

	_, err := collection.Indexes().CreateOne(ctx, indexModel)
	if err != nil {
		slog.Error("failed to create index", "error", err)
	}

	return collection
}

func (db *tokenRepository) CreateToken(token model.Token) (*mongo.InsertOneResult, error) {
	collection := tokenCollection(db.connection)
	ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
	defer cancel()

	newToken := model.Token{
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

func (db *tokenRepository) GetToken(userId string) (*model.Token, error) {
	collection := tokenCollection(db.connection)
	ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
	defer cancel()

	var result model.Token
	filter := bson.M{"user_id": userId}
	err := collection.FindOne(ctx, filter).Decode(&result)

	if err != nil {
		return nil, err
	}

	return &result, nil
}
