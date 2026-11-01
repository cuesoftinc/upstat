package main

import (
	"context"
	"net/http"
	"net/http/httptest"
	"testing"
)

func TestFlushAfterWrites(t *testing.T) {
	ok := http.HandlerFunc(func(w http.ResponseWriter, _ *http.Request) { w.WriteHeader(http.StatusOK) })
	for _, tc := range []struct {
		method, path string
		want         bool
	}{
		{http.MethodPost, "/v1/monitors", true},
		{http.MethodPatch, "/v1/keys/1", true},
		{http.MethodDelete, "/v1/monitors/1", true},
		{http.MethodGet, "/v1/monitors", false},
		{http.MethodOptions, "/v1/monitors", false},
		{http.MethodPost, "/internal/jobs/run-checks", false},
	} {
		flushed := false
		h := flushAfterWrites(ok, func(context.Context) { flushed = true })
		h.ServeHTTP(httptest.NewRecorder(), httptest.NewRequest(tc.method, tc.path, nil))
		if flushed != tc.want {
			t.Errorf("%s %s flushed = %v; want %v", tc.method, tc.path, flushed, tc.want)
		}
	}
}
