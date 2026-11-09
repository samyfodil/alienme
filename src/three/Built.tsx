import { useMemo, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'

const TILE = '#d7e8ee'
const CHROME = { color: '#c9d1d8', metalness: 0.7, roughness: 0.25 }

function Shower() {
  return (
    <group>
      <mesh position={[0, 0.04, 0]} receiveShadow>
        <boxGeometry args={[1.3, 0.08, 1.3]} />
        <meshStandardMaterial color="#f4f6f7" roughness={0.4} />
      </mesh>
      <mesh position={[0, 1.25, -0.65]} castShadow receiveShadow>
        <boxGeometry args={[1.3, 2.5, 0.06]} />
        <meshStandardMaterial color={TILE} roughness={0.5} />
      </mesh>
      <mesh position={[-0.65, 1.25, 0]} castShadow receiveShadow>
        <boxGeometry args={[0.06, 2.5, 1.3]} />
        <meshStandardMaterial color={TILE} roughness={0.5} />
      </mesh>
      <mesh position={[0.65, 1.1, 0]}>
        <boxGeometry args={[0.03, 2.1, 1.3]} />
        <meshStandardMaterial color="#cfefff" transparent opacity={0.22} roughness={0.05} depthWrite={false} />
      </mesh>
      <mesh position={[0, 1.85, -0.6]}>
        <cylinderGeometry args={[0.025, 0.025, 1.3, 10]} />
        <meshStandardMaterial {...CHROME} />
      </mesh>
      <mesh position={[0, 2.5, -0.35]} rotation={[Math.PI / 2, 0, 0]}>
        <cylinderGeometry args={[0.025, 0.025, 0.5, 10]} />
        <meshStandardMaterial {...CHROME} />
      </mesh>
      <mesh position={[0, 2.46, -0.1]}>
        <cylinderGeometry args={[0.13, 0.09, 0.06, 20]} />
        <meshStandardMaterial {...CHROME} />
      </mesh>
    </group>
  )
}

function Mirror() {
  return (
    <group>
      <mesh castShadow>
        <boxGeometry args={[1.15, 0.9, 0.05]} />
        <meshStandardMaterial color="#d9c7a6" roughness={0.5} />
      </mesh>
      <mesh position={[0, 0, 0.027]}>
        <planeGeometry args={[1.0, 0.75]} />
        <meshBasicMaterial color="#cfe7f1" toneMapped={false} />
      </mesh>
      {[-0.18, -0.02].map((x, i) => (
        <mesh key={i} position={[x, 0.04, 0.029]} rotation={[0, 0, 0.7]}>
          <planeGeometry args={[i ? 0.05 : 0.1, 0.8]} />
          <meshBasicMaterial color="#ffffff" transparent opacity={0.6} toneMapped={false} />
        </mesh>
      ))}
    </group>
  )
}

function Clock() {
  const red = { color: '#e0453a', roughness: 0.4, metalness: 0.2 }
  return (
    <group>
      <mesh position={[0, 0.17, 0]} rotation={[Math.PI / 2, 0, 0]} castShadow>
        <cylinderGeometry args={[0.13, 0.13, 0.09, 28]} />
        <meshStandardMaterial {...red} />
      </mesh>
      <mesh position={[0, 0.17, 0.047]}>
        <circleGeometry args={[0.105, 28]} />
        <meshStandardMaterial color="#fbf7ef" roughness={0.6} />
      </mesh>
      {[
        [0.065, 0],
        [0.045, 2.1],
      ].map(([len, a], i) => (
        <mesh key={i} position={[Math.sin(a) * len * 0.5, 0.17 + Math.cos(a) * len * 0.5, 0.05]} rotation={[0, 0, -a]}>
          <boxGeometry args={[0.012, len, 0.004]} />
          <meshStandardMaterial color="#20232b" />
        </mesh>
      ))}
      {[-1, 1].map((s) => (
        <group key={s}>
          <mesh position={[s * 0.09, 0.31, 0]} rotation={[0, 0, s * -0.5]} castShadow>
            <sphereGeometry args={[0.055, 16, 10, 0, Math.PI * 2, 0, Math.PI / 2]} />
            <meshStandardMaterial {...CHROME} />
          </mesh>
          <mesh position={[s * 0.07, 0.03, 0]} rotation={[0, 0, s * 0.4]}>
            <cylinderGeometry args={[0.012, 0.012, 0.08, 8]} />
            <meshStandardMaterial {...red} />
          </mesh>
        </group>
      ))}
      <mesh position={[0, 0.33, 0]}>
        <boxGeometry args={[0.02, 0.06, 0.02]} />
        <meshStandardMaterial {...CHROME} />
      </mesh>
    </group>
  )
}

function Arch() {
  const grey = { color: '#9aa3ad', roughness: 0.5, metalness: 0.3 }
  return (
    <group>
      {[-0.55, 0.55].map((x) => (
        <mesh key={x} position={[x, 1.15, 0]} castShadow>
          <boxGeometry args={[0.16, 2.3, 0.5]} />
          <meshStandardMaterial {...grey} />
        </mesh>
      ))}
      <mesh position={[0, 2.38, 0]} castShadow>
        <boxGeometry args={[1.26, 0.18, 0.5]} />
        <meshStandardMaterial {...grey} />
      </mesh>
      <mesh position={[0, 2.38, 0.26]}>
        <boxGeometry args={[0.2, 0.08, 0.02]} />
        <meshStandardMaterial color="#3dff7a" emissive="#3dff7a" emissiveIntensity={1.5} toneMapped={false} />
      </mesh>
    </group>
  )
}

const STRIPES = ['#ff7a8a', '#fff4e4']
function Umbrella() {
  const canopy = useMemo(() => {
    const g = new THREE.ConeGeometry(1.35, 0.55, 12, 1, true).toNonIndexed()
    const n = g.attributes.position.count
    const col = []
    for (let i = 0; i < n; i++) {
      const c = new THREE.Color(STRIPES[Math.floor(i / 6) % 2])
      col.push(c.r, c.g, c.b)
    }
    g.setAttribute('color', new THREE.Float32BufferAttribute(col, 3))
    g.computeVertexNormals()
    return g
  }, [])
  return (
    <group rotation={[0, 0, 0.12]}>
      <mesh position={[0, 1.1, 0]} castShadow>
        <cylinderGeometry args={[0.035, 0.035, 2.2, 10]} />
        <meshStandardMaterial color="#f4ece0" roughness={0.6} />
      </mesh>
      <mesh geometry={canopy} position={[0, 2.25, 0]} castShadow>
        <meshStandardMaterial vertexColors side={THREE.DoubleSide} roughness={0.7} />
      </mesh>
      <mesh position={[0, 2.56, 0]}>
        <sphereGeometry args={[0.07, 12, 8]} />
        <meshStandardMaterial color="#ff7a8a" roughness={0.5} />
      </mesh>
    </group>
  )
}

export function Pond({ size = [1.3, 1.0] }) {
  const [rx, rz] = size
  const stones = useMemo(() => {
    const n = Math.round((rx + rz) * 7)
    return Array.from({ length: n }, (_, i) => {
      const a = (i / n) * Math.PI * 2
      return { at: [Math.cos(a) * rx, Math.sin(a) * rz], s: 0.16 + ((i * 37) % 7) * 0.02, r: i * 1.3 }
    })
  }, [rx, rz])
  return (
    <group>
      <mesh position={[0, 0.03, 0]} scale={[rx, 1, rz]} receiveShadow>
        <cylinderGeometry args={[1, 1, 0.05, 48]} />
        <meshStandardMaterial color="#4f9fb8" roughness={0.12} metalness={0.1} />
      </mesh>
      <mesh position={[0, 0.02, 0]} scale={[rx + 0.12, 1, rz + 0.12]}>
        <cylinderGeometry args={[1, 1, 0.04, 48]} />
        <meshStandardMaterial color="#cdb98f" roughness={0.9} />
      </mesh>
      {stones.map((st, i) => (
        <mesh key={i} position={[st.at[0], 0.06, st.at[1]]} rotation={[st.r, st.r * 0.7, 0]} scale={[1, 0.6, 1]} castShadow>
          <dodecahedronGeometry args={[st.s, 0]} />
          <meshStandardMaterial color="#8d8f8a" roughness={0.9} />
        </mesh>
      ))}
    </group>
  )
}

const CLOTH = '#f7f3ea'
function DinnerTable() {
  return (
    <group>
      {[-1, 1].flatMap((sx) =>
        [-1, 1].map((sz) => (
          <mesh key={`${sx}${sz}`} position={[sx * 0.68, 0.33, sz * 0.53]} castShadow>
            <boxGeometry args={[0.09, 0.66, 0.09]} />
            <meshStandardMaterial color="#5a3a26" roughness={0.7} />
          </mesh>
        )),
      )}
      <mesh position={[0, 0.88, 0]} castShadow receiveShadow>
        <boxGeometry args={[1.6, 0.54, 1.3]} />
        <meshStandardMaterial color={CLOTH} roughness={0.85} />
      </mesh>
      <mesh position={[0, 1.153, 0]}>
        <boxGeometry args={[0.42, 0.012, 1.32]} />
        <meshStandardMaterial color="#1f4e6b" roughness={0.7} />
      </mesh>
      <mesh position={[-0.2, 1.18, 0.1]} castShadow>
        <cylinderGeometry args={[0.08, 0.1, 0.05, 16]} />
        <meshStandardMaterial color="#e2b84a" metalness={0.8} roughness={0.25} />
      </mesh>
      <mesh position={[-0.2, 1.32, 0.1]} castShadow>
        <cylinderGeometry args={[0.045, 0.045, 0.24, 14]} />
        <meshStandardMaterial color="#fff6e0" roughness={0.6} />
      </mesh>
      <mesh position={[-0.2, 1.48, 0.1]}>
        <sphereGeometry args={[0.035, 12, 10]} />
        <meshStandardMaterial color="#ffb347" emissive="#ffb347" emissiveIntensity={2.5} toneMapped={false} />
      </mesh>
    </group>
  )
}

const BASE = 0.5
const WATER = 1.45
const FISH = ['#ff8a3d', '#ffd23f', '#4fd8ff', '#ff5c8a', '#7cf27c', '#f2f2f2']
const fishBody = new THREE.SphereGeometry(1, 12, 8)
const fishTail = new THREE.ConeGeometry(0.6, 0.9, 4)
const bubble = new THREE.SphereGeometry(0.025, 8, 6)
const seeded = (n: number) => {
  let x = Math.sin(n * 91.7) * 43758.5
  return () => ((x = Math.sin(x) * 43758.5), x - Math.floor(x))
}
function Aquarium({ size = [2, 0.6] }) {
  const [w, d] = size
  const fish = useRef<(THREE.Group | null)[]>([])
  const bubbles = useRef<(THREE.Mesh | null)[]>([])
  const { swim, kelp, rocks, rise } = useMemo(() => {
    const r = seeded(w * 7 + d)
    const room = w / 2 - 0.2
    return {
      swim: Array.from({ length: Math.max(3, Math.round(w * 1.6)) }, (_, i) => ({
        color: FISH[i % FISH.length],
        size: 0.07 + r() * 0.05,
        x: (r() * 2 - 1) * room * 0.5,
        reach: room * (0.5 + r() * 0.45),
        y: BASE + 0.35 + r() * (WATER - 0.6),
        z: (r() * 2 - 1) * (d / 2 - 0.14),
        speed: 0.25 + r() * 0.35,
        phase: r() * Math.PI * 2,
      })),
      kelp: Array.from({ length: Math.round(w * 2) }, () => ({ x: (r() * 2 - 1) * room, z: -d / 2 + 0.08 + r() * 0.12, h: 0.35 + r() * 0.7 })),
      rocks: Array.from({ length: Math.round(w * 1.2) }, () => ({ x: (r() * 2 - 1) * room, z: (r() * 2 - 1) * (d / 2 - 0.12), s: 0.06 + r() * 0.08 })),
      rise: Array.from({ length: 6 }, (_, i) => ({ x: w / 2 - 0.22 + (r() - 0.5) * 0.06, z: (r() - 0.5) * 0.12, phase: i / 6 })),
    }
  }, [w, d])
  useFrame(({ clock }) => {
    const t = clock.elapsedTime
    swim.forEach((f, i) => {
      const g = fish.current[i]
      if (!g) return
      const a = f.speed * t + f.phase
      g.position.set(f.x + Math.sin(a) * f.reach, f.y + Math.sin(a * 2.3) * 0.05, f.z)
      g.rotation.y = Math.cos(a) > 0 ? 0 : Math.PI
      g.children[1].rotation.y = Math.sin(t * 9 + i) * 0.5
    })
    rise.forEach((b, i) => {
      const m = bubbles.current[i]
      if (!m) return
      const k = (t * 0.35 + b.phase) % 1
      m.position.set(b.x + Math.sin(k * 12) * 0.02, BASE + 0.1 + k * (WATER - 0.15), b.z)
    })
  })
  const glass = BASE + WATER / 2
  return (
    <group>
      <mesh position={[0, BASE / 2, 0]} castShadow receiveShadow>
        <boxGeometry args={[w, BASE, d]} />
        <meshStandardMaterial color="#1f4e6b" roughness={0.6} />
      </mesh>
      <mesh position={[0, BASE + 0.05, 0]} receiveShadow>
        <boxGeometry args={[w - 0.06, 0.1, d - 0.06]} />
        <meshStandardMaterial color="#e8d3a0" roughness={0.95} />
      </mesh>
      <mesh position={[0, glass, -d / 2 + 0.02]}>
        <boxGeometry args={[w - 0.04, WATER, 0.03]} />
        <meshStandardMaterial color="#1d6f96" emissive="#1d6f96" emissiveIntensity={0.5} roughness={0.4} />
      </mesh>
      {rocks.map((k, i) => (
        <mesh key={`r${i}`} position={[k.x, BASE + 0.1, k.z]} scale={[k.s * 1.4, k.s, k.s]} castShadow>
          <sphereGeometry args={[1, 8, 6]} />
          <meshStandardMaterial color="#8a8f99" roughness={0.9} />
        </mesh>
      ))}
      {kelp.map((k, i) => (
        <mesh key={`k${i}`} position={[k.x, BASE + 0.1 + k.h / 2, k.z]}>
          <coneGeometry args={[0.06, k.h, 5]} />
          <meshStandardMaterial color="#3fae5a" roughness={0.7} />
        </mesh>
      ))}
      {swim.map((f, i) => (
        <group key={`f${i}`} ref={(g) => (fish.current[i] = g)} scale={f.size}>
          <mesh scale={[1.6, 1, 0.55]}>
            <primitive object={fishBody} attach="geometry" />
            <meshStandardMaterial color={f.color} roughness={0.5} emissive={f.color} emissiveIntensity={0.25} />
          </mesh>
          <mesh position={[-1.9, 0, 0]} rotation={[0, 0, Math.PI / 2]} scale={[1, 1, 0.4]}>
            <primitive object={fishTail} attach="geometry" />
            <meshStandardMaterial color={f.color} roughness={0.5} />
          </mesh>
        </group>
      ))}
      {rise.map((b, i) => (
        <mesh key={`b${i}`} ref={(m) => (bubbles.current[i] = m)}>
          <primitive object={bubble} attach="geometry" />
          <meshStandardMaterial color="#e8fbff" transparent opacity={0.7} />
        </mesh>
      ))}
      <mesh position={[0, glass, 0]}>
        <boxGeometry args={[w - 0.04, WATER, d - 0.04]} />
        <meshStandardMaterial color="#6fd0f0" transparent opacity={0.28} roughness={0.05} depthWrite={false} />
      </mesh>
      <mesh position={[0, BASE + WATER + 0.04, 0]} castShadow>
        <boxGeometry args={[w, 0.08, d]} />
        <meshStandardMaterial color="#163a52" roughness={0.5} />
      </mesh>
      {[-w / 2 + 0.03, w / 2 - 0.03].map((x) => (
        <mesh key={x} position={[x, glass, d / 2 - 0.03]}>
          <boxGeometry args={[0.06, WATER, 0.06]} />
          <meshStandardMaterial color="#163a52" roughness={0.5} />
        </mesh>
      ))}
    </group>
  )
}

const SAND = '#e6c587'
function Sandcastle() {
  const sand = <meshStandardMaterial color={SAND} roughness={0.95} />
  return (
    <group>
      <mesh position={[0, 0.012, 0]} rotation={[-Math.PI / 2, 0, 0]} receiveShadow>
        <ringGeometry args={[0.66, 0.84, 32]} />
        <meshStandardMaterial color="#7fd0e0" roughness={0.15} />
      </mesh>
      <mesh position={[0, 0.11, 0]} castShadow receiveShadow>
        <cylinderGeometry args={[0.5, 0.6, 0.22, 24]} />
        {sand}
      </mesh>
      {[-1, 1].map((s) => (
        <group key={s} position={[s * 0.3, 0.22, 0.14]}>
          <mesh position={[0, 0.2, 0]} castShadow>
            <cylinderGeometry args={[0.13, 0.16, 0.4, 12]} />
            {sand}
          </mesh>
          <mesh position={[0, 0.51, 0]} castShadow>
            <coneGeometry args={[0.15, 0.22, 12]} />
            {sand}
          </mesh>
        </group>
      ))}
      <group position={[0, 0.22, -0.14]}>
        <mesh position={[0, 0.3, 0]} castShadow>
          <cylinderGeometry args={[0.15, 0.19, 0.6, 14]} />
          {sand}
        </mesh>
        <mesh position={[0, 0.66, 0]} scale={[1, 0.3, 1]} castShadow>
          <sphereGeometry args={[0.3, 20, 12]} />
          {sand}
        </mesh>
        <mesh position={[0, 0.7, 0]} castShadow>
          <sphereGeometry args={[0.11, 14, 10, 0, Math.PI * 2, 0, Math.PI / 2]} />
          {sand}
        </mesh>
        <mesh position={[0, 0.96, 0]}>
          <cylinderGeometry args={[0.008, 0.008, 0.38, 6]} />
          <meshStandardMaterial color="#f4ece0" roughness={0.6} />
        </mesh>
        <mesh position={[0.075, 1.08, 0]}>
          <boxGeometry args={[0.15, 0.1, 0.01]} />
          <meshStandardMaterial color="#5fe8a0" roughness={0.6} />
        </mesh>
      </group>
    </group>
  )
}

export const BUILT = { shower: Shower, mirror: Mirror, clock: Clock, arch: Arch, umbrella: Umbrella, pond: Pond, dinnertable: DinnerTable, aquarium: Aquarium, sandcastle: Sandcastle }

export function Door({ trim = '#a8744f', wood = '#c98f5c' }) {
  return (
    <group>
      <mesh position={[0, 1.16, 0.03]} castShadow>
        <boxGeometry args={[1.26, 2.32, 0.06]} />
        <meshStandardMaterial color={trim} roughness={0.6} />
      </mesh>
      <mesh position={[0, 1.1, 0.07]} castShadow>
        <boxGeometry args={[1.04, 2.14, 0.06]} />
        <meshStandardMaterial color={wood} roughness={0.7} />
      </mesh>
      {[1.6, 0.62].map((y) => (
        <mesh key={y} position={[0, y, 0.105]}>
          <boxGeometry args={[0.74, 0.74, 0.02]} />
          <meshStandardMaterial color={wood} roughness={0.55} emissive={wood} emissiveIntensity={0.08} />
        </mesh>
      ))}
      <mesh position={[0.38, 1.05, 0.13]}>
        <sphereGeometry args={[0.055, 14, 10]} />
        <meshStandardMaterial color="#e2b84a" metalness={0.8} roughness={0.25} />
      </mesh>
    </group>
  )
}

export function Built({ name, ...rest }: { name: keyof typeof BUILT; size?: [number, number] }) {
  const B: (p: { size?: [number, number] }) => JSX.Element = BUILT[name]
  return B ? <B {...rest} /> : null
}
