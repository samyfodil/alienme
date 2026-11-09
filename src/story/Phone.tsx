import { useEffect, useState } from 'react'
import { holds } from './engine'
import { say } from './cast'
import type { Flags, Phone } from './types'

const SHOWN = 4

type Props = { phone: Phone; flags: Flags; time: string; delay?: number }

export function PhoneScreen({ phone, flags, time, delay = 0, low }: Props & { low?: boolean }) {
  return (
    <div className={'phone' + (low ? ' low' : '')} style={{ animationDelay: `${delay}s` }}>
      <div className="phone-bar">
        <span>{time}</span>
        <span className="phone-notch" />
        <span>📶 🔋</span>
      </div>
      {phone.call ? <Call from={phone.from} delay={delay} /> : <Thread phone={phone} flags={flags} time={time} delay={delay} />}
    </div>
  )
}

function Thread({ phone, flags, time, delay }: Required<Props>) {
  const texts = (phone.texts ?? []).filter((t) => t.at <= time && holds(t.when, flags)).slice(-SHOWN)
  return (
    <>
      <div className="phone-head">
        <span className="phone-avatar">{phone.from[0]}</span>
        {phone.from}
      </div>
      <div className="phone-thread">
        {texts.map((t, i) => (
          <div key={i} className={'phone-text' + (t.me ? ' me' : '')} style={{ animationDelay: `${delay + 0.4 + i * 0.35}s` }}>
            {say(t.text)}
            <span className="phone-at">{t.at}</span>
          </div>
        ))}
      </div>
    </>
  )
}

function Call({ from, delay }: { from: string; delay: number }) {
  const [s, setS] = useState(0)
  useEffect(() => {
    let id: ReturnType<typeof setInterval> | undefined
    const start = setTimeout(() => (id = setInterval(() => setS((x) => x + 1), 1000)), (delay + 0.6) * 1000)
    return () => {
      clearTimeout(start)
      clearInterval(id)
    }
  }, [delay])
  return (
    <div className="phone-call">
      <span className="phone-avatar phone-avatar-big">{from[0]}</span>
      <div className="phone-call-name">{from}</div>
      <div className="phone-call-time">{s ? `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}` : 'calling…'}</div>
    </div>
  )
}
