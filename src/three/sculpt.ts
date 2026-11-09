import { BufferAttribute, BufferGeometry, Color, Euler, Matrix4, MeshBasicMaterial, MeshStandardMaterial, Quaternion, Vector3 } from 'three'
import { MarchingCubes } from 'three/examples/jsm/objects/MarchingCubes.js'

const _m = new Matrix4()
const _q = new Quaternion()
const _v = new Vector3()

export type V3 = [number, number, number]
type Field = { c: V3; R: number; d(x: number, y: number, z: number): number }

function box({ size, r = 0.08, at = [0, 0, 0], rot = [0, 0, 0] }: { size: V3; r?: number; at?: V3; rot?: V3 }): Field {
  _q.setFromEuler(new Euler(...rot))
  const m = _m.compose(_v.set(...at), _q, new Vector3(1, 1, 1)).clone().invert().elements
  const hx = size[0] / 2 - r, hy = size[1] / 2 - r, hz = size[2] / 2 - r
  return {
    c: at,
    R: Math.hypot(...size) / 2,
    d(x: number, y: number, z: number) {
      const lx = Math.abs(m[0] * x + m[4] * y + m[8] * z + m[12]) - hx
      const ly = Math.abs(m[1] * x + m[5] * y + m[9] * z + m[13]) - hy
      const lz = Math.abs(m[2] * x + m[6] * y + m[10] * z + m[14]) - hz
      const ox = Math.max(lx, 0), oy = Math.max(ly, 0), oz = Math.max(lz, 0)
      return Math.sqrt(ox * ox + oy * oy + oz * oz) + Math.min(Math.max(lx, ly, lz), 0) - r
    },
  }
}

function cone({ a, b, r1, r2 }: { a: V3; b: V3; r1: number; r2: number }): Field {
  const bx = b[0] - a[0], by = b[1] - a[1], bz = b[2] - a[2]
  const l2 = bx * bx + by * by + bz * bz
  const rr = r1 - r2
  const a2 = l2 - rr * rr
  const il2 = 1 / l2
  return {
    c: [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2, (a[2] + b[2]) / 2],
    R: Math.sqrt(l2) / 2 + Math.max(r1, r2),
    d(x: number, y: number, z: number) {
      const px = x - a[0], py = y - a[1], pz = z - a[2]
      const yy = px * bx + py * by + pz * bz
      const zz = yy - l2
      const qx = px * l2 - bx * yy, qy = py * l2 - by * yy, qz = pz * l2 - bz * yy
      const x2 = qx * qx + qy * qy + qz * qz
      const y2 = yy * yy * l2
      const z2 = zz * zz * l2
      const k = Math.sign(rr) * rr * rr * x2
      if (Math.sign(zz) * a2 * z2 > k) return Math.sqrt(x2 + z2) * il2 - r2
      if (Math.sign(yy) * a2 * y2 < k) return Math.sqrt(x2 + y2) * il2 - r1
      return (Math.sqrt(x2 * a2 * il2) + yy * rr) * il2 - r1
    },
  }
}

function pyramid({ at, h, w, r = 0.015, rot = [0, 0, 0] }: { at: V3; h: number; w: number; r?: number; rot?: V3 }): Field {
  _q.setFromEuler(new Euler(...rot))
  const m = _m.compose(_v.set(...at), _q, new Vector3(1, 1, 1)).clone().invert().elements
  const hh = h / w
  const m2 = hh * hh + 0.25
  return {
    c: at,
    R: Math.max(h, w),
    d(x: number, y: number, z: number) {
      let px = Math.abs(m[0] * x + m[4] * y + m[8] * z + m[12]) / w
      const py = (m[1] * x + m[5] * y + m[9] * z + m[13]) / w
      let pz = Math.abs(m[2] * x + m[6] * y + m[10] * z + m[14]) / w
      if (pz > px) [px, pz] = [pz, px]
      px -= 0.5
      pz -= 0.5
      const qx = pz, qy = hh * py - 0.5 * px, qz = hh * px + 0.5 * py
      const s = Math.max(-qx, 0)
      const t = Math.min(1, Math.max(0, (qy - 0.5 * pz) / (m2 + 0.25)))
      const a = m2 * (qx + s) * (qx + s) + qy * qy
      const b = m2 * (qx + 0.5 * t) * (qx + 0.5 * t) + (qy - m2 * t) * (qy - m2 * t)
      const d2 = Math.min(qy, -qx * m2 - qy * 0.5) > 0 ? 0 : Math.min(a, b)
      return Math.sqrt((d2 + qz * qz) / m2) * Math.sign(Math.max(qz, -py)) * w - r
    },
  }
}

const SHAPES = { box, cone, pyramid }

const smin = (a: number, b: number, k: number) => {
  const h = Math.max(k - Math.abs(a - b), 0) / k
  return Math.min(a, b) - h * h * k * 0.25
}

export type Part = {
  shape: keyof typeof SHAPES
  color?: string
  k?: number
  cut?: boolean
  sway?: { pivot: V3; mode: 'tentacle' | 'antenna'; phase: number; len: number }
  size?: V3
  r?: number
  at?: V3
  rot?: V3
  a?: V3
  b?: V3
  r1?: number
  r2?: number
  h?: number
  w?: number
}

export function build(parts: Part[], res = 112, H = 1.15) {
  const ps = parts.map((p) => ({ ...p, ...(SHAPES[p.shape] as (p: Part) => Field)(p), col: new Color(p.color) }))
  const adds = ps.filter((p) => !p.cut)
  const cuts = ps.filter((p) => p.cut)
  const field = (x: number, y: number, z: number) => {
    let d = Infinity
    for (const p of adds) {
      const dx = x - p.c[0], dy = y - p.c[1], dz = z - p.c[2]
      const k = p.k ?? 0.06
      if (d !== Infinity && Math.sqrt(dx * dx + dy * dy + dz * dz) - p.R > d + k) continue
      const e = p.d(x, y, z)
      d = d === Infinity ? e : smin(d, e, k)
    }
    for (const p of cuts) {
      const dx = x - p.c[0], dy = y - p.c[1], dz = z - p.c[2]
      const k = p.k ?? 0.03
      if (Math.sqrt(dx * dx + dy * dy + dz * dz) - p.R > k) continue
      d = -smin(-d, p.d(x, y, z), k)
    }
    return d
  }

  const scratch = new MeshBasicMaterial()
  const mc = new MarchingCubes(res, scratch, false, false, 200000)
  mc.isolation = 0
  const half = res / 2
  const cell = (2 * H) / res
  for (let k = 0; k < res; k++)
    for (let j = 0; j < res; j++)
      for (let i = 0; i < res; i++) {
        const v = -field(((i - half) / half) * H, ((j - half) / half) * H, ((k - half) / half) * H) / cell
        mc.field[i + j * res + k * res * res] = Math.max(-4, Math.min(4, v))
      }
  mc.update()

  const n = mc.count
  const pos = new Float32Array(n * 3)
  const nor = new Float32Array(n * 3)
  const col = new Float32Array(n * 3)
  const swayed = ps.filter((p) => p.sway)
  const piv = swayed.length ? new Float32Array(n * 3) : null
  const sw = swayed.length ? new Float32Array(n * 4) : null
  const e = cell * 0.5
  for (let i = 0; i < n; i++) {
    const x = mc.positionArray[i * 3] * H, y = mc.positionArray[i * 3 + 1] * H, z = mc.positionArray[i * 3 + 2] * H
    pos.set([x, y, z], i * 3)
    const gx = field(x + e, y, z) - field(x - e, y, z)
    const gy = field(x, y + e, z) - field(x, y - e, z)
    const gz = field(x, y, z + e) - field(x, y, z - e)
    const gl = Math.hypot(gx, gy, gz) || 1
    nor.set([gx / gl, gy / gl, gz / gl], i * 3)
    let best: (typeof ps)[number] | null = null, bd = Infinity
    const ds = ps.map((p) => Math.abs(p.d(x, y, z)))
    for (let j = 0; j < ps.length; j++) if (ds[j] < bd && ps[j].color) { bd = ds[j]; best = ps[j] }
    let r = 0, g = 0, b = 0, wsum = 0
    ps.forEach((p, j) => {
      if (!p.color) return
      const w = Math.exp(-(ds[j] - bd) / 0.012)
      r += p.col.r * w; g += p.col.g * w; b += p.col.b * w; wsum += w
    })
    col.set([r / wsum, g / wsum, b / wsum], i * 3)
    if (sw && best?.sway) {
      const s = best.sway
      const along = Math.hypot(x - s.pivot[0], y - s.pivot[1], z - s.pivot[2]) / s.len
      piv!.set(s.pivot, i * 3)
      sw.set([Math.min(1, Math.max(0, along * 3)), s.phase, s.mode === 'antenna' ? 2 : 1, 0], i * 4)
    }
  }
  mc.geometry.dispose()
  scratch.dispose()
  return { position: pos, normal: nor, color: col, aPivot: piv, aSway: sw }
}

const SIZES: Record<string, number> = { position: 3, normal: 3, color: 3, aPivot: 3, aSway: 4 }

let worker: Worker | undefined
const pending = new Map<string, (g: BufferGeometry) => void>()
const cache = new Map<string, Promise<BufferGeometry>>()
const built = new Map<string, BufferGeometry>()
const fingerprint = (parts: Part[]) => {
  let h = 5381
  for (const ch of JSON.stringify(parts)) h = (h * 33 + ch.charCodeAt(0)) | 0
  return (h >>> 0).toString(36)
}
export function sculpt(name: string, parts: Part[]): Promise<BufferGeometry> {
  const key = `${name}:${fingerprint(parts)}`
  if (!cache.has(key)) {
    worker ??= new Worker(new URL('./sculpt.worker.ts', import.meta.url), { type: 'module' })
    worker.onmessage = ({ data }: MessageEvent) => {
      const g = new BufferGeometry()
      for (const [name, array] of Object.entries(data.arrays as Record<string, Float32Array | null>)) if (array) g.setAttribute(name, new BufferAttribute(array, SIZES[name]))
      g.computeBoundingSphere()
      built.set(data.key, g)
      pending.get(data.key)!(g)
    }
    cache.set(key, new Promise((resolve) => pending.set(key, resolve)))
    worker.postMessage({ key, parts })
  }
  return cache.get(key)!
}

export const sculpted = (name: string, parts: Part[]) => built.get(`${name}:${fingerprint(parts)}`) ?? null

export function sculptMaterial(time: { value: number }) {
  const m = new MeshStandardMaterial({ vertexColors: true, roughness: 0.55 })
  m.onBeforeCompile = (s) => {
    s.uniforms.uTime = time
    s.vertexShader = s.vertexShader
      .replace(
        '#include <common>',
        `#include <common>
uniform float uTime;
attribute vec3 aPivot;
attribute vec4 aSway;
vec3 swayed(vec3 p) {
  if (aSway.x <= 0.0) return p;
  float ax = 0.0, az = 0.0;
  if (aSway.z < 1.5) { float t = uTime * 2.2 + aSway.y; ax = sin(t) * 0.25; az = cos(t * 0.8) * 0.2; }
  else az = sin(uTime * 3.0 + aSway.y) * 0.12;
  ax *= aSway.x; az *= aSway.x;
  vec3 q = p - aPivot;
  q = vec3(q.x, q.y * cos(ax) - q.z * sin(ax), q.y * sin(ax) + q.z * cos(ax));
  q = vec3(q.x * cos(az) - q.y * sin(az), q.x * sin(az) + q.y * cos(az), q.z);
  return q + aPivot;
}`,
      )
      .replace('#include <begin_vertex>', 'vec3 transformed = swayed(vec3(position));')
  }
  return m
}
