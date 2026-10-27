package repository

import (
	"context"
	"errors"
	"github.com/cuesoftinc/upstat/api/common/internal/auth"
	"github.com/cuesoftinc/upstat/api/common/internal/config"
	"github.com/cuesoftinc/upstat/api/common/internal/model"
	"go.mongodb.org/mongo-driver/bson"
	"go.mongodb.org/mongo-driver/bson/primitive"
	"go.mongodb.org/mongo-driver/mongo"
	"go.mongodb.org/mongo-driver/mongo/options"
	"log/slog"
	"os"
	"time"
)

type ssoHandoffRepository struct {
	connection *config.DB
}

// NewSSOHandoffRepository stores sign-in handoffs in MongoDB so a redeem survives a restart.
func NewSSOHandoffRepository(db *config.DB) auth.HandoffStore {
	return &ssoHandoffRepository{connection: db}
}

func ssoHandoffCollection(db *config.DB) *mongo.Collection {
	collection := db.Client.Database(os.Getenv("MONGO_DB")).Collection("SSOHandoff")

	indexes := []mongo.IndexModel{
		{Keys: bson.D{{Key: "body_code_hash", Value: 1}}, Options: options.Index().SetUnique(true)},
		{Keys: bson.D{{Key: "cookie_code_hash", Value: 1}}, Options: options.Index().SetUnique(true)},
		{Keys: bson.D{{Key: "expires_at", Value: 1}}, Options: options.Index().SetExpireAfterSeconds(0)},
	}

	ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
	defer cancel()

	if _, err := collection.Indexes().CreateMany(ctx, indexes); err != nil {
		slog.Error("failed to create index", "error", err)
	}

	return collection
}

func (r *ssoHandoffRepository) Create(ctx context.Context, rec auth.HandoffRecord) error {
	collection := ssoHandoffCollection(r.connection)
	ctx, cancel := context.WithTimeout(ctx, 10*time.Second)
	defer cancel()

	_, err := collection.InsertOne(ctx, model.SSOHandoff{
		BodyCodeHash:   rec.BodyCodeHash,
		CookieCodeHash: rec.CookieCodeHash,
		UserID:         rec.UserID,
		Email:          rec.Email,
		Name:           rec.Name,
		Challenge:      rec.Challenge,
		ExpiresAt:      rec.ExpiresAt,
		CreatedAt:      time.Now(),
	})
	return err
}

func (r *ssoHandoffRepository) FindByCodeHash(ctx context.Context, channel, codeHash string) (*auth.HandoffRecord, error) {
	field := "body_code_hash"
	if channel == auth.HandoffChannelCookie {
		field = "cookie_code_hash"
	}

	collection := ssoHandoffCollection(r.connection)
	ctx, cancel := context.WithTimeout(ctx, 10*time.Second)
	defer cancel()

	var doc model.SSOHandoff
	err := collection.FindOne(ctx, bson.M{field: codeHash}).Decode(&doc)
	if errors.Is(err, mongo.ErrNoDocuments) {
		return nil, nil
	}
	if err != nil {
		return nil, err
	}

	return &auth.HandoffRecord{
		ID:              doc.ID.Hex(),
		BodyCodeHash:    doc.BodyCodeHash,
		CookieCodeHash:  doc.CookieCodeHash,
		UserID:          doc.UserID,
		Email:           doc.Email,
		Name:            doc.Name,
		Challenge:       doc.Challenge,
		Channel:         doc.Channel,
		TokenCiphertext: doc.TokenCiphertext,
		ExpiresAt:       doc.ExpiresAt,
	}, nil
}

func (r *ssoHandoffRepository) Claim(ctx context.Context, id, channel string, ciphertext []byte, expiresAt time.Time) (bool, error) {
	objectID, err := primitive.ObjectIDFromHex(id)
	if err != nil {
		return false, err
	}

	collection := ssoHandoffCollection(r.connection)
	ctx, cancel := context.WithTimeout(ctx, 10*time.Second)
	defer cancel()

	filter := bson.M{
		"_id":     objectID,
		"channel": bson.M{"$exists": false},
	}
	update := bson.M{"$set": bson.M{
		"channel":          channel,
		"token_ciphertext": ciphertext,
		"expires_at":       expiresAt,
	}}

	result, err := collection.UpdateOne(ctx, filter, update)
	if err != nil {
		return false, err
	}
	return result.ModifiedCount == 1, nil
}
