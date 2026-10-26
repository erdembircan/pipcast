// The line above the frame that says what is happening, in the serif of
// Claude Code's films. One line at a time: the old one drifts up into a blur
// as the new one rises out of it, so it changes without blinking.
import { ease, seg } from '../lib/anim.ts'
import { INK, KLWD, SERIF, STATION } from './theme.ts'

export interface Line {
  at: number
  until: number
  text: string
  /** KLWD's own red tab after the words, sliding in as the lower third's does */
  tab?: string
}

/** BREAKING NEWS in the lower third's tab: red, slanted, gold-edged */
export function StationTab({ text, t, size }: { text: string; t: number; size: number }) {
  const p = ease.out(seg(t, 0, 0.46))
  const glint = seg(t, 0.7, 1.3)
  return (
    <span style={{ display: 'inline-flex', marginLeft: '0.22em', transform: `translateX(${(1 - p) * -40}px)`, opacity: p, filter: 'drop-shadow(0 8px 14px rgba(92,7,12,0.25))', verticalAlign: 'middle' }}>
      <span
        style={{
          position: 'relative',
          overflow: 'hidden',
          display: 'inline-block',
          padding: `${size * 0.12}px ${size * 0.42}px ${size * 0.14}px`,
          transform: 'skewX(-12deg)',
          background: `linear-gradient(180deg, ${KLWD.breakingHi} 0%, ${KLWD.breaking} 55%, ${KLWD.breakingDeep} 100%)`,
          borderTop: `2px solid ${KLWD.goldHi}`,
          borderBottom: '2px solid #b97d0c',
          boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.5)',
        }}
      >
        <span style={{ display: 'inline-block', transform: 'skewX(12deg)', font: `italic 900 ${size * 0.82}px/1 ${STATION}`, fontStretch: '110%', letterSpacing: '0.01em', color: '#ffffff', textShadow: '0 2px 0 rgba(6,18,51,0.45)' }}>
          {text}
        </span>
        <i style={{ position: 'absolute', top: -20, bottom: -20, left: `${-20 + glint * 140}%`, width: size, background: 'linear-gradient(90deg, rgba(255,255,255,0), rgba(255,255,255,0.55), rgba(255,255,255,0))', transform: 'skewX(-20deg)', opacity: glint > 0 && glint < 1 ? 1 : 0 }} />
      </span>
    </span>
  )
}

const IN = 0.7
const OUT = 0.4

function Words({ text, t, life, tab, size }: { text: string; t: number; life: number; tab?: string; size: number }) {
  const words = text.split(' ')
  const q = ease.in(seg(t, life - OUT, life))
  return (
    <div style={{ position: 'absolute', left: 0, right: 0, top: 0, display: 'flex', justifyContent: 'center', alignItems: 'center', columnGap: '0.24em' }}>
      {words.map((word, i) => {
        const p = ease.out(seg(t, i * 0.06, i * 0.06 + IN))
        return (
          <span
            key={i}
            style={{
              display: 'inline-block',
              whiteSpace: 'pre',
              opacity: p * (1 - q),
              transform: `translateY(${(1 - p) * 0.32 - q * 0.22}em)`,
              filter: p < 1 || q > 0 ? `blur(${(1 - p) * 9 + q * 7}px)` : undefined,
            }}
          >
            {word}
          </span>
        )
      })}
      {tab ? (
        <span style={{ opacity: 1 - q, filter: q > 0 ? `blur(${q * 7}px)` : undefined }}>
          <StationTab text={tab} t={t - words.length * 0.06 - 0.25} size={size} />
        </span>
      ) : null}
    </div>
  )
}

export function HeadlineBand({ T, lines, top = 74, size = 58 }: { T: number; lines: Line[]; top?: number; size?: number }) {
  return (
    <div style={{ position: 'absolute', left: 0, right: 0, top, height: size * 1.3, font: `500 ${size}px/1.1 ${SERIF}`, letterSpacing: '-0.022em', color: INK }}>
      {lines
        .filter((line) => T >= line.at && T <= line.until)
        .map((line) => (
          <Words key={`${line.at}-${line.text}`} text={line.text} t={T - line.at} life={line.until - line.at} tab={line.tab} size={size} />
        ))}
    </div>
  )
}
