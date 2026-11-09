import { Suspense, lazy, useEffect, useState } from 'react'
import { useGame } from './store'
import Intro from './screens/Intro'
import { isAlien } from './data/aliens'
import { presetAvatar } from './data/models'

const screens = {
  builder: () => import('./screens/Builder'),
  story: () => import('./screens/Story3D'),
  reveal: () => import('./screens/Reveal'),
}
const Builder = lazy(screens.builder)
const Story3D = lazy(screens.story)
const Reveal = lazy(screens.reveal)
const Dev = import.meta.env.DEV
  ? {
      Menu: lazy(() => import('./story/DevLook')),
      Inspector: lazy(() => import('./screens/Inspector')),
      Lineup: lazy(() => import('./screens/Lineup')),
      Specimen: lazy(() => import('./screens/Specimen')),
      Town: lazy(() => import('./screens/Town')),
    }
  : null
const dev = Dev && (
  <Suspense fallback={null}>
    <Dev.Menu />
  </Suspense>
)

const params = new URLSearchParams(import.meta.env.DEV ? window.location.search : '')

const devReveal = params.get('reveal')
if (isAlien(devReveal)) {
  const s = useGame.getState()
  const body = params.get('body')
  useGame.setState({
    phase: 'reveal',
    scores: { ...s.scores, [devReveal]: 99 },
    avatar: body ? presetAvatar(body) : s.avatar,
  })
}

if (params.has('story')) useGame.setState({ phase: 'story' })

const EARLY = 2500
const QUIET = 2000
const BUSY = ['pointerdown', 'pointermove', 'keydown', 'wheel']

export default function App() {
  const phase = useGame((s) => s.phase)
  const [early, setEarly] = useState(false)
  useEffect(() => {
    if (phase !== 'builder') return setEarly(false)
    let last = performance.now() + EARLY - QUIET
    const busy = (e: Event) => (e.type !== 'pointermove' || (e as PointerEvent).buttons) && (last = performance.now())
    BUSY.forEach((t) => window.addEventListener(t, busy, { passive: true }))
    const id = setInterval(() => {
      if (performance.now() - last < QUIET) return
      setEarly(true)
      clearInterval(id)
    }, 250)
    return () => {
      clearInterval(id)
      BUSY.forEach((t) => window.removeEventListener(t, busy))
    }
  }, [phase])
  useEffect(() => {
    let id: ReturnType<typeof setTimeout> | undefined
    const fetchRest = () => {
      Object.values(screens).forEach((load) => load())
      import('./three/preload').then((m) => m.preloadModels())
    }
    const later = () => (id = setTimeout(fetchRest, 1200))
    if (document.readyState === 'complete') later()
    else window.addEventListener('load', later, { once: true })
    return () => {
      window.removeEventListener('load', later)
      clearTimeout(id)
    }
  }, [])
  if (Dev) {
    const inspect = params.get('inspect')
    const lineup = params.get('lineup')
    const specimen = params.get('specimen')
    if (isAlien(specimen)) {
      return (
        <>
          <Suspense fallback={null}>
            <Dev.Specimen kind={specimen} />
          </Suspense>
          {dev}
        </>
      )
    }
    if (params.has('town')) {
      return (
        <>
          <Suspense fallback={null}>
            <Dev.Town />
          </Suspense>
          {dev}
        </>
      )
    }
    if (inspect || lineup) {
      return (
        <div className="app">
          <div className="stars" aria-hidden="true" />
          <Suspense fallback={null}>{lineup ? <Dev.Lineup set={lineup} /> : <Dev.Inspector url={inspect!} />}</Suspense>
          {dev}
        </div>
      )
    }
  }
  return (
    <div className={phase === 'story' ? 'app' : 'app cute'}>
      <div className="stars" aria-hidden="true" />
      <div className="scanlines" aria-hidden="true" />
      {phase === 'intro' && <Intro />}
      <Suspense fallback={null}>
        {phase === 'builder' && <Builder />}
        {phase === 'reveal' && <Reveal />}
      </Suspense>
      <Suspense fallback={null}>{(phase === 'story' || (phase === 'builder' && early)) && <Story3D active={phase === 'story'} />}</Suspense>
      {phase !== 'builder' && phase !== 'story' && <footer className="brand-foot">AlienMe // earthling integration assessment · v0.1</footer>}
      {dev}
    </div>
  )
}
