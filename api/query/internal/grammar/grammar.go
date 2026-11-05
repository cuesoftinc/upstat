// Package grammar parses the shared query grammar (docs/query-grammar.md)
// into AST v1, the structure the web already defines
// (web/src/models/query.ts) and widgets and rules persist. Errors carry the
// byte position and a hint, because an unknown facet is an error, never an
// empty result (§3).
package grammar

import (
	"fmt"
	"strconv"
	"strings"
	"unicode"
)

// Term is one node of the filter tree: exactly one shape is set.
type Term struct {
	Facet string `json:"facet,omitempty"`
	Cmp   string `json:"cmp,omitempty"`
	Value any    `json:"value,omitempty"`

	Op    string `json:"op,omitempty"`
	Terms []Term `json:"terms,omitempty"`

	Not *Term `json:"not,omitempty"`

	Text *string `json:"text,omitempty"`
}

type Group struct {
	Op    string `json:"op"`
	Terms []Term `json:"terms"`
}

type Agg struct {
	Fn    string `json:"fn"`
	Field string `json:"field,omitempty"`
}

// AST is AST v1 (query-grammar.md §4).
type AST struct {
	V       int      `json:"v"`
	Filters Group    `json:"filters"`
	Agg     []Agg    `json:"agg,omitempty"`
	GroupBy []string `json:"group_by,omitempty"`
	Step    string   `json:"step,omitempty"`
}

// Error is an invalid_query with its position (query-grammar.md §3).
type Error struct {
	Position int    `json:"position"`
	Message  string `json:"message"`
	Hint     string `json:"hint,omitempty"`
}

func (e *Error) Error() string { return fmt.Sprintf("at %d: %s", e.Position, e.Message) }

// Functions are the aggregations (§1).
var Functions = map[string]bool{"count": true, "rate": true, "sum": true, "avg": true, "min": true, "max": true,
	"p50": true, "p95": true, "p99": true, "uniq": true}

// coreFacets apply to every signal (§2); the prefixed namespaces are
// checked by prefix.
var coreFacets = map[string]bool{"service": true, "env": true, "host": true, "status": true, "level": true,
	"metric": true, "check": true, "region": true, "on": true, "name": true}

// numericFacets accept comparators; numeric comparators on any other
// facet are invalid_query (§4 typing). Custom @attributes and metric tags
// are untyped, so they accept both.
func numericFacet(f string) bool {
	switch {
	case f == "trace.duration_ms", f == "response_time_ms", f == "status_code":
		return true
	case strings.HasPrefix(f, "rum.vital."), strings.HasPrefix(f, "@"), strings.HasPrefix(f, "metric."):
		return true
	}
	return false
}

// KnownFacet reports whether a facet name is in the namespace (§2).
func KnownFacet(f string) bool {
	return coreFacets[f] || strings.HasPrefix(f, "trace.") || strings.HasPrefix(f, "rum.") ||
		strings.HasPrefix(f, "metric.") || (strings.HasPrefix(f, "@") && len(f) > 1)
}

type parser struct {
	src string
	pos int
}

// Parse parses a query string.
func Parse(q string) (*AST, error) {
	p := &parser{src: q}
	ast := &AST{V: 1, Filters: Group{Op: "and", Terms: []Term{}}, Step: "auto"}
	p.space()
	for !p.eof() && p.peek() != '|' {
		t, err := p.term()
		if err != nil {
			return nil, err
		}
		ast.Filters.Terms = append(ast.Filters.Terms, *t)
		if err := p.separator(); err != nil {
			return nil, err
		}
	}
	if p.eof() {
		return ast, nil
	}
	p.pos++ // |
	p.space()
	if p.eof() {
		return nil, p.fail("aggregation expected after |", "for example count() or p95(trace.duration_ms)")
	}
	for {
		agg, err := p.agg()
		if err != nil {
			return nil, err
		}
		ast.Agg = append(ast.Agg, *agg)
		p.space()
		if p.eof() || p.peek() != ',' {
			break
		}
		p.pos++
		p.space()
	}
	if p.word("by") {
		p.space()
		for {
			start := p.pos
			f := p.ident()
			if f == "" {
				return nil, &Error{Position: start, Message: "facet expected after by"}
			}
			ast.GroupBy = append(ast.GroupBy, f)
			p.space()
			if p.eof() || p.peek() != ',' {
				break
			}
			p.pos++
			p.space()
		}
	}
	p.space()
	if !p.eof() {
		if p.peek() == '|' {
			return nil, p.fail("only one | segment allowed", "")
		}
		return nil, p.fail(fmt.Sprintf("unexpected %q", p.rest()), "aggregations are separated by commas")
	}
	return ast, nil
}

// separator requires whitespace, a closing paren or the end after a term.
func (p *parser) separator() error {
	if p.eof() || p.peek() == ')' {
		return nil
	}
	if !unicode.IsSpace(rune(p.peek())) && p.peek() != '|' {
		return p.fail(fmt.Sprintf("unexpected %q", string(p.peek())), "separate terms with a space")
	}
	p.space()
	return nil
}

func (p *parser) eof() bool    { return p.pos >= len(p.src) }
func (p *parser) peek() byte   { return p.src[p.pos] }
func (p *parser) rest() string { return p.src[p.pos:] }

func (p *parser) space() {
	for !p.eof() && unicode.IsSpace(rune(p.peek())) {
		p.pos++
	}
}

func (p *parser) fail(msg, hint string) *Error {
	return &Error{Position: p.pos, Message: msg, Hint: hint}
}

// word consumes keyword kw when it stands alone.
func (p *parser) word(kw string) bool {
	if !strings.HasPrefix(p.rest(), kw) {
		return false
	}
	end := p.pos + len(kw)
	if end < len(p.src) && !unicode.IsSpace(rune(p.src[end])) && p.src[end] != '(' && p.src[end] != ')' {
		return false
	}
	p.pos = end
	return true
}

func identByte(c byte, first bool) bool {
	if c >= 'a' && c <= 'z' || c == '@' || c == '_' {
		return true
	}
	return !first && (c >= '0' && c <= '9' || c == '.' || c == '-' || c >= 'A' && c <= 'Z')
}

func (p *parser) ident() string {
	start := p.pos
	for !p.eof() && identByte(p.peek(), p.pos == start) {
		p.pos++
	}
	return p.src[start:p.pos]
}

// term := '-' term | '(' or-expr ')' | facet ':' [op] value | text
func (p *parser) term() (*Term, error) {
	switch c := p.peek(); {
	case c == '-':
		p.pos++
		if p.eof() || unicode.IsSpace(rune(p.peek())) {
			return nil, p.fail("term expected after -", "")
		}
		inner, err := p.term()
		if err != nil {
			return nil, err
		}
		return &Term{Not: inner}, nil
	case c == '(':
		return p.group()
	case c == ')':
		return nil, p.fail("unexpected )", "")
	case c == '"':
		s, err := p.quoted()
		if err != nil {
			return nil, err
		}
		return &Term{Text: &s}, nil
	}
	start := p.pos
	name := p.ident()
	if name != "" && !p.eof() && p.peek() == ':' {
		if !KnownFacet(name) {
			return nil, &Error{Position: start, Message: "unknown facet: " + name,
				Hint: "facets are service, env, host, status, level, metric, check, region, trace.*, rum.*, metric.* or @attribute"}
		}
		p.pos++ // :
		return p.facetValue(start, name)
	}
	p.pos = start
	word := p.bare()
	if word == "" {
		return nil, p.fail(fmt.Sprintf("unexpected %q", string(p.peek())), "")
	}
	if strings.Contains(word, ":") {
		return nil, &Error{Position: start, Message: "facet names are lowercase: " + word}
	}
	return &Term{Text: &word}, nil
}

func (p *parser) facetValue(start int, facet string) (*Term, error) {
	cmp := "eq"
	for _, op := range []struct{ tok, cmp string }{{">=", "gte"}, {"<=", "lte"}, {">", "gt"}, {"<", "lt"}, {"=", "eq"}} {
		if strings.HasPrefix(p.rest(), op.tok) {
			cmp = op.cmp
			p.pos += len(op.tok)
			break
		}
	}
	valuePos := p.pos
	var raw string
	quoted := !p.eof() && p.peek() == '"'
	if quoted {
		s, err := p.quoted()
		if err != nil {
			return nil, err
		}
		raw = s
	} else {
		raw = p.bare()
	}
	if raw == "" && !quoted {
		return nil, &Error{Position: valuePos, Message: "value expected for " + facet}
	}
	if cmp != "eq" {
		if !numericFacet(facet) {
			return nil, &Error{Position: start, Message: "numeric comparison on a string facet: " + facet}
		}
		n, err := strconv.ParseFloat(raw, 64)
		if err != nil {
			return nil, &Error{Position: valuePos, Message: "number expected after the comparator"}
		}
		return &Term{Facet: facet, Cmp: cmp, Value: n}, nil
	}
	if facet == "level" {
		raw = strings.ToLower(raw)
	}
	var value any = raw
	if numericFacet(facet) && !quoted {
		if n, err := strconv.ParseFloat(raw, 64); err == nil {
			value = n
		}
	}
	return &Term{Facet: facet, Cmp: "eq", Value: value}, nil
}

// bare reads an unquoted word: up to whitespace, a paren or the pipe.
func (p *parser) bare() string {
	start := p.pos
	for !p.eof() {
		c := p.peek()
		if unicode.IsSpace(rune(c)) || c == '(' || c == ')' || c == '|' || c == '"' {
			break
		}
		p.pos++
	}
	return p.src[start:p.pos]
}

// quoted reads "…" with \" escapes.
func (p *parser) quoted() (string, error) {
	start := p.pos
	p.pos++
	var b strings.Builder
	for !p.eof() {
		c := p.peek()
		switch {
		case c == '\\' && p.pos+1 < len(p.src):
			b.WriteByte(p.src[p.pos+1])
			p.pos += 2
		case c == '"':
			p.pos++
			return b.String(), nil
		default:
			b.WriteByte(c)
			p.pos++
		}
	}
	return "", &Error{Position: start, Message: "unterminated quote"}
}

// group := '(' seq { 'OR' seq } ')', where seq is terms ANDed by space.
func (p *parser) group() (*Term, error) {
	open := p.pos
	p.pos++
	p.space()
	var branches []Term
	var seq []Term
	flush := func(at int) error {
		if len(seq) == 0 {
			return &Error{Position: at, Message: "term expected"}
		}
		if len(seq) == 1 {
			branches = append(branches, seq[0])
		} else {
			branches = append(branches, Term{Op: "and", Terms: seq})
		}
		seq = nil
		return nil
	}
	for {
		if p.eof() {
			return nil, &Error{Position: open, Message: "unclosed ("}
		}
		if p.peek() == ')' {
			if err := flush(p.pos); err != nil {
				return nil, err
			}
			p.pos++
			break
		}
		if at := p.pos; p.word("OR") {
			if err := flush(at); err != nil {
				return nil, err
			}
			p.space()
			continue
		}
		t, err := p.term()
		if err != nil {
			return nil, err
		}
		seq = append(seq, *t)
		if err := p.separator(); err != nil {
			return nil, err
		}
	}
	if len(branches) == 1 {
		return &branches[0], nil
	}
	return &Term{Op: "or", Terms: branches}, nil
}

// agg := fn '(' [field] ')'
func (p *parser) agg() (*Agg, error) {
	start := p.pos
	fn := p.ident()
	if fn == "" {
		return nil, p.fail("aggregation expected", "for example count() or p95(trace.duration_ms)")
	}
	if !Functions[fn] {
		return nil, &Error{Position: start, Message: "unknown function: " + fn,
			Hint: "count, rate, sum, avg, min, max, p50, p95, p99 or uniq"}
	}
	if p.eof() || p.peek() != '(' {
		return nil, p.fail("( expected after "+fn, "")
	}
	p.pos++
	p.space()
	fieldPos := p.pos
	field := p.ident()
	p.space()
	if p.eof() || p.peek() != ')' {
		return nil, p.fail(") expected", "")
	}
	p.pos++
	if field != "" && !KnownFacet(field) && !fieldName(field) {
		return nil, &Error{Position: fieldPos, Message: "unknown field: " + field}
	}
	return &Agg{Fn: fn, Field: field}, nil
}

// fieldName admits the per-signal numeric fields (§4 function table).
func fieldName(f string) bool {
	return f == "response_time_ms" || f == "value" || f == "visitor"
}

// Validate applies the semantic rules that need the whole query: bare
// percentile and sum-like functions need a field except on metrics, uniq
// always needs one.
func Validate(ast *AST, q string) error {
	isMetric := HasFacet(ast, "metric")
	for _, a := range ast.Agg {
		switch a.Fn {
		case "sum", "avg", "min", "max", "p50", "p95", "p99":
			if a.Field == "" && !isMetric {
				return &Error{Position: strings.Index(q, a.Fn+"("), Message: a.Fn + "() needs a field here",
					Hint: "for example " + a.Fn + "(trace.duration_ms)"}
			}
		case "uniq":
			if a.Field == "" {
				return &Error{Position: strings.Index(q, "uniq("), Message: "uniq() needs a field"}
			}
		}
	}
	return nil
}

// HasFacet reports whether any term (at any depth) uses facet.
func HasFacet(ast *AST, facet string) bool {
	var walk func(Term) bool
	walk = func(t Term) bool {
		if t.Facet == facet || (facet == "trace." && strings.HasPrefix(t.Facet, "trace.")) ||
			(facet == "rum." && strings.HasPrefix(t.Facet, "rum.")) {
			return true
		}
		if t.Not != nil && walk(*t.Not) {
			return true
		}
		for _, c := range t.Terms {
			if walk(c) {
				return true
			}
		}
		return false
	}
	for _, t := range ast.Filters.Terms {
		if walk(t) {
			return true
		}
	}
	for _, a := range ast.Agg {
		if a.Field == facet || strings.HasPrefix(a.Field, facet) && strings.HasSuffix(facet, ".") {
			return true
		}
	}
	for _, g := range ast.GroupBy {
		if strings.HasPrefix(g, facet) && strings.HasSuffix(facet, ".") {
			return true
		}
	}
	return false
}

// FacetValue returns the first eq value of facet at the top level.
func FacetValue(ast *AST, facet string) (string, bool) {
	for _, t := range ast.Filters.Terms {
		if t.Facet == facet && t.Cmp == "eq" {
			return fmt.Sprint(t.Value), true
		}
	}
	return "", false
}
