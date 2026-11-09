import * as THREE from 'three'
import { SETS, wallRects, FLOOR, type RoomSet } from '../data/sets'
import { BEATS } from '../data/story3d'
import { blockedAt, findPath, footprint, navGrid, standable } from '../three/nav'
import { PROPS } from '../data/props'
import { propScale, propTurn, propHeight } from '../three/Prop'
import type { Box, Grid } from '../three/nav'
import type { CtlRef } from './ctl'
import type { Beat, Choice, Door, Emote, EmoteSpec, Npc, Phase, Point, Prop } from './types'

export const GROUND = -1.25

export const WALK = 2.4

export const RUN = 5.5

export const TRAVEL = 13

export const HOME: Point = [-4.3, 2.4]

export const ACT_TIME = 3.8
export const READ_TIME = 3

export const HOP = 0.45

export const setOf = (beat: Beat): RoomSet => SETS[beat.theme] || SETS.home

export const propId = (p: Prop) => p.id || p.model

const propOf = (beat: Beat, id: string) => beat.props.find((p) => propId(p) === id)

export const npcOf = (beat: Beat, id: string): Npc | undefined => beat.npcs?.find((n) => n.id === id)

export const NAV: Record<string, Grid & { base: Grid }> = Object.fromEntries(
  BEATS.map((beat) => {
    const set = setOf(beat)
    const rects = [...beat.props, ...set.decor].map(footprint).filter((r): r is Box => !!r).concat(wallRects(set))
    const people = (beat.npcs || []).map((n): Box => ({ x: n.at[0], z: n.at[1], hw: 0.6, hd: 0.6, rot: 0 }))
    const grid = (r: Box[]) => navGrid(r, -8.5, 8.5, FLOOR.z - FLOOR.d / 2, FLOOR.z + FLOOR.d / 2 + 1.8)
    return [beat.id, { ...grid(rects.concat(people)), base: grid(rects) }]
  }),
)

const PERSONAL = 1.0
export function routeAround(id: string, ctl: CtlRef, [ox, oz]: Point, from: Point, to: Point) {
  const base = NAV[id].base
  const p = ctl.current.group?.position
  return (p && findPath(blockedAt(base, [p.x - ox, p.z - oz], PERSONAL), from, to)) || findPath(base, from, to)
}

function halfSize(p: Prop): Point {
  const d = p.model && PROPS[p.model]
  if (!d && !p.size) return [0.3, 0.3]
  const [w, dd] = p.size ?? [d![0], d![2]]
  const s = p.size ? 1 : propScale(p.model) * (p.scale || 1)
  const r = (p.rotY || 0) + propTurn(p.model)
  const [c, n] = [Math.abs(Math.cos(r)), Math.abs(Math.sin(r))]
  return [((c * w + n * dd) * s) / 2, ((n * w + c * dd) * s) / 2]
}

const near = (a: Point, b: Point, d = 0.25) => Math.hypot(a[0] - b[0], a[1] - b[1]) < d

type Aim = { at: Point; top: number; npc?: Npc; prop?: Prop }

export function targetOf(beat: Beat, choice: Pick<Choice, 'target'>): Aim {
  const t = choice.target!
  if (Array.isArray(t)) return { at: t, top: 0.6 }
  if (t.startsWith('npc:')) {
    const n = npcOf(beat, t.slice(4))!
    return { at: n.at, npc: n, top: (n.height || 2) + 0.4 }
  }
  const p = propOf(beat, t)!
  const h = p.height ?? propHeight(p.model) * (p.scale || 1)
  return { at: p.at, prop: p, top: Math.min((p.y || 0) + h, 1.9) + 0.35 }
}

const HEAD = { hw: 0.72, hd: 0.66, bottom: 1.0 }

type Touch = { out: number; fwd: number; into: number; turn: number }
const TOUCH: Record<string, Touch> = {
  reach: { out: 0.22, fwd: 1.06, into: -0.04, turn: 0.9 },
  game: { out: 0, fwd: 0.98, into: 0.14, turn: 0.35 },
}

function overlap(a: Box, b: Box) {
  const axes = [a.rot, b.rot].flatMap((r) => [
    [Math.cos(r), -Math.sin(r)],
    [Math.sin(r), Math.cos(r)],
  ])
  const reach = (o: Box, [ax, az]: number[]) => {
    const [c, s] = [Math.cos(o.rot), Math.sin(o.rot)]
    return o.hw * Math.abs(c * ax - s * az) + o.hd * Math.abs(s * ax + c * az)
  }
  return axes.every((u) => Math.abs((b.x - a.x) * u[0] + (b.z - a.z) * u[1]) < reach(a, u) + reach(b, u))
}

const isTall = (p: Prop) => (p.y || 0) + (p.height ?? propHeight(p.model) * (p.scale || 1)) > HEAD.bottom
const headClear = (box: Box, at: Point, face: number) => !overlap(box, { x: at[0], z: at[1], hw: HEAD.hw, hd: HEAD.hd, rot: face })

function touchStance(nav: Grid, prop: Prop, touch: Touch): Stance | null {
  const box = footprint(prop)!
  const r = prop.rotY || 0
  const f = [Math.sin(r), Math.cos(r)]
  const l = [f[1], -f[0]]
  const along = (u: number[]) => box.hw * Math.abs(Math.cos(box.rot) * u[0] - Math.sin(box.rot) * u[1]) + box.hd * Math.abs(Math.sin(box.rot) * u[0] + Math.cos(box.rot) * u[1])
  const deep = along(f)
  const wide = along(l)
  let best: (Stance & { score: number }) | null = null
  for (const side of [1, -1]) {
    const off = touch.out ? side * Math.max(0, wide - 0.3) : 0
    const t = [box.x + f[0] * (deep - touch.into) + l[0] * off, box.z + f[1] * (deep - touch.into) + l[1] * off]
    for (let turn = 0; turn <= touch.turn + 1e-6; turn += 0.1) {
      const face = r + Math.PI + side * turn
      const out = Math.sin(face) > 0.3 ? -touch.out : touch.out
      const at: Point = [t[0] - (out * Math.cos(face) + touch.fwd * Math.sin(face)), t[1] - (-out * Math.sin(face) + touch.fwd * Math.cos(face))]
      if (!near(standable(nav, at), at, 0.12) || !headClear(box, at, face)) continue
      const score = Math.cos(face) - Math.hypot(at[0], at[1]) * 0.02
      if (!best || score > best.score) best = { at, face, score }
    }
  }
  return best && { at: best.at, face: best.face }
}

type Stance = { at: Point; face?: number }
type Posed = Pick<Choice, 'target' | 'body'> & { arms?: Choice['arms'] | null }

export function stance(beat: Beat, choice: Posed): Stance {
  const nav = NAV[beat.id]
  const { at, prop, npc } = targetOf(beat, choice)
  const s = at[0] > 0 ? -1 : 1
  if (npc) return { at: standable(nav, [at[0] + s * 1.7, at[1] + 0.3]) }
  if (!prop) return { at: standable(nav, at) }
  const [hw, hz] = halfSize(prop)
  if (choice.body === 'hide') return { at: standable(nav, [at[0], at[1] - hz - 0.5]) }
  if (choice.body === 'sit' || choice.body === 'lie') {
    const ways: Point[] = [
      [at[0], Math.min(at[1] + hz + 0.5, 2.6)],
      [at[0] + s * (hw + 0.5), at[1]],
      [at[0] - s * (hw + 0.5), at[1]],
    ]
    for (const w of ways) {
      const p = standable(nav, w)
      if (near(p, w)) return { at: p }
    }
    return { at: standable(nav, ways[0]) }
  }
  const tall = isTall(prop) && footprint(prop)
  const touch = tall && TOUCH[phase(choice.arms, 0) ?? '']
  const front = touch && touchStance(nav, prop, touch)
  if (front) return front
  for (let gap = 0.55; gap < 1.5; gap += 0.1) {
    const beside: Point = [at[0] + s * (hw + gap), at[1]]
    const p = standable(nav, beside)
    if (!near(p, beside)) break
    if (!tall || headClear(tall, p, faceToward(p, at))) return { at: p }
  }
  return { at: standable(nav, [at[0] + s * 0.85, Math.min(at[1] + hz + 0.45, 2.6)]) }
}

export const standPoint = (beat: Beat, choice: Posed) => stance(beat, choice).at

export function faceToward(from: Point, to: Point) {
  const dx = to[0] - from[0]
  const dz = to[1] - from[1]
  return Math.atan2(dx, Math.abs(dz) > Math.abs(dx) ? dz * 0.35 : dz) * 0.6
}

export const phase = <T>(spec: Phase<T> | null | undefined, t: number): T | null | undefined => {
  if (!Array.isArray(spec)) return spec as T | null | undefined
  for (const [name, until] of spec) if (until == null || t < until) return name
  return null
}

export const emoteSpec = (e: EmoteSpec | null | undefined): Emote | null => (!e ? null : typeof e === 'string' || Array.isArray(e) ? { text: e } : e)

export const doorSpot = (d: Door): Point => (d.to === 'out' ? FRONT_DOOR : d.wall ? [d.wall * 4.5, d.at!] : [d.at!, -3.7])

export const doorFace = (d: Door) => (d.to === 'out' ? 0 : d.wall ? (d.wall * Math.PI) / 2 : Math.PI)

export const FRONT_DOOR: Point = [0, 4.4]

const ease = (t: number) => THREE.MathUtils.smootherstep(Math.min(1, Math.max(0, t)), 0, 1)

export const span = (t: number, a: number, b: number) => ease((t - a) / (b - a))

export const _v3 = new THREE.Vector3()
export const _c = new THREE.Color()
