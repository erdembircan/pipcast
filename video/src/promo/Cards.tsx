// The words a 90s station's weather promo slams in over the storm, in KLWD's
// chrome: the stinger's lettering (its outline, chrome face and glint, from
// design/components/bundle.css), each line slamming in from the right as
// WEATHER ALERT's do, the glint crossing once they land, and leaving to the
// right one after the other. The title's second line is in the station's gold.
import type { CSSProperties } from 'react'

import { ease, mix, seg } from '../lib/anim.ts'
import { CARDS } from './timeline.ts'

const SLAM = 0.26
const LEAVE = 0.5

function Line({ word, t, i, until, gold, size }: { word: string; t: number; i: number; until: number; gold: boolean; size: number }) {
  // In: WEATHER ALERT's slam, 260 ms, the lines 0.2 s apart
  const s = ease.out(seg(t, 0.2 * i, 0.2 * i + SLAM))
  // Out: its leave, 500 ms, the lines 0.17 s apart
  const l = ease.in(seg(t, until - 0.62 + 0.17 * i, until - 0.62 + 0.17 * i + LEAVE))
  const x = mix(160, 0, s) + mix(0, 180, l)
  const k = mix(1.3, 1, s) * mix(1, 1.25, l)
  const o = s * (1 - l)
  // The glint crosses as the last line lands
  const g = ease.inOut(seg(t, 0.55 + 0.2 * i, 1.1 + 0.2 * i))
  const glint: CSSProperties = { transform: `translateX(${-163 + 320 * g}%)` }
  const shine: CSSProperties = { transform: `translateX(${163 - 320 * g}%)` }
  return (
    <div className={`pn-stinger-line${gold ? ' rv-gold' : ''}`} style={{ fontSize: size, opacity: o, transform: `translateX(${x}px) scale(${k})` }}>
      <div className="pn-stinger-cast">
        <span className="pn-stinger-ink" aria-hidden="true">
          {word}
        </span>
        <span className="pn-stinger-face">{word}</span>
      </div>
      <span className="pn-stinger-glint" aria-hidden="true" style={glint}>
        <span className="pn-stinger-shine" style={shine}>
          {word}
        </span>
      </span>
    </div>
  )
}

/** The card on air at T, if any, laid out on the 960 x 540 stage */
export function Cards({ T }: { T: number }) {
  const card = CARDS.find((c) => T >= c.at && T < c.until)
  if (!card) return null
  const t = T - card.at
  const title = 'title' in card && card.title
  const longest = Math.max(...card.words.map((w) => w.length))
  // The stinger's 112 px, smaller for the long lines so they keep inside the frame
  const size = title ? 150 : Math.min(112, Math.floor(1080 / longest))
  const strap = 'strap' in card ? card.strap : null
  const end = card.until - card.at
  // The title's line under it slides in as the lower third's strap does, once the words have landed
  const s = ease.out(seg(t, 0.75, 1.2))
  const l = ease.in(seg(t, end - 0.35, end))
  return (
    <div style={{ position: 'absolute', left: 0, top: 0, width: 960, height: 540 }}>
      <div className="pn-stinger-words" style={{ transform: 'translateY(-55%)' }}>
        {card.words.map((word, i) => (
          <Line key={word} word={word} t={t} i={i} until={end} gold={Boolean(title) && i === 1} size={size} />
        ))}
        {strap ? (
          <div
            style={{
              marginTop: 14,
              padding: '7px 22px 8px',
              transform: `translateX(${mix(-60, 0, s) + mix(0, 60, l)}px) skewX(-12deg)`,
              opacity: s * (1 - l),
              background: 'linear-gradient(180deg, #ffe08a 0%, #f2b630 55%, #b97d0c 100%)',
              boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.5), 0 6px 14px rgba(0,0,0,0.45)',
              font: 'italic 900 26px/1 "Anybody", sans-serif',
              fontStretch: '106%',
              color: '#2a1800',
              whiteSpace: 'nowrap',
            }}
          >
            <span style={{ display: 'inline-block', transform: 'skewX(12deg)' }}>{strap}</span>
          </div>
        ) : null}
      </div>
    </div>
  )
}
