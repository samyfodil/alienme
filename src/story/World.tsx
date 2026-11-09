import { useRef, useMemo, useEffect } from 'react'
import { useFrame, useThree } from '@react-three/fiber'
import * as THREE from 'three'
import { skyAt, originOf } from '../data/city'
import { GROUND, setOf, _v3, _c } from './stage'
import { useLook } from './look'
import { BEAT } from './engine'
import { LOANS } from '../three/lamps'
import type { CtlRef } from './ctl'
import type { Point, Time } from './types'

type V3 = [number, number, number]

const STARS = 46

export function Backdrop({ ctl }: { ctl: CtlRef }) {
  const g = useRef<THREE.Group>(null)
  const stars = useRef<THREE.InstancedMesh>(null!)
  const clouds = useRef<THREE.Group>(null!)
  const dome = useMemo(
    () =>
      new THREE.ShaderMaterial({
        side: THREE.BackSide,
        depthWrite: false,
        fog: false,
        uniforms: { top: { value: new THREE.Color('#8a74c8') }, mid: { value: new THREE.Color('#5e4a96') }, bottom: { value: new THREE.Color('#3e3170') } },
        vertexShader: 'varying vec3 vP; void main() { vP = normalize(position); gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }',
        fragmentShader:
          'uniform vec3 top; uniform vec3 mid; uniform vec3 bottom; varying vec3 vP; void main() { float h = vP.y; vec3 c = h > 0.0 ? mix(mid, top, smoothstep(0.0, 0.7, h)) : mix(mid, bottom, smoothstep(0.0, 0.5, -h)); gl_FragColor = vec4(c, 1.0); }',
      }),
    [],
  )
  const spots = useMemo(() => {
    let seed = 3
    const rnd = () => ((seed = (seed * 16807) % 2147483647) / 2147483647)
    return Array.from({ length: STARS }, (): [number, number, number, number, number] => {
      const a = rnd() * Math.PI * 2
      const r = 26 + rnd() * 16
      return [Math.cos(a) * r, -18 + rnd() * 40, Math.sin(a) * r - 6, rnd() * 6, 0.14 + rnd() * 0.18]
    })
  }, [])
  const m = useMemo(() => new THREE.Matrix4(), [])
  useFrame(({ clock }) => {
    const c = ctl.current
    const on = ((!!c.indoor && c.cam?.mode === 'room') || c.landInside != null) && useLook.getState().backdrop
    if (!g.current) return
    g.current.visible = on
    if (!on) return
    const [x, z] = c.cameraAt
    g.current.position.set(x, GROUND, z)
    const t = clock.elapsedTime
    spots.forEach(([sx, sy, sz, ph, s], i) => {
      const tw = s * (0.6 + 0.4 * Math.sin(t * 2.2 + ph * 3))
      stars.current.setMatrixAt(i, m.makeScale(tw, tw, tw).setPosition(sx, sy, sz))
    })
    stars.current.instanceMatrix.needsUpdate = true
    clouds.current.children.forEach((cl, i) => {
      cl.position.x = ((t * (0.5 + i * 0.15) + i * 23) % 80) - 40
    })
  })
  return (
    <group ref={g} visible={false}>
      <mesh material={dome} renderOrder={-10}>
        <sphereGeometry args={[60, 32, 16]} />
      </mesh>
      <instancedMesh ref={stars} args={[undefined, undefined, STARS]} frustumCulled={false}>
        <octahedronGeometry args={[1, 0]} />
        <meshBasicMaterial color="#fff2b8" fog={false} toneMapped={false} />
      </instancedMesh>
      <group ref={clouds}>
        {[
          [-8, 12, -30, 1.6],
          [6, 17, -34, 2.1],
          [18, 9, -28, 1.3],
          [-22, 6, -24, 1.8],
        ].map(([x, y, z, s], i) => (
          <group key={i} position={[x, y, z]} scale={s}>
            {[
              [0, 0, 0, 1.4],
              [1.5, -0.2, 0, 1.0],
              [-1.4, -0.3, 0, 1.1],
              [0.6, 0.7, 0, 0.9],
            ].map(([px, py, pz, r], k) => (
              <mesh key={k} position={[px, py, pz]}>
                <sphereGeometry args={[r, 16, 12]} />
                <meshBasicMaterial color="#b7a5e6" transparent opacity={0.5} fog={false} depthWrite={false} />
              </mesh>
            ))}
          </group>
        ))}
      </group>
    </group>
  )
}

const ROOM_ASPECT = 1.5

export function CameraRig({ ctl }: { ctl: CtlRef }) {
  const look = useMemo(() => new THREE.Vector3(), [])
  const pos = useMemo(() => new THREE.Vector3(), [])
  const want = useMemo(() => new THREE.Vector3(), [])
  const wantLook = useMemo(() => new THREE.Vector3(), [])
  const ready = useRef(false)
  useFrame(({ camera, pointer, size }, dt) => {
    const c = ctl.current
    const cam = c.cam
    const fit = Math.max(1, ROOM_ASPECT / (size.width / size.height))
    let rate = 0.03
    if (cam.mode === 'shot') {
      want.copy(cam.pos)
      wantLook.copy(cam.look)
      rate = cam.rate ?? 0.02
    } else if (cam.mode === 'map') {
      const [x, z] = cam.follow && c.group ? [c.group.position.x, c.group.position.z] : cam.at!
      const h = cam.h || 26
      wantLook.set(x, GROUND, z)
      want.set(x + pointer.x * 1.5, GROUND + h + pointer.y * 0.8, z + h * (cam.tilt ?? 0.75))
      rate = 0.06
    } else {
      const [cx, cz] = c.cameraAt
      const f = c.focus
      if (f) {
        const side = f[0] > cx ? -1 : 1
        const up = f[2] || 0
        const back = fit ** 0.85
        if (f[3]) {
          wantLook.set(f[0], GROUND + 0.6, f[1] - 0.2)
          want.set(f[0] + side * 1.2, GROUND + 0.6 + 5.6 * back, f[1] - 0.2 + 4.4 * back)
        } else {
          wantLook.set(f[0], GROUND + 1.0 + up, f[1])
          want.set(f[0] + side * 1.6, GROUND + 1.0 + up + 2.5 * back, f[1] + 6.4 * back)
        }
        rate = 0.08
      } else {
        wantLook.set(cx, -1, cz - 1.2)
        want.set(cx + pointer.x * 0.6, -1 + (6.4 + pointer.y * 0.25) * fit ** 1.25, cz - 1.2 + 12.8 * fit ** 0.85)
      }
    }
    if (!ready.current || cam.cut || pos.distanceTo(want) > 150) {
      pos.copy(want)
      look.copy(wantLook)
      ready.current = true
      cam.cut = false
    }
    const k = 1 - Math.pow(rate, dt)
    pos.lerp(want, k)
    look.lerp(wantLook, k)
    camera.position.copy(pos)
    camera.lookAt(look)
    c.lookAt = look
  })
  return null
}

export function Sky({ ctl, time }: { ctl: CtlRef; time: Time }) {
  const scene = useThree((s) => s.scene)
  const want = useMemo(() => new THREE.Color(), [])
  useFrame((_, dt) => {
    const mode = ctl.current.cam?.mode
    if ((ctl.current.indoor && mode === 'room') || ctl.current.landInside != null) want.set('#4a3a78')
    else {
      const sky = skyAt(time)
      if (Array.isArray(sky)) want.set(sky[0]).lerp(new THREE.Color(sky[1]), sky[2])
      else want.set(sky)
    }
    if (!(scene.background instanceof THREE.Color)) scene.background = want.clone()
    const k = 1 - Math.pow(0.1, dt)
    scene.background.lerp(want, k)
    const f = scene.fog as THREE.Fog | null
    if (!f) return
    f.color.copy(scene.background)
    const [near, far] = mode === 'room' ? [30, 80] : [160, 600]
    f.near += (near - f.near) * k
    f.far += (far - f.far) * k
  })
  return <fog attach="fog" args={['#000', 30, 80]} />
}

const ROOM_LAMPS = 4

type Lamp = { at: V3; color: string; power: number; reach: number }

export function RoomLights({ room, ctl }: { room: string | null; ctl: CtlRef }) {
  const lamps = useRef<THREE.PointLight[]>([])
  useFrame((_, dt) => {
    const set = room && setOf(BEAT[room])
    const [ox, oz] = room ? originOf(room) : [0, 0]
    const spots: Lamp[] = set ? [{ at: [0, 5, 2], color: set.light, power: 18, reach: 14 }, ...(set.lights || []).map((l) => ({ ...l, power: 10, reach: 8 }))] : []
    const loans = [...LOANS]
    lamps.current.forEach((l, i) => {
      const s = spots.at(i)
      const loan = !s && loans[i - spots.length]
      if (loan) {
        l.position.copy(loan.pos)
        l.color.copy(loan.color)
        l.distance = loan.reach
        l.intensity = loan.power
        return
      }
      const want = s ? s.power * (ctl.current.dim ?? 1) : 0
      l.intensity += (want - l.intensity) * (1 - Math.pow(0.02, dt))
      if (!s) return
      l.position.set(ox + s.at[0], GROUND + s.at[1], oz + s.at[2])
      l.color.set(s.color)
      l.distance = s.reach
    })
  })
  return Array.from({ length: ROOM_LAMPS }, (_, i) => <pointLight key={i} ref={(l) => l && (lamps.current[i] = l)} intensity={0} />)
}

const SUNRISE = 6

const SUNSET = 19.5

const _warm = new THREE.Color('#ff7a30')

const _noon = new THREE.Color('#ffe9cc')

function daylight(time: Time): { dir: V3; color: THREE.Color; sun: number; ambient: number; hemi: number; sky: string } {
  const [h, m] = time.split(':').map(Number)
  const t = h + m / 60
  const day = (t - SUNRISE) / (SUNSET - SUNRISE)
  if (day <= 0 || day >= 1)
    return { dir: [-4, 10, 7], color: new THREE.Color('#7f98ff'), sun: 0.3, ambient: 0.08, hemi: 0.12, sky: '#3a4a8a' }
  const arc = day * Math.PI
  const up = Math.sin(arc)
  return {
    dir: [Math.cos(arc) * 11, 2 + up * 10, 6],
    color: _warm.clone().lerp(_noon, Math.min(1, up * 1.1)),
    sun: 0.9 + up * 0.8,
    ambient: 0.32 + up * 0.35,
    hemi: 0.25 + up * 0.3,
    sky: up < 0.4 ? '#ffb27a' : '#bcd4ff',
  }
}

function figure(walking: boolean) {
  const c = document.createElement('canvas')
  c.width = c.height = 128
  const g = c.getContext('2d')!
  g.fillStyle = '#fff'
  g.strokeStyle = '#fff'
  g.lineCap = 'round'
  g.beginPath()
  g.arc(64, 22, 13, 0, Math.PI * 2)
  g.fill()
  g.lineWidth = 20
  const line = (pts: Point[]) => {
    g.beginPath()
    g.moveTo(...pts[0])
    pts.slice(1).forEach((p) => g.lineTo(...p))
    g.stroke()
  }
  if (walking) {
    line([[62, 46], [58, 78]])
    g.lineWidth = 12
    line([[58, 80], [40, 116]])
    line([[58, 80], [74, 96], [84, 118]])
    line([[60, 50], [42, 70]])
    line([[60, 50], [80, 64], [90, 52]])
  } else {
    line([[64, 46], [64, 78]])
    g.lineWidth = 12
    line([[58, 80], [56, 118]])
    line([[70, 80], [72, 118]])
    line([[54, 50], [46, 82]])
    line([[74, 50], [82, 82]])
  }
  const t = new THREE.CanvasTexture(c)
  t.colorSpace = THREE.SRGBColorSpace
  return t
}

const LAMP_DONT = { color: '#ff4a3a', off: '#3a1512' }

const LAMP_WALK = { color: '#f4f7ff', off: '#2a2d33' }

export function Signal({ ctl, kerb, far, dir }: { ctl: CtlRef; kerb: Point; far: Point; dir: number }) {
  const maps = useMemo(() => [figure(false), figure(true)], [])
  const mats = useRef<(THREE.MeshBasicMaterial | null)[]>([])
  useFrame(() => {
    const go = ctl.current.signal === 'walk'
    mats.current.forEach((m, k) => {
      if (!m) return
      const [lamp, lit] = k % 2 ? [LAMP_WALK, go] : [LAMP_DONT, !go]
      m.color.set(lit ? lamp.color : lamp.off)
    })
  })
  const side = [Math.cos(dir) * 1.1, -Math.sin(dir) * 1.1]
  return [kerb, far].map(([x, z], i) => (
    <group key={i} position={[x + side[0], GROUND, z + side[1]]} rotation={[0, dir + (i ? Math.PI : 0), 0]}>
      <mesh position={[0, 1.2, 0]} castShadow>
        <cylinderGeometry args={[0.06, 0.06, 2.4, 10]} />
        <meshStandardMaterial color="#3a3f48" />
      </mesh>
      <mesh position={[0, 2.55, 0]} castShadow>
        <boxGeometry args={[0.46, 0.86, 0.3]} />
        <meshStandardMaterial color="#22262d" />
      </mesh>
      {[2.76, 2.34].map((y, k) => (
        <mesh key={k} position={[0, y, 0.152]}>
          <planeGeometry args={[0.36, 0.36]} />
          <meshBasicMaterial
            ref={(m) => {
              mats.current[i * 2 + k] = m
            }}
            map={maps[k]} transparent toneMapped={false} />
        </mesh>
      ))}
    </group>
  ))
}

export function SceneLights({ ctl, time }: { ctl: CtlRef; time: Time }) {
  const sun = useRef<THREE.DirectionalLight | null>(null)
  const amb = useRef<THREE.AmbientLight | null>(null)
  const hemi = useRef<THREE.HemisphereLight | null>(null)
  const reg = (l: THREE.Light | null) => {
    if (!l || ctl.current.lights.includes(l)) return
    l.userData.base = l.intensity
    ctl.current.lights.push(l)
  }
  const dir = useMemo(() => new THREE.Vector3(6, 10, 6), [])
  useFrame((_, dt) => {
    const l = sun.current
    const at = ctl.current.lookAt
    if (!l || !at) return
    const d = daylight(time)
    const k = 1 - Math.pow(0.15, dt)
    dir.lerp(_v3.set(...d.dir), k)
    l.position.copy(at).add(dir)
    l.target.position.copy(at)
    l.target.updateMatrixWorld()
    l.color.lerp(d.color, k)
    hemi.current?.color.lerp(_c.set(d.sky), k)
    for (const [light, want] of [[l, d.sun], [amb.current, d.ambient], [hemi.current, d.hemi]] as [THREE.Light | null, number][]) {
      if (!light) continue
      light.userData.base += (want - light.userData.base) * k
      light.intensity = light.userData.base
    }
  })
  return (
    <>
      <ambientLight
        ref={(l) => {
          amb.current = l
          reg(l)
        }}
        color="#fff0e6"
        intensity={0.55}
      />
      <directionalLight
        ref={(l) => {
          sun.current = l
          reg(l)
        }}
        intensity={1.6}
        castShadow
        shadow-mapSize={[2048, 2048]}
      >
        <orthographicCamera attach="shadow-camera" args={[-30, 30, 30, -30, 0.5, 60]} />
      </directionalLight>
      <hemisphereLight
        ref={(l) => {
          hemi.current = l
          reg(l)
        }}
        args={['#bcd4ff', '#6b4a72', 0.5]}
      />
    </>
  )
}

export function Clock({ ctl }: { ctl: CtlRef }) {
  const clock = useThree((s) => s.clock)
  const gl = useThree((s) => s.gl)
  const camera = useThree((s) => s.camera)
  const scene = useThree((s) => s.scene)
  useEffect(() => {
    ctl.current.clock = clock
    if (import.meta.env.DEV) Object.assign(ctl.current, { gl, camera, scene })
  }, [clock, gl, camera, scene, ctl])
  return null
}
