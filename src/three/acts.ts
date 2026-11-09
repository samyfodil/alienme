import * as THREE from 'three'
import type { Model } from '../story/types'

export type ItemSpec = {
  model?: Model
  scale?: number
  box?: [number, number, number]
  color?: string
  screen?: string
  facing?: boolean
  both?: boolean
  turn?: number
  grip?: number
  reach?: number
  build?: 'octopus' | 'shell'
}

export const ITEMS = {
  mug: { model: 'diner/coffee-cup', scale: 0.9 },
  toast: { box: [0.4, 0.4, 0.09], color: '#f4c35a' },
  bread: { box: [0.3, 0.3, 0.07], color: '#e8c48a' },
  phone: { box: [0.22, 0.38, 0.045], color: '#1d2333', screen: '#7fe3ff', facing: true, both: true, turn: Math.PI, grip: -0.04, reach: -0.02 },
  burger: { model: 'diner/burger', scale: 0.8 },
  fries: { model: 'diner/fries', scale: 1.4 },
  pizza: { model: 'diner/pizza', scale: 0.7, grip: 0.02 },
  cake: { model: 'diner/cupcake', scale: 1.3 },
  soda: { model: 'diner/soda-cup', scale: 0.8 },
  donut: { model: 'diner/donut', scale: 1.1 },
  sandwich: { model: 'diner/sandwich', scale: 0.9 },
  milkshake: { model: 'diner/milkshake', scale: 0.8 },
  marker: { box: [0.06, 0.06, 0.26], color: '#e2483c' },
  badge: { box: [0.16, 0.24, 0.02], color: '#2f6fd1', screen: '#e8f0ff' },
  visitor: { box: [0.16, 0.24, 0.02], color: '#e8463a', screen: '#fff4f2' },
  buscard: { box: [0.24, 0.15, 0.02], color: '#23b26b', screen: '#d6ffe9' },
  toothbrush: { box: [0.035, 0.035, 0.22], color: '#5ab8ff', grip: 0.02 },
  snack: { box: [0.34, 0.44, 0.1], color: '#ff7a3d' },
  octopus: { build: 'octopus', grip: 0.02, reach: 0.2 },
  grilled: { build: 'octopus', color: '#9a3b1f', grip: 0.02, reach: 0.2 },
  fish: { model: 'diner/fish', scale: 1.6 },
  shell: { build: 'shell', grip: 0.02, reach: 0.18 },
} satisfies Record<string, ItemSpec>

type Vec = number[]

const ease = (x: number) => THREE.MathUtils.smootherstep(x, 0, 1)
const clamp01 = (x: number) => Math.min(1, Math.max(0, x))
const pulse = (t: number, period: number, rise = 0.25) => {
  const x = (t % period) / period
  return ease(Math.min(1, x / rise, (1 - x) / rise))
}
const mix = (a: Vec, b: Vec, k: number): Vec => Array.from({ length: Math.max(a.length, b.length) }, (_, i) => (a[i] || 0) + ((b[i] || 0) - (a[i] || 0)) * k)
const arc = (a: Vec, b: Vec, k: number, bow: Vec) => mix(a, b, k).map((v, i) => v + (bow[i] || 0) * Math.sin(Math.PI * k))
const rnd = (n: number) => {
  const x = Math.sin(n * 127.1 + 311.7) * 43758.5453
  return x - Math.floor(x)
}
const steps = (t: number, dur: number, pick: (i: number) => Vec, hold = 0.3) => {
  const i = Math.floor(t / dur)
  return mix(pick(i - 1), pick(i), ease(clamp01((t / dur - i) / (1 - hold))))
}
const keys = (t: number, period: number, list: [at: number, to: Vec, bow?: Vec][]) => {
  const x = (t % period) / period
  let i = list.length - 1
  while (i > 0 && list[i][0] > x) i--
  const [a0, from] = list[i]
  const [a1, to, bow] = list[(i + 1) % list.length]
  const span = (a1 > a0 ? a1 : a1 + 1) - a0
  const k = ease(clamp01((x - a0) / span))
  return bow ? arc(from, to, k, bow) : mix(from, to, k)
}

export type Frame = { L: Vec; R: Vec; sx: { L: number; R: number }; mouth: number; face: number; front: number; chest: number }
export type Pose = { L?: Vec; R?: Vec; w?: number; z?: number }

export const ARMS = {
  sip: (t, P) => {
    const hold = [0.3, P.chest + 0.1, P.front + 0.3, -0.1]
    const lips = [0.1, P.mouth + 0.06, P.face + 0.1, -0.35]
    const tip = [0.08, P.mouth + 0.14, P.face + 0.06, -0.95]
    return {
      R: keys(t + 1.9, 3, [
        [0, hold],
        [0.2, lips, [0.05, 0, 0.12]],
        [0.3, lips],
        [0.4, tip],
        [0.6, tip],
        [0.72, lips],
        [0.8, hold, [0.05, -0.04, 0.1]],
      ]),
    }
  },
  eat: (t, P) => {
    const hold = [0.3, P.chest + 0.12, P.front + 0.3, -0.2]
    const lips = [0.1, P.mouth - 0.02, P.face + 0.05, -0.5]
    const tug = [0.14, P.mouth - 0.08, P.face + 0.16, -0.2, 0, 0.15]
    const chew = [0.28, P.chest + 0.16, P.front + 0.32, -0.3]
    return {
      R: keys(t + 1.2, 1.7, [
        [0, hold],
        [0.16, lips, [0.06, 0, 0.12]],
        [0.26, lips],
        [0.34, tug],
        [0.5, chew, [0.04, 0.05, 0]],
        [0.62, hold],
        [0.74, chew],
        [0.86, hold],
      ]),
    }
  },
  type: (t, P) => {
    const tap = (seed: number) => {
      const i = Math.floor(t / 0.12)
      return rnd(i * 2 + seed) > 0.4 ? Math.sin((t / 0.12 - i) * Math.PI) : 0
    }
    const x = (t % 3.4) / 3.4
    const enter = x > 0.82 ? Math.sin(((x - 0.82) / 0.18) * Math.PI) : 0
    const drift = Math.sin(t * 0.7) * 0.07
    const key = (s: number, seed: number, e = 0) => [0.42 + s * drift, P.chest + 0.14 - tap(seed) * 0.1 * (1 - e) + e * 0.35, P.front + 0.32 + e * 0.04, -0.9 + tap(seed) * 0.3 + e * 0.6, -0.25]
    return { L: key(-1, 0), R: key(1, 9, enter), w: 26 }
  },
  wave: (t) => {
    const burst = pulse(t + 0.3, 2.2, 0.1)
    const a = Math.sin(t * 11) * burst
    return { R: [0.95 + a * 0.1, 2.3 - a * a * 0.06 + burst * 0.05, 0.3, -0.2, 0.2, 2.7 + a * 0.55], w: 20 }
  },
  cheer: (t) => {
    const pump = (o: number) => {
      const x = ((t * 6) / Math.PI + o) % 1
      return x < 0.3 ? ease(x / 0.3) : 1 - ease((x - 0.3) / 0.7)
    }
    return {
      L: [0.8, 2.1 + pump(0) * 0.3, 0.2, 0, 0, 2.8 - pump(0) * 0.3],
      R: [0.84, 2.1 + pump(0.18) * 0.3, 0.24, 0, 0, 2.8 - pump(0.18) * 0.3],
      w: 20,
    }
  },
  stroke: (t, P) => {
    const back = [0.15, P.R[1] - 0.04, P.front + 0.15, -1.1, 0, 0.2]
    const fwd = [0.15, P.R[1] - 0.06, P.front + 0.6, -1.4, 0, 0.1]
    const lift = [0.18, P.R[1] + 0.14, P.front + 0.4, -0.6, 0, 0.4]
    return { R: keys(t, 1.6, [[0, back], [0.6, fwd, [0, -0.04, 0]], [0.8, lift], [0.95, back]]) }
  },
  dine: (t: number, P: Frame): Pose => {
    const c = (((t + 3.1) % 5) + 5) % 5
    return c < 1.7 ? ARMS.eat(c - 1.2, P) : { R: [0.3, P.chest + 0.12, P.front + 0.3, -0.2] }
  },
  talk: (t, P) => {
    const gesture = (seed: number, dur: number) =>
      steps(t + seed, dur, (i) => {
        const r = [rnd(i * 3 + seed), rnd(i * 3 + seed + 1), rnd(i * 3 + seed + 2)]
        if (r[2] < 0.22) return [0.55, P.chest - 0.12, P.front + 0.02, 0, 0, 0.1]
        if (r[2] > 0.88) return [0.28, P.chest + 0.15, P.front + 0.45, -1.4, -0.2, 0]
        if (r[2] > 0.7) return [0.85, 1.45 + r[1] * 0.25, 0.25, -0.3, 0.3, 1.9]
        return [0.32 + r[0] * 0.35, P.chest + r[1] * 0.25, P.front + 0.18 + r[0] * 0.15, -0.6, 0.4 + r[1] * 0.4, 0.5 + r[0] * 0.7]
      })
    return { L: gesture(0, 0.85), R: gesture(7, 1.05) }
  },
  phone: (t, P) => {
    const look = pulse(t + 1.5, 5, 0.15)
    const typing = rnd(Math.floor(t / 1.6)) > 0.3 ? 1 : 0
    const tapR = typing * Math.max(0, Math.sin(t * 11))
    const tapL = typing * Math.max(0, -Math.sin(t * 11))
    const flick = (1 - typing) * Math.max(0, Math.sin(t * 6)) ** 4
    const y = P.chest + 0.02 + look * 0.1
    const z = P.front + 0.3 - look * 0.04
    const tilt = -2.35 - look * 0.15
    return {
      R: [0.26, y - tapR * 0.02 + flick * 0.03, z, tilt + tapR * 0.06 - flick * 0.1, -1.2, 0],
      L: [0.26, y - tapL * 0.02, z, tilt + tapL * 0.06, -1.2, 0],
    }
  },


  throw: (t, P) => {
    const rest = [0.55, P.chest - 0.08, P.front, 0]
    const cock = [0.85, P.chest + 0.75, -0.3, 1.0, 0, 0.8]
    const release = [0.25, P.chest + 0.7, P.front + 0.75, -1.3]
    const follow = [0.05, P.chest - 0.1, P.front + 0.45, -0.6, -0.4]
    return {
      R: keys(t, 1.5, [[0, rest], [0.35, cock, [0.15, 0, 0]], [0.47, cock], [0.56, release, [0.1, 0.15, 0]], [0.68, follow], [0.85, rest]]),
      L: keys(t, 1.5, [[0, [0.55, P.chest - 0.1, P.front]], [0.35, [0.45, P.chest + 0.3, P.front + 0.45, -1.2]], [0.5, [0.45, P.chest + 0.3, P.front + 0.45, -1.2]], [0.65, [0.6, P.chest - 0.1, -0.15]], [0.9, [0.55, P.chest - 0.1, P.front]]]),
      w: 24,
    }
  },
  draw: (t, P) => {
    const u = clamp01((t - 0.3) / 2.6)
    const zig = Math.sin(u * Math.PI * 7) * 0.06
    const R = [0.5 + 0.35 * u, P.chest + 0.35 + u * 0.4 + zig, -0.2 + 0.45 * u, -0.8, 0, 0.3]
    if (u >= 1) R[1] += Math.sin(t * 3) * 0.03
    const sell = pulse(t + 0.6, 2.2, 0.25)
    return { R, L: [0.5, P.chest + 0.05 + sell * 0.35, P.front + 0.3, -0.5 - sell * 0.3, 0.2, 0.3 + sell * 0.9] }
  },
  present: (t: number, P: Frame): Pose => {
    const back = pulse(t + 0.4, 3.2, 0.2)
    const talk = ARMS.talk(t, P)
    const L = [0.55 + back * 0.35, P.chest + 0.1 + back * 0.3, P.front + 0.1 - back * 0.35, -0.4, 0.3 + back * 0.5, 0.5 + back * 0.9]
    return { R: back > 0.05 ? L : talk.R, L: talk.L }
  },
  brush: (t, P) => ({
    R: [0.1 + Math.sin(t * 16) * 0.05, P.mouth - 0.04, P.face + 0.1, -0.3, 0, 1.3],
  }),
  stretch: (t) => ({ L: [0.45 + Math.sin(t * 2) * 0.12, 2.6, 0, 0, 0, 2.9], R: [0.45 - Math.sin(t * 2) * 0.12, 2.6, 0, 0, 0, 2.9] }),
  reach: (t, P) => {
    const back = [0.5, P.chest - 0.05, P.front - 0.08, 0.3]
    const out = [0.22, P.chest + 0.12, P.front + 0.7, -1.4, -0.2]
    const R = t < 0.16 ? mix(P.R, back, ease(t / 0.16)) : arc(back, out, ease(clamp01((t - 0.16) / 0.34)), [0.08, 0.12, 0])
    if (t > 0.5) {
      const u = t - 0.5
      R[1] += Math.sin(u * 9) * 0.03
      R[2] += Math.sin(u * 6) * 0.03
      R[3] += Math.sin(u * 9) * 0.25
    }
    return { R, L: [0.55, P.chest - 0.05, P.front + 0.1, -0.3, 0, 0.3] }
  },
  guard: (t, P) => ({ L: [0.05, P.chest, P.front + 0.15, -1.0], R: [0.05, P.chest + 0.08, P.front + 0.18, -1.0] }),
  dance: (t, P) => {
    const b = (t * 7) / Math.PI
    if (Math.floor(b / 4) % 2 === 0) {
      const i = Math.floor(b)
      const k = ease(clamp01((b - i) / 0.45))
      const up = [0.8, 2.25, 0.3, -0.3, 0, 2.6]
      const down = [0.45, 0.75, 0.3, -0.4, 0, 0.3]
      const side = (s: number) => (i % 2 === s ? arc(down, up, k, [0.15, 0, 0.1]) : arc(up, down, k, [0.15, 0, 0.1]))
      return { L: side(0), R: side(1), w: 20 }
    }
    const a = t * 10
    return {
      L: [0.25 + Math.cos(a) * 0.12, P.chest + 0.05 + Math.sin(a) * 0.1, P.front + 0.35, -0.9, 0, 0.6],
      R: [0.25 - Math.cos(a) * 0.12, P.chest + 0.05 - Math.sin(a) * 0.1, P.front + 0.35, -0.9, 0, 0.6],
      w: 20,
    }
  },
  game: (t, P) => ({
    L: [0.16, P.chest + 0.42 + Math.sin(t * 18) * 0.04, P.front + 0.62, -0.8, 0, Math.sin(t * 2.3) * 0.2],
    R: [0.18, P.chest + 0.42 + Math.cos(t * 13) * 0.05, P.front + 0.64, -0.8, 0, -Math.sin(t * 2.3) * 0.2],
    w: 24,
  }),
  shades: (t, P) => ({ L: [0.35, P.mouth - 0.1, -0.3, 0.6], R: [0.35, P.mouth - 0.1, -0.3, 0.6] }),
} satisfies Record<string, (t: number, P: Frame) => Pose>

export function groove(t: number) {
  const b = (t * 7) / Math.PI
  const w = Math.sin((Math.PI * b) / 2)
  const tap = Math.max(0, Math.sin(Math.PI * b)) ** 2
  const foot = (s: number): [number, number] => [0.09 * w + (s * w > 0 ? 0.08 * w : 0), s * w < 0 ? 0.07 * tap * -s * w : 0]
  return {
    body: { lift: -0.05 * (0.5 + 0.5 * Math.cos(2 * Math.PI * b)), side: 0.09 * w, roll: -0.05 * w, yaw: 0.2 * Math.sin((Math.PI * b) / 4) },
    feet: { [-1]: foot(-1), [1]: foot(1) } as Record<number, [number, number]>,
    nod: 0.14 * Math.max(0, Math.cos(2 * Math.PI * b)) ** 3,
    hands: 0.06 * (0.5 - 0.5 * Math.cos(2 * Math.PI * b)),
  }
}

const _gs = new THREE.Vector3()
export function grooveRig(bones: Record<string, THREE.Object3D | undefined>, t: number | null, hands?: boolean) {
  const g = t == null ? null : groove(t)
  for (const k of ['FootL', 'FootR']) {
    const f = bones[k]
    if (!f) continue
    f.userData.rest ??= f.position.clone()
    f.position.copy(f.userData.rest)
    if (!g) continue
    const unit = f.parent!.getWorldScale(_gs).x
    const [dx, dy] = g.feet[Math.sign(f.userData.rest.x) || 1]
    f.position.x += dx / unit
    f.position.y += dy / unit
  }
  if (!g) return
  if (bones.Head) bones.Head.rotation.x += g.nod
  if (hands)
    for (const k of ['HandL', 'HandR']) {
      const h = bones[k]
      if (h) h.position.y += g.hands / h.parent!.getWorldScale(_gs).x
    }
}

export type BodyPose = { lift?: number; side?: number; roll?: number; pitch?: number; yaw?: number }

export const BODIES = {
  dance: (t) => groove(t).body,
  cheer: (t) => ({ lift: Math.abs(Math.sin(t * 6)) * 0.45 }),
  spin: (t) => ({ yaw: t * 14 * Math.max(0, 1 - t / 2.2), lift: Math.abs(Math.sin(t * 9)) * 0.1 }),
  shiver: (t) => ({ roll: Math.sin(t * 55) * 0.04 }),
  laugh: (t) => ({ lift: Math.abs(Math.sin(t * 14)) * 0.08, pitch: -0.1 }),
  lean: (t) => ({ pitch: 0.18 + Math.sin(t * 1.5) * 0.04 }),
  stretch: (t) => ({ roll: Math.sin(t * 2) * 0.18 }),
  sink: (t) => ({ lift: -Math.min(t, 2) * 0.12 }),
  flop: (t) => ({ pitch: -0.3 * Math.min(1, t / 0.6) + Math.sin(t * 1.3) * 0.02 }),
  doze: (t) => ({ pitch: Math.min(t, 1.5) * 0.1 + Math.max(0, Math.sin(t * 1.8)) * 0.08, roll: Math.sin(t * 0.9) * 0.04 }),
  look: (t) => ({ yaw: Math.sin(t * 2.4) * 0.9 }),
  fume: (t) => ({ pitch: 0.1, lift: Math.abs(Math.sin(t * 8)) * 0.05, yaw: Math.sin(t * 2.6) * 0.15 }),
} satisfies Record<string, (t: number) => BodyPose>

export const bodyOf = (name?: string | null) =>
  name && Object.hasOwn(BODIES, name) ? (BODIES[name as keyof typeof BODIES] as (t: number) => BodyPose) : undefined
export const armsOf = (name?: string | null) =>
  name && Object.hasOwn(ARMS, name) ? (ARMS[name as keyof typeof ARMS] as (t: number, P: Frame) => Pose) : undefined

export type RigRest = { rest: { hand: { L: THREE.Vector3; R: THREE.Vector3 }; body: THREE.Box3 }; headBox: THREE.Box3; groundY: number }

export function bodyFrame(rig: RigRest): Frame {
  const { rest, headBox, groundY } = rig
  const side = (v: THREE.Vector3) => [Math.abs(v.x), v.y - groundY, v.z]
  return {
    L: side(rest.hand.L),
    R: side(rest.hand.R),
    sx: { L: Math.sign(rest.hand.L.x) || 1, R: Math.sign(rest.hand.R.x) || -1 },
    mouth: headBox.min.y - groundY + 0.18,
    face: headBox.max.z,
    front: rest.body.max.z,
    chest: (rest.body.min.y + rest.body.max.y) / 2 - groundY,
  }
}

type Side = 'L' | 'R'
function handGoal(P: Frame, s: Side, want: Vec, k: number, out: Float32Array) {
  const r = P[s]
  const sx = P.sx[s]
  out[0] = sx * (want[0] - r[0]) * k
  out[1] = (want[1] - r[1]) * k
  out[2] = (want[2] - r[2]) * k
  out[3] = (want[3] || 0) * k
  out[4] = sx * (want[4] || 0) * k
  out[5] = sx * (want[5] || 0) * k
  return out
}

const SIDES: Side[] = ['L', 'R']
type Spring = { x: Float32Array; v: Float32Array; g: Float32Array }
export type Hands = { L: Spring; R: Spring; lift: number | null; off: Record<string, Vec>; rot: Record<string, Vec> }
export function handRig(): Hands {
  const hand = () => ({ x: new Float32Array(6), v: new Float32Array(6), g: new Float32Array(6) })
  return { L: hand(), R: hand(), lift: null, off: {}, rot: {} }
}
export function stepHands(H: Hands, P: Frame, want: Pose | null | undefined, { k = 1, mirror = false, dt, now, lift = 0 }: { k?: number; mirror?: boolean; dt: number; now: number; lift?: number }) {
  const w = want?.w || 16
  const z = want?.z || 0.5
  const drop = H.lift == null ? 0 : lift - H.lift
  H.lift = lift
  for (const s of SIDES) {
    const h = H[s]
    const t = want?.[mirror ? (s === 'L' ? 'R' : 'L') : s]
    if (t) handGoal(P, s, t, k, h.g)
    else {
      const ph = s === 'L' ? 0 : 2.1
      h.g.fill(0)
      h.g[1] = Math.sin(now * 1.7 + ph) * 0.025
      h.g[2] = Math.sin(now * 0.9 + ph) * 0.02
      h.g[3] = Math.sin(now * 1.3 + ph) * 0.08
      h.g[5] = P.sx[s] * Math.sin(now * 1.1 + ph * 1.5) * 0.06
    }
    h.x[1] -= drop * 0.45
    const n = Math.ceil(Math.min(dt, 0.1) / (1 / 120))
    const d = Math.min(dt, 0.1) / n
    for (let i = 0; i < n; i++)
      for (let j = 0; j < 6; j++) {
        h.v[j] += (w * w * (h.g[j] - h.x[j]) - 2 * z * w * h.v[j]) * d
        h.x[j] += h.v[j] * d
      }
    H.off[`Hand${s}`] = [h.x[0], h.x[1], h.x[2]]
    H.rot[`Hand${s}`] = [h.x[3], h.x[4], h.x[5]]
  }
  return H
}
