import { Suspense } from 'react'
import { Canvas } from '@react-three/fiber'
import { OrbitControls, Html } from '@react-three/drei'
import { Studio } from '../three/Studio'
import { Effects } from '../three/Effects'
import { Character } from '../three/Character'
import { presetAvatar, randomAvatar, type Avatar } from '../data/models'
import { ALIENS, ALIEN_KEYS, type Alien } from '../data/aliens'
import { BEATS, CAST } from '../data/story3d'

function testFace() {
  const c = document.createElement('canvas')
  c.width = 300
  c.height = 400
  const g = c.getContext('2d')!
  g.fillStyle = '#ff2fa0'
  g.fillRect(0, 0, 300, 400)
  g.fillStyle = '#f1c27d'
  g.beginPath()
  g.ellipse(150, 210, 105, 140, 0, 0, Math.PI * 2)
  g.fill()
  g.fillStyle = '#222'
  ;[110, 190].forEach((x) => g.fillRect(x - 22, 160, 44, 44))
  g.strokeStyle = '#a33'
  g.lineWidth = 8
  g.beginPath()
  g.arc(150, 250, 40, 0.2, Math.PI - 0.2)
  g.stroke()
  return c.toDataURL()
}

type Figure = { name: string; avatar: Avatar; alien?: Alien | null; pose?: { current: { seat: number; k: number } }; seat?: number }

const SETS: Record<string, Figure[]> = {
  extras: [
    { name: 'glasses+phones', avatar: { ...presetAvatar('generic-male'), eyewear: '3d', headgear: 'headphones' } },
    { name: 'shades+party', avatar: { ...presetAvatar('generic-female'), eyewear: 'shades', headgear: 'party', face: 'blush' } },
    { name: 'glasses+tache', avatar: { ...presetAvatar('citizen-1'), eyewear: 'glasses', headgear: 'halo', face: 'tache' } },
  ],
  women: ['male-officer', 'santa-claus', 'citizen-2', 'food-worker', 'prisoner', 'crypto-bro', 'retail-worker'].map((n) => ({
    name: n,
    avatar: { ...presetAvatar(n), body: 'female', head: ({ 'male-officer': 'female-officer', 'citizen-2': 'citizen-2', prisoner: 'generic-female', 'crypto-bro': 'citizen-3' } as Record<string, string>)[n] || 'generic-female' },
  })),
  sit: [0, 0.3, 0.7, 1.2].map((seat) => ({
    name: `seat ${seat}`,
    avatar: presetAvatar('citizen-2'),
    pose: { current: { seat, k: 1 } },
    seat,
  })),
  hoodies: [['male', 'citizen-2'], ['female', 'citizen-2'], ['male', 'generic-male'], ['female', 'generic-female']].map(([body, outfit]) => ({
    name: `${body} ${outfit}`,
    avatar: { ...presetAvatar('generic-male'), body, outfit },
  })),
  torsos: ['generic-male', 'generic-female', 'citizen-3', 'citizen-2', 'male-officer', 'female-officer'].map((n) => ({ name: n, avatar: presetAvatar(n) })),
  face1: ['crypto-bro', 'male-officer'].map((n) => ({ name: n, avatar: { ...presetAvatar(n), photo: testFace() } })),
  faces: [
    'generic-male', 'generic-female', 'citizen-2', 'crypto-bro', 'male-officer', 'santa-claus', 'chicken-guy',
  ].map((n) => ({ name: n, avatar: { ...presetAvatar(n), photo: testFace() } })),
  random: Array.from({ length: 7 }, (_, i) => ({ name: `random ${i + 1}`, avatar: randomAvatar() })),
  cutes: [
    'generic-male', 'generic-female', 'citizen-1', 'citizen-2', 'citizen-3', 'crypto-bro', 'food-worker',
  ].map((n) => ({ name: n, avatar: presetAvatar(n) })),
  cutes2: [
    'male-officer', 'female-officer', 'retail-worker', 'prisoner', 'santa-claus', 'chicken-guy',
  ].map((n) => ({ name: n, avatar: presetAvatar(n) })),
  variants: ALIEN_KEYS.map((a) => ({ name: `${a} (${ALIENS[a].disguise})`, avatar: presetAvatar(ALIENS[a].disguise), alien: a })),
  pairs: [
    ['generic-male', null], ['generic-male', 'grey'], ['crypto-bro', null], ['crypto-bro', 'cephalopod'],
    ['food-worker', null], ['food-worker', 'avian'],
  ].map(([b, a]: (string | null)[]) => ({ name: (a || b)!, avatar: presetAvatar(b!), alien: a as Alien | null })),
  cast: [
    ...['male', 'female'].map((body) => CAST.stranger({ body })).map((c) => ({ name: c.name, avatar: c.look })),
    ...(['she', 'he'] as const).flatMap((t) => [CAST.jo(null, { jo: t, boss: t }), CAST.boss(null, { jo: t, boss: t })]).map((c) => ({ name: `${c.name} (${c.they})`, avatar: c.look })),
    ...[...new Map(BEATS.flatMap((b) => b.npcs || []).flatMap((n) => (n.look ? [[n.id, n.look] as const] : [])))].map(([name, avatar]) => ({ name, avatar })),
  ],
}

export const SET_NAMES = Object.keys(SETS)

export default function Lineup({ set }: { set: string }) {
  const params = new URLSearchParams(window.location.search)
  const only = params.get('only')
  const rot = Number(params.get('rot')) || 0
  const all = SETS[set] || SETS.cutes
  const items = only ? only.split(',').map((i) => all[+i]) : all
  const gap = 2.2
  const x0 = (-(items.length - 1) * gap) / 2
  return (
    <section className="screen" style={{ padding: 0 }}>
      <div className="stage-full">
        <Canvas shadows camera={{ position: [0, 1.2, items.length * 1.9 + 2], fov: 38 }} dpr={[1, 2]}>
          <Studio />
          {items.map((it, i) => (
            <group key={it.name + i} position={[x0 + i * gap, 0, 0]} rotation={[0, rot, 0]}>
              <Suspense fallback={null}>
                <Character avatar={it.avatar} alien={it.alien} targetHeight={2} pose={it.pose} />
              </Suspense>
              {it.seat! > 0 && (
                <mesh position={[0, -1.25 + it.seat! / 2, 0]}>
                  <boxGeometry args={[0.9, it.seat!, 0.6]} />
                  <meshStandardMaterial color="#59607a" />
                </mesh>
              )}
              <Html position={[0, -1.55, 0]} center>
                <div style={{ font: '12px monospace', color: '#9fffe0', whiteSpace: 'nowrap' }}>{it.name}</div>
              </Html>
            </group>
          ))}
          <OrbitControls makeDefault target={[0, 0, 0]} />
          <Effects />
        </Canvas>
      </div>
    </section>
  )
}
