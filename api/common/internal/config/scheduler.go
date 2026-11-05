package config

import (
	"os"
	"strings"
)

type Scheduler struct {
	Audience     string
	InvokerEmail string
}

// LoadScheduler reads the scheduler OIDC settings from the environment on every call.
func LoadScheduler() Scheduler {
	return Scheduler{
		Audience:     strings.TrimRight(strings.TrimSpace(os.Getenv("SCHEDULER_AUDIENCE")), "/"),
		InvokerEmail: strings.TrimSpace(os.Getenv("SCHEDULER_INVOKER_EMAIL")),
	}
}

func (s Scheduler) Configured() bool {
	return s.Audience != "" && s.InvokerEmail != ""
}

// OnCloudRun reports whether the process runs as a Cloud Run service.
func OnCloudRun() bool { return os.Getenv("K_SERVICE") != "" }

// WorkerEnabled reports whether the in-process monitor loop starts at boot; it defaults to on
// and is never on Cloud Run, where request-based CPU stalls a background loop.
func WorkerEnabled() bool {
	if OnCloudRun() {
		return false
	}
	switch strings.ToLower(strings.TrimSpace(os.Getenv("WORKER_ENABLED"))) {
	case "0", "false", "off", "no":
		return false
	}
	return true
}
