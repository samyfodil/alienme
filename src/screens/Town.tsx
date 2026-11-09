import { Suspense, useEffect, useMemo, useRef } from 'react'
import { Canvas, advance, useFrame, useThree } from '@react-three/fiber'
import * as THREE from 'three'
import { City } from '../three/City'
import { Effects } from '../three/Effects'
import { Character } from '../three/Character'
import { bodyFrame, handRig, stepHands, type BodyPose, type Frame, type Pose as Hands } from '../three/acts'
import type { Pose } from '../three/Character'
import type { Ctl } from '../story/ctl'
import type { Alien, Point } from '../story/types'
import { Sky, SceneLights } from '../story/World'
import { Diorama } from '../story/Room'
import { BEAT } from '../story/engine'
import { GROUND } from '../story/stage'
import { ALIENS, ALIEN_KEYS } from '../data/aliens'
import { presetAvatar } from '../data/models'

type V3 = [number, number, number]

export const VIEW: { cam: V3; at: V3; fov: number; time: string; scene: string; size: [number, number] } = { cam: [122.53, 6.99, 62.23], at: [127.23, 6.87, 26.43], fov: 34, time: '12:40', scene: 'beach', size: [2400, 1200] }
export const CROWD: { at: Point; width: number } = { at: [127.5, 24], width: 16 }
const SPOTS = [0.17, 0.29, 0.41, 0.59, 0.71, 0.83]
const HEIGHT = 2.2
const ROOM = { side: 1.25, deep: 0.9, below: 0.15, above: 3.7 }

export const LOOP = 2.5
const w = (n: number, t: number) => Math.sin((2 * Math.PI * n * t) / LOOP)
const up = (n: number, t: number) => 0.5 - 0.5 * Math.cos((2 * Math.PI * n * t) / LOOP)

const MOVES: Record<Alien, (t: number, P: Frame) => Hands & BodyPose> = {
  grey: (t) => ({ R: [0.9, 2.2, 0.3, -0.2, 0.2, 2.6 + w(2, t) * 0.5], roll: w(1, t) * 0.04 }),
  avian: (t) => ({
    L: [0.8, 2.05 + up(4, t) * 0.3, 0.2, 0, 0, 2.7],
    R: [0.84, 2.05 + up(4, t) * 0.3, 0.24, 0, 0, 2.7],
    lift: up(4, t) * 0.3,
  }),
  reptilian: (t, P) => {
    const a = (2 * Math.PI * 5 * t) / LOOP
    return {
      L: [0.25 + Math.cos(a) * 0.12, P.chest + 0.05 + Math.sin(a) * 0.1, P.front + 0.35, -0.9, 0, 0.6],
      R: [0.25 - Math.cos(a) * 0.12, P.chest + 0.05 - Math.sin(a) * 0.1, P.front + 0.35, -0.9, 0, 0.6],
      lift: up(5, t) * 0.14,
      yaw: w(1, t) * 0.5,
      roll: w(5, t) * 0.06,
    }
  },
  cephalopod: (t) => ({
    L: [0.6, 1.75 + w(3, t) * 0.08, 0.35, -0.3, 0, 1.8 + w(6, t) * 0.4],
    R: [0.6, 1.75 - w(3, t) * 0.08, 0.35, -0.3, 0, 1.8 - w(6, t) * 0.4],
    roll: w(1, t) * 0.1,
  }),
  mantis: (t) => ({
    L: [0.85, 1.95 + w(2, t) * 0.12, 0.2, 0, 0, 2.4],
    R: [0.85, 1.95 - w(2, t) * 0.12, 0.2, 0, 0, 2.4],
    roll: w(1, t) * 0.1,
    yaw: w(1, t) * 0.15,
  }),
  tallwhite: (t) => ({ R: [0.85, 2.0, 0.35, -0.2, 0.2, 2.4 + w(3, t) * 0.35], pitch: up(1, t) * 0.06 }),
}

function row(cam: V3) {
  const d = new THREE.Vector2(CROWD.at[0] - cam[0], CROWD.at[1] - cam[2]).normalize()
  const right = new THREE.Vector2(-d.y, d.x)
  const along = (f: number): Point => [CROWD.at[0] + right.x * (f - 0.5) * CROWD.width, CROWD.at[1] + right.y * (f - 0.5) * CROWD.width]
  return { along, d, right, face: Math.atan2(-d.x, -d.y), spots: SPOTS.map(along) }
}

function Mover({ kind, layer, children }: { kind: Alien; layer: { current: Pose }; children: React.ReactNode }) {
  const body = useRef<THREE.Group>(null)
  const P = useRef<Frame | null>(null)
  const hands = useRef(handRig())
  useFrame(({ clock }, dt) => {
    const L = layer.current
    if (!P.current && L.rig) P.current = bodyFrame(L.rig)
    if (!P.current || !body.current) return
    const t = clock.elapsedTime
    const m = MOVES[kind](t, P.current)
    const h = stepHands(hands.current, P.current, m, { dt, now: t, lift: m.lift || 0 })
    L.off = h.off
    L.rot = h.rot
    const b = body.current
    b.position.y = m.lift || 0
    b.rotation.set(m.pitch || 0, (m.yaw || 0) + Math.sin(ALIEN_KEYS.indexOf(kind) * 1.7) * 0.3, m.roll || 0)
  })
  return (
    <group position={[0, GROUND, 0]}>
      <group ref={body}>
        <group position={[0, -GROUND, 0]}>{children}</group>
      </group>
    </group>
  )
}

function Person({ i, alien, spot, face }: { i: number; alien?: boolean; spot: Point; face: number }) {
  const kind = ALIEN_KEYS[i]
  const avatar = useMemo(() => presetAvatar(ALIENS[kind].disguise), [kind])
  const layer = useRef<Pose>({ k: 0, off: null })
  return (
    <group position={[spot[0], 0, spot[1]]} rotation={[0, face, 0]}>
      <Mover kind={kind} layer={layer}>
        <Character avatar={avatar} alien={alien ? kind : null} targetHeight={HEIGHT} groundY={GROUND} pose={layer} />
      </Mover>
    </group>
  )
}

function Layout({ cam }: { cam: V3 }) {
  const camera = useThree((s) => s.camera)
  useEffect(() => {
    camera.updateMatrixWorld()
    const r = row(cam)
    const at = (x: number, y: number, z: number): Point => {
      const v = new THREE.Vector3(x, y, z).project(camera)
      return [(v.x + 1) / 2, (1 - v.y) / 2]
    }
    const box = (pts: Point[]) => {
      const xs = pts.map((p) => p[0])
      const ys = pts.map((p) => p[1])
      return { x: Math.min(...xs), y: Math.min(...ys), w: Math.max(...xs) - Math.min(...xs), h: Math.max(...ys) - Math.min(...ys) }
    }
    const [l, rt] = [r.along(0), r.along(1)]
    const sh = (CROWD.width * 11) / 30
    const bottom = GROUND + 1.2 - (sh * (220 - 116)) / 220
    const shades = box([at(l[0], bottom, l[1]), at(rt[0], bottom, rt[1]), at(l[0], bottom + sh, l[1]), at(rt[0], bottom + sh, rt[1])])
    const mates = r.spots.map(([x, z]) => {
      const corners: Point[] = []
      for (const s of [-1, 1])
        for (const k of [-1, 1])
          for (const y of [GROUND - ROOM.below, GROUND + ROOM.above])
            corners.push(at(x + r.right.x * s * ROOM.side + r.d.x * k * ROOM.deep, y, z + r.right.y * s * ROOM.side + r.d.y * k * ROOM.deep))
      const a = at(x - r.right.x * 0.55, GROUND, z - r.right.y * 0.55)
      const b = at(x + r.right.x * 0.55, GROUND, z + r.right.y * 0.55)
      return { frame: box(corners), feet: at(x, GROUND, z), shadow: Math.abs(b[0] - a[0]) }
    })
    window.__layout = { size: VIEW.size, shades, mates }
  }, [camera, cam])
  return null
}

function Silhouette() {
  const scene = useThree((s) => s.scene)
  useEffect(() => {
    scene.overrideMaterial = new THREE.MeshBasicMaterial({ color: '#000' })
    scene.background = new THREE.Color('#fff')
    scene.fog = new THREE.Fog('#fff', 160, 600)
  }, [scene])
  return null
}

function Ready() {
  const n = useRef(0)
  useFrame(() => {
    if (++n.current === 120) window.__townReady = true
  })
  return null
}

function Stepper() {
  useEffect(() => {
    window.__step = (t) => advance(t)
    window.__loop = LOOP
    window.__townReady = true
  }, [])
  return null
}

const NONE: string[] = []
const vec = (s: string | null, d: V3) => (s ? (s.split(',').map(Number) as V3) : d)

export default function Town() {
  const q = new URLSearchParams(window.location.search)
  const cam = vec(q.get('cam'), VIEW.cam)
  const at = vec(q.get('at'), VIEW.at)
  const mask = q.has('mask')
  const person = q.has('person') ? Number(q.get('person')) : null
  const ctl = useRef<Ctl>({
    start: [0, 0],
    face: 0,
    path: null,
    hidden: true,
    hand: new THREE.Vector3(),
    cam: { mode: 'map' },
    cameraAt: [0, 0],
    reg: {},
    npcs: {},
    arrivals: {},
    lights: [],
    lookAt: new THREE.Vector3(...at),
    indoor: false,
    landInside: null,
  })
  const r = useMemo(() => row(cam), [])
  const camera = useMemo(() => ({ position: cam, fov: Number(q.get('fov')) || VIEW.fov, far: 1500 }), [])
  useEffect(() => {
    document.body.style.margin = '0'
  }, [])
  return (
    <Canvas
      shadows
      frameloop={person != null ? 'never' : 'always'}
      style={{ position: 'fixed', inset: 0 }}
      camera={camera}
      gl={{ preserveDrawingBuffer: true }}
      onCreated={({ camera }) => camera.lookAt(...at)}
    >
      <Layout cam={cam} />
      {person == null && (mask ? <Silhouette /> : <Sky ctl={ctl} time={VIEW.time} />)}
      <SceneLights ctl={ctl} time={VIEW.time} />
      <Suspense fallback={null}>
        {person == null && <City open={NONE} badges={false} />}
        {person == null && <Diorama beat={BEAT[VIEW.scene]} slot={`lite-${VIEW.scene}`} ctl={ctl} lite />}
        {person == null && q.has('crowd') && ALIEN_KEYS.map((k, i) => <Person key={k} i={i} spot={r.spots[i]} face={r.face} />)}
        {person != null && <Person i={person} alien={q.get('form') === 'alien'} spot={r.spots[person]} face={r.face} />}
        {person == null ? <Ready /> : <Stepper />}
      </Suspense>
      {person == null && !mask && <Effects bloom={0.5} toy vignette={false} />}
    </Canvas>
  )
}
