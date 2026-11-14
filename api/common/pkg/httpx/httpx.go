// Package httpx holds the HTTP conventions api/common and api/query share:
// the ecosystem error envelope, JSON in and out, and the CORS contract
// (engineering.md).
package httpx

import (
	"bytes"
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

// JSONFallback answers requests the mux does not match with the shared error
// envelope. A matched route, including the mux's canonical redirects, passes
// through unchanged, so a wrong method keeps 405 and its Allow header.
func JSONFallback(mux *http.ServeMux) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if r.RequestURI == "*" {
			mux.ServeHTTP(w, r)
			return
		}
		h, pattern := mux.Handler(r)
		if pattern != "" {
			r.Pattern = pattern
			h.ServeHTTP(w, r)
			return
		}
		s := &statusOnly{ResponseWriter: w}
		h.ServeHTTP(s, r)
		switch s.code {
		case http.StatusNotFound:
			WriteError(w, http.StatusNotFound, "not_found", "Not found", nil)
		case http.StatusMethodNotAllowed:
			WriteError(w, http.StatusMethodNotAllowed, "method_not_allowed", "Method not allowed", nil)
		case 0:
			// No handler wrote anything; net/http sends an empty 200.
		default:
			w.WriteHeader(s.code)
			_, _ = w.Write(s.body.Bytes())
		}
	})
}

// statusOnly records the first status and the body, so the fallback can
// replace a 404 or 405 with the envelope or replay another response such as a
// canonical redirect. Headers pass through, preserving Allow and Location;
// WriteHeader is not forwarded, so the envelope can set its Content-Type.
type statusOnly struct {
	http.ResponseWriter
	code int
	body bytes.Buffer
}

func (s *statusOnly) WriteHeader(code int) {
	if s.code == 0 {
		s.code = code
	}
}

func (s *statusOnly) Write(p []byte) (int, error) {
	if s.code == 0 {
		s.code = http.StatusOK
	}
	s.body.Write(p)
	return len(p), nil
}

func (s *statusOnly) Unwrap() http.ResponseWriter { return s.ResponseWriter }

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
