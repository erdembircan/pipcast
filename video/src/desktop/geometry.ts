// The Mac the video happens on: a 14-inch MacBook Pro's screen in points,
// with the menu bar at the top and the Dock hidden, and the places the station
// puts its window, worked out as station/Sources/StationCore/Geometry.swift
// does.

export const SCREEN_W = 1512
export const SCREEN_H = 982
export const MENU_H = 34

/** The visible area: the screen less the menu bar */
export const VISIBLE = { x: 0, y: MENU_H, w: SCREEN_W, h: SCREEN_H - MENU_H }

export const PIP_MARGIN = 20

/** The window's full size: its quadrant at 16:9, 20 pt in from every side */
export function pipSize(): { w: number; h: number } {
  let w = Math.floor(VISIBLE.w / 2 - 2 * PIP_MARGIN)
  let h = Math.round((w * 9) / 16)
  const cap = Math.floor(VISIBLE.h / 2 - 2 * PIP_MARGIN)
  if (h > cap) {
    h = cap
    w = Math.round((h * 16) / 9)
  }
  return { w, h }
}

export const PIP = pipSize()

export type Quadrant = 'top-left' | 'top-right' | 'bottom-left' | 'bottom-right'

/** Where the window sits in a quadrant, at a scale of its full size (0.7 to 1) */
export function pipFrame(quadrant: Quadrant, scale = 1): { x: number; y: number; w: number; h: number } {
  const w = Math.round(PIP.w * scale)
  const h = Math.round((w * 9) / 16)
  const right = quadrant.endsWith('right')
  const top = quadrant.startsWith('top')
  const x = right ? VISIBLE.x + VISIBLE.w - PIP_MARGIN - w : VISIBLE.x + PIP_MARGIN
  const y = top ? VISIBLE.y + PIP_MARGIN : VISIBLE.y + VISIBLE.h - PIP_MARGIN - h
  return { x, y, w, h }
}

/** The app windows on the desktop */
export const CLAUDE_WINDOW = { x: 56, y: 58, w: 1196, h: 876 }
export const BROWSER_WINDOW = { x: 250, y: 70, w: 1208, h: 868 }
/** The code editor on the second desktop */
export const EDITOR_WINDOW = { x: 92, y: 62, w: 1250, h: 870 }
