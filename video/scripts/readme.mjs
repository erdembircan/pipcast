// Renders the README's three grids of screenshots (src/readme) into
// assets/screenshots at the repository's root, in the Chrome installed on this
// Mac: npm run readme, which runs scripts/prepare.mjs --picture first.
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { bundle } from '@remotion/bundler'
import { renderStill, selectComposition } from '@remotion/renderer'

const video = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const out = resolve(video, '..', 'assets/screenshots')
const browserExecutable = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'

const GRIDS = [
  { id: 'ReadmeInUse', file: 'in-use.jpg' },
  { id: 'ReadmeOnAir', file: 'on-air.jpg' },
  { id: 'ReadmeWindow', file: 'window.jpg' },
]

// Assets named by their content, as remotion.config.ts names them for the Studio
const serveUrl = await bundle({
  entryPoint: join(video, 'src/index.ts'),
  webpackOverride: (config) => ({ ...config, output: { ...config.output, assetModuleFilename: 'static/[name]-[contenthash:8][ext]' } }),
})
for (const grid of GRIDS) {
  const composition = await selectComposition({ serveUrl, id: grid.id, browserExecutable })
  const output = join(out, grid.file)
  await renderStill({ serveUrl, composition, output, browserExecutable, imageFormat: 'jpeg', jpegQuality: 90 })
  console.log(`assets/screenshots/${grid.file}`)
}
