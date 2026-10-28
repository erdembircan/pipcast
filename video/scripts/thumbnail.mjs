// Renders the video's YouTube thumbnail (src/thumbnail) into
// assets/youtube-thumbnail.jpg at the repository's root, in the Chrome
// installed on this Mac: npm run thumbnail.
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { bundle } from '@remotion/bundler'
import { renderStill, selectComposition } from '@remotion/renderer'

const video = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const output = resolve(video, '..', 'assets/youtube-thumbnail.jpg')
const browserExecutable = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'

// Assets named by their content, as remotion.config.ts names them for the Studio
const serveUrl = await bundle({
  entryPoint: join(video, 'src/index.ts'),
  webpackOverride: (config) => ({ ...config, output: { ...config.output, assetModuleFilename: 'static/[name]-[contenthash:8][ext]' } }),
})
const composition = await selectComposition({ serveUrl, id: 'Thumbnail', browserExecutable })
await renderStill({ serveUrl, composition, output, browserExecutable, imageFormat: 'jpeg', jpegQuality: 95 })
console.log('assets/youtube-thumbnail.jpg')
