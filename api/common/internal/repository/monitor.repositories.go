package repository

import (
	"context"
	"github.com/CuesoftCloud/upstat/internal/config"
	"github.com/CuesoftCloud/upstat/internal/model"
	"go.mongodb.org/mongo-driver/bson"
	"go.mongodb.org/mongo-driver/bson/primitive"
	"go.mongodb.org/mongo-driver/mongo"
	"go.mongodb.org/mongo-driver/mongo/options"
	"os"
	"time"
)

type MonitorRepository interface {
	CreateMonitor(monitor model.Monitor) (*model.Monitor, error)
	GetMonitor(id string, ownerID string) (*model.Monitor, error)
	ListMonitors(ownerId string) ([]*model.Monitor, error)
	ListActiveMonitors() ([]*model.Monitor, error)
	UpdateMonitor(id string, ownerID string, monitor model.Monitor) (*model.Monitor, error)
	DeleteMonitor(id string, ownerID string) (*mongo.DeleteResult, error)
	UpdateAfterCheck(monitorID primitive.ObjectID, status string, statusCode int, responseTimeMs int64, consecutiveFailures int) error
}

type monitorRepository struct {
	connection *config.DB
}

func monitorCollection(db *config.DB) *mongo.Collection {
	return db.Client.Database(os.Getenv("MONGO_DB")).Collection("Monitor")
}

func NewMonitorRepository(db *config.DB) MonitorRepository {
	return &monitorRepository{connection: db}
}

func (db *monitorRepository) CreateMonitor(monitor model.Monitor) (*model.Monitor, error) {
	collection := monitorCollection(db.connection)
	ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
	defer cancel()

	monitor.Id = primitive.NewObjectID()
	monitor.CreatedAt = time.Now()
	monitor.UpdatedAt = time.Now()

	_, err := collection.InsertOne(ctx, monitor)
	if err != nil{
		return nil, err
	}
	
	return &monitor, nil
}

func (db *monitorRepository) ListMonitors(ownerId string) ([]*model.Monitor, error) {
	collection := monitorCollection(db.connection)
	ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
	defer cancel()

	var monitors []*model.Monitor

	list := bson.M{
		"ownerId": ownerId,
	}

	cursor, err := collection.Find(ctx, list)
	if err != nil {
		return nil, err
	}

	defer cursor.Close(ctx)

	err = cursor.All(ctx, &monitors)

	return monitors, err
}

func (db *monitorRepository) UpdateMonitor(id string, ownerId string, monitor model.Monitor) (*model.Monitor, error) {
	collection := monitorCollection(db.connection)
	ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
	defer cancel()

	oid, err := primitive.ObjectIDFromHex(id)
	if err != nil {
		return nil, err
	}

	filter := bson.M{
		"_id":     oid,
		"ownerId": ownerId,
	}

	update := bson.M{
		"$set": bson.M{
			"name":      monitor.Name,
			"target":    monitor.Target,
			"type":      monitor.Type,
			"updatedAt": time.Now(),
		},
	}

	opts := options.FindOneAndUpdate().SetReturnDocument(options.After)

	var updatedMonitor model.Monitor

	err = collection.FindOneAndUpdate(ctx, filter, update, opts).Decode(&updatedMonitor)
	if err != nil {
		return nil, err
	}

	return &updatedMonitor, nil
}

func (db *monitorRepository) DeleteMonitor(id string, ownerId string) (*mongo.DeleteResult, error) {

	collection := monitorCollection(db.connection)
	ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
	defer cancel()

	oid, err := primitive.ObjectIDFromHex(id)
	if err != nil {
		return nil, err
	}

	delete := bson.M{
		"_id":     oid,
		"ownerId": ownerId,
	}

	deleteResult, err := collection.DeleteOne(ctx, delete)
	if err != nil {
		return nil, err
	}

	return deleteResult, nil
}

func (db *monitorRepository) GetMonitor(id string, ownerID string) (*model.Monitor, error) {

	collection := monitorCollection(db.connection)
	ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
	defer cancel()

	oid, err := primitive.ObjectIDFromHex(id)
	if err != nil {
		return nil, err
	}

	var monitor model.Monitor

	filter := bson.M{
		"_id":     oid,
		"ownerId": ownerID,
	}

	err = collection.FindOne(ctx, filter).Decode(&monitor)
	if err != nil {
		return nil, err
	}

	return &monitor, nil
}

func (db *monitorRepository) ListActiveMonitors() ([]*model.Monitor, error) {
	collection := monitorCollection(db.connection)
	ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
	defer cancel()

	listAllMonitors := bson.M{"active": true}

	cursor, err := collection.Find(ctx, listAllMonitors)
	if err != nil {
		return nil, err
	}

	defer cursor.Close(ctx)

	var monitors []*model.Monitor
	err = cursor.All(ctx, &monitors)
	return monitors, err
}

func (db *monitorRepository) UpdateAfterCheck(
	monitorID primitive.ObjectID,
	status string,
	statusCode int,
	responseTimeMs int64,
	consecutiveFailures int,
) error {
	collection := monitorCollection(db.connection)
	ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
	defer cancel()

	now := time.Now()

	update := bson.M{
		"$set": bson.M{
			"status":              status,
			"lastCheckedAt":       now,
			"lastStatusCode":      statusCode,
			"lastResponseTimeMs":  responseTimeMs,
			"consecutiveFailures": consecutiveFailures,
			"updatedAt":           now,
		},
	}

	_, err := collection.UpdateByID(ctx, monitorID, update)
	return err
}
