import type { Model, Point } from '../story/types'

export const BLOCK = { w: 20, slab: [16, 14] as Point, slabZ: -1, roadZ: 8 }
export const COLS = [-100, -80, -60, -40, -20, 0, 20, 40, 60, 80, 100]
export const ROWS = [-54, -36, -18, 0, 18, 36, 54]
const ROW = ROWS[1] - ROWS[0]

const EAST = COLS[COLS.length - 1] + BLOCK.w / 2 + 2
export const PROMENADE = { x0: EAST, x1: COLS[COLS.length - 1] + BLOCK.w + 0.8 }
export const SHORE = COLS[COLS.length - 1] + BLOCK.w + 14
const BEACH: Point = [SHORE - 5.8, 18]

export const COAST: [size: number, frequency: number, phase: number][] = [
  [4, 0.023, 1.3],
  [2, 0.061, 0.4],
  [0.8, 0.15, 0],
]
export const COAST_STILL = { z: BEACH[1], from: 8, to: 40 }
const still = (z: number) => {
  const t = Math.min(1, Math.max(0, (Math.abs(z - COAST_STILL.z) - COAST_STILL.from) / (COAST_STILL.to - COAST_STILL.from)))
  return t * t * (3 - 2 * t)
}
export const coastAt = (z: number) => SHORE + COAST.reduce((s, [a, f, p]) => s + a * Math.sin(z * f + p), 0) * still(z)

const HOME: Point = [-60, 0]
const HOUSE: Building = { model: 'town/house' }

type Building = { model: Model; rotY?: number }
export type Place = { at: Point; name: string; way: string; icon: string; building?: Building }

export const PLACES: Record<string, Place> = {
  bedroom: { at: HOME, name: 'Home', way: 'home', icon: '🏠', building: HOUSE },
  kitchen: { at: HOME, name: 'Home', way: 'to the kitchen', icon: '🏠', building: HOUSE },
  bathroom: { at: HOME, name: 'Home', way: 'to the bathroom', icon: '🏠', building: HOUSE },
  street: { at: [-40, 0], name: 'Bus stop', way: 'to the bus stop', icon: '🚏' },
  office: { at: [0, -36], name: 'Office', way: 'to the office', icon: '💼', building: { model: 'town/office' } },
  carpark: { at: [20, -36], name: 'Car park', way: 'out for lunch', icon: '🚗' },
  boss: { at: [0, -36], name: 'Office', way: 'back to work', icon: '💼', building: { model: 'town/office' } },
  lobby: { at: [0, -36], name: 'Office', way: 'to the office', icon: '💼', building: { model: 'town/office' } },
  arcade: { at: [20, 18], name: 'Arcade', way: 'to the arcade', icon: '🕹️', building: { model: 'town/arcade' } },
  diner: { at: [20, -18], name: 'Diner', way: 'to the diner', icon: '🍔', building: { model: 'town/diner' } },
  park: { at: [-40, -18], name: 'Park', way: 'to the park', icon: '🌳' },
  beach: { at: BEACH, name: 'Beach', way: 'to the beach', icon: '🏖️' },
  seafood: { at: [40, 18], name: 'Seafood', way: 'to dinner', icon: '🦞', building: { model: 'town/shop-blue' } },
  party: { at: [60, -18], name: 'Party', way: "to Jo's party", icon: '🎉', building: { model: 'town/party' } },
  couch: { at: HOME, name: 'Home', way: 'home', icon: '🏠', building: HOUSE },
  forgot: { at: HOME, name: 'Home', way: 'home', icon: '🏠', building: HOUSE },
}

export const LANDING: Point = [-60, 8]

const DOOR = 4.4
const front = (z: number) => z + BLOCK.roadZ

const FRONT = 5.2
const BACK = -7.7
const SIDE = 6.8
export const SET_BACK = 0.8

export function roadPath(a: string, b: string): Point[] {
  const [ax, az] = PLACES[a].at
  const [bx, bz] = PLACES[b].at
  const pts: Point[] = [[ax, az + DOOR], [ax, az + FRONT]]
  if (az !== bz) {
    const x = ax + (bx >= ax ? SIDE : -SIDE)
    pts.push([x, az + FRONT])
    const step = bz > az ? ROW : -ROW
    for (let r = az; r !== bz; r += step) {
      if (step > 0) pts.push([x, r + step + BACK], [x, r + step + FRONT])
      else pts.push([x, r + BACK], [x, r + step + FRONT])
    }
  }
  pts.push([bx, bz + FRONT], [bx, bz + DOOR])
  return pts
}

export function drivePath(a: string, b: string): Point[] {
  const [ax, az] = PLACES[a].at
  const [bx, bz] = PLACES[b].at
  const pts: Point[] = [[ax, az + DOOR], [ax, front(az)]]
  if (az !== bz) {
    const cross = ax + (bx >= ax ? BLOCK.w / 2 : -BLOCK.w / 2)
    pts.push([cross, front(az)], [cross, front(bz)])
  }
  pts.push([bx, front(bz)], [bx, bz + DOOR])
  return pts
}

export const PARK = {
  lots: [[-60, -36], [-40, -36], [-60, -18], [-40, -18]] as Point[],
  x0: -60 - BLOCK.slab[0] / 2,
  x1: -40 + BLOCK.slab[0] / 2,
  z0: -36 + BLOCK.slabZ - BLOCK.slab[1] / 2,
  z1: -18 + BLOCK.slabZ + BLOCK.slab[1] / 2,
}
export const inPark = (x: number, z: number, margin = 0) => x > PARK.x0 - margin && x < PARK.x1 + margin && z > PARK.z0 - margin && z < PARK.z1 + margin
const TRAIL_AT: Point[] = [
  [-47.5, -16.5], [-47, -23], [-42, -27.5], [-36, -27], [-34.5, -34], [-39, -40.5], [-50, -41.5],
  [-61, -40.5], [-65.5, -33], [-65.5, -22], [-61, -15.5], [-54, -14.5],
]
function smoothLoop(pts: Point[], n = 8): Point[] {
  const out: Point[] = []
  const L = pts.length
  for (let i = 0; i < L; i++) {
    const [p0, p1, p2, p3] = [pts[(i - 1 + L) % L], pts[i], pts[(i + 1) % L], pts[(i + 2) % L]]
    for (let k = 0; k < n; k++) {
      const t = k / n
      const t2 = t * t
      const t3 = t2 * t
      const f = (a: number, b: number, c: number, d: number) => 0.5 * (2 * b + (-a + c) * t + (2 * a - 5 * b + 4 * c - d) * t2 + (-a + 3 * b - 3 * c + d) * t3)
      out.push([f(p0[0], p1[0], p2[0], p3[0]), f(p0[1], p1[1], p2[1], p3[1])])
    }
  }
  out.push(out[0])
  return out
}
export const TRAIL = smoothLoop(TRAIL_AT)

export function onPavement(x: number, z: number) {
  if (inPark(x, z) || x > EAST) return true
  const [sw, sd] = BLOCK.slab
  const c = COLS[0] + Math.round((x - COLS[0]) / BLOCK.w) * BLOCK.w
  const r = ROWS[0] + Math.round((z - BLOCK.slabZ - ROWS[0]) / ROW) * ROW
  return Math.abs(x - c) <= sw / 2 && Math.abs(z - r - BLOCK.slabZ) <= sd / 2
}

export type Crossing = { k: number; kerb: Point; far: Point; dir: number }
export function firstCrossing(pts: Point[]): Crossing | null {
  const STEP = 0.1
  for (let k = 0; k + 1 < pts.length; k++) {
    const [x0, z0] = pts[k]
    const [x1, z1] = pts[k + 1]
    const len = Math.hypot(x1 - x0, z1 - z0)
    const at = (d: number): Point => [x0 + ((x1 - x0) * d) / len, z0 + ((z1 - z0) * d) / len]
    for (let d = 0; d < len; d += STEP) {
      if (onPavement(...at(d))) continue
      let e = d
      while (e < len && !onPavement(...at(e))) e += STEP
      return { k, kerb: at(Math.max(0, d - 0.4)), far: at(Math.min(len, e + 0.4)), dir: Math.atan2(x1 - x0, z1 - z0) }
    }
  }
  return null
}

export const CROSSINGS = COLS.flatMap((c) =>
  ROWS.flatMap((r): [x: number, z: number, along: number][] => [
    [c + BLOCK.w / 2, r + FRONT, Math.PI / 2],
    [c - SIDE, r + BLOCK.roadZ, 0],
    [c + SIDE, r + BLOCK.roadZ, 0],
  ]),
).filter(([x, z]) => !inPark(x, z, -0.5))

export const POND = { at: [-53.5, -36.6] as Point, size: [6, 3] as Point }
export const inPond = (x: number, z: number, margin = 0) => ((x - POND.at[0]) / (POND.size[0] + margin)) ** 2 + ((z - POND.at[1]) / (POND.size[1] + margin)) ** 2 < 1

export const nearest = (pts: Point[], to: Point) => {
  const d = (p: Point) => Math.hypot(p[0] - to[0], p[1] - to[1])
  return pts.reduce((best, p, i) => (d(p) < d(pts[best]) ? i : best), 0)
}

export function jogLoop(id: string, from: Point): Point[] {
  const [x, z] = PLACES[id].at
  const loop: Point[] =
    id === 'park'
      ? TRAIL.slice(0, -1)
      : [[x, z + FRONT], [x + SIDE, z + FRONT], [x + SIDE, z + BACK], [x - SIDE, z + BACK], [x - SIDE, z + FRONT]]
  const k = nearest(loop, from)
  const out = [...loop.slice(k), ...loop.slice(0, k)]
  return [...out, out[0]]
}

const INSIDE: Point = [0, 3000]
const INDOOR = Object.keys(PLACES).filter((id) => PLACES[id].building)
export const INSIDE_LAWN = { x0: INSIDE[0] - 80, x1: INSIDE[0] + INDOOR.length * 40 + 80, z0: INSIDE[1] - 80, z1: INSIDE[1] + 80 }
export const indoor = (id: string) => !!PLACES[id].building
export const originOf = (id: string): Point => (indoor(id) ? [INSIDE[0] + INDOOR.indexOf(id) * 40, INSIDE[1]] : PLACES[id].at)

export const sameLot = (a: string, b: string) => PLACES[a].at.join() === PLACES[b].at.join()
export const doorOf = (id: string): Point => [PLACES[id].at[0], PLACES[id].at[1] + DOOR]
export const roadFront = front

const SKY_AT: [hour: number, color: string][] = [
  [6, '#f6b38a'],
  [8, '#ffd9a8'],
  [10, '#9fd4ff'],
  [16, '#8ccaff'],
  [18.5, '#ff9a6a'],
  [20, '#4a3a7a'],
  [22, '#141a3c'],
]
export function skyAt(time: string): string | [string, string, number] {
  const [h, m] = time.split(':').map(Number)
  const t = h + m / 60
  let i = SKY_AT.findIndex(([at]) => at > t)
  if (i <= 0) return i === 0 ? SKY_AT[0][1] : SKY_AT[SKY_AT.length - 1][1]
  const [t0, c0] = SKY_AT[i - 1]
  const [t1, c1] = SKY_AT[i]
  return [c0, c1, (t - t0) / (t1 - t0)]
}
