import { useCallback, useDeferredValue, useEffect, useRef, useState, Suspense, type ChangeEvent, type ReactNode } from 'react'
import { Safe3D } from '../three/Safe3D'
import { Canvas, useFrame, useThree } from '@react-three/fiber'
import { Html } from '@react-three/drei'
import type { Box3, Group, PerspectiveCamera } from 'three'
import { useGame } from '../store'
import { Character } from '../three/Character'
import { ShipBay } from '../three/ShipBay'
import { Effects } from '../three/Effects'
import { Quality, GL } from '../three/Quality'
import { Warmup, useCanvasGone } from '../three/warm'
import { preloadPresets } from '../three/preload'
import { NameAsk, CornerButtons } from './Ask'
import {
  PRESETS, BODIES, HEADS, SHOES, SKIN_TONES, COLOR_SLOTS, EYEWEAR, HEADGEAR, FACE,
  presetAvatar, randomAvatar, outfitsFor, fitOutfit, type Avatar, type Colors, type Named,
} from '../data/models'

const GROUND = -1.25
const SLOT = Object.fromEntries(COLOR_SLOTS.map(([k, label, colors]) => [k, { label, colors }]))

function Spinner({ children }: { children: ReactNode }) {
  const ref = useRef<Group>(null!)
  const el = useThree((s) => s.gl.domElement)
  const st = useRef({ drag: false, x: 0, v: 0, idle: 0 })
  useEffect(() => {
    const s = st.current
    const down = (e: PointerEvent) => {
      s.drag = true
      s.x = e.clientX
      s.v = 0
      el.setPointerCapture(e.pointerId)
    }
    const move = (e: PointerEvent) => {
      if (!s.drag) return
      const d = (e.clientX - s.x) * 0.012
      s.x = e.clientX
      ref.current.rotation.y += d
      s.v = d
      s.idle = 0
    }
    const up = () => {
      s.drag = false
    }
    el.addEventListener('pointerdown', down)
    el.addEventListener('pointermove', move)
    el.addEventListener('pointerup', up)
    el.addEventListener('pointercancel', up)
    return () => {
      el.removeEventListener('pointerdown', down)
      el.removeEventListener('pointermove', move)
      el.removeEventListener('pointerup', up)
      el.removeEventListener('pointercancel', up)
    }
  }, [el])
  useFrame((_, dt) => {
    const s = st.current
    const g = ref.current
    if (s.drag) return
    if (Math.abs(s.v) > 1e-4) {
      g.rotation.y += s.v
      s.v *= Math.pow(0.04, dt)
      return
    }
    s.idle += dt
    if (s.idle > 1.6) {
      const front = Math.round(g.rotation.y / (2 * Math.PI)) * 2 * Math.PI
      g.rotation.y += (front - g.rotation.y) * (1 - Math.pow(0.03, dt))
    }
  })
  return <group ref={ref}>{children}</group>
}

function usePointerLook() {
  const look = useRef<{ x: number; y: number } | null>(null)
  useEffect(() => {
    if (!window.matchMedia('(hover: hover) and (pointer: fine)').matches) return
    const move = (e: PointerEvent) => {
      look.current = e.pointerType === 'mouse' && !e.buttons ? { x: e.clientX, y: e.clientY } : null
    }
    const leave = () => {
      look.current = null
    }
    window.addEventListener('pointermove', move)
    document.documentElement.addEventListener('pointerleave', leave)
    window.addEventListener('blur', leave)
    return () => {
      window.removeEventListener('pointermove', move)
      document.documentElement.removeEventListener('pointerleave', leave)
      window.removeEventListener('blur', leave)
    }
  }, [])
  return look
}

const RAIL_X = 1.25
function Framing() {
  const camera = useThree((s) => s.camera) as PerspectiveCamera
  const size = useThree((s) => s.size)
  useEffect(() => {
    const t = Math.tan(((camera.fov / 2) * Math.PI) / 180)
    const narrow = size.width < 640
    const half = narrow ? RAIL_X + 0.35 : RAIL_X + 1.8
    camera.position.set(0, 0.5, Math.max(7, half / (t * (size.width / size.height))))
    camera.lookAt(0, 0.5, 0)
  }, [camera, size])
  return null
}

function cycle(options: Named[], value: string, step: number) {
  const i = Math.max(0, options.findIndex(([k]) => k === value))
  return options[(i + step + options.length) % options.length][0]
}

function ColorDot({ slot, value, open, onOpen, onPick }: { slot: keyof Colors; value: string | null; open: boolean; onOpen: () => void; onPick: (c: string | null) => void }) {
  const { label, colors } = SLOT[slot]
  return (
    <div className="dot-wrap">
      <button
        className={'color-dot' + (value == null ? ' original' : '') + (open ? ' open' : '')}
        style={value ? { background: value } : undefined}
        aria-label={`${label} color`}
        onClick={onOpen}
      />
      {open && (
        <div className="palette" role="listbox" aria-label={`${label} color`}>
          <button className={'swatch original' + (value == null ? ' sel' : '')} aria-label="Original color" onClick={() => onPick(null)} />
          {colors.map((c) => (
            <button key={c} className={'swatch' + (value === c ? ' sel' : '')} style={{ background: c }} aria-label={c} onClick={() => onPick(c)} />
          ))}
        </div>
      )}
    </div>
  )
}

type RailProps = { y: number; x: number; label: string; options: Named[]; value: string; onChange: (v: string) => void; children?: ReactNode }

function Rail({ y, x, label, options, value, onChange, children }: RailProps) {
  const name = options.find(([k]) => k === value)?.[1] ?? '—'
  return (
    <>
      <Html position={[-x, y, 0]} zIndexRange={[20, 10]} wrapperClass="rail-anchor">
        <div className="rail rail-left">
          <div className="rail-text">
            <span className="rail-label">{label}</span>
            <span className="rail-value">{name}</span>
          </div>
          <button className="arrow" aria-label={`Previous ${label}`} onClick={() => onChange(cycle(options, value, -1))}>
            ‹
          </button>
        </div>
      </Html>
      <Html position={[x, y, 0]} zIndexRange={[20, 10]} wrapperClass="rail-anchor">
        <div className="rail rail-right">
          <button className="arrow" aria-label={`Next ${label}`} onClick={() => onChange(cycle(options, value, 1))}>
            ›
          </button>
          {children && <div className="rail-extras">{children}</div>}
        </div>
      </Html>
    </>
  )
}

function Rails({ head, slots, onPhoto }: { head?: Box3; slots?: Set<string>; onPhoto: () => void }) {
  const avatar = useGame((s) => s.avatar)
  const updateAvatar = useGame((s) => s.updateAvatar)
  const setColor = useGame((s) => s.setAvatarColor)
  const narrow = useThree((s) => s.size.width < 640)
  const [open, setOpen] = useState<keyof Colors | null>(null)
  if (!head) return null

  const x = narrow ? RAIL_X - 0.1 : RAIL_X
  const top = head.max.y
  const mid = (head.max.y + head.min.y) / 2
  const h = head.max.y - head.min.y
  const dots = (keys: (keyof Colors)[]) =>
    keys
      .filter((k) => slots?.has(k))
      .map((k) => (
        <ColorDot
          key={k}
          slot={k}
          value={avatar.colors[k]}
          open={open === k}
          onOpen={() => setOpen(open === k ? null : k)}
          onPick={(c) => setColor(k, c)}
        />
      ))
  const set = (key: 'headgear' | 'head' | 'eyewear' | 'face' | 'outfit' | 'shoes') => (v: string) => updateAvatar({ [key]: v })

  return (
    <>
      <Rail y={top + 0.02} x={x} label="Hat" options={HEADGEAR} value={avatar.headgear} onChange={set('headgear')} />
      <Rail y={mid + 0.22 * h} x={x} label="Head" options={HEADS} value={avatar.head} onChange={set('head')}>
        {dots(['hair', 'hair2'])}
      </Rail>
      <Rail y={mid - 0.04 * h} x={x} label="Eyes" options={EYEWEAR} value={avatar.eyewear} onChange={set('eyewear')} />
      <Rail y={mid - 0.3 * h} x={x} label="Face" options={FACE} value={avatar.face} onChange={set('face')}>
        <button className={'photo-btn' + (avatar.photo ? ' on' : '')} onClick={onPhoto} aria-label="Face photo">
          {avatar.photo ? '✕' : '📷'}
          <span className="photo-word"> photo</span>
        </button>
      </Rail>
      <Rail y={(GROUND + head.min.y) / 2 + 0.12} x={x} label="Outfit" options={outfitsFor(avatar.body)} value={avatar.outfit} onChange={set('outfit')}>
        {dots(['top', 'top2'])}
      </Rail>
      <Rail y={GROUND + 0.16} x={x} label="Shoes" options={SHOES} value={avatar.shoes} onChange={set('shoes')}>
        {dots(['shoes'])}
      </Rail>
    </>
  )
}

const PHOTO = 640
async function shrink(file: File) {
  const img = await createImageBitmap(file)
  const k = Math.min(1, PHOTO / Math.max(img.width, img.height))
  const c = document.createElement('canvas')
  c.width = Math.round(img.width * k)
  c.height = Math.round(img.height * k)
  c.getContext('2d')!.drawImage(img, 0, 0, c.width, c.height)
  img.close()
  return c.toDataURL('image/webp', 0.85)
}

export default function Builder() {
  const avatar = useGame((s) => s.avatar)
  const shown = useDeferredValue(avatar)
  const updateAvatar = useGame((s) => s.updateAvatar)
  const setPhase = useGame((s) => s.setPhase)
  const reset = useGame((s) => s.reset)
  const [naming, setNaming] = useState(false)
  const fileRef = useRef<HTMLInputElement>(null)
  const [info, setInfo] = useState<{ headBox: Box3; slots: Set<string> } | null>(null)
  const look = usePointerLook()
  const [warm, setWarm] = useState(0)
  const ready = warm > 0
  const onReady = useCallback(() => setWarm(1), [])
  const onShown = useCallback(() => setWarm(2), [])
  useCanvasGone()
  useEffect(preloadPresets, [])

  const onFile = (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    e.target.value = ''
    if (file) shrink(file).then((photo) => updateAvatar({ photo }))
  }
  const onPhoto = () => (avatar.photo ? updateAvatar({ photo: null }) : fileRef.current?.click())
  const keep: Partial<Avatar> = { photo: avatar.photo }

  return (
    <section className="builder">
      <Safe3D>
        <Canvas className="builder-canvas" shadows camera={{ position: [0, 0.5, 7], fov: 38 }} dpr={[1, 2]} gl={GL} frameloop={ready ? 'always' : 'never'}>
          {warm < 2 && info && <Warmup onReady={onReady} onShown={onShown} />}
          <Framing />
          <ShipBay groundY={GROUND} />
          <Suspense fallback={null}>
            <Spinner>
              <Character avatar={shown} onReady={setInfo} look={look} />
            </Spinner>
            <Rails head={info?.headBox} slots={info?.slots} onPhoto={onPhoto} />
          </Suspense>
          <Effects toy bloom={0.2} vignette={false} />
          <Quality />
        </Canvas>
      </Safe3D>
      {warm < 2 && <div className="warming" aria-label="Loading" />}
      <input ref={fileRef} type="file" accept="image/*" onChange={onFile} hidden />

      <header className="builder-top">
        <div className="hud hud-left">
          <div className="hud-title">Build your disguise</div>
          <div className="seg">
            {BODIES.map(([k, name]) => (
              <button key={k} className={'seg-btn' + (avatar.body === k ? ' sel' : '')} onClick={() => updateAvatar({ body: k, outfit: fitOutfit(k, avatar.outfit) })}>
                {name}
              </button>
            ))}
          </div>
          <div className="swatches" aria-label="Skin tone">
            {SKIN_TONES.map((c) => (
              <button
                key={c}
                className={'swatch sm' + (avatar.skin === c ? ' sel' : '')}
                style={{ background: c }}
                aria-label={`Skin ${c}`}
                onClick={() => updateAvatar({ skin: c })}
              />
            ))}
          </div>
        </div>
        <div className="hud hud-right">
          <select
            className="preset"
            value=""
            aria-label="Start from a preset"
            onChange={(e) => e.target.value && updateAvatar(presetAvatar(e.target.value, keep))}
          >
            <option value="">Start from…</option>
            {PRESETS.map(([k, name]) => (
              <option key={k} value={k}>
                {name}
              </option>
            ))}
          </select>
          <button className="dice-btn" onClick={() => updateAvatar(randomAvatar(keep))} aria-label="Randomize">
            🎲 Randomize
          </button>
        </div>
      </header>

      <footer className="builder-bottom">
        <div className="stage-hint">drag to spin</div>
        <button className="primary-btn" onClick={() => setNaming(true)}>
          Begin assessment &rarr;
        </button>
      </footer>
      <CornerButtons className="corner-low" restart="Start over from the very beginning? This disguise goes too." onRestart={reset} />
      {naming && <NameAsk onDone={() => setPhase('story')} onClose={() => setNaming(false)} />}
    </section>
  )
}
