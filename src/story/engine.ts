import { BEATS } from '../data/story3d'
import { ALIEN_KEYS } from '../data/aliens'
import type { Alien, Ask, Beat, Choice, Condition, Door, FlagChange, Flags, Option, Score, Way } from './types'

export const BEAT: Record<string, Beat> = Object.fromEntries(BEATS.map((b) => [b.id, b]))
const ALIENS = ALIEN_KEYS

type Test = (flags: Flags) => boolean

const TOKEN = /\s*(&&|\|\||!|\(|\)|[a-z][a-z0-9_]*)/gy
function compile(expr: string): Test {
  const tokens: string[] = []
  TOKEN.lastIndex = 0
  for (let m; TOKEN.lastIndex < expr.length && (m = TOKEN.exec(expr)); ) tokens.push(m[1])
  if (tokens.join('') !== expr.replace(/\s+/g, '')) throw new Error(`can't read condition "${expr}"`)
  let i = 0
  const fail = (): never => {
    throw new Error(`can't read condition "${expr}"`)
  }
  const or = (): Test => {
    let f = and()
    while (tokens[i] === '||') {
      i++
      const a = f
      const b = and()
      f = (s: Flags) => a(s) || b(s)
    }
    return f
  }
  const and = (): Test => {
    let f = not()
    while (tokens[i] === '&&') {
      i++
      const a = f
      const b = not()
      f = (s: Flags) => a(s) && b(s)
    }
    return f
  }
  const not = (): Test => {
    if (tokens[i] === '!') {
      i++
      const a = not()
      return (s: Flags) => !a(s)
    }
    if (tokens[i] === '(') {
      i++
      const a = or()
      if (tokens[i++] !== ')') fail()
      return a
    }
    const name = tokens[i++]
    if (!name || !/^[a-z]/.test(name)) fail()
    return (s: Flags) => s.includes(name)
  }
  const f = or()
  if (i !== tokens.length) fail()
  return f
}
const compiled = new Map<string, Test>()
export function holds(expr: Condition | null | undefined, flags: Flags): boolean {
  if (expr == null) return true
  let test = compiled.get(expr)
  if (!test) compiled.set(expr, (test = compile(expr)))
  return test(flags)
}
export const flagsIn = (expr: Condition | null | undefined): string[] => (expr == null ? [] : expr.match(/[a-z][a-z0-9_]*/g) || [])
export function readable(expr: Condition | null | undefined): string | null {
  try {
    holds(expr, [])
    return null
  } catch (e) {
    return (e as Error).message
  }
}

export const pick = <T>(map: Record<Condition, T> | undefined, flags: Flags): T | undefined => Object.entries(map || {}).find(([c]) => holds(c, flags))?.[1]
export const captionOf = (beat: Beat, flags: Flags) => pick(beat.captionIf, flags) ?? beat.caption
export const timeOf = (beat: Beat, flags: Flags) => pick(beat.timeIf, flags) ?? beat.time
export const titleOf = (beat: Beat, flags: Flags) => pick(beat.titleIf, flags) ?? beat.title

export const CAST_TOKEN = /\{(\w+)(?:\.(\w+))?\}/g

export const entryOf = (beat: Beat): Ask | null => (beat.enter?.menu ? { q: beat.enter.menu.prompt, choices: [{ label: 'enter', ...beat.enter }] } : null)

export const asksOf = (beat: Beat, flags: Flags): Ask[] =>
  beat.asks.filter((a) => holds(a.when, flags)).map((a) => ({ ...a, choices: a.choices.filter((c) => holds(c.when, flags)) }))

export const wayOut = (beat: Beat, choice: Pick<Choice, 'to'> | null | undefined, flags: Flags): Way | undefined => choice?.to ?? pick(beat.nextIf, flags) ?? beat.next

export const waysTo = (way: Way | null | undefined): string[] => (way == null ? [] : typeof way === 'string' ? [way] : 'fork' in way ? way.fork : [way.to])

export const leadsTo = (beat: Beat): string[] => [
  ...new Set([...beat.asks.flatMap((a) => a.choices.flatMap((c) => waysTo(c.to))), ...Object.values(beat.nextIf || {}).flatMap(waysTo), ...waysTo(beat.next)]),
]

export const tests = (id: string): Alien[] => {
  const opts = [entryOf(BEAT[id]), ...BEAT[id].asks].flatMap((a) => a?.choices.flatMap((c): (Choice | Option)[] => [c, ...(c.menu?.options || [])]) ?? [])
  return ALIENS.filter((k) => opts.some((o) => (o.score?.[k] || 0) >= 2))
}

export function forkTo(ids: string[], scores: Score): string {
  const top = [...ALIENS].sort((a, b) => (scores[b] || 0) - (scores[a] || 0)).slice(0, 3)
  const value = (id: string) => tests(id).reduce((v, k) => v + (top.includes(k) ? 1 : -0.25), 0)
  return ids.reduce((best, id) => (value(id) > value(best) ? id : best))
}

export function resolve(way: Way | null | undefined, scores: Score): { to: string; by?: 'bus' | 'ride' } | null {
  if (way == null) return null
  if (typeof way === 'string') return { to: way }
  if ('fork' in way) return { to: forkTo(way.fork, scores) }
  return way
}

export const settle = <T extends Option>(opt: T): T => (opt.odds == null ? opt : { ...opt, ...(Math.random() < opt.odds ? opt.win : opt.lose) })

export function apply(flags: Flags, { sets, clears }: { sets?: FlagChange; clears?: FlagChange } = {}): Flags {
  const down = ([] as string[]).concat(clears || [])
  const up = ([] as string[]).concat(sets || []).filter((f) => !flags.includes(f))
  return down.length || up.length ? [...flags.filter((f) => !down.includes(f)), ...up] : flags
}

export const doorTo = (beat: Beat, to: string): Door | undefined => beat.doors?.find((d) => d.to === to || d.also?.includes(to))

type Hop = { room: string; door: Door }
export function doorPath(from: string, to: string): Hop[] | null {
  const seen = new Set([from])
  const queue: [string, Hop[]][] = [[from, []]]
  while (queue.length) {
    const [id, hops] = queue.shift()!
    for (const door of BEAT[id]?.doors || []) {
      const way = [...hops, { room: id, door }]
      const reach = [door.to, ...(door.also || [])]
      if (reach.includes(to)) return way
      for (const r of reach) {
        if (r === 'out' || seen.has(r)) continue
        seen.add(r)
        queue.push([r, way])
      }
    }
  }
  return null
}
