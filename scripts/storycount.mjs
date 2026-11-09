import { execFile, execFileSync } from 'node:child_process'
import { mkdtempSync, writeFileSync, rmSync } from 'node:fs'
import { promisify } from 'node:util'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'

const DIR = fileURLToPath(new URL('../tools/storycount/', import.meta.url))
const BIN = join(DIR, 'storycount')

export function countStory(json) {
  execFileSync('go', ['build', '-o', BIN, '.'], { cwd: DIR, stdio: 'inherit' })
  const tmp = mkdtempSync(join(tmpdir(), 'storycount-'))
  try {
    const file = join(tmp, 'story.json')
    writeFileSync(file, json)
    return JSON.parse(execFileSync(BIN, [file], { maxBuffer: 1 << 20 }))
  } finally {
    rmSync(tmp, { recursive: true, force: true })
  }
}

export async function countStoryLater(json) {
  const run = promisify(execFile)
  await run('go', ['build', '-o', BIN, '.'], { cwd: DIR })
  const tmp = mkdtempSync(join(tmpdir(), 'storycount-'))
  try {
    const file = join(tmp, 'story.json')
    writeFileSync(file, json)
    return JSON.parse((await run(BIN, [file], { maxBuffer: 1 << 20 })).stdout)
  } finally {
    rmSync(tmp, { recursive: true, force: true })
  }
}
