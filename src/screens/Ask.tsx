import { useState, type ReactNode } from 'react'
import { useGame } from '../store'

type AskProps = { lead?: string; question: string; children: ReactNode; onSubmit: () => void; onClose: () => void }

export function Ask({ lead, question, children, onSubmit, onClose }: AskProps) {
  return (
    <div className="ask" role="dialog" aria-modal="true" onPointerDown={(e) => e.target === e.currentTarget && onClose()} onKeyDown={(e) => e.key === 'Escape' && onClose()}>
      <form
        className="ask-box"
        onSubmit={(e) => {
          e.preventDefault()
          onSubmit()
        }}
      >
        <div className="menu-prompt">
          {lead && <div className="menu-lead">{lead}</div>}
          {question}
        </div>
        {children}
      </form>
    </div>
  )
}

const NAMES = ['Dave', 'Linda', 'Gary', 'Brenda', 'Steve', 'Pam', 'Doug', 'Janet', 'Barry', 'Susan', 'Kevin', 'Deborah', 'Greg', 'Wendy', 'Nigel', 'Carol']

export function NameAsk({ onDone, onClose }: { onDone: () => void; onClose: () => void }) {
  const name = useGame((s) => s.name)
  const setName = useGame((s) => s.setName)
  const [typed, setTyped] = useState(name)
  const [offer] = useState(() => NAMES[Math.floor(Math.random() * NAMES.length)])
  return (
    <Ask
      lead="Every human has a name."
      question="What do the humans call you?"
      onClose={onClose}
      onSubmit={() => {
        setName(typed.trim() || offer)
        onDone()
      }}
    >
      <input
        className="ask-name"
        value={typed}
        onChange={(e) => setTyped(e.target.value)}
        placeholder={offer}
        maxLength={18}
        autoFocus
        autoComplete="off"
        spellCheck={false}
        enterKeyHint="go"
        aria-label="Your human name"
      />
      <div className="menu-options">
        <button type="button" className="exit-sign" onClick={onClose}>
          Back
        </button>
        <button type="submit" className="exit-sign">
          Begin &rarr;
        </button>
      </div>
    </Ask>
  )
}

function Corner({ icon, word, question, onYes }: { icon: string; word: string; question: string; onYes: () => void }) {
  const [asking, setAsking] = useState(false)
  return (
    <>
      <button className="start-over" onClick={() => setAsking(true)} aria-label={word} title={word}>
        <span aria-hidden="true">{icon}</span>
        <span className="start-over-word">{word}</span>
      </button>
      {asking && (
        <Ask question={question} onSubmit={onYes} onClose={() => setAsking(false)}>
          <div className="menu-options">
            <button type="button" className="exit-sign" onClick={() => setAsking(false)} autoFocus>
              Keep going
            </button>
            <button type="submit" className="exit-sign">
              {icon} {word}
            </button>
          </div>
        </Ask>
      )}
    </>
  )
}

export function CornerButtons({ restart, onRestart, className }: { restart: string; onRestart: () => void; className: string }) {
  const exit = useGame((s) => s.exit)
  return (
    <div className={'corner-buttons ' + className}>
      <Corner icon="↺" word="Start over" question={restart} onYes={onRestart} />
      <Corner icon="✕" word="Exit" question="Back to the title page? Today's progress goes; your disguise is kept." onYes={exit} />
    </div>
  )
}
