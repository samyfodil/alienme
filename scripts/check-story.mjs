import { createServer } from 'vite'
import { countStory } from './storycount.mjs'

const server = await createServer({ server: { middlewareMode: true }, appType: 'custom', logLevel: 'error' })
try {
  const { checkStory } = await server.ssrLoadModule('/src/story/check.ts')
  const { storyJSON, uneven, share, EVEN } = await server.ssrLoadModule('/src/story/count.ts')
  const { errors, warnings, endings, runs } = checkStory()
  const line = (p) => `  ${(p.room || '-').padEnd(10)} ${p.text}`
  console.log(`${runs} states played out; endings: ${endings.join(', ')}`)
  const c = countStory(storyJSON())
  const pct = (x) => `${(x * 100).toFixed(1)}%`
  console.log(`\nevery combination of the day (${c.total.toExponential(3)}, ${c.states} states, ${(c.ms / 1000).toFixed(1)} s), and blind:`)
  for (const [a, w] of Object.entries(c.wins)) console.log(`  ${a.padEnd(11)} ${pct(w.combos).padStart(6)}  ${pct(w.blind).padStart(6)}`)
  const off = uneven(c.wins)
  if (off.length) console.log(`\nnot even (${pct(share())} ± ${pct(EVEN)}):\n${off.map((o) => `  ${o.alien} ${pct(o.share)} ${o.measure === 'combos' ? 'of combinations' : 'blind'}`).join('\n')}`)
  if (warnings.length) console.log(`\n${warnings.length} warning(s):\n${warnings.map(line).join('\n')}`)
  if (errors.length) console.log(`\n${errors.length} error(s):\n${errors.map(line).join('\n')}`)
  else console.log('\nno errors')
  process.exitCode = errors.length || off.length ? 1 : 0
} finally {
  await server.close()
}
