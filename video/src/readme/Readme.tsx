// The README's three grids of screenshots, drawn from the video's own pieces
// and laid out as its boards are: a line in the serif over each picture, on
// the paper. In use: moments of the desktop scene. On air: KLWD's pictures in
// its window, as the director airs them. The window: its tricks, two of them in
// states the video only passes through. scripts/readme.mjs renders each grid
// into assets/screenshots at the repository's root.
import type { ReactNode } from 'react'

import {
  ACTIVITY,
  LEAD,
  activityLine,
  errorWords,
  finishedFoot,
  stillWaitingLine,
  stoppedFoot,
  storyLine,
  waitingForReviewLine,
} from '../../../packages/contract/src/copy.ts'
import '../design/fonts.ts'
import { DesignStyles } from '../design/DesignStyles.tsx'
import { OnAir } from '../design/OnAir.tsx'
import type { Scene } from '../design/pipnews.ts'
import { PipWindow } from '../design/PipWindow.tsx'
import { PLATE } from '../desktop/ClaudeApp.tsx'
import { CLAUDE_WINDOW, SCREEN_H, SCREEN_W, pipFrame } from '../desktop/geometry.ts'
import { StationTab } from '../look/HeadlineBand.tsx'
import { Paper } from '../look/Paper.tsx'
import { INK, SERIF } from '../look/theme.ts'
import { AirAt } from '../scenes/common.tsx'
import { DeskScreen } from '../scenes/Desk.tsx'
import { WIDE } from '../stage/Frame.tsx'
import type { View } from '../stage/Frame.tsx'
import { Screen } from '../stage/Screen.tsx'
import { AUTH, CHECKOUT, NOTES, SQLITE } from '../stories.ts'

/** Every grid is 1920 wide; its height follows from its rows */
export const GRID_W = 1920
const PAD_X = 72
const PAD_Y = 64
const GAP_X = 48
const GAP_Y = 56
/** Between a line and its picture */
const UNDER = 18
const SCREEN_ASPECT = SCREEN_H / SCREEN_W
const AIR_ASPECT = 9 / 16

const tileWidth = (columns: number) => Math.floor((GRID_W - 2 * PAD_X - (columns - 1) * GAP_X) / columns)
const lineHeight = (size: number) => Math.round(size * 1.3)
const gridHeight = (columns: number, rows: number, size: number, aspect: number) =>
  2 * PAD_Y + rows * (lineHeight(size) + UNDER + Math.round(tileWidth(columns) * aspect)) + (rows - 1) * GAP_Y

interface Caption {
  text: string
  /** KLWD's red tab after the words, as the video's headline band has it */
  tab?: string
}

interface Tile {
  caption: Caption
  picture: (width: number) => ReactNode
}

function Line({ caption, size }: { caption: Caption; size: number }) {
  return (
    <div
      style={{
        height: lineHeight(size),
        display: 'flex',
        justifyContent: 'center',
        alignItems: 'center',
        whiteSpace: 'nowrap',
        font: `500 ${size}px/1.1 ${SERIF}`,
        letterSpacing: '-0.022em',
        color: INK,
      }}
    >
      {caption.text}
      {caption.tab ? <StationTab text={caption.tab} t={2} size={size} /> : null}
    </div>
  )
}

/** The screen as the camera frames it: zoom 1 shows all of it, and closer in the view stays inside the screen */
function ScreenView({ width, view, children }: { width: number; view: View; children: ReactNode }) {
  const height = Math.round(width * SCREEN_ASPECT)
  const k = (width * Math.max(1, view.zoom)) / SCREEN_W
  const halfW = width / (2 * k)
  const halfH = height / (2 * k)
  const x = Math.min(Math.max(view.x, halfW), SCREEN_W - halfW)
  const y = Math.min(Math.max(view.y, halfH), SCREEN_H - halfH)
  return (
    <div
      style={{
        position: 'relative',
        width,
        height,
        borderRadius: 14,
        overflow: 'hidden',
        background: '#1d1d1f',
        boxShadow: '0 24px 60px rgba(40, 32, 20, 0.22), 0 6px 18px rgba(40, 32, 20, 0.12), 0 0 0 1px rgba(20, 20, 19, 0.08)',
      }}
    >
      <div
        style={{
          position: 'absolute',
          left: 0,
          top: 0,
          width: SCREEN_W,
          height: SCREEN_H,
          transformOrigin: '0 0',
          transform: `translate(${width / 2 - x * k}px, ${height / 2 - y * k}px) scale(${k})`,
        }}
      >
        {children}
      </div>
    </div>
  )
}

function Grid({ columns, size, tiles }: { columns: number; size: number; tiles: Tile[] }) {
  const width = tileWidth(columns)
  return (
    <Paper>
      <DesignStyles />
      <div
        style={{
          position: 'absolute',
          left: PAD_X,
          top: PAD_Y,
          display: 'grid',
          gridTemplateColumns: `repeat(${columns}, ${width}px)`,
          columnGap: GAP_X,
          rowGap: GAP_Y,
        }}
      >
        {tiles.map((tile) => (
          <div key={tile.caption.text} style={{ display: 'flex', flexDirection: 'column', gap: UNDER }}>
            <Line caption={tile.caption} size={size} />
            {tile.picture(width)}
          </div>
        ))}
      </div>
    </Paper>
  )
}

/** A moment of the video's desktop scene, framed by `view` */
function desk(T: number, view: View): Tile['picture'] {
  return (width) => (
    <ScreenView width={width} view={view}>
      <DeskScreen T={T} />
    </ScreenView>
  )
}

/** KLWD's window, as wide as the tile */
function air(picture: ReactNode): Tile['picture'] {
  return (width) => (
    <div style={{ position: 'relative', width, height: Math.round(width * AIR_ASPECT) }}>
      <PipWindow width={width}>{picture}</PipWindow>
    </div>
  )
}

const BR = pipFrame('bottom-right')
const TL = pipFrame('top-left')
const NEAR_BR: View = { x: BR.x + BR.w / 2, y: BR.y + BR.h / 2, zoom: 1.45 }
const CLOSE_BR: View = { x: BR.x + BR.w / 2, y: BR.y + BR.h / 2, zoom: 1.8 }
const NEAR_TL: View = { x: TL.x + TL.w / 2, y: TL.y + TL.h / 2, zoom: 1.45 }

interface StagedProps {
  hover?: number
  opacity?: number
  pointer: { x: number; y: number }
}

/** The desktop at 33 s, the browser in front and the board in the bottom-right corner, with the window as the video never holds it */
function Staged({ hover = 0, opacity = 1, pointer }: StagedProps) {
  return (
    <Screen
      front="browser"
      claude={{ tuned: true }}
      clock="Sat Oct 25  5:43 PM"
      time={33}
      pip={{ frame: BR, content: <AirAt T={33} />, hover, opacity, side: 'right' }}
      cursor={pointer}
    />
  )
}

function staged(props: StagedProps, view: View): Tile['picture'] {
  return (width) => (
    <ScreenView width={width} view={view}>
      <Staged {...props} />
    </ScreenView>
  )
}

/** The Claude app at 19.8 s, the pointer resting on TUNE IN as in the video, but just past its words, so it covers none of them */
function TuneIn() {
  return (
    <Screen
      front="claude"
      claude={{ tuned: false, plateHover: true }}
      clock="Sat Oct 25  5:43 PM"
      time={19.8}
      cursor={{ x: CLAUDE_WINDOW.x + PLATE.x + 142, y: CLAUDE_WINDOW.y + PLATE.y + 16 }}
    />
  )
}

// What the video never airs, in the product's own words: a board with every
// state on it, and the desks for work complete and an error
const checkoutRunning = activityLine(CHECKOUT.project, ACTIVITY.running('the checkout tests'))

const BOARD: Scene = {
  mode: 'board',
  clock: '17:52',
  sessions: [
    { ...CHECKOUT, state: 'needs-input' },
    { ...SQLITE, state: 'error' },
    { ...NOTES, state: 'ready' },
    { ...AUTH, state: 'working' },
  ],
  limits: [
    { kind: 'session', percent: 74 },
    { kind: 'week', percent: 61 },
  ],
  ticker: [
    { lead: LEAD.stillWaiting, text: stillWaitingLine('needs-input', CHECKOUT.name, 4) },
    { lead: LEAD.stillWaiting, text: stillWaitingLine('error', SQLITE.name, 2) },
    { lead: LEAD.ready, text: waitingForReviewLine(NOTES.name) },
    activityLine(AUTH.project, ACTIVITY.editing('src/auth/session.ts')),
  ],
}

const DESK_COMPLETE: Scene = {
  mode: 'desk',
  clock: '17:52',
  act: 'talk',
  event: {
    kind: 'complete',
    session: AUTH.name,
    project: AUTH.project,
    quote: 'Tokens already rotate on every login. Nothing to change.',
    foot: finishedFoot('6 min'),
  },
  ticker: [{ lead: LEAD.breaking, text: storyLine('complete', AUTH.name) }, { lead: LEAD.ready, text: waitingForReviewLine(NOTES.name) }, checkoutRunning],
}

const DESK_ERROR: Scene = {
  mode: 'desk',
  clock: '17:52',
  act: 'glance',
  event: {
    kind: 'error',
    session: SQLITE.name,
    project: SQLITE.project,
    quote: errorWords('overloaded'),
    foot: stoppedFoot('31 min'),
  },
  ticker: [{ lead: LEAD.breaking, text: storyLine('error', SQLITE.name) }, { lead: LEAD.ready, text: waitingForReviewLine(NOTES.name) }, checkoutRunning],
}

const IN_USE: Tile[] = [
  {
    caption: { text: 'Tune in from Claude.' },
    picture: (width) => (
      <ScreenView width={width} view={{ x: 660, y: 617, zoom: 1.55 }}>
        <TuneIn />
      </ScreenView>
    ),
  },
  { caption: { text: 'Switch apps. KLWD floats above them all.' }, picture: desk(28, WIDE) },
  { caption: { text: 'When Claude needs you, you’ll know.' }, picture: desk(41.4, NEAR_BR) },
  { caption: { text: 'One click takes you back to the question.' }, picture: desk(45.95, { x: 780, y: 560, zoom: 1.4 }) },
]

const ON_AIR: Tile[] = [
  { caption: { text: 'Every session, live on one board.' }, picture: air(<OnAir scene={BOARD} t={3} clock={4.2} crawl={0} />) },
  { caption: { text: 'Stories open with', tab: 'BREAKING NEWS' }, picture: air(<AirAt T={39.45} />) },
  { caption: { text: 'A session needs your input.' }, picture: air(<AirAt T={42.5} />) },
  { caption: { text: 'A session is ready for review.' }, picture: air(<AirAt T={6.9} />) },
  { caption: { text: 'A session’s work is complete.' }, picture: air(<OnAir scene={DESK_COMPLETE} t={3} clock={3} crawl={0} />) },
  { caption: { text: 'A session stopped on an error.' }, picture: air(<OnAir scene={DESK_ERROR} t={3} clock={3} crawl={0} />) },
  { caption: { text: 'At the top of every hour,' }, picture: air(<AirAt T={56.5} />) },
  { caption: { text: 'Clawd reads the headlines,' }, picture: air(<AirAt T={59.8} />) },
  { caption: { text: 'and what each session did.' }, picture: air(<AirAt T={61.5} />) },
]

const WINDOW: Tile[] = [
  { caption: { text: 'Hover for its controls.' }, picture: staged({ hover: 1, pointer: { x: BR.x + BR.w * 0.56, y: BR.y + BR.h * 0.6 } }, CLOSE_BR) },
  { caption: { text: 'Drag it to any corner.' }, picture: desk(71.2, { x: 560, y: 380, zoom: 1.25 }) },
  { caption: { text: 'Tuck it into the side.' }, picture: desk(73.3, { x: 0, y: 0, zoom: 1.8 }) },
  { caption: { text: 'Back out for', tab: 'BREAKING NEWS' }, picture: desk(77, NEAR_TL) },
  { caption: { text: 'Switch desktops. KLWD stays put.' }, picture: desk(66.8, WIDE) },
  { caption: { text: 'Or let it fade out of your way.' }, picture: staged({ opacity: 0.4, pointer: { x: 640, y: 420 } }, NEAR_BR) },
]

export const IN_USE_H = gridHeight(2, 2, 40, SCREEN_ASPECT)
export const ON_AIR_H = gridHeight(3, 3, 30, AIR_ASPECT)
export const WINDOW_H = gridHeight(3, 2, 30, SCREEN_ASPECT)

export const ReadmeInUse = () => <Grid columns={2} size={40} tiles={IN_USE} />
export const ReadmeOnAir = () => <Grid columns={3} size={30} tiles={ON_AIR} />
export const ReadmeWindow = () => <Grid columns={3} size={30} tiles={WINDOW} />
