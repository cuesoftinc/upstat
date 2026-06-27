package models

import (
	"time"
	"go.mongodb.org/mongo-driver/bson/primitive"
)

type Monitor struct {
	Id      primitive.ObjectID `json:"Id" bson:"_id"`
	OwnerId string             `json:"OwnerId" bson:"ownerId"`
	Name    string             `json:"Name" bson:"name"`
	Target  string             `json:"Target" bson:"target"`
	Type    string             `json:"Type" bson:"type"`

	Active              bool   `json:"Active" bson:"active"`
	Status              string `json:"Status" bson:"status"`
	IntervalSeconds     int    `json:"IntervalSeconds" bson:"intervalSeconds"`
	TimeoutSeconds      int    `json:"TimeOutSeconds" bson:"timeoutSeconds"`
	FailureThreshold    int    `json:"FailureThreshold" bson:"failureThreshold"`
	ConsecutiveFailures int    `json:"ConsecutiveFailures" bson:"consecutiveFailures"`

	LastCheckedAt      *time.Time `json:"LastCheckedAt" bson:"lastCheckedAt"`
	LastResponseTimeMs int64      `json:"LastResponseTimeMs" bson:"lastResponseTimeMs"`
	LastStatusCode     int        `json:"LastStatusCode" bson:"lastStatusCode"`

	CreatedAt time.Time `json:"Created_At" bson:"createdAt"`
	UpdatedAt time.Time `json:"Updated_At" bson:"updatedAt"`
}

type CheckResults struct {
	Id             primitive.ObjectID `json:"Id" bson:"Id"`
	MonitorID      string             `json:"MonitorID" bson:"monitorId"`
	CheckedAt      time.Time          `json:"checkedAt" bson:"checkedAt"`
	ResponseTimeMs int64              `json:"responseTimeMs" bson:"responseTimeMs"`
	Status         string             `json:"status" bson:"status"` 
	StatusCode     int                `json:"statusCode" bson:"statusCode"`
	Error          string             `json:"error" bson:"error,omitempty"`
	Attempts       int                `json:"attempts" bson:"attempts"`
	CreatedAt      time.Time          `json:"createdAt" bson:"createdAt"`
}

type Incident struct {
	Id              primitive.ObjectID `json:"Id" bson:"Id"`
	MonitorID       string             `json:"MonitorID" bson:"monitorId"`
	Title           string             `json:"Title" bson:"Title"`
	FailureReason   string             `json:"FailureReason" bson:"failureReason"`
	Status          string             `json:"Status" bson:"status"`
	StartedAt       time.Time          `json:"StartedAt" bson:"StartedAt"`
	ResolvedAt      *time.Time         `json:"ResolvedAt" bson:"ResolvedAt"`
	DurationSeconds int64              `json:"DurationSeconds" bson:"durationSeconds"`
	CreatedAt       time.Time          `json:"CreatedAt" bson:"createdAt"`
	UpdatedAt       time.Time          `json:"UpdatedAt" bson:"updatedAt"`
}

type MonitorInsight struct {
	Id                primitive.ObjectID `json:"Id" bson:"_id"`
	MonitorID         string             `json:"MonitorID" bson:"monitorId"`
	MonitorName       string             `json:"MonitorName" bson:"monitorName"`
	RiskScore         int                `json:"RiskScore" bson:"riskScore"`
	AnomalyDetected   bool               `json:"AnomalyDetected" bson:"anomalyDetected"`
	Severity          string             `json:"Severity" bson:"severity"`
	Summary           string             `json:"Summary" bson:"summary"`
    HumanReadable	  string			 `json:"HumanReadable" bson:"humanReadable"`	
	RecommendedAction string             `json:"RecommendedAction" bson:"recommendedAction"`
	GeneratedAt       time.Time          `json:"GeneratedAt" bson:"generatedAt"`
	CreatedAt         time.Time          `json:"CreatedAt" bson:"createdAt"`
	UpdatedAt         time.Time          `json:"UpdatedAt" bson:"updatedAt"`
}

type StatusPage struct {
	Id        primitive.ObjectID `json:"Id" bson:"Id"`
	OwnerId   string             `json:"OwnerId" bson:"OwnerId"`
	Name      string             `json:"Name" bson:"Name"`
	Slug      string             `json:"Slug" bson:"Slug"`
	CreatedAt time.Time          `json:"Created_At" bson:"Created_At"`
	UpdatedAt time.Time          `json:"Updated_At" bson:"updated_At"`
}
