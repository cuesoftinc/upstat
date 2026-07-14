package service

import (
	"context"
	"github.com/CuesoftCloud/upstat/internal/config"
	"github.com/CuesoftCloud/upstat/internal/model"
	"github.com/CuesoftCloud/upstat/internal/repository"
	"log"
	"sync"
	"time"
)

type MonitorWorker struct {
	MonitorRepo     repository.MonitorRepository
	CheckResultRepo repository.CheckResultRepository
	IncidentRepo    repository.IncidentRepository
	Concurrency     int
	PollInterval    time.Duration
}

func NewMonitorWorker(db *config.DB) *MonitorWorker {
	return &MonitorWorker{
		MonitorRepo:     repository.NewMonitorRepository(db),
		CheckResultRepo: repository.NewCheckResultRepository(db),
		IncidentRepo:    repository.NewIncidentRepository(db),
		Concurrency:     10,
		PollInterval:    5 * time.Second,
	}
}

func (w *MonitorWorker) Start(ctx context.Context) {
	ticker := time.NewTicker(w.PollInterval)
	defer ticker.Stop()

	w.runOnce()

	for {
		select {
		case <-ctx.Done():
			log.Println("monitor worker stopped")
			return
		case <-ticker.C:
			w.runOnce()
		}
	}
}

func (w *MonitorWorker) runOnce() {
	monitors, err := w.MonitorRepo.ListActiveMonitors()
	if err != nil {
		log.Println("could not list active monitors")
		return
	}

	sem := make(chan struct{}, w.Concurrency)
	var wg sync.WaitGroup

	for _, monitor := range monitors {
		if !shouldRunMonitor(monitor) {
			continue
		}

		wg.Add(1)
		sem <- struct{}{}

		go func(m *model.Monitor) {
			defer wg.Done()
			defer func() { <-sem }()

			if err := w.processMonitor(m); err != nil {
				log.Println("monitor check failed", err)
			}
		}(monitor)
	}
	wg.Wait()

}

func shouldRunMonitor(monitor *model.Monitor) bool {
	if monitor.LastCheckedAt == nil {
		return true
	}

	interval := time.Duration(monitor.IntervalSeconds) * time.Second
	if interval <= 0 {
		interval = 60 * time.Second
	}

	return time.Since(*monitor.LastCheckedAt) >= interval

}

func (w *MonitorWorker) processMonitor(monitor *model.Monitor) error {
	result := ExecuteHttpCheck(monitor)

	checkResult := model.CheckResults{
		MonitorID:      monitor.Id.Hex(),
		CheckedAt:      time.Now(),
		ResponseTimeMs: result.ResponseTimeMs,
		Status:         result.Status,
		StatusCode:     result.StatusCode,
		Error:          result.Error,
		Attempts:       result.Attempts,
	}

	if _, err := w.CheckResultRepo.CreateCheckResult(checkResult); err != nil {
		return err
	}

	consecutiveFailures := monitor.ConsecutiveFailures

	if result.Status == "up" {
		consecutiveFailures = 0

		if err := w.IncidentRepo.ResolveActiveIncidents(monitor.Id); err != nil {
			return err
		}

		return w.MonitorRepo.UpdateAfterCheck(
			monitor.Id,
			"up",
			result.StatusCode,
			result.ResponseTimeMs,
			consecutiveFailures,
		)
	}

	consecutiveFailures++

	nextStatus := monitor.Status
	if consecutiveFailures >= monitor.FailureThreshold {
		nextStatus = "down"

		activeIncident, err := w.IncidentRepo.GetActiveIncidentForMonitor(monitor.Id)
		if err != nil {
			return err
		}

		if activeIncident == nil {
			_, err := w.IncidentRepo.CreateIncident(&model.Incident{
				MonitorID:     monitor.Id.Hex(),
				Title:         monitor.Name + " is down",
				FailureReason: failureReason(result),
				Status:        "active",
			})
			if err != nil {
				return err
			}
		}
	}

	return w.MonitorRepo.UpdateAfterCheck(
		monitor.Id,
		nextStatus,
		result.StatusCode,
		result.ResponseTimeMs,
		consecutiveFailures,
	)

}

func failureReason(result checkExecutionResult) string {
	if result.Error != "" {
		return result.Error
	}

	if result.StatusCode > 0 {
		return "received unhealthy status code"
	}

	return "monitor check failed"
}
