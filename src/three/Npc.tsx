import { Suspense, useEffect, useMemo, useRef, useState } from 'react'
import { useFrame, type GroupProps } from '@react-three/fiber'
import { Html, useAnimations, useGLTF } from '@react-three/drei'
import { clone } from 'three/examples/jsm/utils/SkeletonUtils.js'
import * as THREE from 'three'
import { cutesUrl, sceneUrl, type Avatar } from '../data/models'
import { meshBox } from './compose'
import { Character, type Pose } from './Character'
import { ITEMS, armsOf, bodyFrame, bodyOf, grooveRig, handRig, stepHands, type Frame, type Hands, type ItemSpec } from './acts'
import { Prop, bevelOf } from './Prop'
import { soft, useSoft } from './soft'
import { useWarm } from './warm'
import { useLoan } from './lamps'
import { useLook } from '../story/look'
import type { Item as ItemName, Point } from '../story/types'

function useFitted(model: string, height: number, url = cutesUrl(model)) {
  const gltf = useGLTF(url)
  const fitted = useMemo(() => {
    const o = clone(gltf.scene)
    const meshes: THREE.Mesh[] = []
    o.traverse((m) => {
      if (m instanceof THREE.Mesh) meshes.push(m)
    })
    for (const m of meshes) {
      m.castShadow = true
      m.receiveShadow = true
    }
    o.updateWorldMatrix(true, true)
    const box = new THREE.Box3()
    for (const m of meshes) box.union(meshBox(m))
    const s = height / (box.max.y - box.min.y)
    o.scale.multiplyScalar(s)
    const c = box.getCenter(new THREE.Vector3())
    o.position.set(-c.x * s, -box.min.y * s, -c.z * s)
    const bones: Record<string, THREE.Bone> = {}
    o.traverse((b) => {
      if (b instanceof THREE.Bone) bones[b.name.replace('.', '')] = b
    })
    for (const f of [bones.FootL, bones.FootR]) if (f) f.userData.rest = f.position.clone()
    return { object: o, animations: gltf.animations, bones }
  }, [gltf, height])
  useWarm(fitted.object)
  return fitted
}

export const SPEED = 2.2
const PAUSE = 2.5
const PLAYER_HEIGHT = 2.2

export type Leg = { to: Point; wait?: number; carry?: ItemName | null; reach?: () => void }
export type Doing = { type?: string; t0?: number; face?: number; legs?: Leg[]; done?: () => void }
export type Live = { current: Doing | null; gone?: boolean; who?: { group: THREE.Group; layer: Pose } }
type Walk = {
  pos: Point
  job: Doing | null
  leg: number
  path: Point[] | null
  wait: number
  carry: ItemName | null
  stop: number
  beat: number
  finished?: boolean
  grooved?: boolean
}
type NpcProps = {
  look: Avatar
  at: Point
  rotY?: number
  height?: number
  clip?: string
  mood?: string
  live?: Live
  patrol?: Point[]
  arrive?: Point[]
  route?: (from: Point, to: Point) => Point[] | null
  born?: { current: number | null }
  name?: string
  seat?: number | null
}

export function Npc({ look, at, rotY = 0, height = 2.0, clip = 'Idle', mood, live, patrol, arrive, route, born, name, seat }: NpcProps) {
  const group = useRef<THREE.Group>(null)
  const body = useRef<THREE.Group>(null)
  const held = useRef<THREE.Group>(null)
  const tag = useRef<HTMLDivElement>(null)
  const layer = useRef<Pose>({ k: seat != null ? 1 : 0, seat: seat ?? 0 })
  const hands = useRef<{ P: Frame; H: Hands } | null>(null)
  const [clipNow, setClipNow] = useState(clip)
  const s = useRef<Walk>({ pos: [...(arrive?.[0] ?? at)], job: null, leg: 0, path: null, wait: 0, carry: null, stop: 0, beat: 0 })
  useEffect(() => {
    if (live) live.who = { group: group.current!, layer: layer.current }
  }, [live])
  useFrame(({ clock }, dt) => {
    const g = group.current
    const b = body.current
    if (!g || !b) return
    const st = s.current
    const r = live?.current
    const now = clock.elapsedTime
    const plan = (to: Point) => (route?.(st.pos, to) ?? [to]).map((p): Point => [...p])
    let face = r?.face ?? rotY
    let walking = false
    if (r?.legs) {
      if (r !== st.job) Object.assign(st, { job: r, leg: 0, path: null, wait: 0, carry: null, finished: false })
      const leg = r.legs[st.leg]
      if (leg) {
        if (!st.path) {
          st.path = plan(leg.to)
          if (leg.carry !== undefined) st.carry = leg.carry
        }
        if (st.path.length) walking = true
        else {
          if (st.wait === 0) leg.reach?.()
          if ((st.wait += dt) >= (leg.wait || 0)) Object.assign(st, { leg: st.leg + 1, path: null, wait: 0 })
        }
      } else if (!st.finished) {
        st.finished = true
        st.carry = null
        r.done?.()
      }
    } else if (!r && patrol?.length) {
      if (!st.path && now >= st.stop) st.path = plan(patrol[(st.beat = (st.beat + 1) % patrol.length)])
      if (st.path?.length) walking = true
      else if (st.path) Object.assign(st, { path: null, stop: now + PAUSE + Math.random() * 1.5 })
    }
    if (walking) {
      const [tx, tz] = st.path![0]
      const dx = tx - st.pos[0]
      const dz = tz - st.pos[1]
      const d = Math.hypot(dx, dz)
      const step = SPEED * dt
      if (d <= step) {
        st.pos = [tx, tz]
        st.path!.shift()
      } else {
        st.pos = [st.pos[0] + (dx / d) * step, st.pos[1] + (dz / d) * step]
      }
      if (d > 1e-3) face = Math.atan2(dx, dz)
    } else if (!r && patrol?.length) face = g.rotation.y
    g.position.set(st.pos[0], 0, st.pos[1])
    g.visible = !live?.gone
    if (tag.current) tag.current.style.visibility = live?.gone ? 'hidden' : ''
    const want = walking ? 'Walk' : clip
    if (want !== clipNow) setClipNow(want)
    if (held.current) held.current.visible = !!st.carry
    const move = walking ? null : r?.type || mood
    const mt = r ? now - (r.t0 ?? 0) : now + at[0]
    const m = bodyOf(move)?.(mt) ?? {}
    const arms = armsOf(move)
    const L = layer.current
    if ((arms || hands.current) && L.rig) {
      hands.current ??= { P: bodyFrame(L.rig), H: handRig() }
      const { P, H } = hands.current
      const h = stepHands(H, P, arms?.(mt, P), { dt, now, lift: m.lift || 0 })
      L.off = h.off
      L.rot = h.rot
    }
    const bones = L.rig?.bones
    if (bones && (move === 'dance' || st.grooved)) grooveRig(bones, move === 'dance' ? mt : null, true)
    st.grooved = move === 'dance'
    b.position.y = m.lift || 0
    b.position.x = m.side || 0
    b.rotation.set(m.pitch || 0, m.yaw || 0, m.roll || 0)
    if (born?.current != null && useLook.getState().pops) {
      const t = now - born.current - 0.35
      b.scale.setScalar(t <= 0 ? 0.001 : t > 1.4 ? 1 : Math.max(0.001, 1 - Math.exp(-6 * t) * Math.cos(10 * t)))
    }
    const turn = face - g.rotation.y
    g.rotation.y += Math.atan2(Math.sin(turn), Math.cos(turn)) * (1 - Math.pow(walking ? 1e-5 : 0.002, dt))
  })
  return (
    <group ref={group} position={[at[0], 0, at[1]]} rotation={[0, rotY, 0]}>
      <group ref={body}>
        <Character avatar={look} clip={clipNow} groundY={0} targetHeight={PLAYER_HEIGHT * (height / 2)} pose={layer} />
        <group ref={held} position={[0, height * 0.42, 0.42]} visible={false}>
          <Carried st={s} />
        </group>
        {name && (
          <Html position={[0, height + 0.3, 0]} center zIndexRange={[9, 5]} style={{ pointerEvents: 'none' }}>
            <div ref={tag} className="name-tag">
              {name}
            </div>
          </Html>
        )}
      </group>
    </group>
  )
}

function Carried({ st }: { st: { current: Walk } }) {
  const [name, setName] = useState<ItemName | null>(null)
  useFrame(() => {
    if (st.current.carry !== name) setName(st.current.carry)
  })
  return name ? (
    <Suspense fallback={null}>
      <Item name={name} />
    </Suspense>
  ) : null
}

export function Fitted({ model, height, ...rest }: { model: string; height: number } & GroupProps) {
  const { object } = useFitted(model, height)
  return (
    <group {...rest}>
      <primitive object={object} />
    </group>
  )
}

function FaceLight({ at, color }: { at: [number, number, number]; color: string }) {
  const g = useRef<THREE.Group>(null)
  const loan = useLoan()
  useFrame(() => {
    if (!g.current) return
    g.current.getWorldPosition(loan.pos)
    loan.color.set(color)
    loan.power = 0.8
    loan.reach = 1.4
  })
  return <group ref={g} position={at} />
}

function roundEdges(object: THREE.Object3D) {
  object.updateWorldMatrix(true, true)
  object.traverse((m) => {
    if (!(m instanceof THREE.SkinnedMesh) || m.userData.rounded) return
    m.userData.rounded = true
    m.geometry = soft(m.geometry, true)
    m.geometry.computeBoundingBox()
    const bind = m.geometry.boundingBox!.getSize(new THREE.Vector3()).length()
    const real = new THREE.Box3().setFromObject(m, true).getSize(new THREE.Vector3()).length()
    const shown = m.matrixWorld.getMaxScaleOnAxis()
    m.material = bevelOf(m.material, (0.1 * shown * bind) / real)
  })
}

export function Animal({ name, height, idle = 'Idle' }: { name: string; height: number; idle?: string }) {
  const { object, animations } = useFitted(name, height, sceneUrl(`animals/${name}`))
  useSoft(object, true)
  useMemo(() => roundEdges(object), [object])
  const { actions, names } = useAnimations(animations, object)
  const group = useRef<THREE.Group>(null)
  const playing = useRef<{ clip: string; action: THREE.AnimationAction } | null>(null)
  useFrame(({ clock }) => {
    const play = group.current?.parent?.userData.play
    const want = play && clock.elapsedTime < play.until ? play.clip : idle
    if (want === playing.current?.clip) return
    const n = names.find((n) => n.endsWith(`|${want}`) || n === want)
    const a = n ? actions[n] : null
    if (!a) return
    playing.current?.action.fadeOut(0.25)
    a.reset().fadeIn(0.25).play()
    playing.current = { clip: want, action: a }
  })
  return (
    <group ref={group}>
      <primitive object={object} />
    </group>
  )
}

export function Item({ name }: { name: ItemName }) {
  const it: ItemSpec | undefined = ITEMS[name]
  if (!it) return null
  if (it.model) return <Prop model={it.model} scale={it.scale} />
  if (it.build === 'octopus') return <Octopus color={it.color} />
  if (it.build === 'shell') return <Shell />
  const [w, h, d] = it.box!
  return (
    <group>
      <mesh position={[0, h / 2, 0]} castShadow>
        <boxGeometry args={it.box} />
        <meshStandardMaterial color={it.color} roughness={0.7} />
      </mesh>
      {it.screen && (
        <group rotation={[0, it.facing ? Math.PI : 0, 0]}>
          <mesh position={[0, h / 2, d / 2 + 0.002]}>
            <planeGeometry args={[w * 0.82, h * 0.85]} />
            <meshBasicMaterial color={it.screen} toneMapped={false} />
          </mesh>
          {it.facing && <FaceLight at={[0, h / 2, 0.25]} color={it.screen} />}
        </group>
      )}
    </group>
  )
}

const RIBS = 7
function Shell() {
  return (
    <group>
      {Array.from({ length: RIBS }, (_, i) => {
        const a = (i - (RIBS - 1) / 2) * 0.24
        return (
          <mesh key={i} position={[Math.sin(a) * 0.09, 0.03 + Math.cos(a) * 0.09, 0]} rotation={[0, 0, -a]} scale={[1, 1, 0.55]} castShadow>
            <capsuleGeometry args={[0.028, 0.12, 4, 8]} />
            <meshStandardMaterial color={i % 2 ? '#ffb8c6' : '#ff8fa8'} roughness={0.45} />
          </mesh>
        )
      })}
      <mesh position={[0, 0.025, 0]} castShadow>
        <boxGeometry args={[0.09, 0.05, 0.04]} />
        <meshStandardMaterial color="#ff8fa8" roughness={0.45} />
      </mesh>
    </group>
  )
}

const ARMS8 = 8
const SEGS = 6
export function Octopus({ color = '#e8674a' }) {
  const arms = useRef<(THREE.Group | null)[]>([])
  useFrame(({ clock }) => {
    const t = clock.elapsedTime
    arms.current.forEach((arm, i) => {
      for (let seg = arm?.children[0], k = 0; seg; seg = seg.children[1], k++)
        seg.rotation.x = 0.28 + Math.sin(t * 2.2 + i * 0.8 - k * 0.6) * 0.18
    })
  })
  const skin = useMemo(() => new THREE.MeshStandardMaterial({ color, roughness: 0.55 }), [color])
  const chain = (k: number): JSX.Element | null =>
    k >= SEGS ? null : (
      <group position={[0, 0, k ? 0.045 : 0]}>
        <mesh material={skin} scale={0.038 * (1 - k * 0.13)} castShadow>
          <sphereGeometry args={[1, 10, 8]} />
        </mesh>
        {chain(k + 1)}
      </group>
    )
  return (
    <group>
      <mesh material={skin} position={[0, 0.2, -0.02]} scale={[0.13, 0.15, 0.14]} castShadow>
        <sphereGeometry args={[1, 18, 14]} />
      </mesh>
      {[-1, 1].map((s) => (
        <group key={s} position={[s * 0.06, 0.17, 0.1]}>
          <mesh scale={0.032}>
            <sphereGeometry args={[1, 12, 10]} />
            <meshStandardMaterial color="#fff8ee" roughness={0.3} />
          </mesh>
          <mesh position={[0, 0, 0.02]} scale={0.018}>
            <sphereGeometry args={[1, 10, 8]} />
            <meshStandardMaterial color="#1c1d24" roughness={0.2} />
          </mesh>
        </group>
      ))}
      {Array.from({ length: ARMS8 }, (_, i) => (
        <group key={i} position={[0, 0.09, -0.02]} rotation={[0, (i / ARMS8) * Math.PI * 2 + 0.4, 0]}>
          <group position={[0, 0, 0.07]} rotation={[0.5, 0, 0]} ref={(g) => (arms.current[i] = g)}>
            {chain(0)}
          </group>
        </group>
      ))}
    </group>
  )
}
