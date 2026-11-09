import { RoundedBox } from '@react-three/drei'
import type { MeshStandardMaterialProps } from '@react-three/fiber'
import type { Avatar } from '../data/models'

const FACE_Z = 0.455
const EYE_Y = 0.04

type V3 = [number, number, number]
type BoxProps = { args: V3; color: string; position?: V3; rotation?: V3; rough?: number; metal?: number } & Omit<MeshStandardMaterialProps, 'args' | 'color'>

function Box({ args, color, position, rotation, rough = 0.5, metal = 0, ...m }: BoxProps) {
  return (
    <RoundedBox args={args} radius={Math.min(...args) * 0.3} smoothness={2} position={position} rotation={rotation}>
      <meshStandardMaterial color={color} roughness={rough} metalness={metal} {...m} />
    </RoundedBox>
  )
}

function Frame({ x, w = 0.27, h = 0.27, t = 0.035, color, lens, lensOpacity = 0.55 }: { x: number; w?: number; h?: number; t?: number; color: string; lens?: string; lensOpacity?: number }) {
  return (
    <group position={[x, EYE_Y, FACE_Z + 0.03]}>
      <Box args={[w, t, t]} position={[0, h / 2, 0]} color={color} />
      <Box args={[w, t, t]} position={[0, -h / 2, 0]} color={color} />
      <Box args={[t, h, t]} position={[-w / 2, 0, 0]} color={color} />
      <Box args={[t, h, t]} position={[w / 2, 0, 0]} color={color} />
      {lens && (
        <mesh position={[0, 0, -0.005]}>
          <planeGeometry args={[w, h]} />
          <meshStandardMaterial color={lens} transparent opacity={lensOpacity} roughness={0.1} />
        </mesh>
      )}
    </group>
  )
}

function Eyewear({ kind }: { kind: string }) {
  if (kind === 'glasses')
    return (
      <group>
        <Frame x={-0.18} color="#1d1f2b" lens="#cfe8ff" lensOpacity={0.25} />
        <Frame x={0.18} color="#1d1f2b" lens="#cfe8ff" lensOpacity={0.25} />
        <Box args={[0.1, 0.03, 0.03]} position={[0, EYE_Y + 0.04, FACE_Z + 0.03]} color="#1d1f2b" />
      </group>
    )
  if (kind === 'shades')
    return (
      <group>
        <Box args={[0.86, 0.19, 0.05]} position={[0, EYE_Y, FACE_Z + 0.035]} color="#0b0c12" rough={0.08} metal={0.4} />
        <Box args={[0.05, 0.05, 0.5]} position={[-0.45, EYE_Y + 0.04, FACE_Z - 0.2]} color="#0b0c12" />
        <Box args={[0.05, 0.05, 0.5]} position={[0.45, EYE_Y + 0.04, FACE_Z - 0.2]} color="#0b0c12" />
      </group>
    )
  if (kind === '3d')
    return (
      <group>
        <Box args={[0.1, 0.04, 0.04]} position={[0, EYE_Y + 0.04, FACE_Z + 0.03]} color="#f4f4f4" />
        <Frame x={-0.18} color="#f4f4f4" lens="#ff2d55" lensOpacity={0.85} />
        <Frame x={0.18} color="#f4f4f4" lens="#19d3ff" lensOpacity={0.85} />
      </group>
    )
  return null
}

function Lashes() {
  return (
    <group>
      {[-1, 1].map((s) => (
        <group key={s} position={[s * 0.29, 0.13, FACE_Z + 0.02]}>
          {[0, 1, 2].map((i) => (
            <Box
              key={i}
              args={[0.022, 0.085, 0.022]}
              position={[s * (0.012 + i * 0.03), 0.03 - i * 0.022, 0]}
              rotation={[0, 0, -s * (0.45 + i * 0.35)]}
              color="#14151c"
            />
          ))}
        </group>
      ))}
    </group>
  )
}

function Headgear({ kind, lift }: { kind: string; lift: number }) {
  if (kind === 'headphones')
    return (
      <group>
        <mesh position={[0, 0.02, 0]} rotation={[0, 0, 0]}>
          <torusGeometry args={[0.58, 0.04, 8, 24, Math.PI]} />
          <meshStandardMaterial color="#1d1f2b" roughness={0.4} />
        </mesh>
        {[-1, 1].map((s) => (
          <group key={s} position={[s * 0.58, 0, 0]}>
            <Box args={[0.14, 0.32, 0.3]} color="#ff4f7b" />
            <Box args={[0.06, 0.24, 0.22]} position={[s * 0.08, 0, 0]} color="#1d1f2b" />
          </group>
        ))}
      </group>
    )
  if (kind === 'bow')
    return (
      <group position={[0.28, 0.55 + lift, 0.05]} rotation={[0, 0, -0.35]}>
        <mesh position={[-0.13, 0, 0]} rotation={[0, 0, Math.PI / 2]}>
          <coneGeometry args={[0.13, 0.26, 4]} />
          <meshStandardMaterial color="#ff4f9a" roughness={0.45} flatShading />
        </mesh>
        <mesh position={[0.13, 0, 0]} rotation={[0, 0, -Math.PI / 2]}>
          <coneGeometry args={[0.13, 0.26, 4]} />
          <meshStandardMaterial color="#ff4f9a" roughness={0.45} flatShading />
        </mesh>
        <Box args={[0.1, 0.1, 0.1]} color="#ff86bb" />
      </group>
    )
  if (kind === 'party')
    return (
      <group position={[0.08, 0.72 + lift, 0]} rotation={[0, 0, -0.18]}>
        <mesh>
          <coneGeometry args={[0.24, 0.5, 6]} />
          <meshStandardMaterial color="#8f5bff" roughness={0.5} flatShading />
        </mesh>
        <mesh position={[0, -0.1, 0]}>
          <cylinderGeometry args={[0.15, 0.2, 0.06, 6]} />
          <meshStandardMaterial color="#ffd23f" roughness={0.5} flatShading />
        </mesh>
        <mesh position={[0, 0.28, 0]}>
          <icosahedronGeometry args={[0.07, 0]} />
          <meshStandardMaterial color="#ffd23f" roughness={0.5} flatShading />
        </mesh>
      </group>
    )
  if (kind === 'halo')
    return (
      <mesh position={[0, 0.66 + lift, 0]} rotation={[Math.PI / 2, 0, 0]}>
        <torusGeometry args={[0.34, 0.045, 8, 28]} />
        <meshStandardMaterial color="#ffe27a" emissive="#ffc93c" emissiveIntensity={1.4} roughness={0.3} />
      </mesh>
    )
  return null
}

function Face({ kind, hair }: { kind: string; hair: string }) {
  if (kind === 'tache')
    return (
      <group position={[0, -0.24, FACE_Z + 0.07]}>
        <Box args={[0.22, 0.08, 0.07]} position={[-0.1, 0, 0]} rotation={[0, 0, 0.18]} color={hair} />
        <Box args={[0.22, 0.08, 0.07]} position={[0.1, 0, 0]} rotation={[0, 0, -0.18]} color={hair} />
      </group>
    )
  if (kind === 'blush')
    return (
      <group>
        {[-1, 1].map((s) => (
          <mesh key={s} position={[s * 0.3, -0.13, FACE_Z + 0.012]}>
            <circleGeometry args={[0.075, 16]} />
            <meshBasicMaterial color="#ff7a9c" transparent opacity={0.7} />
          </mesh>
        ))}
      </group>
    )
  return null
}

export function Accessories({ avatar, top = 0.5 }: { avatar: Avatar; top?: number }) {
  const hair = avatar.colors?.hair || '#4a2d1c'
  return (
    <group>
      {avatar.body === 'female' && !avatar.photo && <Lashes />}
      <Eyewear kind={avatar.eyewear} />
      <Face kind={avatar.face} hair={hair} />
      <Headgear kind={avatar.headgear} lift={Math.max(0, top - 0.5)} />
    </group>
  )
}
