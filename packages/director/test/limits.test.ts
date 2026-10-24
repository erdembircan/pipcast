import { describe, expect, it } from 'vitest'

import type { SessionRecord, Snapshot, UsageLimit } from '@pipcast/contract'

import { boardScene } from '../src/board.ts'
import { limitMeters } from '../src/limits.ts'
import type { BoardState } from '../src/types.ts'
import { harness, session, story, T0 } from './helpers.ts'

const empty: BoardState = {
  queue: [],
  carried: new Map(),
  onAirStoryId: null,
  lastReport: null,
  reportEndedAt: null,
}

const later = T0 + 3_600_000

const sessionLimit = (percentUsed: number, at: number, resetsAt: number | null = later): UsageLimit => ({
  kind: 'session',
  percentUsed,
  resetsAt,
  at,
})
const weekLimit = (percentUsed: number, at: number, resetsAt: number | null = later): UsageLimit => ({
  kind: 'week',
  percentUsed,
  resetsAt,
  at,
})

function reading(id: string, ...limits: UsageLimit[]): SessionRecord {
  return session(id, { limits })
}

function snap(...sessions: SessionRecord[]): Snapshot {
  return { now: T0, visible: true, sessions, lastReportAt: null }
}

describe('limitMeters', () => {
  it('takes each limit from the newest reading of any session on air', () => {
    const sessions = [
      reading('a', sessionLimit(70, T0 - 60_000)),
      reading('b', sessionLimit(74, T0 - 1000)),
    ]
    expect(limitMeters(sessions, T0)).toEqual([{ kind: 'session', percent: 74 }])

    const mixed = [
      reading('a', sessionLimit(80, T0 - 1000), weekLimit(50, T0 - 60_000)),
      reading('b', sessionLimit(60, T0 - 60_000), weekLimit(55, T0 - 2000)),
    ]
    expect(limitMeters(mixed, T0)).toEqual([
      { kind: 'session', percent: 80 },
      { kind: 'week', percent: 55 },
    ])
  })

  it('reads a limit past its reset time as 0%', () => {
    const sessions = [reading('a', sessionLimit(88, T0 - 1000, T0), weekLimit(61, T0 - 1000, T0 - 1))]
    expect(limitMeters(sessions, T0)).toEqual([
      { kind: 'session', percent: 0 },
      { kind: 'week', percent: 0 },
    ])
    const before = [reading('a', sessionLimit(88, T0 - 1000, T0 + 1))]
    expect(limitMeters(before, T0)).toEqual([{ kind: 'session', percent: 88 }])
  })

  it('rounds each figure to a whole percent, as usage-band does', () => {
    const sessions = [reading('a', sessionLimit(42.5, T0), weekLimit(69.4, T0))]
    expect(limitMeters(sessions, T0)).toEqual([
      { kind: 'session', percent: 43 },
      { kind: 'week', percent: 69 },
    ])
    expect(limitMeters([reading('a', sessionLimit(89.5, T0), weekLimit(0.4, T0))], T0)).toEqual([
      { kind: 'session', percent: 90 },
      { kind: 'week', percent: 0 },
    ])
  })

  it('keeps each figure between 0 and 100', () => {
    const sessions = [reading('a', sessionLimit(120, T0), weekLimit(-5, T0))]
    expect(limitMeters(sessions, T0)).toEqual([
      { kind: 'session', percent: 100 },
      { kind: 'week', percent: 0 },
    ])
  })

  it('leaves out a limit no session has read', () => {
    expect(limitMeters([reading('a', weekLimit(61, T0)), reading('b')], T0)).toEqual([{ kind: 'week', percent: 61 }])
  })

  it('gives no meters before any session has read the limits', () => {
    expect(limitMeters([], T0)).toEqual([])
    expect(limitMeters([reading('a'), reading('b')], T0)).toEqual([])
  })

  it('skips a limit that is not well formed, and a record with none', () => {
    const odd = session('a', {
      limits: [
        { kind: 'month', percentUsed: 10, resetsAt: null, at: T0 },
        { kind: 'session', percentUsed: '40', resetsAt: null, at: T0 },
        weekLimit(33, T0),
      ] as unknown as UsageLimit[],
    })
    const text = session('b', { limits: 'none' as unknown as UsageLimit[] })
    const bare = session('c')
    delete (bare as { limits?: unknown }).limits
    expect(limitMeters([odd, text, bare], T0)).toEqual([{ kind: 'week', percent: 33 }])
  })
})

describe('the board scene', () => {
  it('puts the meters on the board scene, the session\'s first', () => {
    const scene = boardScene(
      T0,
      snap(reading('a', weekLimit(61.2, T0 - 1000), sessionLimit(42.4, T0 - 1000))),
      empty,
    )
    expect(scene.limits).toEqual([
      { kind: 'session', percent: 42 },
      { kind: 'week', percent: 61 },
    ])
  })

  it('leaves the meters off the scene with no reading', () => {
    const scene = boardScene(T0, snap(reading('a'), reading('b')), empty)
    expect('limits' in scene).toBe(false)
    expect('limits' in boardScene(T0, null, empty)).toBe(false)
  })

  it('hands the meters to an outro\'s board', () => {
    const h = harness(T0, [reading('a')])
    const asking = session('a', {
      state: 'needs-input',
      stateAt: T0 + 5000,
      stories: [story('a:1', 'needs-input', T0 + 5000, { command: 'npm install', quote: 'Install dependencies' })],
      limits: [sessionLimit(73.6, T0 + 4000), weekLimit(91.5, T0 + 4000)],
    })
    h.land([asking], T0 + 5000)
    const outro = h.until(T0 + 5000 + 12_000).program
    expect(outro.scene.mode).toBe('outro')
    expect(outro.scene.board?.limits).toEqual([
      { kind: 'session', percent: 74 },
      { kind: 'week', percent: 92 },
    ])
  })
})
