// Renders single frames of a composition, for checking the video without
// rendering it: node scripts/stills.mjs <composition> <out dir> <seconds...>
import { mkdirSync } from 'node:fs'
import { join, resolve } from 'node:path'
import { bundle } from '@remotion/bundler'
import { renderStill, selectComposition } from '@remotion/renderer'

const [id, outDir, ...times] = process.argv.slice(2)
if (!id || !outDir || times.length === 0) {
  console.error('usage: node scripts/stills.mjs <composition> <out dir> <seconds...>')
  process.exit(1)
}
const browserExecutable = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'
const serveUrl = await bundle({ entryPoint: resolve('src/index.ts') })
const composition = await selectComposition({ serveUrl, id, browserExecutable })
mkdirSync(outDir, { recursive: true })
for (const t of times) {
  const frame = Math.min(composition.durationInFrames - 1, Math.round(Number(t) * composition.fps))
  const output = join(outDir, `${id}-${String(t).replace('.', '_')}.png`)
  await renderStill({ serveUrl, composition, frame, output, browserExecutable, scale: Number(process.env.SCALE ?? 1) })
  console.log(output)
}
