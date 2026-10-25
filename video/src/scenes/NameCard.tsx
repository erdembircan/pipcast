// PiP and broadcast become one word, Pipcast, on the station's four-note logo:
// the two words close up, then from the logo's first note the second capital
// P drops down out of the word as a lowercase p comes down from the top into
// its place, landing on the third. The name holds long enough to read with
// its line under it.
import { useEffect, useState } from 'react'
import type { CSSProperties, ReactNode } from 'react'
import { Easing, continueRender, delayRender } from 'remotion'

import { clamp01, ease, mix, seg } from '../lib/anim.ts'
import { Paper } from '../look/Paper.tsx'
import { INK, INK_SOFT, KLWD, SANS, SERIF } from '../look/theme.ts'
import { NAME_HITS, SCENES } from '../timeline.ts'

const S = SCENES.name
/** The logo's four notes: the capital P drops on the first, the lowercase p lands on the third, the line comes in on the fourth */
const [HIT_1, , HIT_3, HIT_4] = NAME_HITS

const SIZE = 168
const TRACKING = -0.035
const FONT = `500 ${SIZE}px ${SERIF}`

/** How far each letter moves the next one along in the word: its advance, with the word's tracking */
function advances(letters: string[]): number[] {
  const ctx = document.createElement('canvas').getContext('2d')!
  ctx.font = FONT
  return letters.map((letter) => ctx.measureText(letter).width + TRACKING * SIZE)
}

/** The capital P's and the lowercase p's advances, measured once the serif has loaded, with the frame held until then */
function useAdvances(): [number, number] | null {
  const [widths, setWidths] = useState<[number, number] | null>(() => (document.fonts.check(FONT) ? (advances(['P', 'p']) as [number, number]) : null))
  useEffect(() => {
    if (widths) return
    const handle = delayRender('measuring the name card letters')
    document.fonts
      .load(FONT)
      .then(() => setWidths(advances(['P', 'p']) as [number, number]))
      .finally(() => continueRender(handle))
  }, [widths])
  return widths
}

/** How far each letter travels: the capital out below the line, the p in from above it */
const TRAVEL = 0.95
/** One turn of the reel: a soft start, quick through the middle, and a small settle as the p lands */
const ROLL = Easing.bezier(0.5, 0, 0.3, 1.22)

/** The third letter of the word, turning over like a counter: the capital P drops down out of the word as the lowercase p comes down from the top into its place */
function Swap({ T, widths }: { T: number; widths: [number, number] }) {
  // The turn starts a moment before the first note, so the P is already moving as it strikes
  const turn = seg(T, HIT_1 - 0.08, HIT_3)
  const r = ROLL(turn)
  const width = mix(widths[0], widths[1], ease.inOut(turn))
  const blur = turn > 0 && turn < 1 ? `blur(${Math.sin(turn * Math.PI) * 2.5}px)` : undefined
  const letter: CSSProperties = { position: 'absolute', left: 0.06 * SIZE, top: '0.2em', filter: blur }
  return (
    <span style={{ position: 'relative', display: 'inline-block', width }}>
      {/* Holds the line's baseline */}
      <span style={{ visibility: 'hidden' }}>p</span>
      {/* The window the letters turn through: wide enough for the capital, tall enough for the p's tail */}
      <span style={{ position: 'absolute', left: -0.06 * SIZE, top: '-0.2em', width: widths[0] + 0.12 * SIZE, height: '1.5em', overflow: 'hidden' }}>
        {r < 1 ? <span style={{ ...letter, transform: `translateY(${r * TRAVEL}em)`, opacity: 1 - clamp01((r - 0.3) / 0.5) }}>P</span> : null}
        {turn > 0 ? <span style={{ ...letter, color: INK, transform: `translateY(${(r - 1) * TRAVEL}em)`, opacity: clamp01((r - 0.2) / 0.5) }}>p</span> : null}
      </span>
    </span>
  )
}

export function NameCard({ T }: { T: number }) {
  const widths = useAdvances()
  const t = T - S
  const rise = (i: number) => ease.out(seg(t, 0.1 + i * 0.14, 0.85 + i * 0.14))
  const join = ease.inOut(seg(T, HIT_1 - 0.65, HIT_1 - 0.1))
  const tagline = ease.out(seg(T, HIT_4 - 0.05, HIT_4 + 0.65))
  const leave = ease.in(seg(T, SCENES.tuneIn - 0.45, SCENES.tuneIn))
  const piece = (i: number, children: ReactNode, extra?: CSSProperties) => (
    <span style={{ display: 'inline-block', opacity: rise(i), transform: `translateY(${(1 - rise(i)) * 0.3}em)`, filter: `blur(${(1 - rise(i)) * 10}px)`, whiteSpace: 'pre', ...extra }}>
      {children}
    </span>
  )
  const blue = (k: number) => `color-mix(in srgb, ${KLWD.bar} ${Math.round(k * 100)}%, ${INK})`
  const word: CSSProperties = { font: `500 ${SIZE}px/1 ${SERIF}`, letterSpacing: `${TRACKING}em`, color: INK }
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
          transform: `translateY(${mix(0, -34, ease.inOut(seg(T, HIT_3, HIT_4 + 0.6))) - 24 * leave}px)`,
          opacity: 1 - leave,
          filter: leave > 0 ? `blur(${leave * 8}px)` : undefined,
        }}
      >
        {/* The word stays in its pieces to the end: measured to the font, they sit where the one word's letters would */}
        <div style={{ ...word, display: 'flex', alignItems: 'baseline' }}>
          {piece(
            0,
            <span style={{ color: blue(1 - join) }}>
              Pi
              {widths ? <Swap T={T} widths={widths} /> : T < HIT_3 ? 'P' : 'p'}
            </span>,
          )}
          <span style={{ display: 'inline-block', overflow: 'hidden', maxWidth: mix(140, 0, join), opacity: 1 - join }}>{piece(1, <span style={{ color: INK_SOFT, fontWeight: 400 }}>{' + '}</span>)}</span>
          <span style={{ display: 'inline-block', overflow: 'hidden', maxWidth: mix(460, 0, join), opacity: clamp01(1 - join * 1.4) }}>{piece(2, 'broad')}</span>
          {piece(2, 'cast')}
        </div>
        <div style={{ marginTop: 34, font: `400 44px/1.2 ${SANS}`, letterSpacing: '-0.015em', color: INK_SOFT, opacity: tagline, transform: `translateY(${(1 - tagline) * 16}px)`, filter: tagline < 1 ? `blur(${(1 - tagline) * 8}px)` : undefined }}>
          Picture in picture for Claude Code
        </div>
      </div>
    </Paper>
  )
}
