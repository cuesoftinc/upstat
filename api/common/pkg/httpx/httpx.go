// Package httpx holds the HTTP conventions api/common and api/query share:
// the ecosystem error envelope, JSON in and out, and the CORS contract
// (engineering.md).
package httpx

import (
	"encoding/json"
	"errors"
	"io"
	"net/http"
	"strings"
)

// Error is the envelope body: {"error": {code, message, details}}.
type Error struct {
	Code    string         `json:"code"`
	Message string         `json:"message"`
	Details map[string]any `json:"details"`
}

func WriteJSON(w http.ResponseWriter, status int, body any) {
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(status)
	_ = json.NewEncoder(w).Encode(body)
}

func WriteError(w http.ResponseWriter, status int, code, message string, details map[string]any) {
	if details == nil {
		details = map[string]any{}
	}
	WriteJSON(w, status, map[string]Error{"error": {Code: code, Message: message, Details: details}})
}

func NoContent(w http.ResponseWriter) { w.WriteHeader(http.StatusNoContent) }

// RegisterNotFound answers every unmatched route with the error envelope.
// Pattern "/" is the mux's catch-all, so it also claims a known path called
// with an unregistered method (a plain net/http mux would answer 405).
func RegisterNotFound(mux *http.ServeMux) {
	mux.HandleFunc("/", func(w http.ResponseWriter, _ *http.Request) {
		WriteError(w, http.StatusNotFound, "not_found", "Not found", nil)
	})
}

// maxBody bounds every JSON request body.
const maxBody = 1 << 20

// ErrBadJSON is a body that is not one JSON value of the expected shape.
var ErrBadJSON = errors.New("malformed JSON body")

// ReadJSON decodes one JSON value into dst.
func ReadJSON(r *http.Request, dst any) error {
	body, err := io.ReadAll(io.LimitReader(r.Body, maxBody+1))
	if err != nil || len(body) > maxBody {
		return ErrBadJSON
	}
	dec := json.NewDecoder(strings.NewReader(string(body)))
	if err := dec.Decode(dst); err != nil {
		return ErrBadJSON
	}
	return nil
}

// CORS answers preflights and echoes allowed origins (engineering.md, CORS
// contract). credentials is true where the session cookie may ride along.
func CORS(allowed func(origin string) bool, credentials bool, next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		origin := r.Header.Get("Origin")
		w.Header().Add("Vary", "Origin")
		if origin != "" && allowed(origin) {
			w.Header().Set("Access-Control-Allow-Origin", origin)
			if credentials {
				w.Header().Set("Access-Control-Allow-Credentials", "true")
			}
			w.Header().Set("Access-Control-Expose-Headers", "Retry-After, X-Request-Id")
		}
		if r.Method == http.MethodOptions && r.Header.Get("Access-Control-Request-Method") != "" {
			if origin != "" && allowed(origin) {
				w.Header().Set("Access-Control-Allow-Methods", "GET, POST, PUT, PATCH, DELETE, OPTIONS")
				w.Header().Set("Access-Control-Allow-Headers", "Authorization, Content-Type, Idempotency-Key, X-Org-Id, X-Request-Id")
				w.Header().Set("Access-Control-Max-Age", "600")
			}
			w.WriteHeader(http.StatusNoContent)
			return
		}
		next.ServeHTTP(w, r)
	})
}
