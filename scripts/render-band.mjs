// Draws the band's pictures (packages/mod/src/core/band.ts) beside the design
// system's Band component in the same states, at 4x in headless Chrome, into
// artifacts/band/compare.png. The two should match closely: the left column
// is the mod's SVGs drawn as images, as the desktop draws them; the right is
// the design system's own component.

import { execFileSync } from 'node:child_process'
import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { build } from 'esbuild'

const root = fileURLToPath(new URL('..', import.meta.url))
const chrome = process.env.CHROME ?? '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'
const outFile = `${root}artifacts/band/compare.png`
const SCALE = 4

// band.ts is TypeScript with .ts imports: bundle it, then load the bundle
const bundled = await build({
  entryPoints: [`${root}packages/mod/src/core/band.ts`],
  bundle: true,
  write: false,
  format: 'esm',
  platform: 'node',
})
const code = bundled.outputFiles[0].text
const { plate } = await import(`data:text/javascript;base64,${Buffer.from(code).toString('base64')}`)

// [label, this session tuned]
const STATES = [
  ['off air', false],
  ['on air', true],
]

const image = (picture) => `<img height="22" src="data:image/svg+xml;base64,${Buffer.from(picture.svg).toString('base64')}">`

function ours(tuned) {
  return `<div class="band">${image(plate(tuned ? 'out' : 'in'))}</div>`
}

const rows = (theme) =>
  STATES.map(
    ([label, tuned]) =>
      `<div class="label">${label}</div>` +
      `<div class="cell ${theme}">${ours(tuned)}</div>` +
      `<div class="cell ${theme}"><div class="design" data-tuned="${tuned}"></div></div>`,
  ).join('')

const font = (name, file, extra) =>
  `@font-face { font-family: "${name}"; src: url("file://${root}assets/fonts/${file}"); font-style: ${extra.style}; font-weight: 100 900; ${extra.stretch ? 'font-stretch: 50% 150%;' : ''} }`

const page = `<!doctype html><html><head><meta charset="utf-8">
<link rel="stylesheet" href="file://${root}design/components/bundle.css">
<style>
${font('Anybody', 'anybody-italic.ttf', { style: 'italic', stretch: true })}
${font('Archivo', 'archivo.ttf', { style: 'normal' })}
body { margin: 0; padding: 16px; background: #faf9f5; font: 11px -apple-system, "Helvetica Neue", sans-serif; color: #555; }
.grid { display: grid; grid-template-columns: 70px 260px 260px; gap: 4px 12px; align-items: center; }
.head { font-weight: 600; padding: 0 0 4px; }
.cell { height: 43px; padding: 0 8px; border-radius: 11px; display: flex; align-items: center; }
.cell.light { background: #f0eee6; }
.cell.dark { background: #212121; }
.band { display: flex; align-items: center; gap: 8px; height: 22px; }
.band img { display: block; flex: none; }
.gap { height: 8px; grid-column: 1 / -1; }
</style></head><body>
<div class="grid">
<div class="head"></div><div class="head">band.ts</div><div class="head">design system Band</div>
${rows('light')}
<div class="gap"></div>
${rows('dark')}
</div>
<script src="file://${root}node_modules/react/umd/react.development.js"></script>
<script src="file://${root}node_modules/react-dom/umd/react-dom.development.js"></script>
<script src="file://${root}design/components/bundle.js"></script>
<script>
  document.fonts.load('italic 900 13px Anybody').then(function () {
    var h = React.createElement;
    document.querySelectorAll('.design').forEach(function (node) {
      ReactDOM.createRoot(node).render(h(window.PipNews.Band, {
        tuned: node.dataset.tuned === 'true',
      }));
    });
    document.title = 'ready';
  });
</script>
</body></html>`

const tmp = await mkdtemp(join(tmpdir(), 'pipcast-band-'))
try {
  await mkdir(`${root}artifacts/band`, { recursive: true })
  const file = join(tmp, 'compare.html')
  await writeFile(file, page)
  const height = 16 * 2 + 20 + STATES.length * 2 * 47 + 16
  execFileSync(
    chrome,
    [
      '--headless=new',
      '--disable-gpu',
      '--hide-scrollbars',
      '--allow-file-access-from-files',
      `--force-device-scale-factor=${SCALE}`,
      '--virtual-time-budget=4000',
      '--window-size=640,' + height,
      `--user-data-dir=${join(tmp, 'profile')}`,
      `--screenshot=${outFile}`,
      `file://${file}`,
    ],
    { stdio: 'ignore' },
  )
  console.log(`wrote ${outFile.slice(root.length)}`)
} finally {
  await rm(tmp, { recursive: true, force: true })
}
