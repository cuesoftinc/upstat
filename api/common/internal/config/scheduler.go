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

// WorkerEnabled reports whether the in-process monitor loop starts at boot; it defaults to on.
func WorkerEnabled() bool {
	switch strings.ToLower(strings.TrimSpace(os.Getenv("WORKER_ENABLED"))) {
	case "0", "false", "off", "no":
		return false
	}
	return true
}
