import { useEffect, useState } from 'react'

type Issue = { room: string; text: string }

export function Checked() {
  const [errors, setErrors] = useState<Issue[]>([])
  useEffect(() => {
    if (!import.meta.env.DEV) return
    const worker = new Worker(new URL('./check.worker.ts', import.meta.url), { type: 'module' })
    worker.onmessage = ({ data: r }: MessageEvent<{ errors: Issue[]; warnings: Issue[] }>) => {
      setErrors(r.errors)
      if (r.warnings.length) console.warn(`Story: ${r.warnings.length} warning(s)\n` + r.warnings.map((w) => `  ${w.room}: ${w.text}`).join('\n'))
      worker.terminate()
    }
    worker.onerror = (e) => console.error('Story check failed:', e.message)
    return () => worker.terminate()
  }, [])
  if (!errors.length) return null
  return (
    <div className="story-errors">
      <b>
        The story has {errors.length} error{errors.length > 1 ? 's' : ''}
      </b>
      {errors.slice(0, 6).map((e, i) => (
        <div key={i}>
          <code>{e.room}</code> {e.text}
        </div>
      ))}
      <a href="./storymap.html" target="_blank" rel="noreferrer">
        Open the story map →
      </a>
    </div>
  )
}
