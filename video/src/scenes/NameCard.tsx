// PiP and broadcast become one word, Pipcast, on the station's four-note logo,
// and the name holds long enough to read with its line under it.
import type { CSSProperties, ReactNode } from 'react'

import { clamp01, ease, mix, seg } from '../lib/anim.ts'
import { Paper } from '../look/Paper.tsx'
import { INK, INK_SOFT, KLWD, SANS, SERIF } from '../look/theme.ts'
import { NAME_HITS, SCENES } from '../timeline.ts'

const S = SCENES.name
/** When the two words have become one: the logo's first note */
const SET = NAME_HITS[0]

export function NameCard({ T }: { T: number }) {
  const t = T - S
  const rise = (i: number) => ease.out(seg(t, 0.1 + i * 0.14, 0.85 + i * 0.14))
  const join = ease.inOut(seg(T, SET - 0.65, SET - 0.1))
  const set = ease.inOut(seg(T, SET - 0.2, SET + 0.08))
  const tagline = ease.out(seg(T, SET + 0.45, SET + 1.15))
  const leave = ease.in(seg(T, SCENES.tuneIn - 0.45, SCENES.tuneIn))
  const piece = (i: number, children: ReactNode, extra?: CSSProperties) => (
    <span style={{ display: 'inline-block', opacity: rise(i), transform: `translateY(${(1 - rise(i)) * 0.3}em)`, filter: `blur(${(1 - rise(i)) * 10}px)`, whiteSpace: 'pre', ...extra }}>
      {children}
    </span>
  )
  const blue = (k: number) => `color-mix(in srgb, ${KLWD.bar} ${Math.round(k * 100)}%, ${INK})`
  const word: CSSProperties = { font: `500 168px/1 ${SERIF}`, letterSpacing: '-0.035em', color: INK }
  return (
    <Paper>
      <div
        style={{
          position: 'absolute',
          inset: 0,
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          transform: `translateY(${mix(0, -34, ease.inOut(seg(T, SET, SET + 0.8))) - 24 * leave}px)`,
          opacity: 1 - leave,
          filter: leave > 0 ? `blur(${leave * 8}px)` : undefined,
        }}
      >
        <div style={{ display: 'grid', justifyItems: 'center' }}>
          <div style={{ ...word, gridArea: '1 / 1', display: 'flex', alignItems: 'baseline', opacity: 1 - set }}>
            {piece(0, <span style={{ color: blue(1 - join) }}>PiP</span>)}
            <span style={{ display: 'inline-block', overflow: 'hidden', maxWidth: mix(140, 0, join), opacity: 1 - join }}>{piece(1, <span style={{ color: INK_SOFT, fontWeight: 400 }}>{' + '}</span>)}</span>
            <span style={{ display: 'inline-block', overflow: 'hidden', maxWidth: mix(460, 0, join), opacity: clamp01(1 - join * 1.4) }}>{piece(2, 'broad')}</span>
            {piece(2, 'cast')}
          </div>
          <div style={{ ...word, gridArea: '1 / 1', opacity: set }}>Pipcast</div>
        </div>
        <div style={{ marginTop: 34, font: `400 44px/1.2 ${SANS}`, letterSpacing: '-0.015em', color: INK_SOFT, opacity: tagline, transform: `translateY(${(1 - tagline) * 16}px)`, filter: tagline < 1 ? `blur(${(1 - tagline) * 8}px)` : undefined }}>
          Picture in picture for Claude Code
        </div>
      </div>
    </Paper>
  )
}
