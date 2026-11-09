import { create } from 'zustand'
import { persist, createJSONStorage, type StateStorage } from 'zustand/middleware'
import { presetAvatar, DEFAULT_HUMAN, type Avatar, type Colors } from './data/models'
import { zeroScores, addWeights, winnerOf, type Scores } from './story/score'
import type { Alien, Dice, Flags, Score, Toss } from './story/types'

export type Phase = 'intro' | 'builder' | 'story' | 'reveal'
export type Day = { room: string; flags: Flags; cross: 'wait' | 'look' | 'run' | null; scores: Scores; picks: Score[] }

type Saved = { phase: Phase; avatar: Avatar; name: string; scores: Scores; picks: Score[]; day: Day | null; dice: Dice }

const toss = (): Toss => (Math.random() < 0.5 ? 'she' : 'he')
const roll = (): Dice => ({ jo: toss(), boss: toss() })
type Game = Saved & {
  setPhase: (phase: Phase) => void
  setName: (name: string) => void
  updateAvatar: (patch: Partial<Avatar>) => void
  setAvatarColor: (slot: keyof Colors, c: string | null) => void
  addScores: (weights?: Score) => void
  saveDay: (day: Day) => void
  winner: () => Alien
  restart: () => void
  reset: () => void
  exit: () => void
}

const fresh = (): Saved => ({
  phase: 'intro',
  avatar: presetAvatar(DEFAULT_HUMAN),
  name: '',
  scores: zeroScores(),
  picks: [],
  day: null,
  dice: roll(),
})

const shortcut = import.meta.env.DEV && window.location.search.length > 1
const disk: StateStorage = {
  getItem: (k) => {
    try {
      return shortcut ? null : localStorage.getItem(k)
    } catch {
      return null
    }
  },
  setItem: (k, v) => {
    try {
      if (!shortcut) localStorage.setItem(k, v)
    } catch {
    }
  },
  removeItem: (k) => {
    try {
      localStorage.removeItem(k)
    } catch {
    }
  },
}

export const useGame = create<Game>()(
  persist(
    (set, get) => ({
      ...fresh(),

      setPhase: (phase) => set({ phase }),
      setName: (name) => set({ name }),
      updateAvatar: (patch) => set((s) => ({ avatar: { ...s.avatar, ...patch } })),
      setAvatarColor: (slot, c) =>
        set((s) => ({ avatar: { ...s.avatar, colors: { ...s.avatar.colors, [slot]: c } } })),

      addScores: (weights = {}) => set((s) => ({ scores: addWeights(s.scores, weights), picks: [...s.picks, weights] })),
      saveDay: (day) => set({ day }),

      winner: () => winnerOf(get().scores, get().picks),

      restart: () => set({ phase: 'builder', scores: zeroScores(), picks: [], day: null, dice: roll() }),
      reset: () => set(fresh()),
      exit: () => set({ phase: 'intro', scores: zeroScores(), picks: [], day: null, dice: roll() }),
    }),
    {
      name: 'alienme',
      version: 1,
      storage: createJSONStorage(() => disk),
      partialize: ({ phase, avatar, name, scores, picks, day, dice }) => ({ phase, avatar, name, scores, picks, day, dice }),
      merge: (saved, live) => {
        const s = { ...live, ...(saved as Partial<Saved>) }
        if (s.phase === 'story') Object.assign(s, { scores: s.day?.scores ?? zeroScores(), picks: s.day?.picks ?? [] })
        return s
      },
    },
  ),
)
