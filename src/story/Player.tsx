import { useRef, useState, useEffect, Suspense } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import { handRig, bodyFrame, stepHands, grooveRig, bodyOf, armsOf, ITEMS, type Frame, type ItemSpec, type Pose as Hands } from '../three/acts'
import { Character, type Pose } from '../three/Character'
import { Item } from '../three/Npc'
import { RUN, WALK, GROUND, HOP, phase } from './stage'
import { useLook } from './look'
import type { CtlRef } from './ctl'
import type { Avatar, Item as ItemName } from './types'

const _mid = new THREE.Vector3()

type Layer = Pose & { grooved?: boolean }

export function Player({ avatar, ctl }: { avatar: Avatar; ctl: CtlRef }) {
  const outer = useRef<THREE.Group>(null!)
  const pose = useRef<THREE.Group>(null!)
  const held = useRef<THREE.Group>(null)
  const layer = useRef<Layer>({ seat: 0, k: 0, off: null })
  const [clip, setClip] = useState('Idle')
  const [holding, setHolding] = useState<ItemName | null>(null)
  const P = useRef<Frame | null>(null)
  const hands = useRef(handRig())
  useFrame(({ clock }, dt) => {
    const c = ctl.current
    const g = outer.current
    const p = pose.current
    if (!g || !p) return
    const now = clock.elapsedTime
    const L = layer.current
    c.layer = L
    if (!P.current && L.rig) {
      P.current = bodyFrame(L.rig)
      c.rig = L.rig
    }

    let moved = 0
    if (c.path?.length) {
      const next = c.path[0]
      const d = new THREE.Vector2(next[0] - g.position.x, next[1] - g.position.z)
      const len = d.length()
      const step = (c.speed || (c.run ? RUN : WALK)) * dt
      if (len <= step) {
        g.position.x = next[0]
        g.position.z = next[1]
        c.path.shift()
        c.onWaypoint?.(c.path.length)
        if (!c.path.length) {
          const done = c.onArrive
          c.onArrive = null
          setClip('Idle')
          done?.()
        }
      } else {
        d.multiplyScalar(step / len)
        g.position.x += d.x
        g.position.z += d.y
        moved = step
        c.face = Math.atan2(d.x, d.y)
        const want = c.run ? 'Sprint' : 'Walk'
        if (clip !== want) setClip(want)
      }
    }
    const turn = c.face - g.rotation.y
    g.rotation.y += Math.atan2(Math.sin(turn), Math.cos(turn)) * (1 - Math.pow(0.0005, dt))
    if (c.gaze) {
      const want = Math.atan2(c.gaze[0] - g.position.x, c.gaze[1] - g.position.z) - g.rotation.y
      L.headYaw = THREE.MathUtils.clamp(Math.atan2(Math.sin(want), Math.cos(want)), -1.2, 1.2)
      c.looked = true
    } else if (c.looked) {
      L.headYaw = 0
      c.looked = false
    }
    g.visible = !c.hidden
    g.position.y = c.lift || 0

    const a = c.act
    p.position.set(0, GROUND, 0)
    p.rotation.set(0, 0, 0)
    p.scale.setScalar(c.pscale ?? 1)
    let stretch = 0
    const land = () => {
      c.squashAt = now
      for (let i = 0; i < 6; i++) c.puff?.(g.position.clone().add(new THREE.Vector3(Math.cos(i) * 0.45, GROUND + 0.1, Math.sin(i) * 0.45)), 0.7)
    }
    if (moved && !c.speed) {
      c.stride = (c.stride || 0) + moved
      const bob = Math.abs(Math.sin(c.stride * (c.run ? 2.2 : 2.8)))
      p.position.y += bob * 0.07
      stretch += (bob - 0.5) * 0.06
      if (c.run && c.stride - (c.puffAt || 0) > 0.7 && !c.hidden) {
        c.puffAt = c.stride
        c.puff?.(g.position.clone().setY(GROUND + 0.12), 0.5)
      }
    }
    if (c.hopAt != null) {
      const s = now - c.hopAt
      const H = 0.42
      if (s < H) {
        p.position.y += Math.sin((Math.PI * s) / H) * 0.38
        stretch += Math.sin((Math.PI * s) / H) * 0.12
      } else {
        c.hopAt = null
        land()
      }
    }
    if (c.squashAt != null) {
      const s = now - c.squashAt
      if (s < 0.7) stretch -= Math.exp(-7 * s) * Math.cos(s * 17) * 0.18
    }
    L.k = 0
    L.off = null
    L.sleep = 0
    const moveHands = (want: Hands | null, k = 1, mirror = false) => {
      if (!P.current) return
      const h = stepHands(hands.current, P.current, want, { k, mirror, dt, now, lift: p.position.y })
      L.off = h.off
      L.rot = h.rot
    }
    const squish = () => {
      if (!stretch || !useLook.getState().squash) return
      p.scale.y *= 1 + stretch
      p.scale.x /= Math.sqrt(1 + stretch)
      p.scale.z /= Math.sqrt(1 + stretch)
    }
    const shown = a && phase(a.choice.bodyMotion, now - a.t0)
    const grooving = !!a && a.out == null && (bodyOf(shown) ? shown : a.choice.body) === 'dance'
    if (L.rig && (grooving || L.grooved)) grooveRig(L.rig.bones, grooving ? now - a!.t0 : null)
    L.grooved = grooving
    if (!a) {
      squish()
      const pz = c.pose
      moveHands(pz && P.current ? armsOf(pz.arms)!(now, P.current) : null)
      c.handBone = 'HandR'
      const want = pz?.item || c.carry || null
      if (holding !== want) setHolding(want)
      return
    }
    const t = now - a.t0
    const tin = a.seated ? 1 : Math.min(1, t / HOP)
    const tout = a.out != null ? Math.min(1, (now - a.out) / HOP) : 0
    const k = THREE.MathUtils.smootherstep(tin * (1 - tout), 0, 1)
    const ch = a.choice
    if (a.seat) {
      g.position.x = a.seat.from[0] + (a.seat.to[0] - a.seat.from[0]) * k
      g.position.z = a.seat.from[1] + (a.seat.to[1] - a.seat.from[1]) * k
      const hop = Math.sin(Math.PI * k) * (a.seat.jump ?? (a.seat.height > 0.6 ? 0.3 : 0))
      if (a.seat.lie) {
        p.rotation.x = (-Math.PI / 2) * k
        p.position.y = GROUND + (a.seat.height + (a.seat.back ?? 0)) * k + hop
      } else {
        L.seat = a.seat.height
        L.k = k
        p.position.y = GROUND + hop
      }
      if (tin >= 1 && !a.landed) {
        a.landed = true
        land()
      }
    }
    squish()
    if (ch.sleep || a.seat?.lie) L.sleep = k
    if (ch.body === 'gone') p.scale.setScalar(Math.max(0.001, 1 - k))
    const motion = bodyOf(phase(ch.bodyMotion, t)) || bodyOf(ch.body)
    if (motion && a.out == null) {
      const m = motion(t)
      p.position.y += m.lift || 0
      p.position.x += m.side || 0
      p.rotation.x += m.pitch || 0
      p.rotation.y += m.yaw || 0
      p.rotation.z += m.roll || 0
    }
    if (a.turnAt != null && t >= a.turnAt) {
      a.turnAt = null
      a.mirror = false
      c.face = 0
      c.focus = [g.position.x, g.position.z]
    }
    const arms = armsOf(phase(ch.arms, t))
    moveHands(arms && P.current ? arms(t, P.current) : null, 1 - tout, a.mirror)
    c.handBone = a.mirror ? 'HandL' : 'HandR'

    const h = ch.hold
    const want = h && t >= (h.at || 0) && !(t >= (h.until ?? Infinity)) ? h.item : c.carry || null
    if (holding !== want) setHolding(want)

    const e = a.emote
    if (e && a.out == null && t >= (e.from || 0) && t >= a.nextEmote) {
      a.nextEmote = t + (e.every || 0.8)
      const texts = ([] as string[]).concat(e.text)
      const head = L.rig!.bones.Head.getWorldPosition(new THREE.Vector3())
      c.emit?.(texts[a.emoteN++ % texts.length], ch.body === 'gone' ? head.setY(GROUND + 1.6) : head.setY(head.y + 1.3))
    }
  })
  useFrame(() => {
    const L = layer.current
    const c = ctl.current
    const hand = L.rig?.bones[c.handBone || 'HandR']
    if (!hand) return
    hand.updateWorldMatrix(true, false)
    hand.getWorldPosition(c.hand)
    if (held.current) {
      const it: ItemSpec | undefined = holding ? ITEMS[holding] : undefined
      const yaw = outer.current.rotation.y + pose.current.rotation.y
      const r = L.rot?.[c.handBone || 'HandR'] || [0, 0, 0]
      const other = it?.both && L.rig!.bones[c.handBone === 'HandL' ? 'HandR' : 'HandL']
      const at = other ? other.getWorldPosition(_mid).add(c.hand).multiplyScalar(0.5) : c.hand
      held.current.visible = !c.hidden
      held.current.rotation.set(r[0] + (it?.turn ?? 0), yaw + (other ? 0 : r[1]), other ? 0 : r[2], 'YXZ')
      held.current.position.set(0, -(it?.grip ?? 0.12), it?.reach ?? 0.16).applyEuler(held.current.rotation).add(at)
    }
  }, 0.5)
  useEffect(() => {
    ctl.current.setClip = setClip
    ctl.current.group = outer.current
  }, [ctl])
  return (
    <>
      <group ref={outer} position={[ctl.current.start[0], 0, ctl.current.start[1]]}>
        <group ref={pose} position={[0, GROUND, 0]}>
          <group position={[0, -GROUND, 0]}>
            <Character avatar={avatar} clip={clip} groundY={GROUND} targetHeight={2.2} pose={layer} />
          </group>
        </group>
      </group>
      {holding && (
        <group ref={held}>
          <Suspense fallback={null}>
            <Item name={holding} />
          </Suspense>
        </group>
      )}
    </>
  )
}
