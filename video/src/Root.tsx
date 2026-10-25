import { Composition } from 'remotion'

import { Pipcast } from './Pipcast.tsx'
import { DURATION, FPS } from './timeline.ts'

export function Root() {
  return <Composition id="Pipcast" component={Pipcast} durationInFrames={Math.round(DURATION * FPS)} fps={FPS} width={1920} height={1080} />
}
