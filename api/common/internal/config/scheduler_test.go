package config

import "testing"

func TestWorkerLoopNeverRunsOnCloudRun(t *testing.T) {
	t.Setenv("K_SERVICE", "common")
	t.Setenv("WORKER_ENABLED", "true")
	if WorkerEnabled() {
		t.Fatal("WorkerEnabled on Cloud Run = true; a background loop would stall between requests")
	}
	if !OnCloudRun() {
		t.Fatal("OnCloudRun = false with K_SERVICE set")
	}
}

func TestWorkerLoopDefaultsOnElsewhere(t *testing.T) {
	t.Setenv("K_SERVICE", "")
	t.Setenv("WORKER_ENABLED", "")
	if !WorkerEnabled() {
		t.Fatal("WorkerEnabled off Cloud Run = false; want the default on")
	}
	t.Setenv("WORKER_ENABLED", "off")
	if WorkerEnabled() {
		t.Fatal("WORKER_ENABLED=off ignored")
	}
}
