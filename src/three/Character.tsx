import { useEffect, useLayoutEffect, useMemo, useRef } from 'react'
import { useFrame, useThree, createPortal } from '@react-three/fiber'
import { useGLTF, useAnimations } from '@react-three/drei'
import * as THREE from 'three'
import { AlienHead } from './AlienHeads'
import { Accessories } from './Accessories'
import { composeAvatar, paintAvatar, refHeight, refFace, meshBox, outfitColors, SLOT_OF_ZONE } from './compose'
import { OutfitDetails } from './OutfitDetails'
import { blinker } from './blink'
import { ALIENS, type Alien } from '../data/aliens'
import { REF, torsoFor, styleFor, cutesUrl, type Avatar } from '../data/models'

function useRig(avatar: Avatar, targetHeight: number, groundY: number) {
  const torso = torsoFor(avatar.body, avatar.outfit)
  const style = styleFor(avatar.body, avatar.outfit)
  const keys = [REF, avatar.head, avatar.outfit, avatar.shoes, torso]
  const gltfs = [useGLTF(cutesUrl(keys[0])), useGLTF(cutesUrl(keys[1])), useGLTF(cutesUrl(keys[2])), useGLTF(cutesUrl(keys[3])), useGLTF(cutesUrl(keys[4]))]
  const scenes: Record<string, THREE.Object3D> = Object.fromEntries(keys.map((k, i) => [k, gltfs[i].scene]))
  const animations = gltfs[2].animations

  const rig = useMemo(() => {
    const ref = scenes[REF]
    const { root, meshes, material, photoMesh, headMesh } = composeAvatar(scenes, ref, avatar, torso, style)
    root.scale.setScalar(targetHeight / refHeight(ref))
    root.updateWorldMatrix(true, true)
    const box = new THREE.Box3()
    const body = new THREE.Box3()
    for (const m of meshes) {
      const b = meshBox(m)
      box.union(b)
      if (m.userData.part === 'body') body.union(b)
    }
    const c = body.getCenter(new THREE.Vector3())
    root.position.set(-c.x, groundY - box.min.y, -c.z)
    root.updateWorldMatrix(true, true)
    const rest = { body: new THREE.Box3(), feet: new THREE.Box3(), hand: { L: new THREE.Vector3(), R: new THREE.Vector3() } }
    for (const m of meshes) if (m.userData.part === 'body' || m.userData.part === 'feet') rest[m.userData.part as 'body' | 'feet'].union(meshBox(m))
    const bones: Record<string, THREE.Bone> = {}
    root.traverse((o) => {
      if (o instanceof THREE.Bone) bones[o.name.replace('.', '')] = o
    })
    for (const f of [bones.FootL, bones.FootR]) if (f) f.userData.rest = f.position.clone()
    bones.HandL.getWorldPosition(rest.hand.L)
    bones.HandR.getWorldPosition(rest.hand.R)

    const f = refFace(ref)
    const hi = headMesh.skeleton.bones.findIndex((b) => b.name === 'Head')
    const bone = headMesh.skeleton.bones[hi]
    const space = new THREE.Group()
    new THREE.Matrix4()
      .copy(headMesh.skeleton.boneInverses[hi])
      .multiply(headMesh.bindMatrix)
      .multiply(headMesh.matrix.clone().invert())
      .multiply(new THREE.Matrix4().makeTranslation(f.c.x, f.c.y, f.c.z))
      .multiply(new THREE.Matrix4().makeScale(f.H, f.H, f.H))
      .decompose(space.position, space.quaternion, space.scale)
    bone.add(space)
    space.updateWorldMatrix(true, false)
    space.userData.dims = f.dims
    const half = f.dims.clone().multiplyScalar(0.5)
    const headBox = new THREE.Box3(half.clone().negate(), half).applyMatrix4(space.matrixWorld)
    const pos = headMesh.geometry.attributes.position
    const v = new THREE.Vector3()
    let top = -Infinity
    for (let i = 0; i < pos.count; i++) top = Math.max(top, v.fromBufferAttribute(pos, i).applyMatrix4(headMesh.matrix).y)
    const headTop = (top - f.c.y) / f.H
    const bodyMesh = meshes.find((m) => m.userData.part === 'body')!
    const bi = bodyMesh.skeleton.bones.findIndex((b) => b.name === 'Body')
    const bodySpace = new THREE.Group()
    new THREE.Matrix4()
      .copy(bodyMesh.skeleton.boneInverses[bi])
      .multiply(bodyMesh.bindMatrix)
      .multiply(bodyMesh.matrix.clone().invert())
      .decompose(bodySpace.position, bodySpace.quaternion, bodySpace.scale)
    bodyMesh.skeleton.bones[bi].add(bodySpace)
    const defaults: Record<string, string | undefined> = torso !== avatar.outfit || style ? { ...outfitColors(scenes[avatar.outfit], ref), ...style?.colors } : {}

    const slots = new Set<string>()
    for (const m of meshes) for (const z of m.geometry.userData.zone) if (z) slots.add(SLOT_OF_ZONE[z]!)
    return { root, meshes, material, photoMesh, space, bodySpace, defaults, headBox, headTop, slots, rest, bones, groundY }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [scenes[avatar.head], scenes[avatar.outfit], scenes[avatar.shoes], scenes[torso], targetHeight, groundY])

  useEffect(
    () => () => {
      rig.space.removeFromParent()
      rig.bodySpace.removeFromParent()
      rig.material.dispose()
      rig.meshes.forEach((m) => m.geometry.dispose())
      rig.photoMesh.geometry.dispose()
      rig.photoMesh.material.map?.dispose()
      rig.photoMesh.material.dispose()
    },
    [rig],
  )
  return { ...rig, animations }
}

function photoTexture(img: HTMLImageElement, aspect: number) {
  const W = 512
  const H = Math.round(W / aspect)
  const c = document.createElement('canvas')
  c.width = W
  c.height = H
  const g = c.getContext('2d')!
  const inset = W * 0.07
  const w = W - inset * 2
  const h = H - inset * 2
  const r = Math.min(w, h) * 0.2
  g.beginPath()
  g.roundRect(inset, inset, w, h, r)
  g.clip()
  const a = img.width / img.height
  const sw = a > w / h ? img.height * (w / h) : img.width
  const sh = a > w / h ? img.height : img.width / (w / h)
  g.drawImage(img, (img.width - sw) / 2, (img.height - sh) / 2, sw, sh, inset, inset, w, h)
  const t = new THREE.CanvasTexture(c)
  t.colorSpace = THREE.SRGBColorSpace
  t.anisotropy = 4
  return t
}

const _c = new THREE.Vector3()

const MOVED = ['Body', 'HandL', 'HandR', 'FootL', 'FootR'] as const
type Moved = (typeof MOVED)[number]
type V3 = [number, number, number]
export type Rig = ReturnType<typeof useRig>
export type Pose = {
  seat?: number
  k?: number
  off?: Partial<Record<Moved, V3>> | null
  rot?: Partial<Record<Moved, V3>>
  headYaw?: number
  sleep?: number
  rig?: Rig
}
type SeatMemo = Partial<Record<Moved, { base: THREE.Vector3; qbase: THREE.Quaternion; set: THREE.Vector3 | null; qset: THREE.Quaternion | null }>>
const _m = new THREE.Matrix4()
const _m3 = new THREE.Matrix3()
const _d = new THREE.Vector3()
const _ax = new THREE.Vector3()
const _q = new THREE.Quaternion()
function poseLayer(rig: Rig, p: Pose, memo: SeatMemo) {
  const { rest, bones, root, groundY } = rig
  const k = p.k || 0
  const seat = p.seat || 0
  const hip = rest.body.min.y - groundY
  const drop = THREE.MathUtils.clamp((hip - seat) / hip, 0, 1)
  const rise = THREE.MathUtils.clamp((seat - hip) / hip, 0, 1)
  const reach = rest.body.max.z - rest.feet.min.z + 0.03
  for (const name of MOVED) {
    const b = bones[name]
    if (!b) continue
    const m = memo[name] || (memo[name] = { base: b.position.clone(), qbase: b.quaternion.clone(), set: null, qset: null })
    if (m.set && b.position.equals(m.set)) b.position.copy(m.base)
    if (m.qset && b.quaternion.equals(m.qset)) b.quaternion.copy(m.qbase)
    m.base.copy(b.position)
    m.qbase.copy(b.quaternion)
    const foot = name.startsWith('Foot')
    if (foot) _d.set(0, Math.max(0, seat - hip), reach * (0.4 + 0.6 * Math.max(drop, rise)))
    else _d.set(0, seat - hip, 0)
    _d.multiplyScalar(k)
    const o = p.off?.[name]
    if (o) _d.set(_d.x + o[0], _d.y + o[1], _d.z + o[2])
    b.parent!.updateWorldMatrix(true, false)
    _m3.setFromMatrix4(_m.copy(b.parent!.matrixWorld).invert().multiply(root.parent!.matrixWorld))
    b.position.add(_d.applyMatrix3(_m3))
    if (foot && k) {
      _ax.set(1, 0, 0).applyMatrix3(_m3).normalize()
      b.quaternion.premultiply(_q.setFromAxisAngle(_ax, -0.9 * drop * k))
    }
    const r = p.rot?.[name]
    if (r) {
      b.quaternion.premultiply(_q.setFromAxisAngle(_ax.set(0, 0, 1).applyMatrix3(_m3).normalize(), r[2]))
      b.quaternion.premultiply(_q.setFromAxisAngle(_ax.set(1, 0, 0).applyMatrix3(_m3).normalize(), r[0]))
      b.quaternion.premultiply(_q.setFromAxisAngle(_ax.set(0, 1, 0).applyMatrix3(_m3).normalize(), r[1]))
    }
    m.set = (m.set || new THREE.Vector3()).copy(b.position)
    m.qset = (m.qset || new THREE.Quaternion()).copy(b.quaternion)
  }
}
const YAW = THREE.MathUtils.degToRad(25)
const PITCH = THREE.MathUtils.degToRad(15)
const _h = new THREE.Vector3()
const _p = new THREE.Vector3()
const _q2 = new THREE.Quaternion()
type Point2 = { x: number; y: number }
type LookMemo = { yaw: number; pitch: number; base: THREE.Quaternion; set: THREE.Quaternion | null }
function lookLayer(rig: Rig, at: Point2 | null | undefined, camera: THREE.Camera, el: HTMLElement, memo: LookMemo, dt: number, turn = 0) {
  const b = rig.bones.Head
  const frame = rig.root.parent!
  let yaw = turn
  let pitch = 0
  if (at) {
    const r = el.getBoundingClientRect()
    b.getWorldPosition(_h)
    _p.set(((at.x - r.left) / r.width) * 2 - 1, -((at.y - r.top) / r.height) * 2 + 1, 0.5).unproject(camera).sub(camera.position)
    _p.multiplyScalar((_h.z + 3 - camera.position.z) / _p.z).add(camera.position).sub(_h)
    _p.applyQuaternion(frame.getWorldQuaternion(_q2).invert())
    if (_p.z > 0) {
      yaw = THREE.MathUtils.clamp(Math.atan2(_p.x, _p.z), -YAW, YAW)
      pitch = THREE.MathUtils.clamp(-Math.atan2(_p.y, Math.hypot(_p.x, _p.z)), -PITCH, PITCH)
    }
  }
  const k = 1 - Math.exp(-8 * dt)
  memo.yaw += (yaw - memo.yaw) * k
  memo.pitch += (pitch - memo.pitch) * k
  if (memo.set && b.quaternion.equals(memo.set)) b.quaternion.copy(memo.base)
  memo.base.copy(b.quaternion)
  if (Math.abs(memo.yaw) + Math.abs(memo.pitch) < 1e-4) {
    memo.set = null
    return
  }
  b.parent!.updateWorldMatrix(true, false)
  _m3.setFromMatrix4(_m.copy(b.parent!.matrixWorld).invert().multiply(frame.matrixWorld))
  _q.setFromAxisAngle(_ax.set(0, 1, 0).applyMatrix3(_m3).normalize(), memo.yaw)
  _q2.setFromAxisAngle(_ax.set(1, 0, 0).applyMatrix3(_m3).normalize(), memo.pitch)
  b.quaternion.premultiply(_q.multiply(_q2))
  memo.set = (memo.set || new THREE.Quaternion()).copy(b.quaternion)
}

const elastic = (t: number) => (t >= 1 ? 1 : 1 - Math.pow(2, -9 * t) * Math.cos(t * 13))

// Keyed by part combination: drei's useAnimations binds to its first root.
export type CharacterProps = {
  avatar: Avatar
  clip?: string
  alien?: Alien | null
  revealed?: boolean
  headOnly?: boolean
  throwAt?: number | null
  targetHeight?: number
  groundY?: number
  onReady?: (r: { headBox: THREE.Box3; slots: Set<string> }) => void
  pose?: { current: Pose | null } | null
  look?: { current: Point2 | null } | null
}

export function Character(props: CharacterProps) {
  const { head, outfit, shoes, body } = props.avatar
  return <ComposedCharacter key={`${head}|${outfit}|${shoes}|${body}`} {...props} />
}

function ComposedCharacter({
  avatar,
  clip,
  alien = null,
  revealed = true,
  headOnly = false,
  throwAt = null,
  targetHeight = 2.6,
  groundY = -1.25,
  onReady,
  pose = null,
  look = null,
}: CharacterProps) {
  const rig = useRig(avatar, targetHeight, groundY)
  const { root, meshes, photoMesh, space, bodySpace, defaults, headBox, headTop, slots, animations } = rig
  const { actions, names } = useAnimations(animations, root)
  const seatMemo = useRef<SeatMemo>({})
  useFrame(() => {
    const p = pose?.current
    if (!p) return
    p.rig = rig
    if (p.k! > 0 || p.off || Object.keys(seatMemo.current).length) poseLayer(rig, p, seatMemo.current)
  })
  const camera = useThree((s) => s.camera)
  const canvas = useThree((s) => s.gl.domElement)
  const lookMemo = useRef<LookMemo>({ yaw: 0, pitch: 0, base: new THREE.Quaternion(), set: null })
  useFrame((_, dt) => (look || pose) && lookLayer(rig, look?.current, camera, canvas, lookMemo.current, dt, pose?.current?.headYaw || 0))
  const blink = useMemo(blinker, [])
  const eyes = useMemo(() => meshes.filter((m) => m.morphTargetInfluences), [meshes])
  const clock = useThree((s) => s.clock)
  const alienGroup = useRef<THREE.Group>(null)
  const pivot = useRef<THREE.Group>(null)
  const revealAt = useRef<number | null | undefined>(null)

  const showAlien = !!alien && revealed && !headOnly
  const colors = useMemo(
    () => ({
      ...defaults,
      ...avatar.colors,
      top: avatar.colors.top ?? defaults.top,
      top2: avatar.colors.top2 ?? defaults.top2,
      apron: avatar.colors.top2 ?? defaults.apron,
    }),
    [avatar.colors, defaults],
  )

  useLayoutEffect(() => {
    for (const m of meshes) {
      const isHead = m.userData.part === 'head'
      m.visible = headOnly ? isHead : !(isHead && showAlien)
      const cut = m.userData.featureStart
      if (cut != null) m.geometry.setDrawRange(0, avatar.photo ? cut : Infinity)
    }
    photoMesh.visible = !!avatar.photo && !!photoMesh.material.map && (headOnly || !showAlien)
    paintAvatar(meshes, { ...colors, skin: showAlien ? ALIENS[alien].color : avatar.skin })
    revealAt.current = showAlien ? null : undefined
  }, [meshes, headOnly, showAlien, alien, avatar.skin, colors, avatar.photo])

  useEffect(() => {
    if (!avatar.photo) return
    let live = true
    const img = new Image()
    img.onload = () => {
      if (!live) return
      const mat = photoMesh.material
      mat.map?.dispose()
      mat.map = photoTexture(img, photoMesh.userData.aspect)
      mat.needsUpdate = true
      photoMesh.visible = headOnly || !showAlien
    }
    img.src = avatar.photo
    return () => {
      live = false
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [avatar.photo, photoMesh])

  useEffect(() => {
    const name =
      (clip && names.find((n) => n === clip || n.endsWith(`|${clip}`))) ||
      names.find((n) => /idle/i.test(n)) ||
      names[0]
    const action = name ? actions[name] : null
    if (action) {
      const once = clip && /jump/i.test(clip)
      action.setLoop(once ? THREE.LoopOnce : THREE.LoopRepeat, Infinity)
      action.clampWhenFinished = !!once
      action.reset()
      if (once) action.fadeIn(0.2)
      else action.time = clock.elapsedTime % action.getClip().duration
      action.play()
    }
    onReady?.({ headBox, slots })
    return () => {
      action?.fadeOut(0.2)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [actions, names, clip])

  useFrame(({ clock }) => {
    const now = clock.elapsedTime
    const shut = Math.max(blink(now), pose?.current?.sleep || 0)
    for (const m of eyes) m.morphTargetInfluences![0] = shut
    if (alienGroup.current && showAlien) {
      if (revealAt.current == null) revealAt.current = now
      alienGroup.current.scale.setScalar(Math.max(0.001, elastic((now - revealAt.current) / 0.9)))
    }
    if (pivot.current && headOnly && throwAt != null) {
      const t = Math.max(0, now - throwAt)
      const c = headBox.getCenter(_c)
      pivot.current.position.set(c.x + 1.4 * t, c.y + 4.2 * t - 4.9 * t * t, c.z + 0.9 * t)
      pivot.current.rotation.set(-7 * t, 0, 5 * t)
      pivot.current.visible = t < 2
    }
  })


  const hc = headBox.getCenter(new THREE.Vector3())

  return (
    <group ref={pivot} position={headOnly ? hc.toArray() : [0, 0, 0]}>
      <group position={headOnly ? hc.clone().negate().toArray() : [0, 0, 0]}>
        <primitive object={root} />
      </group>
      {createPortal(
        <>
          {showAlien && (
            <group ref={alienGroup} scale={0.001}>
              <AlienHead kind={alien} color={ALIENS[alien].color} />
            </group>
          )}
          {!showAlien && <Accessories avatar={avatar} top={headTop} />}
        </>,
        space,
      )}
      {avatar.body === 'female' &&
        !headOnly &&
        createPortal(<OutfitDetails outfit={avatar.outfit} main={colors.top} accent={colors.top2} />, bodySpace)}
    </group>
  )
}
