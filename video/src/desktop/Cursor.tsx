// The pointer, drawn like macOS's arrow and a little larger, as screen
// recorders show it, with a ring where it clicks.
import { clamp01, ease } from '../lib/anim.ts'

const SCALE = 1.35

export function Cursor({ x, y, pressed = 0, opacity = 1, shape = 'arrow' }: { x: number; y: number; pressed?: number; opacity?: number; shape?: 'arrow' | 'resize' }) {
  const s = SCALE * (1 - 0.12 * pressed)
  if (shape === 'resize') {
    // macOS's diagonal resize pointer, on a window's corner
    const arrow = 'M3 3h7.5L7.6 5.9l10.5 10.5L21 13.5V21h-7.5l2.9-2.9L5.9 7.6 3 10.5z'
    return (
      <svg
        width="24"
        height="24"
        viewBox="0 0 24 24"
        style={{ position: 'absolute', left: x - 12, top: y - 12, transform: `scale(${SCALE})`, transformOrigin: '12px 12px', opacity, filter: 'drop-shadow(0 2px 3px rgba(0,0,0,0.28))', zIndex: 50 }}
      >
        <path d={arrow} fill="#ffffff" stroke="#ffffff" strokeWidth="3" strokeLinejoin="round" />
        <path d={arrow} fill="#000000" />
      </svg>
    )
  }
  return (
    <svg
      width="28"
      height="40"
      viewBox="0 0 28 40"
      style={{
        position: 'absolute',
        left: x - 6.5,
        top: y - 4,
        transform: `scale(${s})`,
        transformOrigin: '6.5px 4px',
        opacity,
        filter: 'drop-shadow(0 2px 3px rgba(0,0,0,0.28))',
        zIndex: 50,
      }}
    >
      <path d="M6.5 4 L6.5 30.5 L12.6 24.6 L16.6 34 L21 32.1 L17.1 23 L25.6 23 Z" fill="#ffffff" stroke="#ffffff" strokeWidth="3" strokeLinejoin="round" />
      <path d="M6.5 4 L6.5 30.5 L12.6 24.6 L16.6 34 L21 32.1 L17.1 23 L25.6 23 Z" fill="#000000" />
    </svg>
  )
}

/** A soft ring that spreads from a click, `t` seconds after it */
export function ClickRing({ x, y, t }: { x: number; y: number; t: number }) {
  if (t < 0 || t > 0.5) return null
  const p = clamp01(t / 0.5)
  const r = 10 + 26 * ease.out(p)
  return (
    <div
      style={{
        position: 'absolute',
        left: x - r,
        top: y - r,
        width: r * 2,
        height: r * 2,
        borderRadius: '50%',
        border: '2.5px solid rgba(255,255,255,0.95)',
        boxShadow: '0 0 0 1px rgba(0,0,0,0.12), inset 0 0 0 1px rgba(0,0,0,0.08)',
        background: 'rgba(255,255,255,0.18)',
        opacity: 1 - ease.in(p),
        zIndex: 49,
      }}
    />
  )
}
