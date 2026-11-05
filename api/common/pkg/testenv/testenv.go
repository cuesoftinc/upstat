// Package testenv gates tests on external services: unset skips locally and
// fails when CI is set, so a suite that cannot run never passes the build.
package testenv

import (
	"os"
	"testing"
)

// Require returns the value of name; unset skips the test, or fails it under CI.
func Require(t testing.TB, name string) string {
	t.Helper()
	if v := os.Getenv(name); v != "" {
		return v
	}
	if os.Getenv("CI") != "" {
		t.Fatalf("%s not set under CI: the suite must run, not skip", name)
		return ""
	}
	t.Skipf("%s not set", name)
	return ""
}
