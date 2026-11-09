import { create } from 'zustand'

export type Switch = { label: string; on: boolean }
export type Slider = { label: string; value: number; min: number; max: number; step: number; of: string }

export const LOOK = {
  outline: { label: 'Outlines', on: true },
  outlineWidth: { label: 'Outline width', value: 1.6, min: 0.5, max: 3, step: 0.1, of: 'outline' },
  outlineStrength: { label: 'Outline darkness', value: 0.85, min: 0, max: 1, step: 0.05, of: 'outline' },
  pastel: { label: 'Pastel lift', on: true },
  pastelLift: { label: 'Pastel amount', value: 0.1, min: 0, max: 0.3, step: 0.01, of: 'pastel' },
  grade: { label: 'Colour grade', on: true },
  ao: { label: 'Soft shadows (AO)', on: true },
  bloom: { label: 'Bloom', on: true },
  vignette: { label: 'Vignette', on: true },
  townPastel: { label: 'Pastel town', on: true },
  sway: { label: 'Trees sway', on: true },
  squash: { label: 'Squash and stretch', on: true },
  pops: { label: 'Things pop in', on: true },
  puffs: { label: 'Dust puffs', on: true },
  backdrop: { label: 'Starry backdrop', on: true },
} satisfies Record<string, Switch | Slider>
export type Key = keyof typeof LOOK
type Values = { [K in Key]: (typeof LOOK)[K] extends Slider ? number : boolean }
const defaults = () => Object.fromEntries(Object.entries(LOOK).map(([k, v]) => [k, 'value' in v ? v.value : v.on])) as Values

const KEY = 'alienme-look'
function saved(): Partial<Values> {
  if (!import.meta.env.DEV) return {}
  try {
    return JSON.parse(localStorage.getItem(KEY) ?? 'null') || {}
  } catch {
    return {}
  }
}

type LookState = Values & { setLook: (k: Key, v: number | boolean) => void; resetLook: () => void }

export const useLook = create<LookState>()((set) => ({
  ...defaults(),
  ...saved(),
  setLook: (k, v) =>
    set((s) => {
      const next = { ...s, [k]: v }
      try {
        localStorage.setItem(KEY, JSON.stringify(Object.fromEntries((Object.keys(LOOK) as Key[]).map((x) => [x, next[x]]))))
      } catch {}
      return { [k]: v }
    }),
  resetLook: () => {
    try {
      localStorage.removeItem(KEY)
    } catch {}
    set(defaults())
  },
}))
