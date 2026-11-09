import { mkdirSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { createServer } from 'vite'
import { chromium } from 'playwright'

const [seedArg = '1', room = '', extrasArg = '0.5'] = process.argv.slice(2)
const PREFER = (process.env.PREFER || '').split(',').filter(Boolean)
let seed = +seedArg || 1
const rnd = () => ((seed = (seed * 1103515245 + 12345) % 2147483648), seed / 2147483648)
const out = join(tmpdir(), `story-play-${seedArg}${room ? '-' + room.replace(/\W+/g, '-') : ''}`)
mkdirSync(out, { recursive: true })

const server = await createServer({ logLevel: 'error', server: { port: 0 } })
await server.listen()
const browser = await chromium.launch({ args: ['--use-angle=gl', '--enable-gpu', '--ignore-gpu-blocklist'] })
const [vw, vh] = (process.env.VIEW || '1280x720').split('x').map(Number)
const page = await browser.newPage({ viewport: { width: vw, height: vh } })
const errors = []
page.on('pageerror', (e) => errors.push(e.message))
page.on('console', (m) => m.type() === 'error' && errors.push(m.text().slice(0, 200)))
await page.goto(`${server.resolvedUrls.local[0]}?story${room ? '=' + room : ''}`)

const lines = []
const t0 = Date.now()
let lastNews = Date.now()
const log = (s) => {
  lastNews = Date.now()
  lines.push(`${String(Math.round((Date.now() - t0) / 1000)).padStart(3)}s ${s}`)
  writeFileSync(join(out, 'log.txt'), lines.join('\n') + '\n')
}
let n = 0
const shot = async (tag) => {
  const f = `${String(n++).padStart(3, '0')}-${tag}.png`
  await page.screenshot({ path: join(out, f) })
  log(`  [${f}]`)
}

const look = () =>
  page.evaluate(() => {
    const all = (sel) => [...document.querySelectorAll(sel)]
    const txt = (el) => el.innerText.replace(/\s+/g, ' ').trim()
    const card = document.querySelector('.menu-card')
    const lead = card?.querySelector('.menu-lead')
    return {
      stage: window.__story?.stage ?? null,
      hud: all('.caption-tag').map(txt)[0] ?? null,
      caption: all('.caption-box .caption, .caption.intro').map(txt)[0] ?? null,
      say: all('.say:not(.say-menu)').map(txt).join(' | '),
      phone: all('.phone-text, .phone-call-name').map(txt).join(' | '),
      lead: lead ? txt(lead) : null,
      prompt: card ? txt(card.querySelector('.menu-prompt')).replace(lead ? txt(lead) : '', '').trim() : null,
      card: card ? all('.menu-options button').map((e) => ({ label: txt(e), on: !e.disabled })) : [],
      think: all('.think-prompt').map(txt)[0] ?? null,
      spoke: all('.say-prompt').map(txt)[0] ?? null,
      spoken: all('.say-option').map((e) => ({ label: txt(e), on: !e.disabled })),
      thoughts: all('.think-option').map((e) => ({ label: txt(e), on: true })),
      doors: all('.door-sign').map((e) => ({ label: txt(e), on: true })),
      extras: all('.hotspot').map(txt),
      over: !!document.querySelector('.reveal'),
    }
  })
const click = (sel, i) => page.evaluate(([sel, i]) => document.querySelectorAll(sel)[i]?.click(), [sel, i])

let last = {}
const asked = new Set()
let poked = null
let travelShot = 0
let where = null
const deadline = Date.now() + 9 * 60 * 1000
const STUCK = 45000
try {
  while (Date.now() < deadline) {
    await page.waitForTimeout(300)
    const s = await look().catch(() => null)
    if (!s) continue
    if (s.over) {
      await shot('reveal')
      log('== the day is over')
      break
    }
    if (Date.now() - lastNews > STUCK) {
      await shot('stuck')
      log(`== STUCK: nothing has happened for ${STUCK / 1000}s (stage ${s.stage})`)
      process.exitCode = 1
      break
    }
    if (s.hud && s.hud !== last.hud) log(`CLOCK ${s.hud}`)
    if (s.caption && s.caption !== last.caption) {
      log(`CAPTION "${s.caption}"`)
      if (s.stage === 'enter') {
        where = s.hud
        await shot('enter')
      }
    }
    if (s.say && s.say !== last.say) {
      log(`SAYS "${s.say}"`)
      await shot('says')
    }
    if (s.phone && s.phone !== last.phone) log(`PHONE ${s.phone}`)
    if (s.stage === 'travel' && Date.now() - travelShot > 4000) {
      travelShot = Date.now()
      await shot('travel')
    }
    last = s

    let kind, sel, opts, prompt
    if (s.card.some((o) => o.on) && s.prompt) [kind, sel, opts, prompt] = ['CARD', '.menu-options button', s.card, s.prompt]
    else if (s.thoughts.length) [kind, sel, opts, prompt] = ['THINK', '.think-option', s.thoughts, s.think]
    else if (s.spoken.length) [kind, sel, opts, prompt] = ['ASKS', '.say-option', s.spoken, s.spoke]
    else if (s.doors.length && s.prompt) [kind, sel, opts, prompt] = ['DOORS', '.door-sign', s.doors, s.prompt]
    if (!kind) continue
    const key = `${where}|${kind}|${prompt}|${opts.map((o) => o.label).join('/')}`
    if (asked.has(key)) continue
    if (s.extras.length && poked !== where && s.stage === 'choose' && rnd() < +extrasArg) {
      poked = where
      const i = Math.floor(rnd() * s.extras.length)
      log(`EXTRAS [${s.extras.join(' | ')}]  > ${s.extras[i]}`)
      await click('.hotspot', i)
      await page.waitForTimeout(1800)
      await shot('extra')
      continue
    }
    asked.add(key)
    await page.waitForTimeout(600)
    log(`${kind}: ${s.lead ? `(${s.lead}) ` : ''}${prompt}`)
    log(`  [${opts.map((o) => (o.on ? o.label : `~${o.label}~`)).join(' | ')}]`)
    await shot(kind.toLowerCase())
    const open = opts.map((o, i) => (o.on ? i : -1)).filter((i) => i >= 0)
    const wanted = open.find((j) => PREFER.some((w) => opts[j].label.includes(w)))
    const i = wanted ?? open[Math.floor(rnd() * open.length)]
    log(`  > ${opts[i].label}`)
    await click(sel, i)
    await page.waitForTimeout(2200)
    if (['act', 'menu'].includes((await look().catch(() => ({}))).stage)) await shot('act')
  }
  log(`errors: ${JSON.stringify(errors)}`)
} finally {
  await browser.close()
  await server.close()
}
console.log(join(out, 'log.txt'))
