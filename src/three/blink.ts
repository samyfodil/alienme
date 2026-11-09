const SHUT = 0.13

export function blinker() {
  let next: number | null = null
  let blinks: number[] = []
  return (now: number) => {
    if (next == null || next - now > 10) next = now + 1 + Math.random() * 3
    if (now >= next) {
      blinks = Math.random() < 0.2 ? [now, now + SHUT + 0.09] : [now]
      next = now + 2.5 + Math.random() * 3.5
    }
    for (const b of blinks) {
      const t = (now - b) / SHUT
      if (t >= 0 && t <= 1) return Math.min(1, 1.5 * Math.sin(Math.PI * t))
    }
    return 0
  }
}
