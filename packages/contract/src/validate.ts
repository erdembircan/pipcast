// Reading what the store holds. Every file is JSON written by another
// program, so each reader takes `unknown` and returns a well-formed value or
// a safe default. The rest are the small rules about who is on air.

import { MAX_ACTIVITY, MAX_HOURS, MAX_STORIES, STALE_MS, STATION_STALE_MS } from './constants.ts'
import type {
  Activity,
  HourStats,
  LimitKind,
  Quadrant,
  SessionRecord,
  SessionState,
  SharedOptions,
  StationControl,
  StationPrefs,
  StationStatus,
  Story,
  StoryKind,
  UsageLimit,
} from './types.ts'

const SESSION_STATES: readonly string[] = ['working', 'needs-input', 'ready', 'error']
const STORY_KINDS: readonly string[] = ['needs-input', 'ready', 'complete', 'error']
const QUADRANTS: readonly string[] = ['top-left', 'top-right', 'bottom-left', 'bottom-right']
const LIMIT_KINDS: readonly string[] = ['session', 'week']
const HOUR_KEY = /^\d{4}-\d{2}-\d{2}T\d{2}$/

// How far ahead of now a check-in may be before it is not believed
const CLOCK_SKEW_MS = 5000

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function isNumber(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value)
}

function isString(value: unknown): value is string {
  return typeof value === 'string'
}

function isSessionState(value: unknown): value is SessionState {
  return typeof value === 'string' && SESSION_STATES.includes(value)
}

function isStoryKind(value: unknown): value is StoryKind {
  return typeof value === 'string' && STORY_KINDS.includes(value)
}

function isQuadrant(value: unknown): value is Quadrant {
  return typeof value === 'string' && QUADRANTS.includes(value)
}

function isLimitKind(value: unknown): value is LimitKind {
  return typeof value === 'string' && LIMIT_KINDS.includes(value)
}

function parseStory(value: unknown): Story | null {
  if (!isObject(value)) {
    return null
  }
  const { id, kind, at } = value
  if (!isString(id) || id === '' || !isStoryKind(kind) || !isNumber(at)) {
    return null
  }
  const story: Story = { id, kind, at }
  if (isString(value.command)) {
    story.command = value.command
  }
  if (isString(value.quote)) {
    story.quote = value.quote
  }
  if (isNumber(value.added)) {
    story.added = value.added
  }
  if (isNumber(value.removed)) {
    story.removed = value.removed
  }
  if (isNumber(value.files)) {
    story.files = value.files
  }
  if (isNumber(value.durationMs)) {
    story.durationMs = value.durationMs
  }
  return story
}

function parseActivity(value: unknown): Activity | null {
  if (!isObject(value) || !isNumber(value.at) || !isString(value.text)) {
    return null
  }
  return { at: value.at, text: value.text }
}

function parseHour(value: unknown): HourStats | null {
  if (!isObject(value)) {
    return null
  }
  const { hour, added, removed, files } = value
  if (!isString(hour) || !HOUR_KEY.test(hour) || !isNumber(added) || !isNumber(removed) || !isNumber(files)) {
    return null
  }
  return { hour, added, removed, files }
}

function parseLimit(value: unknown): UsageLimit | null {
  if (!isObject(value)) {
    return null
  }
  const { kind, percentUsed, resetsAt, at } = value
  if (!isLimitKind(kind) || !isNumber(percentUsed) || !isNumber(at)) {
    return null
  }
  return { kind, percentUsed, resetsAt: isNumber(resetsAt) ? resetsAt : null, at }
}

function parseList<T>(value: unknown, parseItem: (item: unknown) => T | null): T[] {
  if (!Array.isArray(value)) {
    return []
  }
  const out: T[] = []
  for (const item of value) {
    const parsed = parseItem(item)
    if (parsed !== null) {
      out.push(parsed)
    }
  }
  return out
}

// A record's usage limits: the well-formed ones it holds, and none when it
// holds none. The broadcast reads them through this too, since the station
// hands each record over as the store has it
export function parseLimits(value: unknown): UsageLimit[] {
  return parseList(value, parseLimit)
}

export function parseSessionRecord(value: unknown): SessionRecord | null {
  if (!isObject(value) || value.v !== 1) {
    return null
  }
  const { id, title, project, state, stateAt, tunedInAt, checkedInAt } = value
  if (!isString(id) || id === '' || !isString(title) || !isString(project) || !isSessionState(state)) {
    return null
  }
  if (!isNumber(stateAt) || !isNumber(tunedInAt) || !isNumber(checkedInAt)) {
    return null
  }
  return {
    v: 1,
    id,
    title,
    project,
    state,
    stateAt,
    tunedInAt,
    checkedInAt,
    stories: parseList(value.stories, parseStory),
    activity: parseList(value.activity, parseActivity),
    hours: parseList(value.hours, parseHour),
    limits: parseLimits(value.limits),
  }
}

export function isLive(record: SessionRecord, now: number): boolean {
  return now - record.checkedInAt <= STALE_MS && record.checkedInAt <= now + CLOCK_SKEW_MS
}

export function onAir(records: readonly SessionRecord[], now: number): SessionRecord[] {
  return records
    .filter((record) => isLive(record, now))
    .sort((a, b) => {
      if (a.tunedInAt !== b.tunedInAt) {
        return a.tunedInAt - b.tunedInAt
      }
      if (a.id === b.id) {
        return 0
      }
      return a.id < b.id ? -1 : 1
    })
}

// Keeps the newest of each list, oldest first
export function trimRecord(record: SessionRecord): SessionRecord {
  return {
    ...record,
    stories: record.stories.slice(-MAX_STORIES),
    activity: record.activity.slice(-MAX_ACTIVITY),
    hours: record.hours.slice(-MAX_HOURS),
  }
}

export function parseStationStatus(value: unknown): StationStatus | null {
  if (!isObject(value) || value.v !== 1) {
    return null
  }
  const { pid, startedAt, heartbeatAt, version } = value
  if (typeof pid !== 'number' || !Number.isInteger(pid) || pid <= 0) {
    return null
  }
  if (!isNumber(startedAt) || !isNumber(heartbeatAt) || !isString(version)) {
    return null
  }
  return { v: 1, pid, startedAt, heartbeatAt, version }
}

export function isStationAlive(status: StationStatus | null, now: number): boolean {
  return status !== null && now - status.heartbeatAt <= STATION_STALE_MS
}

export function parseControl(value: unknown): StationControl {
  if (isObject(value) && value.v === 1 && isNumber(value.closedAt)) {
    return { v: 1, closedAt: value.closedAt }
  }
  return { v: 1, closedAt: null }
}

export function parsePrefs(value: unknown): StationPrefs {
  const prefs: StationPrefs = { v: 1, sound: true, quadrant: 'bottom-right', scale: 1, lastReportAt: null }
  if (!isObject(value)) {
    return prefs
  }
  if (typeof value.sound === 'boolean') {
    prefs.sound = value.sound
  }
  if (isQuadrant(value.quadrant)) {
    prefs.quadrant = value.quadrant
  }
  if (isNumber(value.scale)) {
    prefs.scale = Math.min(1, Math.max(0.7, value.scale))
  }
  if (isNumber(value.lastReportAt)) {
    prefs.lastReportAt = value.lastReportAt
  }
  return prefs
}

// options.json, or null when it is missing or not one
export function parseSharedOptions(value: unknown): SharedOptions | null {
  if (!isObject(value) || value.v !== 1 || typeof value.transparent !== 'boolean') {
    return null
  }
  return { v: 1, transparent: value.transparent }
}
