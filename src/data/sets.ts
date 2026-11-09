import type { Box } from '../three/nav'
import type { Model, Point } from '../story/types'

export const FLOOR = { w: 11, d: 8, z: -0.6 }

export interface RoomSet {
  floor: string
  light: string
  walls?: { color: string; trim: string; windows?: string; windowsAt?: number[]; strip?: boolean }
  decor: { model: Model; at: Point; rotY?: number; y?: number; scale?: number }[]
  ground?: boolean
  lights?: { at: [number, number, number]; color: string }[]
  water?: { z0: number; z1: number; color: string }
}

export const SETS = {
  home: {
    floor: '#c89a6a',
    walls: { color: '#ead7bd', trim: '#a8744f', windows: '#ffd99a' },
    light: '#ffd9a8',
    decor: [
      { model: 'home/lamp-floor', at: [-4.95, -2.85] },
      { model: 'office/desk', at: [2.7, -1.9], rotY: Math.PI },
    ],
  },
  city: {
    floor: '#7d8597',
    light: '#cfe3ff',
    decor: [
      { model: 'city/building-red', at: [-3.4, -3.9] },
      { model: 'city/building-green', at: [0, -3.9] },
      { model: 'city/building-brown', at: [3.4, -3.9] },
      { model: 'city/street-light', at: [-5, -1.2], rotY: 1.57 },
      { model: 'city/trash-can', at: [-4.9, -2.6] },
      { model: 'city/fire-hydrant', at: [-4.9, 0.6] },
    ],
  },
  office: {
    floor: '#8f9bb3',
    walls: { color: '#d9dfea', trim: '#5d6b85', windows: '#bfe4ff' },
    light: '#e8f0ff',
    decor: [
      { model: 'office/vending-machine', at: [-3.9, -3.95] },
      { model: 'home/potted-plant', at: [-5.05, -2.6] },
      { model: 'office/drawer', at: [3.9, -4.0] },
      { model: 'office/drawer', at: [4.85, -4.0] },
      { model: 'home/potted-plant', at: [4.95, -1.4] },
    ],
  },
  diner: {
    floor: '#d9655b',
    walls: { color: '#f4cdd6', trim: '#2bb5a6', windows: '#ffe2a8' },
    light: '#ffc9a8',
    decor: [
      { model: 'diner/counter', at: [3.3, -4.15] },
      { model: 'diner/counter', at: [4.63, -4.15] },
      { model: 'diner/milkshake', at: [3.3, -4.15], y: 1.3 },
      { model: 'diner/burger', at: [4.63, -4.15], y: 1.3 },
      { model: 'diner/bar-stool', at: [-4.2, -3.8] },
      { model: 'diner/bar-stool', at: [-3.1, -3.8] },
      { model: 'home/potted-plant', at: [5.0, -1.4] },
    ],
  },
  nature: {
    floor: '#5f9a4e',
    light: '#fff1c9',
    decor: [
      { model: 'nature/pine', at: [-5.0, -4.4] },
      { model: 'nature/tree-3', at: [4.5, -4.0] },
      { model: 'nature/fern', at: [4.8, -1.0] },
      { model: 'nature/grass', at: [-5.0, 0.4] },
      { model: 'nature/grass-wispy', at: [-5.0, -1.4] },
      { model: 'nature/flowers-b', at: [-0.9, -3.9] },
      { model: 'nature/pebbles', at: [1.4, -3.7] },
    ],
  },
  kitchen: {
    floor: '#d9c7a6',
    walls: { color: '#f3efe2', trim: '#5fa8a0', windows: '#cfeaff', windowsAt: [-0.74] },
    light: '#fff1d6',
    decor: [
      { model: 'home/kitchen-cabinet-upper', at: [-3.4, -4.1], y: 1.95 },
      { model: 'home/kitchen-cabinet-upper', at: [1.92, -4.1], y: 1.95 },
      { model: 'home/trashcan', at: [4.75, -3.95] },
      { model: 'home/plant-small', at: [1.92, -3.8], y: 1.4 },
      { model: 'home/coat-rack', at: [-4.9, -3.3] },
    ],
  },
  beach: {
    ground: true,
    floor: '#f3dfb3',
    light: '#fff6dc',
    decor: [
      { model: 'nature/grass-wispy', at: [-4.9, -3.9] },
      { model: 'nature/grass-wispy', at: [-2.5, -4.1] },
      { model: 'nature/grass', at: [-4.8, -2.6] },
      { model: 'nature/pebbles', at: [-4.6, 2.2] },
    ],
  },
  arcade: {
    floor: '#2b2147',
    walls: { color: '#1b1530', trim: '#ff4fd8', strip: true },
    light: '#c89bff',
    lights: [
      { at: [-3, 2.4, -2.5], color: '#ff4fd8' },
      { at: [3, 2.4, -2.5], color: '#4fd8ff' },
    ],
    decor: [
      { model: 'diner/arcade-machine', at: [-4.65, -4.0] },
      { model: 'diner/arcade-machine', at: [-3.55, -4.0] },
      { model: 'city/trash-can', at: [4.9, -1.2] },
      { model: 'home/potted-plant', at: [4.9, -3.8] },
      { model: 'reveal/spotlight-motorised', at: [-4.9, -1.4] },
    ],
  },
  party: {
    floor: '#3a2b4f',
    walls: { color: '#2c2140', trim: '#ffd23f', windows: '#ff9ef0' },
    light: '#ffb8f0',
    lights: [
      { at: [-3, 2.6, -1.5], color: '#ff4fd8' },
      { at: [3, 2.6, -1.5], color: '#4fd8ff' },
      { at: [0, 2.8, 0.5], color: '#ffd23f' },
    ],
    decor: [
      { model: 'reveal/spotlight-motorised', at: [-5.0, -4.1] },
      { model: 'reveal/spotlight-motorised', at: [4.8, -3.9] },
      { model: 'diner/cupcake', at: [2.2, -0.1], y: 1.15 },
      { model: 'diner/soda-cup', at: [3.2, -0.5], y: 1.15 },
      { model: 'home/potted-plant', at: [4.9, -1.6] },
      { model: 'home/bookcase', at: [0.4, -4.05] },
    ],
  },
  lobby: {
    floor: '#cbc6bd',
    walls: { color: '#eef0f2', trim: '#3a4a63', windows: '#cfe3ff' },
    light: '#f4f6ff',
    decor: [
      { model: 'home/potted-plant', at: [5.0, -3.6] },
      { model: 'home/potted-plant', at: [-5.0, -1.4] },
    ],
  },
  bathroom: {
    floor: '#cfdfe4',
    walls: { color: '#f1f6f7', trim: '#6fa8b8', windows: '#cdeeff', windowsAt: [-1.4] },
    light: '#fff4e0',
    decor: [
      { model: 'home/plant-small', at: [5.0, -3.9] },
      { model: 'home/trashcan', at: [2.7, -3.95] },
    ],
  },
  seafood: {
    floor: '#4f7f8f',
    walls: { color: '#e6f0ee', trim: '#1f4e6b', windowsAt: [] },
    light: '#ffd2a0',
    decor: [
      { model: 'home/side-table', at: [3.9, -4.1] },
      { model: 'home/lamp-table', at: [3.35, -4.1], y: 1.18 },
      { model: 'diner/pie', at: [4.35, -4.1], y: 1.18 },
      { model: 'home/coat-rack', at: [4.95, -1.4] },
    ],
  },
  living: {
    floor: '#b48a64',
    walls: { color: '#dfe6ee', trim: '#6b7f99', windows: '#24345e' },
    light: '#ffd9a8',
    decor: [
      { model: 'home/bookcase', at: [0.6, -4.05] },
      { model: 'home/potted-plant', at: [4.95, -3.6] },
      { model: 'home/armchair', at: [-4.9, -0.2], rotY: 1.3 },
      { model: 'home/side-table', at: [4.8, -0.4], rotY: -1.57 },
      { model: 'home/lamp-table', at: [4.8, -0.4], y: 1.18 },
    ],
  },
} satisfies Record<string, RoomSet>

export const WALL = { h: 3.2, t: 0.2, sideTo: -0.8 }

export function wallRects(set: RoomSet | undefined): Box[] {
  const water: Box[] = set?.water
    ? [{ x: 0, z: (set.water.z0 + set.water.z1) / 2, hw: FLOOR.w / 2, hd: (set.water.z1 - set.water.z0) / 2, rot: 0 }]
    : []
  if (!set?.walls) return water
  const back = FLOOR.z - FLOOR.d / 2 + WALL.t / 2
  const len = WALL.sideTo - back
  return [
    { x: 0, z: back, hw: FLOOR.w / 2, hd: WALL.t / 2, rot: 0 },
    { x: -FLOOR.w / 2 + WALL.t / 2, z: back + len / 2, hw: WALL.t / 2, hd: len / 2, rot: 0 },
    { x: FLOOR.w / 2 - WALL.t / 2, z: back + len / 2, hw: WALL.t / 2, hd: len / 2, rot: 0 },
  ]
}
