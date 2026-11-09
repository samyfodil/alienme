import { useRef, useMemo, useEffect, useCallback, useState } from 'react'
import { useFrame } from '@react-three/fiber'
import { Html } from '@react-three/drei'
import type { CalculatePosition } from '@react-three/drei/web/Html'
import * as THREE from 'three'
import { GROUND } from './stage'
import { useLook } from './look'
import { say } from './cast'
import type { CtlRef } from './ctl'
import type { Option } from './types'

const PUFFS = 40

const PUFF_LIFE = 0.65

type Puff = { at: THREE.Vector3; size: number; t0: number }

export function Puffs({ ctl }: { ctl: CtlRef }) {
  const mesh = useRef<THREE.InstancedMesh>(null)
  const list = useRef<Puff[]>([])
  const m = useMemo(() => new THREE.Matrix4(), [])
  const v = useMemo(() => new THREE.Vector3(), [])
  const q = useMemo(() => new THREE.Quaternion(), [])
  const sc = useMemo(() => new THREE.Vector3(), [])
  useEffect(() => {
    ctl.current.puff = (at, size = 1) => {
      if (!useLook.getState().puffs) return
      list.current.push({ at, size, t0: ctl.current.clock?.elapsedTime ?? 0 })
      if (list.current.length > PUFFS) list.current.shift()
    }
  }, [ctl])
  useFrame(({ clock }) => {
    if (!mesh.current) return
    const now = clock.elapsedTime
    list.current = list.current.filter((p) => now - p.t0 < PUFF_LIFE)
    for (let i = 0; i < PUFFS; i++) {
      const p = list.current[i]
      if (!p) {
        mesh.current.setMatrixAt(i, m.makeScale(0, 0, 0))
        continue
      }
      const k = (now - p.t0) / PUFF_LIFE
      const r = p.size * 0.28 * (0.4 + k) * (1 - k * k)
      mesh.current.setMatrixAt(i, m.compose(v.copy(p.at).setY(p.at.y + k * 0.35), q, sc.setScalar(Math.max(r, 0.001))))
    }
    mesh.current.instanceMatrix.needsUpdate = true
  })
  return (
    <instancedMesh ref={mesh} args={[undefined, undefined, PUFFS]} frustumCulled={false}>
      <sphereGeometry args={[1, 10, 8]} />
      <meshStandardMaterial color="#fff4ea" roughness={1} transparent opacity={0.85} />
    </instancedMesh>
  )
}

const HUD_BOTTOM = 92
const SAY_GAP = 14
const THINK_GAP = 64
const PUFF_OUT = 16
const HEAD_GAP = 110
const SIDE_WIDTH = 420
const SIDE_MIN = 240
const OVER_HEAD = 1.5
const clamp = (v: number, lo: number, hi: number) => Math.min(Math.max(v, lo), hi)
const _p = new THREE.Vector3()
const _at = new THREE.Vector3()

type Where = { low?: number; box: { current: HTMLDivElement | null }; think?: boolean; who?: string }

function useOverHead(ctl: CtlRef, { low = 0, box, think, who }: Where) {
  const g = useRef<THREE.Group>(null)
  const lift = useRef<THREE.Vector3 | null>(null)
  const last = useRef(0)
  const overH = useRef(0)
  const place = useCallback<CalculatePosition>(
    (el, camera, size) => {
      const c = ctl.current
      const w = who ? c.npcs[who]?.who : undefined
      const body = who ? w?.group : c.group
      const head = (who ? w?.layer.rig : c.rig)?.bones.Head
      const t = performance.now()
      const dt = Math.min(0.1, (t - last.current) / 1000)
      last.current = t
      if (body) {
        body.updateWorldMatrix(true, false)
        _at.setFromMatrixPosition(body.matrixWorld)
        if (head) {
          head.updateWorldMatrix(true, false)
          head.getWorldPosition(_p).sub(_at)
          _p.y += OVER_HEAD
        } else _p.set(0, GROUND + 3 - _at.y, 0)
        if (lift.current) lift.current.lerp(_p, 1 - Math.exp(-dt * 6))
        else lift.current = _p.clone()
        _p.copy(_at).add(lift.current)
        // Html's visibility checks read the world matrix; update it first or the first check sees the origin.
        g.current?.position.copy(_p)
        g.current?.updateMatrixWorld(true)
      } else _p.setFromMatrixPosition(el.matrixWorld)
      _p.project(camera)
      const x = (_p.x * 0.5 + 0.5) * size.width
      const y = (-_p.y * 0.5 + 0.5) * size.height
      const b = box.current
      if (!b) return [Math.round(x), Math.round(y)]
      let at: [number, number] | undefined
      let rect!: Rect
      if (think) {
        if (!b.dataset.side) overH.current = b.offsetHeight
        const roomRight = size.width - x - HEAD_GAP - PUFF_OUT - 16
        const roomLeft = x - HEAD_GAP - PUFF_OUT - 16
        const room = Math.min(SIDE_WIDTH, Math.max(roomLeft, roomRight))
        const over = y - overH.current - THINK_GAP - PUFF_OUT - (b.dataset.side ? 30 : 0) >= HUD_BOTTOM
        if (!over && room >= SIDE_MIN) {
          const right = roomRight >= roomLeft
          b.dataset.side = right ? 'right' : 'left'
          b.style.maxWidth = `${room}px`
          const w = b.offsetWidth
          const h = b.offsetHeight
          const cy = clamp(y + 40, HUD_BOTTOM + PUFF_OUT + h / 2, size.height - h / 2 - PUFF_OUT)
          const bx = right ? x + HEAD_GAP : x - HEAD_GAP
          at = [bx, cy]
          rect = [right ? bx : bx - w, cy - h / 2, w, h]
        } else {
          delete b.dataset.side
          b.style.maxWidth = ''
        }
      }
      if (!at) {
        const w = b.offsetWidth
        const h = b.offsetHeight
        const gap = think ? THINK_GAP : SAY_GAP
        const top = think ? HUD_BOTTOM + PUFF_OUT + h + gap : Math.max(low, HUD_BOTTOM + h + gap)
        const edge = w / 2 + 16 + (think ? PUFF_OUT : 0)
        const bx = clamp(x, edge, size.width - edge)
        const by = clamp(y, top, size.height - 24)
        at = [bx, by]
        rect = [bx - w / 2, by - gap - h, w, h]
      }
      if (think) trail(b, rect, x, y)
      else b.style.setProperty('--tail', `${clamp(x - rect[0], 22, rect[2] - 22)}px`)
      return [Math.round(at[0]), Math.round(at[1])]
    },
    [ctl, low, box, think, who],
  )
  return [g, place] as const
}

type Rect = [left: number, top: number, w: number, h: number]

function trail(b: HTMLElement, [left, top, w, h]: Rect, x: number, y: number) {
  const hx = x - left
  const hy = y - top
  const ax = clamp(hx, 26, w - 26)
  const ay = clamp(hy, 20, h - 20)
  const dx = hx - ax
  const dy = hy - ay
  const len = Math.hypot(dx, dy)
  const dots = b.querySelectorAll<HTMLElement>('.think-dot')
  if (len < 1) return dots.forEach((d) => (d.style.display = 'none'))
  const tx = dx > 0 ? (w - ax) / dx : dx < 0 ? -ax / dx : Infinity
  const ty = dy > 0 ? (h - ay) / dy : dy < 0 ? -ay / dy : Infinity
  const from = Math.min(tx, ty, 1) + (PUFF_OUT + 6) / len
  const to = Math.max(from, 1 - 18 / len)
  dots.forEach((d, i) => {
    const s = from + ((to - from) * i) / (dots.length - 1)
    d.style.display = ''
    d.style.left = `${ax + dx * s}px`
    d.style.top = `${ay + dy * s}px`
  })
}

export function Say({ ctl, text, who }: { ctl: CtlRef; text: string; who?: string }) {
  const box = useRef<HTMLDivElement>(null)
  const [g, place] = useOverHead(ctl, { low: 165, box, who })
  return (
    <group ref={g}>
      <Html calculatePosition={place} zIndexRange={[45, 35]} style={{ pointerEvents: 'none' }}>
        <div className="say" key={text} ref={box}>
          {text}
        </div>
      </Html>
    </group>
  )
}

export type Asked = { prompt: string; options: (Option & { gone?: boolean })[] }
type Asking = { ctl: CtlRef; menu: Asked; onPick: (i: number) => void }

export function Speak({ ctl, who, menu, onPick }: Asking & { who: string }) {
  const box = useRef<HTMLDivElement>(null)
  const [g, place] = useOverHead(ctl, { low: 165, box, who })
  return (
    <group ref={g}>
      <Html calculatePosition={place} zIndexRange={[45, 35]} style={{ pointerEvents: 'none' }}>
        <div className="say say-menu" key={menu.prompt} ref={box}>
          <div className="say-prompt">{say(menu.prompt)}</div>
          <div className="say-options">
            {menu.options.map((o, j) => (
              <button key={o.label} className="say-option" disabled={o.gone} style={{ animationDelay: `${0.15 + j * 0.06}s` }} onClick={() => onPick(j)}>
                {o.icon && <span className="think-icon">{o.icon}</span>}
                {say(o.label)}
              </button>
            ))}
          </div>
        </div>
      </Html>
    </group>
  )
}

const CLOUD: [string, string, number][] = [
  ['14%', '6px', 44],
  ['36%', '4px', 56],
  ['60%', '6px', 50],
  ['84%', '8px', 42],
  ['22%', 'calc(100% - 6px)', 46],
  ['46%', 'calc(100% - 4px)', 54],
  ['70%', 'calc(100% - 6px)', 48],
  ['90%', 'calc(100% - 10px)', 36],
  ['8px', '32%', 40],
  ['6px', '68%', 44],
  ['calc(100% - 8px)', '30%', 42],
  ['calc(100% - 6px)', '66%', 46],
]

export function Think({ ctl, menu, onPick }: Asking) {
  const box = useRef<HTMLDivElement>(null)
  const [g, place] = useOverHead(ctl, { box, think: true })
  return (
    <group ref={g}>
      <Html calculatePosition={place} zIndexRange={[45, 35]} style={{ pointerEvents: 'none' }}>
        <div className="think" key={menu.prompt} ref={box}>
          <span className="think-dot" />
          <span className="think-dot" />
          <span className="think-dot" />
          <div className="think-cloud" aria-hidden="true">
            {CLOUD.map(([left, top, s]) => (
              <i key={left + top} style={{ left, top, width: s, height: s }} />
            ))}
          </div>
          <div className="think-prompt">{say(menu.prompt)}</div>
          <div className="think-options">
            {menu.options.map((o, j) => (
              <button key={o.label} className="think-option" style={{ animationDelay: `${0.1 + j * 0.06}s` }} onClick={() => onPick(j)}>
                {o.icon && <span className="think-icon">{o.icon}</span>}
                {say(o.label)}
              </button>
            ))}
          </div>
        </div>
      </Html>
    </group>
  )
}

type Emote = { id: number; text: string; at: [number, number, number]; kind?: string }

export function Emotes({ ctl }: { ctl: CtlRef }) {
  const [list, setList] = useState<Emote[]>([])
  const n = useRef(0)
  useEffect(() => {
    ctl.current.emit = (text, at, kind) => {
      const id = ++n.current
      setList((l) => [...l.slice(-24), { id, text, at: at.toArray() as Emote['at'], kind }])
      setTimeout(() => setList((l) => l.filter((e) => e.id !== id)), kind === 'banner' ? 2400 : 1500)
    }
  }, [ctl])
  return list.map((e) => (
    <Html key={e.id} position={e.at} center zIndexRange={[40, 30]}>
      <div className={e.kind === 'banner' ? 'banner-pop' : 'emote'}>{e.text}</div>
    </Html>
  ))
}
