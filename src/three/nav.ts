import { PROPS } from '../data/props'
import { propScale, propHeight, propTurn } from './Prop'
import type { Point, Prop } from '../story/types'

const CELL = 0.2
const BODY = 0.42

export type Box = { x: number; z: number; hw: number; hd: number; rot: number }
export type Grid = { x0: number; z0: number; nx: number; nz: number; blocked: Uint8Array }
type Cell = [number, number]

export function footprint({ model, at, rotY = 0, scale = 1, size }: Pick<Prop, 'model' | 'at' | 'rotY' | 'scale' | 'size'>): Box | null {
  if (size) return { x: at[0], z: at[1], hw: size[0] / 2, hd: size[1] / 2, rot: rotY }
  const p = model && PROPS[model]
  if (!p || propHeight(model) * scale < 0.15) return null
  const s = propScale(model) * scale
  return { x: at[0], z: at[1], hw: (p[0] * s) / 2, hd: (p[2] * s) / 2, rot: rotY + propTurn(model) }
}

export function navGrid(rects: Box[], x0: number, x1: number, z0: number, z1: number): Grid {
  const nx = Math.ceil((x1 - x0) / CELL)
  const nz = Math.ceil((z1 - z0) / CELL)
  const blocked = new Uint8Array(nx * nz)
  for (let j = 0; j < nz; j++)
    for (let i = 0; i < nx; i++) {
      const x = x0 + (i + 0.5) * CELL
      const z = z0 + (j + 0.5) * CELL
      for (const r of rects) {
        const dx = x - r.x
        const dz = z - r.z
        const c = Math.cos(r.rot)
        const s = Math.sin(r.rot)
        if (Math.abs(dx * c - dz * s) < r.hw + BODY && Math.abs(dx * s + dz * c) < r.hd + BODY) {
          blocked[j * nx + i] = 1
          break
        }
      }
    }
  return { x0, z0, nx, nz, blocked }
}

const cellOf = (g: Grid, [x, z]: Point): Cell => [
  Math.min(g.nx - 1, Math.max(0, Math.floor((x - g.x0) / CELL))),
  Math.min(g.nz - 1, Math.max(0, Math.floor((z - g.z0) / CELL))),
]
const centre = (g: Grid, i: number, j: number): Point => [g.x0 + (i + 0.5) * CELL, g.z0 + (j + 0.5) * CELL]
const free = (g: Grid, i: number, j: number) => i >= 0 && j >= 0 && i < g.nx && j < g.nz && !g.blocked[j * g.nx + i]

function nearestFree(g: Grid, [i, j]: Cell): Cell {
  if (free(g, i, j)) return [i, j]
  const seen = new Set([j * g.nx + i])
  const queue: Cell[] = [[i, j]]
  while (queue.length) {
    const [a, b] = queue.shift()!
    for (const [da, db] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
      const p: Cell = [a + da, b + db]
      if (p[0] < 0 || p[1] < 0 || p[0] >= g.nx || p[1] >= g.nz || seen.has(p[1] * g.nx + p[0])) continue
      if (free(g, ...p)) return p
      seen.add(p[1] * g.nx + p[0])
      queue.push(p)
    }
  }
  return [i, j]
}

export function standable(g: Grid, p: Point): Point {
  const c = cellOf(g, p)
  const f = nearestFree(g, c)
  return f[0] === c[0] && f[1] === c[1] ? p : centre(g, ...f)
}

export function blockedAt(g: Grid, [x, z]: Point, r: number): Grid {
  const blocked = g.blocked.slice()
  for (let j = 0; j < g.nz; j++)
    for (let i = 0; i < g.nx; i++) {
      const [cx, cz] = centre(g, i, j)
      if (Math.hypot(cx - x, cz - z) < r) blocked[j * g.nx + i] = 1
    }
  return { ...g, blocked }
}

function clear(g: Grid, a: Point, b: Point) {
  const steps = Math.ceil(Math.hypot(b[0] - a[0], b[1] - a[1]) / (CELL / 2))
  for (let k = 0; k <= steps; k++) {
    const t = k / (steps || 1)
    const [i, j] = cellOf(g, [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t])
    if (!free(g, i, j)) return false
  }
  return true
}

export function findPath(g: Grid, from: Point, to: Point): Point[] | null {
  const s = nearestFree(g, cellOf(g, from))
  const t = nearestFree(g, cellOf(g, to))
  const goal = t[1] * g.nx + t[0]
  const start = s[1] * g.nx + s[0]
  const cost = new Float64Array(g.nx * g.nz).fill(Infinity)
  const prev = new Int32Array(g.nx * g.nz).fill(-1)
  const h = (k: number) => Math.hypot((k % g.nx) - t[0], Math.floor(k / g.nx) - t[1])
  cost[start] = 0
  const open: [number, number][] = [[h(start), start]]
  while (open.length) {
    let bi = 0
    for (let k = 1; k < open.length; k++) if (open[k][0] < open[bi][0]) bi = k
    const [f, k] = open.splice(bi, 1)[0]
    if (k === goal) break
    if (f > cost[k] + h(k)) continue
    const i = k % g.nx
    const j = Math.floor(k / g.nx)
    for (let di = -1; di <= 1; di++)
      for (let dj = -1; dj <= 1; dj++) {
        if ((!di && !dj) || !free(g, i + di, j + dj)) continue
        if (di && dj && (!free(g, i + di, j) || !free(g, i, j + dj))) continue
        const n = (j + dj) * g.nx + i + di
        const c = cost[k] + (di && dj ? Math.SQRT2 : 1)
        if (c < cost[n]) {
          cost[n] = c
          prev[n] = k
          open.push([c + h(n), n])
        }
      }
  }
  const end = t[0] === cellOf(g, to)[0] && t[1] === cellOf(g, to)[1] ? to : centre(g, ...t)
  if (prev[goal] < 0 && goal !== start) return null
  const cells: Point[] = []
  for (let k = goal; k !== -1 && k !== start; k = prev[k]) cells.push(centre(g, k % g.nx, Math.floor(k / g.nx)))
  cells.reverse()
  if (cells.length) cells[cells.length - 1] = end
  else cells.push(end)
  const out: Point[] = []
  let a = from
  for (let k = 0; k < cells.length; k++) {
    if (k === cells.length - 1 || !clear(g, a, cells[k + 1])) {
      out.push(cells[k])
      a = cells[k]
    }
  }
  return out
}
