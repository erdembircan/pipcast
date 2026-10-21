import type { Jingle, Story } from '@pipcast/contract'
import type { Scene, TickerItem } from '@pipcast/design'

export type QueueItem =
  | { kind: 'story'; sessionId: string; story: Story }
  | { kind: 'hour'; hour: number }

// A story whose segment has ended, remembered for the ticker
export interface Carried {
  endedAt: number
  kind: Story['kind']
  sessionId: string
}

export interface ReportMemory {
  // The hour (ms) of the last report that aired; the next report starts here
  hour: number
  // How many stories it counted
  stories: number
}

// What the board and its ticker are built from
export interface BoardState {
  queue: readonly QueueItem[]
  carried: ReadonlyMap<string, Carried>
  // The story whose segment is on air, if one is
  onAirStoryId: string | null
  lastReport: ReportMemory | null
  // When the last report's segment ended; null while it is on air, or when
  // the report is only remembered from an earlier run
  reportEndedAt: number | null
}

// What a step draws itself from, each tick
export interface StepContext {
  now: number
  // The board's ticker and the board, as they are at this moment
  ticker: TickerItem[]
  board: Scene
}

// One step of a segment. Its scene is rebuilt on every tick, so the clock,
// the waiting time and the ticker are always current.
export interface Step {
  role: 'opener' | 'desk' | 'review' | 'outro'
  length: number
  cue?: Jingle
  scene(context: StepContext): Scene
}
