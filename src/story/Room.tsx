import { useMemo, useRef, Suspense, memo, useEffect } from 'react'
import { useFrame, type ThreeEvent } from '@react-three/fiber'
import { RoundedBox, Html } from '@react-three/drei'
import * as THREE from 'three'
import { FLOOR, WALL, type RoomSet } from '../data/sets'
import { propHeight, Prop, seatHeight } from '../three/Prop'
import { Built, Door } from '../three/Built'
import { Item, Animal, Fitted, Npc } from '../three/Npc'
import { originOf, indoor } from '../data/city'
import { propId, setOf, GROUND, targetOf, routeAround } from './stage'
import { doorPath, doorTo, holds, pick } from './engine'
import { useLook } from './look'
import { castOf, say } from './cast'
import type { CtlRef, Stage } from './ctl'
import type { Beat, Choice, Extra, Flags, Npc as NpcSpec, Prop as PropSpec } from './types'

const CAPTION_BOTTOM = 140
const EDGE = 8

type Label = { el?: HTMLElement | null; anchor?: THREE.Object3D | null }

function useDeclutter(labels: { current: Label[] }) {
  const v = useMemo(() => new THREE.Vector3(), [])
  useFrame(({ camera, size }) => {
    const placed: { x: number; y: number; w: number; h: number }[] = []
    for (const l of labels.current) {
      if (!l?.el || !l.anchor) continue
      l.anchor.getWorldPosition(v).project(camera)
      const w = l.el.offsetWidth + 8
      const h = l.el.offsetHeight + 6
      const x = (v.x * 0.5 + 0.5) * size.width
      const y0 = (-v.y * 0.5 + 0.5) * size.height
      const settle = (dir: number) => {
        let y = y0
        for (let moved = true, n = 0; moved && n < 20; n++) {
          moved = false
          for (const p of placed) {
            if (Math.abs(p.x - x) < (p.w + w) / 2 && Math.abs(p.y - y) < (p.h + h) / 2) {
              y = p.y + dir * ((p.h + h) / 2 + 0.5)
              moved = true
            }
          }
        }
        return y
      }
      let y = settle(-1)
      if (y - h / 2 < CAPTION_BOTTOM) y = settle(1)
      placed.push({ x, y, w, h })
      const dx = Math.max(EDGE + w / 2 - x, Math.min(0, size.width - EDGE - w / 2 - x))
      l.el.style.translate = `${Math.round(dx)}px ${Math.round(y - y0)}px`
    }
  })
}

function Walls({ walls }: { walls: NonNullable<RoomSet['walls']> }) {
  const back = FLOOR.z - FLOOR.d / 2 + WALL.t / 2
  const len = WALL.sideTo - back
  const side = (sx: number) => (
    <group position={[sx * (FLOOR.w / 2 - WALL.t / 2), 0, back + len / 2]}>
      <RoundedBox args={[WALL.t, WALL.h, len]} radius={0.09} smoothness={3} position={[0, WALL.h / 2, 0]} castShadow receiveShadow>
        <meshStandardMaterial color={walls.color} roughness={0.9} />
      </RoundedBox>
      <RoundedBox args={[WALL.t + 0.1, 0.16, len + 0.1]} radius={0.075} smoothness={3} position={[0, WALL.h + 0.04, 0]}>
        <meshStandardMaterial color={walls.trim} roughness={0.6} />
      </RoundedBox>
    </group>
  )
  return (
    <group>
      <RoundedBox args={[FLOOR.w, WALL.h, WALL.t]} radius={0.09} smoothness={3} position={[0, WALL.h / 2, back]} receiveShadow>
        <meshStandardMaterial color={walls.color} roughness={0.9} />
      </RoundedBox>
      <RoundedBox args={[FLOOR.w + 0.1, 0.16, WALL.t + 0.1]} radius={0.075} smoothness={3} position={[0, WALL.h + 0.04, back]}>
        <meshStandardMaterial color={walls.trim} roughness={0.6} />
      </RoundedBox>
      <mesh position={[0, 0.08, back + WALL.t / 2 + 0.01]}>
        <boxGeometry args={[FLOOR.w - 0.2, 0.16, 0.02]} />
        <meshStandardMaterial color={walls.trim} roughness={0.6} />
      </mesh>
      {walls.strip ? (
        <mesh position={[0, 2.5, back + WALL.t / 2 + 0.02]}>
          <boxGeometry args={[FLOOR.w - 0.6, 0.08, 0.03]} />
          <meshBasicMaterial color={walls.trim} toneMapped={false} />
        </mesh>
      ) : (
        (walls.windowsAt || [-1.6, 1.6]).map((x) => (
          <group key={x} position={[x, 2.05, back + WALL.t / 2 + 0.02]}>
            <RoundedBox args={[1.5, 1.1, 0.06]} radius={0.025} smoothness={3}>
              <meshStandardMaterial color={walls.trim} roughness={0.6} />
            </RoundedBox>
            <mesh position={[0, 0, 0.035]}>
              <planeGeometry args={[1.3, 0.9]} />
              <meshBasicMaterial color={walls.windows} toneMapped={false} />
            </mesh>
          </group>
        ))
      )}
      {side(-1)}
      {side(1)}
    </group>
  )
}

function Stand({ lift, width }: { lift: number; width: number }) {
  return [-1, 1].map((s) => (
    <group key={s} position={[0, 0, (s * width) / 2]}>
      <mesh position={[0, -lift / 2 + 0.15, 0]} castShadow>
        <cylinderGeometry args={[0.03, 0.03, lift + 0.3, 10]} />
        <meshStandardMaterial color="#9aa1ab" metalness={0.4} roughness={0.4} />
      </mesh>
      <mesh position={[0, -lift + 0.025, 0]} castShadow>
        <boxGeometry args={[0.7, 0.05, 0.07]} />
        <meshStandardMaterial color="#6d737c" metalness={0.3} roughness={0.5} />
      </mesh>
    </group>
  ))
}

const springIn = (t: number) => (t <= 0 ? 0.001 : t > 1.4 ? 1 : 1 - Math.exp(-6 * t) * Math.cos(10 * t))

type Born = { current: number | null }

function Pop({ born, delay = 0, children }: { born: Born | null; delay?: number; children: React.ReactNode }) {
  const g = useRef<THREE.Group>(null)
  useFrame(({ clock }) => {
    if (g.current && born?.current != null) g.current.scale.setScalar(useLook.getState().pops ? Math.max(0.001, springIn(clock.elapsedTime - born.current - delay)) : 1)
  })
  return <group ref={g}>{children}</group>
}

const whoIs = (n: NpcSpec, flags: Flags) => {
  const role = pick(n.castIf, flags) ?? n.cast
  return role ? castOf(role) : null
}

type Hit = (e: ThreeEvent<MouseEvent>) => void
type PlacedProps = { p: PropSpec; slot: Slot; ctl: CtlRef; onClick?: Hit; onOver?: Hit; onOut?: () => void; born: Born; delay: number }

function Placed({ p, slot, ctl, onClick, onOver, onOut, born, delay }: PlacedProps) {
  const top = (p.height ?? propHeight(p.model) * (p.scale || 1)) + (p.y || 0)
  const reg = (g: THREE.Group | null) => {
    if (!g) return
    g.userData = { base: [p.at[0], p.y || 0, p.at[1]], rotY: p.rotY || 0, top }
    ctl.current.reg[`${slot}:${propId(p)}`] = g
  }
  return (
    <group ref={reg} position={[p.at[0], p.y || 0, p.at[1]]} rotation={[0, p.rotY || 0, 0]} onClick={onClick} onPointerOver={onOver} onPointerOut={onOut}>
      <Pop born={p.fixed ? null : born} delay={delay}>
        <Suspense fallback={null}>
          {p.stand && <Stand lift={p.y || 0} width={p.stand} />}
          {p.build ? <Built name={p.build} size={p.size} /> : p.item ? <Item name={p.item} /> : p.animal ? <Animal name={p.animal} height={p.height!} /> : p.cutes ? <Fitted model={p.cutes} height={p.height!} /> : <Prop model={p.model!} scale={p.scale || 1} />}
        </Suspense>
      </Pop>
    </group>
  )
}

export const NONE: never[] = []

type Slot = number | string
type DioramaProps = {
  beat: Beat
  slot: Slot
  ctl: CtlRef
  stage?: Stage | null
  onPick?: (i: number) => void
  hover?: number | null
  setHover?: (i: number | null) => void
  lite?: boolean
  extras?: Extra[]
  flags?: Flags
  signs?: Choice[]
  onSign?: (i: number) => void
}

export const Diorama = memo(function Diorama({ beat, slot, ctl, stage, onPick, hover, setHover, lite, extras = NONE, flags = NONE, signs = NONE, onSign }: DioramaProps) {
  const [ox, oz] = originOf(beat.id)
  const set = setOf(beat)
  const labels = useRef<Label[]>([])
  useDeclutter(labels)
  const choosing = stage === 'choose'
  const born = useRef<number | null>(null)
  useEffect(() => {
    if (stage === 'enter' && indoor(beat.id)) born.current = ctl.current.clock?.elapsedTime ?? 0
  }, [stage, beat.id, ctl])
  return (
    <group position={[ox, GROUND, oz]}>
      {!set.ground && (
        <RoundedBox args={[FLOOR.w, 0.4, FLOOR.d]} radius={0.18} position={[0, -0.2, FLOOR.z]} receiveShadow>
          <meshStandardMaterial color={set.floor} roughness={0.85} />
        </RoundedBox>
      )}
      {set.walls && <Walls walls={set.walls} />}
      {beat.doors?.filter((d) => d.to !== 'out').map((d) => (
        <group
          key={d.to}
          position={d.wall ? [d.wall * (FLOOR.w / 2 - WALL.t), 0, d.at!] : [d.at!, 0, FLOOR.z - FLOOR.d / 2 + WALL.t]}
          rotation={[0, d.wall ? (-d.wall * Math.PI) / 2 : 0, 0]}
        >
          <Door trim={set.walls?.trim} />
        </group>
      ))}
      {indoor(beat.id) && (!doorPath(beat.id, 'out') || doorTo(beat, 'out')) && (
        <RoundedBox args={[1.5, 0.04, 0.8]} radius={0.02} position={[0, 0.02, FLOOR.z + FLOOR.d / 2 - 0.55]} receiveShadow>
          <meshStandardMaterial color="#b5574a" roughness={0.95} />
        </RoundedBox>
      )}
      {set.water && (
        <mesh position={[0, 0.04, (set.water.z0 + set.water.z1) / 2]} receiveShadow>
          <boxGeometry args={[FLOOR.w - 0.04, 0.12, set.water.z1 - set.water.z0]} />
          <meshStandardMaterial color={set.water.color} roughness={0.15} metalness={0.1} transparent opacity={0.88} />
        </mesh>
      )}
      {set.decor.map((p, i) => (
        <group key={`d${i}`} position={[p.at[0], p.y || 0, p.at[1]]}>
          <Pop born={born} delay={0.25 + i * 0.05}>
            <Suspense fallback={null}>
              <Prop model={p.model} rotY={p.rotY || 0} scale={p.scale || 1} />
            </Suspense>
          </Pop>
        </group>
      ))}
      {beat.props.map((p, i) => {
        if (!holds(p.when, flags)) return null
        const pick = choosing ? extras.findIndex((c) => c.target === propId(p)) : -1
        return (
          <Placed
            key={i}
            p={p}
            slot={slot}
            ctl={ctl}
            born={born}
            delay={0.1 + i * 0.07}
            onClick={pick >= 0 ? (e) => (e.stopPropagation(), onPick?.(pick)) : undefined}
            onOver={pick >= 0 ? (e) => (e.stopPropagation(), setHover?.(pick)) : undefined}
            onOut={pick >= 0 ? () => setHover?.(null) : undefined}
          />
        )
      })}
      {!lite &&
        beat.npcs
          ?.filter((n) => holds(n.when, flags))
          .map((n) => (
        <Suspense key={n.id} fallback={null}>
          <Npc {...n} look={(whoIs(n, flags)?.look ?? n.look)!} seat={n.sit ? seatHeight(beat.props.find((p) => p.id === n.sit)!.model) : null} name={!stage ? undefined : n.name === true ? whoIs(n, flags)!.name : n.name || undefined} mood={pick(n.moodIf, flags) ?? n.mood} born={born} live={(ctl.current.npcs[`${slot}:${n.id}`] ??= { current: null })} route={(a, b) => routeAround(beat.id, ctl, [ox, oz], a, b)} />
        </Suspense>
      ))}
      {choosing &&
        extras.map((c, i) => <Hotspot key={c.label} beat={beat} choice={c} i={i} hot={hover === i} onPick={onPick!} setHover={setHover!} label={(labels.current[i] ??= {})} />)}
      {choosing &&
        signs.map((c, i) => <DoorSign key={c.label} beat={beat} choice={c} i={i} onPick={onSign!} label={(labels.current[extras.length + i] ??= {})} />)}
    </group>
  )
})

function signAt(beat: Beat, door: string): [number, number, number] {
  const front = FLOOR.z + FLOOR.d / 2 - 0.55
  if (door === 'out') return [0, 0.35, front]
  const d = doorTo(beat, door)!
  return d.wall ? [d.wall * (FLOOR.w / 2 - WALL.t), 2.75, d.at!] : [d.at!, 2.75, FLOOR.z - FLOOR.d / 2 + WALL.t]
}

type SignProps = { beat: Beat; choice: Choice | Extra; i: number; onPick: (i: number) => void; label: Label }

function DoorSign({ beat, choice, i, onPick, label }: SignProps) {
  const at = signAt(beat, choice.door!)
  return (
    <group>
      <object3D
        ref={(o) => {
          label.anchor = o
        }}
        position={at}
      />
      <Html position={at} center zIndexRange={[20, 10]} style={{ pointerEvents: 'none' }}>
        <button
          ref={(el) => {
            label.el = el
          }}
          className="exit-sign door-sign" style={{ animationDelay: `${0.1 + i * 0.08}s` }} onClick={() => onPick(i)}>
          {choice.icon && <span className="exit-icon">{choice.icon}</span>}
          {say(choice.label)}
        </button>
      </Html>
    </group>
  )
}

function Hotspot({ beat, choice, i, hot, setHover, onPick, label }: SignProps & { hot: boolean; setHover: (i: number | null) => void }) {
  const { at, top } = targetOf(beat, choice)
  return (
    <group>
      <object3D
        ref={(o) => {
          label.anchor = o
        }}
        position={[at[0], top, at[1]]}
      />
      <Html position={[at[0], top, at[1]]} center zIndexRange={[20, 10]} style={{ pointerEvents: 'none' }}>
        <button
          ref={(el) => {
            label.el = el
          }}
          className={'hotspot' + (hot ? ' hot' : '')}
          style={{ animationDelay: `${0.15 + i * 0.08}s` }}
          onClick={() => onPick(i)}
          onPointerEnter={() => setHover(i)}
          onPointerLeave={() => setHover(null)}
        >
          <span className="hotspot-key">✦</span>
          {say(choice.label)}
        </button>
      </Html>
    </group>
  )
}
