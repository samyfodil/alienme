import { Suspense, memo, useCallback, useLayoutEffect, useMemo, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import { Html } from '@react-three/drei'
import * as THREE from 'three'
import { Prop, propHeight } from './Prop'
import { PROPS } from '../data/props'
import { BLOCK, COLS, ROWS, PLACES, CROSSINGS, SET_BACK, PARK, TRAIL, POND, inPark, inPond, type Place } from '../data/city'
import type { Model, Point } from '../story/types'
import type { CtlRef } from '../story/ctl'
import { FLOOR } from '../data/sets'
import { useLook } from '../story/look'
import { Land } from './Land'
import { Pond } from './Built'

const GROUND = -1.25
const lotOf = Object.fromEntries(Object.entries(PLACES).map(([id, p]) => [p.at.join(','), id]))
const parkLot = (c: number, r: number) => PARK.lots.some(([x, z]) => x === c && z === r)
const SLABS = COLS.flatMap((c) => ROWS.filter((r) => !parkLot(c, r)).map((r) => [c, r]))
const LOTS = Object.entries(Object.fromEntries(Object.values(PLACES).reverse().map((p) => [p.at.join(), p])))

export const buildingHeight = (place: Place) => {
  const d = PROPS[place.building!.model]
  return propHeight(place.building!.model) * ((FLOOR.w + 1) / Math.max(d[0], d[2]))
}

const hash = (x: number, z: number) => {
  const s = Math.sin(x * 12.9898 + z * 78.233) * 43758.5453
  return s - Math.floor(s)
}
const FILLERS: Model[] = ['town/shop-red', 'town/shop-blue', 'town/shop-green', 'town/shop-orange']

const ZEBRA = { gap: 0.75, wide: 1.6 }

function Streets() {
  const [sw, sd] = BLOCK.slab
  const dashes = useRef<THREE.InstancedMesh>(null!)
  const marks = useMemo(() => {
    const out: [number, number, number][] = []
    const x0 = COLS[0] - BLOCK.w / 2
    const x1 = COLS[COLS.length - 1] + BLOCK.w / 2
    for (const r of ROWS) for (let x = x0; x < x1; x += 3) out.push([x, r + BLOCK.roadZ, 0])
    for (const c of COLS) for (let z = ROWS[0] - 9; z < ROWS[ROWS.length - 1] + 9; z += 3) out.push([c + BLOCK.w / 2, z, Math.PI / 2])
    const onZebra = (x: number, z: number) => CROSSINGS.some(([cx, cz]) => Math.hypot(x - cx, z - cz) < ZEBRA.wide / 2 + 1)
    return out.filter(([x, z]) => !inPark(x, z, 0.5) && !onZebra(x, z))
  }, [])
  useLayoutEffect(() => {
    const m = new THREE.Matrix4()
    const q = new THREE.Quaternion()
    marks.forEach(([x, z, r], i) => {
      q.setFromAxisAngle(new THREE.Vector3(0, 1, 0), r)
      dashes.current.setMatrixAt(i, m.compose(new THREE.Vector3(x, GROUND - 0.015, z), q, new THREE.Vector3(1, 1, 1)))
    })
    dashes.current.instanceMatrix.needsUpdate = true
  }, [marks])
  const slabs = useRef<THREE.InstancedMesh>(null!)
  useLayoutEffect(() => {
    const m = new THREE.Matrix4()
    SLABS.forEach(([c, r], i) => slabs.current.setMatrixAt(i, m.makeTranslation(c, GROUND - 0.12, r + BLOCK.slabZ)))
    slabs.current.instanceMatrix.needsUpdate = true
  }, [])
  const W = COLS[COLS.length - 1] - COLS[0] + BLOCK.w * 2
  const D = ROWS[ROWS.length - 1] - ROWS[0] + 40
  return (
    <group>
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, GROUND - 0.03, 0]} receiveShadow>
        <planeGeometry args={[W, D]} />
        <meshStandardMaterial color="#6f6a82" roughness={0.95} />
      </mesh>
      <instancedMesh ref={slabs} args={[undefined, undefined, SLABS.length]} receiveShadow>
        <boxGeometry args={[sw, 0.22, sd]} />
        <meshStandardMaterial color="#e6d9c8" roughness={0.9} />
      </instancedMesh>
      <Zebras />
      <instancedMesh ref={dashes} args={[undefined, undefined, marks.length]}>
        <boxGeometry args={[1.4, 0.02, 0.18]} />
        <meshBasicMaterial color="#fff4dc" />
      </instancedMesh>
    </group>
  )
}

function Zebras() {
  const bars = useMemo(
    () =>
      CROSSINGS.flatMap(([x, z, along]) => {
        const road = along ? BLOCK.w - BLOCK.slab[0] : ROWS[1] - ROWS[0] - BLOCK.slab[1]
        const n = Math.floor((road - 0.6) / ZEBRA.gap) + 1
        return Array.from({ length: n }, (_, i) => {
          const o = (i - (n - 1) / 2) * ZEBRA.gap
          return [x + Math.sin(along) * o, z + Math.cos(along) * o, along + Math.PI / 2, ZEBRA.wide]
        })
      }),
    [],
  )
  const ref = useRef<THREE.InstancedMesh>(null!)
  useLayoutEffect(() => {
    const m = new THREE.Matrix4()
    const q = new THREE.Quaternion()
    const up = new THREE.Vector3(0, 1, 0)
    bars.forEach(([x, z, along, len], i) => {
      q.setFromAxisAngle(up, along)
      ref.current.setMatrixAt(i, m.compose(new THREE.Vector3(x, GROUND - 0.012, z), q, new THREE.Vector3(1, 1, len)))
    })
    ref.current.instanceMatrix.needsUpdate = true
  }, [bars])
  return (
    <instancedMesh ref={ref} args={[undefined, undefined, bars.length]} receiveShadow>
      <boxGeometry args={[0.38, 0.02, 1]} />
      <meshStandardMaterial color="#fbf6ef" roughness={0.8} />
    </instancedMesh>
  )
}

function Sway({ at, seed, children }: { at: Point; seed: number; children: React.ReactNode }) {
  const g = useRef<THREE.Group>(null)
  useFrame(({ clock }) => {
    const t = clock.elapsedTime * 1.1 + seed
    const k = useLook.getState().sway ? 1 : 0
    g.current?.rotation.set(Math.sin(t * 0.8) * 0.02 * k, 0, Math.sin(t) * 0.035 * k)
  })
  return (
    <group ref={g} position={[at[0], 0, at[1]]}>
      {children}
    </group>
  )
}

const TREES: Model[] = ['city/tree', 'nature/tree-1', 'nature/pine', 'nature/tree-3', 'city/tree-long']
const LOW: Model[] = ['nature/bush', 'nature/bush-flowers', 'nature/flowers-a', 'nature/flowers-b', 'city/bush-small']
const RIM = 1.4
const ROOM_LOT = PLACES.park.at
function trailGap(x: number, z: number) {
  let best = Infinity
  for (let i = 0; i + 1 < TRAIL.length; i++) {
    const [ax, az] = TRAIL[i]
    const [bx, bz] = TRAIL[i + 1]
    const dx = bx - ax
    const dz = bz - az
    const t = Math.max(0, Math.min(1, ((x - ax) * dx + (z - az) * dz) / (dx * dx + dz * dz)))
    best = Math.min(best, Math.hypot(x - ax - t * dx, z - az - t * dz))
  }
  return best
}
const PARK_THINGS = (() => {
  const out: { model: Model; at: Point; scale?: number; rotY?: number; tree?: boolean }[] = []
  for (let x = PARK.x0 + 3; x < PARK.x1 - 2; x += 3.4)
    for (let z = PARK.z0 + 3; z < PARK.z1 - 2; z += 3.4) {
      const h = hash(x, z)
      const px = x + (hash(z, x) - 0.5) * 2
      const pz = z + (h - 0.5) * 2
      const nearRoom = Math.abs(px - ROOM_LOT[0]) < 7.5 && pz > ROOM_LOT[1] - 6.5
      const gap = trailGap(px, pz)
      if (nearRoom || gap < 1.9 || inPond(px, pz, 1.2)) continue
      if (h < 0.26 && gap > 3) out.push({ model: TREES[Math.floor(h * 97) % TREES.length], at: [px, pz], scale: 1 + h * 1.5, tree: true })
      else if (h > 0.55 && h < 0.75) out.push({ model: LOW[Math.floor(h * 131) % LOW.length], at: [px, pz], scale: 1.2 })
    }
  for (const k of [18, 30, 76]) {
    const [ax, az] = TRAIL[k]
    const [bx, bz] = TRAIL[k + 1]
    const len = Math.hypot(bx - ax, bz - az)
    const nx = (bz - az) / len
    const nz = -(bx - ax) / len
    out.push({ model: 'city/bench', at: [ax + nx * 1.7, az + nz * 1.7], rotY: Math.atan2(-nx, -nz) })
  }
  return out
})()
function Park() {
  const trail = useMemo(() => {
    const pos: number[] = []
    const idx: number[] = []
    const W = 0.85
    TRAIL.forEach(([x, z], i) => {
      const [px, pz] = TRAIL[Math.max(0, i - 1)]
      const [nx, nz] = TRAIL[Math.min(TRAIL.length - 1, i + 1)]
      const dx = nx - px
      const dz = nz - pz
      const l = Math.hypot(dx, dz) || 1
      pos.push(x - (dz / l) * W, 0, z + (dx / l) * W, x + (dz / l) * W, 0, z - (dx / l) * W)
      if (i) idx.push(2 * i - 2, 2 * i, 2 * i - 1, 2 * i - 1, 2 * i, 2 * i + 1)
    })
    const g = new THREE.BufferGeometry()
    g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3))
    g.setIndex(idx)
    g.computeVertexNormals()
    return g
  }, [])
  const w = PARK.x1 - PARK.x0
  const d = PARK.z1 - PARK.z0
  const cx = (PARK.x0 + PARK.x1) / 2
  const cz = (PARK.z0 + PARK.z1) / 2
  return (
    <group>
      <mesh position={[cx, GROUND - 0.12, cz]} receiveShadow>
        <boxGeometry args={[w, 0.22, d]} />
        <meshStandardMaterial color="#e6d9c8" roughness={0.9} />
      </mesh>
      <mesh position={[cx, GROUND + 0.005, cz]} receiveShadow>
        <boxGeometry args={[w - RIM * 2, 0.03, d - RIM * 2]} />
        <meshStandardMaterial color="#8cc07a" roughness={0.95} />
      </mesh>
      <mesh geometry={trail} position={[0, GROUND + 0.03, 0]} receiveShadow>
        <meshStandardMaterial color="#efdcb8" roughness={0.95} side={THREE.DoubleSide} />
      </mesh>
      <group position={[POND.at[0], GROUND, POND.at[1]]}>
        <Pond size={POND.size} />
      </group>
      <Suspense fallback={null}>
        {PARK_THINGS.map((p, i) =>
          p.tree ? (
            <group key={i} position={[0, GROUND, 0]}>
              <Sway at={p.at} seed={i}>
                <Prop model={p.model} scale={p.scale} pastel />
              </Sway>
            </group>
          ) : (
            <group key={i} position={[p.at[0], GROUND, p.at[1]]}>
              <Prop model={p.model} rotY={p.rotY || 0} scale={p.scale || 1} pastel />
            </group>
          ),
        )}
      </Suspense>
    </group>
  )
}

function Filler({ x, z }: { x: number; z: number }) {
  const pastel = useLook((s) => s.townPastel)
  const h = hash(x, z)
  if (h < 0.18)
    return (
      <group position={[x, GROUND, z + BLOCK.slabZ]}>
        {[-4, 0, 4].map((dx, i) => (
          <Sway key={i} at={[dx, (i - 1) * 2]} seed={x + z + i}>
            <Prop model="city/tree" scale={1.6} pastel={pastel} />
          </Sway>
        ))}
      </group>
    )
  return (
    <group position={[x, GROUND, z + BLOCK.slabZ + 1]}>
      <Prop model={FILLERS[Math.floor(h * 97) % FILLERS.length]} scale={4.2} pastel={pastel} />
    </group>
  )
}

function Shell({ place, open }: { place: Place; open: boolean }) {
  const pastel = useLook((s) => s.townPastel)
  const { model, rotY = 0 } = place.building!
  const d = PROPS[model]
  const fit = (FLOOR.w + 1) / Math.max(d[0], d[2])
  const mats = useRef<THREE.Material[]>([])
  const own = useCallback((g: THREE.Group | null) => {
    if (!g || mats.current.length) return
    g.traverse((m) => {
      if (!(m instanceof THREE.Mesh)) return
      const src = m.material
      m.material = src.clone()
      m.material.onBeforeCompile = src.onBeforeCompile
      m.material.customProgramCacheKey = src.customProgramCacheKey
      mats.current.push(m.material)
    })
  }, [])
  const group = useRef<THREE.Group>(null)
  const o = useRef(open ? 0 : 1)
  useFrame((_, dt) => {
    o.current += ((open ? 0 : 1) - o.current) * (1 - Math.pow(0.004, dt))
    const v = o.current
    for (const m of mats.current) {
      m.transparent = v < 0.99
      m.opacity = v
      m.depthWrite = v > 0.5
    }
    if (group.current) group.current.visible = v > 0.02
  })
  return (
    <group ref={group} position={[place.at[0], GROUND, place.at[1] + FLOOR.z - SET_BACK]}>
      <Suspense fallback={null}>
        <Prop key={String(pastel)} ref={own} model={model} rotY={rotY} scale={fit} pastel={pastel} />
      </Suspense>
    </group>
  )
}

function Badge({ place, show }: { place: Place; show: boolean }) {
  const H = place.building ? buildingHeight(place) + 2 : 4
  return (
    <Html position={[place.at[0], GROUND + H, place.at[1]]} center zIndexRange={[12, 5]} style={{ pointerEvents: 'none' }}>
      <div className={'place-badge' + (show ? '' : ' hidden')}>
        <span>{place.icon}</span>
        {place.name}
      </div>
    </Html>
  )
}

export const City = memo(function City({ open, badges }: { open: string[]; badges: boolean }) {
  const lots = useMemo(() => {
    const out: [number, number][] = []
    for (const c of COLS) for (const r of ROWS) if (!lotOf[`${c},${r}`] && !parkLot(c, r)) out.push([c, r])
    return out
  }, [])
  return (
    <group>
      <Land />
      <Streets />
      <Park />
      <Suspense fallback={null}>
        {lots.map(([x, z]) => (
          <Filler key={`${x},${z}`} x={x} z={z} />
        ))}
      </Suspense>
      {LOTS.map(([key, p]) => p.building && <Shell key={key} place={p} open={open.some((id) => PLACES[id].at.join() === key)} />)}
      {LOTS.map(([key, p]) => (
        <Badge key={key} place={p} show={badges} />
      ))}
    </group>
  )
})

export function Ufo({ ctl }: { ctl: CtlRef }) {
  const g = useRef<THREE.Group>(null)
  const body = useRef<THREE.Group>(null!)
  const beam = useRef<THREE.Mesh<THREE.BufferGeometry, THREE.MeshBasicMaterial>>(null!)
  useFrame(({ clock }) => {
    const u = ctl.current.ufo
    if (!g.current) return
    g.current.visible = !!u?.on
    if (!u?.on) return
    const t = clock.elapsedTime
    g.current.position.copy(u.pos)
    g.current.position.y += Math.sin(t * 2.2) * 0.15
    body.current.visible = u.hull !== false
    body.current.rotation.set(Math.sin(t * 1.3) * 0.06, t * 1.5, Math.cos(t * 1.1) * 0.06)
    body.current.scale.setScalar(u.scale ?? 1.6)
    const len = u.beamLen || 6
    beam.current.visible = (u.beam || 0) > 0.01
    beam.current.material.opacity = 0.4 * (u.beam || 0)
    beam.current.scale.set(1, len, 1)
    beam.current.position.y = -len / 2 + 0.2
  })
  return (
    <group ref={g} visible={false}>
      <group ref={body}>
        <Suspense fallback={null}>
          <Prop model="space/ufo-saucer-blue" y={-0.3} />
        </Suspense>
      </group>
      <mesh ref={beam}>
        <cylinderGeometry args={[0.5, 1.4, 1, 24, 1, true]} />
        <meshBasicMaterial color="#9ffcff" transparent opacity={0} side={THREE.DoubleSide} depthWrite={false} toneMapped={false} />
      </mesh>
    </group>
  )
}

export function Bus({ ctl, car }: { ctl: CtlRef; car?: boolean }) {
  const g = useRef<THREE.Group>(null)
  useFrame(() => {
    const b = ctl.current.bus
    if (!g.current) return
    g.current.visible = !!b?.on
    if (!b?.on) return
    g.current.position.copy(b.pos)
    g.current.rotation.y = b.yaw
  })
  return (
    <group ref={g} visible={false}>
      <Suspense fallback={null}>
        {car ? (
          <group rotation={[0, Math.PI / 2, 0]}>
            <Prop model="city/car-red" scale={3} />
          </group>
        ) : (
          <Prop model="town/bus" scale={0.35} />
        )}
      </Suspense>
    </group>
  )
}

