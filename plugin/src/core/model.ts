// The session's record in memory, and how each event changes it. Every
// function takes a model and returns a new one; none touches the world.

import { errorWords } from '../contract/copy.ts'
import { hourKey } from '../contract/format.ts'
import { trimRecord } from '../contract/validate.ts'
import type { SessionRecord, SessionState, Story } from '../contract/types.ts'
import type { Changes, Numstat } from './diffstat.ts'

export interface Turn {
  id: string | null
  startedAt: number | null
  baseline: { numstat: Numstat; untracked: Set<string> } | null
  edits: { added: number; removed: number; files: Set<string> }
  ended: boolean
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
}

function emptyTurn(): Turn {
  return { id: null, startedAt: null, baseline: null, edits: { added: 0, removed: 0, files: new Set() }, ended: true }
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
  }
}

export function turnStarted(m: SessionModel, now: number, turnId: string): SessionModel {
  const turn: Turn = { id: turnId, startedAt: now, baseline: null, edits: { added: 0, removed: 0, files: new Set() }, ended: false }
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

function withHour(record: SessionRecord, now: number, changes: Changes): SessionRecord {
  const key = hourKey(now)
  const hours = record.hours.slice()
  const at = hours.findIndex((hour) => hour.hour === key)
  if (at >= 0) {
    const hour = hours[at]
    if (hour !== undefined) {
      hours[at] = {
        hour: key,
        added: hour.added + changes.added,
        removed: hour.removed + changes.removed,
        files: hour.files + changes.files,
      }
    }
  } else {
    hours.push({ hour: key, added: changes.added, removed: changes.removed, files: changes.files })
  }
  return { ...record, hours }
}

export function finished(m: SessionModel, now: number, done: { lastWords: string; changes: Changes; background: boolean }): SessionModel {
  if (done.background) {
    // Work the session started will wake it again: still working, with no story yet, but this turn is over
    return withRecord(m, withState(m.record, 'working', now), { turn: { ...m.turn, ended: true }, waitingOn: null })
  }
  const { changes } = done
  let story: Omit<Story, 'id' | 'at'>
  if (changes.files > 0) {
    story = { kind: 'ready', added: changes.added, removed: changes.removed, files: changes.files, ...duration(m, now) }
  } else {
    story = { kind: 'complete', ...(done.lastWords === '' ? {} : { quote: done.lastWords }), ...duration(m, now) }
  }
  const { record, seq } = addStory(m, now, story)
  return withRecord(m, withHour(withState(record, 'ready', now), now, changes), { seq, turn: { ...m.turn, ended: true }, waitingOn: null })
}

export function failed(m: SessionModel, now: number, kind: string): SessionModel {
  const { record, seq } = addStory(m, now, { kind: 'error', quote: errorWords(kind), ...duration(m, now) })
  return withRecord(m, withState(record, 'error', now), { seq, turn: { ...m.turn, ended: true }, waitingOn: null })
}

export function aborted(m: SessionModel, now: number): SessionModel {
  if (m.turn.ended) {
    return m
  }
  return withRecord(m, withState(m.record, 'ready', now), { turn: { ...m.turn, ended: true }, waitingOn: null })
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

// The turn's baseline, taken after it started; ignored for a turn that has moved on
export function baselineTaken(m: SessionModel, turnId: string | null, baseline: NonNullable<Turn['baseline']>): SessionModel {
  return m.turn.id === turnId && !m.turn.ended ? { ...m, turn: { ...m.turn, baseline } } : m
}

// What an edit tool did, for a session with no repository
export function edited(m: SessionModel, file: string, added: number, removed: number): SessionModel {
  const files = new Set(m.turn.edits.files)
  files.add(file)
  return { ...m, turn: { ...m.turn, edits: { added: m.turn.edits.added + added, removed: m.turn.edits.removed + removed, files } } }
}
