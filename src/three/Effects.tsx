import { EffectComposer, Bloom, Vignette, N8AO, HueSaturation, BrightnessContrast } from '@react-three/postprocessing'
import { Toon } from './Toon'
import { useLook, type Key } from '../story/look'
import { useStrain } from './Quality'

const SHARP = Math.min(window.devicePixelRatio || 1, 2) > 1.25

export function Effects({ bloom = 0.55, toy = false, vignette = true }) {
  const look = useLook()
  const strained = useStrain((s) => s.strained)
  const on = (k: 'bloom' | 'vignette') => !toy || look[k]
  const toon = toy && (look.outline || look.pastel)
  return (
    <EffectComposer key={(Object.keys(look) as Key[]).filter((k) => look[k] === true).join()} multisampling={SHARP ? 0 : 4}>
      <>
      {toy && look.ao && !strained && <N8AO halfRes aoSamples={8} aoRadius={1.2} intensity={2.2} distanceFalloff={0.6} color="#2a1f3a" />}
      {on('bloom') && <Bloom intensity={bloom} luminanceThreshold={0.72} luminanceSmoothing={0.32} mipmapBlur radius={0.7} />}
      {toon && <Toon width={look.outlineWidth} strength={look.outline ? look.outlineStrength : 0} lift={look.pastel ? look.pastelLift : 0} />}
      {toy && look.grade && <HueSaturation saturation={0.06} />}
      {toy && look.grade && <BrightnessContrast brightness={0.05} contrast={0.06} />}
      {vignette && on('vignette') && <Vignette offset={0.25} darkness={toy ? 0.45 : 0.72} eskil={false} />}
      </>
    </EffectComposer>
  )
}
