import { say } from './cast'

type Answer = { label: string; icon?: string; fuse?: { dur: number; from: number }; gone?: boolean }

export function Card({ menu, onPick, lead }: { menu: { prompt: string; options: Answer[] }; onPick: (j: number) => void; lead?: string }) {
  return (
    <div className="menu-card">
      <div className="menu-prompt">
        {lead && <div className="menu-lead">{say(lead)}</div>}
        {say(menu.prompt)}
      </div>
      <div className="menu-options">
        {menu.options.map((o, j) => (
          <button
            key={o.label}
            className={'exit-sign' + (o.fuse ? ' fused' : '') + (o.gone ? ' gone' : '')}
            disabled={o.gone}
            style={{ animationDelay: `${j * 0.05}s` }}
            onClick={() => onPick(j)}
          >
            {o.icon && <span className="exit-icon">{o.icon}</span>}
            {say(o.label)}
            {o.fuse && !o.gone && <span className="fuse" style={{ animationDuration: `${o.fuse.dur}s`, animationDelay: `${-o.fuse.from}s` }} />}
          </button>
        ))}
      </div>
    </div>
  )
}
