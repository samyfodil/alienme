package main

import (
	"encoding/json"
	"fmt"
)

const maxA = 8

type option struct {
	score  [maxA]int16
	sets   uint64
	clears uint64
	p      float64
}

type pick []option

type way struct {
	key  string
	to   int
	bus  bool
	fork []int
}

type choice struct {
	when cond
	opt  option
	to   *way
	menu []pick
}

type ask struct {
	when    cond
	choices []choice
}

type extra struct {
	when  cond
	reads uint64
	opt   option
}

type branch struct {
	when cond
	way  *way
}

type room struct {
	id       string
	lot      string
	enter    option
	extras   []extra
	asks     []ask
	nextIf   []branch
	next     *way
	tests    []int
	testMask uint32
	reads    uint64
	leads    []int
	live     uint64
	index    int
}

type card struct {
	when    cond
	reads   uint64
	options []pick
}

type story struct {
	aliens   []string
	rooms    []room
	start    int
	wake     []pick
	fare     card
	crossing card
	flags    []string
	negative bool
}

type reader struct {
	st    *story
	ids   map[string]int
	alien map[string]int
	bits  map[string]uint64
	ways  int
	err   error
}

type obj = map[string]any

func get(v any, k string) any {
	if m, ok := v.(obj); ok {
		return m[k]
	}
	return nil
}

func list(v any) []any {
	a, _ := v.([]any)
	return a
}

func text(v any) string {
	s, _ := v.(string)
	return s
}

func (r *reader) fail(format string, args ...any) {
	if r.err == nil {
		r.err = fmt.Errorf(format, args...)
	}
}

func (r *reader) bit(f string) (uint64, error) {
	if b, ok := r.bits[f]; ok {
		return b, nil
	}
	if len(r.bits) == 64 {
		return 0, fmt.Errorf("more than 64 flags")
	}
	b := uint64(1) << len(r.bits)
	r.bits[f] = b
	r.st.flags = append(r.st.flags, f)
	return b, nil
}

func (r *reader) flagsOf(v any) uint64 {
	names := []any{v}
	if a, ok := v.([]any); ok {
		names = a
	}
	var m uint64
	for _, f := range names {
		if f == nil {
			continue
		}
		b, err := r.bit(text(f))
		if err != nil {
			r.fail("%v", err)
		}
		m |= b
	}
	return m
}

func (r *reader) cond(v any) (cond, uint64) {
	if v == nil {
		return nil, 0
	}
	c, reads, err := parse(text(v), r.bit)
	if err != nil {
		r.fail("%v", err)
	}
	return c, reads
}

func (r *reader) score(v any) [maxA]int16 {
	var s [maxA]int16
	m, _ := v.(obj)
	for k, w := range m {
		if a, ok := r.alien[k]; ok {
			n, _ := w.(float64)
			s[a] += int16(n)
		}
	}
	return s
}

func (r *reader) option(v any) option {
	return option{score: r.score(get(v, "score")), sets: r.flagsOf(get(v, "sets")), clears: r.flagsOf(get(v, "clears")), p: 1}
}

func (r *reader) pick(v any) pick {
	odds, ok := get(v, "odds").(float64)
	if !ok {
		return pick{r.option(v)}
	}
	out := pick{}
	for _, side := range []struct {
		v any
		p float64
	}{{get(v, "win"), odds}, {get(v, "lose"), 1 - odds}} {
		o := r.option(v)
		if s := get(side.v, "score"); s != nil {
			o.score = r.score(s)
		}
		if s := get(side.v, "sets"); s != nil {
			o.sets = r.flagsOf(s)
		}
		if s := get(side.v, "clears"); s != nil {
			o.clears = r.flagsOf(s)
		}
		o.p = side.p
		out = append(out, o)
	}
	if out[0].score == out[1].score && out[0].sets == out[1].sets && out[0].clears == out[1].clears {
		return pick{{score: out[0].score, sets: out[0].sets, clears: out[0].clears, p: 1}}
	}
	return out
}

func (r *reader) picks(v any) []pick {
	var out []pick
	for _, o := range list(v) {
		out = append(out, r.pick(o))
	}
	return out
}

func (r *reader) room(id string) int {
	i, ok := r.ids[id]
	if !ok {
		r.fail("no room %q", id)
	}
	return i
}

func (r *reader) way(v any) *way {
	if v == nil {
		return nil
	}
	if s, ok := v.(string); ok {
		return &way{key: "room:" + s, to: r.room(s)}
	}
	r.ways++
	w := &way{key: fmt.Sprintf("object:%d", r.ways)}
	if f := list(get(v, "fork")); f != nil {
		for _, id := range f {
			w.fork = append(w.fork, r.room(text(id)))
		}
		return w
	}
	w.to = r.room(text(get(v, "to")))
	w.bus = text(get(v, "by")) == "bus"
	return w
}

func (r *reader) card(v any) card {
	c, reads := r.cond(get(v, "when"))
	return card{when: c, reads: reads, options: r.picks(get(v, "options"))}
}

func read(data []byte) (*story, error) {
	var v any
	if err := json.Unmarshal(data, &v); err != nil {
		return nil, err
	}
	st := &story{}
	r := &reader{st: st, ids: map[string]int{}, alien: map[string]int{}, bits: map[string]uint64{}}
	aliens := list(get(v, "aliens"))
	if len(aliens) > maxA {
		return nil, fmt.Errorf("more than %d aliens", maxA)
	}
	for i, a := range aliens {
		st.aliens = append(st.aliens, text(a))
		r.alien[st.aliens[i]] = i
	}
	beats := list(get(v, "beats"))
	places := get(v, "places")
	for i, b := range beats {
		id := text(get(b, "id"))
		r.ids[id] = i
		lot := ""
		if at := list(get(get(places, id), "at")); at != nil {
			lot = fmt.Sprint(at...)
		}
		st.rooms = append(st.rooms, room{id: id, lot: lot, index: i})
	}
	for i, b := range beats {
		rm := &st.rooms[i]
		rm.enter = r.option(b)
		for _, e := range list(get(b, "extras")) {
			c, reads := r.cond(get(e, "when"))
			rm.extras = append(rm.extras, extra{when: c, reads: reads, opt: r.option(e)})
		}
		tests := [maxA]bool{}
		for _, a := range list(get(b, "asks")) {
			c, reads := r.cond(get(a, "when"))
			rm.reads |= reads
			q := ask{when: c}
			for _, cv := range list(get(a, "choices")) {
				w, reads := r.cond(get(cv, "when"))
				rm.reads |= reads
				ch := choice{when: w, opt: r.option(cv), to: r.way(get(cv, "to"))}
				raw := []any{cv}
				if m := get(cv, "menu"); m != nil {
					ch.menu = r.picks(get(m, "options"))
					raw = append(raw, list(get(m, "options"))...)
				}
				for _, o := range raw {
					s := r.score(get(o, "score"))
					for a := range st.aliens {
						if s[a] >= 2 {
							tests[a] = true
						}
					}
				}
				q.choices = append(q.choices, ch)
			}
			rm.asks = append(rm.asks, q)
		}
		for a := range st.aliens {
			if tests[a] {
				rm.tests = append(rm.tests, a)
				rm.testMask |= 1 << a
			}
		}
		for _, pair := range list(get(b, "nextIf")) {
			kv := list(pair)
			c, reads := r.cond(kv[0])
			rm.reads |= reads
			rm.nextIf = append(rm.nextIf, branch{when: c, way: r.way(kv[1])})
		}
		rm.next = r.way(get(b, "next"))
	}
	st.start = r.room(text(get(v, "start")))
	st.wake = r.picks(get(get(v, "wake"), "options"))
	st.fare = r.card(get(v, "fare"))
	st.crossing = r.card(get(v, "crossing"))
	if r.err != nil {
		return nil, r.err
	}
	st.prepare()
	return st, nil
}

func (st *story) prepare() {
	cards := st.fare.reads | st.crossing.reads
	for i := range st.rooms {
		rm := &st.rooms[i]
		ways := []*way{rm.next}
		for _, b := range rm.nextIf {
			ways = append(ways, b.way)
		}
		for _, q := range rm.asks {
			for _, c := range q.choices {
				ways = append(ways, c.to)
			}
		}
		seen := map[int]bool{}
		for _, w := range ways {
			if w == nil {
				continue
			}
			to := w.fork
			if to == nil {
				to = []int{w.to}
			}
			for _, t := range to {
				if !seen[t] {
					seen[t] = true
					rm.leads = append(rm.leads, t)
				}
			}
		}
		rm.live = rm.reads | cards
	}
	st.checkNegative()
	for grew := true; grew; {
		grew = false
		for i := range st.rooms {
			rm := &st.rooms[i]
			for _, e := range rm.extras {
				if e.matters(rm.live) && rm.live|e.reads != rm.live {
					rm.live |= e.reads
					grew = true
				}
			}
			for _, t := range rm.leads {
				if live := rm.live | st.rooms[t].live; live != rm.live {
					rm.live = live
					grew = true
				}
			}
		}
	}
}

func (st *story) checkNegative() {
	check := func(o option) {
		for _, w := range o.score {
			st.negative = st.negative || w < 0
		}
	}
	for _, rm := range st.rooms {
		check(rm.enter)
		for _, e := range rm.extras {
			check(e.opt)
		}
		for _, q := range rm.asks {
			for _, c := range q.choices {
				check(c.opt)
				for _, p := range c.menu {
					for _, o := range p {
						check(o)
					}
				}
			}
		}
	}
	for _, ps := range [][]pick{st.fare.options, st.crossing.options, st.wake} {
		for _, p := range ps {
			for _, o := range p {
				check(o)
			}
		}
	}
}

func (e extra) matters(live uint64) bool {
	return e.opt.score != [maxA]int16{} || (e.opt.sets|e.opt.clears)&live != 0
}
