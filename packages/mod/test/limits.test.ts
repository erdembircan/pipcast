import { describe, expect, it } from 'vitest'

import type { UsageLimit } from '@pipcast/contract'
import { keepLimits, limitsMoved, readLimits } from '../src/core/limits.ts'

const NOW = Date.UTC(2026, 9, 21, 14, 30, 0)
const RESET = '2026-10-21T18:00:00Z'

const session = (percentUsed: number, at = NOW): UsageLimit => ({ kind: 'session', percentUsed, resetsAt: NOW + 1000, at })
const week = (percentUsed: number, at = NOW): UsageLimit => ({ kind: 'week', percentUsed, resetsAt: NOW + 2000, at })

describe('readLimits', () => {
  it('reads the five-hour window as the session\'s limit and the seven-day window as the week\'s', () => {
    const read = readLimits(
      [
        { kind: 'seven_day', percentUsed: 61.4, resetsAt: '2026-10-24T09:00:00Z' },
        { kind: 'five_hour', percentUsed: 42, resetsAt: RESET },
      ],
      NOW,
    )
    expect(read).toEqual([
      { kind: 'session', percentUsed: 42, resetsAt: Date.parse(RESET), at: NOW },
      { kind: 'week', percentUsed: 61.4, resetsAt: Date.parse('2026-10-24T09:00:00Z'), at: NOW },
    ])
  })

  it('leaves out a window that is neither, such as a gateway\'s spend limit', () => {
    expect(readLimits([{ kind: 'spend_limit', percentUsed: 120 }, { kind: 'monthly', percentUsed: 5 }], NOW)).toEqual([])
  })

  it('takes a window whose name begins with the engine\'s when the exact one is missing', () => {
    const read = readLimits([{ kind: 'seven_day_opus', percentUsed: 30, resetsAt: RESET }], NOW)
    expect(read.map((limit) => [limit.kind, limit.percentUsed])).toEqual([['week', 30]])
  })

  it('prefers the window with the exact name', () => {
    const read = readLimits(
      [
        { kind: 'seven_day_opus', percentUsed: 30 },
        { kind: 'seven_day', percentUsed: 55 },
      ],
      NOW,
    )
    expect(read.map((limit) => limit.percentUsed)).toEqual([55])
  })

  it('reads the reset time in ms, and null when there is none or it is not a time', () => {
    const read = readLimits(
      [
        { kind: 'five_hour', percentUsed: 1, resetsAt: RESET },
        { kind: 'seven_day', percentUsed: 2 },
      ],
      NOW,
    )
    expect(read.map((limit) => limit.resetsAt)).toEqual([Date.parse(RESET), null])
    const odd = readLimits([{ kind: 'five_hour', percentUsed: 1, resetsAt: 'soon' }], NOW)
    expect(odd[0]?.resetsAt).toBeNull()
  })

  it('stamps each limit with the time it was read', () => {
    const read = readLimits(
      [
        { kind: 'five_hour', percentUsed: 1 },
        { kind: 'seven_day', percentUsed: 2 },
      ],
      NOW + 77,
    )
    expect(read.map((limit) => limit.at)).toEqual([NOW + 77, NOW + 77])
  })

  it('reads nothing from a report that is not a list, and skips entries that are not windows', () => {
    expect(readLimits(undefined, NOW)).toEqual([])
    expect(readLimits({ kind: 'five_hour', percentUsed: 1 }, NOW)).toEqual([])
    const read = readLimits(
      [null, 'x', { kind: 'five_hour' }, { kind: 'five_hour', percentUsed: '9' }, { kind: 5, percentUsed: 9 }, { kind: 'seven_day', percentUsed: 3 }],
      NOW,
    )
    expect(read.map((limit) => [limit.kind, limit.percentUsed])).toEqual([['week', 3]])
  })
})

describe('keepLimits', () => {
  it('replaces the kept limit of each kind the reading holds', () => {
    expect(keepLimits([session(10), week(20)], [session(11, NOW + 1), week(21, NOW + 1)])).toEqual([session(11, NOW + 1), week(21, NOW + 1)])
  })

  it('keeps a limit the reading leaves out', () => {
    expect(keepLimits([session(10), week(20)], [week(21, NOW + 1)])).toEqual([session(10), week(21, NOW + 1)])
  })

  it('orders the session\'s limit before the week\'s', () => {
    expect(keepLimits([], [week(20), session(10)]).map((limit) => limit.kind)).toEqual(['session', 'week'])
    expect(keepLimits([week(20)], [session(10)]).map((limit) => limit.kind)).toEqual(['session', 'week'])
  })
})

describe('limitsMoved', () => {
  it('tells a share used or a reset time that moved', () => {
    expect(limitsMoved([session(10), week(20)], [session(11), week(20)])).toBe(true)
    expect(limitsMoved([session(10), week(20)], [session(10), { ...week(20), resetsAt: NOW + 9000 }])).toBe(true)
  })

  it('tells a limit that came or went', () => {
    expect(limitsMoved([], [session(10)])).toBe(true)
    expect(limitsMoved([session(10), week(20)], [session(10)])).toBe(true)
    expect(limitsMoved([session(10)], [week(20)])).toBe(true)
  })

  it('ignores a reading that moved only the time it was read', () => {
    expect(limitsMoved([session(10), week(20)], [session(10, NOW + 5000), week(20, NOW + 5000)])).toBe(false)
    expect(limitsMoved([], [])).toBe(false)
  })
})
