// Our window, as the station shows it: the design system's black 16:9 panel
// with its 20 pt corners, hairline edge and shadow, the 960 x 540 stage
// scaled into it, and on hover the dimming, the three glass controls and the
// minimize handle on the inner edge. `hover` runs 0 to 1 as the controls fade
// in (0.15 s) and out (0.25 s).
import type { CSSProperties, ReactNode } from 'react'

import { PipNews } from './pipnews.ts'

const { Stage, PipControls } = PipNews

export interface PipWindowProps {
  /** Width in pt; the 14-inch MacBook Pro's full size is 716 */
  width: number
  children: ReactNode
  /** 0 to 1: the controls and the handle showing */
  hover?: number
  /** The button under the pointer */
  under?: 'close' | 'sound' | 'back' | 'handle'
  sound?: 'on' | 'off'
  /** Which side the window goes to when minimized: its own */
  side?: 'left' | 'right'
  /** 0 = the handle on the window, 1 = docked as the tab */
  docked?: number
  shadow?: boolean
  style?: CSSProperties
}

/** The minimize handle: a capsule of clear glass, 28 x 88 pt, 8 pt in from the middle of the inner edge, with a chevron. */
export function Handle({ side, under, docked = 0 }: { side: 'left' | 'right'; under?: boolean; docked?: number }) {
  // The chevron points to the side the window goes; docked, it turns over to point back in
  const pointsRight = side === 'right' ? docked < 0.5 : docked >= 0.5
  const dark = Math.min(1, Math.max(0, docked))
  // Docked, the corners against the screen's edge square off
  const outer = 14 * (1 - dark)
  const radius = side === 'left' ? `${outer}px 14px 14px ${outer}px` : `14px ${outer}px ${outer}px 14px`
  return (
    <div
      className={`pn-glass${under ? ' pn-glass--hover' : ''}`}
      style={{
        position: 'relative',
        width: 28,
        height: 88,
        borderRadius: radius,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
      }}
    >
      <div style={{ position: 'absolute', inset: 0, borderRadius: radius, background: `rgba(0, 0, 0, ${0.55 * dark})` }} />
      <svg width="12" height="22" viewBox="0 0 12 22" fill="none" style={{ position: 'relative', transform: pointsRight ? undefined : 'scaleX(-1)' }}>
        <path d="M3 3l6 8-6 8" stroke="#ffffff" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    </div>
  )
}

export function PipWindow({ width, children, hover = 0, under, sound = 'on', side = 'right', shadow = true, style }: PipWindowProps) {
  const height = Math.round((width * 9) / 16)
  const handleTop = Math.round(height / 2 - 44)
  return (
    <div className={`pn-pip${shadow ? ' pn-pip--shadow' : ''}`} style={{ width, height, ...style }}>
      <Stage width={width}>{children}</Stage>
      {hover > 0 ? (
        <div style={{ position: 'absolute', inset: 0, zIndex: 3, opacity: hover, pointerEvents: 'none' }}>
          <PipControls width={width} sound={sound} hover={under === 'handle' ? undefined : under} />
          <div style={{ position: 'absolute', top: handleTop, [side === 'right' ? 'left' : 'right']: 8 }}>
            <Handle side={side} under={under === 'handle'} />
          </div>
        </div>
      ) : null}
    </div>
  )
}
