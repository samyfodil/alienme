import { Suspense, useMemo, useRef } from 'react'
import { Canvas, useFrame } from '@react-three/fiber'
import { Studio, glowFor } from '../three/Studio'
import { Character } from '../three/Character'
import { ALIENS, ALIEN_KEYS, type Alien } from '../data/aliens'
import { presetAvatar } from '../data/models'

const GROUND = -1.25

function Ready() {
  const n = useRef(0)
  useFrame(() => {
    if (++n.current === 90) window.__specimenReady = true
  })
  return null
}

export default function Specimen({ kind }: { kind: Alien }) {
  const a = ALIENS[kind]
  const avatar = useMemo(() => presetAvatar(a.disguise), [a.disguise])
  const turn = Math.sin(ALIEN_KEYS.indexOf(kind) * 1.7) * 0.4
  return (
    <Canvas
      className="specimen-shot"
      gl={{ preserveDrawingBuffer: true }}
      camera={{ position: [0, 0.4, 6.6], fov: 28 }}
      onCreated={({ camera }) => camera.lookAt(0, 0.02, 0)}
    >
      <Suspense fallback={null}>
        <Studio groundY={GROUND} glow={glowFor(a.color)} shadowFrames={60} />
        <group rotation={[0, turn, 0]}>
          <Character avatar={avatar} alien={kind} targetHeight={2} groundY={GROUND} />
        </group>
        <Ready />
      </Suspense>
    </Canvas>
  )
}
