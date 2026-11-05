// Package contract embeds the Kafka message JSON Schemas so api/common and
// api/query validate what they produce and consume against the same files
// the Python and Node services copy in at build time.
package contract

import "embed"

// Schemas holds every *.schema.json and the examples used by tests.
//
//go:embed *.schema.json examples/*.json
var Schemas embed.FS
