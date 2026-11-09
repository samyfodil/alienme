import { useMemo } from 'react'
import * as THREE from 'three'
import { Environment, Lightformer, ContactShadows } from '@react-three/drei'

function GlowOrb({ color = '#28d6c8', position = [0, 0.2, -3.2] as [number, number, number], scale = 7 }) {
  const tex = useMemo(() => {
    const s = 256
    const c = document.createElement('canvas')
    c.width = c.height = s
    const ctx = c.getContext('2d')!
    const g = ctx.createRadialGradient(s / 2, s / 2, 0, s / 2, s / 2, s / 2)
    g.addColorStop(0, 'rgba(255,255,255,1)')
    g.addColorStop(0.28, 'rgba(255,255,255,0.45)')
    g.addColorStop(1, 'rgba(255,255,255,0)')
    ctx.fillStyle = g
    ctx.fillRect(0, 0, s, s)
    return new THREE.CanvasTexture(c)
  }, [])
  return (
    <mesh position={position} scale={scale}>
      <planeGeometry args={[1, 1]} />
      <meshBasicMaterial
        map={tex}
        color={color}
        transparent
        blending={THREE.AdditiveBlending}
        depthWrite={false}
        toneMapped={false}
      />
    </mesh>
  )
}

export const glowFor = (color: string) => `#${new THREE.Color(color).multiplyScalar(0.55).getHexString()}`

export function Studio({ groundY = -1.25, glow = '#2fd6c8', shadowFrames = Infinity }) {
  return (
    <>
      <ambientLight intensity={0.3} />
      <directionalLight
        position={[2.5, 5, 6]}
        intensity={1.05}
        color="#f3ecff"
        castShadow
        shadow-mapSize={[1024, 1024]}
        shadow-bias={-0.0004}
      >
        <orthographicCamera attach="shadow-camera" args={[-5, 5, 5, -5, 0.1, 30]} />
      </directionalLight>
      <pointLight position={[-3.4, 2.4, -1.8]} intensity={3.2} color="#ff4fcf" decay={0} />
      <pointLight position={[3.4, 1.8, -1.6]} intensity={2.6} color="#37e6ff" decay={0} />
      <Environment resolution={256} frames={1}>
        <Lightformer intensity={1.6} position={[0, 4, 3]} scale={[8, 8, 1]} color="#ffffff" />
        <Lightformer intensity={1.8} position={[-5, 1, -2]} scale={[4, 8, 1]} color="#ff6fd6" />
        <Lightformer intensity={1.8} position={[5, 1, -2]} scale={[4, 8, 1]} color="#53d9ff" />
      </Environment>
      <GlowOrb color={glow} />
      <ContactShadows
        position={[0, groundY, 0]}
        opacity={0.6}
        scale={10}
        blur={2.8}
        far={5}
        resolution={512}
        frames={shadowFrames}
        color="#05030f"
      />
    </>
  )
}
