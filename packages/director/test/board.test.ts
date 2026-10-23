import { describe, expect, it } from 'vitest'

import type { Snapshot } from '@pipcast/contract'
import type { TickerItem } from '@pipcast/design'

import { boardScene, boardTicker } from '../src/board.ts'
import type { BoardState } from '../src/types.ts'
import { at, session, story, T0 } from './helpers.ts'

const empty: BoardState = {
  queue: [],
  carried: new Map(),
  onAirStoryId: null,
  lastReport: null,
  reportEndedAt: null,
}

function snap(...sessions: ReturnType<typeof session>[]): Snapshot {
  return { now: T0, visible: true, sessions, lastReportAt: null }
}

function text(items: TickerItem[]): string[] {
  return items.map((item) =>
    typeof item === 'string' ? item : item.lead === undefined ? item.text : `${item.lead} ${item.text}`,
  )
}

function keys(items: TickerItem[]): (string | undefined)[] {
  return items.map((item) => (typeof item === 'string' ? undefined : item.key))
}

describe('the board scene', () => {
  it('lists the sessions in the snapshot order, unsorted', () => {
    const scene = boardScene(
      T0,
      snap(session('b', { state: 'ready' }), session('a', { state: 'needs-input' })),
      empty,
    )
    expect(scene.sessions?.map((row) => row.id)).toEqual(['b', 'a'])
    expect(scene.clock).toBe('14:30')
  })

  it('puts every session on the board, more than four included', () => {
    const ids = ['g', 'a', 'f', 'b', 'e', 'c', 'd']
    const scene = boardScene(T0, snap(...ids.map((id) => session(id))), empty)
    expect(scene.sessions).toHaveLength(7)
    expect(scene.sessions?.map((row) => row.id)).toEqual(ids)
  })
})

describe('the ticker', () => {
  it('leads with what waits, then what aired, then what still needs you', () => {
    const waiting = story('w:1', 'needs-input', T0 - 27 * 60_000)
    const failed = story('e:1', 'error', T0 - 5 * 60_000)
    const finished = story('r:1', 'ready', T0 - 3 * 60_000)
    const aired = story('b:1', 'complete', T0 - 20_000)
    const snapshot = snap(
      session('w', { state: 'needs-input', stateAt: waiting.at, stories: [waiting] }),
      session('e', { state: 'error', stateAt: failed.at, stories: [failed] }),
      session('r', { state: 'ready', stateAt: finished.at, stories: [finished] }),
      session('b', { state: 'ready', stateAt: aired.at, stories: [aired] }),
    )
    const state: BoardState = {
      ...empty,
      queue: [{ kind: 'hour', hour: at(15) }],
      carried: new Map([['b:1', { endedAt: T0 - 10_000, kind: 'complete', sessionId: 'b' }]]),
      lastReport: { hour: at(14), stories: 3 },
      reportEndedAt: T0 - 60_000,
    }
    expect(text(boardTicker(T0, snapshot, state))).toEqual([
      'COMING UP The 15:00 report',
      'BREAKING Title b: work complete',
      'STILL WAITING Title w needs your input · 27 min',
      'STILL WAITING Title e stopped on an error · 5 min',
      'READY Title r waiting for review',
      'ON THE DESK 4 sessions on KLWD',
    ])
  })

  it('keys every line by what it is about', () => {
    const waiting = story('w:1', 'needs-input', T0 - 27 * 60_000)
    const failed = story('e:1', 'error', T0 - 5 * 60_000)
    const finished = story('r:1', 'ready', T0 - 3 * 60_000)
    const aired = story('b:1', 'complete', T0 - 20_000)
    const snapshot = snap(
      session('w', { state: 'needs-input', stateAt: waiting.at, stories: [waiting] }),
      session('e', { state: 'error', stateAt: failed.at, stories: [failed] }),
      session('r', { state: 'ready', stateAt: finished.at, stories: [finished] }),
      session('b', { state: 'ready', stateAt: aired.at, stories: [aired] }),
    )
    const state: BoardState = {
      ...empty,
      queue: [{ kind: 'hour', hour: at(15) }],
      carried: new Map([['b:1', { endedAt: T0 - 10_000, kind: 'complete', sessionId: 'b' }]]),
      lastReport: { hour: at(14), stories: 3 },
      reportEndedAt: T0 - 60_000,
    }
    expect(keys(boardTicker(T0, snapshot, state))).toEqual([
      `coming:hour:${at(15)}`,
      'breaking:b:1',
      'waiting:w:1',
      'waiting:e:1',
      'ready:r:1',
      'desk',
    ])
  })

  it("keeps a working session's key when what it is doing changes", () => {
    const before = boardTicker(
      T0,
      snap(session('a', { activity: [{ at: T0 - 3000, text: 'editing a.ts' }] })),
      empty,
    )
    const after = boardTicker(
      T0 + 1000,
      snap(session('a', { activity: [{ at: T0 + 500, text: 'reading b.ts' }] })),
      empty,
    )
    expect(before).toMatchObject([{ key: 'desk' }, { key: 'activity:a' }])
    expect(after).toMatchObject([{ key: 'desk' }, { key: 'activity:a' }])
    expect(text(after)[1]).toBe('project-a: reading b.ts')
  })

  it('keeps at most six items and always the ON THE DESK line', () => {
    const sessions = ['a', 'b', 'c', 'd'].map((id) => {
      const waiting = story(`${id}:1`, 'needs-input', T0 - 60_000)
      return session(id, { state: 'needs-input', stateAt: waiting.at, stories: [waiting] })
    })
    const state: BoardState = {
      ...empty,
      queue: [{ kind: 'hour', hour: at(15) }],
      carried: new Map([['a:1', { endedAt: T0 - 1000, kind: 'needs-input', sessionId: 'a' }]]),
    }
    const items = text(boardTicker(T0, snap(...sessions), state))
    expect(items).toHaveLength(6)
    expect(items.at(-1)).toBe('ON THE DESK 4 sessions on KLWD')
  })

  it('keys every line once', () => {
    const sessions = ['a', 'b', 'c', 'd'].map((id) => {
      const waiting = story(`${id}:1`, 'needs-input', T0 - 60_000)
      return session(id, { state: 'needs-input', stateAt: waiting.at, stories: [waiting] })
    })
    const state: BoardState = {
      ...empty,
      queue: [{ kind: 'hour', hour: at(15) }],
      carried: new Map([['a:1', { endedAt: T0 - 1000, kind: 'needs-input', sessionId: 'a' }]]),
    }
    const found = keys(boardTicker(T0, snap(...sessions), state))
    expect(found.every((key) => key !== undefined)).toBe(true)
    expect(new Set(found).size).toBe(found.length)
  })

  it('counts the working sessions and lists their newest activity first', () => {
    const items = text(
      boardTicker(
        T0,
        snap(
          session('a', { activity: [{ at: T0 - 9000, text: 'old' }, { at: T0 - 3000, text: 'editing a.ts' }] }),
          session('b', { activity: [{ at: T0 - 1000, text: 'reading b.ts' }] }),
          session('c', { activity: [] }),
        ),
        empty,
      ),
    )
    expect(items).toEqual([
      'ON THE DESK 3 sessions working',
      'project-b: reading b.ts',
      'project-a: editing a.ts',
    ])
  })

  it('does not call a queued or airing story READY', () => {
    const done = story('a:1', 'ready', T0)
    const snapshot = snap(session('a', { state: 'ready', stateAt: T0, stories: [done] }))
    const queued = boardTicker(T0, snapshot, { ...empty, queue: [{ kind: 'story', sessionId: 'a', story: done }] })
    expect(text(queued)).toContain('COMING UP Title a ready for review')
    expect(text(queued).some((line) => line.startsWith('READY'))).toBe(false)
    const airing = boardTicker(T0, snapshot, { ...empty, onAirStoryId: 'a:1' })
    expect(text(airing).some((line) => line.startsWith('READY'))).toBe(false)
  })

  it('shows ON THE HOUR for ten minutes after a report aired', () => {
    const state: BoardState = { ...empty, lastReport: { hour: at(15), stories: 1 }, reportEndedAt: T0 }
    const snapshot = snap(session('a'))
    expect(text(boardTicker(T0 + 599_000, snapshot, state))[0]).toBe('ON THE HOUR 1 story at 15:00 · next report 16:00')
    expect(text(boardTicker(T0 + 600_000, snapshot, state))[0]).toBe('ON THE DESK 1 session working')
  })
})
