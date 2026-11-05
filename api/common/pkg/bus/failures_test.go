package bus

import (
	"context"
	"encoding/json"
	"errors"
	"io/fs"
	"sync/atomic"
	"testing"
	"time"

	"github.com/cuesoftinc/upstat/api/common/contract"
)

func exampleOf(t *testing.T, event string) []byte {
	t.Helper()
	names, _ := fs.Glob(contract.Schemas, "examples/*.json")
	for _, name := range names {
		raw, _ := contract.Schemas.ReadFile(name)
		var env Envelope
		_ = json.Unmarshal(raw, &env)
		if env.Type == event {
			return raw
		}
	}
	t.Fatalf("no example for %s", event)
	return nil
}

func testConsumer(t *testing.T, h Handler, attempts int) (*Consumer, *[]Failed) {
	t.Helper()
	c, err := LoadContract()
	if err != nil {
		t.Fatal(err)
	}
	var recorded []Failed
	cons := &Consumer{topic: TopicResults, handlers: map[string]Handler{EventTransition: h}, failures: map[string]Failure{},
		contract: c, attempts: attempts, backoff: time.Millisecond,
		record: func(_ context.Context, f Failed) error { recorded = append(recorded, f); return nil }}
	return cons, &recorded
}

// A handler that keeps failing is recorded whole (not just logged), and the
// consumer moves on.
func TestExhaustedHandlerIsRecordedWithTheMessage(t *testing.T) {
	var tries atomic.Int32
	cons, recorded := testConsumer(t, func(context.Context, json.RawMessage) error {
		tries.Add(1)
		return errors.New("db away")
	}, 3)
	raw := exampleOf(t, EventTransition)
	if !cons.process(context.Background(), 7, raw) {
		t.Fatal("process = false; want the offset committed so the lane never stalls")
	}
	if tries.Load() != 3 {
		t.Fatalf("handler tried %d times; want 3", tries.Load())
	}
	if len(*recorded) != 1 || (*recorded)[0].Event != EventTransition || string((*recorded)[0].Raw) != string(raw) || (*recorded)[0].Permanent {
		t.Fatalf("recorded %+v; want one retryable failure holding the message", *recorded)
	}
}

func TestInvalidMessageIsRecordedAsPermanent(t *testing.T) {
	cons, recorded := testConsumer(t, func(context.Context, json.RawMessage) error { return nil }, 3)
	bad := []byte(`{"type":"upstat.monitor.transition","version":"1.0","id":"c0ffee00-0000-4000-8000-000000000001","produced_at":"2026-10-28T12:00:00Z","data":{"nonsense":true}}`)
	if !cons.process(context.Background(), 1, bad) {
		t.Fatal("process = false")
	}
	if len(*recorded) != 1 || !(*recorded)[0].Permanent {
		t.Fatalf("recorded %+v; want one permanent failure", *recorded)
	}
}

func TestSuccessAndOtherProductsRecordNothing(t *testing.T) {
	cons, recorded := testConsumer(t, func(context.Context, json.RawMessage) error { return nil }, 3)
	cons.process(context.Background(), 1, exampleOf(t, EventTransition))
	cons.process(context.Background(), 2, []byte(`{"type":"acme.import.ready"}`))
	if len(*recorded) != 0 {
		t.Fatalf("recorded %+v; want nothing", *recorded)
	}
}

func TestReplayRunsTheHandlerOnceAndReportsItsError(t *testing.T) {
	var tries atomic.Int32
	want := errors.New("still down")
	cons, _ := testConsumer(t, func(context.Context, json.RawMessage) error { tries.Add(1); return want }, 3)
	if err := cons.Replay(context.Background(), exampleOf(t, EventTransition)); !errors.Is(err, want) || tries.Load() != 1 {
		t.Fatalf("replay = %v after %d tries; want the handler's error after one try", err, tries.Load())
	}
}
