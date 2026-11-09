import { useEffect, useState } from 'react'
import { LOOK, useLook, type Key, type Slider, type Switch } from './look'
import { useGame } from '../store'
import { BEATS } from '../data/story3d'
import { ALIENS, ALIEN_KEYS } from '../data/aliens'
import { SET_NAMES } from '../screens/Lineup'

const go = (query: string) => (window.location.search = query)

function Look() {
  const look = useLook()
  return (
    <>
      {(Object.entries(LOOK) as [Key, Switch | Slider][]).map(([k, v]) =>
        'value' in v ? (
          <label key={k} className={'dev-row slider' + (!look[v.of as Key] ? ' off' : '')}>
            <span>
              {v.label} <code>{look[k]}</code>
            </span>
            <input type="range" min={v.min} max={v.max} step={v.step} value={look[k] as number} disabled={!look[v.of as Key]} onChange={(e) => look.setLook(k, +e.target.value)} />
          </label>
        ) : (
          <label key={k} className="dev-row">
            <input type="checkbox" checked={look[k] as boolean} onChange={() => look.setLook(k, !look[k])} />
            {v.label}
          </label>
        ),
      )}
      <button className="dev-reset" onClick={look.resetLook}>
        Reset
      </button>
    </>
  )
}

function Story() {
  const [flags, setFlags] = useState('')
  const room = (id: string) => {
    const list = flags.split(',').map((f) => f.trim()).filter(Boolean)
    go(`?story=${id}${list.length ? `&flags=${list.map(encodeURIComponent).join(',')}` : ''}`)
  }
  return (
    <>
      <a className="dev-link" href="/storymap.html" target="_blank" rel="noreferrer">
        Story map ↗
      </a>
      <div className="dev-grid">
        <button onClick={() => go('')}>Intro</button>
        <button onClick={() => useGame.setState({ phase: 'builder' })}>Builder</button>
        <button onClick={() => go('?story')}>Day start</button>
      </div>
      <label className="dev-row slider">
        <span>Flags for a room (comma separated)</span>
        <input className="dev-input" value={flags} placeholder="late, report" onChange={(e) => setFlags(e.target.value)} />
      </label>
      <div className="dev-grid">
        {BEATS.map((b) => (
          <button key={b.id} onClick={() => room(b.id)} title={b.title}>
            {b.id}
          </button>
        ))}
      </div>
    </>
  )
}

function Lab() {
  return (
    <>
      <span className="dev-sub">Reveal</span>
      <div className="dev-grid">
        {ALIEN_KEYS.map((a) => (
          <button key={a} onClick={() => go(`?reveal=${a}`)}>
            {ALIENS[a].name}
          </button>
        ))}
      </div>
      <span className="dev-sub">Specimen</span>
      <div className="dev-grid">
        {ALIEN_KEYS.map((a) => (
          <button key={a} onClick={() => go(`?specimen=${a}`)}>
            {ALIENS[a].name}
          </button>
        ))}
      </div>
      <span className="dev-sub">Lineup</span>
      <div className="dev-grid">
        {SET_NAMES.map((s) => (
          <button key={s} onClick={() => go(`?lineup=${s}`)}>
            {s}
          </button>
        ))}
      </div>
      <span className="dev-sub">World</span>
      <div className="dev-grid">
        <button onClick={() => go('?town')}>Town</button>
      </div>
    </>
  )
}

const TABS = { Look, Story, Lab }
type Tab = keyof typeof TABS

export default function DevMenu() {
  const [open, setOpen] = useState(false)
  const [tab, setTab] = useState<Tab>(() => {
    try {
      const t = localStorage.getItem('dev-tab')
      return t && Object.hasOwn(TABS, t) ? (t as Tab) : 'Look'
    } catch {
      return 'Look'
    }
  })
  useEffect(() => {
    const key = (e: KeyboardEvent) => e.key === '`' && setOpen((o) => !o)
    window.addEventListener('keydown', key)
    return () => window.removeEventListener('keydown', key)
  }, [])
  const pick = (t: Tab) => {
    setTab(t)
    try {
      localStorage.setItem('dev-tab', t)
    } catch {
    }
  }
  const Tab = TABS[tab]
  return (
    <div className="dev-look">
      <button className="dev-look-btn" onClick={() => setOpen((o) => !o)} title="Dev (`)">
        🎛
      </button>
      {open && (
        <div className="dev-look-panel">
          <div className="dev-tabs">
            {(Object.keys(TABS) as Tab[]).map((t) => (
              <button key={t} className={t === tab ? 'sel' : ''} onClick={() => pick(t)}>
                {t}
              </button>
            ))}
          </div>
          <Tab />
        </div>
      )}
    </div>
  )
}
