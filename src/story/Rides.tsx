import { useRef, useEffect } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import { BLOCK, LANDING, drivePath } from '../data/city'
import { span, GROUND, _c } from './stage'
import { compile } from '../three/warm'
import type { BusState, CtlRef, Stage } from './ctl'
import type { Point } from './types'

const _p = new THREE.Vector3()


type SaucerProps = {
  ctl: CtlRef
  stage: 'land' | 'pickup'
  setStage: (s: Stage) => void
  onPickedUp: () => void
  onSettled?: () => void
  warp: (then: () => void) => void
}

export function Saucer({ ctl, stage, setStage, onPickedUp, onSettled, warp }: SaucerProps) {
  const t0 = useRef<number | null>(null)
  const done = useRef(false)
  useEffect(() => {
    t0.current = null
    done.current = false
  }, [stage])
  const settle = useRef<{ since: number; smooth: number; count: number; compiled: boolean } | null>(null)
  useFrame(({ clock, gl, scene, camera }, delta) => {
    const c = ctl.current
    if (c.stage !== stage) return
    if (t0.current == null && stage === 'land') {
      const w = (settle.current ??= { since: clock.elapsedTime, smooth: 0, count: -1, compiled: false })
      let n = 0
      scene.traverse(() => n++)
      if (n !== w.count) {
        w.count = n
        w.compiled = false
        compile(gl, scene, camera, scene).then(() => n === w.count && (w.compiled = true))
      }
      w.smooth = delta < 0.04 ? w.smooth + 1 : 0
      if ((w.compiled && w.smooth >= 12) || clock.elapsedTime - w.since > 5) {
        t0.current = clock.elapsedTime
        onSettled?.()
      }
    } else if (t0.current == null) t0.current = clock.elapsedTime
    const t = t0.current == null ? 0 : clock.elapsedTime - t0.current
    const end = (next: () => void) => {
      if (done.current) return
      done.current = true
      next()
      c.stage = null
    }
    const [lx, lz] = stage === 'land' ? (c.landAt ?? LANDING) : [c.group!.position.x, c.group!.position.z]
    const hover = GROUND + 7.5
    if (stage === 'land') {
      if (!c.act) c.face = 0
      if (c.landInside == null) {
        const down = span(t, 0, 1.8)
        const sway = span(t, 1.8, 2.4) * Math.sin(t * 2.4) * 0.5
        c.ufo = {
          on: true,
          pos: new THREE.Vector3(lx - 30 * (1 - down) + sway, hover + 60 * (1 - down) + Math.sin(t * 3.1) * 0.25 * down, lz - 20 * (1 - down)),
          scale: 1.6,
        }
        if (t > 2 && t < 5 && t - (c.sparkAt ?? 0) > 0.45) {
          c.sparkAt = t
          const a = t * 3.7
          c.emit?.(['✨', '⭐', '💫'][Math.floor(t * 5) % 3], c.ufo.pos.clone().add(new THREE.Vector3(Math.cos(a) * 1.8, 0.2, Math.sin(a) * 1.2)))
        }
        c.hidden = true
        const k = span(t, 0, 2.2)
        c.cam = {
          mode: 'shot',
          pos: new THREE.Vector3(lx + 4, GROUND + 140 - k * 130, lz + 50 - k * 32),
          look: new THREE.Vector3(lx, GROUND + 4.5 + 30 * (1 - k), lz),
          rate: 0.002,
          cut: t < 0.05,
        }
        if (t > 5.3 && !c.landWarp) {
          c.landWarp = true
          warp(() => (c.landInside = clock.elapsedTime))
        }
        return
      }
      const ti = clock.elapsedTime - c.landInside
      const [bx, bz] = c.bedAt!
      c.ufo = {
        on: true,
        hull: false,
        pos: new THREE.Vector3(bx, GROUND + 9.5, bz),
        beam: span(ti, 0, 0.25) * (1 - span(ti, 2.4, 2.8)),
        beamLen: 9.2,
      }
      const drop = span(ti, 0.4, 2.1)
      if (drop >= 1 && !c.landed) {
        c.landed = true
        c.squashAt = clock.elapsedTime
        ;['✨', '⭐', '✨'].forEach((s, i) => c.emit?.(s, new THREE.Vector3(bx + (i - 1) * 0.9, GROUND + 1.6 + (i % 2) * 0.4, bz)))
      }
      c.hidden = ti < 0.4
      c.lift = (1 - drop) * 5.8
      c.pscale = 0.3 + drop * 0.7
      c.cam = {
        mode: 'shot',
        pos: new THREE.Vector3(bx + 2.4, GROUND + 5.2, bz + 6.6),
        look: new THREE.Vector3(bx, GROUND + 1.8, bz),
        rate: 0.05,
        cut: ti < 0.05,
      }
      if (ti > 3.0)
        end(() => {
          c.ufo = null
          c.lift = 0
          c.pscale = 1
          c.landInside = null
          const wake = c.wake
          c.wake = null
          if (!wake) return setStage('enter')
          c.cam = { mode: 'room' }
          wake()
        })
      return
    }
    const down = span(t, 0, 1.6)
    const up = span(t, 4.4, 5.6)
    c.ufo = {
      on: true,
      pos: new THREE.Vector3(lx + 30 * (1 - down), hover + 40 * (1 - down) + 80 * up, lz - 10 * (1 - down)),
      scale: 1.6,
      beam: span(t, 1.6, 1.9) * (1 - span(t, 3.9, 4.2)),
      beamLen: 7.5,
    }
    const rise = span(t, 2.0, 3.8)
    c.face = 0
    c.lift = rise * 5.8
    c.pscale = 1 - rise * 0.7
    c.hidden = t > 3.8
    c.cam = {
      mode: 'shot',
      pos: new THREE.Vector3(lx + 3, GROUND + 6, lz + 15),
      look: new THREE.Vector3(lx, GROUND + 3 + rise * 4 + up * 6, lz),
      rate: 0.01,
    }
    if (t > 5.8) end(onPickedUp)
  })
  return null
}

const BUS_SPEED = 14

const BUS_FRONT = 0

type Ride = { phase: 'arrive' | 'fare' | 'board' | 'ride' | 'leave'; path: Point[]; i: number; pos: THREE.Vector3; yaw: number; end: Point; away: Point | null }
type BusProps = {
  ctl: CtlRef
  from: string
  to: string
  fare?: boolean
  onFare: (answer: (ok: boolean) => void) => void
  onDone: () => void
}

export function BusRide({ ctl, from, to, fare, onFare, onDone }: BusProps) {
  const s = useRef<Ride | null>(null)
  useFrame((_, dt) => {
    const c = ctl.current
    if (!s.current) {
      const route = drivePath(from, to)
      const path = route.slice(1, -1)
      const [ax, az] = path[0]
      s.current = { phase: 'arrive', path, i: 0, pos: new THREE.Vector3(ax - 36, GROUND, az), yaw: Math.PI / 2, end: route[route.length - 1], away: null }
      c.bus = { on: true, pos: s.current.pos, yaw: s.current.yaw }
      c.run = false
      c.speed = null
      c.path = [[ax, az - 2.4]]
      c.onArrive = () => (c.face = -Math.PI / 2)
      c.cam = { mode: 'shot', pos: new THREE.Vector3(ax + 5, GROUND + 5.5, az - 8.5), look: new THREE.Vector3(ax - 2.5, GROUND + 1, az - 1), rate: 0.02, cut: true }
    }
    const r = s.current
    const drive = ([x, z]: Point, stop: boolean) => {
      const dx = x - r.pos.x
      const dz = z - r.pos.z
      const d = Math.hypot(dx, dz)
      const v = stop ? Math.min(BUS_SPEED, 1 + d * 1.6) : BUS_SPEED
      if (d < 0.05) return true
      const k = Math.min(1, (v * dt) / d)
      r.pos.x += dx * k
      r.pos.z += dz * k
      const want = Math.atan2(dx, dz) + BUS_FRONT
      const turn = want - r.yaw
      r.yaw += Math.atan2(Math.sin(turn), Math.cos(turn)) * Math.min(1, dt * 5)
      return d < 0.05 + v * dt
    }
    const board = () => {
      r.phase = 'board'
      c.path = [[r.path[0][0] - 1.2, r.path[0][1] - 1.2]]
      c.onArrive = () => {
        c.hidden = true
        r.phase = 'ride'
        r.i = 1
        c.cam = { mode: 'map', follow: true, h: 40, tilt: 0.4, cut: true }
      }
    }
    if (r.phase === 'arrive') {
      if (drive(r.path[0], true) && !c.path?.length) {
        if (!fare) board()
        else {
          r.phase = 'fare'
          onFare((ok) => {
            if (ok) return board()
            r.phase = 'leave'
            r.away = [r.path[0][0] + 60, r.path[0][1]]
          })
        }
      }
    } else if (r.phase === 'ride') {
      const last = r.i === r.path.length - 1
      if (drive(r.path[r.i], last)) {
        if (!last) r.i++
        else {
          r.phase = 'leave'
          const [bx, bz] = r.path[r.i]
          r.away = [bx + 60, bz]
          c.group!.position.set(bx - 1.2, 0, bz - 1.4)
          c.hidden = false
          c.run = false
          c.path = [r.end]
          c.onArrive = onDone
          c.cam = { mode: 'map', follow: true, h: 22, tilt: 0.8 }
        }
      }
      if (r.phase === 'ride') c.group!.position.set(r.pos.x, 0, r.pos.z)
    } else if (r.phase === 'leave') {
      if (drive(r.away!, false)) c.bus = null
    }
    if (c.bus) c.bus.yaw = r.yaw
  })
  useEffect(
    () => () => {
      ctl.current.bus = null
    },
    [ctl],
  )
  return null
}

export function BusAway({ ctl, from }: { ctl: CtlRef; from: string }) {
  const s = useRef<{ t: number; v: number; i: number; path: Point[]; bus: BusState } | null>(null)
  useEffect(
    () => () => {
      if (s.current && ctl.current.bus === s.current.bus) ctl.current.bus = null
    },
    [ctl],
  )
  useFrame((_, dt) => {
    const c = ctl.current
    if (!s.current) {
      const [x, z] = drivePath(from, from)[1]
      const corner = x + BLOCK.w / 2
      s.current = { t: 0, v: 0, i: 0, path: [[corner, z], [corner, z - 120]], bus: { on: true, pos: new THREE.Vector3(x, GROUND, z), yaw: Math.PI / 2 } }
      c.bus = s.current.bus
    }
    const r = s.current
    if (c.bus !== r.bus) return
    r.t += dt
    if (r.t < 1.5) return
    const [tx, tz] = r.path[r.i]
    const dx = tx - r.bus.pos.x
    const dz = tz - r.bus.pos.z
    const d = Math.hypot(dx, dz)
    r.v = Math.min(r.i === 0 ? 5 : BUS_SPEED, r.v + dt * 4)
    const k = Math.min(1, (r.v * dt) / d)
    r.bus.pos.x += dx * k
    r.bus.pos.z += dz * k
    const turn = Math.atan2(dx, dz) + BUS_FRONT - r.bus.yaw
    r.bus.yaw += Math.atan2(Math.sin(turn), Math.cos(turn)) * Math.min(1, dt * 4)
    if (d < 0.3) {
      if (r.i + 1 < r.path.length) r.i++
      else c.bus = null
    }
  })
  return null
}
