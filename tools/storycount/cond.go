package main

import (
	"fmt"
	"regexp"
	"strings"
)

type cond func(flags uint64) bool

func holds(c cond, flags uint64) bool { return c == nil || c(flags) }

var token = regexp.MustCompile(`^\s*(&&|\|\||!|\(|\)|[a-z][a-z0-9_]*)`)
var name = regexp.MustCompile(`^[a-z]`)

func parse(expr string, bit func(string) (uint64, error)) (cond, uint64, error) {
	var tokens []string
	for rest := expr; rest != ""; {
		m := token.FindStringSubmatch(rest)
		if m == nil {
			break
		}
		tokens = append(tokens, m[1])
		rest = rest[len(m[0]):]
	}
	if strings.Join(tokens, "") != strings.Join(strings.Fields(expr), "") {
		return nil, 0, fmt.Errorf("can't read condition %q", expr)
	}
	i := 0
	var reads uint64
	var err error
	fail := func() cond {
		if err == nil {
			err = fmt.Errorf("can't read condition %q", expr)
		}
		return func(uint64) bool { return false }
	}
	var or, and, not func() cond
	or = func() cond {
		f := and()
		for i < len(tokens) && tokens[i] == "||" {
			i++
			a, b := f, and()
			f = func(s uint64) bool { return a(s) || b(s) }
		}
		return f
	}
	and = func() cond {
		f := not()
		for i < len(tokens) && tokens[i] == "&&" {
			i++
			a, b := f, not()
			f = func(s uint64) bool { return a(s) && b(s) }
		}
		return f
	}
	not = func() cond {
		if i < len(tokens) && tokens[i] == "!" {
			i++
			a := not()
			return func(s uint64) bool { return !a(s) }
		}
		if i < len(tokens) && tokens[i] == "(" {
			i++
			a := or()
			if i >= len(tokens) || tokens[i] != ")" {
				return fail()
			}
			i++
			return a
		}
		if i >= len(tokens) || !name.MatchString(tokens[i]) {
			return fail()
		}
		b, e := bit(tokens[i])
		i++
		if e != nil {
			err = e
			return fail()
		}
		reads |= b
		return func(s uint64) bool { return s&b != 0 }
	}
	f := or()
	if i != len(tokens) {
		fail()
	}
	return f, reads, err
}
