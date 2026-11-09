import { useEffect, useRef, useState, useSyncExternalStore } from 'react'
import { useGame } from '../store'
import { ALIEN_KEYS } from '../data/aliens'
import Catalogue, { SpeciesCard } from './Catalogue'
import { AUTHOR, GitHubLink, KoFiButton } from './KoFi'
import HILL from '../data/hill.json'

const BASE = import.meta.env.BASE_URL
const LAST = ALIEN_KEYS.length - 1

const AT = {
  hero: [0.03, 0.12],
  on: [0.1, 0.24],
  deck: [0.18, 0.26],
  cards: [0.26, 0.72],
  deckOut: [0.72, 0.78],
  off: [0.76, 0.86],
  credits: [0.84, 0.92],
} satisfies Record<string, [number, number]>

const ramp = (p: number, [a, b]: [number, number]) => Math.min(1, Math.max(0, (p - a) / (b - a)))
const smooth = (x: number) => x * x * (3 - 2 * x)
const settle = (x: number) => {
  const i = Math.floor(x)
  return i + smooth(Math.min(1, Math.max(0, (x - i - 0.3) / 0.4)))
}

const LENS = [
  'M42 46 Q40 36 52 35 L268 35 Q281 35 279 48 L268 168 Q263 196 236 197 L96 197 Q66 197 58 170 Z',
  'M558 46 Q560 36 548 35 L332 35 Q319 35 321 48 L332 168 Q337 196 364 197 L504 197 Q534 197 542 170 Z',
]
const LENS_MASK = `url("data:image/svg+xml,${encodeURIComponent(
  `<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 600 220'><path d='${LENS.join(' ')}'/></svg>`,
)}")`

const S = HILL.shades
const pct = (v: number) => `${(v * 100).toFixed(3)}%`
const SHADES = { left: pct(S.x), top: pct(S.y), width: pct(S.w), height: pct(S.h) }
const STAGE = { '--shades-y': S.y, '--shades-w': S.w, '--shades-h': S.h }
type Rect = { x: number; y: number; w: number; h: number }
const inShades = ({ x, y, w, h }: Rect) => ({ left: pct((x - S.x) / S.w), top: pct((y - S.y) / S.h), width: pct(w / S.w), height: pct(h / S.h) })
const ASPECT = HILL.size[0] / HILL.size[1]
const MATES = HILL.mates.map((m) => inShades(m.frame))
const SHADOWS = HILL.mates.map(({ feet: [x, y], shadow: w }) => {
  const h = w * ASPECT * 0.28
  return inShades({ x: x - w / 2, y: y - h / 2, w, h })
})
const PHASE = [-0.2, -1.4, -0.7, -2.1, -1.0, -1.8]

function Crew({ form, active }: { form: 'human' | 'alien'; active: number }) {
  return (
    <div className={`crew-layer ${form}`}>
      {ALIEN_KEYS.map((k, i) => (
        <div key={k} className={i === active ? 'mate on' : 'mate'} style={{ ...MATES[i], '--d': `${PHASE[i]}s` }}>
          <div className="sprite" style={{ backgroundImage: `url(${BASE}hill/${k}-${form}.webp)` }} />
        </div>
      ))}
    </div>
  )
}

function World({ active, still = false }: { active: number; still?: boolean }) {
  return (
    <div className="world" aria-hidden="true">
      <div className="town" style={{ backgroundImage: `url(${BASE}hill/town.webp)` }} />
      <div className="crew" style={SHADES}>
        <div className="crew-shadows">
          {SHADOWS.map((s, i) => (
            <i key={i} style={s} />
          ))}
        </div>
        <Crew form="human" active={active} />
        {!still && <Crew form="alien" active={active} />}
      </div>
      {!still && <Shades />}
    </div>
  )
}

function Shades() {
  return (
    <svg className="shades" viewBox="0 0 600 220" preserveAspectRatio="none" style={SHADES}>
      <defs>
        <clipPath id="lenses">
          <path d={LENS.join(' ')} />
        </clipPath>
      </defs>
      <path className="lens-tint" d={LENS.join(' ')} />
      <g clipPath="url(#lenses)" className="glare">
        <path d="M60 197 L170 35 L205 35 L95 197 Z" />
        <path d="M120 197 L230 35 L244 35 L134 197 Z" />
        <path d="M380 197 L490 35 L525 35 L415 197 Z" />
        <path d="M440 197 L550 35 L564 35 L454 197 Z" />
      </g>
      <path
        className="frame"
        fillRule="evenodd"
        d={`M4 40 Q2 16 30 14 L570 14 Q598 16 596 40 L590 70 Q584 84 572 86 L566 176 Q556 218 506 218 L370 218 Q322 218 314 176 L310 120 Q300 104 290 120 L286 176 Q278 218 230 218 L94 218 Q44 218 34 176 L28 86 Q16 84 10 70 Z ${LENS.join(' ')}`}
      />
      <path className="shine" d="M40 24 L560 24" />
    </svg>
  )
}

type Start = { start: () => void; shown?: boolean }

function Hero({ start, shown = true }: Start) {
  return (
    <div className="hero" inert={shown ? undefined : ''}>
      <h1 className="logo" data-text="AlienMe">
        AlienMe
      </h1>
      <p className="intro-sub">Earthling Integration Assessment</p>
      <div className="intro-copy">
        <p>
          Every year, thousands of entities pass as human. Some of them don&rsquo;t even know
          they&rsquo;re doing it.
        </p>
        <p>
          This assessment will build your human disguise, observe your instincts, and determine
          your <strong>true species</strong>. Participation is mandatory. It is also, honestly,
          kind of fun.
        </p>
      </div>
      <button className="primary-btn" onClick={start}>
        Drop me on Earth &rarr;
      </button>
      <p className="fineprint">
        6 archetypes · ~2 minutes · results are legally binding*
        <small>*on no planet you have heard of</small>
      </p>
    </div>
  )
}

function Credits({ start, shown = true }: Start) {
  return (
    <div className="credits" inert={shown ? undefined : ''}>
      <p className="credits-q">Which one are you hiding?</p>
      <button className="primary-btn" onClick={start}>
        Drop me on Earth &rarr;
      </button>
      <div className="credits-card">
        <p>
          Created by{' '}
          <a href={AUTHOR} target="_blank" rel="noreferrer">
            Samy Fodil
          </a>
        </p>
        <p className="credits-coffee">If you like the game,</p>
        <KoFiButton />
      </div>
    </div>
  )
}

function Sky() {
  return (
    <>
      <span className="cloud c1" aria-hidden="true" />
      <span className="cloud c2" aria-hidden="true" />
      <span className="cloud c3" aria-hidden="true" />
      <span className="cloud c4" aria-hidden="true" />
    </>
  )
}

function Story() {
  const setPhase = useGame((s) => s.setPhase)
  const start = () => setPhase('builder')
  const story = useRef<HTMLElement>(null)
  const stage = useRef<HTMLDivElement>(null)
  const [state, setState] = useState({ active: -1, hero: true, deck: false, credits: false })

  const scrollTo = (p: number) => {
    const el = story.current!
    const D = el.offsetHeight - stage.current!.offsetHeight
    window.scrollTo({ top: el.getBoundingClientRect().top + window.scrollY + p * D, behavior: 'smooth' })
  }
  const cardAt = (i: number) => AT.cards[0] + (i / LAST) * (AT.cards[1] - AT.cards[0])

  useEffect(() => {
    let raf = 0
    const update = () => {
      raf = 0
      const el = story.current!
      const st = stage.current!
      const D = el.offsetHeight - st.offsetHeight
      const p = D > 0 ? Math.min(1, Math.max(0, -el.getBoundingClientRect().top / D)) : 0
      const hero = ramp(p, AT.hero)
      const on = ramp(p, AT.on)
      const off = ramp(p, AT.off)
      const deck = ramp(p, AT.deck) * (1 - ramp(p, AT.deckOut))
      const credits = ramp(p, AT.credits)
      const card = settle(ramp(p, AT.cards) * LAST)
      const up = window.innerHeight
      const shade = -up * ((1 - on) ** 3 + off ** 2)
      st.style.setProperty('--hero', hero.toFixed(4))
      st.style.setProperty('--shade-y', `${shade.toFixed(1)}px`)
      st.style.setProperty('--deck', deck.toFixed(4))
      st.style.setProperty('--card', card.toFixed(4))
      st.style.setProperty('--credits', credits.toFixed(4))
      const next = {
        active: deck > 0.5 ? Math.round(card) : -1,
        hero: hero < 0.5,
        deck: deck > 0.5,
        credits: credits > 0.5,
      }
      setState((s) => ((Object.keys(next) as (keyof typeof next)[]).every((k) => s[k] === next[k]) ? s : next))
    }
    const later = () => {
      if (!raf) raf = requestAnimationFrame(update)
    }
    update()
    window.addEventListener('scroll', later, { passive: true })
    window.addEventListener('resize', later)
    return () => {
      cancelAnimationFrame(raf)
      window.removeEventListener('scroll', later)
      window.removeEventListener('resize', later)
    }
  }, [])

  return (
    <section className="screen intro story" ref={story}>
      <div className="stage" ref={stage} style={{ ...STAGE, '--lens': LENS_MASK }}>
        <Sky />
        <World active={state.active} />
        <Hero start={start} shown={state.hero} />
        <button className="intro-more" onClick={() => scrollTo(cardAt(0))} inert={state.hero ? undefined : ''}>
          Known species <span aria-hidden="true">&darr;</span>
        </button>
        <div className="deck" inert={state.deck ? undefined : ''}>
          <p className="deck-head">Six entities are currently living among you in human disguise. You may be one of them.</p>
          <div className="deck-window">
            <div className="deck-track">
              {ALIEN_KEYS.map((k, i) => (
                <SpeciesCard key={k} kind={k} index={i} />
              ))}
            </div>
          </div>
          <div className="deck-dots">
            {ALIEN_KEYS.map((k, i) => (
              <button
                key={k}
                className={i === state.active ? 'on' : ''}
                aria-label={`Specimen ${i + 1}`}
                onClick={() => scrollTo(cardAt(i))}
              />
            ))}
          </div>
        </div>
        <Credits start={start} shown={state.credits} />
        <GitHubLink className="gh-corner" />
      </div>
    </section>
  )
}

function Still() {
  const setPhase = useGame((s) => s.setPhase)
  const start = () => setPhase('builder')
  return (
    <section className="screen intro still">
      <div className="stage" style={STAGE}>
        <Sky />
        <World active={-1} still />
        <Hero start={start} />
        <GitHubLink className="gh-corner" />
      </div>
      <Catalogue />
      <Credits start={start} />
    </section>
  )
}

const STILL = '(prefers-reduced-motion: reduce), (max-height: 500px)'
const watch = (change: () => void) => {
  const m = window.matchMedia(STILL)
  m.addEventListener('change', change)
  return () => m.removeEventListener('change', change)
}

export default function Intro() {
  const still = useSyncExternalStore(watch, () => window.matchMedia(STILL).matches)
  return still ? <Still /> : <Story />
}
