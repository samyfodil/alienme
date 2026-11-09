import { Suspense, useEffect, useMemo, useRef, useState, type RefObject } from 'react'
import { Safe3D } from '../three/Safe3D'
import { Canvas, useFrame, useThree } from '@react-three/fiber'
import * as THREE from 'three'
import { useGame } from '../store'
import { Character } from '../three/Character'
import { ShipBay } from '../three/ShipBay'
import { Effects } from '../three/Effects'
import { Quality, GL } from '../three/Quality'
import { useCanvasGone } from '../three/warm'
import { ALIENS } from '../data/aliens'
import { shareCard, shareGif, shareFile, download, SITE, WINDOW_TALL } from '../share'
import { KoFi } from './KoFi'
import { prepareHeads } from '../three/AlienHeads'

const GROUND = -1.25
const T_SHAKE = 1.6
const T_POP = 2.6
const T_LAND = 3.7
const T_DONE = 3.9
const DEV = new URLSearchParams(import.meta.env.DEV ? window.location.search : '')
const HOLD = Number(DEV.get('hold')) || 0

const _v = new THREE.Vector3()
const smooth = (x: number) => {
  const t = Math.min(1, Math.max(0, x))
  return t * t * (3 - 2 * t)
}

function Burst({ at, origin, colors }: { at: number; origin: THREE.Vector3; colors: string[] }) {
  const ref = useRef<THREE.InstancedMesh>(null!)
  const N = 70
  const parts = useMemo(
    () =>
      Array.from({ length: N }, () => ({
        v: new THREE.Vector3((Math.random() - 0.5) * 6, 2 + Math.random() * 5, (Math.random() - 0.3) * 4),
        r: new THREE.Vector3(Math.random() * 9, Math.random() * 9, 0),
        s: 0.05 + Math.random() * 0.08,
      })),
    [],
  )
  const dummy = useMemo(() => new THREE.Object3D(), [])
  useEffect(() => {
    const c = new THREE.Color()
    for (let i = 0; i < N; i++) ref.current.setColorAt(i, c.set(colors[i % colors.length]))
    ref.current.instanceColor!.needsUpdate = true
  }, [colors])
  useFrame(({ clock }) => {
    const t = clock.elapsedTime - at
    parts.forEach((p, i) => {
      dummy.position.set(
        origin.x + p.v.x * t,
        Math.max(GROUND + 0.03, origin.y + p.v.y * t - 6 * t * t),
        origin.z + p.v.z * t,
      )
      dummy.rotation.set(p.r.x * t, p.r.y * t, 0)
      dummy.scale.setScalar(t < 2.2 ? p.s : Math.max(0.0001, p.s * (1 - (t - 2.2) * 2)))
      dummy.updateMatrix()
      ref.current.setMatrixAt(i, dummy.matrix)
    })
    ref.current.instanceMatrix.needsUpdate = true
  })
  return (
    <instancedMesh ref={ref} args={[undefined, undefined, N]} castShadow>
      <boxGeometry args={[1, 1, 0.25]} />
      <meshStandardMaterial roughness={0.4} emissiveIntensity={0.4} />
    </instancedMesh>
  )
}

function subjectTop(subject: THREE.Object3D | null, headBox: THREE.Box3 | null) {
  const box = new THREE.Box3()
  subject?.traverse((o) => {
    if (o instanceof THREE.Mesh && !(o instanceof THREE.SkinnedMesh) && o.visible) box.expandByObject(o)
  })
  return Math.max(box.isEmpty() ? -Infinity : box.max.y, headBox?.max.y ?? 1.4)
}

function freeRect(canvas: HTMLCanvasElement, card: HTMLElement | null) {
  const c = canvas.getBoundingClientRect()
  const r = card?.getBoundingClientRect()
  if (!r) return { W: c.width, H: c.height, x: 0, y: 0, w: c.width, h: c.height }
  const side = r.left - c.left > c.width * 0.4
  return side
    ? { W: c.width, H: c.height, x: 0, y: 0, w: r.left - c.left - 16, h: c.height }
    : { W: c.width, H: c.height, x: 0, y: 0, w: c.width, h: r.top - c.top - 8 }
}

type HeadBox = { current: THREE.Box3 | null }
type DirectorProps = {
  onPop: (now: number) => void
  onLand: () => void
  onDone: () => void
  shakeRef: RefObject<THREE.Group>
  headBox: HeadBox
  cardRef: RefObject<HTMLDivElement>
}

function Director({ onPop, onLand, onDone, shakeRef, headBox, cardRef }: DirectorProps) {
  const start = useRef<number | null>(null)
  const fired = useRef<Record<string, boolean>>({})
  const look = useMemo(() => new THREE.Vector3(), [])
  const gl = useThree((s) => s.gl)
  useFrame(({ clock, camera: c }) => {
    const camera = c as THREE.PerspectiveCamera
    const now = clock.elapsedTime
    if (start.current === null) start.current = now + HOLD
    const t = now - start.current
    const once = (k: string, fn: (now: number) => void) => {
      if (!fired.current[k]) {
        fired.current[k] = true
        fn(now)
      }
    }
    if (t >= T_POP) once('pop', onPop)
    if (t >= T_LAND) once('land', onLand)
    if (t >= T_DONE) once('done', onDone)

    const e = smooth(t / T_POP)
    const after = smooth((t - T_POP) / 2.5)
    camera.position.set(Math.sin(t * 0.35) * 0.5, 0.2 + e * 0.5 + after * 0.5, 8 - e * 2.6 + after * 0.8)
    look.set(0, 0.1 + e * 0.35 + after * 0.15, 0)

    const f = smooth((t - T_DONE) / 1.1)
    if (f > 0) {
      const top = subjectTop(shakeRef.current, headBox.current)
      const fr = freeRect(gl.domElement, cardRef.current)
      const span = (top - GROUND) * 1.18
      const fit = Math.max(span * (fr.H / fr.h), span * 0.62 * (fr.W / fr.w) * (fr.H / fr.W))
      const d = fit / (2 * Math.tan((camera.fov * Math.PI) / 360))
      const cy = GROUND + (top - GROUND) / 2
      camera.position.lerp(_v.set(Math.sin(t * 0.35) * 0.35, cy + 0.35, d), f)
      look.lerp(_v.set(0, cy, 0), f)
      const ox = fr.W / 2 - (fr.x + fr.w / 2)
      const oy = fr.H / 2 - (fr.y + fr.h / 2)
      camera.setViewOffset(fr.W, fr.H, ox * f, oy * f, fr.W, fr.H)
    }
    camera.lookAt(look)

    const k = t > T_SHAKE && t < T_POP ? (t - T_SHAKE) / (T_POP - T_SHAKE) : 0
    const g = shakeRef.current
    if (g) {
      g.rotation.z = Math.sin(t * 70) * 0.07 * k
      g.rotation.x = Math.sin(t * 53) * 0.04 * k
      g.position.x = Math.sin(t * 61) * 0.06 * k
      g.scale.set(1 + 0.08 * k * Math.sin(t * 40), 1 - 0.08 * k * Math.sin(t * 40), 1)
    }
  })
  return null
}

const SNAP_PX = 1400
const SNAP_SETTLE = 3
type Shot = () => Promise<HTMLCanvasElement>

function Snapshot({ api, subject, headBox }: { api: { current: Shot | null }; subject: RefObject<THREE.Group>; headBox: HeadBox }) {
  const camera = useThree((s) => s.camera) as THREE.PerspectiveCamera
  const gl = useThree((s) => s.gl)
  const setDpr = useThree((s) => s.setDpr)
  const req = useRef<((shot: HTMLCanvasElement) => void) | null>(null)
  const saved = useRef<{ p: THREE.Vector3; q: THREE.Quaternion; view: THREE.PerspectiveCamera['view'] } | null>(null)
  const wait = useRef(0)
  const dpr = useRef(1)
  useEffect(() => {
    api.current = () =>
      new Promise<HTMLCanvasElement>((resolve) => {
        const { width, height } = gl.domElement.getBoundingClientRect()
        dpr.current = gl.getPixelRatio()
        setDpr(Math.min(3, Math.max(dpr.current, SNAP_PX / Math.min(width, height))))
        wait.current = SNAP_SETTLE
        req.current = resolve
      })
  }, [api, gl, setDpr])
  const crop = () => {
    const { width: W, height: H } = gl.domElement
    const w = Math.min(W, H)
    return { W, H, w, h: w }
  }
  useFrame(() => {
    if (!req.current || wait.current-- > 0) return
    saved.current = { p: camera.position.clone(), q: camera.quaternion.clone(), view: camera.view?.enabled ? { ...camera.view } : null }
    camera.clearViewOffset()
    const top = subjectTop(subject.current, headBox.current)
    const span = ((top - GROUND) * 1.22) / WINDOW_TALL
    const center = GROUND + (top - GROUND) * 0.5
    const { H, h } = crop()
    const d = (span * (H / h)) / (2 * Math.tan((camera.fov * Math.PI) / 360))
    camera.position.set(0.9, center + 0.6, d)
    camera.lookAt(0, center, 0)
  }, 0.5)
  useFrame(() => {
    if (!saved.current) return
    const { W, H, w, h } = crop()
    const out = document.createElement('canvas')
    out.width = out.height = SNAP_PX
    out.getContext('2d')!.drawImage(gl.domElement, (W - w) / 2, (H - h) / 2, w, h, 0, 0, SNAP_PX, SNAP_PX)
    camera.position.copy(saved.current.p)
    camera.quaternion.copy(saved.current.q)
    const v = saved.current.view
    if (v) camera.setViewOffset(v.fullWidth, v.fullHeight, v.offsetX, v.offsetY, v.width, v.height)
    saved.current = null
    setDpr(dpr.current)
    const resolve = req.current!
    req.current = null
    resolve(out)
  }, 2)
  return null
}

const GIF_STEP = 0.09
const GIF_FROM = 0.5
const GIF_TO = T_LAND + 0.8
const GIF_PX = 360
type Frames = { t: number; image: HTMLCanvasElement }[]
type Film = { frames: Frames; finished: boolean; done: Promise<Frames>; resolve: (frames: Frames) => void }

function Recorder({ film }: { film: { current: Film } }) {
  const gl = useThree((s) => s.gl)
  const start = useRef<number | null>(null)
  const next = useRef(GIF_FROM)
  useFrame(({ clock, camera }) => {
    const f = film.current
    if (start.current === null) start.current = clock.elapsedTime + HOLD
    const t = clock.elapsedTime - start.current
    if (f.finished || t < next.current) return
    if (t > GIF_TO) {
      f.finished = true
      return f.resolve(f.frames)
    }
    next.current = Math.max(next.current + GIF_STEP, t + GIF_STEP / 2)
    const { width: W, height: H } = gl.domElement
    const side = Math.min(W, H)
    _v.set(0, GROUND + 1.25, 0).project(camera)
    const cx = Math.min(W - side / 2, Math.max(side / 2, ((_v.x + 1) / 2) * W))
    const cy = Math.min(H - side / 2, Math.max(side / 2, ((1 - _v.y) / 2) * H))
    const image = document.createElement('canvas')
    image.width = image.height = GIF_PX
    image.getContext('2d')!.drawImage(gl.domElement, cx - side / 2, cy - side / 2, side, side, 0, 0, GIF_PX, GIF_PX)
    f.frames.push({ t, image })
  }, 2)
  return null
}

const slug = (t: string) => t.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')

export default function Reveal() {
  const avatar = useGame((s) => s.avatar)
  const name = useGame((s) => s.name)
  const restart = useGame((s) => s.restart)
  const [winner] = useState(() => useGame.getState().winner())
  useCanvasGone()
  const a = ALIENS[winner]
  useEffect(() => prepareHeads({ [winner]: a.color }), [winner, a.color])

  const [popAt, setPopAt] = useState<number | null>(null)
  const [landed, setLanded] = useState(false)
  const [done, setDone] = useState(false)
  const [msg, setMsg] = useState('')
  const [toast, setToast] = useState('')
  const headBox = useRef<THREE.Box3 | null>(null)
  const shakeRef = useRef<THREE.Group>(null)
  const snap = useRef<Shot | null>(null)
  const cardRef = useRef<HTMLDivElement>(null)
  const [shotAt, setShotAt] = useState<number | null>(null)
  const [making, setMaking] = useState(false)
  const film = useRef<Film>(null!)
  if (!film.current) {
    let resolve!: Film['resolve']
    const done = new Promise<Frames>((r) => (resolve = r))
    film.current = { frames: [], finished: false, done, resolve }
  }

  useEffect(() => {
    const seq: [number, string][] = [
      [HOLD * 1000 + 200, 'INITIATING SPECIES VERIFICATION…'],
      [HOLD * 1000 + 1100, 'SCANNING BIOMETRIC DISGUISE…'],
      [(HOLD + T_SHAKE) * 1000, '⚠ DISGUISE INTEGRITY FAILING'],
    ]
    const timers = seq.map(([t, m]) => setTimeout(() => setMsg(m), t))
    return () => timers.forEach(clearTimeout)
  }, [])

  const fileName = (ext: string) => ['alienme', slug(name), slug(a.name)].filter(Boolean).join('-') + ext
  const say = (text: string) => {
    setToast(text)
    setTimeout(() => setToast(''), 2600)
  }
  const savePicture = async () => {
    setShotAt(Date.now())
    await download(
      snap.current!().then((render) => shareCard(render, a, name)),
      fileName('.png'),
    )
    say('Picture saved')
  }
  const share = async () => {
    if (making) return
    setMaking(true)
    try {
      const frames = await film.current.done
      const gif = await shareGif(frames, a, name, T_POP)
      const how = await shareFile(gif, fileName('.gif'), `Turns out I'm ${a.name}. Find out what you really are: ${SITE}`)
      if (how === 'saved') say('GIF saved')
    } finally {
      setMaking(false)
    }
  }

  const origin = headBox.current ? headBox.current.getCenter(new THREE.Vector3()) : new THREE.Vector3(0, 0.6, 0)

  return (
    <section className="screen reveal" style={{ '--alien': a.color, '--alien-accent': a.accent }}>
      <div className="stage-full">
        <Safe3D>
          <Canvas shadows camera={{ position: [0, 0.2, 8], fov: 38 }} dpr={[1, 2]} gl={GL}>
            <ShipBay groundY={GROUND} />
            {popAt && <pointLight position={[0, 1.6, 2.2]} intensity={1.2} color={a.color} decay={0} />}
            <Suspense fallback={null}>
              <group ref={shakeRef}>
                <Character
                  avatar={avatar}
                  alien={winner}
                  revealed={!!popAt}
                  clip={popAt && !landed ? 'Jump' : 'Idle'}
                  groundY={GROUND}
                  onReady={(info) => {
                    if (info?.headBox) headBox.current = info.headBox
                  }}
                />
              </group>
              {popAt && <Character avatar={avatar} headOnly throwAt={popAt} groundY={GROUND} />}
            </Suspense>
            {popAt && <Burst at={popAt} origin={origin} colors={[a.color, a.accent, '#ffffff', '#ffe14d']} />}
            <Director
              shakeRef={shakeRef}
              onPop={(now) => {
                setPopAt(now)
                setMsg('')
              }}
              onLand={() => setLanded(true)}
              onDone={() => setDone(true)}
              headBox={headBox}
              cardRef={cardRef}
            />
            <Snapshot api={snap} subject={shakeRef} headBox={headBox} />
            <Recorder film={film} />
            <Effects toy bloom={popAt ? 0.45 : 0.2} vignette={false} />
            <Quality />
          </Canvas>
        </Safe3D>
      </div>

      {popAt && <div className="reveal-flash" key={popAt} />}
      {shotAt && <div className="shot-flash" key={shotAt} />}
      {!done && msg && <div className="reveal-msg">{msg}</div>}

      {done && (
        <div className="result-wrap">
          <div className="result-card" ref={cardRef}>
            <div className="result-kicker">{name ? <><b>{name}</b>'s true form</> : 'Your true form'}</div>
            <div className="result-name">{a.name}</div>
            <div className="result-title">{a.title}</div>
            <p className="result-tagline">{a.tagline}</p>
            <p className="result-blurb">{a.blurb}</p>
            <div className="result-actions">
              <button className="primary-btn" onClick={share} disabled={making}>
                {making ? 'Making your GIF…' : 'Share my GIF'}
              </button>
              <button className="ghost-btn" onClick={savePicture}>
                Save picture
              </button>
              <button className="ghost-btn" onClick={restart}>
                Run again
              </button>
            </div>
          </div>
        </div>
      )}

      <footer className="reveal-foot">
        <KoFi />
      </footer>

      {toast && <div className="toast">{toast}</div>}
    </section>
  )
}
