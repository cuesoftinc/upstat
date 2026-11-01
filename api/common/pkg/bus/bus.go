// Package bus is the Kafka transport on the CueLABS shared message bus
// (decisions.md X-11): event names and lanes, the envelope with its
// claim-check (every payload goes by data_ref, system-design.md §5.4), a
// producer for the outbox, and consumers that commit after their handler
// succeeds, or after a few failed attempts once the failure is recorded
// (never block a partition: the lanes are shared).
package bus

import (
	"context"
	"crypto/tls"
	"crypto/x509"
	"encoding/json"
	"errors"
	"fmt"
	"log/slog"
	"strings"
	"time"

	"github.com/google/uuid"
	kgo "github.com/segmentio/kafka-go"
	"github.com/segmentio/kafka-go/sasl/scram"
)

// Events (system-design.md §5.4): the envelope's type, and the schema its
// data must match (api/common/contract/<event>.schema.json).
const (
	EventConfigChanged   = "upstat.config.changed"
	EventSyntheticResult = "upstat.synthetics.result"
	EventVerifyRequested = "upstat.alerting.verify_requested"
	EventTransition      = "upstat.monitor.transition"
	EventDelivery        = "upstat.alerting.delivery"
	EventRuleEvaluated   = "upstat.rule.evaluated"
	EventSLOEvaluated    = "upstat.slo.evaluated"
	EventInsight         = "upstat.insights.generated"
)

// Topics are the lanes of the shared bus, which every product reads and
// writes; the event type says whose message it is.
const (
	TopicRequests = "cuelabs.requests" // control plane -> processing
	TopicResults  = "cuelabs.results"  // processing -> control plane
)

// Product prefixes every event type Upstat handles.
const Product = "upstat."

// TopicFor names the lane an event travels on.
var TopicFor = map[string]string{
	EventConfigChanged:   TopicRequests,
	EventSyntheticResult: TopicRequests,
	EventVerifyRequested: TopicRequests,
	EventTransition:      TopicResults,
	EventDelivery:        TopicResults,
	EventRuleEvaluated:   TopicResults,
	EventSLOEvaluated:    TopicResults,
	EventInsight:         TopicResults,
}

// Producers send envelopeVersion; consumers accept supportedMajor only.
const (
	envelopeVersion = "1.0"
	supportedMajor  = "1"
)

// Config is the shared Kafka service: one user, upstat (X-11).
type Config struct {
	Brokers  []string
	Username string
	Password string
	SSLCA    string
}

type Envelope struct {
	Type       string          `json:"type"`
	Version    string          `json:"version"`
	ID         string          `json:"id"`
	ProducedAt string          `json:"produced_at"`
	RequestID  string          `json:"request_id,omitempty"`
	Data       json.RawMessage `json:"data,omitempty"`
	DataRef    *ObjectRef      `json:"data_ref,omitempty"`
}

type ObjectRef struct {
	Bucket      string `json:"bucket"`
	Key         string `json:"key"`
	Size        int64  `json:"size,omitempty"`
	ContentType string `json:"content_type,omitempty"`
	SHA256      string `json:"sha256,omitempty"`
}

// Blobs is the slice of object storage the claim-check needs.
type Blobs interface {
	Bucket() string
	Prefix() string
	Put(ctx context.Context, key string, data []byte, contentType string) error
	Get(ctx context.Context, key string) ([]byte, error)
}

func dialer(cfg Config) (*kgo.Dialer, *kgo.Transport, error) {
	d := &kgo.Dialer{Timeout: 10 * time.Second, DualStack: true}
	t := &kgo.Transport{}
	if cfg.Username == "" {
		return d, t, nil
	}
	// SASL/SCRAM over TLS, the product's own Kafka user (X-11).
	mechanism, err := scram.Mechanism(scram.SHA256, cfg.Username, cfg.Password)
	if err != nil {
		return nil, nil, err
	}
	tlsCfg := &tls.Config{MinVersion: tls.VersionTLS12}
	if cfg.SSLCA != "" {
		pool := x509.NewCertPool()
		if !pool.AppendCertsFromPEM([]byte(cfg.SSLCA)) {
			return nil, nil, errors.New("KAFKA_SSL_CA is not a PEM certificate")
		}
		tlsCfg.RootCAs = pool
	}
	d.SASLMechanism, d.TLS = mechanism, tlsCfg
	t.SASL, t.TLS = mechanism, tlsCfg
	return d, t, nil
}

// Producer publishes envelopes; only the outbox publisher uses it.
type Producer struct {
	writer   *kgo.Writer
	contract *Contract
	blobs    Blobs
}

func NewProducer(cfg Config, contract *Contract, blobs Blobs) (*Producer, error) {
	_, transport, err := dialer(cfg)
	if err != nil {
		return nil, err
	}
	return &Producer{
		writer: &kgo.Writer{
			Addr:         kgo.TCP(cfg.Brokers...),
			Balancer:     &kgo.Hash{},
			RequiredAcks: kgo.RequireAll,
			Transport:    transport,
			BatchTimeout: 20 * time.Millisecond,
		},
		contract: contract,
		blobs:    blobs,
	}, nil
}

func (p *Producer) Close() error { return p.writer.Close() }

// Message builds a validated envelope for an event, addressed to its lane.
// The data goes to compute/ in storage and the message carries the pointer:
// every product can read the lanes. requestID is the piece of work the
// message belongs to, kept on re-send.
func (p *Producer) Message(ctx context.Context, event, key, requestID string, data json.RawMessage) (kgo.Message, error) {
	topic, ok := TopicFor[event]
	if !ok {
		return kgo.Message{}, fmt.Errorf("%w: no topic for event %s", ErrContract, event)
	}
	if err := p.contract.Validate(event, data); err != nil {
		return kgo.Message{}, fmt.Errorf("%w: %s: %v", ErrContract, event, err)
	}
	env := Envelope{Type: event, Version: envelopeVersion, ID: uuid.NewString(), ProducedAt: time.Now().UTC().Format(time.RFC3339Nano),
		RequestID: requestID}
	objKey := fmt.Sprintf("%s/compute/%s.json", p.blobs.Prefix(), env.ID)
	if err := p.blobs.Put(ctx, objKey, data, "application/json"); err != nil {
		return kgo.Message{}, err
	}
	env.DataRef = &ObjectRef{Bucket: p.blobs.Bucket(), Key: objKey, Size: int64(len(data)), ContentType: "application/json"}
	raw, err := json.Marshal(env)
	if err != nil {
		return kgo.Message{}, err
	}
	if err := p.contract.Validate("envelope", raw); err != nil {
		return kgo.Message{}, fmt.Errorf("%w: envelope: %v", ErrContract, err)
	}
	return kgo.Message{Topic: topic, Key: []byte(key), Value: raw}, nil
}

func (p *Producer) Write(ctx context.Context, msgs ...kgo.Message) error {
	return p.writer.WriteMessages(ctx, msgs...)
}

// Handler processes one validated payload. An error is retried a few times
// with backoff; ctx carries the message's request_id (RequestID).
type Handler func(ctx context.Context, data json.RawMessage) error

// Failure records, where the handler's domain allows, a message whose
// handler kept failing; the message is then committed.
type Failure func(ctx context.Context, data json.RawMessage, cause error) error

type requestIDKey struct{}

// RequestID is the request_id of the message being handled, or "".
func RequestID(ctx context.Context) string {
	id, _ := ctx.Value(requestIDKey{}).(string)
	return id
}

// WithRequestID hands a handler the request_id of its message.
func WithRequestID(ctx context.Context, id string) context.Context {
	return context.WithValue(ctx, requestIDKey{}, id)
}

const (
	handlerAttempts = 3
	retryBackoff    = time.Second
)

// Consumer reads one topic and routes each message to the handler for its
// event type. It never stops on a bad message: the lanes are shared.
type Consumer struct {
	reader   *kgo.Reader
	client   *kgo.Client
	group    string
	topic    string
	handlers map[string]Handler
	failures map[string]Failure
	contract *Contract
	blobs    Blobs
	attempts int
	backoff  time.Duration
	running  bool
}

// NewConsumer joins group (upstat-<service>) on topic.
func NewConsumer(cfg Config, group, topic string, handlers map[string]Handler, failures map[string]Failure, contract *Contract, blobs Blobs) (*Consumer, error) {
	d, t, err := dialer(cfg)
	if err != nil {
		return nil, err
	}
	return &Consumer{
		client: &kgo.Client{Addr: kgo.TCP(cfg.Brokers...), Transport: t, Timeout: 10 * time.Second},
		group:  group,
		reader: kgo.NewReader(kgo.ReaderConfig{
			Brokers:     cfg.Brokers,
			GroupID:     group,
			Topic:       topic,
			Dialer:      d,
			StartOffset: kgo.FirstOffset,
			MaxWait:     time.Second,
		}),
		topic: topic, handlers: handlers, failures: failures, contract: contract, blobs: blobs,
		attempts: handlerAttempts, backoff: retryBackoff,
	}, nil
}

func (c *Consumer) Running() bool { return c.running }

// Run blocks until ctx ends; nothing else stops it.
func (c *Consumer) Run(ctx context.Context) error {
	c.running = true
	defer func() { c.running = false; _ = c.reader.Close() }()
	for {
		msg, err := c.reader.FetchMessage(ctx)
		if err != nil {
			if ctx.Err() != nil {
				return nil
			}
			slog.Warn("fetch failed; retrying", "topic", c.topic, "error", err)
			if !sleep(ctx, c.backoff) {
				return nil
			}
			continue
		}
		if !c.process(ctx, msg.Offset, msg.Value) {
			return nil // ctx ended mid-work: leave the offset for redelivery
		}
		if err := c.reader.CommitMessages(ctx, msg); err != nil && ctx.Err() == nil {
			slog.Warn("commit failed; the message may be redelivered", "topic", c.topic, "offset", msg.Offset, "error", err)
		}
	}
}

// process handles one message and reports whether its offset may be
// committed; false only when ctx ended before the work finished.
func (c *Consumer) process(ctx context.Context, offset int64, raw []byte) bool {
	env, err := c.unwrap(raw)
	if errors.Is(err, errNotOurs) {
		return true // another product's event, or one this service doesn't handle
	}
	if err != nil {
		// Can never succeed; never log the payload (never-log list).
		slog.Error("dropping invalid message", "topic", c.topic, "offset", offset, "error", err)
		return true
	}
	ctx = WithRequestID(ctx, env.RequestID)
	var data json.RawMessage
	for attempt := 1; ; attempt++ {
		data, err = c.load(ctx, env)
		if errors.Is(err, ErrContract) {
			slog.Error("dropping invalid message", "topic", c.topic, "event", env.Type, "offset", offset, "request_id", env.RequestID, "error", err)
			return true
		}
		if err == nil {
			if err = c.handlers[env.Type](ctx, data); err == nil {
				return true
			}
		}
		if ctx.Err() != nil {
			return false
		}
		if attempt >= c.attempts {
			break
		}
		slog.Warn("handler failed; retrying", "topic", c.topic, "event", env.Type, "offset", offset, "request_id", env.RequestID,
			"attempt", attempt, "error", err)
		if !sleep(ctx, c.backoff<<(attempt-1)) {
			return false
		}
	}
	slog.Error("handler kept failing; recorded and skipped", "topic", c.topic, "event", env.Type, "offset", offset,
		"request_id", env.RequestID, "attempts", c.attempts, "error", err)
	if fail := c.failures[env.Type]; fail != nil && data != nil {
		if ferr := fail(ctx, data, err); ferr != nil {
			slog.Error("recording the failure failed", "event", env.Type, "offset", offset, "request_id", env.RequestID, "error", ferr)
		}
	}
	return ctx.Err() == nil
}

// CaughtUp reports whether the group has committed every message now on
// the topic, across all partitions and whichever instance holds them. On
// request-based CPU a consumer only makes progress inside a request, so a
// request that must see its messages handled waits for this (S-14).
func (c *Consumer) CaughtUp(ctx context.Context) (bool, error) {
	meta, err := c.client.Metadata(ctx, &kgo.MetadataRequest{Topics: []string{c.topic}})
	if err != nil {
		return false, err
	}
	if len(meta.Topics) != 1 || meta.Topics[0].Error != nil {
		return false, fmt.Errorf("metadata for %s: %v", c.topic, meta.Topics)
	}
	ids := make([]int, 0, len(meta.Topics[0].Partitions))
	reqs := make([]kgo.OffsetRequest, 0, 2*len(meta.Topics[0].Partitions))
	for _, p := range meta.Topics[0].Partitions {
		ids = append(ids, p.ID)
		reqs = append(reqs, kgo.FirstOffsetOf(p.ID), kgo.LastOffsetOf(p.ID))
	}
	offsets, err := c.client.ListOffsets(ctx, &kgo.ListOffsetsRequest{Topics: map[string][]kgo.OffsetRequest{c.topic: reqs}})
	if err != nil {
		return false, err
	}
	committed, err := c.client.OffsetFetch(ctx, &kgo.OffsetFetchRequest{GroupID: c.group, Topics: map[string][]int{c.topic: ids}})
	if err != nil {
		return false, err
	}
	if committed.Error != nil {
		return false, committed.Error
	}
	at := map[int]int64{}
	for _, p := range committed.Topics[c.topic] {
		if p.Error != nil {
			return false, p.Error
		}
		at[p.Partition] = p.CommittedOffset
	}
	for _, p := range offsets.Topics[c.topic] {
		if p.Error != nil {
			return false, p.Error
		}
		next, ok := at[p.Partition]
		if !ok || next < 0 {
			next = p.FirstOffset // never committed: the group starts at the first offset
		}
		if next < p.LastOffset {
			return false, nil
		}
	}
	return true, nil
}

// WaitCaughtUp polls CaughtUp until it holds or max passes.
func (c *Consumer) WaitCaughtUp(ctx context.Context, max time.Duration) error {
	ctx, cancel := context.WithTimeout(ctx, max)
	defer cancel()
	for {
		ok, err := c.CaughtUp(ctx)
		if ok {
			return nil
		}
		if !sleep(ctx, 250*time.Millisecond) {
			if err != nil {
				return err
			}
			return fmt.Errorf("%s: group %s still behind after %s", c.topic, c.group, max)
		}
	}
}

func sleep(ctx context.Context, d time.Duration) bool {
	t := time.NewTimer(d)
	defer t.Stop()
	select {
	case <-ctx.Done():
		return false
	case <-t.C:
		return true
	}
}

// ErrContract marks a message that can never be sent or handled as it is
// (it fails its schema, or carries a major version this code doesn't
// speak). Any other error (storage, say) is worth retrying.
var ErrContract = errors.New("violates the contract")

// errNotOurs marks a message this consumer skips without a word: the lanes
// are shared, so most messages on them belong to someone else.
var errNotOurs = errors.New("not handled here")

func (c *Consumer) unwrap(raw []byte) (*Envelope, error) {
	// Read the type first: other products' envelopes are not ours to validate.
	var head struct {
		Type string `json:"type"`
	}
	if json.Unmarshal(raw, &head) != nil || !strings.HasPrefix(head.Type, Product) {
		return nil, errNotOurs
	}
	if _, ok := c.handlers[head.Type]; !ok || TopicFor[head.Type] != c.topic {
		return nil, errNotOurs
	}
	if err := c.contract.Validate("envelope", raw); err != nil {
		return nil, fmt.Errorf("%w: envelope: %v", ErrContract, err)
	}
	var env Envelope
	if err := json.Unmarshal(raw, &env); err != nil {
		return nil, fmt.Errorf("%w: envelope: %v", ErrContract, err)
	}
	if major, _, _ := strings.Cut(env.Version, "."); major != supportedMajor {
		return nil, fmt.Errorf("%w: unsupported envelope version %s", ErrContract, env.Version)
	}
	return &env, nil
}

// load resolves the payload (the claim-check) and validates it.
func (c *Consumer) load(ctx context.Context, env *Envelope) (json.RawMessage, error) {
	data := env.Data
	if env.DataRef != nil {
		var err error
		if data, err = c.blobs.Get(ctx, env.DataRef.Key); err != nil {
			return nil, err
		}
	}
	if err := c.contract.Validate(env.Type, data); err != nil {
		return nil, fmt.Errorf("%w: %s: %v", ErrContract, env.Type, err)
	}
	return data, nil
}
