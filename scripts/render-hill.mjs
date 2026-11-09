import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { execFileSync } from 'node:child_process'
import { createServer } from 'vite'
import { chromium } from 'playwright'

const FPS = 12
const INK = '#3a2a4a'
const OUTLINE = 2.5

function record({ fps, ink, px, crop: [cx, cy, cw, ch] }) {
  const make = () => Object.assign(document.createElement('canvas'), { width: cw, height: ch })
  const outlined = (src) => {
    const cut = make()
    cut.getContext('2d').drawImage(src, cx, cy, cw, ch, 0, 0, cw, ch)
    const sil = make()
    const s = sil.getContext('2d')
    s.drawImage(cut, 0, 0)
    s.globalCompositeOperation = 'source-in'
    s.fillStyle = ink
    s.fillRect(0, 0, cw, ch)
    const out = make()
    const o = out.getContext('2d', { willReadFrequently: true })
    for (let i = 0; i < 24; i++) o.drawImage(sil, Math.cos((i / 24) * 2 * Math.PI) * px, Math.sin((i / 24) * 2 * Math.PI) * px)
    o.drawImage(cut, 0, 0)
    const img = o.getImageData(0, 0, cw, ch)
    const d = img.data
    for (let i = 0; i < d.length; i += 4) {
      if (d[i + 3] >= 128) d[i + 3] = 255
      else d[i] = d[i + 1] = d[i + 2] = d[i + 3] = 0
    }
    o.putImageData(img, 0, 0)
    return out.toDataURL('image/png').split(',')[1]
  }
  const canvas = document.querySelector('canvas')
  const n = Math.round(window.__loop * fps)
  const start = 3 * n
  const frames = []
  for (let i = 0; i < start + n; i++) {
    window.__step(i / fps)
    if (i >= start) frames.push(outlined(canvas))
  }
  return frames
}

const open = async (url, q) => {
  const page = await browser.newPage({ viewport: { width: 1200, height: 600 }, deviceScaleFactor: 2 })
  await page.goto(`${url}?town${q}`)
  await page.waitForFunction(() => window.__townReady, null, { timeout: 90000 })
  return page
}

async function layout(url) {
  const page = await open(url, '&person=0')
  const L = await page.evaluate(() => window.__layout)
  await page.close()
  const [W, H] = L.size
  const pad = OUTLINE + 2
  const crops = L.mates.map(({ frame: f }) => {
    const x = Math.max(0, Math.floor(f.x * W) - pad)
    const y = Math.max(0, Math.floor(f.y * H) - pad)
    return [x, y, Math.min(W, Math.ceil((f.x + f.w) * W) + pad) - x, Math.min(H, Math.ceil((f.y + f.h) * H) + pad) - y]
  })
  const mates = L.mates.map((m, i) => ({ ...m, frame: { x: crops[i][0] / W, y: crops[i][1] / H, w: crops[i][2] / W, h: crops[i][3] / H } }))
  const fix = (v) => JSON.parse(JSON.stringify(v, (k, n) => (typeof n === 'number' ? Math.round(n * 1e5) / 1e5 : n)))
  await writeFile('src/data/hill.json', JSON.stringify(fix({ size: L.size, frames: Math.round(2.5 * FPS), loop: 2.5, shades: L.shades, mates }), null, 2) + '\n')
  console.log('src/data/hill.json')
  return crops
}

async function renderTown(url) {
  for (const [q, name] of [['', 'town'], ['&mask', 'sky']]) {
    const page = await open(url, q)
    await page.waitForTimeout(1500)
    await page.screenshot({ path: join(dir, `${name}.png`) })
    await page.close()
  }
  execFileSync('ffmpeg', [
    '-y', '-loglevel', 'error', '-i', join(dir, 'town.png'), '-i', join(dir, 'sky.png'),
    '-filter_complex', '[1]format=gray,negate,dilation,dilation[a];[0][a]alphamerge',
    '-c:v', 'libwebp', '-pix_fmt', 'yuva420p', '-quality', '78', '-compression_level', '6', 'public/hill/town.webp',
  ])
  console.log('public/hill/town.webp')
}

async function renderPeople(url, kinds, crops) {
  for (const [i, kind] of kinds.entries())
    for (const form of ['human', 'alien']) {
      const page = await open(url, `&person=${i}&form=${form}`)
      await page.waitForTimeout(2500)
      const frames = await page.evaluate(record, { fps: FPS, ink: INK, px: OUTLINE, crop: crops[i] })
      await page.close()
      const name = `${kind}-${form}`
      await Promise.all(frames.map((f, k) => writeFile(join(dir, `${name}-${String(k).padStart(3, '0')}.png`), Buffer.from(f, 'base64'))))
      const file = `public/hill/${name}.webp`
      execFileSync('ffmpeg', [
        '-y', '-loglevel', 'error', '-i', join(dir, `${name}-%03d.png`), '-vf', `tile=${frames.length}x1`, '-frames:v', '1',
        '-c:v', 'libwebp', '-pix_fmt', 'yuva420p', '-quality', '60', '-compression_level', '6', file,
      ])
      console.log(file, `${frames.length} frames`)
    }
}

const only = process.argv[2]
const server = await createServer({ logLevel: 'error', server: { port: 0 } })
await server.listen()
const browser = await chromium.launch({ args: ['--use-angle=gl', '--enable-gpu', '--ignore-gpu-blocklist'] })
const dir = await mkdtemp(join(tmpdir(), 'hill-'))
try {
  const { ALIEN_KEYS } = await server.ssrLoadModule('/src/data/aliens.ts')
  const url = server.resolvedUrls.local[0]
  await mkdir('public/hill', { recursive: true })
  const crops = await layout(url)
  if (only !== 'people') await renderTown(url)
  if (only !== 'town') await renderPeople(url, ALIEN_KEYS, crops)
} finally {
  await rm(dir, { recursive: true, force: true })
  await browser.close()
  await server.close()
}
