package config

import (
	"errors"
	"os"
	"sort"
	"strings"
	"time"

	"github.com/cuesoftinc/upstat/api/common/pkg/bus"
	"github.com/cuesoftinc/upstat/api/common/pkg/store"
)

// Config is everything api/common reads from the environment besides auth
// (auth.go) and the scheduler guard (scheduler.go). Names follow the shared
// environment-variable list (system-design.md §10.3).
type Config struct {
	Port        string
	DatabaseURL string
	Kafka       bus.Config
	Storage     store.Config
	Redis       Redis

	// Probes maps a region to its probe URL (PROBE_URLS: region=url,...).
	Probes map[string]string
	// QueryURL is api/query, for status-page bars, monitor history reads and
	// onboarding's has-data (§6.7).
	QueryURL string
	// InternalToken signs calls to api/query off Cloud Run (self-host).
	InternalToken string
	// OTLPEndpoint is the OpenTelemetry Collector that loads ClickHouse:
	// common sends each check result there as an OTLP log (X-11).
	OTLPEndpoint string
	// ClickHouseURL lets common apply the ClickHouse migrations it owns
	// (D3); empty skips them.
	ClickHouseURL      string
	ClickHouseUser     string
	ClickHousePassword string
	// ClickHouseQueryUser is the read-only user api/query connects as; the
	// row policies bind to it (S-9).
	ClickHouseQueryUser string

	// Wake: the consumers to start after publishing for them; empty
	// where services always run (compose, Helm).
	Wake Wake

	MonitorCapPerOrg int
	SelfHost         bool
}

// Wake targets: analytics (Python: evaluator, notifier, insights),
// observability (the NestJS gateway, a config reader) and query.
type Wake struct {
	Analytics     string
	Observability string
	Query         string
}

type Redis struct {
	Host     string
	Port     string
	Username string
	Password string
	TLS      bool
	DB       int
	Prefix   string
}

func Load() (*Config, error) {
	cfg := &Config{
		Port:        envOr("PORT", "8080"),
		DatabaseURL: os.Getenv("DATABASE_URL"),
		Kafka: bus.Config{
			Brokers:  splitCSV(envOr("KAFKA_BROKERS", "localhost:9092")),
			Username: os.Getenv("KAFKA_USERNAME"),
			Password: os.Getenv("KAFKA_PASSWORD"),
			SSLCA:    os.Getenv("KAFKA_SSL_CA"),
		},
		Storage: store.Config{
			Driver:    envOr("STORAGE_DRIVER", "gcs"),
			Bucket:    os.Getenv("STORAGE_BUCKET"),
			Prefix:    envOr("STORAGE_PREFIX", "upstat/local"),
			Endpoint:  os.Getenv("STORAGE_ENDPOINT"),
			AccessKey: os.Getenv("STORAGE_ACCESS_KEY"),
			SecretKey: os.Getenv("STORAGE_SECRET_KEY"),
			UseSSL:    strings.EqualFold(os.Getenv("STORAGE_USE_SSL"), "true"),
			Create:    true,
		},
		Redis: Redis{
			Host:     os.Getenv("REDIS_HOST"),
			Port:     envOr("REDIS_PORT", "6379"),
			Username: os.Getenv("REDIS_USERNAME"),
			Password: os.Getenv("REDIS_PASSWORD"),
			TLS:      strings.EqualFold(os.Getenv("REDIS_TLS"), "true"),
			DB:       envInt("REDIS_DB", 0),
			Prefix:   envOr("REDIS_KEY_PREFIX", "upstat:"),
		},
		Probes:              parseProbes(os.Getenv("PROBE_URLS")),
		QueryURL:            strings.TrimRight(os.Getenv("QUERY_URL"), "/"),
		InternalToken:       os.Getenv("INTERNAL_TOKEN"),
		OTLPEndpoint:        strings.TrimRight(os.Getenv("OTLP_LOADER_ENDPOINT"), "/"),
		ClickHouseURL:       strings.TrimRight(os.Getenv("CLICKHOUSE_URL"), "/"),
		ClickHouseUser:      envOr("CLICKHOUSE_MIGRATE_USER", "default"),
		ClickHousePassword:  os.Getenv("CLICKHOUSE_MIGRATE_PASSWORD"),
		ClickHouseQueryUser: envOr("CLICKHOUSE_QUERY_USER", "query_ro"),
		Wake: Wake{
			Analytics:     os.Getenv("WAKE_ANALYTICS_URL"),
			Observability: os.Getenv("WAKE_OBSERVABILITY_URL"),
			Query:         os.Getenv("WAKE_QUERY_URL"),
		},
		MonitorCapPerOrg: envInt("MONITOR_CAP_PER_ORG", 200),
		SelfHost:         strings.EqualFold(os.Getenv("SELF_HOST"), "true"),
	}
	if cfg.DatabaseURL == "" {
		return nil, errors.New("DATABASE_URL is required")
	}
	if cfg.Storage.Bucket == "" {
		return nil, errors.New("STORAGE_BUCKET is required")
	}
	return cfg, nil
}

// parseProbes reads region=url pairs; a bare URL is region "local".
func parseProbes(raw string) map[string]string {
	out := map[string]string{}
	for _, part := range splitCSV(raw) {
		region, url, ok := strings.Cut(part, "=")
		if !ok {
			region, url = "local", part
		}
		region, url = strings.TrimSpace(region), strings.TrimRight(strings.TrimSpace(url), "/")
		if region != "" && url != "" {
			out[region] = url
		}
	}
	return out
}

// Regions lists the configured probe regions in a stable order.
func (c *Config) Regions() []string {
	out := make([]string, 0, len(c.Probes))
	for r := range c.Probes {
		out = append(out, r)
	}
	sort.Strings(out)
	return out
}

// RunChecksEvery is the in-process loop's period when WORKER_ENABLED.
const RunChecksEvery = time.Minute
