// The cold open: a Mac at work, KLWD in its corner, and the first thing you
// hear is BREAKING NEWS. The camera stays on the whole screen: the news breaks
// in the corner of a desktop, as it does on yours.
import { pipFrame } from '../desktop/geometry.ts'
import { ease, mix, seg } from '../lib/anim.ts'
import { HeadlineBand } from '../look/HeadlineBand.tsx'
import type { Line } from '../look/HeadlineBand.tsx'
import { Paper } from '../look/Paper.tsx'
import { Frame, WIDE } from '../stage/Frame.tsx'
import { Screen } from '../stage/Screen.tsx'
import { SCENES } from '../timeline.ts'
import { AirAt, trackPointer } from './common.tsx'

const BR = pipFrame('bottom-right')

export const COLD_LINES: Line[] = [
  { at: 0.35, until: 3.7, text: 'Your Claude Code sessions, working while you do.' },
  { at: 3.85, until: SCENES.name - 0.15, text: 'When one finishes, it’s', tab: 'BREAKING NEWS' },
]

export function ColdOpen({ T }: { T: number }) {
  const pointer = trackPointer(T, [
    { t: 0, p: { x: 905, y: 470 } },
    { t: 1.4, p: { x: 880, y: 430 } },
  ])
  // A little reading before the news breaks
  const scroll = mix(0, 150, ease.inOut(seg(T, 0.3, 1.5)))
  const enter = ease.out(seg(T, 0, 0.5))
  const leave = ease.in(seg(T, SCENES.name - 0.3, SCENES.name))
  return (
    <Paper>
      <Frame view={WIDE} style={{ opacity: enter * (1 - leave), transform: `scale(${1 - 0.015 * leave})` }}>
        <Screen
          front="browser"
          claude={{ tuned: false }}
          clock="Sat Oct 25  5:41 PM"
          time={T}
          scroll={scroll}
          pip={{ frame: BR, content: <AirAt T={T} /> }}
          cursor={{ x: pointer.x, y: pointer.y }}
        />
      </Frame>
      <HeadlineBand T={T} lines={COLD_LINES} />
    </Paper>
  )
}
