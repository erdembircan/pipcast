// The session's record in memory, and how each event changes it. Every
// function takes a model and returns a new one; none touches the world.

import { errorWords } from '../../../contract/src/copy.ts'
import { hourKey } from '../../../contract/src/format.ts'
import { trimRecord } from '../../../contract/src/validate.ts'
import type { SessionRecord, SessionState, Story, UsageLimit } from '../../../contract/src/types.ts'
import type { Booking } from './diffstat.ts'
import { keepLimits } from './limits.ts'
import { stillWorking } from './shells.ts'
import type { Shell, ShellState } from './shells.ts'
import type { Waiting } from './wake.ts'

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

// A turn that ended while work it started may still wake the session. Its
// finish waits, with the session working and no story, until a new turn
// starts or nothing it waits on works any more, when it lands as the turn's
// own story
export interface Held {
  // Claude's last words as the turn ended
  lastWords: string
  // When the turn ended
  stoppedAt: number
  // The background commands still working at the last look
  shells: readonly Shell[]
  // Work no look can clear: a subagent, a workflow, an MCP task or an MCP
  // server's monitor, a scheduled wake-up, or a command no look can find
  others: boolean
  // When the commands were last looked at
  lookedAt: number
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
  // The finish of a turn that ended with work still to wake the session; null when none waits
  held: Held | null
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
      limits: [],
    }),
    seq: 0,
    turn: emptyTurn(),
    titles: { file: null, hook: null, fallback },
    waitingOn: null,
    tally: emptyTally(),
    hourFiles: null,
    held: null,
  }
}

export function turnStarted(m: SessionModel, now: number, turnId: string): SessionModel {
  const turn: Turn = { id: turnId, startedAt: now, ended: false }
  return withRecord(m, withState(m.record, 'working', now), { turn, waitingOn: null, held: null })
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

// How long the turn ran, until `end`
function duration(m: SessionModel, end: number): { durationMs?: number } {
  return m.turn.startedAt === null ? {} : { durationMs: Math.max(0, end - m.turn.startedAt) }
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

// The turn ended. While it waits on work that will wake the session, its
// finish is held; otherwise it lands now
export function finished(m: SessionModel, now: number, done: { lastWords: string; waiting: Waiting }): SessionModel {
  const { shells, others } = done.waiting
  if (shells.length > 0 || others) {
    const held: Held = { lastWords: done.lastWords, stoppedAt: now, shells, others, lookedAt: now }
    return withRecord(m, withState(m.record, 'working', now), { turn: { ...m.turn, ended: true }, waitingOn: null, held })
  }
  return finishStory(m, now, done.lastWords, now)
}

// The turn's finish, landing at `now`: a ready story when files changed since
// the last finished story, with the lines, else a complete story with Claude's
// last words; it took until `stoppedAt`, when the turn ended
function finishStory(m: SessionModel, now: number, lastWords: string, stoppedAt: number): SessionModel {
  const { tally } = m
  let story: Omit<Story, 'id' | 'at'>
  if (tally.files.size > 0) {
    story = { kind: 'ready', added: tally.added, removed: tally.removed, files: tally.files.size, ...duration(m, stoppedAt) }
  } else {
    story = { kind: 'complete', ...(lastWords === '' ? {} : { quote: lastWords }), ...duration(m, stoppedAt) }
  }
  const { record, seq } = addStory(m, now, story)
  return withRecord(m, withState(record, 'ready', now), {
    seq,
    turn: { ...m.turn, ended: true },
    waitingOn: null,
    tally: emptyTally(),
    held: null,
  })
}

// A look at the background commands a held finish waits on. Those that run
// until they are stopped no longer hold it, and once nothing holds it, it
// lands as the turn's story
export function looked(m: SessionModel, now: number, states: ReadonlyMap<string, ShellState>): SessionModel {
  const { held } = m
  if (held === null) {
    return m
  }
  const shells = stillWorking(held.shells, states)
  if (shells.length === 0 && !held.others) {
    return finishStory(m, now, held.lastWords, held.stoppedAt)
  }
  return { ...m, held: { ...held, shells, lookedAt: now } }
}

export function failed(m: SessionModel, now: number, kind: string): SessionModel {
  const { record, seq } = addStory(m, now, { kind: 'error', quote: errorWords(kind), ...duration(m, now) })
  return withRecord(m, withState(record, 'error', now), {
    seq,
    turn: { ...m.turn, ended: true },
    waitingOn: null,
    tally: emptyTally(),
    held: null,
  })
}

export function aborted(m: SessionModel, now: number): SessionModel {
  if (m.turn.ended) {
    return m
  }
  return withRecord(m, withState(m.record, 'ready', now), { turn: { ...m.turn, ended: true }, waitingOn: null, tally: emptyTally(), held: null })
}

// After a reload: the stories, hours and usage limits the session's own record kept, and
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
  return withRecord(m, { ...m.record, stories: own.stories, hours: own.hours, limits: own.limits ?? [] }, { seq })
}

// A reading of the account's usage limits: each limit it holds replaces the
// one the record kept of its kind
export function measured(m: SessionModel, read: readonly UsageLimit[]): SessionModel {
  if (read.length === 0) {
    return m
  }
  return withRecord(m, { ...m.record, limits: keepLimits(m.record.limits ?? [], read) })
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
