package testenv

import (
	"testing"
)

func TestRequireReturnsValue(t *testing.T) {
	t.Setenv("UPSTAT_TESTENV_PROBE", "x")
	if got := Require(t, "UPSTAT_TESTENV_PROBE"); got != "x" {
		t.Fatalf("got %q", got)
	}
}

type recorder struct {
	testing.TB
	failed, skipped bool
}

func (r *recorder) Helper()               {}
func (r *recorder) Fatalf(string, ...any) { r.failed = true }
func (r *recorder) Skipf(string, ...any)  { r.skipped = true }

func TestRequireFailsUnderCI(t *testing.T) {
	t.Setenv("CI", "true")
	r := &recorder{}
	Require(r, "UPSTAT_TESTENV_ABSENT")
	if !r.failed || r.skipped {
		t.Fatalf("failed=%v skipped=%v, want a failure under CI", r.failed, r.skipped)
	}
}

func TestRequireSkipsLocally(t *testing.T) {
	t.Setenv("CI", "")
	r := &recorder{}
	Require(r, "UPSTAT_TESTENV_ABSENT")
	if r.failed || !r.skipped {
		t.Fatalf("failed=%v skipped=%v, want a skip outside CI", r.failed, r.skipped)
	}
}
