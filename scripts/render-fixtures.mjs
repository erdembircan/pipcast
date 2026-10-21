// Draws each fixture in packages/renderer/fixtures/*.json (a StillInput) with
// the built page, `plugin/station/web/index.html#still=<fixture>`, in headless
// Chrome at the size of the window on a 14-inch MacBook Pro, and writes
// artifacts/fixtures/<name>.png.
import { execFileSync } from 'node:child_process'
import { mkdirSync, mkdtempSync, readdirSync, readFileSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { basename, dirname, join, resolve } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const chrome = process.env.CHROME_BIN ?? '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'
const fixtures = join(root, 'packages/renderer/fixtures')
const page = pathToFileURL(join(root, 'plugin/station/web/index.html')).href
const out = join(root, 'artifacts/fixtures')
const WIDTH = 716
const HEIGHT = 403

mkdirSync(out, { recursive: true })
const work = mkdtempSync(join(tmpdir(), 'pipcast-fixtures-'))
try {
  const names = readdirSync(fixtures)
    .filter((file) => file.endsWith('.json'))
    .map((file) => basename(file, '.json'))
    .sort()
  for (const name of names) {
    const input = readFileSync(join(fixtures, `${name}.json`), 'utf8')
    const fragment = Buffer.from(JSON.stringify(JSON.parse(input)), 'utf8').toString('base64url')
    execFileSync(
      chrome,
      [
        '--headless=new',
        '--disable-gpu',
        '--no-first-run',
        '--hide-scrollbars',
        `--user-data-dir=${join(work, name)}`,
        '--allow-file-access-from-files',
        '--virtual-time-budget=20000',
        `--window-size=${WIDTH},${HEIGHT}`,
        `--screenshot=${join(out, `${name}.png`)}`,
        `${page}#still=${fragment}`,
      ],
      // The fixtures' clocks are UTC
      { env: { ...process.env, TZ: 'UTC' }, stdio: 'ignore', timeout: 60_000 },
    )
    console.log(`${name}.png`)
  }
} finally {
  rmSync(work, { recursive: true, force: true, maxRetries: 5, retryDelay: 200 })
}
