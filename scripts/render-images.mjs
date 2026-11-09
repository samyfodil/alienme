import { mkdir, writeFile } from 'node:fs/promises'
import { createServer } from 'vite'
import { chromium } from 'playwright'

const W = 360
const H = 240

const server = await createServer({ logLevel: 'error', server: { port: 0 } })
await server.listen()
const browser = await chromium.launch()
try {
  const { ALIEN_KEYS } = await server.ssrLoadModule('/src/data/aliens.ts')
  const url = server.resolvedUrls.local[0]
  await mkdir('public/species', { recursive: true })
  const page = await browser.newPage({ viewport: { width: W, height: H }, deviceScaleFactor: 2 })
  for (const kind of ALIEN_KEYS) {
    await page.goto(`${url}?specimen=${kind}`)
    await page.waitForFunction(() => window.__specimenReady, null, { timeout: 60000 })
    const webp = await page.evaluate(() => document.querySelector('canvas').toDataURL('image/webp', 0.86).split(',')[1])
    await writeFile(`public/species/${kind}.webp`, Buffer.from(webp, 'base64'))
    console.log(`public/species/${kind}.webp`)
  }
} finally {
  await browser.close()
  await server.close()
}
