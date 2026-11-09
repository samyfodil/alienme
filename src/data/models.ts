// CUTES by J-Toastie (CC-BY 3.0, poly.pizza)
const base = './models/cutes'
export const cutesUrl = (key: string) => `${base}/${key}.glb`
export const sceneUrl = (path: string) => `./models/scenes/${path}.glb`

export type Named = [key: string, label: string]

export type Colors = { hair: string | null; hair2: string | null; top: string | null; top2: string | null; shoes: string | null }

export interface Avatar {
  photo: string | null
  head: string
  body: string
  outfit: string
  shoes: string
  skin: string
  colors: Colors
  eyewear: string
  headgear: string
  face: string
}

export const REF = 'generic-male'
export const DEFAULT_HUMAN = 'generic-male'

export const PRESETS: Named[] = [
  ['generic-male', 'Average Guy'],
  ['generic-female', 'Average Gal'],
  ['citizen-1', 'Commuter'],
  ['citizen-2', 'Skater'],
  ['citizen-3', 'Influencer'],
  ['crypto-bro', 'Crypto Bro'],
  ['food-worker', 'Fry Cook'],
  ['retail-worker', 'Retail Hero'],
  ['male-officer', 'Officer'],
  ['female-officer', 'Officer (F)'],
  ['prisoner', 'Escapee'],
  ['santa-claus', 'Santa'],
  ['chicken-guy', 'Chicken Guy'],
]

export const HEADS: Named[] = [
  ['generic-male', 'Bald'],
  ['prisoner', 'Buzzcut'],
  ['retail-worker', 'Side part'],
  ['generic-female', 'Bob'],
  ['citizen-3', 'Long hair'],
  ['citizen-2', 'Afro'],
  ['citizen-1', 'Earring'],
  ['crypto-bro', 'Specs'],
  ['food-worker', 'Bowler'],
  ['male-officer', 'Cop + tache'],
  ['female-officer', 'Cop cap'],
  ['santa-claus', 'Santa'],
  ['chicken-guy', 'Chicken mask'],
]

export const OUTFITS: Named[] = [
  ['generic-male', 'Tee'],
  ['generic-female', 'Top'],
  ['citizen-1', 'Tank'],
  ['citizen-2', 'Hoodie'],
  ['citizen-3', 'Dress'],
  ['crypto-bro', 'Crew neck'],
  ['food-worker', 'Uniform'],
  ['retail-worker', 'Vest'],
  ['male-officer', 'Police'],
  ['prisoner', 'Jumpsuit'],
  ['santa-claus', 'Santa suit'],
  ['chicken-guy', 'Chicken suit'],
]

const FEMALE_CUT = new Set(['generic-female', 'citizen-2', 'citizen-3'])
const FEMALE_ONLY = new Set(['generic-female', 'citizen-3'])
export const outfitsFor = (body: string) => (body === 'female' ? OUTFITS : OUTFITS.filter(([k]) => !FEMALE_ONLY.has(k)))
export const fitOutfit = (body: string, outfit: string) => (body === 'female' || !FEMALE_ONLY.has(outfit) ? outfit : 'generic-male')

export const BODIES: Named[] = [
  ['male', 'Male'],
  ['female', 'Female'],
]

export const FEMALE_TORSO: Record<string, string> = {
  'generic-male': 'generic-female',
  'generic-female': 'generic-female',
  'citizen-1': 'generic-female',
  'citizen-2': 'citizen-2',
  'citizen-3': 'citizen-3',
  'crypto-bro': 'generic-female',
  'food-worker': 'citizen-3',
  'retail-worker': 'generic-female',
  'male-officer': 'citizen-3',
  prisoner: 'generic-female',
  'santa-claus': 'citizen-3',
  'chicken-guy': 'generic-female',
}

export type Style = {
  flare?: number
  waist?: number
  belt?: { y: number; h: number }
  buckle?: boolean
  trim?: { h: number }
  apron?: { x: number; y0: number; y1: number }
  graft?: boolean
  colors?: Record<string, string>
}

export const FEMALE_STYLE: Record<string, Style> = {
  'male-officer': { flare: 0.3, waist: 0.47, belt: { y: 0.45, h: 0.055 }, buckle: true, colors: { belt: '#15161c', buckle: '#f2b632' } },
  'santa-claus': {
    flare: 0.34,
    waist: 0.5,
    belt: { y: 0.52, h: 0.06 },
    buckle: true,
    trim: { h: 0.07 },
    colors: { belt: '#15161c', buckle: '#f2b632', trim: '#f2eee8' },
  },
  'food-worker': { flare: 0.28, waist: 0.47, apron: { x: 0.17, y0: 0.27, y1: 0.66 }, colors: { apron: '#1d1f2b' } },
  'citizen-3': { flare: 0.3, waist: 0.52, belt: { y: 0.55, h: 0.04 }, buckle: true, colors: { belt: '#15161c', buckle: '#f4f4f4' } },
}

const MALE_STYLE: Record<string, Style> = {
  'citizen-2': { graft: true },
}

export function torsoFor(body: string, outfit: string) {
  if (body === 'female') return FEMALE_TORSO[outfit] || 'generic-female'
  return FEMALE_CUT.has(outfit) ? 'generic-male' : outfit
}
export const styleFor = (body: string, outfit: string): Style | null => (body === 'female' ? FEMALE_STYLE : MALE_STYLE)[outfit] ?? null

export const partsOf = (look: Avatar) => [REF, look.head, look.outfit, look.shoes, torsoFor(look.body, look.outfit)]

const FEMALE_PRESETS = new Set(['generic-female', 'citizen-3', 'female-officer'])

export const SHOES: Named[] = [
  ['generic-male', 'Sneakers'],
  ['citizen-1', 'Boots'],
  ['citizen-3', 'Heels'],
  ['retail-worker', 'Two-tone'],
  ['prisoner', 'High-tops'],
  ['santa-claus', 'Cuffed boots'],
  ['chicken-guy', 'Chicken feet'],
]

export const SKIN_TONES = ['#f6d3b3', '#efbf94', '#d9a066', '#b97a4f', '#8d5634', '#5c3a24']

export const PAINT = [
  '#1d1f2b', '#f2f2f2', '#8a8f99', '#e53946', '#ff8a3d', '#ffd23f',
  '#3ccf6e', '#21b5c7', '#3b6cf6', '#8f5bff', '#ff6fb5', '#7a4a2a',
]

export const HAIR = ['#1b1512', '#4a2d1c', '#8b5a2b', '#e0b360', '#c9452f', '#e9e4dc', '#ff6fb5', '#3b6cf6']

export const EYEWEAR: Named[] = [
  ['none', 'None'],
  ['glasses', 'Glasses'],
  ['shades', 'Shades'],
  ['3d', '3D specs'],
]

export const HEADGEAR: Named[] = [
  ['none', 'None'],
  ['headphones', 'Headphones'],
  ['bow', 'Bow'],
  ['party', 'Party hat'],
  ['halo', 'Halo'],
]

export const FACE: Named[] = [
  ['none', 'None'],
  ['tache', 'Moustache'],
  ['blush', 'Blush'],
]

export const COLOR_SLOTS: [slot: keyof Colors, label: string, palette: string[]][] = [
  ['hair', 'Hair / hat', HAIR],
  ['hair2', 'Head accent', PAINT],
  ['top', 'Outfit', PAINT],
  ['top2', 'Outfit accent', PAINT],
  ['shoes', 'Shoes', PAINT],
]

const keys = (list: Named[]) => list.map(([k]) => k)
const pick = <T>(a: T[]): T => a[Math.floor(Math.random() * a.length)]

export const emptyColors = (): Colors => ({ hair: null, hair2: null, top: null, top2: null, shoes: null })

export function presetAvatar(key: string, keep: Partial<Avatar> = {}): Avatar {
  const skin = ({ 'citizen-1': SKIN_TONES[4], 'citizen-2': SKIN_TONES[4], 'female-officer': SKIN_TONES[4] } as Record<string, string>)[key]
  return {
    photo: null,
    ...keep,
    head: key,
    body: FEMALE_PRESETS.has(key) ? 'female' : 'male',
    outfit: OUTFITS.some(([k]) => k === key) ? key : 'male-officer',
    shoes: SHOES.some(([k]) => k === key) ? key : 'generic-male',
    skin: skin || SKIN_TONES[1],
    colors: emptyColors(),
    eyewear: 'none',
    headgear: 'none',
    face: 'none',
  }
}

export function randomAvatar(keep: Partial<Avatar> = {}): Avatar {
  const maybe = (list: string[]) => (Math.random() < 0.5 ? null : pick(list))
  const body = pick(keys(BODIES))
  return {
    photo: null,
    ...keep,
    head: pick(keys(HEADS)),
    body,
    outfit: pick(keys(outfitsFor(body))),
    shoes: pick(keys(SHOES)),
    skin: pick(SKIN_TONES),
    colors: { hair: maybe(HAIR), hair2: maybe(PAINT), top: maybe(PAINT), top2: maybe(PAINT), shoes: maybe(PAINT) },
    eyewear: Math.random() < 0.6 ? 'none' : pick(keys(EYEWEAR).slice(1)),
    headgear: Math.random() < 0.65 ? 'none' : pick(keys(HEADGEAR).slice(1)),
    face: Math.random() < 0.7 ? 'none' : pick(keys(FACE).slice(1)),
  }
}
