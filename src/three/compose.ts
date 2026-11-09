import * as THREE from 'three'
import { clone as skeletonClone } from 'three/examples/jsm/utils/SkeletonUtils.js'
import type { Avatar, Style } from '../data/models'

const MOUTH = new Set([21, 22, 23])
const HAND = /^(Hand|[IOT]\.?[LR]$|Index|Other|Thumb)/
type Region = 'head' | 'body' | 'feet' | 'hands'
const regionOf = (n: string): Region => (n === 'Head' ? 'head' : /^(Foot|Toes)/.test(n) ? 'feet' : HAND.test(n) ? 'hands' : 'body')

export const SLOT_OF_ZONE: (string | null)[] = [null, 'skin', 'hair', 'hair2', 'top', 'top2', 'shoes', 'belt', 'trim', 'buckle', 'apron']
const PART_SLOTS: Record<Region, [number, number]> = { head: [2, 3], body: [4, 5], feet: [6, 0], hands: [0, 0] }

type Palette = { px: Uint8ClampedArray; w: number; h: number }
const pixelCache = new WeakMap<CanvasImageSource, Palette>()
function pixels(image: HTMLImageElement | ImageBitmap) {
  let p = pixelCache.get(image)
  if (!p) {
    const c = document.createElement('canvas')
    c.width = image.width
    c.height = image.height
    const ctx = c.getContext('2d', { willReadFrequently: true })!
    ctx.drawImage(image, 0, 0)
    p = { px: ctx.getImageData(0, 0, c.width, c.height).data, w: c.width, h: c.height }
    pixelCache.set(image, p)
  }
  return p
}

function skinnedMeshes(root: THREE.Object3D) {
  const list: THREE.SkinnedMesh[] = []
  root.traverse((o) => {
    if (o instanceof THREE.SkinnedMesh) list.push(o)
  })
  return list.sort((a, b) => b.geometry.attributes.position.count - a.geometry.attributes.position.count)
}

function dominantBone(geo: THREE.BufferGeometry, v: number) {
  const si = geo.attributes.skinIndex
  const sw = geo.attributes.skinWeight
  let best = 0
  for (let k = 1; k < 4; k++) if (sw.getComponent(v, k) > sw.getComponent(v, best)) best = k
  return si.getComponent(v, best)
}

type Tri = { v: number[]; reg: Region; col: number; row: number; sw: number; c: THREE.Vector3; w: THREE.Vector3; nz: number; area: number }

function triangles(mesh: THREE.SkinnedMesh) {
  const geo = mesh.geometry
  const { position: pos, uv } = geo.attributes
  const names = mesh.skeleton.bones.map((b) => b.name)
  const idx = geo.index
  const n = idx ? idx.count : pos.count
  const at = (i: number) => (idx ? idx.getX(i) : i)
  const out: Tri[] = []
  for (let t = 0; t < n; t += 3) {
    const v = [at(t), at(t + 1), at(t + 2)]
    const r = v.map((i) => regionOf(names[dominantBone(geo, i)]))
    const reg = r[0] === r[1] || r[0] === r[2] ? r[0] : r[1]
    let u = 0
    let w = 0
    const c = new THREE.Vector3()
    for (const i of v) {
      u += uv.getX(i) / 3
      w += uv.getY(i) / 3
      c.x += pos.getX(i) / 3
      c.y += pos.getY(i) / 3
      c.z += pos.getZ(i) / 3
    }
    const col = Math.min(7, Math.max(0, Math.floor(u * 8)))
    const row = Math.min(3, Math.max(0, Math.floor(w * 4)))
    const [a, b, d] = v.map((i) => new THREE.Vector3().fromBufferAttribute(pos, i).applyMatrix4(mesh.matrix))
    const cr = b.sub(a).cross(d.sub(a))
    const area = cr.length() / 2
    out.push({ v, reg, col, row, sw: row * 8 + col, c, w: c.clone().applyMatrix4(mesh.matrix), nz: cr.z / (2 * area || 1), area })
  }
  return out
}

function paints({ px, w, h }: Palette) {
  const cell = (sw: number) => {
    const x = Math.round(((sw % 8) + 0.5) * (w / 8))
    const y0 = Math.ceil((Math.floor(sw / 8) * h) / 4) + 2
    let s = ''
    for (let y = y0; y < y0 + h / 4 - 5; y++) {
      const p = (y * w + x) * 4
      s += `${px[p]},${px[p + 1]},${px[p + 2]};`
    }
    return s
  }
  const cells = Array.from({ length: 32 }, (_, sw) => cell(sw))
  return cells.map((c) => cells.indexOf(c))
}

type Piece = {
  geometry: THREE.BufferGeometry
  src: THREE.SkinnedMesh
  boneNames: string[]
  boneInverses: THREE.Matrix4[]
  featureStart?: number
  faceIndex?: number[]
  faceUV?: Float32Array
  faceAspect?: number
}
type Paint = { zone: Uint8Array; base: Float32Array; shade: Float32Array }
type Source = {
  main: THREE.SkinnedMesh<THREE.BufferGeometry, THREE.MeshStandardMaterial>
  extras: THREE.SkinnedMesh[]
  tris: Tri[]
  skinSw: number
  palette: Palette
  paint: number[]
  pieces: Partial<Record<Region, Piece[]>>
}

const sources = new WeakMap<THREE.Object3D, Source>()
function source(scene: THREE.Object3D) {
  let s = sources.get(scene)
  if (!s) {
    scene.updateWorldMatrix(true, true)
    const [main, ...extras] = skinnedMeshes(scene)
    const tris = triangles(main)
    const count = new Map<number, number>()
    for (const t of tris) if (t.reg === 'hands') count.set(t.sw, (count.get(t.sw) || 0) + 1)
    const skinSw = [...count].sort((a, b) => b[1] - a[1])[0][0]
    const mat = main.material as THREE.MeshStandardMaterial
    const palette = pixels(mat.map!.image)
    s = { main: main as Source['main'], extras, tris, skinSw, palette, paint: paints(palette), pieces: {} }
    sources.set(scene, s)
  }
  return s
}

export type RefFace = {
  front: number
  halfW: number
  top: number
  bottom: number
  cx: number
  H: number
  c: THREE.Vector3
  dims: THREE.Vector3
  rect: { z: number; w: number; y0: number; y1: number }
}
const refFaces = new WeakMap<THREE.Object3D, RefFace>()
export function refFace(refScene: THREE.Object3D) {
  let f = refFaces.get(refScene)
  if (!f) {
    const s = source(refScene)
    const pos = s.main.geometry.attributes.position
    const M = s.main.matrix
    const head = new THREE.Box3()
    const skin: THREE.Vector3[] = []
    const p = new THREE.Vector3()
    for (const t of s.tris) {
      if (t.reg !== 'head') continue
      for (const i of t.v) {
        p.fromBufferAttribute(pos, i).applyMatrix4(M)
        head.expandByPoint(p)
        if (t.sw === s.skinSw) skin.push(p.clone())
      }
    }
    head.expandByVector(head.getSize(new THREE.Vector3()).multiplyScalar(0.03))
    const c = head.getCenter(new THREE.Vector3())
    const H = head.getSize(new THREE.Vector3()).y
    const front = Math.max(...skin.map((q) => q.z))
    const face = skin.filter((q) => q.z > front - 0.05 * H)
    const halfW = Math.max(...face.map((q) => Math.abs(q.x - c.x)))
    const top = Math.max(...skin.map((q) => q.y))
    const bottom = Math.min(...skin.map((q) => q.y))
    f = {
      front, halfW, top, bottom, cx: c.x, H, c,
      dims: head.getSize(new THREE.Vector3()).divideScalar(H),
      rect: { z: (front - c.z) / H, w: (2 * halfW) / H, y0: (bottom - c.y) / H, y1: (top - c.y) / H },
    }
    refFaces.set(refScene, f)
  }
  return f
}

type Island = { tris: number[]; box: THREE.Box3 }
function islands(mesh: THREE.SkinnedMesh, tris: Tri[]): Island[] {
  const pos = mesh.geometry.attributes.position
  const key = (i: number) => `${Math.round(pos.getX(i) * 1e4)},${Math.round(pos.getY(i) * 1e4)},${Math.round(pos.getZ(i) * 1e4)}`
  const parent = new Map<string, string>()
  const find = (k: string) => {
    while (parent.get(k) !== k) {
      parent.set(k, parent.get(parent.get(k)!)!)
      k = parent.get(k)!
    }
    return k
  }
  for (const t of tris) for (const i of t.v) if (!parent.has(key(i))) parent.set(key(i), key(i))
  for (const t of tris) {
    const [a, b, c] = t.v.map((i) => find(key(i)))
    parent.set(b, a)
    parent.set(find(c), a)
  }
  const groups = new Map<string, Island>()
  const p = new THREE.Vector3()
  tris.forEach((t, ti) => {
    const r = find(key(t.v[0]))
    if (!groups.has(r)) groups.set(r, { tris: [], box: new THREE.Box3() })
    const g = groups.get(r)!
    g.tris.push(ti)
    for (const i of t.v) g.box.expandByPoint(p.fromBufferAttribute(pos, i).applyMatrix4(mesh.matrix))
  })
  return [...groups.values()]
}

function overlap(a: THREE.Box3, b: THREE.Box3) {
  const i = a.clone().intersect(b)
  if (i.isEmpty()) return 0
  const v = (x: THREE.Box3) => {
    const s = x.getSize(new THREE.Vector3())
    return s.x * s.y * s.z
  }
  return v(i) / (v(a) + v(b) - v(i))
}

const refSkulls = new WeakMap<THREE.Object3D, THREE.Box3>()
function refSkull(refScene: THREE.Object3D) {
  let box = refSkulls.get(refScene)
  if (!box) {
    const s = source(refScene)
    const head = s.tris.filter((t) => t.reg === 'head')
    box = islands(s.main, head).sort((a, b) => b.tris.length - a.tris.length)[0].box
    refSkulls.set(refScene, box)
  }
  return box
}

type Role = 'skull' | 'face' | 'hair'
function headRoles(src: Source, tris: Tri[], refScene: THREE.Object3D) {
  const groups = islands(src.main, tris)
  const skull = groups.reduce((best, g) => (overlap(g.box, refSkull(refScene)) > overlap(best.box, refSkull(refScene)) ? g : best))
  const sb = skull.box
  const H = sb.max.y - sb.min.y
  const halfW = (sb.max.x - sb.min.x) / 2
  const cx = (sb.max.x + sb.min.x) / 2
  const roles: Role[] = new Array(tris.length).fill('hair')
  const near = sb.clone().expandByVector(new THREE.Vector3(0.12 * H, 0, 0))
  for (const g of groups) {
    const c = g.box.getCenter(new THREE.Vector3())
    const skinOnly = g.tris.every((ti) => tris[ti].sw === src.skinSw)
    let role: Role = 'hair'
    if (g === skull) role = 'skull'
    else if (skinOnly && near.containsBox(g.box) && Math.abs(c.x - cx) > halfW * 0.7) role = 'skull'
    else if (
      g.box.max.z > sb.max.z - 0.06 * H &&
      c.z > (sb.min.z + sb.max.z) / 2 &&
      g.box.max.y < sb.max.y - 0.12 * H &&
      Math.abs(c.x - cx) < halfW
    )
      role = 'face'
    for (const ti of g.tris) roles[ti] = role
  }
  return { roles, skullBox: sb }
}

function zones(part: Region, tris: Tri[], src: Source, roles: Role[] | null) {
  const cand = new Map<number, number>()
  const z = tris.map((t, i) => {
    const skull = part !== 'head' || roles?.[i] === 'skull'
    if (t.sw === src.skinSw && skull) return 1
    if (part === 'hands' || (part === 'head' && MOUTH.has(t.sw))) return 0
    const paint = src.paint[t.sw]
    cand.set(paint, (cand.get(paint) || 0) + 1)
    return -1 - paint
  })
  const ranked = [...cand].sort((a, b) => b[1] - a[1])
  const a = ranked[0]?.[0]
  const b = ranked[1]?.[1] >= 8 ? ranked[1][0] : undefined
  const [A, B] = PART_SLOTS[part]
  return z.map((v) => (v >= 0 ? v : -1 - v === a ? A : -1 - v === b ? B : 0))
}

const ATTRS = ['position', 'normal', 'uv', 'skinIndex', 'skinWeight']

function piece(src: Source, mesh: THREE.SkinnedMesh, tris: Tri[], triZones: number[]): Piece {
  const geo = mesh.geometry
  const g = new THREE.BufferGeometry()
  const n = tris.length * 3
  for (const name of ATTRS) {
    const a = geo.attributes[name]
    if (!a) continue
    const s = a.itemSize
    const arr = new (a.array.constructor as Float32ArrayConstructor)(n * s)
    tris.forEach((t, ti) =>
      t.v.forEach((vi, k) => {
        for (let c = 0; c < s; c++) arr[(ti * 3 + k) * s + c] = a.array[vi * s + c]
      }),
    )
    g.setAttribute(name, new THREE.BufferAttribute(arr, s, a.normalized))
  }
  const { px, w, h } = src.palette
  const zone = new Uint8Array(n)
  const base = new Float32Array(n * 3)
  const shade = new Float32Array(n)
  const col = new THREE.Color()
  const uv = geo.attributes.uv
  const cw = w / 8
  const rh = h / 4
  tris.forEach((t, ti) =>
    t.v.forEach((vi, k) => {
      const o = ti * 3 + k
      zone[o] = triZones[ti]
      const fy = Math.min(1, Math.max(0, uv.getY(vi) * 4 - t.row))
      shade[o] = fy
      const x = Math.round(Math.min((t.col + 1) * cw - 3, Math.max(t.col * cw + 2, uv.getX(vi) * w)))
      const y = Math.round(Math.min((t.row + 1) * rh - 3, Math.max(t.row * rh + 2, uv.getY(vi) * h)))
      const p = (y * w + x) * 4
      col.setRGB(px[p] / 255, px[p + 1] / 255, px[p + 2] / 255, THREE.SRGBColorSpace)
      base[o * 3] = col.r
      base[o * 3 + 1] = col.g
      base[o * 3 + 2] = col.b
    }),
  )
  g.userData = { zone, base, shade } satisfies Paint
  return {
    geometry: g,
    src: mesh,
    boneNames: mesh.skeleton.bones.map((b) => b.name),
    boneInverses: mesh.skeleton.boneInverses,
  }
}

function pieces(scene: THREE.Object3D, part: Region, refScene: THREE.Object3D): Piece[] {
  const src = source(scene)
  if (!src.pieces[part]) {
    let tris = src.tris.filter((t) => t.reg === part)
    let list: Piece[]
    if (part === 'head') {
      const { roles, skullBox } = headRoles(src, tris, refScene)
      const order = tris.map((t, i) => i).sort((a, b) => Number(roles[a] === 'face') - Number(roles[b] === 'face'))
      tris = order.map((i) => tris[i])
      const r = order.map((i) => roles[i])
      const featureStart = r.indexOf('face') < 0 ? tris.length * 3 : r.indexOf('face') * 3
      list = [{ ...piece(src, src.main, tris, zones(part, tris, src, r)), featureStart, ...facePhoto(src, tris, r, skullBox) }]
      for (const m of src.extras) {
        const all = triangles(m)
        const eyes = piece(src, m, all, all.map(() => 0))
        shutEyes(m, all, eyes.geometry)
        list.push({ ...eyes, featureStart: 0 })
      }
    } else list = [piece(src, src.main, tris, zones(part, tris, src, null))]
    src.pieces[part] = list
  }
  return src.pieces[part]
}

function shutEyes(mesh: THREE.SkinnedMesh, tris: Tri[], geometry: THREE.BufferGeometry) {
  const M = mesh.matrix
  const inv = M.clone().invert()
  const pos = geometry.attributes.position
  const delta = new Float32Array(pos.count * 3)
  const p = new THREE.Vector3()
  for (const g of islands(mesh, tris)) {
    const cy = (g.box.min.y + g.box.max.y) / 2
    for (const ti of g.tris) {
      for (let o = ti * 3; o < ti * 3 + 3; o++) {
        p.fromBufferAttribute(pos, o).applyMatrix4(M)
        p.y = cy + (p.y - cy) * 0.08
        p.applyMatrix4(inv)
        delta[o * 3] = p.x - pos.getX(o)
        delta[o * 3 + 1] = p.y - pos.getY(o)
        delta[o * 3 + 2] = p.z - pos.getZ(o)
      }
    }
  }
  geometry.morphAttributes.position = [new THREE.BufferAttribute(delta, 3)]
  geometry.morphTargetsRelative = true
}

function facePhoto(src: Source, tris: Tri[], roles: Role[], sb: THREE.Box3) {
  const pos = src.main.geometry.attributes.position
  const M = src.main.matrix
  const p = new THREE.Vector3()
  const W = sb.max.x - sb.min.x
  const H = sb.max.y - sb.min.y
  const uv = new Float32Array(tris.length * 6)
  const index: number[] = []
  tris.forEach((t, ti) => {
    t.v.forEach((vi, k) => {
      p.fromBufferAttribute(pos, vi).applyMatrix4(M)
      uv[(ti * 3 + k) * 2] = (p.x - sb.min.x) / W
      uv[(ti * 3 + k) * 2 + 1] = (p.y - sb.min.y) / H
    })
    if (roles[ti] === 'skull' && t.sw === src.skinSw && t.nz > 0.8 && t.w.z > sb.max.z - 0.03 * H) index.push(ti * 3, ti * 3 + 1, ti * 3 + 2)
  })
  return { faceIndex: index, faceUV: uv, faceAspect: W / H }
}

type Attr = 'position' | 'normal' | 'uv' | 'skinIndex' | 'skinWeight'
const V_ATTRS: [Attr, number][] = [['position', 3], ['normal', 3], ['uv', 2], ['skinIndex', 4], ['skinWeight', 4]]
type Vert = Record<Attr, number[]> & { zone: number; shade: number; base: number[]; reshaped?: boolean }
type Tri3 = Vert[]

function readVerts(piece: Piece) {
  const g = piece.geometry
  const { zone, base, shade } = g.userData as Paint
  const M = piece.src.matrix
  const nm = new THREE.Matrix3().getNormalMatrix(M)
  const out: Vert[] = []
  for (let i = 0; i < g.attributes.position.count; i++) {
    const attr = (k: Attr, n: number) => Array.from({ length: n }, (_, c) => g.attributes[k].array[i * n + c])
    const v: Vert = {
      zone: zone[i],
      shade: shade[i],
      base: [base[i * 3], base[i * 3 + 1], base[i * 3 + 2]],
      ...(Object.fromEntries(V_ATTRS.map(([k, n]) => [k, attr(k, n)])) as Record<Attr, number[]>),
    }
    const p = new THREE.Vector3().fromArray(v.position).applyMatrix4(M)
    const q = new THREE.Vector3().fromArray(v.normal).applyMatrix3(nm).normalize()
    v.position = p.toArray()
    v.normal = q.toArray()
    out.push(v)
  }
  return out
}

function lerpVert(a: Vert, b: Vert, t: number): Vert {
  const mix = (x: number[], y: number[]) => x.map((xv, i) => xv + (y[i] - xv) * t)
  const near = t < 0.5 ? a : b
  return {
    position: mix(a.position, b.position),
    normal: mix(a.normal, b.normal),
    uv: mix(a.uv, b.uv),
    skinIndex: near.skinIndex,
    skinWeight: near.skinWeight,
    zone: near.zone,
    shade: a.shade + (b.shade - a.shade) * t,
    base: mix(a.base, b.base),
  }
}

function slice(tris: Tri3[], axis: number, value: number) {
  const out: Tri3[] = []
  for (const tri of tris) {
    const d = tri.map((v) => v.position[axis] - value)
    const side = d.map((x) => x >= 0)
    if (side[0] === side[1] && side[1] === side[2]) {
      out.push(tri)
      continue
    }
    const i = side[0] === side[1] ? 2 : side[0] === side[2] ? 1 : 0
    const P = tri[i]
    const Q = tri[(i + 1) % 3]
    const R = tri[(i + 2) % 3]
    const dP = d[i]
    const PQ = lerpVert(P, Q, dP / (dP - d[(i + 1) % 3]))
    const PR = lerpVert(P, R, dP / (dP - d[(i + 2) % 3]))
    out.push([P, PQ, PR], [PQ, Q, R], [PQ, R, PR])
  }
  return out
}

const smoothstep = (t: number) => t * t * (3 - 2 * t)

function dressPiece(piece: Piece, style: Style) {
  const verts = readVerts(piece)
  let tris: Tri3[] = []
  for (let i = 0; i < verts.length; i += 3) tris.push([verts[i], verts[i + 1], verts[i + 2]])
  const ys = tris.flat().map((v) => v.position[1])
  const hem = Math.min(...ys)
  const waist = style.waist ?? hem
  const cuts: [number, number][] = []
  if (style.flare) for (let k = 1; k < 6; k++) cuts.push([1, hem + ((waist - hem) * k) / 6])
  if (style.belt) cuts.push([1, style.belt.y - style.belt.h / 2], [1, style.belt.y], [1, style.belt.y + style.belt.h / 2], [0, -0.04], [0, 0.04])
  if (style.trim) cuts.push([1, hem + style.trim.h], [1, hem + style.trim.h * 0.5])
  if (style.apron) cuts.push([0, -style.apron.x], [0, style.apron.x], [1, style.apron.y0], [1, style.apron.y1])
  for (const [axis, value] of cuts) tris = slice(tris, axis, value)

  const cz = 0.065
  const puffAt = (y: number) => {
    if (style.trim) {
      const t = (y - hem) / style.trim.h
      if (t <= 1) return 0.024 * Math.sin(Math.PI * Math.min(1, 0.35 + t * 0.65))
    }
    if (style.belt) {
      const t = Math.abs(y - style.belt.y) / (style.belt.h / 2)
      if (t < 1) return 0.012 * (1 - t)
    }
    return 0
  }
  const flareAt = (y: number) => (style.flare && y < waist ? style.flare * Math.pow(smoothstep((waist - y) / (waist - hem)), 1.2) : 0)
  for (const tri of tris) {
    const c = [0, 1, 2].map((a) => tri.reduce((sum, v) => sum + v.position[a], 0) / 3)
    const n = new THREE.Vector3()
      .subVectors(new THREE.Vector3().fromArray(tri[1].position), new THREE.Vector3().fromArray(tri[0].position))
      .cross(new THREE.Vector3().subVectors(new THREE.Vector3().fromArray(tri[2].position), new THREE.Vector3().fromArray(tri[0].position)))
      .normalize()
    let zone: number | null = null
    if (style.apron && n.z > 0.5 && Math.abs(c[0]) < style.apron.x && c[1] > style.apron.y0 && c[1] < style.apron.y1) zone = 10
    if (style.belt && Math.abs(c[1] - style.belt.y) < style.belt.h / 2) zone = style.buckle && n.z > 0.5 && Math.abs(c[0]) < 0.04 ? 9 : 7
    if (style.trim && c[1] < hem + style.trim.h) zone = 8
    if (zone != null) for (let k = 0; k < 3; k++) tri[k] = { ...tri[k], zone }
  }

  const moved = new Map<string, number[]>()
  const shaped = tris.map((tri) =>
    tri.map((v) => {
      const [x, y, z] = v.position
      const key = v.position.map((q) => Math.round(q * 1e4)).join(',')
      let p = moved.get(key)
      if (!p) {
        const puff = puffAt(y)
        const r = Math.hypot(x, z - cz) || 1
        const s = 1 + flareAt(y)
        p = [x * s + (x / r) * puff, y, cz + (z - cz) * s + ((z - cz) / r) * puff]
        moved.set(key, p)
      }
      return { ...v, position: p, reshaped: y < waist + 0.001 || v.zone >= 7 }
    }),
  )
  const sums = new Map<string, THREE.Vector3>()
  const pkey = (p: number[]) => p.map((q) => Math.round(q * 1e4)).join(',')
  for (const tri of shaped) {
    const [a, b, c] = tri.map((v) => new THREE.Vector3().fromArray(v.position))
    const fn = new THREE.Vector3().subVectors(b, a).cross(new THREE.Vector3().subVectors(c, a))
    for (const v of tri) {
      const k = pkey(v.position)
      sums.set(k, (sums.get(k) || new THREE.Vector3()).add(fn))
    }
  }

  return writePiece(
    piece,
    shaped.map((tri) => tri.map((v) => (v.reshaped ? { ...v, normal: sums.get(pkey(v.position))!.clone().normalize().toArray() } : v))),
  )
}

function writePiece(piece: Piece, tris: Tri3[]): Piece {
  const n = tris.length * 3
  const g = new THREE.BufferGeometry()
  const inv = piece.src.matrix.clone().invert()
  const ninv = new THREE.Matrix3().getNormalMatrix(inv)
  const arrays = Object.fromEntries(V_ATTRS.map(([k, w]) => [k, new Float32Array(n * w)])) as Record<Attr, Float32Array>
  const zone = new Uint8Array(n)
  const base = new Float32Array(n * 3)
  const shade = new Float32Array(n)
  const p = new THREE.Vector3()
  const q = new THREE.Vector3()
  tris.flat().forEach((v, i) => {
    p.fromArray(v.position).applyMatrix4(inv)
    arrays.position.set(p.toArray(), i * 3)
    arrays.normal.set(q.fromArray(v.normal).applyMatrix3(ninv).normalize().toArray(), i * 3)
    arrays.uv.set(v.uv, i * 2)
    arrays.skinIndex.set(v.skinIndex, i * 4)
    arrays.skinWeight.set(v.skinWeight, i * 4)
    zone[i] = v.zone
    base.set(v.base, i * 3)
    shade[i] = v.shade
  })
  for (const [k, w] of V_ATTRS) {
    const src = piece.geometry.attributes[k]
    g.setAttribute(k, new THREE.BufferAttribute(new (src.array.constructor as Float32ArrayConstructor)(arrays[k]), w, src.normalized))
  }
  g.userData = { zone, base, shade } satisfies Paint
  return { ...piece, geometry: g }
}

const asTris = (verts: Vert[]) => Array.from({ length: verts.length / 3 }, (_, i) => verts.slice(i * 3, i * 3 + 3))

function triIslands(tris: Tri3[]) {
  const key = (v: Vert) => v.position.map((q) => Math.round(q * 1e4)).join(',')
  const parent = new Map<string, string>()
  const find = (k: string) => {
    while (parent.get(k) !== k) k = parent.get(k)!
    return k
  }
  for (const t of tris) for (const v of t) if (!parent.has(key(v))) parent.set(key(v), key(v))
  for (const t of tris) {
    const [a, b, c] = t.map((v) => find(key(v)))
    parent.set(b, a)
    parent.set(find(c), a)
  }
  const groups = new Map<string, Tri3[]>()
  for (const t of tris) {
    const r = find(key(t[0]))
    if (!groups.has(r)) groups.set(r, [])
    groups.get(r)!.push(t)
  }
  return [...groups.values()].sort((a, b) => b.length - a.length)
}

function band(torso: Tri3[], y0: number, y1: number) {
  const pts = torso
    .filter((t) => Math.max(...t.map((v) => v.position[1])) >= y0 && Math.min(...t.map((v) => v.position[1])) <= y1)
    .flat()
  const xs = pts.map((v) => Math.abs(v.position[0]))
  const zs = pts.map((v) => v.position[2])
  return { hw: Math.max(...xs), front: Math.max(...zs), back: Math.min(...zs) }
}

function graftPiece(basePiece: Piece, donorPiece: Piece) {
  const [baseTorso] = triIslands(asTris(readVerts(basePiece)))
  const [donorTorso, ...details] = triIslands(asTris(readVerts(donorPiece)))
  const rename = donorPiece.boneNames.map((n) => basePiece.boneNames.indexOf(n))
  const out = [...baseTorso]
  for (const island of details) {
    const ys = island.flat().map((v) => v.position[1])
    const zs = island.flat().map((v) => v.position[2])
    const y0 = Math.min(...ys)
    const y1 = Math.max(...ys)
    const d = band(donorTorso, y0, y1)
    const b = band(baseTorso, y0, y1)
    const onFront = (Math.min(...zs) + Math.max(...zs)) / 2 > (d.front + d.back) / 2
    const sx = b.hw / d.hw
    const dz = onFront ? b.front - d.front : b.back - d.back
    out.push(
      ...island.map((tri) =>
        tri.map((v) => ({
          ...v,
          position: [v.position[0] * sx, v.position[1], v.position[2] + dz],
          skinIndex: v.skinIndex.map((i) => rename[i]),
        })),
      ),
    )
  }
  return writePiece(basePiece, out)
}

const grafted = new Map<string, Piece[]>()
function graftedPieces(baseScene: THREE.Object3D, donorScene: THREE.Object3D, refScene: THREE.Object3D, key: string) {
  let list = grafted.get(key)
  if (!list) {
    list = [graftPiece(pieces(baseScene, 'body', refScene)[0], pieces(donorScene, 'body', refScene)[0])]
    grafted.set(key, list)
  }
  return list
}

const dressed = new Map<string, Piece[]>()
function dressedPieces(scene: THREE.Object3D, refScene: THREE.Object3D, style: Style, key: string) {
  let list = dressed.get(key)
  if (!list) {
    list = pieces(scene, 'body', refScene).map((p) => dressPiece(p, style))
    dressed.set(key, list)
  }
  return list
}

export function composeAvatar(
  scenes: Record<string, THREE.Object3D>,
  refScene: THREE.Object3D,
  { head, outfit, shoes }: Pick<Avatar, 'head' | 'outfit' | 'shoes'>,
  torso = outfit,
  style: Style | null = null,
) {
  const root = skeletonClone(scenes[outfit])
  const old = skinnedMeshes(root)
  const parent = old[0].parent!
  const bones = Object.fromEntries(old[0].skeleton.bones.map((b) => [b.name, b]))
  const material = (old[0].material as THREE.MeshStandardMaterial).clone()
  material.map = null
  material.vertexColors = true
  old.forEach((m) => m.removeFromParent())

  const parts: Record<Region, Piece[]> = {
    head: pieces(scenes[head], 'head', refScene),
    body: style?.graft
      ? graftedPieces(scenes[torso], scenes[outfit], refScene, `${torso}|${outfit}`)
      : style
        ? dressedPieces(scenes[torso], refScene, style, `${torso}|${outfit}`)
        : pieces(scenes[torso], 'body', refScene),
    hands: pieces(scenes[outfit], 'hands', refScene),
    feet: pieces(scenes[shoes], 'feet', refScene),
  }
  const meshes: THREE.SkinnedMesh[] = []
  let photoMesh: THREE.SkinnedMesh<THREE.BufferGeometry, THREE.MeshStandardMaterial> | null = null
  for (const [part, list] of Object.entries(parts)) {
    for (const p of list) {
      const g = new THREE.BufferGeometry()
      for (const k in p.geometry.attributes) g.setAttribute(k, p.geometry.attributes[k])
      g.setAttribute('color', new THREE.BufferAttribute(new Float32Array(p.geometry.attributes.position.count * 3), 3))
      g.userData = p.geometry.userData
      g.morphAttributes = p.geometry.morphAttributes
      g.morphTargetsRelative = p.geometry.morphTargetsRelative
      const m = new THREE.SkinnedMesh(g, material)
      m.name = part
      m.userData.part = part
      m.userData.featureStart = p.featureStart
      m.position.copy(p.src.position)
      m.quaternion.copy(p.src.quaternion)
      m.scale.copy(p.src.scale)
      m.castShadow = true
      m.frustumCulled = false
      parent.add(m)
      const skeleton = new THREE.Skeleton(p.boneNames.map((n) => bones[n]), p.boneInverses)
      m.bind(skeleton, p.src.bindMatrix)
      meshes.push(m)
      if (p.faceIndex) {
        const fg = new THREE.BufferGeometry()
        for (const k of ['position', 'normal', 'skinIndex', 'skinWeight']) fg.setAttribute(k, g.attributes[k])
        fg.setAttribute('uv', new THREE.BufferAttribute(p.faceUV!, 2))
        fg.setIndex(p.faceIndex)
        photoMesh = new THREE.SkinnedMesh(
          fg,
          new THREE.MeshStandardMaterial({
            roughness: 0.75,
            alphaTest: 0.5,
            polygonOffset: true,
            polygonOffsetFactor: -2,
            polygonOffsetUnits: -4,
          }),
        )
        photoMesh.name = 'photo'
        photoMesh.userData.aspect = p.faceAspect
        photoMesh.visible = false
        photoMesh.frustumCulled = false
        photoMesh.position.copy(m.position)
        photoMesh.quaternion.copy(m.quaternion)
        photoMesh.scale.copy(m.scale)
        parent.add(photoMesh)
        photoMesh.bind(skeleton, p.src.bindMatrix)
      }
    }
  }
  return { root, meshes, material, photoMesh: photoMesh!, headMesh: meshes.find((m) => m.userData.part === 'head')! }
}

const outfitColorCache = new WeakMap<THREE.Object3D, Record<string, string>>()
export function outfitColors(scene: THREE.Object3D, refScene: THREE.Object3D) {
  let out = outfitColorCache.get(scene)
  if (!out) {
    const { zone, base } = pieces(scene, 'body', refScene)[0].geometry.userData as Paint
    out = {} as Record<string, string>
    for (const [z, slot] of [[4, 'top'], [5, 'top2']] as const) {
      const c = new THREE.Color(0, 0, 0)
      let n = 0
      for (let i = 0; i < zone.length; i++) {
        if (zone[i] !== z) continue
        c.r += base[i * 3]
        c.g += base[i * 3 + 1]
        c.b += base[i * 3 + 2]
        n++
      }
      if (n) out[slot] = `#${c.multiplyScalar(1 / n).getHexString()}`
    }
    outfitColorCache.set(scene, out)
  }
  return out
}

const _c: (THREE.Color | null)[] = SLOT_OF_ZONE.map(() => null)
export function paintAvatar(meshes: THREE.Mesh[], colors: Record<string, string | null | undefined>) {
  for (let z = 1; z < _c.length; z++) {
    const v = colors[SLOT_OF_ZONE[z]!]
    _c[z] = v ? new THREE.Color(v) : null
  }
  for (const m of meshes) {
    const { zone, base, shade } = m.geometry.userData as Paint
    const attr = m.geometry.attributes.color
    const out = attr.array as Float32Array
    for (let i = 0; i < zone.length; i++) {
      const c = _c[zone[i]]
      const o = i * 3
      if (!c) {
        out[o] = base[o]
        out[o + 1] = base[o + 1]
        out[o + 2] = base[o + 2]
        continue
      }
      const t = shade[i]
      const k = 1.12 - 0.5 * t
      const lift = 0.03 * (1 - t)
      out[o] = Math.min(1, c.r * k + lift)
      out[o + 1] = Math.min(1, c.g * k + lift)
      out[o + 2] = Math.min(1, c.b * k + lift)
    }
    attr.needsUpdate = true
  }
}

export function meshBox(mesh: THREE.Mesh) {
  const pos = mesh.geometry.attributes.position
  const idx = mesh.geometry.index
  const box = new THREE.Box3()
  const v = new THREE.Vector3()
  const n = idx ? idx.count : pos.count
  for (let i = 0; i < n; i++) box.expandByPoint(v.fromBufferAttribute(pos, idx ? idx.getX(i) : i))
  return box.applyMatrix4(mesh.matrixWorld)
}

const refHeights = new WeakMap<THREE.Object3D, number>()
export function refHeight(refScene: THREE.Object3D) {
  let h = refHeights.get(refScene)
  if (!h) {
    refScene.updateWorldMatrix(true, true)
    const box = new THREE.Box3()
    for (const m of skinnedMeshes(refScene)) box.union(meshBox(m))
    h = box.getSize(new THREE.Vector3()).y
    refHeights.set(refScene, h)
  }
  return h
}
