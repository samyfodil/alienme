import { useMemo, useState, useRef, useEffect, useCallback, Suspense, lazy } from 'react'
import { Safe3D } from '../three/Safe3D'
import { useGLTF, Html } from '@react-three/drei'
import { Canvas } from '@react-three/fiber'
import * as THREE from 'three'
import { useGame } from '../store'
import { BEAT, asksOf, wayOut, resolve, leadsTo, doorPath, doorTo, captionOf, timeOf, holds, settle, apply, titleOf } from '../story/engine'
import { Card } from '../story/Card'
import { START, WAKE, FARE, CROSSING, INTRO } from '../data/story3d'
import { originOf, doorOf, LANDING, PLACES, jogLoop, nearest, indoor, roadPath, firstCrossing } from '../data/city'
import { NAV, setOf, doorSpot, FRONT_DOOR, doorFace, HOME, standPoint, stance, targetOf, faceToward, emoteSpec, HOP, npcOf, ACT_TIME, READ_TIME, GROUND, TRAVEL, RUN } from '../story/stage'
import { prepareHeads } from '../three/AlienHeads'
import { ALIENS } from '../data/aliens'
import { PROPS } from '../data/props'
import { cutesUrl, partsOf, sceneUrl } from '../data/models'
import { seatHeight, seatForward } from '../three/Prop'
import { SPEED as NPC_SPEED } from '../three/Npc'
import { findPath } from '../three/nav'
import { Clock, Sky, SceneLights, RoomLights, Signal, Backdrop, CameraRig } from '../story/World'
import { City, Ufo, Bus } from '../three/City'
import { NONE, Diorama } from '../story/Room'
import { PhoneScreen } from '../story/Phone'
import { BusAway, BusRide, Saucer } from '../story/Rides'
import { Fx } from '../three/Fx'
import { Emotes, Puffs, Say, Speak, Think } from '../story/Bits'
import { Player } from '../story/Player'
import { Effects } from '../three/Effects'
import { Quality, GL } from '../three/Quality'
import { Warmup, useCanvasGone } from '../three/warm'
import { CornerButtons } from './Ask'
import { castOf, say } from '../story/cast'
import type { Acted, Acting, Ctl, Stage } from '../story/ctl'
import type { Day } from '../store'
import type { Crossing } from '../data/city'
import type { Running } from '../three/Fx'
import type { Doing } from '../three/Npc'
import type { Ask, Beat, Choice, Door, Extra, Flags, FlagChange, Fx as FxSpec, Menu, Npc, Option, Point, Prop, Reaction, Score, Way } from '../story/types'

const Checked = import.meta.env.DEV ? lazy(() => import('../story/Checked').then((m) => ({ default: m.Checked }))) : null

const PHONE_POSE: NonNullable<Ctl['pose']> = { arms: 'phone', item: 'phone' }

const LONGEST_WALK = 9
const routeLength = (pts: Point[]) => pts.slice(1).reduce((d, p, i) => d + Math.hypot(p[0] - pts[i][0], p[1] - pts[i][1]), 0)

const isWay = (c: Choice | Extra) => c.to != null || c.door != null || (!c.target && c.body !== 'jog')

function leaveAsk(beat: Beat, flags: Flags, scores: Score, before: Ask[]): Ask {
  const way = wayOut(beat, {}, flags)
  const place = way && !(typeof way === 'object' && 'fork' in way) && PLACES[resolve(way, scores)!.to]
  const time = before.findLast((a) => a.time)?.time
  const choice = !way ? { label: 'Call it a day', icon: '🌙' } : place ? { label: `Head ${place.way}`, icon: place.icon } : { label: 'Head out', icon: '🚪' }
  return { q: 'All done here?', time, choices: [choice] }
}

type Going = ReturnType<typeof resolve>
type Served = { reaction?: string | null; by?: string }
type Asking = { menu: Menu; act: Acting; finish: () => void }
type Crossed = Crossing & { picked?: Pick<Option, 'how' | 'reaction'>; on?: () => void }
type Fare = { go: (ok: boolean) => void; picked?: Option }
type Then = 'first' | 'next' | 'out' | 'stay'

export default function Story3D({ active = true }: { active?: boolean }) {
  const dressed = useGame((s) => s.avatar)
  const [then] = useState(dressed)
  const avatar = active ? dressed : then
  const addScores = useGame((s) => s.addScores)
  const setPhase = useGame((s) => s.setPhase)
  const saveDay = useGame((s) => s.saveDay)
  const restart = useGame((s) => s.restart)
  const [from] = useState((): (Pick<Day, 'room' | 'flags'> & Partial<Day>) | null => {
    const q = new URLSearchParams(window.location.search)
    const dev = import.meta.env.DEV && BEAT[q.get('story') ?? '']?.id
    if (dev) return { room: dev, flags: q.get('flags')?.split(',') ?? [] }
    const day = useGame.getState().day
    return day && BEAT[day.room] ? day : null
  })
  const [trail, setTrail] = useState(() => [from?.room || START])
  const [nextId, setNextId] = useState<string | null>(null)
  const [stage, setStage] = useState<Stage>(from ? 'enter' : 'land')
  const [chosen, setChosen] = useState<Acted | null>(null)
  const [asking, setAsking] = useState<Asking | null>(null)
  const [crossing, setCrossing] = useState<Crossed | null>(null)
  const [fare, setFare] = useState<Fare | null>(null)
  const crossStyle = useRef(from?.cross ?? null)
  const [served, setServed] = useState<Served | null>(null)
  const [wayPicked, setWayPicked] = useState(false)
  const [ask, setAsk] = useState(0)
  const [going, setGoing] = useState<Going>(null)
  const wayRef = useRef<Way>()
  const [extrasDone, setExtrasDone] = useState<string[]>([])
  const [hover, setHover] = useState<number | null>(null)
  const [flags, setFlags] = useState<Flags>(() => from?.flags ?? [])
  const [fx, setFx] = useState<Running[]>([])
  const [fade, setFade] = useState(false)
  const [passing, setPassing] = useState<string | null>(null)
  const [acting, setActing] = useState(false)
  const [hushed, setHushed] = useState(false)
  const hushTimer = useRef<ReturnType<typeof setTimeout>>()
  const [warm, setWarm] = useState(0)
  const ready = warm > 0
  const onReady = useCallback(() => setWarm(1), [])
  const onShown = useCallback(() => setWarm(2), [])
  const [settled, setSettled] = useState(false)
  const onSettled = useCallback(() => setSettled(true), [])
  useCanvasGone()
  const step = trail.length - 1
  const beat = BEAT[trail[step]]
  const [ox, oz] = originOf(beat.id)
  const asksHere = (f: Flags, picked: boolean) => {
    const list = asksOf(beat, f)
    return picked || (!list.length && !beat.enter) ? list : [...list, leaveAsk(beat, f, useGame.getState().scores, list)]
  }
  const asks = useMemo(() => asksHere(flags, wayPicked), [beat, flags, wayPicked]) // eslint-disable-line react-hooks/exhaustive-deps
  const question = asks[ask]
  const choices = question?.choices ?? NONE
  const extras = useMemo(() => (beat.extras || []).filter((e) => holds(e.when, flags) && !extrasDone.includes(e.label)), [beat, flags, extrasDone])
  const ctl = useRef<Ctl>(null!)
  ctl.current ??= {
    start: from ? doorOf(from.room) : LANDING,
    path: null,
    face: 0,
    cameraAt: originOf(from?.room || START),
    cam: { mode: 'room' },
    hidden: !from,
    reg: {},
    npcs: {},
    arrivals: {},
    lights: [],
    hand: new THREE.Vector3(),
  }
  ctl.current.stage = stage
  const [tick, setTick] = useState(0)
  const fuseOf = (o: Choice | Extra) => {
    const a = o.until && ctl.current.arrivals[o.until]
    if (!a || a.start == null || a.dur == null) return null
    const from = (performance.now() - a.start) / 1000
    return { dur: a.dur, from, gone: from >= a.dur }
  }
  const onCard = choices.map((o) => {
    const f = fuseOf(o)
    return f ? { ...o, fuse: f, gone: f.gone } : o
  })
  if (import.meta.env.DEV) window.__story = Object.assign(ctl.current, { nav: NAV })

  const now = () => ctl.current.clock?.elapsedTime ?? 0
  const warp = (then: () => void) => {
    setFade(true)
    setTimeout(() => {
      then()
      setTimeout(() => setFade(false), 150)
    }, 330)
  }
  const fxN = useRef(0)
  const startFx = (specs: FxSpec[], tag: string) => {
    const n = fxN.current++
    setFx((l) => [...l, ...specs.map((spec, i) => ({ spec, t0: now(), slot: step, ox, oz, key: `${step}-${tag}-${n}-${i}`, tag }))])
  }

  const sendIn = (n: Npc) => {
    const c = ctl.current
    const arrive = n.arrive!
    const legs = [...arrive.slice(1), n.at]
    ;(c.npcs[`${step}:${n.id}`] ??= { current: null }).current = { legs: legs.map((to) => ({ to })), face: n.rotY || 0 }
    const far = legs.reduce((d, p, i) => d + Math.hypot(p[0] - arrive[i][0], p[1] - arrive[i][1]), 0)
    c.arrivals[n.id] = { start: performance.now(), dur: far / NPC_SPEED }
  }

  const stillComing = (ids: string[]) =>
    Math.max(0, ...ids.map((id) => ctl.current.arrivals[id]).flatMap((a) => (a?.dur ? [a.dur - (performance.now() - a.start!) / 1000] : [])))

  const sendOn = (n: Npc) => {
    const c = ctl.current
    const live = c.npcs[`${step}:${n.id}`]
    if (!live || !n.leave || c.arrivals[n.id]?.goneAt) return
    const pts = [n.at, ...n.leave]
    const far = n.leave.reduce((d, p, i) => d + Math.hypot(p[0] - pts[i][0], p[1] - pts[i][1]), 0)
    ;(c.arrivals[n.id] ??= {}).goneAt = performance.now() + (stillComing([n.id]) + far / NPC_SPEED) * 1000
    live.current = { legs: pts.map((to) => ({ to })), face: n.rotY || 0, done: () => (live.gone = true) }
  }

  const go = (to: Point, onArrive: () => void) => walkIn(beat.id, to, onArrive)

  const take = (opt: { score?: Score; sets?: FlagChange; clears?: FlagChange }) => {
    addScores(opt.score)
    setFlags((f) => apply(f, opt))
  }

  useEffect(() => {
    setFlags((f) => apply(f, beat))
  }, [beat])

  useEffect(() => {
    prepareHeads(Object.fromEntries(Object.entries(ALIENS).map(([k, a]) => [k, a.color])))
  }, [])

  useEffect(() => {
    for (const id of leadsTo(beat)) {
      for (const p of [...BEAT[id].props, ...setOf(BEAT[id]).decor]) if (p.model && PROPS[p.model]) useGLTF.preload(sceneUrl(p.model))
      for (const p of BEAT[id].props) if (p.animal) useGLTF.preload(sceneUrl(`animals/${p.animal}`))
      for (const n of BEAT[id].npcs || []) {
        const looks = n.cast ? [n.cast, ...Object.values(n.castIf || {})].map((role) => castOf(role).look) : [n.look!]
        for (const look of looks) for (const k of partsOf(look)) useGLTF.preload(cutesUrl(k))
      }
    }
  }, [beat])

  useEffect(() => {
    if (stage !== 'enter') return
    const c = ctl.current
    const { scores, picks } = useGame.getState()
    saveDay({ room: beat.id, flags, cross: crossStyle.current, scores, picks })
    const d = c.entry && doorTo(beat, c.entry)
    c.entry = null
    const [sx, sz] = d ? doorSpot(d) : FRONT_DOOR
    const at: Point = c.group ? [c.group.position.x, c.group.position.z] : c.start
    const jump = Math.hypot(at[0] - ox, at[1] - oz) > 30
    if (jump) {
      c.path = null
      if (c.group) c.group.position.set(ox + sx, 0, oz + sz)
      else c.start = [ox + sx, oz + sz]
      if (d) c.face = doorFace(d) + Math.PI
    }
    c.cam = { mode: 'room', cut: jump }
    c.cameraAt = [ox, oz]
    c.carry = null
    c.focus = null
    c.seated = null
    c.run = true
    c.speed = null
    setFx([])
    setAsk(0)
    setWayPicked(false)
    setExtrasDone([])
    wayRef.current = undefined
    startFx((beat.ambient || []).filter((f) => holds(f.when, flags)), 'ambient')
    c.arrivals = {}
    const held = new Set(asks.flatMap((q) => q.choices.map((o) => o.until)))
    for (const n of beat.npcs || []) if (n.arrive && !held.has(n.id)) sendIn(n)
    const e = beat.enter
    if (e) {
      const st = stance(beat, e)
      const { at, prop, npc } = targetOf(beat, e)
      return go(st.at, () => {
        setChosen(e)
        setServed(null)
        setStage('act')
        begin(e, st.at, at, prop, npc, 'first', st.face)
      })
    }
    go(HOME, () => {
      c.face = 0.7
      setStage('choose')
    })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [stage, step])

  useEffect(() => {
    if (stage !== 'land' || step !== 0) return
    const c = ctl.current
    c.cameraAt = [ox, oz]
    setFx([])
    setAsk(0)
    setExtrasDone([])
    wayRef.current = undefined
    startFx((beat.ambient || []).filter((f) => holds(f.when, flags)), 'ambient')
    const choice: Acted = { target: 'bed', body: 'lie', sleep: true, asleep: true, menu: WAKE }
    const spot = standPoint(beat, choice)
    const { at, prop } = targetOf(beat, choice)
    begin(choice, spot, at, prop, null, 'stay')
    c.landAt = PLACES[beat.id].at
    c.bedAt = c.act!.seat!.to
    c.landInside = null
    c.landWarp = false
    c.sparkAt = 0
    c.landed = false
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [stage])

  const pickRef = useRef<(choice: Choice | Extra | undefined, extra?: boolean) => void>(null!)
  const onPick = useCallback((i: number) => pickRef.current(choices[i]), [choices])
  useEffect(() => {
    if (stage !== 'choose') return
    const c = ctl.current
    for (const id of new Set(choices.flatMap((o) => (o.until ? [o.until] : [])))) {
      const n = npcOf(beat, id)
      if (n && !c.arrivals[id]) sendIn(n)
    }
    setTick((k) => k + 1)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [stage, choices])
  useEffect(() => {
    if (stage !== 'choose') return
    const left = choices.flatMap((o) => {
      const f = fuseOf(o)
      return f && !f.gone ? [f] : []
    })
    if (!left.length) return
    const id = setTimeout(() => setTick((n) => n + 1), Math.min(...left.map((f) => f.dur - f.from)) * 1000 + 20)
    return () => clearTimeout(id)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [stage, choices, tick])
  const onExtra = useCallback((i: number) => pickRef.current(extras[i], true), [extras])
  pickRef.current = (choice, extra) => {
    if (stage !== 'choose' || !choice || fuseOf(choice)?.gone) return
    take(choice)
    setHover(null)
    if (extra) setExtrasDone((d) => [...d, choice.label])
    else wayRef.current = choice.to
    const picked = wayPicked || (!extra && isWay(choice))
    if (picked) setWayPicked(true)
    const then: Then = extra ? 'stay' : choice.to != null || ask + 1 >= asksHere(apply(flags, choice), picked).length ? 'out' : 'next'
    if (!choice.target && choice.body !== 'jog') return then === 'out' ? setStage('out') : setAsk((k) => k + 1)
    ctl.current.hopAt = now()
    setChosen(choice)
    setServed(null)
    setHover(null)
    setStage('act')
    setFx((l) => l.filter((f) => f.spec.keep || (f.tag === 'ambient' && f.spec.type === 'glow')))
    const p = ctl.current.group!.position
    const st: { at: Point; face?: number } = choice.body === 'jog' ? { at: [p.x - ox, p.z - oz] } : stance(beat, choice)
    const [sx, sz] = st.at
    const aim: { at: Point; prop?: Prop; npc?: Npc } = choice.body === 'jog' ? { at: [sx, sz] } : targetOf(beat, choice)
    const { at, prop, npc } = aim
    ctl.current.run = choice.body === 'hide'
    if (choice.until) sendOn(npcOf(beat, choice.until)!)
    const due = [choice.npc?.id, npc?.id, ...(choice.until ? [] : choices.map((o) => o.until))].filter((id): id is string => !!id)
    const act = (seated?: Acting) => setTimeout(() => begin(choice, [sx, sz], at, prop, npc, then, st.face, seated), stillComing(due) * 1000)
    const seated = ctl.current.seated
    ctl.current.seated = null
    if (seated && choice.body === 'sit' && choice.target === seated.target) return act(seated.act)
    if (seated) {
      seated.act.out = now()
      return setTimeout(() => {
        if (ctl.current.act === seated.act) ctl.current.act = null
        go([sx, sz], () => act())
      }, HOP * 1000 + 50)
    }
    go([sx, sz], () => act())
  }

  const react = (spec: Reaction, toward: Point, till?: number | null) => {
    const c = ctl.current
    const n = npcOf(beat, spec.id)!
    const live = c.npcs[`${step}:${spec.id}`]
    const at0 = spec.at0 || 0
    const spot = spec.walk ?? n.at
    const face = faceToward(spot, toward)
    setTimeout(() => {
      if (!live) return
      const r: Doing = { type: spec.react, t0: now(), face }
      live.current = spec.walk ? { ...r, legs: [{ to: spot }] } : r
      if (spec.for) setTimeout(() => live.current === r && (live.current = null), spec.for * 1000)
      if (!spec.leave) return
      setTimeout(() => {
        live.current = { legs: spec.leave!.map((to) => ({ to })), done: () => (live.gone = true) }
        setFx((l) => l.filter((f) => !(f.tag === 'ambient' && f.spec.type === 'emit' && Array.isArray(f.spec.at) && f.spec.at[0] === n.at[0] && f.spec.at[1] === n.at[1])))
      }, 1500)
    }, at0 * 1000)
    const from = spec.emoteAt ?? at0
    if (spec.emote) startFx([{ type: 'emit', at: spot, height: n.height || 2, text: spec.emote, every: 0.9, at0: from, until: spec.leave ? 1.6 : till ? till - from : undefined }], 'npc')
  }

  const sayLater = (o: { sayAt?: number }) => {
    clearTimeout(hushTimer.current)
    setHushed(!!o.sayAt)
    if (!o.sayAt) return 0
    hushTimer.current = setTimeout(() => setHushed(false), o.sayAt * 1000)
    return o.sayAt + READ_TIME
  }

  const begin = (choice: Acted, [sx, sz]: Point, at: Point, prop: Prop | undefined, npc: Npc | null | undefined, then: Then, face?: number, seated?: Acting) => {
    const c = ctl.current
    const here: Point = [ox + sx, oz + sz]
    const toward = faceToward([sx, sz], at)
    const show = ['dance', 'stretch', 'cheer'].includes(choice.body ?? '')
    c.face = choice.face ?? face ?? (show ? 0 : prop || npc ? toward : 0)
    const e = emoteSpec(choice.emote)
    const a: Acting = { choice, t0: now() - (choice.asleep ? HOP : 0), out: null, emote: e, nextEmote: e?.from || 0, emoteN: 0 }
    const h = prop && seatHeight(prop.model)
    if (choice.body === 'sit' && prop) {
      if (h != null) c.face = prop.rotY || 0
      const fwd = seatForward(prop.model)
      const r = prop.rotY || 0
      const to: Point = [ox + prop.at[0] + Math.sin(r) * fwd, oz + prop.at[1] + Math.cos(r) * fwd]
      a.seat = { from: seated?.seat!.from ?? here, to: h != null ? to : here, height: h ?? 0 }
      a.seated = a.landed = !!seated
    }
    if (choice.body === 'floor') a.seat = { from: here, to: here, height: 0 }
    if (choice.body === 'crouch') a.seat = { from: here, to: here, height: 0.32 }
    if (choice.body === 'hide') {
      c.run = false
      a.seat = { from: here, to: here, height: 0.32, jump: 0.55 }
    }
    if (choice.body === 'lie' && prop) {
      const d = PROPS[prop.model!]
      const r = prop.rotY || 0
      const face = d[0] > d[2] ? r + Math.PI / 2 : r
      const rig = c.rig
      a.seat = {
        from: here,
        to: [ox + prop.at[0] + Math.sin(face) * 1.3, oz + prop.at[1] + Math.cos(face) * 1.3],
        height: h ?? 0.02,
        back: rig ? -Math.min(rig.headBox.min.z, rig.rest.body.min.z) : 0.5,
        lie: true,
      }
      c.face = face
    }
    a.mirror = Math.sin(c.face) > 0.3
    if (!a.seat && Array.isArray(choice.arms) && choice.arms[0][0] === 'reach' && Math.cos(c.face) < 0.5)
      a.turnAt = choice.arms[0][1]
    c.focus = [ox + (sx + at[0]) / 2, oz + (sz + at[1]) / 2, a.seat && !a.seat.lie ? Math.max(0, a.seat.height - 0.6) : 0, !!a.seat?.lie]
    c.act = a
    const readBy = sayLater(choice)
    setActing(true)
    c.setClip?.(choice.body === 'spin' ? 'Sprint' : 'Idle')
    if (choice.fx) startFx(choice.fx, 'act')
    if (choice.npc) react(choice.npc, [sx, sz], choice.menu && choice.menu.at! + 0.6)
    const finish = () => {
      const following = then === 'first' ? asks[0] : then === 'next' ? asksOf(beat, apply(flags, choice))[ask + 1] : null
      const stay = !!(a.seat && !a.seat.lie && choice.body === 'sit' && following && !following.at)
      if (!stay) a.out = now()
      if (then === 'next' || then === 'out') for (const n of beat.npcs || []) sendOn(n)
      const back = choice.npc?.walk && !choice.npc.leave && !choice.menu?.serve ? npcOf(beat, choice.npc.id) : undefined
      const live = back && c.npcs[`${step}:${back.id}`]
      if (back && live)
        live.current = {
          legs: [{ to: back.at }],
          face: back.rotY || 0,
          done: () => back.patrol && (live.current = null),
        }
      setTimeout(() => {
        if (stay) {
          c.seated = { target: choice.target, act: a }
          a.choice = { ...a.choice, arms: null, bodyMotion: null, hold: a.choice.hold?.keep ? a.choice.hold : null }
          a.emote = null
        } else c.act = null
        c.focus = null
        setFx((l) => l.filter((f) => f.tag !== 'npc'))
        setActing(false)
        c.setClip?.('Idle')
        if (a.choice.hold?.keep) c.carry = a.choice.hold.item
        if (!stay) c.face = 0
        if (then === 'out' || a.leave) return setStage('out')
        if (then === 'next') {
          setAsk((k) => k + 1)
          const spot = asksOf(beat, apply(flags, choice))[ask + 1]?.at
          if (spot) {
            setFx((l) => l.filter((f) => f.tag !== 'act' || f.spec.keep))
            return go(spot, () => {
              c.face = 0
              setStage('choose')
            })
          }
        }
        setStage('choose')
      }, (a.seat && !stay) || choice.body === 'gone' ? HOP * 1000 + 50 : 0)
    }
    const menu = choice.menu
    if (choice.body === 'jog') {
      const loop = jogLoop(beat.id, here)
      const stopAt = choice.menu && targetOf(beat, { target: choice.menu.stop }).at
      const k = stopAt ? nearest(loop, [ox + stopAt[0], oz + stopAt[1]]) : loop.length - 1
      const [dx, dz] = loop[0]
      const focus = c.focus
      c.focus = null
      c.run = true
      const run = (pts: Point[], then: () => void) => {
        c.cam = { mode: 'map', follow: true, h: 40, tilt: 0.4 }
        c.speed = 15
        c.run = true
        c.path = pts
        c.onArrive = () => {
          c.speed = null
          then()
        }
      }
      const back = () => {
        c.cam = { mode: 'room' }
        go([sx, sz], () => {
          c.run = false
          c.face = 0
          c.focus = focus
          setTimeout(finish, 900)
        })
      }
      const onward = () => {
        setFx((l) => l.filter((f) => f.tag !== 'opt'))
        a.choice = { ...a.choice, arms: null, hold: null }
        a.emote = null
        run(loop.slice(k + 1), back)
      }
      const stop = () => {
        const p = c.group!.position
        c.run = false
        c.face = faceToward([p.x - ox, p.z - oz], stopAt!)
        c.cam = { mode: 'map', follow: true, h: 12, tilt: 0.9 }
        setAsking({ menu: choice.menu!, act: a, finish: onward })
        setStage('menu')
      }
      go([dx - ox, dz - oz], () => run(loop.slice(1, k + 1), stopAt ? stop : back))
    } else if (menu && choice.asleep) {
      c.wake = () => {
        setAsking({ menu, act: a, finish })
        setStage('menu')
      }
    } else if (menu) {
      setTimeout(() => {
        setAsking({ menu, act: a, finish })
        setStage('menu')
      }, menu.at! * 1000)
    } else {
      const goneAt = choice.until && c.arrivals[choice.until]?.goneAt
      const gone = goneAt ? goneAt - performance.now() + 300 : 0
      setTimeout(finish, Math.max((choice.time || ACT_TIME) * 1000, gone || 0, readBy * 1000))
    }
  }

  const order = (j: number) => {
    if (stage !== 'menu' || !asking) return
    const { menu, act: a, finish } = asking
    const opt = settle(menu.options[j])
    take(opt)
    const t = a.choice.target
    const withId = a.choice.npc?.id ?? (typeof t === 'string' && t.startsWith('npc:') ? t.slice(4) : null)
    if (opt.npc && withId) {
      const p = ctl.current.group!.position
      react({ ...opt.npc, id: withId }, [p.x - ox, p.z - oz])
    }
    if (opt.hush) setFx((l) => l.filter((f) => f.tag !== 'ambient' || f.spec.type === 'glow'))
    const serve = () => {
      const t = now() - a.t0
      a.choice = { ...a.choice, arms: opt.arms, hold: { item: opt.item!, at: t + 0.3, until: opt.stash ? t + 1.2 : undefined } }
      a.leave = opt.leave
      if (opt.fx) startFx(opt.fx, 'opt')
      const e = emoteSpec(opt.emote)
      a.emote = e && { ...e, from: t + 0.7 }
      a.nextEmote = t + 0.7
      const readBy = sayLater(opt)
      setServed(opt)
      setTimeout(finish, Math.max(opt.time || ACT_TIME, readBy) * 1000)
    }
    a.choice = { ...a.choice, arms: null, menu: null }
    a.emote = null
    setAsking(null)
    setStage('act')
    const sv = menu.serve
    const live = sv && ctl.current.npcs[`${step}:${sv.npc}`]
    if (!sv || !live) return serve()
    if (menu.wait) {
      const waiting: Served = { reaction: menu.wait, by: menu.by }
      setServed(waiting)
      setTimeout(() => setServed((s) => (s === waiting ? { reaction: null } : s)), 2500)
    }
    const f = opt.fetch
    const job: Doing = {
      legs: [
        ...(f ? [{ to: f.from, wait: 0.6, reach: () => startFx([{ type: 'take', prop: f.prop }], 'opt') }] : []),
        { to: sv.pickup, wait: f ? 1 : 0.5, carry: f ? f.item : undefined },
        { to: a.choice.npc?.walk ?? npcOf(beat, sv.npc)!.at, carry: opt.item },
      ],
      face: live.current?.face,
      done: () => {
        serve()
        setTimeout(() => live.current === job && (live.current = null), 1500)
      },
    }
    live.current = job
  }

  useEffect(() => {
    const t = stage === 'choose' && question?.look ? targetOf(beat, { target: question.look }).at : null
    ctl.current.gaze = t ? [ox + t[0], oz + t[1]] : null
  }, [stage, question, beat, ox, oz])

  useEffect(() => {
    if (stage === 'choose' && !question) setStage('out')
  }, [stage, question])

  useEffect(() => {
    if (stage !== 'out') return
    const c = ctl.current
    c.run = true
    c.focus = null
    setFx([])
    setChosen(null)
    const dest = resolve(wayOut(beat, { to: wayRef.current }, flags), useGame.getState().scores)
    setGoing(dest)
    const onward = () => (dest && doorPath(beat.id, dest.to) ? through(dest) : leaveFront(dest))
    const seated = c.seated
    c.seated = null
    if (!seated) return onward()
    seated.act.out = now()
    setTimeout(() => {
      if (c.act === seated.act) c.act = null
      onward()
    }, HOP * 1000 + 50)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [stage, step])

  const walkIn = (id: string, to: Point, onArrive: () => void) => {
    const c = ctl.current
    const [ax, az] = originOf(id)
    const at: Point = c.group ? [c.group.position.x, c.group.position.z] : c.start
    const from: Point = [at[0] - ax, at[1] - az]
    const nav = NAV[id]
    c.path = (findPath(nav, from, to) ?? findPath(nav.base, from, to) ?? [to]).map(([x, z]): Point => [x + ax, z + az])
    c.onArrive = onArrive
  }

  const placeAt = (id: string, d: Door) => {
    const c = ctl.current
    const [ax, az] = originOf(id)
    const [x, z] = doorSpot(d)
    setPassing(id)
    c.path = null
    c.group!.position.set(ax + x, 0, az + z)
    c.face = doorFace(d) + Math.PI
    c.cameraAt = [ax, az]
    c.focus = null
    c.cam = { mode: 'room', cut: true }
  }

  const viaDoors = (from: string, to: string, done: (last: string) => void) => {
    const hops = doorPath(from, to)!
    const hop = (k: number) => {
      const { room, door } = hops[k]
      walkIn(room, doorSpot(door), () => {
        ctl.current.face = doorFace(door)
        warp(() => {
          if (k + 1 === hops.length) {
            setPassing(null)
            return done(room)
          }
          const next = hops[k + 1].room
          placeAt(next, doorTo(BEAT[next], room)!)
          hop(k + 1)
        })
      })
    }
    hop(0)
  }

  const through = (e: { to: string }) => {
    setStage('leave')
    ctl.current.run = false
    viaDoors(beat.id, e.to, (last) => {
      ctl.current.entry = last
      setTrail((t) => [...t, e.to])
      setStage('enter')
    })
  }

  const leaveFront = (dest: Going) => {
    const c = ctl.current
    setStage('leave')
    c.run = true
    const next = () => {
      if (!dest) return setStage('pickup')
      setNextId(dest.to)
      setStage('travel')
    }
    const street = () => {
      const [x, z] = doorOf(beat.id)
      c.path = null
      c.group!.position.set(x, 0, z)
      c.face = 0
      c.cam = { mode: 'map', follow: true, h: 14, tilt: 0.9, cut: true }
      next()
    }
    if (doorPath(beat.id, 'out')) return viaDoors(beat.id, 'out', street)
    go(FRONT_DOOR, () => (indoor(beat.id) ? warp(street) : next()))
  }

  const enterBuilding = (id: string, done: () => void) => {
    const hops = doorPath(id, 'out')
    if (!hops) return warp(done)
    const rooms = hops.map((h) => h.room).reverse()
    const cross = (k: number, from: string) => {
      if (k === rooms.length - 1) {
        setPassing(null)
        ctl.current.entry = from
        return done()
      }
      const room = rooms[k]
      placeAt(room, doorTo(BEAT[room], from)!)
      const door = doorTo(BEAT[room], rooms[k + 1])!
      walkIn(room, doorSpot(door), () => {
        ctl.current.face = doorFace(door)
        warp(() => cross(k + 1, room))
      })
    }
    warp(() => cross(0, 'out'))
  }

  useEffect(() => {
    if (stage !== 'travel' || !nextId) return
    const to = nextId
    if (going?.by) return
    walkRoute(roadPath(beat.id, to), to, arrived)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [stage, nextId])

  const arrived = () => {
    const to = nextId!
    const enter = () => {
      setTrail((t) => [...t, to])
      setNextId(null)
      setStage('enter')
    }
    if (indoor(to)) enterBuilding(to, enter)
    else enter()
  }

  const pay = (j: number) => {
    if (!fare || fare.picked) return
    const c = ctl.current
    const o = settle(FARE.options[j])
    take(o)
    if (typeof o.emote === 'string') c.emit?.(o.emote, c.group!.position.clone().setY(GROUND + 3))
    setFare({ ...fare, picked: o })
    setTimeout(() => {
      setFare(null)
      fare.go(!!o.ride)
      if (!o.ride) walkRoute(roadPath(beat.id, nextId!), nextId!, arrived)
    }, 3200)
  }

  const walkRoute = (pts: Point[], to: string, done: () => void, first = true) => {
    const c = ctl.current
    if (first) c.pace = Math.max(TRAVEL, routeLength(pts) / LONGEST_WALK)
    const x = first && firstCrossing(pts)
    c.cam = { mode: 'map', follow: true, h: 40, tilt: 0.4 }
    c.run = true
    c.speed = c.pace
    if (!x) {
      c.path = pts.slice(1)
      c.onArrive = () => {
        c.onWaypoint = null
        c.speed = null
        done()
      }
      return
    }
    c.path = [...pts.slice(1, x.k + 1), x.kerb]
    c.onWaypoint = null
    c.onArrive = () => {
      c.speed = null
      c.run = false
      c.face = faceToward([0, 0], [Math.sin(x.dir), Math.cos(x.dir)])
      c.signal = 'wait'
      const on = () => walkRoute([x.far, ...pts.slice(x.k + 1)], to, done, false)
      if (crossStyle.current) {
        c.cam = { mode: 'map', follow: true, h: 12, tilt: 0.9 }
        setCrossing({ ...x, picked: { how: crossStyle.current } })
        crossOver(crossStyle.current, x, 0.5, on)
      } else {
        c.cam = { mode: 'map', follow: true, h: 6, tilt: 1.15 }
        setCrossing({ ...x, on })
      }
    }
  }

  const crossOver = (how: Option['how'], x: Crossing, pace: number, then: () => void) => {
    const c = ctl.current
    const over = (speed: number | null, run: boolean) => {
      c.speed = speed
      c.run = run
      c.path = [x.far]
      c.onArrive = () => {
        setCrossing(null)
        then()
      }
    }
    const above = () => c.group!.position.clone().setY(GROUND + 3)
    if (how === 'wait') {
      c.emit?.('⏳', above())
      setTimeout(() => (c.signal = 'walk'), 2600 * pace)
      setTimeout(() => over(null, false), 3100 * pace)
    } else if (how === 'look') {
      c.emit?.('👀', above())
      ;[1.1, -1.1, 1.1, 0].forEach((turn, i) => setTimeout(() => (c.layer!.headYaw = turn), i * 650 * pace))
      setTimeout(() => over(null, false), 2700 * pace)
    } else {
      c.emit?.('💨', above())
      over(RUN * 1.4, true)
      setTimeout(() => c.emit?.('BEEP!', c.group!.position.clone().setY(GROUND + 2.2)), 450)
    }
  }

  const cross = (j: number) => {
    if (!crossing || crossing.picked) return
    const o = settle(CROSSING.options[j])
    take(o)
    crossStyle.current = o.how ?? null
    setCrossing({ ...crossing, picked: o })
    crossOver(o.how, crossing, 1, crossing.on!)
  }

  const reaction = say(
    fare?.picked
      ? fare.picked.reaction
      : crossing?.picked
      ? crossing.picked.reaction
      : stage === 'menu'
        ? null
        : acting && !hushed && (served || chosen != null)
          ? (served ?? chosen)!.reaction
          : null,
  )
  const sayer = served?.by && !fare?.picked && !crossing?.picked ? `${step}:${served.by}` : undefined
  const caption = say(captionOf(beat, flags))
  const thinking = stage === 'choose' && !!question?.think
  const onDoors = stage === 'choose' && !thinking && choices.length > 0 && choices.every((c) => c.door)
  const asked = stage === 'choose' ? question?.phone : undefined
  const reading = asked ? { phone: asked, delay: 0 } : acting && chosen?.phone ? { phone: chosen.phone, delay: chosen.hold?.at ?? 0 } : null
  ctl.current.pose = asked ? PHONE_POSE : null
  const bus = fare || (stage === 'travel' && going?.by === 'bus')
  const time = bus ? FARE.time! : (asks.slice(0, ask + 1).findLast((q) => q.time)?.time ?? timeOf(beat, flags))
  const inside = ['enter', 'choose', 'act', 'menu', 'out', 'leave'].includes(stage) || (stage === 'land' && step === 0)
  ctl.current.indoor = inside && indoor(beat.id)
  const map = ['route', 'travel'].includes(stage)
  const live = (
    [
      [trail[step], step],
      [nextId, step + 1],
      [passing, `pass-${passing}`],
    ] as [string | null, number | string][]
  ).filter((l): l is [string, number | string] => !!l[0])
  const lite = Object.keys(PLACES).filter((id) => !PLACES[id].building && !live.some(([l]) => l === id))
  const skip = () => {
    const c = ctl.current
    c.stage = 'enter'
    c.ufo = null
    c.landInside = null
    c.hidden = false
    c.lift = 0
    c.pscale = 1
    c.group?.position.set(LANDING[0], 0, LANDING[1])
    setStage('enter')
  }

  const veiled = stage === 'land' && !settled
  return (
    <section className={(active ? 'story3d' : 'story3d ahead') + (veiled ? ' veiled' : '')}>
      <Safe3D>
        <Canvas
          shadows
          camera={{ position: [0, 5.4, 11.6], fov: 40, far: 1500 }}
          dpr={[1, 2]}
          gl={GL}
          frameloop={active && ready ? 'always' : 'never'}
          onCreated={({ gl }) => (gl.debug.checkShaderErrors = import.meta.env.DEV)}
        >
          {warm < 2 && active && <Warmup onReady={onReady} onShown={onShown} />}
          <Clock ctl={ctl} />
          <Sky ctl={ctl} time={time} />
          <SceneLights ctl={ctl} time={time} />
          <RoomLights room={passing || (inside ? beat.id : null)} ctl={ctl} />
          <City open={NONE} badges={map} />
          {crossing && <Signal ctl={ctl} kerb={crossing.kerb} far={crossing.far} dir={crossing.dir} />}
          <Ufo ctl={ctl} />
          <Bus ctl={ctl} car={going?.by === 'ride'} />
          {beat.busAway && holds(beat.busAway, flags) && stage !== 'travel' && <BusAway ctl={ctl} from={beat.id} />}
          {stage === 'travel' && nextId && going?.by && (
            <BusRide
              ctl={ctl}
              from={beat.id}
              to={nextId}
              fare={going.by === 'bus' && holds(FARE.when, flags)}
              onFare={(go) => setFare({ go })}
              onDone={arrived}
            />
          )}
          {(stage === 'land' || stage === 'pickup') && <Saucer ctl={ctl} stage={stage} setStage={setStage} onPickedUp={() => setPhase('reveal')} onSettled={onSettled} warp={warp} />}
          {live.map(([id, slot]) => (
            <Diorama
              key={`${slot}-${id}`}
              beat={BEAT[id]}
              slot={slot}
              ctl={ctl}
              stage={slot === step ? stage : null}
              onPick={onExtra}
              hover={hover}
              setHover={setHover}
              extras={slot === step ? extras : undefined}
              signs={slot === step && onDoors ? choices : undefined}
              onSign={onPick}
              flags={slot === step ? flags : undefined}
            />
          ))}
          {lite.map((id) => (
            <Diorama key={`lite-${id}`} beat={BEAT[id]} slot={`lite-${id}`} ctl={ctl} lite />
          ))}
          <Fx list={fx} ctl={ctl} />
          <Emotes ctl={ctl} />
          <Puffs ctl={ctl} />
          <Backdrop ctl={ctl} />
          {reaction && <Say ctl={ctl} text={reaction} who={sayer} />}
          {thinking && <Think ctl={ctl} menu={{ prompt: question!.q, options: choices }} onPick={onPick} />}
          {stage === 'menu' && asking?.menu.by && <Speak ctl={ctl} who={`${step}:${asking.menu.by}`} menu={asking.menu} onPick={order} />}
          <Suspense fallback={null}>
            <Player avatar={avatar} ctl={ctl} />
          </Suspense>
          <CameraRig ctl={ctl} />
          <Effects bloom={0.5} toy />
          <Quality />
        </Canvas>
      </Safe3D>

      <header className="story-hud">
        {stage === 'land' ? (
          <div className="caption intro">{INTRO}</div>
        ) : stage === 'pickup' ? (
          <div className="caption intro">Day complete. Time to go home.</div>
        ) : (
          <div className="hud-box">
            <div className="caption-tag">
              <span className="caption-time">{time}</span>
              {stage === 'travel' && nextId ? `On the way ${PLACES[nextId].way}` : say(titleOf(passing ? BEAT[passing] : beat, flags))}
            </div>
          </div>
        )}
      </header>
      {(stage === 'enter' || (thinking && ask === 0)) && (
        <div className="caption-box" key={caption}>
          <div className="caption">{caption}</div>
        </div>
      )}
      {active && <CornerButtons className="corner-high" restart="Start the day over? Back to your disguise, as you left it." onRestart={restart} />}
      {stage === 'land' && (
        <button className="skip-intro" onClick={skip}>
          Skip ›
        </button>
      )}
      {active && (warm < 2 || veiled) && <div className="warming" aria-label="Loading" />}
      <div className={'warp-fade' + (fade ? ' on' : '')} />
      {reading && <PhoneScreen key={`${step}-${ask}-${stage}`} phone={reading.phone} flags={flags} time={time} delay={reading.delay} low={!asked} />}
      {stage === 'choose' && question && !thinking && <Card key={`${step}-${ask}`} lead={ask === 0 ? caption : undefined} menu={{ prompt: question.q, options: onDoors ? NONE : onCard }} onPick={onPick} />}
      {crossing && !crossing.picked && <Card menu={CROSSING} onPick={cross} />}
      {fare && !fare.picked && <Card menu={FARE} onPick={pay} />}
      {stage === 'menu' && asking && !asking.menu.by && <Card menu={asking.menu} onPick={order} />}
      {Checked && (
        <Suspense fallback={null}>
          <Checked />
        </Suspense>
      )}
    </section>
  )
}
