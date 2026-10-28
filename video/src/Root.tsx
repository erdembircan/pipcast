import { Composition, Still } from 'remotion'

import { Pipcast } from './Pipcast.tsx'
import { GRID_W, IN_USE_H, ON_AIR_H, ReadmeInUse, ReadmeOnAir, ReadmeWindow, WINDOW_H } from './readme/Readme.tsx'
import { THUMBNAIL_H, THUMBNAIL_W, Thumbnail, ThumbnailPlay } from './thumbnail/Thumbnail.tsx'
import { DURATION, FPS } from './timeline.ts'

export function Root() {
  return (
    <>
      <Composition id="Pipcast" component={Pipcast} durationInFrames={Math.round(DURATION * FPS)} fps={FPS} width={1920} height={1080} />
      <Still id="ReadmeInUse" component={ReadmeInUse} width={GRID_W} height={IN_USE_H} />
      <Still id="ReadmeOnAir" component={ReadmeOnAir} width={GRID_W} height={ON_AIR_H} />
      <Still id="ReadmeWindow" component={ReadmeWindow} width={GRID_W} height={WINDOW_H} />
      <Still id="Thumbnail" component={Thumbnail} width={THUMBNAIL_W} height={THUMBNAIL_H} />
      <Still id="ThumbnailPlay" component={ThumbnailPlay} width={THUMBNAIL_W} height={THUMBNAIL_H} />
    </>
  )
}
