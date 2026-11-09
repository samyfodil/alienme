import type * as THREE from 'three'
import type { Arms, Choice, Emote, Hold, Item, Menu, Motion, Phase, Point, Target } from './types'
import type { Pose, Rig } from '../three/Character'
import type { Live } from '../three/Npc'

export type Seat = { from: Point; to: Point; height: number; jump?: number; back?: number; lie?: boolean }

export type Acted = Omit<Choice, 'label' | 'arms' | 'bodyMotion' | 'hold' | 'menu'> & {
  label?: string
  arms?: Phase<Arms> | null
  bodyMotion?: Phase<Motion> | null
  hold?: Hold | null
  menu?: Menu | null
}

export type Acting = {
  choice: Acted
  t0: number
  out: number | null
  emote: Emote | null
  nextEmote: number
  emoteN: number
  seat?: Seat
  seated?: boolean
  landed?: boolean
  mirror?: boolean
  turnAt?: number | null
  leave?: boolean
}

export type Cam =
  | { mode: 'room'; cut?: boolean }
  | { mode: 'map'; follow?: boolean; at?: Point; h?: number; tilt?: number; cut?: boolean }
  | { mode: 'shot'; pos: THREE.Vector3; look: THREE.Vector3; rate?: number; cut?: boolean }

export type UfoState = { on: boolean; pos: THREE.Vector3; scale?: number; beam?: number; beamLen?: number; hull?: boolean }
export type BusState = { on: boolean; pos: THREE.Vector3; yaw: number }

export type Stage = 'land' | 'enter' | 'choose' | 'act' | 'menu' | 'leave' | 'out' | 'travel' | 'pickup'

export type Ctl = {
  start: Point
  face: number
  path: Point[] | null
  run?: boolean
  speed?: number | null
  pace?: number
  onArrive?: (() => void) | null
  onWaypoint?: ((i: number) => void) | null
  entry?: string | null

  group?: THREE.Group
  rig?: Rig
  layer?: Pose
  setClip?: (clip: string) => void
  hand: THREE.Vector3
  handBone?: 'HandL' | 'HandR'
  hidden: boolean
  lift?: number
  pscale?: number
  carry?: Item | null
  pose?: { arms: Arms; item?: Item } | null
  looked?: boolean
  gaze?: Point | null
  stride?: number
  squashAt?: number | null
  puffAt?: number
  hopAt?: number | null

  stage?: Stage | null
  act?: Acting | null
  seated?: { target?: Target; act: Acting } | null
  focus?: [number, number, number?, boolean?] | null

  cam: Cam
  cameraAt: Point
  lookAt?: THREE.Vector3
  indoor?: boolean
  dim?: number

  reg: Record<string, THREE.Group>
  npcs: Record<string, Live>
  arrivals: Record<string, { start?: number; dur?: number; goneAt?: number }>
  lights: THREE.Light[]

  emit?: (text: string, at: THREE.Vector3, kind?: string) => void
  puff?: (at: THREE.Vector3, size?: number) => void

  signal?: 'wait' | 'walk'

  ufo?: UfoState | null
  bus?: BusState | null
  landAt?: Point
  bedAt?: Point
  landInside?: number | null
  landWarp?: boolean
  landed?: boolean
  sparkAt?: number
  wake?: (() => void) | null

  clock?: THREE.Clock
}

export type CtlRef = { current: Ctl }
