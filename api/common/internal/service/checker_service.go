package service

import (
	"context"
	"errors"
	"github.com/cuesoftinc/upstat/api/common/internal/model"
	"net/http"
	"time"
)

type checkExecutionResult struct {
	Status         string
	StatusCode     int
	ResponseTimeMs int64
	Error          string
	Attempts       int
}

func ExecuteHttpCheck(monitor *model.Monitor) checkExecutionResult {
	const maxAttempts = 3

	var result checkExecutionResult

	for attempt := 1; attempt <= maxAttempts; attempt++ {
		result = executeSingleHttpCheck(monitor)
		result.Attempts = attempt

		if result.Status == "up" {
			return result
		}

		if attempt < maxAttempts {
			time.Sleep(500 * time.Millisecond)
		}

	}

	return result
}

func executeSingleHttpCheck(monitor *model.Monitor) checkExecutionResult {
	timeout := time.Duration(monitor.TimeoutSeconds) * time.Second
	if timeout <= 0 {
		timeout = 10 * time.Second
	}

	client := &http.Client{Timeout: timeout}

	ctx, cancel := context.WithTimeout(context.Background(), timeout)
	defer cancel()

	req, err := http.NewRequestWithContext(ctx, http.MethodGet, monitor.Target, nil)
	if err != nil {
		return checkExecutionResult{Status: "down", Error: err.Error(), ResponseTimeMs: 0}
	}

	start := time.Now()
	resp, err := client.Do(req)
	responseTime := time.Since(start).Milliseconds()

	if err != nil {
		return checkExecutionResult{Status: "down", ResponseTimeMs: responseTime, Error: err.Error()}
	}

	defer resp.Body.Close()

	status := "up"
	errorMessage := ""
	if resp.StatusCode < 200 || resp.StatusCode >= 400 {
		status = "down"
		errorMessage = errors.New(resp.Status).Error()
	}

	return checkExecutionResult{
		Status:         status,
		StatusCode:     resp.StatusCode,
		ResponseTimeMs: responseTime,
		Error:          errorMessage,
	}
}
