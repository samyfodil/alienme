import { Suspense, useLayoutEffect, useMemo, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import { RoundedBox } from '@react-three/drei'
import * as THREE from 'three'
import { BLOCK, COLS, ROWS, INSIDE_LAWN, SHORE, COAST, COAST_STILL, PROMENADE, PLACES, coastAt } from '../data/city'
import { useLook } from '../story/look'
import { Prop } from './Prop'

const GROUND = -1.25
const EDGE = { x0: COLS[0] - BLOCK.w, x1: COLS[COLS.length - 1] + BLOCK.w, z0: ROWS[0] - 20, z1: ROWS[ROWS.length - 1] + 20 }

type Tunnel = { from: [number, number]; dir: [number, number]; len: number }
const TUNNELS: Tunnel[] = [
  { from: [EDGE.x0, 8], dir: [-1, 0], len: 30 },
  { from: [10, EDGE.z0], dir: [0, -1], len: 28 },
  { from: [-50, EDGE.z1], dir: [0, 1], len: 28 },
]
const rand = (seed: number) => {
  let s = seed
  return () => (s = (s * 16807) % 2147483647) / 2147483647
}
const endOf = (t: Tunnel) => [t.from[0] + t.dir[0] * t.len, t.from[1] + t.dir[1] * t.len]

function hills() {
  const out = TUNNELS.map((t) => {
    const end = endOf(t)
    return { at: [end[0] + t.dir[0] * 12, end[1] + t.dir[1] * 12], r: 22, h: 24 }
  })
  const next = rand(7)
  ;[0, 1, 2].forEach((layer) => {
    const off = 30 + layer * 28
    const step = 20 + layer * 6
    const pts = []
    for (let x = EDGE.x0 - off; x <= EDGE.x1 - 20; x += step) pts.push([x, EDGE.z0 - off], [x, EDGE.z1 + off])
    for (let z = EDGE.z0 - off + step; z < EDGE.z1 + off; z += step) pts.push([EDGE.x0 - off, z])
    for (const [x, z] of pts) out.push({ at: [x + (next() - 0.5) * 14, z + (next() - 0.5) * 14], r: 16 + layer * 7 + next() * 8, h: 8 + layer * 8 + next() * 8 })
  })
  return out
}
const HILLS = hills()

function heightAt(x: number, z: number) {
  let h = 0
  for (const m of HILLS) {
    const d2 = ((x - m.at[0]) ** 2 + (z - m.at[1]) ** 2) / (m.r * m.r)
    if (d2 < 9) h += m.h * Math.exp(-1.6 * d2)
  }
  h = 34 * (1 - Math.exp(-h / 34))
  const out = Math.max(EDGE.x0 - x, x - EDGE.x1, EDGE.z0 - z, z - EDGE.z1)
  h *= smooth(out, 6, 26) * (1 - smooth(x, EDGE.x1 - 50, EDGE.x1 - 5))
  for (const t of TUNNELS) {
    const along = (x - t.from[0]) * t.dir[0] + (z - t.from[1]) * t.dir[1]
    const side = Math.abs((x - t.from[0]) * t.dir[1] - (z - t.from[1]) * t.dir[0])
    h *= 1 - (1 - smooth(side, 4, 22)) * (1 - smooth(along, t.len - 1, t.len + 7))
  }
  return h
}
function smooth(v: number, a: number, b: number) {
  const t = Math.min(1, Math.max(0, (v - a) / (b - a)))
  return t * t * (3 - 2 * t)
}

function axis(a: number, b: number, c0: number, c1: number, fine: number, coarse: number, near: number) {
  const out: number[] = []
  for (let x = a; x < b - fine / 2; ) {
    out.push(x)
    x += Math.min(coarse, fine + Math.max(0, Math.max(c0 - x, x - c1) - near) * 0.08)
  }
  out.push(b)
  return out
}

function grid(xs: number[], zs: number[]) {
  const pos: number[] = []
  const idx: number[] = []
  for (const z of zs) for (const x of xs) pos.push(x, 0, z)
  const w = xs.length
  for (let r = 0; r < zs.length - 1; r++)
    for (let c = 0; c < w - 1; c++) {
      const a = r * w + c
      idx.push(a, a + w, a + 1, a + 1, a + w, a + w + 1)
    }
  const g = new THREE.BufferGeometry()
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3))
  g.setIndex(idx)
  return g
}

const COAST_ROWS = axis(-700, 700, EDGE.z0, EDGE.z1, 2.5, 10, 60)

const LAND = { x0: -360, x1: EDGE.x1 + 5, z0: -360, z1: 360 }
function landGeometry() {
  const g = grid(axis(LAND.x0, LAND.x1, EDGE.x0, EDGE.x1, 2.5, 12, 50), axis(LAND.z0, LAND.z1, EDGE.z0, EDGE.z1, 2.5, 12, 50))
  const pos = g.attributes.position
  const col: number[] = []
  const low = new THREE.Color('#9fcf86')
  const mid = new THREE.Color('#7fc493')
  const top = new THREE.Color('#c4e8a8')
  const c = new THREE.Color()
  for (let i = 0; i < pos.count; i++) {
    const h = heightAt(pos.getX(i), pos.getZ(i))
    pos.setY(i, h - 0.2 * smooth(pos.getX(i), EDGE.x1, LAND.x1))
    const k = Math.min(1, h / 30)
    c.copy(low).lerp(mid, smooth(k, 0, 0.35)).lerp(top, smooth(k, 0.45, 1))
    col.push(c.r, c.g, c.b)
  }
  g.setAttribute('color', new THREE.Float32BufferAttribute(col, 3))
  g.computeVertexNormals()
  return g
}

function Tunnel({ from, dir, len }: Tunnel) {
  const end = [from[0] + dir[0] * len, from[1] + dir[1] * len]
  const mid = [(from[0] + end[0]) / 2, (from[1] + end[1]) / 2]
  const along = Math.atan2(dir[0], dir[1])
  return (
    <group>
      <mesh position={[mid[0], GROUND - 0.025, mid[1]]} rotation={[0, along, 0]} receiveShadow>
        <boxGeometry args={[4, 0.04, len]} />
        <meshStandardMaterial color="#6f6a82" roughness={0.95} />
      </mesh>
      {Array.from({ length: Math.floor(len / 3) }, (_, i) => (
        <mesh key={i} position={[from[0] + dir[0] * (i * 3 + 1.5), GROUND - 0.0, from[1] + dir[1] * (i * 3 + 1.5)]} rotation={[0, along, 0]}>
          <boxGeometry args={[0.18, 0.02, 1.4]} />
          <meshBasicMaterial color="#fff4dc" />
        </mesh>
      ))}
      <group position={[end[0], GROUND, end[1]]} rotation={[0, along + Math.PI, 0]}>
        <mesh position={[0, 0, 0.05]}>
          <circleGeometry args={[3, 32, 0, Math.PI]} />
          <meshBasicMaterial color="#231a35" side={THREE.DoubleSide} />
        </mesh>
        <RoundedBox args={[12, 8, 2]} radius={0.7} smoothness={3} position={[0, 2.6, -1.2]}>
          <meshStandardMaterial color="#d9c9b4" roughness={0.9} />
        </RoundedBox>
        <mesh position={[0, 0, 0.2]}>
          <torusGeometry args={[3.4, 0.5, 12, 32, Math.PI]} />
          <meshStandardMaterial color="#e9dccb" roughness={0.8} />
        </mesh>
        {[-1, 1].map((s) => (
          <mesh key={s} position={[s * 3.4, 0.3, 0.2]}>
            <boxGeometry args={[1.05, 0.6, 1.05]} />
            <meshStandardMaterial color="#e9dccb" roughness={0.8} />
          </mesh>
        ))}
      </group>
    </group>
  )
}

const SAND = { x0: EDGE.x1, x1: SHORE + 40 }
const COAST_RANGE = COAST.reduce((s, [a]) => s + a, 0)
function sandGeometry() {
  const g = grid(axis(SAND.x0, SAND.x1, SHORE - COAST_RANGE - 7, SHORE + COAST_RANGE + 3, 0.7, 4, 0), COAST_ROWS)
  const pos = g.attributes.position
  const dry = new THREE.Color('#f5e2b8')
  const wet = new THREE.Color('#d8bd8a')
  const deep = new THREE.Color('#b9a57c')
  const c = new THREE.Color()
  const col = []
  for (let i = 0; i < pos.count; i++) {
    const k = coastAt(pos.getZ(i)) - pos.getX(i)
    pos.setY(i, k > 0 ? -0.12 + 0.09 * smooth(k, 0, 6) : Math.max(-3, -0.12 + k * 0.12))
    c.copy(dry).lerp(wet, 1 - smooth(k, 0.5, 3.5)).lerp(deep, 1 - smooth(k, -6, 0))
    col.push(c.r, c.g, c.b)
  }
  g.setAttribute('color', new THREE.Float32BufferAttribute(col, 3))
  g.computeVertexNormals()
  return g
}

const WASH = { mid: -0.45, amp: 1.0, rate: 0.7 }
const COAST_GLSL = `
  float coast(float z) {
    float t = clamp((abs(z - ${COAST_STILL.z.toFixed(1)}) - ${COAST_STILL.from.toFixed(1)}) / ${(COAST_STILL.to - COAST_STILL.from).toFixed(1)}, 0.0, 1.0);
    return ${SHORE.toFixed(1)} + (${COAST.map(([a, f, p]) => `${a.toFixed(2)} * sin(z * ${f.toFixed(4)} + ${p.toFixed(2)})`).join(' + ')}) * t * t * (3.0 - 2.0 * t);
  }
  float washPhase(float z, float t) { return t * ${WASH.rate.toFixed(2)} + z * 0.05; }
  float wash(float z, float t) { return ${WASH.mid.toFixed(2)} - sin(washPhase(z, t)) * ${WASH.amp.toFixed(2)}; }`

const TIME = { value: 0 }

function sandMaterial() {
  const m = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 1 })
  m.onBeforeCompile = (s) => {
    s.uniforms.time = TIME
    s.vertexShader = s.vertexShader
      .replace('#include <common>', '#include <common>\nvarying vec2 vSandXZ;')
      .replace('#include <project_vertex>', '#include <project_vertex>\nvSandXZ = (modelMatrix * vec4(transformed, 1.0)).xz;')
    s.fragmentShader = s.fragmentShader
      .replace('#include <common>', `#include <common>\nvarying vec2 vSandXZ;\nuniform float time;\n${COAST_GLSL}`)
      .replace(
        '#include <color_fragment>',
        `#include <color_fragment>
        {
          float d = vSandXZ.x - coast(vSandXZ.y);
          float c = (${WASH.mid.toFixed(2)} - d) / ${WASH.amp.toFixed(2)};
          float wet = c <= -1.0 ? 1.0 : 0.0;
          if (c > -1.0 && c < 1.0) {
            float under = PI - 2.0 * asin(c);
            float since = mod(washPhase(vSandXZ.y, time) - (PI - asin(c)), PI2);
            wet = since > PI2 - under ? 1.0 : exp(-since / ${WASH.rate.toFixed(2)} / 2.4);
          }
          diffuseColor.rgb *= mix(1.0, 0.72, wet);
        }`,
      )
  }
  return m
}

function seaGeometry() {
  const cols = 60
  const g = grid(Array.from({ length: cols + 1 }, (_, c) => 700 * (c / cols) ** 2.2), COAST_ROWS)
  const pos = g.attributes.position
  for (let i = 0; i < pos.count; i++) pos.setX(i, pos.getX(i) + coastAt(pos.getZ(i)) - 1.7)
  return g
}

function Sea() {
  const mat = useMemo(
    () =>
      new THREE.ShaderMaterial({
        fog: true,
        transparent: true,
        depthWrite: false,
        uniforms: THREE.UniformsUtils.merge([THREE.UniformsLib.fog, { time: { value: 0 } }]),
        vertexShader: `
          #include <fog_pars_vertex>
          uniform float time;
          varying vec2 vXZ;
          varying float vH;
          ${COAST_GLSL}
          void main() {
            vec3 p = position;
            float d = p.x - coast(p.z);
            float h = sin(p.x * 0.18 - time * 1.6) * 0.3 + sin(p.z * 0.13 + time * 0.9) * 0.2;
            p.y += h * smoothstep(2.0, 14.0, d);
            vH = clamp(h, -1.0, 1.0);
            vXZ = p.xz;
            vec4 mvPosition = modelViewMatrix * vec4(p, 1.0);
            gl_Position = projectionMatrix * mvPosition;
            #include <fog_vertex>
          }`,
        fragmentShader: `
          #include <fog_pars_fragment>
          uniform float time;
          varying vec2 vXZ;
          varying float vH;
          ${COAST_GLSL}
          void main() {
            float d = vXZ.x - coast(vXZ.y);
            // How far the water reaches up the sand right now.
            float e = d - wash(vXZ.y, time);
            if (e < 0.0) discard;
            vec3 c = mix(vec3(0.55, 0.9, 0.88), vec3(0.38, 0.68, 0.88), smoothstep(0.0, 90.0, d));
            c += vH * 0.1;
            float s = sin(d * 0.42 + time * 2.0 + sin(vXZ.y * 0.07) * 2.0);
            float foam = smoothstep(0.93, 0.985, s) * smoothstep(1.5, 4.0, d) * (1.0 - smoothstep(4.0, 45.0, d));
            float edge = 1.0 - smoothstep(0.06, 0.4, e);
            c = mix(c, vec3(1.0), max(foam * 0.8, edge));
            float a = max(mix(0.45, 1.0, smoothstep(0.3, 12.0, d)), edge) * smoothstep(0.0, 0.05, e);
            gl_FragColor = vec4(pow(clamp(c, 0.0, 1.0), vec3(2.2)), a);
            #include <colorspace_fragment>
            #include <fog_fragment>
          }`,
      }),
    [],
  )
  const geo = useMemo(seaGeometry, [])
  mat.uniforms.time = TIME
  useFrame(({ clock }) => (TIME.value = clock.elapsedTime))
  return <mesh geometry={geo} material={mat} position={[0, GROUND - 0.06, 0]} />
}

const WALK = { ...PROMENADE, z: 700, kerb: 0.45, joint: 2.5, every: 24, along: [-74, 74] }
const WALK_W = WALK.x1 - WALK.x0
const WALK_X = (WALK.x0 + WALK.x1) / 2
const WALK_TOP = GROUND - 0.012
const along = (from: number) => {
  const out: number[] = []
  const [a, b] = WALK.along
  for (let z = from - Math.floor((from - a) / WALK.every) * WALK.every; z <= b; z += WALK.every) out.push(z)
  return out
}
const LAMPS = along(PLACES.beach.at[1])
const BENCHES = along(PLACES.beach.at[1] + WALK.every / 2)

function Promenade() {
  const pastel = useLook((s) => s.townPastel)
  const joints = useRef<THREE.InstancedMesh>(null!)
  const n = Math.floor((2 * WALK.z) / WALK.joint)
  useLayoutEffect(() => {
    const m = new THREE.Matrix4()
    for (let i = 0; i < n; i++) joints.current.setMatrixAt(i, m.makeTranslation(WALK_X, WALK_TOP + 0.002, -WALK.z + (i + 0.5) * WALK.joint))
    joints.current.instanceMatrix.needsUpdate = true
  }, [n])
  return (
    <group>
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[WALK_X, WALK_TOP, 0]} receiveShadow>
        <planeGeometry args={[WALK_W, 2 * WALK.z]} />
        <meshStandardMaterial color="#efe3d1" roughness={0.9} />
      </mesh>
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[WALK_X, WALK_TOP + 0.001, 0]} receiveShadow>
        <planeGeometry args={[1.2, 2 * WALK.z]} />
        <meshStandardMaterial color="#ecc9b4" roughness={0.9} />
      </mesh>
      <instancedMesh ref={joints} args={[undefined, undefined, n]} receiveShadow>
        <boxGeometry args={[WALK_W - 2 * WALK.kerb, 0.004, 0.07]} />
        <meshStandardMaterial color="#ddcbb5" roughness={0.9} />
      </instancedMesh>
      {[WALK.x0 + WALK.kerb / 2, WALK.x1 - WALK.kerb / 2].map((x) => (
        <mesh key={x} position={[x, WALK_TOP + 0.02, 0]} receiveShadow castShadow>
          <boxGeometry args={[WALK.kerb, 0.08, 2 * WALK.z]} />
          <meshStandardMaterial color="#d3c1ab" roughness={0.9} />
        </mesh>
      ))}
      <Suspense fallback={null}>
        {LAMPS.map((z) => (
          <Prop key={`l${z}`} model="city/street-light" at={[WALK.x1 - 0.7, z]} y={GROUND} rotY={Math.PI / 2} pastel={pastel} />
        ))}
        {BENCHES.map((z) => (
          <Prop key={`b${z}`} model="city/bench" at={[WALK.x1 - 1.5, z]} y={GROUND} rotY={Math.PI / 2} pastel={pastel} />
        ))}
      </Suspense>
    </group>
  )
}

export function Land() {
  const land = useMemo(landGeometry, [])
  const sand = useMemo(sandGeometry, [])
  const sandMat = useMemo(sandMaterial, [])
  return (
    <group>
      <mesh geometry={land} position={[0, GROUND - 0.06, 0]} receiveShadow>
        <meshStandardMaterial vertexColors roughness={1} />
      </mesh>
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[(EDGE.x1 - 1400) / 2, GROUND - 0.1, 0]}>
        <planeGeometry args={[EDGE.x1 + 1400, 2400]} />
        <meshStandardMaterial color="#9fcf86" roughness={1} />
      </mesh>
      <mesh geometry={sand} material={sandMat} position={[0, GROUND, 0]} receiveShadow />
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[SHORE + 18 + 600, GROUND - 3, 0]}>
        <planeGeometry args={[1200, 2400]} />
        <meshBasicMaterial color="#5aa7b8" />
      </mesh>
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[(INSIDE_LAWN.x0 + INSIDE_LAWN.x1) / 2, GROUND - 0.1, (INSIDE_LAWN.z0 + INSIDE_LAWN.z1) / 2]}>
        <planeGeometry args={[INSIDE_LAWN.x1 - INSIDE_LAWN.x0, INSIDE_LAWN.z1 - INSIDE_LAWN.z0]} />
        <meshStandardMaterial color="#9fcf86" roughness={1} />
      </mesh>
      {TUNNELS.map((t, i) => (
        <Tunnel key={i} {...t} />
      ))}
      <Promenade />
      <Sea />
    </group>
  )
}
