// Builds the page the station shows into plugin/station/web/:
//   index.html, station.js (one classic script), station.css and fonts/.
// The output folder is emptied first, so the build is reproducible.
import { build, transform } from 'esbuild'
import { cpSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const renderer = join(root, 'packages/renderer')
const out = join(root, 'plugin/station/web')

rmSync(out, { recursive: true, force: true })
mkdirSync(out, { recursive: true })

await build({
  entryPoints: [join(renderer, 'src/main.tsx')],
  outfile: join(out, 'station.js'),
  bundle: true,
  format: 'iife',
  target: 'safari16',
  minify: true,
  jsx: 'automatic',
  legalComments: 'none',
  alias: {
    '@pipcast/contract': join(root, 'plugin/src/contract/index.ts'),
    '@pipcast/director': join(root, 'packages/director/src/index.ts'),
  },
  define: { 'process.env.NODE_ENV': '"production"' },
  logLevel: 'warning',
})

// The design system's stylesheet asks Google Fonts for its typefaces; the
// page carries them itself, so that line goes.
const design = readFileSync(join(root, 'design/components/bundle.css'), 'utf8').replace(/^@import url\([^)]*\);?[ \t]*\r?\n/gm, '')
const css = [
  readFileSync(join(renderer, 'src/fonts.css'), 'utf8'),
  readFileSync(join(renderer, 'src/page.css'), 'utf8'),
  design,
].join('\n')
const styles = await transform(css, { loader: 'css', minify: true, target: 'safari16' })
// The station must never reach the network
if (/@import/i.test(styles.code) || /https?:/i.test(styles.code)) {
  throw new Error('station.css must contain no @import and no http URL')
}
writeFileSync(join(out, 'station.css'), styles.code)

cpSync(join(root, 'assets/fonts'), join(out, 'fonts'), { recursive: true })
cpSync(join(renderer, 'index.html'), join(out, 'index.html'))

console.log('plugin/station/web')
