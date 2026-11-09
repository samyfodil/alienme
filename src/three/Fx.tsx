import { useEffect, useLayoutEffect, useMemo, useRef, type ComponentType } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import { Prop } from './Prop'
import { Item } from './Npc'
import { Built } from './Built'
import { useLoan } from './lamps'
import type { CtlRef } from '../story/ctl'
import type { Fx as Spec, Item as ItemName, Model, Point } from '../story/types'

const GROUND = -1.25
const _v = new THREE.Vector3()

export type Running = { spec: Spec; t0: number; slot: number; ox: number; oz: number; key: string; tag: string }
type Props = { fx: Running; ctl: CtlRef }

const local = (fx: Running, t: number) => t - fx.t0 - (fx.spec.at0 || 0)
const propOf = (ctl: CtlRef, fx: Running, id = fx.spec.prop) => ctl.current.reg[`${fx.slot}:${id}`] as THREE.Group | undefined
const spotOf = (fx: Running): Point => (Array.isArray(fx.spec.at) ? fx.spec.at : [0, 0])
function topOf(ctl: CtlRef, fx: Running, extra = 0.25) {
  const g = propOf(ctl, fx)
  if (g) return g.getWorldPosition(_v).clone().add(new THREE.Vector3(0, g.userData.top + extra, 0))
  const at = spotOf(fx)
  return new THREE.Vector3(fx.ox + at[0], GROUND + (fx.spec.height ?? 1) + 0.45, fx.oz + at[1])
}

function PlayClip({ fx, ctl }: Props) {
  const started = useRef(false)
  useFrame(({ clock }) => {
    const g = propOf(ctl, fx)
    if (!g || started.current || local(fx, clock.elapsedTime) < 0) return
    started.current = true
    g.userData.play = { clip: fx.spec.clip, until: clock.elapsedTime + (fx.spec.dur ?? 2) }
  })
  useEffect(
    () => () => {
      const g = propOf(ctl, fx)
      if (g) delete g.userData.play
    },
    [ctl, fx],
  )
  return null
}

function PropMotion({ fx, ctl }: Props) {
  useFrame(({ clock }, dt) => {
    const g = propOf(ctl, fx)
    if (!g) return
    const t = local(fx, clock.elapsedTime)
    const { base } = g.userData
    if (t < 0) return
    if (fx.spec.type === 'shake') g.rotation.z = Math.sin(t * 38) * 0.09
    if (fx.spec.type === 'take') g.scale.setScalar(Math.max(0.0001, 1 - t / 0.15))
    if (fx.spec.type === 'bounce') g.scale.y = 1 + Math.abs(Math.sin(t * 9)) * 0.06 * Math.max(0, 1 - t / 3)
    if (fx.spec.type === 'come') {
      const p = ctl.current.group!.position
      const dx = p.x - fx.ox - base[0]
      const dz = p.z - fx.oz - base[2]
      const len = Math.hypot(dx, dz)
      const go = Math.max(0, len - (fx.spec.dist ?? 1.1))
      const k = THREE.MathUtils.smootherstep(Math.min(1, t / 1.2), 0, 1)
      g.position.x = base[0] + (dx / len) * go * k
      g.position.z = base[2] + (dz / len) * go * k
      g.position.y = base[1] + Math.abs(Math.sin(t * 10)) * 0.05 * (1 - k)
      const want = Math.atan2(dx, dz)
      const turn = want - g.rotation.y
      g.rotation.y += Math.atan2(Math.sin(turn), Math.cos(turn)) * Math.min(1, dt * 6)
    }
  })
  useEffect(
    () => () => {
      const g = propOf(ctl, fx)
      if (!g || fx.spec.type === 'take') return
      g.position.fromArray(g.userData.base)
      g.rotation.set(0, g.userData.rotY, 0)
      g.scale.setScalar(1)
    },
    [ctl, fx],
  )
  return null
}

function Emitter({ fx, ctl }: Props) {
  const next = useRef(0)
  const n = useRef(0)
  useFrame(({ clock }) => {
    const t = local(fx, clock.elapsedTime)
    const { every = 0.8, until = Infinity, text } = fx.spec
    if (t < 0 || t > until || t < next.current) return
    next.current = t + every
    const texts = ([] as string[]).concat(text ?? [])
    ctl.current.emit?.(texts[n.current++ % texts.length], topOf(ctl, fx))
  })
  return null
}

function Banner({ fx, ctl }: Props) {
  const done = useRef(false)
  useFrame(({ clock }) => {
    if (done.current || local(fx, clock.elapsedTime) < 0) return
    done.current = true
    ctl.current.emit?.(String(fx.spec.text), topOf(ctl, fx, 0.6), 'banner')
  })
  return null
}

function Glow({ fx, ctl }: Props) {
  const loan = useLoan()
  useFrame(({ clock }) => {
    const g = propOf(ctl, fx)
    if (!g) return (loan.power = 0)
    const t = local(fx, clock.elapsedTime)
    const { x = 0, y = 1, z = 0.6, flicker, power = 14 } = fx.spec
    g.getWorldPosition(loan.pos)
    loan.pos.add(_v.set(x, y, z))
    if (fx.spec.color) loan.color.set(fx.spec.color)
    loan.reach = 5
    const on = Math.min(1, Math.max(0, t) / 0.3)
    loan.power = power * on * (flicker ? 0.6 + 0.4 * Math.abs(Math.sin(t * 9) * Math.sin(t * 3.7)) : 1)
  })
  return null
}

function Pop({ fx, ctl }: Props) {
  const g = useRef<THREE.Group>(null)
  const from = useMemo(() => new THREE.Vector3(), [])
  useFrame(({ clock }) => {
    const o = g.current
    const t = local(fx, clock.elapsedTime)
    if (!o) return
    const s = Math.min(1, t / 0.7)
    o.visible = t >= 0 && s < 1
    if (!o.visible) return
    const p = propOf(ctl, fx)!
    p.getWorldPosition(from)
    from.y += fx.spec.low ? 0.5 : p.userData.top
    if (fx.spec.low) from.z += 0.5
    const hand = ctl.current.hand
    o.position.lerpVectors(from, hand, s)
    o.position.y += Math.sin(Math.PI * s) * (fx.spec.low ? 0.4 : 1.1)
    o.rotation.x = s * 8
  })
  return (
    <group ref={g} visible={false}>
      <Item name={fx.spec.item as ItemName} />
    </group>
  )
}

function Spawn({ fx }: Props) {
  const g = useRef<THREE.Group>(null)
  useFrame(({ clock }) => {
    const t = local(fx, clock.elapsedTime)
    if (!g.current) return
    const { grow } = fx.spec
    if (grow) {
      const k = THREE.MathUtils.smootherstep(t / grow, 0, 1)
      g.current.scale.set(1, Math.max(0.0001, k), 1)
      g.current.visible = t > 0
      return
    }
    const s = t <= 0 ? 0.0001 : t >= 1 ? 1 : 1 - Math.pow(2, -9 * t) * Math.cos(t * 12)
    g.current.scale.setScalar(Math.max(0.0001, s))
  })
  const { y = 0, item, build } = fx.spec
  const at = spotOf(fx)
  return (
    <group ref={g} position={[fx.ox + at[0], GROUND + y, fx.oz + at[1]]} scale={0.0001}>
      {build ? <Built name={build} /> : <Prop model={item as Model} />}
    </group>
  )
}

function Splash({ fx }: Props) {
  const rings = useRef<(THREE.Mesh | null)[]>([])
  useFrame(({ clock }) => {
    const t = local(fx, clock.elapsedTime)
    rings.current.forEach((m, i) => {
      if (!m) return
      const u = t - i * 0.18
      m.visible = u > 0 && u < 1.4
      const s = 0.2 + u * 1.6
      m.scale.set(s, s, s)
      ;(m.material as THREE.MeshBasicMaterial).opacity = Math.max(0, 0.8 * (1 - u / 1.4))
    })
  })
  const at = spotOf(fx)
  return (
    <group position={[fx.ox + at[0], GROUND + 0.13, fx.oz + at[1]]} rotation={[-Math.PI / 2, 0, 0]}>
      {[0, 1, 2].map((i) => (
        <mesh key={i} ref={(m) => (rings.current[i] = m)} visible={false}>
          <ringGeometry args={[0.4, 0.5, 40]} />
          <meshBasicMaterial color="#e8f8ff" transparent toneMapped={false} />
        </mesh>
      ))}
    </group>
  )
}

const DROPS = 40
function Water({ fx }: Props) {
  const mesh = useRef<THREE.InstancedMesh>(null!)
  const drops = useMemo(() => Array.from({ length: DROPS }, (_, i) => ({ a: (i * 2.39) % (Math.PI * 2), r: 0.06 + ((i * 37) % 23) / 70, off: ((i * 53) % 97) / 97 })), [])
  const m = useMemo(() => new THREE.Matrix4(), [])
  useFrame(({ clock }) => {
    const t = local(fx, clock.elapsedTime)
    const on = t > 0 && t < (fx.spec.until ?? 3.6)
    mesh.current.visible = on
    if (!on) return
    const h = fx.spec.height ?? 2.4
    drops.forEach((d, i) => {
      const u = (t * 1.6 + d.off) % 1
      const spread = d.r * (0.3 + u)
      m.makeTranslation(Math.cos(d.a) * spread, h * (1 - u), Math.sin(d.a) * spread)
      mesh.current.setMatrixAt(i, m)
    })
    mesh.current.instanceMatrix.needsUpdate = true
  })
  const at = spotOf(fx)
  return (
    <group position={[fx.ox + at[0], GROUND, fx.oz + at[1]]}>
      <instancedMesh ref={mesh} args={[undefined, undefined, DROPS]} visible={false}>
        <boxGeometry args={[0.018, 0.22, 0.018]} />
        <meshBasicMaterial color="#bfe8ff" transparent opacity={0.7} toneMapped={false} />
      </instancedMesh>
    </group>
  )
}

const CONFETTI = 140
function Confetti({ fx }: Props) {
  const mesh = useRef<THREE.InstancedMesh>(null!)
  const bits = useMemo(
    () =>
      Array.from({ length: CONFETTI }, () => ({
        x: (Math.random() - 0.5) * 6,
        z: (Math.random() - 0.5) * 4,
        y: 3 + Math.random() * 3,
        v: 0.8 + Math.random() * 0.9,
        r: Math.random() * 6,
        w: (Math.random() - 0.5) * 12,
      })),
    [],
  )
  useLayoutEffect(() => {
    const c = new THREE.Color()
    const palette = ['#ff4fd8', '#4fd8ff', '#ffd23f', '#5fffd1', '#ff7a3d']
    bits.forEach((_, i) => mesh.current.setColorAt(i, c.set(palette[i % palette.length])))
    mesh.current.instanceColor!.needsUpdate = true
  }, [bits])
  const o = useMemo(() => new THREE.Object3D(), [])
  useFrame(({ clock }) => {
    const t = Math.max(0, local(fx, clock.elapsedTime))
    bits.forEach((b, i) => {
      o.position.set(b.x + Math.sin(t * 2 + b.r) * 0.3, Math.max(0.05, b.y - b.v * t), b.z)
      o.rotation.set(b.r + t * b.w, b.r * 2 + t * b.w * 0.7, 0)
      o.updateMatrix()
      mesh.current.setMatrixAt(i, o.matrix)
    })
    mesh.current.instanceMatrix.needsUpdate = true
  })
  const at = spotOf(fx)
  return (
    <instancedMesh ref={mesh} args={[undefined, undefined, CONFETTI]} position={[fx.ox + at[0], GROUND, fx.oz + at[1]]}>
      <planeGeometry args={[0.12, 0.07]} />
      <meshBasicMaterial side={THREE.DoubleSide} toneMapped={false} />
    </instancedMesh>
  )
}

function Dark({ fx, ctl }: Props) {
  useFrame(({ clock }) => {
    const k = THREE.MathUtils.clamp(local(fx, clock.elapsedTime) / 0.5, 0, 1)
    for (const l of ctl.current.lights) l.intensity = l.userData.base * (1 - 0.85 * k)
    ctl.current.dim = 1 - 0.9 * k
  })
  useEffect(
    () => () => {
      for (const l of ctl.current.lights) l.intensity = l.userData.base
      ctl.current.dim = 1
    },
    [ctl],
  )
  return null
}

function Scribble({ fx, ctl }: Props) {
  const segs = useRef<(THREE.Mesh | null)[]>([])
  const N = 7
  const pts = useMemo(() => Array.from({ length: N + 1 }, (_, i): Point => [-0.5 + i / N, (i / N) * 0.8 + (i % 2 ? -0.08 : 0.08)]), [])
  useFrame(({ clock }) => {
    const t = local(fx, clock.elapsedTime)
    segs.current.forEach((m, i) => m && (m.visible = t > 0.4 + i * 0.35))
  })
  const g = propOf(ctl, fx)
  if (!g) return null
  const box = new THREE.Box3().setFromObject(g)
  const size = box.getSize(new THREE.Vector3())
  const w = size.x * 0.35
  const h = size.y * 0.32
  return (
    <group position={[box.min.x + size.x * 0.33, box.min.y + size.y * 0.6, box.max.z + 0.02]}>
      {pts.slice(1).map(([px, py], i) => {
        const [x, y, x0, y0] = [px * w, py * h - h * 0.4, pts[i][0] * w, pts[i][1] * h - h * 0.4]
        const len = Math.hypot(x - x0, y - y0)
        return (
          <mesh key={i} ref={(m) => (segs.current[i] = m)} position={[(x + x0) / 2, (y + y0) / 2, 0]} rotation={[0, 0, Math.atan2(y - y0, x - x0)]} visible={false}>
            <boxGeometry args={[len + 0.03, 0.045, 0.01]} />
            <meshBasicMaterial color={i === N - 1 ? '#e2483c' : '#2d5bd8'} />
          </mesh>
        )
      })}
    </group>
  )
}

const KINDS: Record<string, ComponentType<Props>> = {
  shake: PropMotion,
  bounce: PropMotion,
  come: PropMotion,
  take: PropMotion,
  anim: PlayClip,
  emit: Emitter,
  banner: Banner,
  glow: Glow,
  pop: Pop,
  spawn: Spawn,
  splash: Splash,
  water: Water,
  confetti: Confetti,
  dark: Dark,
  scribble: Scribble,
}

export const FX_KINDS = Object.keys(KINDS)

export function Fx({ list, ctl }: { list: Running[]; ctl: CtlRef }) {
  return list.map((fx) => {
    const Kind = KINDS[fx.spec.type]
    return Kind ? <Kind key={fx.key} fx={fx} ctl={ctl} /> : null
  })
}
