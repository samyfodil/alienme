package main

import (
	"math/bits"
	"runtime"
	"sync"
	"time"
)

type state struct {
	room    int
	flags   uint64
	crossed bool
	s       [maxA]int16
	rank    [maxA]int8
	weight  [maxA]int8
}

type key struct {
	room    uint8
	crossed bool
	flags   uint64
	s       [maxA]int8
	rank    [maxA]int8
	weight  [maxA]int8
}

type mass struct{ c, p float64 }

type trans struct {
	picks []option
	flags uint64
	way   *way
	c, p  float64
}

type place struct {
	room    int
	flags   uint64
	crossed bool
}

type counter struct {
	st     *story
	n      int
	ways   map[place][]trans
	gains  map[place][maxA]int16
	legs   map[leg][]passage
	wins   [maxA]mass
	states int
}

func apply(f uint64, o option) uint64 { return f&^o.clears | (o.sets &^ f) }

func (c *counter) take(x *state, o option) {
	touched := false
	for i := 0; i < c.n; i++ {
		x.s[i] += o.score[i]
		if o.score[i] > 0 {
			touched = true
		}
	}
	if !touched {
		return
	}
	for i := 0; i < c.n; i++ {
		if o.score[i] > 0 {
			x.rank[i], x.weight[i] = 0, int8(o.score[i])
		} else if x.rank[i] >= 0 {
			x.rank[i]++
		}
	}
}

func (c *counter) compact(x *state) {
	var used uint64
	for i := 0; i < c.n; i++ {
		if x.rank[i] >= 0 {
			used |= 1 << x.rank[i]
		}
	}
	for i := 0; i < c.n; i++ {
		if x.rank[i] >= 0 {
			x.rank[i] = int8(bits.OnesCount64(used & (1<<x.rank[i] - 1)))
		}
	}
}

func (c *counter) order(s *[maxA]int16) [maxA]int {
	var o [maxA]int
	for i := 0; i < c.n; i++ {
		j := i
		for j > 0 && s[o[j-1]] < s[i] {
			o[j] = o[j-1]
			j--
		}
		o[j] = i
	}
	return o
}

func (c *counter) winner(x *state) int {
	top := x.s[0]
	for i := 1; i < c.n; i++ {
		top = max(top, x.s[i])
	}
	first, best := -1, int8(-1)
	for i := 0; i < c.n; i++ {
		if x.s[i] != top {
			continue
		}
		if first < 0 {
			first = i
		}
		if x.rank[i] >= 0 && (best < 0 || x.rank[i] < best) {
			best = x.rank[i]
		}
	}
	if best < 0 {
		return first
	}
	lean, win := int8(0), first
	for i := 0; i < c.n; i++ {
		if x.s[i] == top && x.rank[i] == best && x.weight[i] > lean {
			lean, win = x.weight[i], i
		}
	}
	return win
}

func (c *counter) forkTo(w *way, s *[maxA]int16) int {
	o := c.order(s)
	var top uint32
	for _, k := range o[:min(3, c.n)] {
		top |= 1 << k
	}
	value := func(r int) float64 {
		t := c.st.rooms[r].testMask
		return float64(bits.OnesCount32(t&top)) - 0.25*float64(bits.OnesCount32(t&^top))
	}
	best := 0
	for i := 1; i < len(w.fork); i++ {
		if value(w.fork[i]) > value(w.fork[best]) {
			best = i
		}
	}
	return w.fork[best]
}

func (c *counter) canon(x *state, gain *[maxA]int16) key {
	o := c.order(&x.s)
	top := x.s[o[0]]
	bounded := !c.st.negative
	if bounded {
		for i := 0; i < c.n; i++ {
			if x.s[i]+gain[i] < top {
				x.rank[i], x.weight[i] = -1, 0
			}
		}
		c.compact(x)
		for r := int8(0); r < maxA; r++ {
			var in [maxA]int
			n := 0
			for i := 0; i < c.n; i++ {
				if x.rank[i] == r {
					in[n] = i
					n++
				}
			}
			if n == 0 {
				break
			}
			var ws uint64
			for a := 0; a < n; a++ {
				ws |= 1 << x.weight[in[a]]
			}
			for a := 0; a < n; a++ {
				x.weight[in[a]] = int8(bits.OnesCount64(ws&(1<<x.weight[in[a]]-1))) + 1
			}
		}
	}
	var back [maxA + 1]int16
	for i := c.n - 1; i >= 0; i-- {
		back[i] = max(back[i+1], gain[o[i]])
	}
	var v [maxA]int16
	for i := 1; i < c.n; i++ {
		gap := x.s[o[i-1]] - x.s[o[i]]
		if bounded && gap > back[i] {
			gap = back[i] + 1
		}
		v[o[i]] = v[o[i-1]] - gap
	}
	x.s = v
	k := key{room: uint8(x.room), crossed: x.crossed, flags: x.flags, rank: x.rank, weight: x.weight}
	for i := 0; i < c.n; i++ {
		if v[i] < -127 {
			panic("scores more than 127 apart")
		}
		k.s[i] = int8(v[i])
	}
	return k
}

func (k key) state() state {
	x := state{room: int(k.room), flags: k.flags, crossed: k.crossed, rank: k.rank, weight: k.weight}
	for i := range k.s {
		x.s[i] = int16(k.s[i])
	}
	return x
}

func (c *counter) transitions(p place) []trans {
	if t, ok := c.ways[p]; ok {
		return t
	}
	rm := &c.st.rooms[p.room]
	var out []trans
	leave := func(x trans, w *way) {
		if w == nil {
			for _, b := range rm.nextIf {
				if holds(b.when, x.flags) {
					w = b.way
					break
				}
			}
		}
		if w == nil {
			w = rm.next
		}
		x.way = w
		out = append(out, x)
	}
	with := func(x trans, o option, share float64) trans {
		return trans{picks: append(append([]option{}, x.picks...), o), flags: apply(x.flags, o), c: x.c, p: x.p * share * o.p}
	}
	var asked func(x trans, k int)
	asked = func(x trans, k int) {
		var q *ask
		for i, n := 0, 0; i < len(rm.asks); i++ {
			if holds(rm.asks[i].when, x.flags) {
				if n == k {
					q = &rm.asks[i]
					break
				}
				n++
			}
		}
		if q == nil {
			leave(x, nil)
			return
		}
		var open []*choice
		for i := range q.choices {
			if holds(q.choices[i].when, x.flags) {
				open = append(open, &q.choices[i])
			}
		}
		for _, ch := range open {
			y := with(x, ch.opt, 1/float64(len(open)))
			then := func(z trans) {
				if ch.to != nil {
					leave(z, ch.to)
				} else {
					asked(z, k+1)
				}
			}
			if ch.menu == nil {
				then(y)
				continue
			}
			for _, m := range ch.menu {
				for _, o := range m {
					then(with(y, o, 1/float64(len(ch.menu))))
				}
			}
		}
	}
	var extras func(i int, x trans)
	extras = func(i int, x trans) {
		if i == len(rm.extras) {
			asked(x, 0)
			return
		}
		e := rm.extras[i]
		if !holds(e.when, x.flags) || !e.matters(rm.live) {
			extras(i+1, x)
			return
		}
		skip := x
		skip.p /= 2
		extras(i+1, skip)
		extras(i+1, with(x, e.opt, 0.5))
	}
	extras(0, trans{flags: apply(p.flags, rm.enter), c: 1, p: 1})
	var merged []trans
	index := map[string]int{}
	for _, t := range out {
		var k []byte
		for _, o := range t.picks {
			for _, w := range o.score[:c.n] {
				k = append(k, byte(w))
			}
			k = append(k, ';')
		}
		for i := 0; i < 8; i++ {
			k = append(k, byte(t.flags>>(8*i)))
		}
		if t.way != nil {
			k = append(k, t.way.key...)
		}
		if i, ok := index[string(k)]; ok {
			merged[i].c += t.c
			merged[i].p += t.p
			continue
		}
		index[string(k)] = len(merged)
		merged = append(merged, t)
	}
	c.ways[p] = merged
	return merged
}

type passage struct {
	picks   []option
	score   [maxA]int16
	flags   uint64
	crossed bool
	p       float64
	gain    [maxA]int16
}

type leg struct {
	from, to int
	way      *way
	flags    uint64
	crossed  bool
}

func (c *counter) through(rm *room, w *way, to int, flags uint64, crossed bool) []passage {
	lk := leg{rm.index, to, w, flags, crossed}
	if ps, ok := c.legs[lk]; ok {
		return ps
	}
	steps := []passage{{flags: flags, crossed: crossed, p: 1}}
	pass := func(cd card, cross bool) {
		var out []passage
		for _, s := range steps {
			for _, m := range cd.options {
				for _, o := range m {
					t := passage{picks: append(append([]option{}, s.picks...), o), score: s.score, flags: apply(s.flags, o), crossed: s.crossed || cross, p: s.p / float64(len(cd.options)) * o.p}
					for a := 0; a < c.n; a++ {
						t.score[a] += o.score[a]
					}
					out = append(out, t)
				}
			}
		}
		steps = out
	}
	if w.bus && holds(c.st.fare.when, flags) {
		pass(c.st.fare, false)
	}
	if !crossed && rm.lot != c.st.rooms[to].lot {
		pass(c.st.crossing, true)
	}
	n := &c.st.rooms[to]
	for i := range steps {
		steps[i].flags &= n.live
		if !c.st.negative {
			steps[i].gain = c.gainFrom(n, steps[i].flags, steps[i].crossed)
		}
	}
	c.legs[lk] = steps
	return steps
}

func (c *counter) gainFrom(rm *room, flags uint64, crossed bool) [maxA]int16 {
	k := place{rm.index, flags, crossed}
	if g, ok := c.gains[k]; ok {
		return g
	}
	var best [maxA]int16
	for _, t := range c.transitions(k) {
		var g [maxA]int16
		for _, o := range t.picks {
			for a := 0; a < c.n; a++ {
				g[a] += o.score[a]
			}
		}
		if t.way != nil {
			tos := t.way.fork
			if tos == nil {
				tos = []int{t.way.to}
			}
			var after [maxA]int16
			for _, to := range tos {
				for _, s := range c.through(rm, t.way, to, t.flags, crossed) {
					for a := 0; a < c.n; a++ {
						after[a] = max(after[a], s.score[a]+s.gain[a])
					}
				}
			}
			for a := 0; a < c.n; a++ {
				g[a] += after[a]
			}
		}
		for a := 0; a < c.n; a++ {
			best[a] = max(best[a], g[a])
		}
	}
	c.gains[k] = best
	return best
}

const shards = 256

type shard struct {
	mu   sync.Mutex
	at   map[key]int32
	keys []key
	mass []mass
}

type pending struct{ sh [shards]shard }

func newPending() *pending {
	q := &pending{}
	for i := range q.sh {
		q.sh[i].at = map[key]int32{}
	}
	return q
}

func (k *key) hash() uint64 {
	var a, b uint64
	for i := 0; i < maxA; i++ {
		a = a<<8 | uint64(uint8(k.s[i]))
		b = b<<8 | uint64(uint8(k.rank[i]))<<4 | uint64(uint8(k.weight[i]))&15
	}
	h := k.flags*0x9e3779b97f4a7c15 ^ a*0xbf58476d1ce4e5b9 ^ b*0x94d049bb133111eb ^ uint64(k.room)<<1
	if k.crossed {
		h ^= 1
	}
	h ^= h >> 31
	h *= 0xd6e8feb86659fd93
	return h ^ h>>32
}

func (q *pending) add(k key, c, p float64) {
	s := &q.sh[k.hash()&(shards-1)]
	s.mu.Lock()
	i, ok := s.at[k]
	if !ok {
		i = int32(len(s.keys))
		s.at[k] = i
		s.keys = append(s.keys, k)
		s.mass = append(s.mass, mass{})
	}
	s.mass[i].c += c
	s.mass[i].p += p
	s.mu.Unlock()
}

func (q *pending) size() int {
	n := 0
	for i := range q.sh {
		n += len(q.sh[i].keys)
	}
	return n
}

func (c *counter) step(states *pending, into []*pending) {
	workers := runtime.NumCPU()
	found := make([]map[place]bool, workers)
	var wg sync.WaitGroup
	for w := 0; w < workers; w++ {
		wg.Add(1)
		go func(w int) {
			defer wg.Done()
			found[w] = map[place]bool{}
			for i := w; i < shards; i += workers {
				for _, k := range states.sh[i].keys {
					found[w][place{int(k.room), k.flags, k.crossed}] = true
				}
			}
		}(w)
	}
	wg.Wait()
	for _, f := range found {
		for p := range f {
			rm := &c.st.rooms[p.room]
			for _, t := range c.transitions(p) {
				if t.way == nil {
					continue
				}
				tos := t.way.fork
				if tos == nil {
					tos = []int{t.way.to}
				}
				for _, to := range tos {
					c.through(rm, t.way, to, t.flags, p.crossed)
				}
			}
		}
	}
	wins := make([][maxA]mass, workers)
	for w := 0; w < workers; w++ {
		wg.Add(1)
		go func(w int) {
			defer wg.Done()
			for i := w; i < shards; i += workers {
				sh := &states.sh[i]
				for j, k := range sh.keys {
					c.push(k, sh.mass[j], into, &wins[w])
				}
			}
		}(w)
	}
	wg.Wait()
	for w := range wins {
		for a := range wins[w] {
			c.wins[a].c += wins[w][a].c
			c.wins[a].p += wins[w][a].p
		}
	}
}

func (c *counter) push(k key, m mass, into []*pending, wins *[maxA]mass) {
	rm := &c.st.rooms[k.room]
	for _, t := range c.ways[place{int(k.room), k.flags, k.crossed}] {
		x := k.state()
		for _, o := range t.picks {
			c.take(&x, o)
		}
		if t.way == nil {
			w := c.winner(&x)
			wins[w].c += m.c * t.c
			wins[w].p += m.p * t.p
			continue
		}
		to := t.way.to
		if t.way.fork != nil {
			to = c.forkTo(t.way, &x.s)
		}
		ps := c.legs[leg{rm.index, to, t.way, t.flags, x.crossed}]
		for i := range ps {
			s := &ps[i]
			y := x
			for _, o := range s.picks {
				c.take(&y, o)
			}
			y.flags, y.crossed, y.room = s.flags, s.crossed, to
			into[to].add(c.canon(&y, &s.gain), m.c*t.c, m.p*t.p*s.p)
		}
	}
}

func (st *story) order() []int {
	seen := make([]bool, len(st.rooms))
	var post []int
	var visit func(i int)
	visit = func(i int) {
		seen[i] = true
		for _, t := range st.rooms[i].leads {
			if !seen[t] {
				visit(t)
			}
		}
		post = append(post, i)
	}
	visit(st.start)
	for i := range st.rooms {
		if !seen[i] {
			visit(i)
		}
	}
	for i, j := 0, len(post)-1; i < j; i, j = i+1, j-1 {
		post[i], post[j] = post[j], post[i]
	}
	return post
}

func count(st *story) map[string]any {
	t0 := time.Now()
	c := &counter{st: st, n: len(st.aliens), ways: map[place][]trans{}, gains: map[place][maxA]int16{}, legs: map[leg][]passage{}}
	into := make([]*pending, len(st.rooms))
	for i := range into {
		into[i] = newPending()
	}
	for _, m := range st.wake {
		for _, o := range m {
			x := state{room: st.start}
			for i := range x.rank {
				x.rank[i] = -1
			}
			c.take(&x, o)
			rm := &st.rooms[st.start]
			x.flags = apply(0, o) & rm.live
			var gain [maxA]int16
			if !st.negative {
				gain = c.gainFrom(rm, x.flags, false)
			}
			into[st.start].add(c.canon(&x, &gain), 1, o.p/float64(len(st.wake)))
		}
	}
	widest := 0
	order := st.order()
	for more := true; more; {
		more = false
		for _, r := range order {
			n := into[r].size()
			if n == 0 {
				continue
			}
			more = true
			states := into[r]
			into[r] = newPending()
			c.states += n
			widest = max(widest, n)
			c.step(states, into)
		}
	}
	var total, chance float64
	for a := 0; a < c.n; a++ {
		total += c.wins[a].c
		chance += c.wins[a].p
	}
	wins := map[string]any{}
	for a, name := range st.aliens {
		wins[name] = map[string]any{"combos": c.wins[a].c / total, "blind": c.wins[a].p / chance}
	}
	return map[string]any{"total": total, "chance": chance, "wins": wins, "states": c.states, "widest": widest, "ms": time.Since(t0).Milliseconds()}
}
