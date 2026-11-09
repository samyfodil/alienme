import { useEffect, useRef } from 'react'
import { useFrame, useThree } from '@react-three/fiber'
import { useProgress } from '@react-three/drei'
import { Camera, Material, Object3D, Scene, Texture, WebGLRenderTarget, WebGLRenderer } from 'three'

const BUFFER = new WebGLRenderTarget(1, 1)
export function compile(gl: WebGLRenderer, object: Object3D, camera: Camera, scene: Scene) {
  const was = gl.getRenderTarget()
  gl.setRenderTarget(BUFFER)
  const ready = gl.compileAsync(object, camera, scene).catch(() => {})
  gl.setRenderTarget(was)
  return ready
}

const MAPS = ['map', 'emissiveMap', 'normalMap', 'roughnessMap', 'metalnessMap', 'aoMap', 'alphaMap']
const uploads = new Set<Texture>()
let uploading = false

function upload(gl: WebGLRenderer) {
  const [t] = uploads
  if (!t) {
    uploading = false
    return
  }
  uploads.delete(t)
  gl.initTexture(t)
  requestAnimationFrame(() => upload(gl))
}

const TEARDOWN = 650
let gone = -Infinity
export function useCanvasGone() {
  useEffect(
    () => () => {
      gone = performance.now()
    },
    [],
  )
}

export function Warmup({ onReady, onShown }: { onReady: () => void; onShown: () => void }) {
  const gl = useThree((s) => s.gl)
  const scene = useThree((s) => s.scene)
  const camera = useThree((s) => s.camera)
  const { active } = useProgress()
  const frames = useRef(0)
  useFrame(() => ++frames.current === 3 && onShown())
  useEffect(() => {
    if (active) return
    let live = true
    let frame = 0
    const wait = setTimeout(
      () => (frame = requestAnimationFrame(() => compile(gl, scene, camera, scene).then(() => live && onReady()))),
      Math.max(0, gone + TEARDOWN - performance.now()),
    )
    return () => {
      live = false
      clearTimeout(wait)
      cancelAnimationFrame(frame)
    }
  }, [active, gl, scene, camera, onReady])
  return null
}

export function useWarm(object: Object3D) {
  const gl = useThree((s) => s.gl)
  const scene = useThree((s) => s.scene)
  const camera = useThree((s) => s.camera)
  const idle = useThree((s) => s.frameloop === 'never')
  useEffect(() => {
    if (idle) return
    compile(gl, object, camera, scene)
    object.traverse((o) => {
      const mat = (o as Object3D & { material?: Material | Material[] }).material
      if (!mat) return
      for (const m of ([] as Material[]).concat(mat) as unknown as Record<string, Texture | undefined>[])
        for (const k of MAPS) {
          const t = m[k]
          if (t?.isTexture && !(gl.properties.get(t) as { __webglTexture?: unknown }).__webglTexture) uploads.add(t)
        }
    })
    if (uploads.size && !uploading) {
      uploading = true
      requestAnimationFrame(() => upload(gl))
    }
  }, [object, gl, scene, camera, idle])
}
