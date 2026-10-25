// The video's render settings. Remotion uses the Chrome installed on this Mac,
// so nothing has to be downloaded to render a still or the video.
import { Config } from '@remotion/cli/config'

Config.setBrowserExecutable('/Applications/Google Chrome.app/Contents/MacOS/Google Chrome')
Config.setVideoImageFormat('jpeg')
Config.setJpegQuality(95)
Config.setCodec('h264')
Config.setCrf(16)
Config.setPixelFormat('yuv420p')
Config.setOverwriteOutput(true)

// The fonts, jingles and icon layers come from the repository, outside video/.
// The Studio names assets by their path, which for those climbs out of the
// bundle and is served as nothing; name every asset by its content instead.
Config.overrideWebpackConfig((config) => ({
  ...config,
  output: { ...config.output, assetModuleFilename: 'static/[name]-[contenthash:8][ext]' },
}))
