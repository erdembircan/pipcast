// The Mac's screen at one moment: the wallpaper, the two app windows in their
// order, the station's window and its tab, the menu bar and the pointer.
import type { ReactNode } from 'react'

import { BrowserApp } from '../desktop/BrowserApp.tsx'
import { ClaudeApp } from '../desktop/ClaudeApp.tsx'
import type { ClaudeAppProps } from '../desktop/ClaudeApp.tsx'
import { ClickRing, Cursor } from '../desktop/Cursor.tsx'
import { BROWSER_WINDOW, CLAUDE_WINDOW, SCREEN_H, SCREEN_W } from '../desktop/geometry.ts'
import { MacWindow } from '../desktop/MacWindow.tsx'
import { MenuBar } from '../desktop/MenuBar.tsx'
import { Wallpaper } from '../desktop/Wallpaper.tsx'
import { Handle, PipWindow } from '../design/PipWindow.tsx'

export interface PipState {
  frame: { x: number; y: number; w: number; h: number }
  content: ReactNode
  opacity?: number
  /** Scale about the window's centre, for its entrance */
  scale?: number
  hover?: number
  under?: 'close' | 'sound' | 'back' | 'handle'
  side?: 'left' | 'right'
}

export interface TabState {
  side: 'left' | 'right'
  /** The tab's left edge on the screen, and the middle of where the window rests */
  x: number
  cy: number
  docked: number
  opacity?: number
  under?: boolean
}

export interface ScreenProps {
  front: 'claude' | 'browser'
  claude: Omit<ClaudeAppProps, 'active' | 'time'>
  pip?: PipState | null
  tab?: TabState | null
  cursor?: { x: number; y: number; pressed?: number; opacity?: number; shape?: 'arrow' | 'resize' } | null
  clicks?: Array<{ x: number; y: number; t: number }>
  clock: string
  time: number
  /** How far the browser's page has scrolled */
  scroll?: number
}

export function Screen({ front, claude, pip, tab, cursor, clicks = [], clock, time, scroll = 0 }: ScreenProps) {
  const claudeWindow = (
    <MacWindow key="claude" frame={CLAUDE_WINDOW} active={front === 'claude'}>
      <ClaudeApp active={front === 'claude'} time={time} {...claude} />
    </MacWindow>
  )
  const browserWindow = (
    <MacWindow key="browser" frame={BROWSER_WINDOW} active={front === 'browser'}>
      <BrowserApp active={front === 'browser'} scroll={scroll} />
    </MacWindow>
  )
  return (
    <div style={{ position: 'absolute', left: 0, top: 0, width: SCREEN_W, height: SCREEN_H, overflow: 'hidden' }}>
      <Wallpaper />
      {front === 'claude' ? [browserWindow, claudeWindow] : [claudeWindow, browserWindow]}
      {pip && (pip.opacity ?? 1) > 0 ? (
        <div
          style={{
            position: 'absolute',
            left: pip.frame.x,
            top: pip.frame.y,
            width: pip.frame.w,
            height: pip.frame.h,
            opacity: pip.opacity ?? 1,
            transform: `scale(${pip.scale ?? 1})`,
            transformOrigin: '50% 50%',
            zIndex: 20,
          }}
        >
          <PipWindow width={pip.frame.w} hover={pip.hover} under={pip.under} side={pip.side}>
            {pip.content}
          </PipWindow>
        </div>
      ) : null}
      {tab && (tab.opacity ?? 1) > 0 ? (
        <div style={{ position: 'absolute', left: tab.x, top: tab.cy - 44, zIndex: 21, opacity: tab.opacity ?? 1 }}>
          <Handle side={tab.side} under={tab.under} docked={tab.docked} />
        </div>
      ) : null}
      <div style={{ position: 'absolute', inset: 0, zIndex: 15, pointerEvents: 'none' }}>
        <MenuBar app={front === 'claude' ? 'Claude' : 'Browser'} clock={clock} />
      </div>
      {clicks.map((c, i) => (
        <ClickRing key={i} x={c.x} y={c.y} t={c.t} />
      ))}
      {cursor ? <Cursor x={cursor.x} y={cursor.y} pressed={cursor.pressed} opacity={cursor.opacity} shape={cursor.shape} /> : null}
    </div>
  )
}
