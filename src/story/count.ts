import { BEATS, START, WAKE, FARE, CROSSING } from '../data/story3d'
import { entryOf } from './engine'
import { ALIEN_KEYS } from '../data/aliens'
import { PLACES } from '../data/city'
import type { Alien } from './types'

export type Wins = Record<Alien, { combos: number; blind: number }>

export const storyJSON = () =>
  JSON.stringify({ beats: BEATS.map((b) => (entryOf(b) ? { ...b, asks: [entryOf(b), ...b.asks] } : b)), start: START, wake: WAKE, fare: FARE, crossing: CROSSING, aliens: ALIEN_KEYS, places: PLACES }, (k, v: unknown) => (k === 'nextIf' && v ? Object.entries(v as object) : v))

export const EVEN = 0.02
export const share = () => 1 / ALIEN_KEYS.length
export const uneven = (wins: Wins) => ALIEN_KEYS.flatMap((a) => (['combos', 'blind'] as const).filter((m) => Math.abs(wins[a][m] - share()) > EVEN).map((m) => ({ alien: a, measure: m, share: wins[a][m] })))
