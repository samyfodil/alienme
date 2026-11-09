import { createContext, useContext, useEffect, useMemo, useRef, useState, type ComponentProps, type ReactNode } from 'react'
import { useFrame, type GroupProps } from '@react-three/fiber'
import { RoundedBox } from '@react-three/drei'
import { blinker } from './blink'
import { sculpt, sculpted, sculptMaterial, type Part, type V3 } from './sculpt'
import type { Group } from 'three'
import type { Alien } from '../data/aliens'

function Gloss({ color = '#050608' }) {
  return <meshPhysicalMaterial color={color} roughness={0.08} clearcoat={1} clearcoatRoughness={0.05} />
}

function Glow({ color }: { color: string }) {
  return <meshStandardMaterial color={color} emissive={color} emissiveIntensity={2.2} toneMapped={false} />
}

function Box({ size, r = 0.08, children, ...p }: { size: V3; r?: number; children?: ReactNode } & Omit<ComponentProps<typeof RoundedBox>, 'args'>) {
  return (
    <RoundedBox args={size} radius={r} smoothness={3} castShadow {...p}>
      {children}
    </RoundedBox>
  )
}

const Blink = createContext<(now: number) => number>(() => 0)

function Lid({ children, ...p }: { children: ReactNode } & GroupProps) {
  const blink = useContext(Blink)
  const ref = useRef<Group>(null!)
  useFrame(({ clock }) => {
    ref.current.scale.y = 1 - 0.92 * blink(clock.elapsedTime)
  })
  return (
    <group ref={ref} {...p}>
      {children}
    </group>
  )
}

function Eye({ x, y = 0, z = 0.5, w = 0.2, h = 0.22, pupil = '#111', white = '#fff', slit = false }: { x: number; y?: number; z?: number; w?: number; h?: number; pupil?: string; white?: string; slit?: boolean }) {
  return (
    <Lid position={[x, y, z]}>
      <Box size={[w, h, 0.06]} r={0.03}>
        <meshStandardMaterial color={white} roughness={0.3} />
      </Box>
      <Box size={slit ? [w * 0.18, h * 0.85, 0.07] : [w * 0.5, h * 0.55, 0.07]} r={0.02} position={[0, 0, 0.01]}>
        <Gloss color={pupil} />
      </Box>
    </Lid>
  )
}

const socket = (x: number, y: number, z: number, w: number, h: number, rot: V3 = [0, 0, 0]): Part => ({ shape: 'box', cut: true, size: [w + 0.05, h + 0.05, 0.14], r: Math.min(w, h) / 2, at: [x, y, z + 0.03], rot, k: 0.025 })

function Sculpted({ id, parts, children }: { id: string; parts: Part[]; children: ReactNode }) {
  const time = useMemo(() => ({ value: 0 }), [])
  const [geometry, setGeometry] = useState(() => sculpted(id, parts))
  useEffect(() => {
    let live = true
    sculpt(id, parts).then((g) => live && setGeometry(g))
    return () => {
      live = false
    }
  }, [id, parts])
  const material = useMemo(() => sculptMaterial(time), [time])
  useFrame(({ clock }) => {
    time.value = clock.elapsedTime
  })
  return (
    geometry && (
      <group>
        <mesh geometry={geometry} material={material} castShadow />
        {children}
      </group>
    )
  )
}

type Kind = { c: string }

const GREY = (c: string): Part[] => [
  { shape: 'box', size: [1.3, 0.75, 1.05], r: 0.3, at: [0, 0.32, 0], color: c },
  { shape: 'box', size: [1.0, 0.7, 0.92], r: 0.25, at: [0, -0.1, 0.02], color: c, k: 0.12 },
  { shape: 'box', size: [0.5, 0.35, 0.7], r: 0.15, at: [0, -0.45, 0.08], color: c, k: 0.12 },
  ...[-1, 1].map((s) => socket(s * 0.25, 0.03, 0.5, 0.42, 0.2, [0, 0, s * -0.45])),
  { shape: 'box', cut: true, size: [0.16, 0.03, 0.1], r: 0.012, at: [0, -0.42, 0.45], color: '#566', k: 0.012 },
]

function Grey({ c }: Kind) {
  return (
    <Sculpted id={`grey${c}`} parts={useMemo(() => GREY(c), [c])}>
        {[-1, 1].map((s) => (
          <Lid key={s} position={[s * 0.25, 0.03, 0.5]}>
            <Box size={[0.42, 0.2, 0.08]} r={0.09} rotation={[0, 0, s * -0.45]}>
              <Gloss />
            </Box>
          </Lid>
        ))}
    </Sculpted>
  )
}

const TALLWHITE = (c: string): Part[] => [
  { shape: 'box', size: [0.85, 1.45, 0.9], r: 0.32, at: [0, 0.22, 0], color: c },
  { shape: 'box', size: [0.7, 0.55, 0.9], r: 0.27, at: [0, 0.82, -0.14], color: c, k: 0.22 },
  ...[-1, 1].map((s) => socket(s * 0.2, 0.05, 0.45, 0.22, 0.1)),
  { shape: 'box', cut: true, size: [0.22, 0.035, 0.1], r: 0.015, at: [0, -0.32, 0.46], color: '#b9a', k: 0.012 },
]

function TallWhite({ c }: Kind) {
  return (
    <Sculpted id={`tallwhite${c}`} parts={useMemo(() => TALLWHITE(c), [c])}>
        {[-1, 1].map((s) => (
          <Lid key={s} position={[s * 0.2, 0.05, 0.45]}>
            <Box size={[0.22, 0.1, 0.06]} r={0.04}>
              <Glow color="#7fe9ff" />
            </Box>
          </Lid>
        ))}
    </Sculpted>
  )
}

const AVIAN = (c: string): Part[] => [
  { shape: 'box', size: [1, 1, 1], r: 0.22, color: c },
  { shape: 'pyramid', at: [0, -0.08, 0.43], h: 0.55, w: 0.27, rot: [Math.PI / 2, Math.PI / 4, 0], color: '#ff8a1f', k: 0.06 },
  ...[-0.35, 0, 0.35].map((r, i): Part => ({
    shape: 'box', size: [0.12, 0.55 - Math.abs(r) * 0.4, 0.12], r: 0.05, at: [r * 0.4, 0.68, -0.05 - i * 0.04], rot: [-0.3, 0, -r], color: '#e8452c', k: 0.07,
  })),
  ...[-1, 1].map((s) => socket(s * 0.25, 0.12, 0.5, 0.24, 0.26)),
]

function Avian({ c }: Kind) {
  return (
    <Sculpted id={`avian${c}`} parts={useMemo(() => AVIAN(c), [c])}>
        <Eye x={-0.25} y={0.12} w={0.24} h={0.26} />
        <Eye x={0.25} y={0.12} w={0.24} h={0.26} />
    </Sculpted>
  )
}

const REPTILIAN = (c: string): Part[] => [
  { shape: 'box', size: [1, 0.9, 1.05], r: 0.15, at: [0, 0.05, -0.05], color: c },
  { shape: 'box', size: [0.72, 0.45, 0.55], r: 0.12, at: [0, -0.18, 0.55], color: c, k: 0.14 },
  ...[0.3, 0, -0.3].map((z, i): Part => ({ shape: 'cone', a: [0, 0.42, z], b: [0, 0.55 + (0.32 - i * 0.05) / 2, z], r1: 0.1, r2: 0.015, color: '#c9b13a', k: 0.07 })),
  ...[-1, 1].map((s) => socket(s * 0.27, 0.18, 0.5, 0.24, 0.2)),
  ...[-1, 1].map((s): Part => ({ shape: 'box', cut: true, size: [0.07, 0.05, 0.1], r: 0.02, at: [s * 0.12, -0.08, 0.84], color: '#1a2a14', k: 0.015 })),
  { shape: 'box', cut: true, size: [0.62, 0.045, 0.12], r: 0.02, at: [0, -0.34, 0.82], color: '#2c4421', k: 0.015 },
]

function Reptilian({ c }: Kind) {
  return (
    <Sculpted id={`reptilian${c}`} parts={useMemo(() => REPTILIAN(c), [c])}>
        <Eye x={-0.27} y={0.18} w={0.24} h={0.2} white="#ffd23b" slit />
        <Eye x={0.27} y={0.18} w={0.24} h={0.2} white="#ffd23b" slit />
    </Sculpted>
  )
}

const tentacle = (x: number, z: number, phase: number, c: string, len: number, out = -0.12) => {
  const a: V3 = [x * 0.9, -0.24, z]
  const bend = [x * 1.25, -0.36 - len * 0.62, z + out * 0.4]
  const tip = [x * 1.9 + Math.sign(x) * 0.04, -0.36 - len * 0.95, z + out]
  const at = (t: number) => a.map((v, i) => (1 - t) ** 2 * v + 2 * (1 - t) * t * bend[i] + t * t * tip[i]) as V3
  const r = (t: number) => 0.085 + (0.016 - 0.085) * t
  const sway = { pivot: a, mode: 'tentacle' as const, phase, len }
  const n = 6
  return Array.from({ length: n }, (_, i): Part => ({
    shape: 'cone', a: at(i / n), b: at((i + 1) / n), r1: r(i / n), r2: r((i + 1) / n), color: c, k: i === 0 ? 0.16 : 0.004, sway,
  }))
}

const CEPHALOPOD = (c: string): Part[] => [
  { shape: 'box', size: [1.15, 1.2, 1.05], r: 0.45, at: [0, 0.18, -0.05], color: c },
  ...[-0.33, -0.11, 0.11, 0.33].flatMap((x, i) => tentacle(x, 0.35, i * 1.3, c, 0.5, 0.3)),
  ...[-0.25, 0.25].flatMap((x, i) => tentacle(x, 0.05, i * 2 + 0.6, c, 0.55)),
  ...[-1, 1].map((s) => socket(s * 0.24, 0.05, 0.5, 0.3, 0.26)),
]

function Cephalopod({ c }: Kind) {
  return (
    <Sculpted id={`cephalopod${c}`} parts={useMemo(() => CEPHALOPOD(c), [c])}>
        <Eye x={-0.24} y={0.05} w={0.3} h={0.26} white="#ffe066" pupil="#120018" />
        <Eye x={0.24} y={0.05} w={0.3} h={0.26} white="#ffe066" pupil="#120018" />
    </Sculpted>
  )
}

const antenna = (x: number, c: string): Part => {
  const a: V3 = [x * 0.25, 0.42, 0.05]
  const t = -x * 0.6
  const b: V3 = [a[0] - Math.sin(t) * 0.58, a[1] + Math.cos(t) * 0.58, a[2]]
  return { shape: 'cone', a: [a[0] + Math.sin(t) * 0.1, a[1] - Math.cos(t) * 0.1, a[2]], b, r1: 0.05, r2: 0.025, color: c, k: 0.08, sway: { pivot: a, mode: 'antenna', phase: x * 5, len: 0.4 } }
}

const MANTIS = (c: string): Part[] => [
  { shape: 'box', size: [1.25, 0.55, 0.8], r: 0.18, at: [0, 0.2, 0], color: c },
  { shape: 'box', size: [0.55, 0.55, 0.6], r: 0.15, at: [0, -0.25, 0.08], color: c, k: 0.14 },
  ...[-1, 1].map((s): Part => ({ shape: 'box', size: [0.08, 0.2, 0.08], r: 0.03, at: [s * 0.1, -0.55, 0.3], rot: [0, 0, s * 0.4], color: '#3d6b1f', k: 0.05 })),
  antenna(-1, c),
  antenna(1, c),
]

function Bulb({ x }: { x: number }) {
  const ref = useRef<Group>(null!)
  useFrame(({ clock }) => {
    ref.current.rotation.z = -x * 0.6 + Math.sin(clock.elapsedTime * 3 + x * 5) * 0.12
  })
  return (
    <group ref={ref} position={[x * 0.25, 0.42, 0.05]}>
      <mesh position={[0, 0.62, 0]}>
        <sphereGeometry args={[0.07, 12, 10]} />
        <Glow color="#d6ff4a" />
      </mesh>
    </group>
  )
}

function Mantis({ c }: Kind) {
  return (
    <Sculpted id={`mantis${c}`} parts={useMemo(() => MANTIS(c), [c])}>
        {[-1, 1].map((s) => (
          <Lid key={s} position={[s * 0.6, 0.22, 0.2]}>
            <mesh scale={[0.9, 1, 0.85]} castShadow>
              <sphereGeometry args={[0.27, 32, 24]} />
              <meshPhysicalMaterial color="#0c2a12" roughness={0.12} clearcoat={1} clearcoatRoughness={0.05} />
            </mesh>
            <mesh position={[-s * 0.05, 0.1, 0.21]}>
              <sphereGeometry args={[0.045, 12, 10]} />
              <meshBasicMaterial color="#ffffff" toneMapped={false} />
            </mesh>
          </Lid>
        ))}
        <Bulb x={-1} />
        <Bulb x={1} />
    </Sculpted>
  )
}

const PARTS = { grey: GREY, tallwhite: TALLWHITE, avian: AVIAN, reptilian: REPTILIAN, cephalopod: CEPHALOPOD, mantis: MANTIS }

export function prepareHeads(colors: Partial<Record<Alien, string>>) {
  for (const [kind, c] of Object.entries(colors) as [Alien, string][]) sculpt(`${kind}${c}`, PARTS[kind](c))
}

const HEADS = {
  grey: Grey,
  tallwhite: TallWhite,
  avian: Avian,
  reptilian: Reptilian,
  cephalopod: Cephalopod,
  mantis: Mantis,
}

export function AlienHead({ kind, color }: { kind: Alien; color: string }) {
  const H = HEADS[kind] || Grey
  const blink = useMemo(blinker, [])
  return (
    <Blink.Provider value={blink}>
      <H c={color} />
    </Blink.Provider>
  )
}
