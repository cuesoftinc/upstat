package bus

import (
	"encoding/json"
	"io/fs"
	"strings"
	"testing"

	"github.com/cuesoftinc/upstat/api/common/contract"
)

// Every example is a valid envelope whose data matches its event's schema,
// and every event has an example (the other services test against them).
func TestExamplesMatchTheContract(t *testing.T) {
	c, err := LoadContract()
	if err != nil {
		t.Fatal(err)
	}
	names, _ := fs.Glob(contract.Schemas, "examples/*.json")
	seen := map[string]bool{}
	for _, name := range names {
		raw, _ := contract.Schemas.ReadFile(name)
		if err := c.Validate("envelope", raw); err != nil {
			t.Errorf("%s: envelope: %v", name, err)
		}
		var env Envelope
		_ = json.Unmarshal(raw, &env)
		if err := c.Validate(env.Type, env.Data); err != nil {
			t.Errorf("%s: data: %v", name, err)
		}
		seen[env.Type] = true
	}
	for event := range TopicFor {
		if !seen[event] {
			t.Errorf("no example for %s", event)
		}
	}
}

func TestContractRejectsAnotherProductsType(t *testing.T) {
	c, _ := LoadContract()
	bad := `{"type":"acme.import.ready","version":"1.0","id":"c0ffee00-0000-4000-8000-000000000001","produced_at":"2026-10-28T12:00:00Z","data":{}}`
	if err := c.Validate("envelope", []byte(bad)); err == nil || !strings.Contains(err.Error(), "type") {
		t.Fatalf("expected the type pattern to reject it, got %v", err)
	}
}
