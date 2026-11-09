import { BEATS, START, WAKE, FARE, CROSSING, CAST } from '../data/story3d'
import { SETS, type RoomSet } from '../data/sets'
import { PLACES } from '../data/city'
import { PROPS } from '../data/props'
import { ALIENS, ALIEN_KEYS } from '../data/aliens'
import { ARMS, BODIES, ITEMS } from '../three/acts'
import { BUILT } from '../three/Built'
import { FX_KINDS } from '../three/Fx'
import { footprint, type Box } from '../three/nav'
import { seatHeight } from '../three/Prop'
import { CAST_TOKEN, entryOf, BEAT, holds, flagsIn, readable, apply, doorTo, doorPath, asksOf, wayOut, waysTo, leadsTo, tests, timeOf, captionOf } from './engine'
import type { Ask, Beat, Choice, Condition, FlagChange, Flags, Fx, Npc, Option, Outcome, Phase, Phone, Point, Prop, Way } from './types'

type Room = string | null
export type Problem = { room: Room; text: string }
const nameOf = (p: Prop | Npc) => p.id ?? ('model' in p ? p.model : undefined)
const known = (table: object, name: unknown) => typeof name === 'string' && Object.hasOwn(table, name)
const moves = (name: string) => known(BODIES, name) || known(ARMS, name)

const STAGED = ['sit', 'lie', 'floor', 'crouch', 'hide', 'jog', 'gone']
const phases = <T extends string>(spec: Phase<T> | null | undefined): T[] =>
  spec == null ? [] : Array.isArray(spec) ? spec.map(([n]) => n).filter((n): n is T => !!n) : [spec]
const list = (x: FlagChange | undefined) => ([] as string[]).concat(x || [])
const key = (flags: Flags) => [...flags].sort().join(',')

export function checkStory() {
  const errors: Problem[] = []
  const warnings: Problem[] = []
  const err = (room: Room, text: string) => errors.push({ room, text })
  const warn = (room: Room, text: string) => warnings.push({ room, text })
  const read: Record<string, Room[]> = {}
  const raised: Record<string, Room[]> = {}
  const reads = (expr: Condition | undefined, room: Room, where: string) => {
    const bad = readable(expr)
    if (bad) return err(room, `${where}: ${bad}`)
    for (const f of flagsIn(expr)) (read[f] ??= []).push(room)
  }
  const raises = (o: { sets?: FlagChange } | undefined, room: Room) => list(o?.sets).forEach((f) => (raised[f] ??= []).push(room))

  type Scored = Outcome & { label?: string; win?: Outcome; lose?: Outcome }
  const weights = (o: Scored, room: Room, what: string) => {
    for (const v of [o, o.win, o.lose]) {
      if (v?.score == null) continue
      if (typeof v.score !== 'object' || Array.isArray(v.score)) {
        err(room, `${what}: "${o.label}" score should be alien weights, like { grey: 3, mantis: 1 }`)
        continue
      }
      for (const [a, w] of Object.entries(v.score)) {
        if (!known(ALIENS, a)) err(room, `${what}: "${o.label}" scores unknown alien "${a}"`)
        if (!(typeof w === 'number' && Number.isFinite(w) && w >= 0)) err(room, `${what}: "${o.label}" weight for ${a} should be a number 0 or more`)
      }
    }
  }
  const scores = (opts: Scored[], room: Room, what: string) => opts.forEach((o) => weights(o, room, what))
  const thread = (phone: Phone | undefined, room: Room, what: string) => {
    if (!phone) return
    if (!phone.from) err(room, `${what}: from whom?`)
    let last = ''
    for (const t of phone.texts || []) {
      reads(t.when, room, `${what} text when`)
      if (!/^\d\d:\d\d$/.test(t.at)) err(room, `${what}: "${t.text}" needs at 'HH:MM'`)
      else if (t.at < last) err(room, `${what}: "${t.text}" at ${t.at} comes after a later text`)
      else last = t.at
    }
  }
  const option = (o: Option, room: Room, what: string) => {
    if (!o.label) err(room, `${what}: an option has no label`)
    for (const a of phases(o.arms)) if (!ARMS[a]) err(room, `${what}: "${o.label}" unknown arms "${a}"`)
    if (o.item && !ITEMS[o.item]) err(room, `${what}: "${o.label}" unknown item "${o.item}"`)
    if (o.odds != null && (!(o.odds > 0 && o.odds < 1) || !o.win || !o.lose)) err(room, `${what}: "${o.label}" a gamble needs odds between 0 and 1, win and lose`)
    for (const v of [o, o.win, o.lose]) if (v) raises(v, room)
    for (const v of [o, o.win, o.lose]) if (v?.npc?.react && !moves(v.npc.react)) err(room, `${what}: "${o.label}" unknown npc reaction "${v.npc.react}"`)
  }
  const card = (menu: { when?: Condition; options: Option[] }, room: Room, what: string) => {
    reads(menu.when, room, `${what} when`)
    for (const o of menu.options) option(o, room, what)
    scores(menu.options, room, what)
  }
  card(WAKE, START, 'WAKE')
  card(FARE, 'street', 'FARE')
  card(CROSSING, null, 'CROSSING')

  const way = (w: Way, room: Room, what: string) => {
    const to = typeof w === 'string' ? w : w && 'to' in w ? w.to : undefined
    if (to) {
      if (!BEAT[to]) err(room, `${what}: leads to unknown room "${to}"`)
      if (typeof w === 'object' && 'by' in w && w.by && !['bus', 'ride'].includes(w.by)) err(room, `${what}: unknown way "${w.by}"`)
    } else if (typeof w === 'object' && w && 'fork' in w && Array.isArray(w.fork)) {
      if (w.fork.length < 2) err(room, `${what}: a fork needs two rooms or more`)
      for (const to of w.fork) {
        if (!BEAT[to]) err(room, `${what}: fork to unknown room "${to}"`)
        else if (!tests(to).length) err(room, `${what}: fork to ${to}, which tests no alien`)
      }
    } else err(room, `${what}: a way is a room id, { to, by } or { fork: [...] }`)
  }

  const ids = new Set()
  for (const beat of BEATS) {
    const r = beat.id
    if (ids.has(r)) err(r, 'two rooms share this id')
    ids.add(r)
    if (!PLACES[r]) err(r, 'no place on the map (data/city.js PLACES)')
    if (beat.theme && !SETS[beat.theme]) err(r, `unknown theme "${beat.theme}"`)
    for (const f of ['title', 'time', 'caption'] as const) if (!beat[f]) warn(r, `no ${f}`)
    raises(beat, r)
    for (const c of Object.keys(beat.captionIf || {})) reads(c, r, 'captionIf')
    for (const c of Object.keys(beat.timeIf || {})) reads(c, r, 'timeIf')
    for (const c of Object.keys(beat.titleIf || {})) reads(c, r, 'titleIf')
    const forms = new Set(Object.keys(CAST.jo(null, { jo: 'she', boss: 'she' })).filter((k) => k !== 'look'))
    for (const text of wordsOf(beat))
      for (const [, role, form] of text.matchAll(CAST_TOKEN))
        if (!known(CAST, role)) err(r, `"${text}": no "${role}" in the cast`)
        else if (form && (!forms.has(form.toLowerCase()) || form.toLowerCase() === 'name')) err(r, `"${text}": no form "${form}" (${[...forms].filter((f) => f !== 'name').join(', ')})`)

    const props = new Set<string | undefined>()
    for (const p of beat.props) {
      reads(p.when, r, `prop ${p.id || p.model} when`)
      const id = p.id || p.model
      if (p.id && props.has(id)) err(r, `two props named "${id}"`)
      props.add(id)
      if (p.model && !PROPS[p.model]) err(r, `prop "${id}": unknown model "${p.model}"`)
      if (p.build && !BUILT[p.build]) err(r, `prop "${id}": unknown build "${p.build}"`)
      if (p.item && !ITEMS[p.item]) err(r, `prop "${id}": unknown item "${p.item}"`)
      if (!p.model && !p.build && !p.item && !p.animal && !p.cutes) err(r, `prop "${id}": nothing to show`)
    }
    const npcs = new Set((beat.npcs || []).map((n) => n.id))
    for (const n of beat.npcs || []) {
      if (!n.look === !n.cast) err(r, `npc "${n.id}": a look (an avatar, as presetAvatar makes) or a cast role, one of them`)
      if (n.sit) {
        const seat = (beat.props || []).find((p) => p.id === n.sit)
        if (!seat || seatHeight(seat.model) == null) err(r, `npc "${n.id}": sits on "${n.sit}", which isn't a seat here`)
        else if (Math.hypot(seat.at[0] - n.at[0], seat.at[1] - n.at[1]) > 0.05 || (seat.rotY || 0) !== (n.rotY || 0)) err(r, `npc "${n.id}": not at "${n.sit}", or facing another way`)
      }
      for (const m of [n.mood, ...Object.values(n.moodIf || {})]) if (m && !moves(m)) err(r, `npc "${n.id}": unknown mood "${m}"`)
      for (const c of Object.keys(n.moodIf || {})) reads(c, r, `npc "${n.id}" moodIf`)
      for (const c of Object.keys(n.castIf || {})) reads(c, r, `npc "${n.id}" castIf`)
      for (const role of [n.cast, ...Object.values(n.castIf || {})]) if (role && !CAST[role]) err(r, `npc "${n.id}": no "${role}" in the cast`)
      if (n.castIf && !n.cast) err(r, `npc "${n.id}": castIf, but no cast to fall back on`)
      if (n.name === true && !n.cast) err(r, `npc "${n.id}": named by the cast, but not in it`)
      reads(n.when, r, `npc "${n.id}" when`)
    }
    for (const f of beat.ambient || []) reads(f.when, r, 'ambient when')
    if (beat.busAway) reads(beat.busAway, r, 'busAway')
    const fx = (specs: Fx[] | undefined, what: string) => {
      for (const f of specs || []) {
        if (!FX_KINDS.includes(f.type)) err(r, `${what}: unknown fx "${f.type}"`)
        if (f.prop && !props.has(f.prop)) err(r, `${what}: fx on unknown prop "${f.prop}"`)
      }
    }
    fx(beat.ambient, 'ambient')

    if (!beat.asks?.length) err(r, 'asks nothing: a room is at least one question')
    const enter = beat.enter ? [{ q: 'enter', choices: [{ label: 'enter', ...beat.enter }], extras: true }] : []
    const questions: (Ask & { extras?: boolean })[] = [...(beat.asks || []), ...(beat.extras?.length ? [{ q: 'extras', choices: beat.extras, extras: true }] : []), ...enter]
    for (const q of questions) {
      reads(q.when, r, 'question when')
      thread(q.phone, r, `"${q.q}" phone`)
      if (!q.q) warn(r, 'a question with no q')
      else if (!q.extras && !q.q.includes('?')) err(r, `"${q.q}" asks nothing: a question needs a question mark`)
      const doors = q.choices.filter((c) => c.door != null)
      if (doors.length && doors.length < q.choices.length) err(r, `"${q.q}": answers on doors and answers on the card can't mix`)
      if (new Set(doors.map((c) => c.door)).size < doors.length) err(r, `"${q.q}": two answers on one door; one door, one sign (or put them on the card)`)
      const look = q.look
      if (typeof look === 'string' && (look.startsWith('npc:') ? !npcs.has(look.slice(4)) : !props.has(look))) err(r, `"${q.q}": looks at unknown "${look}"`)
      const at = q.at
      if (at) {
        const inside = floorItems(beat).find((o) => gap(o.r, standing(at)) < 0)
        if (inside) err(r, `"${q.q}": at [${q.at}] is inside ${inside.name}`)
      }
      if (!q.choices?.length) err(r, `"${q.q}": no answers`)
      if (q.choices.length > 3) warn(r, `"${q.q}": ${q.choices.length} answers; three at most keeps a question easy to take in`)
      const places = q.extras ? [] : q.choices.filter((c) => !c.target && c.body !== 'jog')
      if (places.length && places.length < q.choices.length) err(r, `"${q.q}": answers acted out in the room and places on a card can't mix`)
      for (const c of places) if (!c.icon) warn(r, `"${c.label}": an answer with nothing to act out wants an icon`)
      for (const c of q.choices) {
        const what = `"${c.label}"`
        reads(c.when, r, `${what} when`)
        thread(c.phone, r, `${what} phone`)
        if (c.door === 'out' && !doorTo(beat, 'out') && doorPath(r, 'out')) err(r, `${what}: this room has no way out at the front`)
        else if (c.door != null && c.door !== 'out' && !doorTo(beat, c.door)) err(r, `${what}: no door to "${c.door}" here`)
        if (c.to != null && !q.extras) way(c.to, r, what)
        const t = c.target
        if (typeof t === 'string' && (t.startsWith('npc:') ? !npcs.has(t.slice(4)) : !props.has(t))) err(r, `${what}: unknown target "${t}"`)
        if (c.body && !STAGED.includes(c.body) && !known(BODIES, c.body)) err(r, `${what}: unknown body "${c.body}"`)
        for (const b of phases(c.bodyMotion)) if (!BODIES[b]) err(r, `${what}: unknown bodyMotion "${b}"`)
        for (const a of phases(c.arms)) if (!ARMS[a]) err(r, `${what}: unknown arms "${a}"`)
        if (c.hold && !ITEMS[c.hold.item]) err(r, `${what}: holds unknown item "${c.hold.item}"`)
        if (c.npc && !npcs.has(c.npc.id)) err(r, `${what}: unknown npc "${c.npc.id}"`)
        if (c.until && !(beat.npcs || []).some((n) => n.id === c.until && n.arrive)) err(r, `${what}: open until "${c.until}" arrives, but no bystander here arrives by that name`)
        if (c.until && q.think) err(r, `${what}: only an answer on the card can run out`)
        if (c.npc?.react && !moves(c.npc.react)) err(r, `${what}: unknown npc reaction "${c.npc.react}"`)
        fx(c.fx, what)
        raises(c, r)
        if (c.menu) card(c.menu, r, `${what} menu`)
        if (c.menu?.stop && !props.has(c.menu.stop)) err(r, `${what}: its menu stops at unknown prop "${c.menu.stop}"`)
        if (c.menu?.by && !npcs.has(c.menu.by)) err(r, `${what}: its menu is asked by unknown npc "${c.menu.by}"`)
        for (const o of c.menu?.options || []) {
          if (o.item && !ITEMS[o.item]) err(r, `"${o.label}": unknown item "${o.item}"`)
          if (!o.fetch) continue
          if (!c.menu?.serve) err(r, `"${o.label}": fetched from the room, but nobody serves this menu`)
          if (!props.has(o.fetch.prop)) err(r, `"${o.label}": fetches unknown prop "${o.fetch.prop}"`)
          if (!ITEMS[o.fetch.item]) err(r, `"${o.label}": carries unknown item "${o.fetch.item}"`)
        }
        const toNpc = c.npc || (typeof t === 'string' && t.startsWith('npc:'))
        if (c.menu && !toNpc && c.menu.options.some((o) => o.npc || o.win?.npc || o.lose?.npc)) err(r, `${what}: its menu has a bystander react, but the answer isn't to anyone`)
      }
      scores(q.choices, r, 'answers')
    }
    const e: Partial<Choice> | undefined = beat.enter
    if (e && !e.target) err(r, 'enter: acted out in the room, so it needs a target')
    if (e && (e.score || e.sets || e.clears || e.to != null || e.when)) err(r, 'enter: happens every time and changes nothing itself (no score, flags, way or when); an order taken on the way in (a menu) is what can')
    const extras: Choice[] = beat.extras || []
    for (const e of extras) {
      if (!e.target) err(r, `extra "${e.label}": an extra is done in the room, and needs a target`)
      if (e.to != null) err(r, `extra "${e.label}": an extra answers nothing and leads nowhere`)
      if (e.score) err(r, `extra "${e.label}": an extra scores nothing; what scores is a question's answer`)
      reads(e.when, r, `extra "${e.label}" when`)
    }
    if (beat.next != null) way(beat.next, r, 'next')
    for (const [c, w] of Object.entries(beat.nextIf || {})) {
      reads(c, r, 'nextIf')
      way(w, r, `nextIf ${c}`)
    }
    for (const d of beat.doors || []) {
      for (const to of [d.to, ...list(d.also)]) {
        if (to !== 'out' && !BEAT[to]) err(r, `door to unknown room "${to}"`)
        else if (to !== 'out' && d.to === to && !doorTo(BEAT[to], r)) warn(r, `door to ${to}, but ${to} has no door back`)
      }
      if (d.to === 'out' && (d.wall != null || d.at != null)) err(r, 'the way out is always the open front: { to: \'out\' } takes no wall or at')
      else if (d.to !== 'out' && !([-1, 0, 1] as (number | undefined)[]).includes(d.wall)) err(r, `door to ${d.to}: wall must be -1, 0 or 1`)
    }
    crowding(beat, warn)
  }

  for (const f of Object.keys(read)) if (!raised[f]) err(read[f][0], `reads flag "${f}", which nothing raises (a typo?)`)
  for (const f of Object.keys(raised)) if (!read[f]) warn(raised[f][0], `raises flag "${f}", which nothing reads`)

  const runs = playOut(read)
  for (const b of BEATS) {
    if (!runs.rooms.has(b.id)) err(b.id, 'no run of the day reaches this room')
    else for (const text of unseen(b, runs.used)) err(b.id, text)
  }
  for (const [room, text] of runs.clock) err(room, text)
  if (runs.count >= CAP) err(null, `more than ${CAP} runs of the day: not all of them were checked`)

  return { errors, warnings, endings: [...runs.endings], flags: { read, raised }, runs: runs.count }
}
type Mark = (what: string, which: string | null | undefined) => void

function outcomes(beat: Beat, flags: Flags, mark: Mark) {
  const out: [Flags, string | null][] = []
  const walk = (f: Flags, k: number) => {
    const q = [entryOf(beat), ...asksOf(beat, f)].filter(Boolean)[k]
    if (!q) {
      mark('nextIf', firstOf(beat.nextIf, f))
      const to = waysTo(wayOut(beat, null, f))
      if (!to.length) out.push([f, null])
      for (const t of to) out.push([f, t])
      return
    }
    mark('ask', q.q)
    for (const c of q.choices) {
      mark('answer', `${q.q}|${c.label}`)
      const ways: Outcome[] = c.menu ? c.menu.options.flatMap((o) => (o.odds != null ? [{ ...o, ...o.win }, { ...o, ...o.lose }] : [o])) : [{}]
      for (const w of ways) {
        const g = apply(apply(f, c), w)
        if (c.to == null) walk(g, k + 1)
        for (const to of waysTo(c.to)) out.push([g, to])
      }
    }
  }
  let starts = [apply(flags, beat)]
  for (const e of beat.extras || []) {
    const open = starts.filter((f) => holds(e.when, f))
    if (open.length) mark('extra', e.label)
    starts = [...starts, ...open.map((f) => apply(f, e))]
  }
  for (const f of starts) walk(f, 0)
  return out
}

const CAP = 800000
function playOut(read: Record<string, Room[]>) {
  const rooms = new Set<string>()
  const endings = new Set<string>()
  const seen = new Set<string>()
  const clock = new Map<string, [string, Flags]>()
  const late = (room: string, text: string, flags: Flags) => clock.has(text) || clock.set(text, [room, flags])
  const used = new Set<string>()
  type Before = { room: string; t: number } | null
  const queue: [string, Flags, Before][] = []
  const live = liveFlags(read)
  const visit = (id: string, flags: Flags, before: Before) => {
    const kept = flags.filter((f) => live[id]?.has(f))
    const k = `${id}|${before?.room}@${before?.t}|${key(kept)}`
    if (seen.has(k) || !BEAT[id] || seen.size >= CAP) return
    seen.add(k)
    queue.push([id, kept, before])
  }
  for (const o of WAKE.options) visit(START, apply([], o), null)
  for (let i = 0; i < queue.length; i++) {
    const [id, flags, before] = queue[i]
    rooms.add(id)
    const beat = BEAT[id]
    const now = apply(flags, beat)
    const mark: Mark = (what, which) => which != null && used.add(`${id}|${what}|${which}`)
    mark('captionIf', firstOf(beat.captionIf, now))
    mark('timeIf', firstOf(beat.timeIf, now))
    mark('titleIf', firstOf(beat.titleIf, now))
    for (const n of beat.npcs || []) mark(`moodIf ${n.id}`, firstOf(n.moodIf, now))
    for (const p of [...(beat.props || []), ...(beat.npcs || [])]) if (holds(p.when, now)) mark('when', nameOf(p))
    const t = minutes(timeOf(beat, now))
    if (before && t < before.t) late(id, `the clock goes back, from ${before.room} at ${hhmm(before.t)} to ${hhmm(t)} here`, now)
    const said = (text: string, at: number, what: string) => {
      const s = saysTime(text)
      if (s != null && s !== at % 720) late(id, `${what} starts "${text.slice(0, 28)}…" but the clock says ${hhmm(at)}`, now)
    }
    said(captionOf(beat, now) || '', t, 'the caption')
    let end = t
    for (const q of asksOf(beat, now)) {
      const at = q.time ? minutes(q.time) : end
      if (at < end) late(id, `"${q.q}" at ${q.time} comes before ${hhmm(end)}`, now)
      end = Math.max(end, at)
      said(q.q, at, 'a question')
    }
    for (const [f, to] of outcomes(beat, flags, mark)) {
      if (to == null) {
        endings.add(id)
        continue
      }
      const w = wayOut(beat, null, f)
      const paying = typeof w === 'object' && 'by' in w && w.by === 'bus' && waysTo(w).includes(to) && holds(FARE.when, f)
      if (paying && minutes(FARE.time!) < end) late(id, `the fare card says ${FARE.time}, after ${hhmm(end)} here`, f)
      const fares: Outcome[] = paying ? FARE.options.flatMap((o) => (o.odds != null ? [{ ...o, ...o.win }, { ...o, ...o.lose }] : [o])) : [{}]
      for (const o of fares) visit(to, apply(f, o), { room: id, t: paying ? minutes(FARE.time!) : end })
    }
  }
  return { rooms, endings, used, count: seen.size, clock: [...clock].map(([text, [room, f]]) => [room, `${text} (e.g. flags: ${key(f) || 'none'})`]) }
}

const firstOf = (map: Record<Condition, unknown> | undefined, flags: Flags) => Object.keys(map || {}).find((c) => holds(c, flags))

function liveFlags(read: Record<string, Room[]>) {
  const live: Record<string, Set<string>> = Object.fromEntries(BEATS.map((b) => [b.id, new Set<string>()]))
  for (const [f, where] of Object.entries(read)) for (const r of where) for (const id of r == null ? Object.keys(live) : [r]) live[id]?.add(f)
  for (let grew = true; grew; ) {
    grew = false
    for (const b of BEATS)
      for (const to of leadsTo(b))
        for (const f of live[to] ?? []) {
          if (live[b.id].has(f)) continue
          live[b.id].add(f)
          grew = true
        }
  }
  return live
}

function unseen(beat: Beat, used: Set<string>) {
  const out: string[] = []
  const never = (what: string, which: string | undefined, text: string) => used.has(`${beat.id}|${what}|${which}`) || out.push(text)
  for (const m of ['captionIf', 'timeIf', 'titleIf', 'nextIf'] as const) for (const c of Object.keys(beat[m] || {})) never(m, c, `${m} "${c}" never comes up in any run`)
  for (const n of beat.npcs || []) for (const c of Object.keys(n.moodIf || {})) never(`moodIf ${n.id}`, c, `${n.id}'s moodIf "${c}" never comes up in any run`)
  for (const p of [...(beat.props || []), ...(beat.npcs || [])]) if (p.when) never('when', nameOf(p), `${nameOf(p)} (when "${p.when}") is never there in any run`)
  for (const q of beat.asks) {
    if (q.when) never('ask', q.q, `"${q.q}" (when "${q.when}") is never asked in any run`)
    for (const c of q.choices) if (c.when) never('answer', `${q.q}|${c.label}`, `"${c.label}" (when "${c.when}") is never offered in any run`)
  }
  for (const e of beat.extras || []) if (e.when) never('extra', e.label, `the extra "${e.label}" (when "${e.when}") is never there in any run`)
  return out
}

const minutes = (hm: string) => {
  const [h, m] = hm.split(':').map(Number)
  return h * 60 + m
}
const hhmm = (t: number) => `${String(Math.floor(t / 60)).padStart(2, '0')}:${String(t % 60).padStart(2, '0')}`

const HOURS = ['twelve', 'one', 'two', 'three', 'four', 'five', 'six', 'seven', 'eight', 'nine', 'ten', 'eleven']
const PAST: Record<string, number> = { five: 5, ten: 10, quarter: 15, twenty: 20, 'twenty-five': 25, half: 30 }
function saysTime(text: string) {
  const d = text.match(/^(\d{1,2}):(\d\d)\b/)
  if (d) return ((+d[1] % 12) * 60 + +d[2]) % 720
  const w = text.toLowerCase().match(new RegExp(`^(?:(${Object.keys(PAST).join('|')}) (past|to) )?(${HOURS.join('|')})( o'clock)?\\b`))
  if (!w || (!w[1] && !w[4])) return null
  const h = HOURS.indexOf(w[3])
  if (!w[1]) return h * 60
  return w[2] === 'past' ? h * 60 + PAST[w[1]] : (h * 60 - PAST[w[1]] + 720) % 720
}

const together = (a: string, b: string) => (/chair/.test(a) && /table/.test(b)) || (/chair/.test(b) && /table/.test(a)) || (/counter|stove|sink/.test(a) && /counter|stove|sink/.test(b))
function floorItems(beat: Beat) {
  const set: RoomSet = SETS[beat.theme] || SETS.home
  const all: Prop[] = [...beat.props, ...set.decor]
  const items = all
    .filter((p) => !((p.y ?? 0) > 0.05))
    .map((p) => ({ name: String(p.id || p.model), r: p.build === 'shower' ? { x: p.at[0], z: p.at[1], hw: 0.65, hd: 0.65, rot: 0 } : /tree|pine/.test(p.model || '') ? { x: p.at[0], z: p.at[1], hw: 0.4, hd: 0.4, rot: 0 } : footprint(p) }))
    .filter((o): o is { name: string; r: Box } => !!o.r)
  for (const n of beat.npcs || []) {
    if (n.sit) continue
    const h = 0.35 * ((n.height ?? 2) / 2)
    items.push({ name: `npc:${n.id}`, r: { x: n.at[0], z: n.at[1], hw: h, hd: h, rot: 0 } })
  }
  return items
}
const standing = ([x, z]: Point): Box => ({ x, z, hw: 0.3, hd: 0.3, rot: 0 })
function wordsOf(v: unknown, out: string[] = []) {
  if (typeof v === 'string') out.push(v)
  else if (Array.isArray(v)) v.forEach((x) => wordsOf(x, out))
  else if (v && typeof v === 'object') Object.values(v).forEach((x) => wordsOf(x, out))
  return out
}
function crowding(beat: Beat, warn: (room: Room, text: string) => void) {
  const items = floorItems(beat)
  for (let i = 0; i < items.length; i++)
    for (let j = i + 1; j < items.length; j++) if (!together(items[i].name, items[j].name) && gap(items[i].r, items[j].r) < -0.02) warn(beat.id, `${items[i].name} and ${items[j].name} overlap`)
}
const corners = (r: Box) => {
  const c = Math.cos(r.rot)
  const s = Math.sin(r.rot)
  return [[1, 1], [1, -1], [-1, -1], [-1, 1]].map(([a, b]) => [r.x + a * r.hw * c + b * r.hd * s, r.z - a * r.hw * s + b * r.hd * c])
}
function gap(A: Box, B: Box) {
  const pa = corners(A)
  const pb = corners(B)
  let best = -Infinity
  for (const poly of [pa, pb])
    for (let i = 0; i < 4; i++) {
      const [x1, z1] = poly[i]
      const [x2, z2] = poly[(i + 1) % 4]
      const l = Math.hypot(z2 - z1, x1 - x2)
      const nx = (z2 - z1) / l
      const nz = (x1 - x2) / l
      const a = pa.map(([x, z]) => x * nx + z * nz)
      const b = pb.map(([x, z]) => x * nx + z * nz)
      best = Math.max(best, Math.min(...b) - Math.max(...a), Math.min(...a) - Math.max(...b))
    }
  return best
}
