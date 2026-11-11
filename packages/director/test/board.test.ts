import { describe, expect, it } from 'vitest'

import type { Snapshot } from '@pipcast/contract'
import type { TickerItem } from '@pipcast/design'

import { boardScene, boardTicker } from '../src/board.ts'
import type { Forecast } from '../src/forecast.ts'
import type { BoardState } from '../src/types.ts'
import { at, session, story, T0 } from './helpers.ts'

const empty: BoardState = {
  queue: [],
  carried: new Map(),
  onAirStoryId: null,
  lastReport: null,
  reportEndedAt: null,
  forecast: null,
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
  it("lists the sessions in the listing's order", () => {
    const scene = boardScene(
      T0,
      snap(
        session('working', { state: 'working', stateAt: at(14, 25) }),
        session('finished-early', { state: 'ready', stateAt: at(14, 0) }),
        session('finished-late', { state: 'ready', stateAt: at(14, 20) }),
        session('asking', { state: 'needs-input', stateAt: at(14, 10) }),
      ),
      empty,
    )
    expect(scene.sessions?.map((row) => row.id)).toEqual(['asking', 'finished-late', 'finished-early', 'working'])
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

describe('the forecast in the ticker', () => {
  const forecast = (outlook: Forecast['outlook'], rest: Partial<Forecast> = {}): Forecast => ({
    computedAt: T0,
    resetsAt: Date.UTC(2026, 9, 24, 18, 0),
    outlook,
    startsAt: null,
    used: 48,
    end: 86,
    chance: 0.1,
    runsOutAt: null,
    days: [],
    ...rest,
  })
  const storm = forecast('storm', { used: 72, end: 112, chance: 0.8, runsOutAt: Date.UTC(2026, 9, 24, 5, 10) })
  const waiting = story('w:1', 'needs-input', T0 - 27 * 60_000)
  const sessions = [session('a', { state: 'working' }), session('w', { state: 'needs-input', stateAt: waiting.at, stories: [waiting] })]

  it('puts a FORECAST line right after ON THE DESK, under the sky the week ends in', () => {
    const items = boardTicker(T0, snap(...sessions), { ...empty, forecast: forecast('clouds') })
    expect(text(items)).toEqual([
      'STILL WAITING Title w needs your input · 27 min',
      'ON THE DESK 1 session working',
      'FORECAST Clouds gathering: the week ends near 86%, resets Sat 18:00',
    ])
    expect(items[2]).toMatchObject({ key: 'forecast', sky: 'partly' })
    const clear = boardTicker(T0, snap(...sessions), { ...empty, forecast: forecast('clear', { end: 55 }) })
    expect(text(clear)[2]).toBe('FORECAST Clear skies: the week ends near 55%, resets Sat 18:00')
    expect(clear[2]).toMatchObject({ sky: 'sun' })
  })

  it('never says the week ends at 100%', () => {
    const items = boardTicker(T0, snap(...sessions), { ...empty, forecast: forecast('clouds', { end: 99.7 }) })
    expect(text(items)[2]).toContain('ends near 99%')
    expect(items[2]).toMatchObject({ sky: 'overcast' })
  })

  it('says when the outlook starts in the week’s first day', () => {
    const items = boardTicker(T0, snap(...sessions), { ...empty, forecast: forecast('early', { startsAt: Date.UTC(2026, 9, 22, 18, 0) }) })
    expect(text(items)[2]).toBe('FORECAST The week’s outlook starts Thu 18:00')
    expect(items[2]).not.toHaveProperty('sky')
  })

  it('leads with the STORM WARNING line, and has no FORECAST line', () => {
    const items = boardTicker(T0, snap(...sessions), { ...empty, forecast: storm })
    expect(text(items)).toEqual([
      'STORM WARNING in effect until Sat 18:00: at this pace the week runs out Sat around 05:00',
      'STILL WAITING Title w needs your input · 27 min',
      'ON THE DESK 1 session working',
    ])
    expect(keys(items)[0]).toBe('warning')
  })

  it('keeps the crawl to six lines', () => {
    const many = Array.from({ length: 8 }, (_, i) => session(`s${i}`, { state: 'working', activity: [{ at: T0 - i, text: `edit ${i}` }] }))
    const needs = Array.from({ length: 6 }, (_, i) => {
      const entry = story(`n${i}:1`, 'needs-input', T0 - (i + 1) * 60_000)
      return session(`n${i}`, { state: 'needs-input', stateAt: entry.at, stories: [entry] })
    })
    for (const held of [forecast('clouds'), storm, null]) {
      const items = boardTicker(T0, snap(...many, ...needs), { ...empty, forecast: held })
      expect(items.length).toBe(6)
      expect(items.some((item) => typeof item !== 'string' && item.key === 'desk')).toBe(true)
    }
  })

  it('leaves the crawl’s tab as it is while a storm holds, as at any other time', () => {
    expect(boardScene(T0, snap(...sessions), { ...empty, forecast: storm }).tickerLabel).toBeUndefined()
    expect(boardScene(T0, snap(...sessions), { ...empty, forecast: forecast('clouds') }).tickerLabel).toBeUndefined()
    expect(boardScene(T0, snap(...sessions), empty).tickerLabel).toBeUndefined()
  })
})

describe('a week that is used up in the ticker', () => {
  const out: Forecast = {
    computedAt: T0,
    resetsAt: Date.UTC(2026, 9, 24, 18, 0),
    outlook: 'out',
    startsAt: null,
    used: 100,
    end: 100,
    chance: 1,
    runsOutAt: null,
    days: [],
  }
  const sessions = [session('a', { state: 'working' })]

  it('says so after ON THE DESK, under a storm’s sky, with no STORM WARNING lead', () => {
    const items = boardTicker(T0, snap(...sessions), { ...empty, forecast: out })
    expect(text(items)).toEqual(['ON THE DESK 1 session working', 'FORECAST The week is used up until it resets Sat 18:00'])
    expect(items[1]).toEqual({ lead: 'FORECAST', text: 'The week is used up until it resets Sat 18:00', key: 'forecast', sky: 'storm' })
    expect(text(items).some((line) => line.startsWith('STORM WARNING'))).toBe(false)
  })

  it('leaves the crawl’s tab as it is', () => {
    expect(boardScene(T0, snap(...sessions), { ...empty, forecast: out }).tickerLabel).toBeUndefined()
  })
})
