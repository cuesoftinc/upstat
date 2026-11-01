// Package gcpauth signs service-to-service calls (system-design.md §8,
// machine identity): on Cloud Run a call carries an ID token for the target
// from the metadata server, which Cloud Run IAM checks at the target. Off
// Cloud Run (compose, self-host) calls go out unsigned on the private
// network.
package gcpauth

import (
	"context"
	"fmt"
	"io"
	"net/http"
	"net/url"
	"os"
	"strings"
	"sync"
	"time"
)

const metadataIdentity = "http://metadata.google.internal/computeMetadata/v1/instance/service-accounts/default/identity"

// OnCloudRun reports whether this process is a Cloud Run service or job.
func OnCloudRun() bool { return os.Getenv("K_SERVICE") != "" || os.Getenv("CLOUD_RUN_JOB") != "" }

// Signer caches one ID token per audience for most of its hour of life.
type Signer struct {
	client  *http.Client
	enabled bool

	mu     sync.Mutex
	tokens map[string]cached
}

type cached struct {
	token   string
	expires time.Time
}

// New returns a Signer that signs only on Cloud Run.
func New() *Signer {
	return &Signer{client: &http.Client{Timeout: 10 * time.Second}, enabled: OnCloudRun(), tokens: map[string]cached{}}
}

// Sign sets Authorization on req for audience (the target's base URL).
func (s *Signer) Sign(ctx context.Context, req *http.Request, audience string) error {
	if !s.enabled {
		return nil
	}
	token, err := s.token(ctx, audience)
	if err != nil {
		return err
	}
	req.Header.Set("Authorization", "Bearer "+token)
	return nil
}

func (s *Signer) token(ctx context.Context, audience string) (string, error) {
	s.mu.Lock()
	hit, ok := s.tokens[audience]
	s.mu.Unlock()
	if ok && time.Until(hit.expires) > 5*time.Minute {
		return hit.token, nil
	}
	req, err := http.NewRequestWithContext(ctx, http.MethodGet, metadataIdentity+"?audience="+url.QueryEscape(audience), nil)
	if err != nil {
		return "", err
	}
	req.Header.Set("Metadata-Flavor", "Google")
	res, err := s.client.Do(req)
	if err != nil {
		return "", err
	}
	defer res.Body.Close()
	body, err := io.ReadAll(io.LimitReader(res.Body, 64<<10))
	if err != nil {
		return "", err
	}
	if res.StatusCode != http.StatusOK {
		return "", fmt.Errorf("metadata status %d", res.StatusCode)
	}
	token := strings.TrimSpace(string(body))
	s.mu.Lock()
	s.tokens[audience] = cached{token: token, expires: time.Now().Add(55 * time.Minute)}
	s.mu.Unlock()
	return token, nil
}
