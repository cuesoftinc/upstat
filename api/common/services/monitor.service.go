package services

import (
	"context"
	"os"
	"time"

	"github.com/CuesoftCloud/upstat/config"
	"github.com/CuesoftCloud/upstat/models"
	pb "github.com/CuesoftCloud/upstat/proto"
	"github.com/CuesoftCloud/upstat/repositories"
	"github.com/CuesoftCloud/upstat/utils"
	"google.golang.org/grpc"
	"google.golang.org/grpc/codes"
	"google.golang.org/grpc/status"
)

type MonitorServiceServer struct {
	pb.UnimplementedMonitorServiceServer
	MonitorRepo     repositories.MonitorRepository
	CheckResultRepo repositories.CheckResultRepository
	IncidentRepo    repositories.IncidentRepository
	InsightGRPCConn *grpc.ClientConn
	InsightClient   pb.InsightServiceClient
}

func NewMonitorServiceServer(db *config.DB) *MonitorServiceServer {
	insightServiceAddr := os.Getenv("INSIGHT_SERVICE_GRPC_ADDRESS")
	if insightServiceAddr == "" {
		insightServiceAddr = "localhost:50051"
	}

	//go: fix inline 
	//this thing no work? omo😂
	conn, err := grpc.Dial(insightServiceAddr, grpc.WithInsecure())
	if err != nil {
		return nil
	}

	var insightClient pb.InsightServiceClient
	if conn != nil {
		insightClient = pb.NewInsightServiceClient(conn)
	}

	return &MonitorServiceServer{
		MonitorRepo:     repositories.NewMonitorRepository(db),
		CheckResultRepo: repositories.NewCheckResultRepository(db),
		IncidentRepo:    repositories.NewIncidentRepository(db),
		InsightGRPCConn: conn,
		InsightClient:   insightClient,
	}
}

func (s *MonitorServiceServer) CreateMonitor(ctx context.Context, req *pb.CreateMonitorRequest) (*pb.MonitorResponse, error) {
	ownerID, ok := utils.UserIDFromContext(ctx)

	if !ok || ownerID == "" {
		return nil, status.Error(codes.Unauthenticated, "missing authentiacated user")
	}

	if req.GetName() == "" || req.GetType() == "" || req.GetTarget() == "" {
		return nil, status.Error(codes.InvalidArgument, "name, type and target required")
	}

	monitor, err := s.MonitorRepo.CreateMonitor(models.Monitor{
		OwnerId:             ownerID,
		Name:                req.GetName(),
		Target:              req.GetTarget(),
		Type:                req.GetType(),
		Active:              true,
		Status:              "unknown",
		IntervalSeconds:     60,
		TimeoutSeconds:      10,
		FailureThreshold:    3,
		ConsecutiveFailures: 0,
	})

	if err != nil {
		return nil, status.Error(codes.Internal, "internal server error, could not create monitor")
	}

	return &pb.MonitorResponse{
		Monitor: monitorResponse(monitor),
		Status:  "success",
	}, nil

}

func (s *MonitorServiceServer) GetMonitor(ctx context.Context, req *pb.GetMonitorRequest) (*pb.MonitorResponse, error) {

	ownerID, ok := utils.UserIDFromContext(ctx)

	if !ok || ownerID == "" {
		return nil, status.Error(codes.Unauthenticated, "User is not authenticated")
	}

	if req.GetId() == "" {
		return nil, status.Error(codes.InvalidArgument, "please pass a monitor id")
	}

	monitor, err := s.MonitorRepo.GetMonitor(req.GetId(), ownerID)

	if err != nil {
		return nil, err
	}

	return &pb.MonitorResponse{
		Monitor: monitorResponse(monitor),
		Status:  "success",
	}, nil

}

func (s *MonitorServiceServer) UpdateMonitor(ctx context.Context, req *pb.UpdateMonitorRequest) (*pb.MonitorResponse, error) {

	ownerID, ok := utils.UserIDFromContext(ctx)

	if !ok || ownerID == "" {
		return nil, status.Error(codes.Unauthenticated, "user is not authenticated")
	}

	if req.GetId() == "" || req.GetName() == "" || req.GetType() == "" || req.GetTarget() == "" {
		return nil, status.Error(codes.InvalidArgument, "id, name, type and target required")
	}

	monitor, err := s.MonitorRepo.UpdateMonitor(req.GetId(), ownerID, models.Monitor{
		OwnerId: ownerID,
		Name:    req.GetName(),
		Type:    req.GetType(),
		Target:  req.GetTarget(),
	})

	if err != nil {
		return nil, status.Error(codes.NotFound, "monitor not found")
	}

	return &pb.MonitorResponse{
		Monitor: monitorResponse(monitor),
		Status:  "success",
	}, nil

}

func (s *MonitorServiceServer) DeleteMonitor(ctx context.Context, req *pb.DeleteMonitorRequest) (*pb.DeleteMonitorResponse, error) {
	ownerID, ok := utils.UserIDFromContext(ctx)

	if !ok || ownerID == "" {
		return nil, status.Error(codes.Unauthenticated, "user is not authenticated")
	}

	if req.GetId() == "" {
		return nil, status.Error(codes.InvalidArgument, "monitor ID is required")
	}

	result, err := s.MonitorRepo.DeleteMonitor(req.GetId(), ownerID)
	if err != nil {
		return nil, err
	}

	if result.DeletedCount == 0 {
		return nil, status.Error(codes.NotFound, "monitor was not found; nothing was deleted")
	}

	return &pb.DeleteMonitorResponse{
		Data:   "Monitor Deleted",
		Status: "success",
	}, nil
}

func (s *MonitorServiceServer) ListMonitors(ctx context.Context, req *pb.ListMonitorsRequest) (*pb.ListMonitorsResponse, error) {

	ownerID, ok := utils.UserIDFromContext(ctx)

	if !ok || ownerID == "" {
		return nil, status.Error(codes.Unauthenticated, "user is not authenticated")
	}

	monitor, err := s.MonitorRepo.ListMonitors(ownerID)

	if err != nil {
		return nil, err
	}

	return &pb.ListMonitorsResponse{
		Monitors: monitorsResponse(monitor),
	}, nil

}

func (s *MonitorServiceServer) GetStatusPage(
	ctx context.Context,
	req *pb.GetStatusPageRequest,
) (*pb.GetStatusPageResponse, error) {
	if req.GetOwnerId() == "" {
		return nil, status.Error(codes.InvalidArgument, "owner_id is required")
	}
	monitors, err := s.MonitorRepo.ListMonitors(req.GetOwnerId())
	if err != nil {
		return nil, status.Error(codes.Internal, "could not list monitors")
	}

	monitorIDs := monitorIDs(monitors)

	activeIncidents, err := s.IncidentRepo.ListActiveIncidentsByMonitors(monitorIDs)
	if err != nil {
		return nil, status.Error(codes.Internal, "could not list active incidents")
	}

	historicalIncidents, err := s.IncidentRepo.ListResolvedIncidentsByMonitors(monitorIDs, 50)
	if err != nil {
		return nil, status.Error(codes.Internal, "could not list historical incidents")
	}

	totalChecks, successfulChecks, uptimePercentage, err := s.recentUptimeStats(monitors)
	if err != nil {
		return nil, status.Error(codes.Internal, "could not calculate uptime statistics")
	}

	return &pb.GetStatusPageResponse{
		Monitors:            monitorsResponse(monitors),
		ActiveIncidents:     incidentsResponse(activeIncidents),
		HistoricalIncidents: incidentsResponse(historicalIncidents),
		UptimePercentage:    uptimePercentage,
		TotalChecks:         totalChecks,
		SuccessfulChecks:    successfulChecks,
	}, nil
}

func (s *MonitorServiceServer) GetRecentChecks(ctx context.Context, req *pb.GetRecentChecksRequest) (*pb.GetRecentChecksResponse, error) {
	if req.GetMonitorId() == "" {
		return nil, status.Error(codes.InvalidArgument, "monitor_id is required")
	}

	limit := req.GetLimit()
	if limit <= 0 {
		limit = 50
	}

	checks, err := s.CheckResultRepo.ListRecentByMonitor(req.GetMonitorId(), int64(limit))
	if err != nil {
		return nil, status.Error(codes.Internal, "could not retrieve recent checks")
	}

	protoChecks := make([]*pb.MonitorCheck, 0, len(checks))
	for _, check := range checks {
		protoChecks = append(protoChecks, &pb.MonitorCheck{
			MonitorId:    check.MonitorID,
			Success:      check.Status == "up",
			ResponseTime: int32(check.ResponseTimeMs),
			StatusCode:   int32(check.StatusCode),
			CheckedAt:    check.CheckedAt.Format(time.RFC3339),
		})
	}

	return &pb.GetRecentChecksResponse{
		Checks: protoChecks,
	}, nil
}

func (s *MonitorServiceServer) GetMonitorInsight(ctx context.Context, req *pb.GetMonitorInsightRequest) (*pb.GetMonitorInsightResponse, error) {
	if req.GetMonitorId() == "" {
		return nil, status.Error(codes.InvalidArgument, "monitor_id is required")
	}

	if s.InsightClient == nil {
		return nil, status.Error(codes.Unavailable, "insight service not available")
	}

	insightResp, err := s.InsightClient.GetMonitorInsight(ctx, req)
	if err != nil {
		return nil, err
	}

	return insightResp, nil
}

func (s *MonitorServiceServer) recentUptimeStats(monitors []*models.Monitor) (int64, int64, float64, error) {
	since := time.Now().Add(-24 * time.Hour)

	var totalChecks int64
	var successfulChecks int64

	for _, monitor := range monitors {
		monitorID := monitor.Id.Hex()

		total, err := s.CheckResultRepo.CountTotalSince(monitorID, since)
		if err != nil {
			return 0, 0, 0, err
		}

		successful, err := s.CheckResultRepo.CountSuccessfulSince(monitorID, since)
		if err != nil {
			return 0, 0, 0, err
		}

		totalChecks += total
		successfulChecks += successful
	}

	if totalChecks == 0 {
		return 0, 0, 0, nil
	}

	uptimePercentage := (float64(successfulChecks) / float64(totalChecks)) * 100
	return totalChecks, successfulChecks, uptimePercentage, nil
}

func monitorIDs(monitors []*models.Monitor) []string {
	ids := make([]string, 0, len(monitors))

	for _, monitor := range monitors {
		ids = append(ids, monitor.Id.Hex())
	}

	return ids
}

func monitorsResponse(monitors []*models.Monitor) []*pb.Monitor {
	response := make([]*pb.Monitor, 0, len(monitors))

	for _, monitor := range monitors {
		response = append(response, monitorResponse(monitor))
	}

	return response
}

func monitorResponse(monitor *models.Monitor) *pb.Monitor {
	lastCheckedAt := ""
	if monitor.LastCheckedAt != nil {
		lastCheckedAt = monitor.LastCheckedAt.Format(time.RFC3339)
	}

	return &pb.Monitor{
		Id:                  monitor.Id.Hex(),
		OwnerId:             monitor.OwnerId,
		Name:                monitor.Name,
		Target:              monitor.Target,
		Type:                monitor.Type,
		CreatedAt:           monitor.CreatedAt.Format(time.RFC3339),
		UpdatedAt:           monitor.UpdatedAt.Format(time.RFC3339),
		Active:              monitor.Active,
		Status:              monitor.Status,
		IntervalSeconds:     int32(monitor.IntervalSeconds),
		TimeoutSeconds:      int32(monitor.TimeoutSeconds),
		FailureThreshold:    int32(monitor.FailureThreshold),
		ConsecutiveFailures: int32(monitor.ConsecutiveFailures),
		LastCheckedAt:       lastCheckedAt,
		LastResponseTimeMs:  monitor.LastResponseTimeMs,
		LastStatusCode:      int32(monitor.LastStatusCode),
	}
}

func incidentsResponse(incidents []*models.Incident) []*pb.Incident {
	response := make([]*pb.Incident, 0, len(incidents))

	for _, incident := range incidents {
		response = append(response, incidentResponse(incident))
	}

	return response
}

func incidentResponse(incident *models.Incident) *pb.Incident {
	resolvedAt := ""
	if incident.ResolvedAt != nil {
		resolvedAt = incident.ResolvedAt.Format(time.RFC3339)
	}

	return &pb.Incident{
		Id:              incident.Id.Hex(),
		MonitorId:       incident.MonitorID,
		Title:           incident.Title,
		FailureReason:   incident.FailureReason,
		Status:          incident.Status,
		StartedAt:       incident.StartedAt.Format(time.RFC3339),
		ResolvedAt:      resolvedAt,
		DurationSeconds: incident.DurationSeconds,
	}
}
