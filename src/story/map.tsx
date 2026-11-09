import { StrictMode, useEffect, useMemo, useState } from 'react'
import { createRoot } from 'react-dom/client'
import { BEATS, START, WAKE, FARE, CROSSING } from '../data/story3d'
import { PLACES } from '../data/city'
import { ALIENS, isAlien } from '../data/aliens'
import { checkStory, type Problem } from './check'
import { EVEN, share, type Wins } from './count'
import { BEAT, holds, doorPath, waysTo, tests } from './engine'
import type { Beat, FlagChange, Flags, Option, Point, Score, Way } from './types'
import './map.css'

const W = 256
const COL = 340
const GAP = 30
const TOP = 66
const PORT = 26
const list = (x: FlagChange | undefined) => ([] as string[]).concat(x || [])
const alien = (a: string) => (isAlien(a) ? ALIENS[a] : undefined)

type Port = { to?: string; kind: string; label: string; icon?: string; when?: string; door?: boolean }
type Shown = Problem & { level: 'error' | 'warn' }

const port = (b: Beat, w: Way, p: Omit<Port, 'to' | 'door'>): Port[] => {
  const fork = typeof w === 'object' && 'fork' in w
  const bus = typeof w === 'object' && 'by' in w && w.by === 'bus'
  return waysTo(w).map((to) => ({ to, kind: fork ? 'fork' : bus ? 'bus' : p.kind, label: fork ? `${p.label}: fork → ${BEAT[to]?.title || to}` : p.label, icon: p.icon, when: p.when, door: !!doorPath(b.id, to) }))
}
const portsOf = (b: Beat): Port[] => {
  const ports = [
    ...b.asks.flatMap((q) => q.choices.filter((c) => c.to != null).flatMap((c) => port(b, c.to!, { kind: 'exit', label: c.label, icon: c.icon || '→', when: c.when ?? q.when }))),
    ...Object.entries(b.nextIf || {}).flatMap(([c, w]) => port(b, w, { kind: 'next', label: 'then', icon: '→', when: c })),
    ...(b.next != null ? port(b, b.next, { kind: 'next', label: 'then', icon: '→' }) : []),
  ]
  return ports.length ? ports : [{ kind: 'end', label: 'the day ends', icon: '🛸' }]
}
const heightOf = (b: Beat) => TOP + portsOf(b).length * PORT + 12
const minutes = (t?: string) => (t ? +t.slice(0, 2) * 60 + +t.slice(3) : 0)

function layout() {
  const sameLot = (a: string, b: string) => PLACES[a] && PLACES[b] && PLACES[a].at.join() === PLACES[b].at.join()
  const depth: Record<string, number> = { [START]: 0 }
  for (let n = 0; n < BEATS.length * 2; n++)
    for (const b of BEATS)
      for (const p of portsOf(b))
        if (p.to && BEAT[p.to] && depth[b.id] != null) {
          const d = depth[b.id] + (sameLot(b.id, p.to) ? 0 : 1)
          if ((depth[p.to] ?? -1) < d && d < BEATS.length) depth[p.to] = d
        }
  const last = Math.max(...Object.values(depth)) + 1
  const cols: Beat[][] = []
  for (const b of BEATS) (cols[depth[b.id] ?? last] ??= []).push(b)
  const at: Record<string, Point> = {}
  let height = 0
  cols.forEach((col, c) => {
    if (!col) return
    col.sort((a, b) => minutes(a.time) - minutes(b.time))
    let y = 40
    for (const b of col) {
      at[b.id] = [40 + c * COL, y]
      y += heightOf(b) + GAP
    }
    height = Math.max(height, y)
  })
  return { at, width: 40 + cols.length * COL, height }
}

const answers = (b: Beat) => [...b.asks.flatMap((q) => q.choices), ...(b.extras || [])]
const flagsRaised = (b: Beat) => [...new Set([...list(b.sets), ...answers(b).flatMap((c) => [...list(c.sets), ...(c.menu?.options || []).flatMap((o) => [...list(o.sets), ...list(o.win?.sets), ...list(o.lose?.sets)])])])]

function Edge({ from, i, p, at, dim, active }: { from: string; i: number; p: Port; at: Record<string, Point>; dim: boolean; active: boolean }) {
  const [x1, y1] = at[from]
  const [x2, y2] = at[p.to!]
  const a = [x1 + W, y1 + TOP + i * PORT + PORT / 2]
  let d
  if (x2 === x1) {
    const b = [x2 + W, y2 + 22]
    d = `M${a} C${[a[0] + 70, a[1]]} ${[b[0] + 70, b[1]]} ${b}`
  } else if (x2 < x1) {
    const b = [x2, y2 + 22]
    d = `M${a} C${[a[0] + 120, a[1] + 90]} ${[b[0] - 120, b[1] + 90]} ${b}`
  } else {
    const b = [x2, y2 + 22]
    const bend = Math.max(50, (b[0] - a[0]) / 2)
    d = `M${a} C${[a[0] + bend, a[1]]} ${[b[0] - bend, b[1]]} ${b}`
  }
  return (
    <g className={`edge ${p.kind}${p.door ? ' door' : ''}${dim ? ' dim' : ''}${active ? ' active' : ''}`}>
      <path d={d} markerEnd="url(#arrow)" />
    </g>
  )
}

function Dots({ score }: { score?: Score }) {
  return (
    <span className="dots">
      {Object.entries(score || {}).flatMap(([a, w]) =>
        Array.from({ length: w ?? 0 }, (_, i) => <i key={`${a}${i}`} title={`${alien(a)?.name || a} +${w}`} style={{ background: alien(a)?.color || '#f55' }} />),
      )}
    </span>
  )
}

function Options({ options }: { options: Option[] }) {
  return (
    <ul className="options">
      {options.map((o) => (
        <li key={o.label}>
          <span>
            {o.icon} {o.label}
          </span>
          <Dots score={o.score} />
          {o.odds != null && <code>{Math.round(o.odds * 100)}%</code>}
          {[...list(o.sets), ...list(o.win?.sets).map((f) => `${f} if won`), ...list(o.lose?.sets).map((f) => `${f} if lost`)].map((f) => (
            <b key={f} className="flag up">+{f}</b>
          ))}
        </li>
      ))}
    </ul>
  )
}

function Room({ id, problems, flags, known, onClose }: { id: string; problems: Shown[]; flags: Flags; known: string[]; onClose: () => void }) {
  const b = BEAT[id]
  const [play, setPlay] = useState(flags)
  const href = `/?story=${id}${play.length ? `&flags=${play.join(',')}` : ''}`
  return (
    <aside className="panel">
      <button className="close" onClick={onClose}>
        ×
      </button>
      <h2>
        {PLACES[id]?.icon} {b.title}
      </h2>
      <p className="meta">
        <code>{id}</code> · {PLACES[id]?.name} · {b.time}
        {Object.entries(b.timeIf || {}).map(([c, t]) => (
          <span key={c}>
            {' '}
            · {t} <code>{c}</code>
          </span>
        ))}
      </p>
      <p className="caption">{b.caption}</p>
      {Object.entries(b.captionIf || {}).map(([c, t]) => (
        <p key={c} className="caption alt">
          <code>{c}</code> {t}
        </p>
      ))}
      <section className="play">
        <h3>Play from here</h3>
        <div className="chips">
          {known.map((f) => (
            <label key={f} className={'chip' + (play.includes(f) ? ' on' : '')}>
              <input type="checkbox" checked={play.includes(f)} onChange={() => setPlay((p) => (p.includes(f) ? p.filter((x) => x !== f) : [...p, f]))} />
              {f}
            </label>
          ))}
        </div>
        <a className="go" href={href} target="_blank" rel="noreferrer">
          ▶ Play {b.title}
          {play.length ? ` with ${play.join(', ')}` : ''}
        </a>
      </section>
      {problems.length > 0 && (
        <section>
          <h3>Checker</h3>
          {problems.map((p, i) => (
            <p key={i} className={'problem ' + p.level}>
              {p.text}
            </p>
          ))}
        </section>
      )}
      <section>
        <h3>On walking in</h3>
        <p>
          {list(b.sets).map((f) => (
            <b key={f} className="flag up">+{f}</b>
          ))}
          {list(b.clears).map((f) => (
            <b key={f} className="flag down">−{f}</b>
          ))}
          {!b.sets && !b.clears && <span className="muted">nothing</span>}
        </p>
      </section>
      {b.asks.map((q, k) => (
        <section key={k}>
          <h3>
            Question {k + 1} {q.when && <code>{q.when}</code>} {q.time && <code>{q.time}</code>}
          </h3>
          <p className="caption">{q.q}</p>
          <ul className="options">
            {q.choices.map((c) => (
              <li key={c.label}>
                <span>
                  {c.icon} {c.label}
                  {c.to != null && <b> → {waysTo(c.to).map((t) => BEAT[t]?.title || t).join(' / ')}</b>}
                </span>
                <Dots score={c.score} />
                {c.when && <code>{c.when}</code>}
                {list(c.sets).map((f) => (
                  <b key={f} className="flag up">+{f}</b>
                ))}
                {c.menu && (
                  <div className="menu">
                    <em>{c.menu.prompt}</em>
                    <Options options={c.menu.options} />
                  </div>
                )}
              </li>
            ))}
          </ul>
        </section>
      ))}
      {!!b.extras?.length && (
        <section>
          <h3>Extras, any time</h3>
          <ul className="options">
            {b.extras.map((c) => (
              <li key={c.label}>
                <span>{c.label}</span>
                {list(c.sets).map((f) => (
                  <b key={f} className="flag up">+{f}</b>
                ))}
              </li>
            ))}
          </ul>
        </section>
      )}
      <section>
        <h3>Tests</h3>
        <p>
          <Dots score={Object.fromEntries(tests(id).map((k) => [k, 1]))} /> {tests(id).map((k) => ALIENS[k].name).join(', ')}
        </p>
      </section>
      <section>
        <h3>Ways out</h3>
        <ul className="options">
          {portsOf(b).map((p, i) => (
            <li key={i}>
              <span>
                {p.icon} {p.label}
                {p.to && (
                  <>
                    {' '}
                    → <b>{BEAT[p.to]?.title || p.to}</b>
                  </>
                )}
              </span>
              {p.when && <code>{p.when}</code>}
              {p.kind === 'bus' && <code>by bus</code>}
            </li>
          ))}
        </ul>
      </section>
    </aside>
  )
}

type Count = { total: number; ms: number; wins: Wins; error?: undefined } | { error: string }

function Balance() {
  const [count, setCount] = useState<Count | null>(null)
  useEffect(() => {
    fetch('/storycount.json')
      .then((r) => r.json())
      .then(setCount, (e) => setCount({ error: String(e) }))
  }, [])
  const pct = (x: number) => `${(x * 100).toFixed(1)}%`
  if (!count) return <p className="meta">Counting every combination of the day…</p>
  if (count.error != null) return <p className="problem error">{count.error}</p>
  const cell = (x: number) => <td className={Math.abs(x - share()) > EVEN ? 'off' : ''}>{pct(x)}</td>
  return (
    <>
      <p className="meta">
        {count.total.toExponential(2)} combinations, {(count.ms / 1000).toFixed(1)} s · even is {pct(share())} ± {pct(EVEN)}
      </p>
      <table className="balance">
        <thead>
          <tr>
            <th />
            <th>combinations</th>
            <th>blind</th>
          </tr>
        </thead>
        <tbody>
          {Object.entries(count.wins).map(([a, w]) => (
            <tr key={a}>
              <th style={{ color: alien(a)?.color }}>{alien(a)?.name ?? a}</th>
              {cell(w.combos)}
              {cell(w.blind)}
            </tr>
          ))}
        </tbody>
      </table>
    </>
  )
}

function Problems({ report, onPick }: { report: ReturnType<typeof checkStory>; onPick: (room: string) => void }) {
  const all: Shown[] = [...report.errors.map((p) => ({ ...p, level: 'error' as const })), ...report.warnings.map((p) => ({ ...p, level: 'warn' as const }))]
  return (
    <aside className="panel">
      <h2>Aliens</h2>
      <Balance />
      <h2>Checker</h2>
      <p className="meta">
        {report.runs} states of the day played out · endings: {report.endings.map((id) => BEAT[id].title).join(', ')}
      </p>
      {!all.length && <p className="ok">No problems.</p>}
      {all.map((p, i) => (
        <p key={i} className={'problem ' + p.level} onClick={() => p.room && BEAT[p.room] && onPick(p.room)}>
          <code>{p.room || 'story'}</code> {p.text}
        </p>
      ))}
      <h3>Cards</h3>
      {(
        [
          ['WAKE', WAKE],
          ['CROSSING', CROSSING],
          ['FARE', FARE],
        ] as const
      ).map(([name, m]) => (
        <div key={name} className="menu">
          <em>
            <code>{name}</code> {m.prompt} {m.when && <code>{m.when}</code>}
          </em>
          <Options options={m.options} />
        </div>
      ))}
    </aside>
  )
}

function Map() {
  const report = useMemo(checkStory, [])
  const { at, width, height } = useMemo(layout, [])
  const [flags, setFlags] = useState<Flags>([])
  const [trying, setTrying] = useState(false)
  const [room, setRoom] = useState<string | null>(null)
  const [zoom, setZoom] = useState(0.85)
  const known = useMemo(() => [...new Set([...Object.keys(report.flags.raised), ...Object.keys(report.flags.read)])].sort(), [report])
  const problemsOf = (id: string): Shown[] => [...report.errors.filter((p) => p.room === id).map((p) => ({ ...p, level: 'error' as const })), ...report.warnings.filter((p) => p.room === id).map((p) => ({ ...p, level: 'warn' as const }))]
  const closed = (p: Port) => trying && !holds(p.when, flags)
  return (
    <div className="map">
      <header>
        <h1>AlienMe story map</h1>
        <span className="stat">{BEATS.length} rooms</span>
        <span className={'stat' + (report.errors.length ? ' bad' : '')}>{report.errors.length} errors</span>
        <span className={'stat' + (report.warnings.length ? ' warn' : '')}>{report.warnings.length} warnings</span>
        <label className="zoom">
          Zoom
          <input type="range" min="0.4" max="1.2" step="0.05" value={zoom} onChange={(e) => setZoom(+e.target.value)} />
        </label>
        <div className="legend">
          <span className="next">then</span>
          <span className="exit">player picks</span>
          <span className="bus">by bus</span>
          <span className="fork">fork by scores</span>
          <span className="door">through a door</span>
        </div>
        <div className="chips">
          <label className={'chip try' + (trying ? ' on' : '')}>
            <input type="checkbox" checked={trying} onChange={() => setTrying((t) => !t)} />
            Dim ways closed with flags:
          </label>
          {known.map((f) => (
            <label key={f} className={'chip' + (flags.includes(f) ? ' on' : '')}>
              <input type="checkbox" checked={flags.includes(f)} onChange={() => setFlags((l) => (l.includes(f) ? l.filter((x) => x !== f) : [...l, f]))} />
              {f}
            </label>
          ))}
        </div>
      </header>
      <div className="body">
        <div className="canvas">
          <div className="sheet" style={{ width, height, zoom }}>
            <svg width={width} height={height}>
              <defs>
                <marker id="arrow" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse">
                  <path d="M0,0 L10,5 L0,10 z" fill="context-stroke" />
                </marker>
              </defs>
              {BEATS.flatMap((b) =>
                portsOf(b).map((p, i) => p.to && at[p.to] && <Edge key={`${b.id}-${i}`} from={b.id} i={i} p={p} at={at} dim={closed(p)} active={room === b.id || room === p.to} />),
              )}
            </svg>
            {BEATS.map((b) => {
              const [x, y] = at[b.id]
              const probs = problemsOf(b.id)
              const level = probs.some((p) => p.level === 'error') ? ' error' : probs.length ? ' warn' : ''
              return (
                <button key={b.id} className={'room' + level + (room === b.id ? ' on' : '') + (b.id === START ? ' start' : '')} style={{ left: x, top: y, width: W, height: heightOf(b) }} onClick={() => setRoom(b.id)}>
                  <div className="top">
                    <span>
                      {PLACES[b.id]?.icon} {b.title}
                    </span>
                    <time>{b.time}</time>
                  </div>
                  <div className="tags">
                    <code>{b.id}</code>
                    {flagsRaised(b).map((f) => (
                      <b key={f} className="flag up">+{f}</b>
                    ))}
                    {probs.length > 0 && <b className={'flag ' + (level.trim() === 'error' ? 'down' : 'need')}>⚠ {probs.length}</b>}
                  </div>
                  {portsOf(b).map((p, i) => (
                    <div key={i} className={`port ${p.kind}${p.door ? ' door' : ''}${closed(p) ? ' dim' : ''}`}>
                      <span>
                        {p.icon} {p.label}
                      </span>
                      {p.when && <code>{p.when}</code>}
                    </div>
                  ))}
                </button>
              )
            })}
          </div>
        </div>
        {room ? <Room key={room} id={room} problems={problemsOf(room)} flags={flags} known={known} onClose={() => setRoom(null)} /> : <Problems report={report} onPick={setRoom} />}
      </div>
    </div>
  )
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <Map />
  </StrictMode>,
)
