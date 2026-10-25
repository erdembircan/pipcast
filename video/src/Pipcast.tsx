// The video: every scene drawn from the running order in timeline.ts, with
// KLWD's own graphics and jingles, and the soundtrack under it.
import { AbsoluteFill, getStaticFiles, useCurrentFrame } from 'remotion'

import './design/fonts.ts'
import { DesignStyles } from './design/DesignStyles.tsx'
import { Paper } from './look/Paper.tsx'
import { ColdOpen } from './scenes/ColdOpen.tsx'
import { Desk } from './scenes/Desk.tsx'
import { Finale } from './scenes/Finale.tsx'
import { NameCard } from './scenes/NameCard.tsx'
import { Soundtrack } from './Soundtrack.tsx'
import { FPS, SCENES } from './timeline.ts'

function sceneAt(T: number) {
  if (T < SCENES.name) return <ColdOpen T={T} />
  if (T < SCENES.tuneIn) return <NameCard T={T} />
  if (T < SCENES.finale) return <Desk T={T} />
  return <Finale T={T} />
}

export function Pipcast() {
  const frame = useCurrentFrame()
  const T = frame / FPS
  // The soundtrack and its effects are rendered by scripts/prepare.mjs; until
  // they are, the video plays with KLWD's jingles alone
  const hasSoundtrack = getStaticFiles().some((file) => file.name === 'audio/music.wav')
  return (
    <AbsoluteFill style={{ overflow: 'hidden' }}>
      <DesignStyles />
      <Paper />
      {sceneAt(T)}
      <Soundtrack music={hasSoundtrack} />
    </AbsoluteFill>
  )
}
