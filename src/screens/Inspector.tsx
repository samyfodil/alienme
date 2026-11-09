import { Suspense } from 'react'
import { Canvas } from '@react-three/fiber'
import { OrbitControls } from '@react-three/drei'
import { Studio } from '../three/Studio'
import { Effects } from '../three/Effects'
import { GLModel } from '../three/GLModel'

export default function Inspector({ url }: { url: string }) {
  return (
    <section className="screen" style={{ padding: 0 }}>
      <div className="stage-full">
        <Canvas shadows camera={{ position: [0, 0.75, 6.2], fov: 38 }} dpr={[1, 2]}>
          <Studio />
          <Suspense fallback={null}>
            <GLModel url={url} targetHeight={2.6} />
          </Suspense>
          <OrbitControls makeDefault target={[0, 0.45, 0]} />
          <Effects />
        </Canvas>
      </div>
      <div
        style={{
          position: 'absolute',
          top: 12,
          left: 12,
          zIndex: 5,
          font: '12px monospace',
          color: '#9fffe0',
          background: 'rgba(0,0,0,0.5)',
          padding: '4px 8px',
          borderRadius: 6,
        }}
      >
        {url}
      </div>
    </section>
  )
}
