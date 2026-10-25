// The paper the video is set on: a warm ground with a little grain.
import type { CSSProperties, ReactNode } from 'react'

import { PAPER } from './theme.ts'

/** The paper ground with a little grain */
export function Paper({ children, style }: { children?: ReactNode; style?: CSSProperties }) {
  return (
    <div style={{ position: 'absolute', inset: 0, background: PAPER, ...style }}>
      <svg width="100%" height="100%" style={{ position: 'absolute', inset: 0, opacity: 0.35, mixBlendMode: 'multiply' }}>
        <filter id="grain">
          <feTurbulence type="fractalNoise" baseFrequency="0.85" numOctaves="2" stitchTiles="stitch" />
          <feColorMatrix values="0 0 0 0 0.45  0 0 0 0 0.42  0 0 0 0 0.36  0 0 0 0.16 0" />
        </filter>
        <rect width="100%" height="100%" filter="url(#grain)" />
      </svg>
      {children}
    </div>
  )
}
