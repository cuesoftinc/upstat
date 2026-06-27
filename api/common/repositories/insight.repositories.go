package repositories

import (
	"context"
	"os"
	"time"

	"github.com/CuesoftCloud/upstat/config"
	"github.com/CuesoftCloud/upstat/models"
	"go.mongodb.org/mongo-driver/bson"
	"go.mongodb.org/mongo-driver/bson/primitive"
	"go.mongodb.org/mongo-driver/mongo"
	"go.mongodb.org/mongo-driver/mongo/options"
)

type InsightRepository interface {
	SaveInsight(insight models.MonitorInsight) error
	GetInsightByMonitor(monitorID string) (*models.MonitorInsight, error)
}

type insightRepository struct {
	connection *config.DB
}

func insightCollection(db *config.DB) *mongo.Collection {
	return db.Client.Database(os.Getenv("MONGO_DB")).Collection("MonitorInsight")
}

func NewInsightRepository(db *config.DB) InsightRepository {
	return &insightRepository{connection: db}
}

func (db *insightRepository) SaveInsight(insight models.MonitorInsight) error {
	collection := insightCollection(db.connection)
	ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
	defer cancel()

	if insight.Id.IsZero() {
		insight.Id = primitive.NewObjectID()
	}
	if insight.CreatedAt.IsZero() {
		insight.CreatedAt = time.Now()
	}

	filter := bson.M{"monitorId": insight.MonitorID}
	setMap := bson.M{
		"monitorId":         insight.MonitorID,
		"monitorName":       insight.MonitorName,
		"riskScore":         insight.RiskScore,
		"anomalyDetected":   insight.AnomalyDetected,
		"severity":          insight.Severity,
		"summary":           insight.Summary,
		"recommendedAction": insight.RecommendedAction,
		"generatedAt":       insight.GeneratedAt,
		"updatedAt":         time.Now(),
	}

	// Only overwrite humanReadable if non-empty to avoid clobbering
	// narratives generated and saved by other services (e.g., Python ML service).
	if insight.HumanReadable != "" {
		setMap["humanReadable"] = insight.HumanReadable
	}

	update := bson.M{
		"$set": setMap,
		"$setOnInsert": bson.M{
			"_id":       insight.Id,
			"createdAt": insight.CreatedAt,
		},
	}

	opts := options.Update().SetUpsert(true)
	_, err := collection.UpdateOne(ctx, filter, update, opts)
	return err
}

func (db *insightRepository) GetInsightByMonitor(monitorID string) (*models.MonitorInsight, error) {
	collection := insightCollection(db.connection)
	ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
	defer cancel()

	filter := bson.M{"monitorId": monitorID}
	var insight models.MonitorInsight
	err := collection.FindOne(ctx, filter).Decode(&insight)
	if err == mongo.ErrNoDocuments {
		return nil, nil
	}
	if err != nil {
		return nil, err
	}

	return &insight, nil
}
