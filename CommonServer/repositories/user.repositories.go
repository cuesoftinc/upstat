package repositories

import (
	"context"
	"github.com/CuesoftCloud/upstat/config"
	"github.com/CuesoftCloud/upstat/models"
	"go.mongodb.org/mongo-driver/bson"
	"go.mongodb.org/mongo-driver/bson/primitive"
	"go.mongodb.org/mongo-driver/mongo"
	"go.mongodb.org/mongo-driver/mongo/options"
	"log"
	"os"
	"time"
)

type UserRepository interface {
	GetUser(email string) (*models.User, error)
	GetUsers() ([]*models.User, error)
	CreateUser(user models.User) (*mongo.InsertOneResult, error)
	UpdateUser(id string, user models.User) (*mongo.UpdateResult, error)
	DeleteUser(id string) (*mongo.DeleteResult, error)
}

type userRepository struct {
	connection *config.DB
}

func NewUserRepository(db *config.DB) UserRepository {
	return &userRepository{
		connection: db,
	}
}

func collectionHelper(db *config.DB) *mongo.Collection {
	// Get the collection name
	collectionName := "User"

	// Access the collection
	collection := db.Client.Database(os.Getenv("MONGO_DB")).Collection(collectionName)

	// Create index if it doesn't exist
	indexModel := mongo.IndexModel{
		Keys:    bson.D{{"email", 1}},
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

func (db *userRepository) GetUser(email string) (*models.User, error) {
	collection := collectionHelper(db.connection)
	var user models.User

	ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
	defer cancel()

	// Fetch user by email address
	filter := bson.M{"email": email}

	err := collection.FindOne(ctx, filter).Decode(&user)

	if err != nil {
		return nil, err
	}

	return &user, nil
}

func (db *userRepository) GetUsers() ([]*models.User, error) {
	collection := collectionHelper(db.connection)
	var users []*models.User
	ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
	defer cancel()

	cursor, err := collection.Find(ctx, bson.M{})
	if err != nil {
		return nil, err
	}

	defer func(cursor *mongo.Cursor, ctx context.Context) {
		err := cursor.Close(ctx)
		if err != nil {
			log.Println(err)
		}
	}(cursor, ctx)

	for cursor.Next(ctx) {
		var user models.User
		err := cursor.Decode(&user)
		if err != nil {
			return nil, err
		}
		users = append(users, &user)
	}

	return users, nil
}

func (db *userRepository) CreateUser(user models.User) (*mongo.InsertOneResult, error) {
	collection := collectionHelper(db.connection)
	ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
	defer cancel()

	newUser := models.User{
		Name:      user.Name,
		Email:     user.Email,
		Password:  user.Password,
		CreatedAt: time.Now(),
		UpdatedAt: time.Now(),
	}
	result, err := collection.InsertOne(ctx, newUser)
	if err != nil {
		return nil, err
	}

	return result, nil
}

func (db *userRepository) UpdateUser(id string, user models.User) (*mongo.UpdateResult, error) {
	collection := collectionHelper(db.connection)
	ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
	defer cancel()

	// Update only the fields that are passed in
	updatedUser := bson.M{}
	if user.Name != "" {
		updatedUser["name"] = user.Name
	}
	if user.Email != "" {
		updatedUser["email"] = user.Email
	}
	if user.Password != "" {
		updatedUser["password"] = user.Password
	}
	updatedUser["updated_at"] = time.Now()

	result, err := collection.UpdateOne(ctx, bson.M{"_id": id}, bson.M{"$set": updatedUser})
	if err != nil {
		return nil, err
	}

	return result, nil
}

func (db *userRepository) DeleteUser(id string) (*mongo.DeleteResult, error) {
	collection := collectionHelper(db.connection)
	ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
	defer cancel()

	oid, err := primitive.ObjectIDFromHex(id)

	result, err := collection.DeleteOne(ctx, bson.M{"_id": oid})
	if err != nil {
		return nil, err
	}

	return result, nil
}
