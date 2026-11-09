import { useGLTF } from '@react-three/drei'
import { PRESETS, cutesUrl, partsOf } from '../data/models'
import { useGame } from '../store'

export function preloadModels() {
  new Set(partsOf(useGame.getState().avatar)).forEach((k) => useGLTF.preload(cutesUrl(k)))
}

export function preloadPresets() {
  PRESETS.forEach(([k]) => useGLTF.preload(cutesUrl(k)))
}
