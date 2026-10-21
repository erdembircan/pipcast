import { describe, expect, it } from 'vitest'
import {
  MAX_ACTIVITY,
  MAX_HOURS,
  MAX_ON_AIR,
  MAX_STORIES,
  STALE_MS,
  STATION_STALE_MS,
  isLive,
  isOnAir,
  isStationAlive,
  onAir,
  parseControl,
  parsePrefs,
  parseSessionRecord,
  parseStationStatus,
  trimRecord,
} from '@pipcast/contract'
import type { SessionRecord } from '@pipcast/contract'

const NOW = 1_800_000_000_000

function record(overrides: Partial<SessionRecord> = {}): SessionRecord {
  return {
    v: 1,
    id: 'a1',
    title: 'Fix flaky checkout test',
    project: 'web-shop',
    state: 'working',
    stateAt: NOW - 60_000,
    tunedInAt: NOW - 600_000,
    checkedInAt: NOW - 2000,
    stories: [
      {
        id: 's1',
        kind: 'ready',
        at: NOW - 30_000,
        command: 'npm test',
        quote: 'All green',
        added: 12,
        removed: 3,
        files: 2,
        durationMs: 42_000,
      },
    ],
    activity: [{ at: NOW - 1000, text: 'editing src/a.ts' }],
    hours: [{ hour: '2026-10-21T14', added: 12, removed: 3, files: 2 }],
    ...overrides,
  }
}

function without(value: SessionRecord, keys: string[]): Record<string, unknown> {
  return Object.fromEntries(Object.entries(value).filter(([key]) => !keys.includes(key)))
}

describe('parseSessionRecord', () => {
  it('round-trips a full valid record', () => {
    const full = record()
    expect(parseSessionRecord(JSON.parse(JSON.stringify(full)))).toEqual(full)
  })

  it('gives null for anything that is not a record', () => {
    expect(parseSessionRecord(null)).toBeNull()
    expect(parseSessionRecord('x')).toBeNull()
    expect(parseSessionRecord([])).toBeNull()
  })

  it.each([
    ['v', { v: 2 }],
    ['id', { id: '' }],
    ['id type', { id: 7 }],
    ['title', { title: null }],
    ['project', { project: 3 }],
    ['state', { state: 'napping' }],
    ['stateAt', { stateAt: '1' }],
    ['tunedInAt', { tunedInAt: Number.NaN }],
    ['checkedInAt', { checkedInAt: Number.POSITIVE_INFINITY }],
  ])('gives null when %s is wrong', (_name, change) => {
    expect(parseSessionRecord({ ...record(), ...change })).toBeNull()
  })

  it('gives null when a required field is missing', () => {
    expect(parseSessionRecord(without(record(), ['checkedInAt']))).toBeNull()
  })

  it('fills in lists that are missing', () => {
    const parsed = parseSessionRecord(without(record(), ['stories', 'activity', 'hours']))
    expect(parsed).not.toBeNull()
    expect(parsed?.stories).toEqual([])
    expect(parsed?.activity).toEqual([])
    expect(parsed?.hours).toEqual([])
  })

  it('drops a bad story and keeps the rest', () => {
    const parsed = parseSessionRecord({
      ...record(),
      stories: [
        { id: 'ok1', kind: 'ready', at: 1 },
        { id: 'bad', kind: 'nonsense', at: 2 },
        { id: 'noat', kind: 'ready' },
        'not an object',
        { id: 'ok2', kind: 'error', at: 3 },
      ],
    })
    expect(parsed?.stories.map((story) => story.id)).toEqual(['ok1', 'ok2'])
  })

  it('drops an optional story field of the wrong type from the story', () => {
    const parsed = parseSessionRecord({
      ...record(),
      stories: [{ id: 's', kind: 'ready', at: 1, command: 5, quote: 'fine', added: 'x', files: 2 }],
    })
    expect(parsed?.stories).toEqual([{ id: 's', kind: 'ready', at: 1, quote: 'fine', files: 2 }])
  })

  it('drops activity and hours that do not fit', () => {
    const parsed = parseSessionRecord({
      ...record(),
      activity: [{ at: 1, text: 'ok' }, { at: 'x', text: 'bad' }, { at: 2 }],
      hours: [
        { hour: '2026-10-21T14', added: 1, removed: 2, files: 3 },
        { hour: '2026-10-21 14', added: 1, removed: 2, files: 3 },
        { hour: '2026-10-21T15', added: 1, removed: 2 },
      ],
    })
    expect(parsed?.activity).toEqual([{ at: 1, text: 'ok' }])
    expect(parsed?.hours).toEqual([{ hour: '2026-10-21T14', added: 1, removed: 2, files: 3 }])
  })

  it('keeps only the known fields', () => {
    const parsed = parseSessionRecord({ ...record(), extra: 'x', stories: [{ id: 's', kind: 'ready', at: 1, junk: true }] })
    expect(parsed).not.toBeNull()
    expect(parsed).not.toHaveProperty('extra')
    expect(parsed?.stories[0]).not.toHaveProperty('junk')
  })
})

describe('who is on air', () => {
  it('counts a record as live for 45 seconds', () => {
    expect(isLive(record({ checkedInAt: NOW - 44_000 }), NOW)).toBe(true)
    expect(isLive(record({ checkedInAt: NOW - STALE_MS }), NOW)).toBe(true)
    expect(isLive(record({ checkedInAt: NOW - 46_000 }), NOW)).toBe(false)
  })

  it('does not believe a check-in from the future', () => {
    expect(isLive(record({ checkedInAt: NOW + 4000 }), NOW)).toBe(true)
    expect(isLive(record({ checkedInAt: NOW + 6000 }), NOW)).toBe(false)
  })

  it('keeps four of six live records, in tune-in order', () => {
    const records = ['f', 'e', 'd', 'c', 'b', 'a'].map((id, i) =>
      record({ id, tunedInAt: NOW - 100_000 + i * 1000, checkedInAt: NOW - 1000 }),
    )
    const air = onAir(records, NOW)
    expect(air).toHaveLength(MAX_ON_AIR)
    expect(air.map((r) => r.id)).toEqual(['f', 'e', 'd', 'c'])
  })

  it('breaks a tie on tune-in time by id', () => {
    const records = ['b', 'c', 'a'].map((id) => record({ id, tunedInAt: NOW - 5000 }))
    expect(onAir(records, NOW).map((r) => r.id)).toEqual(['a', 'b', 'c'])
  })

  it('leaves stale records off the air', () => {
    const records = [record({ id: 'old', checkedInAt: NOW - 60_000 }), record({ id: 'new' })]
    expect(onAir(records, NOW).map((r) => r.id)).toEqual(['new'])
  })

  it('says whether an id is on air', () => {
    const records = ['a', 'b', 'c', 'd', 'e'].map((id, i) => record({ id, tunedInAt: NOW - 10_000 + i }))
    expect(isOnAir('a', records, NOW)).toBe(true)
    expect(isOnAir('d', records, NOW)).toBe(true)
    expect(isOnAir('e', records, NOW)).toBe(false)
    expect(isOnAir('zzz', records, NOW)).toBe(false)
  })

  it('does not change the list it is given', () => {
    const records = [record({ id: 'b' }), record({ id: 'a' })]
    onAir(records, NOW)
    expect(records.map((r) => r.id)).toEqual(['b', 'a'])
  })
})

describe('trimRecord', () => {
  it('keeps the newest of each list, oldest first', () => {
    const stories = Array.from({ length: 14 }, (_, i) => ({ id: `s${i}`, kind: 'ready' as const, at: i }))
    const activity = Array.from({ length: 6 }, (_, i) => ({ at: i, text: `t${i}` }))
    const hours = Array.from({ length: 5 }, (_, i) => ({ hour: `2026-10-21T0${i}`, added: 0, removed: 0, files: 0 }))
    const trimmed = trimRecord(record({ stories, activity, hours }))
    expect(trimmed.stories).toHaveLength(MAX_STORIES)
    expect(trimmed.stories[0]?.id).toBe('s4')
    expect(trimmed.stories.at(-1)?.id).toBe('s13')
    expect(trimmed.activity.map((a) => a.text)).toEqual(['t3', 't4', 't5'])
    expect(trimmed.activity).toHaveLength(MAX_ACTIVITY)
    expect(trimmed.hours.map((h) => h.hour)).toEqual(['2026-10-21T02', '2026-10-21T03', '2026-10-21T04'])
    expect(trimmed.hours).toHaveLength(MAX_HOURS)
  })

  it('leaves short lists alone', () => {
    const short = record()
    expect(trimRecord(short)).toEqual(short)
  })
})

describe('the station files', () => {
  const status = { v: 1, pid: 4242, startedAt: NOW - 100_000, heartbeatAt: NOW - 1000, version: '0.1.0' }

  it('parses a station status', () => {
    expect(parseStationStatus(status)).toEqual(status)
  })

  it.each([
    ['v', { v: 2 }],
    ['pid zero', { pid: 0 }],
    ['pid fraction', { pid: 1.5 }],
    ['pid text', { pid: '1' }],
    ['startedAt', { startedAt: null }],
    ['heartbeatAt', { heartbeatAt: Number.NaN }],
    ['version', { version: 1 }],
  ])('gives null when the status %s is wrong', (_name, change) => {
    expect(parseStationStatus({ ...status, ...change })).toBeNull()
  })

  it('gives null for something that is not an object', () => {
    expect(parseStationStatus(undefined)).toBeNull()
  })

  it('says whether the station is alive', () => {
    expect(isStationAlive(null, NOW)).toBe(false)
    const parsed = parseStationStatus(status)
    expect(isStationAlive(parsed, NOW)).toBe(true)
    expect(isStationAlive(parsed, NOW + STATION_STALE_MS)).toBe(false)
  })

  it('parses the control file', () => {
    expect(parseControl({ v: 1, closedAt: 123 })).toEqual({ v: 1, closedAt: 123 })
    expect(parseControl({ v: 1, closedAt: null })).toEqual({ v: 1, closedAt: null })
    expect(parseControl({ v: 1, closedAt: 'x' })).toEqual({ v: 1, closedAt: null })
    expect(parseControl({ v: 2, closedAt: 5 })).toEqual({ v: 1, closedAt: null })
    expect(parseControl(null)).toEqual({ v: 1, closedAt: null })
  })

  it('parses the prefs, with defaults', () => {
    expect(parsePrefs(null)).toEqual({ v: 1, sound: true, quadrant: 'bottom-right', scale: 1, lastReportAt: null })
    expect(parsePrefs({ v: 1, sound: false, quadrant: 'top-left', scale: 0.8, lastReportAt: 99 })).toEqual({
      v: 1,
      sound: false,
      quadrant: 'top-left',
      scale: 0.8,
      lastReportAt: 99,
    })
  })

  it('clamps the scale to 0.7 to 1', () => {
    expect(parsePrefs({ scale: 0.2 })).toEqual({ v: 1, sound: true, quadrant: 'bottom-right', scale: 0.7, lastReportAt: null })
    expect(parsePrefs({ scale: 3 }).scale).toBe(1)
  })

  it('takes each pref only when it is valid', () => {
    const prefs = parsePrefs({ sound: 'yes', quadrant: 'middle', scale: 'big', lastReportAt: 'x' })
    expect(prefs).toEqual({ v: 1, sound: true, quadrant: 'bottom-right', scale: 1, lastReportAt: null })
  })
})
