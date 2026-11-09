import { forwardRef, useEffect, useMemo } from 'react'
import { Effect, EffectAttribute } from 'postprocessing'
import { Color, Uniform } from 'three'

const frag = `
uniform vec3 ink;
uniform vec3 paper;
uniform float width;
uniform float strength;
uniform float lift;

float zAt(vec2 uv) {
  return getViewZ(readDepth(uv));
}

void mainImage(const in vec4 inputColor, const in vec2 uv, const in float depth, out vec4 outputColor) {
  vec2 t = texelSize * width;
  float z = getViewZ(depth);
  float bend = abs(zAt(uv - vec2(t.x, 0.0)) + zAt(uv + vec2(t.x, 0.0)) - 2.0 * z)
             + abs(zAt(uv - vec2(0.0, t.y)) + zAt(uv + vec2(0.0, t.y)) - 2.0 * z);
  // Faded with distance: far off, depth is too coarse to draw clean lines.
  float edge = smoothstep(0.015, 0.05, bend / max(-z, 0.01)) * strength * (1.0 - smoothstep(90.0, 160.0, -z));
  // In display space, where a pastel lift and an ink line look as meant.
  vec3 c = pow(max(inputColor.rgb, 0.0), vec3(1.0 / 2.2));
  c = mix(c, pow(paper, vec3(1.0 / 2.2)), lift);
  c = mix(c, pow(ink, vec3(1.0 / 2.2)), edge);
  outputColor = vec4(pow(c, vec3(2.2)), inputColor.a);
}
`

class ToonEffect extends Effect {
  constructor() {
    super('ToonEffect', frag, {
      attributes: EffectAttribute.DEPTH,
      uniforms: new Map<string, Uniform>([
        ['ink', new Uniform(new Color())],
        ['paper', new Uniform(new Color())],
        ['width', new Uniform(1)],
        ['strength', new Uniform(1)],
        ['lift', new Uniform(0)],
      ]),
    })
  }
}

type Props = { ink?: string; paper?: string; width?: number; strength?: number; lift?: number }

export const Toon = forwardRef<ToonEffect, Props>(function Toon({ ink = '#3a2a4a', paper = '#fff1e2', width = 1.2, strength = 0.7, lift = 0.1 }, ref) {
  const effect = useMemo(() => new ToonEffect(), [])
  useEffect(() => {
    const u = (k: string) => effect.uniforms.get(k)!
    u('ink').value.set(ink)
    u('paper').value.set(paper)
    u('width').value = width
    u('strength').value = strength
    u('lift').value = lift
  }, [effect, ink, paper, width, strength, lift])
  useEffect(() => () => effect.dispose?.(), [effect])
  return <primitive ref={ref} object={effect} dispose={null} />
})
