import { BufferAttribute, BufferGeometry, Mesh, Object3D, type TypedArray } from 'three'
import { suspend } from 'suspend-react'
import { toCreasedNormals } from 'three/examples/jsm/utils/BufferGeometryUtils.js'
import { addBevelEdges } from './bevel'

const CREASE = Math.PI * 0.42
type Attr = 'normal' | 'bevelD' | 'bevelS' | 'bevelL' | 'bevelN0' | 'bevelN1' | 'bevelN2' | 'bevelN3'
export type Arrays = Partial<Record<Attr, TypedArray>>
const SIZES: Record<Attr, number> = { normal: 3, bevelD: 4, bevelS: 4, bevelL: 4, bevelN0: 3, bevelN1: 3, bevelN2: 3, bevelN3: 3 }

export function softArrays(position: Float32Array, bevel?: boolean): Arrays {
  const g = new BufferGeometry()
  g.setAttribute('position', new BufferAttribute(position, 3))
  toCreasedNormals(g, CREASE)
  if (bevel) addBevelEdges(g, CREASE)
  const n = g.attributes.normal.array as Float32Array
  for (let i = 0; i < n.length; i += 3) if (!(Math.abs(n[i]) + Math.abs(n[i + 1]) + Math.abs(n[i + 2]) > 0)) n.set([0, 1, 0], i)
  return Object.fromEntries(Object.keys(SIZES).flatMap((k) => (g.attributes[k] ? [[k, g.attributes[k].array]] : [])))
}

type Job = { g: BufferGeometry; bevel?: boolean; resolve: (arrays: Arrays) => void }
const done = new WeakMap<BufferGeometry, BufferGeometry>()
const asked = new WeakMap<BufferGeometry, Promise<BufferGeometry>>()
const pending = new Map<number, Job>()
let worker: Worker | undefined
let ids = 0

const target = (geometry: BufferGeometry) => (geometry.index ? geometry.toNonIndexed() : geometry)
function positions(g: BufferGeometry) {
  const p = g.attributes.position
  const a = new Float32Array(p.count * 3)
  for (let i = 0; i < p.count; i++) a.set([p.getX(i), p.getY(i), p.getZ(i)], i * 3)
  return a
}
function finish(geometry: BufferGeometry, g: BufferGeometry, arrays: Arrays) {
  for (const [k, a] of Object.entries(arrays) as [Attr, TypedArray][]) g.setAttribute(k, new BufferAttribute(a, SIZES[k]))
  g.userData.soft = true
  done.set(geometry, g)
  return g
}

export function softAsync(geometry: BufferGeometry, bevel?: boolean): Promise<BufferGeometry> {
  if (geometry.userData.soft) return Promise.resolve(geometry)
  if (done.has(geometry)) return Promise.resolve(done.get(geometry)!)
  if (!asked.has(geometry)) {
    worker ??= new Worker(new URL('./soft.worker.ts', import.meta.url), { type: 'module' })
    worker.onmessage = ({ data }) => {
      pending.get(data.id)!.resolve(data.arrays)
      pending.delete(data.id)
    }
    worker.onerror = () => {
      for (const job of pending.values()) job.resolve(softArrays(positions(job.g), job.bevel))
      pending.clear()
    }
    const g = target(geometry)
    const position = positions(g)
    const id = ids++
    asked.set(geometry, new Promise((resolve) => pending.set(id, { g, bevel, resolve: (arrays) => resolve(finish(geometry, g, arrays)) })))
    worker.postMessage({ id, position, bevel }, [position.buffer])
  }
  return asked.get(geometry)!
}

export function soft(geometry: BufferGeometry, bevel?: boolean): BufferGeometry {
  if (geometry.userData.soft) return geometry
  if (!done.has(geometry)) {
    const g = target(geometry)
    finish(geometry, g, softArrays(positions(g), bevel))
  }
  return done.get(geometry)!
}

export function useSoft(object: Object3D, bevel?: boolean) {
  const todo: BufferGeometry[] = []
  object.traverse((m) => {
    if (m instanceof Mesh && !m.geometry.userData.soft && !done.has(m.geometry)) todo.push(m.geometry)
  })
  if (todo.length) suspend(() => Promise.all(todo.map((g) => softAsync(g, bevel))), [object, bevel, 'soft'])
}
