// The session's record in memory, and how each event changes it. Every
// function takes a model and returns a new one; none touches the world.

import { errorWords } from '../contract/copy.ts'
import { hourKey } from '../contract/format.ts'
import { trimRecord } from '../contract/validate.ts'
import type { SessionRecord, SessionState, Story } from '../contract/types.ts'
import type { Booking } from './diffstat.ts'

export interface Turn {
  id: string | null
  startedAt: number | null
  ended: boolean
}

// The lines and files changed since the session's last finished story: what
// its next ready story says. A turn that ends with work still running leaves
// it to the next turn.
export interface Tally {
  added: number
  removed: number
  files: ReadonlySet<string>
}

// The session's titles: the engine's title file's, the latest a hook carried,
// and the default name. The record's title is the first of them there is.
export interface Titles {
  file: string | null
  hook: string | null
  fallback: string
}

function titleOf(titles: Titles): string {
  return titles.file ?? titles.hook ?? titles.fallback
}

export interface SessionModel {
  // tunedInAt and checkedInAt are set when it is written
  record: SessionRecord
  // the last story number used
  seq: number
  turn: Turn
  // Where the title on the record comes from
  titles: Titles
  // The loop the session waits on: agent is the subagent's id, or null for the main loop; null when it waits on nobody
  waitingOn: { agent: string | null } | null
  // What changed since the last finished story
  tally: Tally
  // The files booked in the hour of the latest booking, so that each counts once in its hour
  hourFiles: { hour: string; files: ReadonlySet<string> } | null
}

function emptyTurn(): Turn {
  return { id: null, startedAt: null, ended: true }
}

function emptyTally(): Tally {
  return { added: 0, removed: 0, files: new Set<string>() }
}

function withRecord(m: SessionModel, record: SessionRecord, rest: Partial<Omit<SessionModel, 'record'>> = {}): SessionModel {
  return { ...m, ...rest, record: trimRecord(record) }
}

function withState(record: SessionRecord, state: SessionState, now: number): SessionRecord {
  return record.state === state ? record : { ...record, state, stateAt: now }
}

function addStory(m: SessionModel, now: number, story: Omit<Story, 'id' | 'at'>): { record: SessionRecord; seq: number } {
  const seq = m.seq + 1
  const full: Story = { id: `${m.record.id}:${seq}`, at: now, ...story }
  return { record: { ...m.record, stories: [...m.record.stories, full] }, seq }
}

export function newModel(id: string, project: string, fallback: string, now: number): SessionModel {
  return {
    record: trimRecord({
      v: 1,
      id,
      title: fallback,
      project,
      state: 'ready',
      stateAt: now,
      tunedInAt: 0,
      checkedInAt: 0,
      stories: [],
      activity: [],
      hours: [],
    }),
    seq: 0,
    turn: emptyTurn(),
    titles: { file: null, hook: null, fallback },
    waitingOn: null,
    tally: emptyTally(),
    hourFiles: null,
  }
}

export function turnStarted(m: SessionModel, now: number, turnId: string): SessionModel {
  const turn: Turn = { id: turnId, startedAt: now, ended: false }
  return withRecord(m, withState(m.record, 'working', now), { turn, waitingOn: null })
}

export function activity(m: SessionModel, now: number, text: string): SessionModel {
  return withRecord(m, { ...m.record, activity: [...m.record.activity, { at: now, text }] })
}

export function askedQuestion(m: SessionModel, now: number, quote: string): SessionModel {
  const { record, seq } = addStory(m, now, { kind: 'needs-input', quote })
  return withRecord(m, withState(record, 'needs-input', now), { seq, waitingOn: { agent: null } })
}

export function askedPermission(
  m: SessionModel,
  now: number,
  command: string | undefined,
  quote: string | undefined,
  agent: string | null,
): SessionModel {
  const story: Omit<Story, 'id' | 'at'> = { kind: 'needs-input' }
  if (command !== undefined) {
    story.command = command
  }
  if (quote !== undefined) {
    story.quote = quote
  }
  const { record, seq } = addStory(m, now, story)
  return withRecord(m, withState(record, 'needs-input', now), { seq, waitingOn: { agent } })
}

// The loop that asked has moved on: `agent` is the subagent's id, or null for the main loop
export function resumed(m: SessionModel, now: number, agent: string | null): SessionModel {
  if (m.record.state !== 'needs-input' || m.waitingOn === null || m.waitingOn.agent !== agent) {
    return m
  }
  return withRecord(m, withState(m.record, 'working', now), { waitingOn: null })
}

function duration(m: SessionModel, now: number): { durationMs?: number } {
  return m.turn.startedAt === null ? {} : { durationMs: Math.max(0, now - m.turn.startedAt) }
}

function withHour(record: SessionRecord, key: string, added: number, removed: number, files: number): SessionRecord {
  const hours = record.hours.slice()
  const at = hours.findIndex((hour) => hour.hour === key)
  const hour = at >= 0 ? hours[at] : undefined
  if (hour !== undefined) {
    hours[at] = { hour: key, added: hour.added + added, removed: hour.removed + removed, files: hour.files + files }
  } else {
    hours.push({ hour: key, added, removed, files })
  }
  return { ...record, hours }
}

// Lines a reading of a tree found, or an edit tool made: added to the hour of
// now, where each file counts once, and to the tally
export function booked(m: SessionModel, now: number, booking: Booking): SessionModel {
  if (booking.added === 0 && booking.removed === 0 && booking.files.length === 0) {
    return m
  }
  const key = hourKey(now)
  const inHour = new Set<string>(m.hourFiles !== null && m.hourFiles.hour === key ? m.hourFiles.files : [])
  const tallied = new Set<string>(m.tally.files)
  let fresh = 0
  for (const file of booking.files) {
    if (!inHour.has(file)) {
      inHour.add(file)
      fresh += 1
    }
    tallied.add(file)
  }
  return withRecord(m, withHour(m.record, key, booking.added, booking.removed, fresh), {
    tally: { added: m.tally.added + booking.added, removed: m.tally.removed + booking.removed, files: tallied },
    hourFiles: { hour: key, files: inHour },
  })
}

export function finished(m: SessionModel, now: number, done: { lastWords: string; background: boolean }): SessionModel {
  if (done.background) {
    // Work the session started will wake it again: still working, with no story yet, but this turn is over
    return withRecord(m, withState(m.record, 'working', now), { turn: { ...m.turn, ended: true }, waitingOn: null })
  }
  const { tally } = m
  let story: Omit<Story, 'id' | 'at'>
  if (tally.files.size > 0) {
    story = { kind: 'ready', added: tally.added, removed: tally.removed, files: tally.files.size, ...duration(m, now) }
  } else {
    story = { kind: 'complete', ...(done.lastWords === '' ? {} : { quote: done.lastWords }), ...duration(m, now) }
  }
  const { record, seq } = addStory(m, now, story)
  return withRecord(m, withState(record, 'ready', now), {
    seq,
    turn: { ...m.turn, ended: true },
    waitingOn: null,
    tally: emptyTally(),
  })
}

export function failed(m: SessionModel, now: number, kind: string): SessionModel {
  const { record, seq } = addStory(m, now, { kind: 'error', quote: errorWords(kind), ...duration(m, now) })
  return withRecord(m, withState(record, 'error', now), {
    seq,
    turn: { ...m.turn, ended: true },
    waitingOn: null,
    tally: emptyTally(),
  })
}

export function aborted(m: SessionModel, now: number): SessionModel {
  if (m.turn.ended) {
    return m
  }
  return withRecord(m, withState(m.record, 'ready', now), { turn: { ...m.turn, ended: true }, waitingOn: null, tally: emptyTally() })
}

// After a reload: the stories and hours the session's own record kept, and
// story numbers that carry on after its newest, which the station has seen
export function restored(m: SessionModel, own: SessionRecord): SessionModel {
  const prefix = `${m.record.id}:`
  let seq = m.seq
  for (const story of own.stories) {
    if (story.id.startsWith(prefix)) {
      const n = Number.parseInt(story.id.slice(prefix.length), 10)
      if (Number.isFinite(n) && n > seq) {
        seq = n
      }
    }
  }
  return withRecord(m, { ...m.record, stories: own.stories, hours: own.hours }, { seq })
}

function withTitles(m: SessionModel, titles: Titles): SessionModel {
  if (titles.file === m.titles.file && titles.hook === m.titles.hook) {
    return m
  }
  return withRecord(m, { ...m.record, title: titleOf(titles) }, { titles })
}

// A hook carried the session's title (classic.SessionStart, classic.UserPromptSubmit)
export function hookTitled(m: SessionModel, title: string): SessionModel {
  return title === '' ? m : withTitles(m, { ...m.titles, hook: title })
}

// The engine's title file was read: its title, or null when it holds none
export function fileTitled(m: SessionModel, title: string | null): SessionModel {
  return withTitles(m, { ...m.titles, file: title === '' ? null : title })
}
