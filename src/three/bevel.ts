import { BufferAttribute, BufferGeometry, Material, Vector3 } from 'three'

const SLOTS = 4
const FAR = 1e4

type Side = { t: number; i: number; j: number; key: string }
type Seg = { a: Vector3; dir: Vector3; len: number; inward: Vector3; n: Vector3 }

export function addBevelEdges(geometry: BufferGeometry, crease: number) {
  const pos = geometry.attributes.position
  const triCount = pos.count / 3
  const v = (i: number) => new Vector3().fromBufferAttribute(pos, i)

  const ids = new Map<string, number>()
  const weld = (i: number) => {
    const key = [pos.getX(i), pos.getY(i), pos.getZ(i)].map((x) => Math.round(x * 1e4)).join()
    if (!ids.has(key)) ids.set(key, ids.size)
    return ids.get(key)!
  }
  const vid = Array.from({ length: pos.count }, (_, i) => weld(i))

  const faceN: (Vector3 | null)[] = []
  const e1 = new Vector3()
  const e2 = new Vector3()
  for (let t = 0; t < triCount; t++) {
    const [a, b, c] = [v(3 * t), v(3 * t + 1), v(3 * t + 2)]
    const n = e1.subVectors(b, a).cross(e2.subVectors(c, a)).clone()
    faceN.push(n.lengthSq() > 1e-16 ? n.normalize() : null)
  }

  const halves = new Map<string, Side[]>()
  const sides: Side[] = []
  const twinKey = Array.from({ length: triCount }, (_, t) => [vid[3 * t], vid[3 * t + 1], vid[3 * t + 2]].sort((x, y) => x - y).join())
  for (let t = 0; t < triCount; t++) {
    if (!faceN[t]) continue
    for (let k = 0; k < 3; k++) {
      const i = 3 * t + k
      const j = 3 * t + ((k + 1) % 3)
      if (vid[i] === vid[j]) continue
      const side: Side = { t, i, j, key: `${vid[i]},${vid[j]}` }
      sides.push(side)
      if (!halves.has(side.key)) halves.set(side.key, [])
      halves.get(side.key)!.push(side)
    }
  }

  const parent = Array.from({ length: triCount }, (_, i) => i)
  const find = (x: number): number => (parent[x] === x ? x : (parent[x] = find(parent[x])))
  const cosCrease = Math.cos(crease)
  const nOf = (t: number) => faceN[t]!
  const hard: [Side, Side][] = []
  for (const s of sides) {
    let other: Side | null = null
    for (const o of halves.get(`${vid[s.j]},${vid[s.i]}`) ?? []) {
      if (twinKey[o.t] === twinKey[s.t]) continue
      if (!other || nOf(o.t).dot(nOf(s.t)) > nOf(other.t).dot(nOf(s.t))) other = o
    }
    if (!other) continue
    if (nOf(s.t).dot(nOf(other.t)) < cosCrease) hard.push([s, other])
    else parent[find(s.t)] = find(other.t)
  }

  const byRegion = new Map<number, Seg[]>()
  for (const [s, other] of hard) {
    const a = v(s.i)
    const b = v(s.j)
    const len = a.distanceTo(b)
    const dir = b.clone().sub(a).divideScalar(len)
    const third = v(3 * s.t + 3 - ((s.i % 3) + (s.j % 3)))
    const inward = nOf(s.t).clone().cross(dir).normalize()
    if (inward.dot(third.sub(a)) < 0) inward.negate()
    const r = find(s.t)
    if (!byRegion.has(r)) byRegion.set(r, [])
    byRegion.get(r)!.push({ a, dir, len, inward, n: nOf(other.t) })
  }
  for (const segs of byRegion.values()) mergeCollinear(segs)

  const D = new Float32Array(pos.count * 4).fill(FAR)
  const S = new Float32Array(pos.count * 4)
  const L = new Float32Array(pos.count * 4).fill(1)
  const N = Array.from({ length: SLOTS }, () => new Float32Array(pos.count * 3).map((_, i) => (i % 3 === 1 ? 1 : 0)))
  const p = new Vector3()
  const probes = [new Vector3(), new Vector3(), new Vector3(), new Vector3()]
  const near: { s: Seg; d: number }[] = []
  for (let t = 0; t < triCount; t++) {
    const segs = byRegion.get(find(t))
    if (!segs || !faceN[t]) continue
    for (let c = 0; c < 3; c++) probes[c].fromBufferAttribute(pos, 3 * t + c)
    probes[3].copy(probes[0]).add(probes[1]).add(probes[2]).divideScalar(3)
    near.length = 0
    for (const s of segs) {
      let d = Infinity
      for (const q of probes) d = Math.min(d, segDistance(q, s, p))
      if (near.length < SLOTS || d < near[near.length - 1].d) {
        near.push({ s, d })
        near.sort((x, y) => x.d - y.d)
        if (near.length > SLOTS) near.pop()
      }
    }
    near.forEach(({ s }, k) => {
      for (let c = 0; c < 3; c++) {
        const i = 3 * t + c
        p.subVectors(probes[c], s.a)
        D[4 * i + k] = p.dot(s.inward)
        S[4 * i + k] = p.dot(s.dir)
        L[4 * i + k] = s.len
        s.n.toArray(N[k], 3 * i)
      }
    })
  }
  geometry.setAttribute('bevelD', new BufferAttribute(D, 4))
  geometry.setAttribute('bevelS', new BufferAttribute(S, 4))
  geometry.setAttribute('bevelL', new BufferAttribute(L, 4))
  N.forEach((n, k) => geometry.setAttribute(`bevelN${k}`, new BufferAttribute(n, 3)))
  return geometry
}

function segDistance(q: Vector3, s: Seg, scratch: Vector3) {
  const d = scratch.subVectors(q, s.a)
  const along = Math.min(Math.max(d.dot(s.dir), 0), s.len)
  return d.addScaledVector(s.dir, -along).length()
}

function mergeCollinear(segs: Seg[]) {
  for (let i = 0; i < segs.length; i++) {
    for (let j = segs.length - 1; j > i; j--) {
      const s = segs[i]
      const o = segs[j]
      if (Math.abs(s.dir.dot(o.dir)) < 0.9999 || s.n.dot(o.n) < 0.9999) continue
      const off = o.a.clone().sub(s.a)
      if (off.clone().addScaledVector(s.dir, -off.dot(s.dir)).length() > 1e-4) continue
      const t0 = off.dot(s.dir)
      const t1 = t0 + o.len * s.dir.dot(o.dir)
      const lo = Math.min(0, t0, t1)
      const hi = Math.max(s.len, t0, t1)
      if (Math.min(t0, t1) > s.len + 1e-4 || Math.max(t0, t1) < -1e-4) continue
      s.a.addScaledVector(s.dir, lo)
      s.len = hi - lo
      segs.splice(j, 1)
    }
  }
}

const vertexHead = `
attribute vec4 bevelD, bevelS, bevelL;
attribute vec3 bevelN0, bevelN1, bevelN2, bevelN3;
varying vec4 vBevelD, vBevelS, vBevelL;
varying vec3 vBevelN0, vBevelN1, vBevelN2, vBevelN3;
`
const vertexBody = `
float bevelScale = (length(modelMatrix[0].xyz) + length(modelMatrix[1].xyz) + length(modelMatrix[2].xyz)) / 3.0;
vBevelD = bevelD * bevelScale;
vBevelS = bevelS * bevelScale;
vBevelL = bevelL * bevelScale;
#ifdef USE_SKINNING
  #define BEVEL_N(n) normalize(normalMatrix * (skinMatrix * vec4(n, 0.0)).xyz)
#else
  #define BEVEL_N(n) normalize(normalMatrix * n)
#endif
vBevelN0 = BEVEL_N(bevelN0);
vBevelN1 = BEVEL_N(bevelN1);
vBevelN2 = BEVEL_N(bevelN2);
vBevelN3 = BEVEL_N(bevelN3);
`
const fragmentHead = `
uniform float bevelWidth;
varying vec4 vBevelD, vBevelS, vBevelL;
varying vec3 vBevelN0, vBevelN1, vBevelN2, vBevelN3;
vec3 bevelTilt(vec3 n, vec3 m) {
  float c = dot(n, m);
  return (m - c * n) / max(1.0 + c, 0.2);
}
`
const fragmentBody = `
{
  vec4 over = max(max(-vBevelS, vBevelS - vBevelL), 0.0);
  vec4 x = clamp(sqrt(vBevelD * vBevelD + over * over) / bevelWidth, 0.0, 1.0);
  vec4 f = (1.0 - x) * (1.0 - x);
  vec3 m0 = vBevelN0, m1 = vBevelN1, m2 = vBevelN2, m3 = vBevelN3;
  #ifdef DOUBLE_SIDED
    m0 *= faceDirection; m1 *= faceDirection; m2 *= faceDirection; m3 *= faceDirection;
  #endif
  if (dot(m0, m1) > 0.9) { f.x = max(f.x, f.y); f.y = 0.0; }
  if (dot(m0, m2) > 0.9) { f.x = max(f.x, f.z); f.z = 0.0; }
  if (dot(m0, m3) > 0.9) { f.x = max(f.x, f.w); f.w = 0.0; }
  if (dot(m1, m2) > 0.9) { f.y = max(f.y, f.z); f.z = 0.0; }
  if (dot(m1, m3) > 0.9) { f.y = max(f.y, f.w); f.w = 0.0; }
  if (dot(m2, m3) > 0.9) { f.z = max(f.z, f.w); f.w = 0.0; }
  normal = normalize(normal + f.x * bevelTilt(normal, m0) + f.y * bevelTilt(normal, m1)
    + f.z * bevelTilt(normal, m2) + f.w * bevelTilt(normal, m3));
}
`

export function bevelMaterial<M extends Material>(material: M, width: number): M {
  const m = material.clone() as M
  m.onBeforeCompile = (shader) => {
    shader.uniforms.bevelWidth = { value: width }
    shader.vertexShader = vertexHead + shader.vertexShader.replace('#include <project_vertex>', `#include <project_vertex>\n${vertexBody}`)
    shader.fragmentShader = fragmentHead + shader.fragmentShader.replace('#include <normal_fragment_maps>', `#include <normal_fragment_maps>\n${fragmentBody}`)
  }
  m.customProgramCacheKey = () => `bevel${width}`
  return m
}
