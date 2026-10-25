// The Mac's screen in a fixed frame on the paper, as a screen recorder shows a
// recording: the frame never moves, and the camera zooms inside it. At zoom 1
// the whole screen shows, menu bar and all; closer in, the camera is kept
// inside the screen, so no edge of it is ever crossed and nothing jumps.
import type { CSSProperties, ReactNode } from 'react'

import { SCREEN_H, SCREEN_W } from '../desktop/geometry.ts'

/** The frame on the 1920 x 1080 canvas: the screen at 85%, under the headline band */
export const FRAME_SCALE = 0.85
export const FRAME = {
  w: SCREEN_W * FRAME_SCALE,
  h: SCREEN_H * FRAME_SCALE,
  x: (1920 - SCREEN_W * FRAME_SCALE) / 2,
  y: 205,
}

export interface View {
  /** The screen point at the middle of the frame */
  x: number
  y: number
  /** 1 shows the whole screen */
  zoom: number
}

export const WIDE: View = { x: SCREEN_W / 2, y: SCREEN_H / 2, zoom: 1 }

/** The view as the camera can take it: never wider than the screen, never past its edges */
export function settle(view: View): View {
  const zoom = Math.max(1, view.zoom)
  const halfW = SCREEN_W / (2 * zoom)
  const halfH = SCREEN_H / (2 * zoom)
  return {
    zoom,
    x: Math.min(Math.max(view.x, halfW), SCREEN_W - halfW),
    y: Math.min(Math.max(view.y, halfH), SCREEN_H - halfH),
  }
}

export function Frame({ view, children, style }: { view: View; children: ReactNode; style?: CSSProperties }) {
  const v = settle(view)
  const k = FRAME_SCALE * v.zoom
  const tx = FRAME.w / 2 - v.x * k
  const ty = FRAME.h / 2 - v.y * k
  return (
    <div
      style={{
        position: 'absolute',
        left: FRAME.x,
        top: FRAME.y,
        width: FRAME.w,
        height: FRAME.h,
        borderRadius: 16,
        overflow: 'hidden',
        background: '#1d1d1f',
        boxShadow: '0 36px 90px rgba(40, 32, 20, 0.26), 0 10px 26px rgba(40, 32, 20, 0.14), 0 0 0 1px rgba(20, 20, 19, 0.08)',
        ...style,
      }}
    >
      <div style={{ position: 'absolute', left: 0, top: 0, width: SCREEN_W, height: SCREEN_H, transformOrigin: '0 0', transform: `translate(${tx}px, ${ty}px) scale(${k})` }}>
        {children}
      </div>
    </div>
  )
}
