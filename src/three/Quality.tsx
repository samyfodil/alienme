import { useEffect } from 'react'
import { create } from 'zustand'
import { PerformanceMonitor } from '@react-three/drei'
import { useThree } from '@react-three/fiber'

const BUDGET = 2560 * 1440

export const useStrain = create<{ strained: boolean }>(() => ({ strained: false }))

export function Quality() {
  const setDpr = useThree((s) => s.setDpr)
  const { width, height } = useThree((s) => s.size)
  const top = Math.min(window.devicePixelRatio || 1, 2, Math.sqrt(BUDGET / Math.max(1, width * height)))
  const at = (factor: number) => Math.round(top * (0.5 + 0.5 * factor) * 20) / 20
  useEffect(() => setDpr(at(1)), [top])
  return (
    <PerformanceMonitor
      factor={1}
      flipflops={4}
      ms={1000}
      iterations={4}
      bounds={(hz) => (hz > 100 ? [60, 100] : [50, 60])}
      onDecline={() => useStrain.setState({ strained: true })}
      onChange={({ factor }) => setDpr(at(factor))}
    />
  )
}

export const GL = { antialias: false }
