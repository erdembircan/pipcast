// The shapes the mod, the station and the broadcast share. The store holds
// them as JSON; docs/architecture.md describes each file.

export type SessionState = 'working' | 'needs-input' | 'ready' | 'error'

export type StoryKind = 'needs-input' | 'ready' | 'complete' | 'error'

export type Quadrant = 'top-left' | 'top-right' | 'bottom-left' | 'bottom-right'

export type Jingle = 'breaking' | 'breaking-out' | 'hour' | 'hour-out'

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
}

// The bridge between the station and its web page

export interface Snapshot {
  now: number
  visible: boolean
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

export type PageMessage =
  | { type: 'ready' }
  | { type: 'cue'; jingle: Jingle }
  | { type: 'reported'; at: number }
  | { type: 'rendered' }
  | { type: 'log'; level: 'info' | 'error'; text: string }
