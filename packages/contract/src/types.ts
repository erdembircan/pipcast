// The shapes the mod, the station and the broadcast share. The store holds
// them as JSON; docs/architecture.md describes each file.

export type SessionState = 'working' | 'needs-input' | 'ready' | 'error'

export type StoryKind = 'needs-input' | 'ready' | 'complete' | 'error'

export type Quadrant = 'top-left' | 'top-right' | 'bottom-left' | 'bottom-right'

export type Jingle = 'breaking' | 'breaking-out' | 'hour' | 'hour-out'

// The beat under a desk, in its segment's key: D minor under BREAKING NEWS, D
// major under the hour. The station loops it for as long as it plays
export type Bed = 'beat-minor' | 'beat-major'

// The kinds of error a turn can stop on, as the engine names them
export type ErrorKind =
  | 'authentication_failed'
  | 'oauth_org_not_allowed'
  | 'account_on_hold'
  | 'verification_required'
  | 'billing_error'
  | 'rate_limit'
  | 'overloaded'
  | 'invalid_request'
  | 'model_not_found'
  | 'server_error'
  | 'unknown'
  | 'max_output_tokens'
  | 'cloud_credential_error'

export interface Story {
  id: string
  kind: StoryKind
  at: number
  command?: string
  quote?: string
  added?: number
  removed?: number
  files?: number
  durationMs?: number
}

export interface Activity {
  at: number
  text: string
}

export interface HourStats {
  hour: string
  added: number
  removed: number
  files: number
}

// The account's usage limits: Claude's five-hour window is the session's
// limit, its seven-day window the week's
export type LimitKind = 'session' | 'week'

// One limit as a session last read it
export interface UsageLimit {
  kind: LimitKind
  // How much of the window is used, 0 to 100, as the engine reports it
  percentUsed: number
  // When the window resets, in ms; null when the engine gives no time
  resetsAt: number | null
  // When the session read it
  at: number
}

export interface SessionRecord {
  v: 1
  id: string
  title: string
  project: string
  state: SessionState
  stateAt: number
  tunedInAt: number
  checkedInAt: number
  stories: Story[]
  activity: Activity[]
  hours: HourStats[]
  // The account's usage limits as this session last read them; none on a
  // record written before they were read
  limits?: UsageLimit[]
}

export interface StationStatus {
  v: 1
  pid: number
  startedAt: number
  heartbeatAt: number
  version: string
}

export interface StationControl {
  v: 1
  closedAt: number | null
}

export interface StationPrefs {
  v: 1
  sound: boolean
  quadrant: Quadrant
  scale: number
  lastReportAt: number | null
  // Whether the window is minimized to the side of the screen
  minimized: boolean
}

// options.json: the plugin options the station follows, written by the mods
export interface SharedOptions {
  v: 1
  transparent: boolean
}

// The bridge between the station and its web page

export interface Snapshot {
  now: number
  visible: boolean
  // Whether the window is out in its quadrant and still: false while it is minimized to the side or moving into or out of it. A snapshot without it counts as out
  windowOut?: boolean
  sessions: SessionRecord[]
  lastReportAt: number | null
}

export interface SnapshotMessage extends Snapshot {
  type: 'snapshot'
}

// Snapshot mode: one picture, without motion. `scene` is a scene for the
// design system's Broadcast, drawn as it is. `snapshot` runs the director
// from `snapshot.now` to `at` (by default `snapshot.now`) with that snapshot
// and draws what it airs at `at`.
export interface StillInput {
  scene?: unknown
  snapshot?: Snapshot
  at?: number
}

export interface StillMessage {
  type: 'still'
  input: StillInput
}

export type HostMessage = SnapshotMessage | StillMessage

// What the page tells the station to play, as each event happens. The station
// acts on each at once, and mixes: the beat comes in and goes out with a fade,
// and a cut fades everything (BED_IN_MS, BED_OUT_MS, HUSH_MS)
export type Sound =
  // A jingle starts
  | { type: 'cue'; jingle: Jingle }
  // The beat mixes in, and loops until it is told to go
  | { type: 'bed'; bed: Bed }
  // The beat phases out
  | { type: 'bed-out' }
  // The segment was cut: everything playing fades out
  | { type: 'hush' }

export type PageMessage =
  | { type: 'ready' }
  | Sound
  | { type: 'reported'; at: number }
  | { type: 'window'; wanted: boolean }
  | { type: 'rendered' }
  | { type: 'log'; level: 'info' | 'error'; text: string }
