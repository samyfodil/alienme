import { ALIEN_KEYS } from '../data/aliens'
import type { Alien, Score } from './types'

export type Scores = Record<Alien, number>
const ALIENS = ALIEN_KEYS

export const zeroScores = () => Object.fromEntries(ALIENS.map((k) => [k, 0])) as Scores

export function addWeights(scores: Scores, weights: Score = {}): Scores {
  const out = { ...scores }
  for (const [k, w] of Object.entries(weights) as [Alien, number][]) if (k in out) out[k] += w
  return out
}

export function winnerOf(scores: Scores, picks: Score[]): Alien {
  const max = Math.max(...ALIENS.map((k) => scores[k]))
  const tied = ALIENS.filter((k) => scores[k] === max)
  for (let i = picks.length - 1; i >= 0; i--) {
    const lean = Math.max(...tied.map((k) => picks[i][k] || 0))
    if (lean > 0) return tied.find((k) => (picks[i][k] || 0) === lean)!
  }
  return tied[0]
}
