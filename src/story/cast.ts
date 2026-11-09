import { useGame } from '../store'
import { CAST } from '../data/story3d'
import { CAST_TOKEN } from './engine'
import type { CastRole, Person } from './types'

export const castOf = (role: CastRole): Person => {
  const { avatar, dice } = useGame.getState()
  return CAST[role](avatar, dice)
}

type Word = 'they' | 'them' | 'their' | 'person'

export function say(text: string): string
export function say<T>(text: T): T
export function say(text: unknown) {
  if (typeof text !== 'string') return text
  return text.replace(CAST_TOKEN, (m, role: string, form?: string) => {
    if (!(role in CAST)) return m
    const who = castOf(role as CastRole)
    if (!form) return who.name
    const word = who[form.toLowerCase() as Word]
    return form[0] === form[0].toUpperCase() ? word[0].toUpperCase() + word.slice(1) : word
  })
}
