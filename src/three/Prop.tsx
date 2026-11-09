import { forwardRef, useMemo } from 'react'
import type { GroupProps } from '@react-three/fiber'
import { BufferGeometry, Group, Material, Mesh, Object3D } from 'three'
import { useGLTF } from '@react-three/drei'
import { clone } from 'three/examples/jsm/utils/SkeletonUtils.js'
import { PROPS } from '../data/props'
import { sceneUrl } from '../data/models'
import { bevelMaterial } from './bevel'
import { soft, useSoft } from './soft'
import { useWarm } from './warm'
import type { Model, Point } from '../story/types'

type ByModel = Partial<Record<Model, number>>

const PACK_SCALE: Record<string, number> = { jt: 0.5, kenney: 3.1, scifi: 1, nature: 0.6, misc: 1, town: 1 }
const SCALE_OVERRIDE = {
  'diner/bacon': 1, 'diner/burger-cheese': 1, 'diner/burger': 1, 'diner/cake': 1, 'diner/coffee-cup': 1,
  'diner/cupcake': 1, 'diner/donut': 1, 'diner/egg-fried': 1, 'diner/fries': 1, 'diner/hot-dog': 1,
  'diner/ice-cream': 1, 'diner/ketchup': 1, 'diner/milkshake': 1, 'diner/muffin': 1, 'diner/mustard': 1,
  'diner/pancakes': 1, 'diner/pie': 0.8, 'diner/pizza': 0.8, 'diner/salt-shaker': 1, 'diner/sandwich': 1,
  'diner/soda-cup': 1, 'diner/soda-glass': 1, 'diner/sundae': 1, 'diner/waffle': 1,
  'city/house-suburban-a': 3, 'city/house-suburban-b': 3, 'city/house-suburban-c': 3,
  'planet/crystal-cluster-blue': 0.25, 'planet/crystal-tall': 0.3, 'planet/crystal-big': 1.2,
  'planet/crystal-purple': 1, 'planet/mountains': 1.5, 'planet/gem-pink': 1.2,
  'space/asteroids': 0.15, 'space/ufo-saucer': 0.04, 'space/rocket': 2, 'space/ufo-saucer-blue': 1.4,
  'space/ufo-beam-base': 1.2, 'reveal/pedestal': 0.8, 'reveal/trophy': 3, 'lab/telescope': 2.4,
  'reveal/landing-pad': 1.4, 'reveal/spotlight-motorised': 2.5,
  'city/mailbox': 2.5, 'city/atm': 3, 'city/power-box': 2, 'office/vending-machine': 0.75,
  'diner/arcade-machine': 0.8, 'diner/food-worker': 0.9, 'city/car-orange': 1.6, 'city/car-red': 1.6,
  'city/building-red': 1.2, 'city/building-green': 1.2, 'city/building-brown': 1.1, 'city/fire-hydrant': 1.4,
  'city/traffic-cone': 1, 'city/trash-can': 1.2, 'office/drawer': 1, 'office/bean-bag': 1, 'ship/door': 0.75, 'ship/column-pipes': 0.64,
  'office/cat': 1.6, 'city/picnic-table': 1.3, 'office/file-cabinet': 1, 'office/whiteboard': 1, 'nature/mushroom': 2,
  'lab/crate-large': 0.6, 'lab/specimen-tube': 4, 'lab/eye-drone': 0.9, 'home/plant-small': 5,
} satisfies ByModel as ByModel

export function propScale(model?: Model) {
  if (!model) return 1
  const p = PROPS[model]
  return SCALE_OVERRIDE[model] ?? (p ? PACK_SCALE[p[4]] : 1)
}

export function propRadius(model: Model) {
  const p = PROPS[model]
  return p ? (Math.max(p[0], p[2]) * propScale(model)) / 2 : 0.5
}

const HALF = Math.PI
const TURN = {
  'home/sofa-blue': HALF, 'home/sofa-red': HALF, 'home/armchair': HALF, 'home/television': HALF,
  'home/tv-cabinet': HALF, 'office/desk': HALF, 'office/desk-chair': HALF, 'home/bed-double': HALF,
  'diner/chair': HALF, 'diner/chair-cushion': HALF, 'diner/arcade-machine': -Math.PI / 2, 'home/radio': HALF,
  'home/kitchen-counter': HALF, 'home/kitchen-stove': HALF, 'home/kitchen-sink': HALF, 'home/kitchen-cabinet-upper': HALF,
  'home/fridge': HALF,
} satisfies ByModel as ByModel
export const propTurn = (model?: Model) => (model && TURN[model]) || 0

const SEAT = {
  'home/bed-double': 0.62, 'home/sofa-blue': 0.5, 'home/sofa-red': 0.5, 'home/armchair': 0.5,
  'city/bench': 0.5, 'city/picnic-table': 0.45, 'office/desk-chair': 0.42, 'office/bean-bag': 0.92,
  'diner/chair': 0.6, 'diner/chair-cushion': 0.6, 'diner/bar-stool': 0.95, 'diner/bar-stool-square': 0.95,
  'lab/chair': 0.36, 'nature/rock-1': 0.9, 'nature/rock-2': 0.9, 'nature/rock-3': 0.9,
} satisfies ByModel as ByModel
export const seatHeight = (model?: Model) => (model && SEAT[model] ? SEAT[model] * propHeight(model) : null)
const PERCH: ByModel = { 'office/bean-bag': 0.25 }
export const seatForward = (model?: Model) => (model && PERCH[model]) || 0

export function propHeight(model?: Model) {
  const p = model && PROPS[model]
  return p ? p[1] * propScale(model) : 1
}

const BEVEL_PACKS = new Set(['kenney', 'jt'])
const BUILDING = /building-|house-|donut-store/
const beveledModel = (model: Model) => BEVEL_PACKS.has(PROPS[model]?.[4]) && !BUILDING.test(model)
const BEVEL_WIDTH = 0.1
const beveled = new Map<string, Material>()
export function bevelOf(material: Material, width = BEVEL_WIDTH) {
  const key = `${material.uuid}:${width.toFixed(4)}`
  if (!beveled.has(key)) beveled.set(key, bevelMaterial(material, width))
  return beveled.get(key)!
}

const pasteled = new Map<string, Material>()
export function pastelOf(material: Material, amount = 0.16) {
  const key = `${material.uuid}:${amount}`
  if (!pasteled.has(key)) {
    const m = material.clone()
    const before = material.onBeforeCompile
    const beforeKey = material.customProgramCacheKey?.() || ''
    m.onBeforeCompile = (shader, renderer) => {
      before?.call(m, shader, renderer)
      shader.fragmentShader = shader.fragmentShader.replace(
        '#include <map_fragment>',
        `#include <map_fragment>
        diffuseColor.rgb = mix(diffuseColor.rgb, vec3(dot(diffuseColor.rgb, vec3(0.3, 0.59, 0.11))), 0.15);
        diffuseColor.rgb = mix(diffuseColor.rgb, vec3(1.0, 0.92, 0.86), ${amount.toFixed(3)});`,
      )
    }
    m.customProgramCacheKey = () => `${beforeKey}pastel${amount}`
    pasteled.set(key, m)
  }
  return pasteled.get(key)!
}

const HOVER = new Set(['space/ufo-saucer-blue'])

type Piece = { tris: number[]; min: number; reach: number }
function pieces(geometry: BufferGeometry) {
  const pos = geometry.attributes.position
  const index = geometry.index ? Array.from(geometry.index.array) : Array.from({ length: pos.count }, (_, i) => i)
  const at = new Map<string, number>()
  const corner = Array.from({ length: pos.count }, (_, i) => {
    const k = `${pos.getX(i).toFixed(4)},${pos.getY(i).toFixed(4)},${pos.getZ(i).toFixed(4)}`
    if (!at.has(k)) at.set(k, at.size)
    return at.get(k)!
  })
  const up = Array.from({ length: at.size }, (_, i) => i)
  const root = (x: number): number => (up[x] === x ? x : (up[x] = root(up[x])))
  for (let t = 0; t < index.length; t += 3) {
    const a = root(corner[index[t]])
    up[root(corner[index[t + 1]])] = a
    up[root(corner[index[t + 2]])] = a
  }
  const out = new Map<number, Piece>()
  for (let t = 0; t < index.length; t += 3) {
    const r = root(corner[index[t]])
    if (!out.has(r)) out.set(r, { tris: [], min: Infinity, reach: 0 })
    const p = out.get(r)!
    p.tris.push(index[t], index[t + 1], index[t + 2])
    for (let k = 0; k < 3; k++) {
      const v = index[t + k]
      p.min = Math.min(p.min, pos.getY(v))
      p.reach = Math.max(p.reach, Math.hypot(pos.getX(v), pos.getZ(v)))
    }
  }
  return [...out.values()]
}

function withoutLegs(object: Object3D) {
  const meshes: Mesh[] = []
  object.traverse((m) => {
    if (m instanceof Mesh) meshes.push(m)
  })
  const all = meshes.map((m) => pieces(m.geometry))
  const reach = Math.max(...all.flat().map((p) => p.reach))
  const bottom = Math.min(...all.flat().filter((p) => p.reach > reach / 2).map((p) => p.min))
  meshes.forEach((m, i) => {
    const g = m.geometry.clone()
    g.setIndex(all[i].filter((p) => p.min >= bottom - 1e-3).flatMap((p) => p.tris))
    m.geometry = g
  })
}

type Props = { model: Model; at?: Point; rotY?: number; y?: number; scale?: number; pastel?: boolean } & Omit<GroupProps, 'ref' | 'position' | 'rotation' | 'scale'>

export const Prop = forwardRef<Group, Props>(function Prop({ model, at = [0, 0], rotY = 0, y = 0, scale = 1, pastel = false, ...rest }, ref) {
  const { scene } = useGLTF(sceneUrl(model))
  const bevel = beveledModel(model)
  useSoft(scene, bevel)
  const object = useMemo(() => {
    const o = clone(scene)
    o.traverse((m) => {
      if (m instanceof Mesh) {
        m.geometry = soft(m.geometry, bevel)
        if (bevel) m.material = Array.isArray(m.material) ? m.material.map((x) => bevelOf(x)) : bevelOf(m.material)
        if (pastel) m.material = Array.isArray(m.material) ? m.material.map((x) => pastelOf(x)) : pastelOf(m.material)
        m.castShadow = true
        m.receiveShadow = true
      }
    })
    if (HOVER.has(model)) withoutLegs(o)
    return o
  }, [scene, bevel, pastel, model])
  useWarm(object)
  const [, , , minY = 0, , cx = 0, cz = 0] = PROPS[model] ?? []
  return (
    <group ref={ref} position={[at[0], y, at[1]]} rotation={[0, rotY, 0]} scale={propScale(model) * scale} {...rest}>
      <group rotation={[0, propTurn(model), 0]}>
        <primitive object={object} position={[-cx, -minY, -cz]} />
      </group>
    </group>
  )
})
