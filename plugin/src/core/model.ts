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

export interface SessionModel {
  // tunedInAt and checkedInAt are set when it is written
  record: SessionRecord
  // the last story number used
  seq: number
  turn: Turn
  // a hook gave the title; the transcript no longer overrides it
  titleFromHook: boolean
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

export function newModel(id: string, project: string, title: string, now: number): SessionModel {
  return {
    record: trimRecord({
      v: 1,
      id,
      title,
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
    titleFromHook: false,
  }
}

export function turnStarted(m: SessionModel, now: number, turnId: string): SessionModel {
  const turn: Turn = { id: turnId, startedAt: now, baseline: null, edits: { added: 0, removed: 0, files: new Set() }, ended: false }
  return withRecord(m, withState(m.record, 'working', now), { turn })
}

export function activity(m: SessionModel, now: number, text: string): SessionModel {
  return withRecord(m, { ...m.record, activity: [...m.record.activity, { at: now, text }] })
}

export function askedQuestion(m: SessionModel, now: number, quote: string): SessionModel {
  const { record, seq } = addStory(m, now, { kind: 'needs-input', quote })
  return withRecord(m, withState(record, 'needs-input', now), { seq })
}

export function askedPermission(m: SessionModel, now: number, command: string | undefined, quote: string | undefined): SessionModel {
  const story: Omit<Story, 'id' | 'at'> = { kind: 'needs-input' }
  if (command !== undefined) {
    story.command = command
  }
  if (quote !== undefined) {
    story.quote = quote
  }
  const { record, seq } = addStory(m, now, story)
  return withRecord(m, withState(record, 'needs-input', now), { seq })
}

export function resumed(m: SessionModel, now: number): SessionModel {
  return m.record.state === 'needs-input' ? withRecord(m, withState(m.record, 'working', now)) : m
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
    return withRecord(m, withState(m.record, 'working', now))
  }
  const { changes } = done
  let story: Omit<Story, 'id' | 'at'>
  if (changes.files > 0) {
    story = { kind: 'ready', added: changes.added, removed: changes.removed, files: changes.files, ...duration(m, now) }
  } else {
    story = { kind: 'complete', ...(done.lastWords === '' ? {} : { quote: done.lastWords }), ...duration(m, now) }
  }
  const { record, seq } = addStory(m, now, story)
  return withRecord(m, withHour(withState(record, 'ready', now), now, changes), { seq, turn: { ...m.turn, ended: true } })
}

export function failed(m: SessionModel, now: number, kind: string): SessionModel {
  const { record, seq } = addStory(m, now, { kind: 'error', quote: errorWords(kind), ...duration(m, now) })
  return withRecord(m, withState(record, 'error', now), { seq, turn: { ...m.turn, ended: true } })
}

export function aborted(m: SessionModel, now: number): SessionModel {
  if (m.turn.ended) {
    return m
  }
  return withRecord(m, withState(m.record, 'ready', now), { turn: { ...m.turn, ended: true } })
}

export function titled(m: SessionModel, title: string, fromHook: boolean): SessionModel {
  if (title === '' || (!fromHook && m.titleFromHook)) {
    return m
  }
  return withRecord(m, { ...m.record, title }, { titleFromHook: m.titleFromHook || fromHook })
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
