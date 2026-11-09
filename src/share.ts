import { GIFEncoder, quantize, applyPalette } from 'gifenc'
import type { ALIENS } from './data/aliens'

type Ctx = CanvasRenderingContext2D
type AlienCard = (typeof ALIENS)[keyof typeof ALIENS]
type Render = HTMLCanvasElement | HTMLImageElement | ImageBitmap

export const CARD_W = 1080
export const CARD_H = 1350
export const WINDOW_TALL = 0.78

const INK = '#1b1200'
const PAPER = '#fffdf6'
const BODY = '#2a2440'
const NEON = '#5fffd1'
export const SITE = 'https://alienme.xyz'

function spaced(g: Ctx, text: string, x: number, y: number, spacing: number) {
  const chars = [...text]
  const w = chars.reduce((s, c) => s + g.measureText(c).width, 0) + spacing * (chars.length - 1)
  let cx = x - w / 2
  for (const c of chars) {
    g.fillText(c, cx + g.measureText(c).width / 2, y)
    cx += g.measureText(c).width + spacing
  }
  return w
}

function wrap(g: Ctx, text: string, maxW: number) {
  const lines: string[] = []
  let line = ''
  for (const word of text.split(' ')) {
    const next = line ? `${line} ${word}` : word
    if (g.measureText(next).width > maxW && line) {
      lines.push(line)
      line = word
    } else line = next
  }
  if (line) lines.push(line)
  return lines
}

function chunky(g: Ctx, text: string, x: number, y: number, size: number, fill: string, k: number) {
  g.font = `900 ${size}px Orbitron, sans-serif`
  let s = size
  while (g.measureText(text).width > g.canvas.width * 0.86 && s > 12) g.font = `900 ${(s -= 2)}px Orbitron, sans-serif`
  g.lineJoin = 'round'
  g.lineWidth = s * 0.16
  g.strokeStyle = INK
  g.fillStyle = INK
  g.strokeText(text, x, y + 5 * k)
  g.fillText(text, x, y + 5 * k)
  g.strokeText(text, x, y)
  g.fillStyle = fill
  g.fillText(text, x, y)
}

function pill(g: Ctx, text: string, x: number, y: number, size: number, k: number) {
  g.font = `700 ${size}px "Space Mono", monospace`
  const sp = size * 0.22
  const w = [...text].reduce((s, c) => s + g.measureText(c).width, 0) + sp * (text.length - 1)
  const h = size * 1.9
  g.fillStyle = 'rgba(6, 8, 18, 0.88)'
  g.beginPath()
  g.roundRect(x - w / 2 - size, y - h / 2, w + 2 * size, h, h / 2)
  g.fill()
  g.fillStyle = NEON
  g.textBaseline = 'middle'
  spaced(g, text, x, y + 1 * k, sp)
  g.textBaseline = 'alphabetic'
}

export function drawCard(g: Ctx, render: Render, alien: AlienCard, name: string, { phase = 'alien', caption, tagline = true }: { phase?: 'human' | 'alien'; caption?: string; tagline?: boolean } = {}) {
  const { width: W, height: H } = g.canvas
  const k = W / CARD_W
  const m = Math.round(W * 0.045)
  const win = W - 2 * m
  const winH = Math.round(win * WINDOW_TALL)
  const mid = W / 2
  g.save()
  g.fillStyle = '#d9cdfd'
  g.fillRect(0, 0, W, H)
  g.fillStyle = PAPER
  g.strokeStyle = INK
  g.lineWidth = 8 * k
  g.beginPath()
  g.roundRect(4 * k, 4 * k, W - 8 * k, H - 8 * k, 40 * k)
  g.fill()
  g.stroke()

  g.save()
  g.beginPath()
  g.roundRect(m, m, win, winH, 28 * k)
  g.clip()
  const S = render.width
  g.drawImage(render, 0, (S - S * WINDOW_TALL) / 2, S, S * WINDOW_TALL, m, m, win, winH)
  g.restore()
  g.lineWidth = 7 * k
  g.beginPath()
  g.roundRect(m, m, win, winH, 28 * k)
  g.stroke()

  g.textAlign = 'center'
  g.textBaseline = 'alphabetic'
  if (caption) chunky(g, caption, mid, m + 92 * k, 64 * k, '#ffffff', k)

  const top = m + winH
  const human = phase === 'human'
  pill(g, human ? 'SPECIES CHECK' : name ? `${name.toUpperCase()}'S TRUE FORM` : 'MY TRUE FORM', mid, top + 58 * k, 24 * k, k)
  chunky(g, human ? 'Human?' : alien.name, mid, top + 200 * k, 108 * k, human ? '#f6d8ac' : alien.color, k)
  g.font = `700 ${30 * k}px Orbitron, sans-serif`
  g.fillStyle = BODY
  spaced(g, human ? 'SCANNING…' : alien.title.toUpperCase(), mid, top + 282 * k, 8 * k)
  if (tagline && !human) {
    g.font = `italic ${30 * k}px "Space Mono", monospace`
    wrap(g, alien.tagline, W - 220 * k)
      .slice(0, 2)
      .forEach((line, i) => g.fillText(line, mid, top + 348 * k + i * 42 * k))
  }
  g.font = `700 ${22 * k}px "Space Mono", monospace`
  g.fillStyle = 'rgba(42, 36, 64, 0.65)'
  spaced(g, SITE.replace('https://', '').toUpperCase(), mid, H - 30 * k, 6 * k)
  g.restore()
}

export async function shareCard(render: Render, alien: AlienCard, name: string) {
  await document.fonts.ready
  const c = document.createElement('canvas')
  c.width = CARD_W
  c.height = CARD_H
  drawCard(c.getContext('2d')!, render, alien, name)
  return new Promise<Blob | null>((resolve) => c.toBlob(resolve, 'image/png'))
}

export const GIF_W = 400
export const GIF_H = 500

export async function shareGif(frames: { t: number; image: Render }[], alien: AlienCard, name: string, popT: number) {
  await document.fonts.ready
  const c = document.createElement('canvas')
  c.width = GIF_W
  c.height = GIF_H
  const g = c.getContext('2d', { willReadFrequently: true })!
  const gif = GIFEncoder()
  const me = name ? name.toUpperCase() : 'ME'
  for (let i = 0; i < frames.length; i++) {
    const f = frames[i]
    const human = f.t < popT
    drawCard(g, f.image, alien, name, { phase: human ? 'human' : 'alien', caption: human ? `${me}, A HUMAN` : 'NOPE.', tagline: false })
    const { data } = g.getImageData(0, 0, GIF_W, GIF_H)
    const palette = quantize(data, 256)
    const last = i === frames.length - 1
    const delay = last ? 2400 : i === 0 ? 900 : Math.max(20, Math.round((frames[i + 1].t - f.t) * 1000))
    gif.writeFrame(applyPalette(data, palette), GIF_W, GIF_H, { palette, delay })
    if (i % 3 === 2) await new Promise((r) => setTimeout(r))
  }
  gif.finish()
  return new Blob([gif.bytes()], { type: 'image/gif' })
}

export async function download(blobPromise: Promise<Blob | null>, filename: string) {
  const blob = await blobPromise
  if (!blob) return
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  a.click()
  setTimeout(() => URL.revokeObjectURL(url), 1000)
}

export async function shareFile(blob: Blob, filename: string, text: string) {
  const file = new File([blob], filename, { type: blob.type })
  if (navigator.canShare?.({ files: [file] })) {
    try {
      await navigator.share({ files: [file], text })
      return 'shared'
    } catch (e) {
      if ((e as Error).name === 'AbortError') return 'cancelled'
    }
  }
  await download(Promise.resolve(blob), filename)
  return 'saved'
}
