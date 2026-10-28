// Renders the video's YouTube thumbnail (src/thumbnail) into
// assets/youtube-thumbnail.jpg at the repository's root, and the same picture
// as YouTube's embedded player shows it into assets/youtube-thumbnail-play.jpg
// for the README, in the Chrome installed on this Mac: npm run thumbnail.
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { bundle } from '@remotion/bundler'
import { renderStill, selectComposition } from '@remotion/renderer'

const video = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const browserExecutable = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'
const stills = [
  ['Thumbnail', 'assets/youtube-thumbnail.jpg'],
  ['ThumbnailPlay', 'assets/youtube-thumbnail-play.jpg'],
]

// Assets named by their content, as remotion.config.ts names them for the Studio
const serveUrl = await bundle({
  entryPoint: join(video, 'src/index.ts'),
  webpackOverride: (config) => ({ ...config, output: { ...config.output, assetModuleFilename: 'static/[name]-[contenthash:8][ext]' } }),
})
for (const [id, file] of stills) {
  const composition = await selectComposition({ serveUrl, id, browserExecutable })
  await renderStill({ serveUrl, composition, output: resolve(video, '..', file), browserExecutable, imageFormat: 'jpeg', jpegQuality: 95 })
  console.log(file)
}
