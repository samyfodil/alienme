import { Suspense, useMemo, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import { Environment, Lightformer, ContactShadows } from '@react-three/drei'
import * as THREE from 'three'
import { Prop } from './Prop'

const WALL_Z = -5
const WINDOW = { y: 1.45, r: 2.6 }
const PORTS = [-6.2, 6.2].map((x) => ({ x, y: 1.6, r: 0.8 }))

function wallGeometry(groundY: number) {
  const s = new THREE.Shape()
  s.moveTo(-40, groundY - 6)
  s.lineTo(40, groundY - 6)
  s.lineTo(40, groundY + 16)
  s.lineTo(-40, groundY + 16)
  s.closePath()
  for (const h of [{ x: 0, ...WINDOW }, ...PORTS]) {
    const p = new THREE.Path()
    p.absarc(h.x, h.y, h.r, 0, Math.PI * 2, true)
    s.holes.push(p)
  }
  return new THREE.ShapeGeometry(s, 48)
}

function Frame({ x = 0, y, r, rim }: { x?: number; y: number; r: number; rim: number }) {
  return (
    <group position={[x, y, WALL_Z]}>
      <mesh rotation={[Math.PI / 2, 0, 0]} position={[0, 0, -0.3]}>
        <cylinderGeometry args={[r, r, 0.6, 48, 1, true]} />
        <meshStandardMaterial color="#b9a8f5" roughness={0.6} side={THREE.BackSide} />
      </mesh>
      <mesh position={[0, 0, 0.04]}>
        <torusGeometry args={[r, rim, 14, 64]} />
        <meshStandardMaterial color="#9ff0d8" roughness={0.4} />
      </mesh>
    </group>
  )
}

function Outside() {
  const stars = useMemo(() => {
    const n = 700
    const p = new Float32Array(n * 3)
    const c = new Float32Array(n * 3)
    const col = new THREE.Color()
    let s = 11
    const r = () => (s = (s * 16807) % 2147483647) / 2147483647
    for (let i = 0; i < n; i++) {
      p.set([(r() - 0.5) * 160, -10 + r() * 90, -60 - r() * 20], i * 3)
      col.set(r() < 0.8 ? '#ffffff' : '#ffd6ec')
      c.set([col.r, col.g, col.b], i * 3)
    }
    const g = new THREE.BufferGeometry()
    g.setAttribute('position', new THREE.BufferAttribute(p, 3))
    g.setAttribute('color', new THREE.BufferAttribute(c, 3))
    return g
  }, [])
  const earth = useRef<THREE.Group>(null)
  useFrame((_, dt) => earth.current && (earth.current.rotation.y += dt * 0.04))
  return (
    <group>
      <mesh position={[0, 0, -90]}>
        <planeGeometry args={[600, 400]} />
        <meshBasicMaterial color="#2c2466" />
      </mesh>
      <points geometry={stars}>
        <pointsMaterial size={2.4} sizeAttenuation={false} vertexColors toneMapped={false} />
      </points>
      <Suspense fallback={null}>
        <group ref={earth} position={[4.6, 9.4, -40]}>
          <Prop model="space/planet-earth" scale={1.15} y={-1.15 * 1.94} />
        </group>
        <group position={[-5.6, 10.2, -44]} rotation={[0.4, 0, 0.3]}>
          <Prop model="space/planet-ringed" scale={0.75} />
        </group>
      </Suspense>
    </group>
  )
}

export function ShipBay({ groundY = -1.25 }) {
  const wall = useMemo(() => wallGeometry(groundY), [groundY])
  return (
    <>
      <hemisphereLight args={['#fff4ff', '#bdf3e2', 0.5]} />
      <directionalLight position={[2.5, 5, 6]} intensity={1.1} color="#fff8f0" castShadow shadow-mapSize={[1024, 1024]} shadow-bias={-0.0004}>
        <orthographicCamera attach="shadow-camera" args={[-5, 5, 5, -5, 0.1, 30]} />
      </directionalLight>
      <pointLight position={[-3.4, 2.4, -1.8]} intensity={0.8} color="#ff8fd8" decay={0} />
      <pointLight position={[3.4, 1.8, -1.6]} intensity={0.7} color="#7fe8ff" decay={0} />
      <directionalLight position={[0, 6, -30]} intensity={1.6} color="#fff4e0" />
      <Environment resolution={256} frames={1}>
        <Lightformer intensity={0.5} position={[0, 4, 3]} scale={[8, 8, 1]} color="#ffffff" />
        <Lightformer intensity={0.35} position={[-5, 1, -2]} scale={[4, 8, 1]} color="#ffb3e6" />
        <Lightformer intensity={0.35} position={[5, 1, -2]} scale={[4, 8, 1]} color="#a6f0ff" />
      </Environment>

      <Outside />
      <mesh geometry={wall} position={[0, 0, WALL_Z]} receiveShadow>
        <meshStandardMaterial color="#d9cdfd" roughness={0.75} />
      </mesh>
      <mesh position={[0, groundY - 0.02, WALL_Z + 0.08]}>
        <boxGeometry args={[80, 0.24, 0.16]} />
        <meshStandardMaterial color="#9ff0d8" roughness={0.6} />
      </mesh>
      <Frame y={WINDOW.y} r={WINDOW.r} rim={0.24} />
      {PORTS.map((p) => (
        <Frame key={p.x} {...p} rim={0.14} />
      ))}

      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, groundY - 0.1, WALL_Z + 15]} receiveShadow>
        <planeGeometry args={[80, 30]} />
        <meshStandardMaterial color="#ece5ff" roughness={0.85} />
      </mesh>
      {[2.3, 3.7].map((r) => (
        <mesh key={r} rotation={[-Math.PI / 2, 0, 0]} position={[0, groundY - 0.095, 0]}>
          <ringGeometry args={[r, r + 0.12, 64]} />
          <meshStandardMaterial color="#c4f5e6" roughness={0.85} />
        </mesh>
      ))}
      <mesh position={[0, groundY - 0.05, 0]} receiveShadow>
        <cylinderGeometry args={[1.35, 1.42, 0.1, 48]} />
        <meshStandardMaterial color="#9ff0d8" roughness={0.45} />
      </mesh>
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, groundY + 0.002, 0]}>
        <circleGeometry args={[1.05, 48]} />
        <meshStandardMaterial color="#d8f7ef" roughness={0.6} />
      </mesh>
      <ContactShadows position={[0, groundY + 0.004, 0]} opacity={0.35} scale={6} blur={2.4} far={5} resolution={512} color="#5a4a8a" />
    </>
  )
}
