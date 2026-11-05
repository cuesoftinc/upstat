package chdb

import "testing"

func TestArrayParamEscapesQuotesAndBackslashes(t *testing.T) {
	cases := map[string][]string{
		`[]`:                 nil,
		`['a','b']`:          {"a", "b"},
		`['it\'s']`:          {"it's"},
		`['a\\']`:            {`a\`},
		`['x\') OR 1=1 --']`: {`x') OR 1=1 --`},
	}
	for want, in := range cases {
		if got := ArrayParam(in); got != want {
			t.Errorf("ArrayParam(%q) = %s, want %s", in, got, want)
		}
	}
}
