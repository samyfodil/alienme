import type { Alien } from '../data/aliens'
import type { Avatar } from '../data/models'
import type { PROPS } from '../data/props'
import type { SETS } from '../data/sets'
import type { CAST } from '../data/story3d'
import type { ARMS, BODIES, ITEMS } from '../three/acts'
import type { BUILT } from '../three/Built'

export type { Alien, Avatar }
export type Theme = keyof typeof SETS
export type Model = keyof typeof PROPS
export type Item = keyof typeof ITEMS
export type Arms = keyof typeof ARMS
export type Motion = keyof typeof BODIES
export type NpcMotion = Motion | Arms
export type Build = keyof typeof BUILT
export type Body = Motion | 'sit' | 'lie' | 'hide' | 'crouch' | 'jog' | 'gone' | 'floor'
export type CastRole = keyof typeof CAST
export type Toss = 'she' | 'he'
export type Dice = { jo: Toss; boss: Toss }

export type Point = [number, number]
export type Spot = { at: Point; rotY: number }
export type Condition = string
export type Flags = string[]
export type FlagChange = string | string[]
export type Time = string
export type Score = Partial<Record<Alien, number>>
export type Target = string | Point
export type Phase<T> = T | [T | null, number?][]
export type Way = string | { to: string; by?: 'bus' | 'ride' } | { fork: string[] }

export interface Person {
  name: string
  look: Avatar
  they: string
  them: string
  their: string
  person: string
}

export interface Emote {
  text: string | string[]
  from?: number
  every?: number
}
export type EmoteSpec = string | string[] | Emote

export interface Hold {
  item: Item
  at?: number
  until?: number
  keep?: boolean
}

export interface Fx {
  type: 'anim' | 'banner' | 'bounce' | 'come' | 'confetti' | 'dark' | 'emit' | 'glow' | 'pop' | 'shake' | 'spawn' | 'splash' | 'take' | 'water'
  prop?: string
  at?: Point | number
  at0?: number
  until?: number
  dur?: number
  every?: number
  text?: string | string[]
  height?: number
  item?: Item | Model
  build?: Build
  grow?: number
  low?: boolean
  clip?: string
  dist?: number
  x?: number
  y?: number
  z?: number
  color?: string
  power?: number
  flicker?: boolean
  keep?: boolean
  when?: Condition
}

export interface Text {
  at: Time
  text: string
  when?: Condition
  me?: boolean
}

export interface Phone {
  from: string
  texts?: Text[]
  call?: boolean
}

export interface Reaction {
  id: string
  react?: NpcMotion
  for?: number
  emote?: string
  at0?: number
  emoteAt?: number
  walk?: Point
  leave?: Point[]
}

export interface Outcome {
  reaction?: string
  emote?: EmoteSpec
  npc?: Omit<Reaction, 'id'>
  sets?: FlagChange
  clears?: FlagChange
  score?: Score
  hush?: boolean
  ride?: boolean
}

export interface Option extends Outcome {
  label: string
  icon?: string
  odds?: number
  win?: Outcome
  lose?: Outcome
  item?: Item
  fetch?: { prop: string; from: Point; item: Item }
  arms?: Phase<Arms>
  fx?: Fx[]
  time?: number
  sayAt?: number
  stash?: boolean
  leave?: boolean
  how?: 'wait' | 'look' | 'run'
}

export interface Menu {
  prompt: string
  at?: number
  options: Option[]
  serve?: { npc: string; pickup: Point }
  wait?: string
  by?: string
  stop?: string
}

export interface Act {
  target?: Target
  body?: Body
  bodyMotion?: Phase<Motion>
  arms?: Phase<Arms>
  hold?: Hold
  face?: number
  time?: number
  sleep?: boolean
  asleep?: boolean
  fx?: Fx[]
  npc?: Reaction
  emote?: EmoteSpec
  reaction?: string
  sayAt?: number
  phone?: Phone
  menu?: Menu
  until?: string
}

export interface Choice extends Act {
  label: string
  icon?: string
  when?: Condition
  to?: Way
  door?: string
  sets?: FlagChange
  clears?: FlagChange
  score?: Score
}

export type Extra = Omit<Choice, 'score'>

export interface Ask {
  q: string
  choices: Choice[]
  when?: Condition
  time?: Time
  phone?: Phone
  at?: Point
  look?: string
  think?: boolean
}

export interface Prop {
  id?: string
  model?: Model
  build?: Build
  item?: Item
  animal?: 'cat' | 'dog'
  cutes?: string
  at: Point
  y?: number
  rotY?: number
  scale?: number
  height?: number
  size?: Point
  stand?: number
  fixed?: boolean
  when?: Condition
}

export interface Npc {
  id: string
  name?: string | boolean
  look?: Avatar
  cast?: CastRole
  castIf?: Record<Condition, CastRole>
  at: Point
  rotY?: number
  clip?: string
  mood?: NpcMotion
  moodIf?: Record<Condition, NpcMotion>
  patrol?: Point[]
  arrive?: Point[]
  leave?: Point[]
  sit?: string
  height?: number
  when?: Condition
}

export interface Door {
  to: string
  wall?: -1 | 0 | 1
  at?: number
  also?: string[]
}

export interface Beat {
  id: string
  title: string
  titleIf?: Record<Condition, string>
  time: Time
  timeIf?: Record<Condition, Time>
  theme: Theme
  caption: string
  captionIf?: Record<Condition, string>
  props: Prop[]
  npcs?: Npc[]
  enter?: Act
  asks: Ask[]
  extras?: Extra[]
  next?: Way
  nextIf?: Record<Condition, Way>
  doors?: Door[]
  sets?: FlagChange
  clears?: FlagChange
  busAway?: Condition
  ambient?: Fx[]
}

export interface Card {
  prompt: string
  options: Option[]
  when?: Condition
  time?: Time
}
