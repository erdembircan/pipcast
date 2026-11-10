import { describe, expect, it } from 'vitest'

import type { StoryKind } from '../../contract/src/types.ts'

import { STATE_AFTER } from '../src/cue.ts'
import { forecastWeek } from '../../director/src/forecast.ts'
import { hourSessions, land, overlay, syntheticWeek } from '../src/world.ts'

import { DEFAULTS, at, session } from './helpers.ts'

const NOW = at(14, 30)
const MINUTE = 60_000
const KINDS: StoryKind[] = ['needs-input', 'ready', 'complete', 'error']

describe('land', () => {
  it.each(KINDS)('makes a session of its own for a %s story', (kind) => {
    const landed = land('c1', 0, { kind }, DEFAULTS, NOW)
    const sample = DEFAULTS.stories[kind]
    expect(landed.id).toBe('dev-c1-0')
    expect(landed.title).toBe(sample.title)
    expect(landed.project).toBe(sample.project)
    expect(landed.state).toBe(STATE_AFTER[kind])
    expect(landed.stories).toHaveLength(1)
    expect(landed.stories[0]?.id).toBe('dev-c1-0:1')
    expect(landed.stateAt).toBe(landed.stories[0]?.at)
    expect(landed.tunedInAt).toBe(NOW)
    expect(landed.checkedInAt).toBe(NOW)
    expect(landed.activity).toEqual([])
    expect(landed.hours).toEqual([])
    expect('limits' in landed).toBe(false)
  })

  it('numbers the session by the story it is for', () => {
    expect(land('c1', 3, { kind: 'ready' }, DEFAULTS, NOW).id).toBe('dev-c1-3')
  })

  it('asks as the sample does for a story that needs input, unless the cue says otherwise', () => {
    const story = land('c1', 0, { kind: 'needs-input' }, DEFAULTS, NOW).stories[0]
    expect(story).toMatchObject({ command: 'npm install', quote: 'Install dependencies', at: NOW })
    const own = land('c1', 0, { kind: 'needs-input', quote: 'Why?' }, DEFAULTS, NOW).stories[0]
    expect(own?.quote).toBe('Why?')
    expect(own?.command).toBeUndefined()
    const waited = land('c1', 0, { kind: 'needs-input', minutes: 3 }, DEFAULTS, NOW).stories[0]
    expect(waited?.at).toBe(NOW - 3 * MINUTE)
  })

  it('shows the sample figures for a ready story, and the cue’s own when it gives them', () => {
    const story = land('c1', 0, { kind: 'ready' }, DEFAULTS, NOW).stories[0]
    expect(story).toMatchObject({ added: 182, removed: 40, files: 4, durationMs: 9 * MINUTE })
    const own = land('c1', 0, { kind: 'ready', added: 5, removed: 1, files: 2, minutes: 2 }, DEFAULTS, NOW).stories[0]
    expect(own).toMatchObject({ added: 5, removed: 1, files: 2, durationMs: 2 * MINUTE })
  })

  it('takes the sample’s last words for a story that completes, and its error for one that stops', () => {
    const complete = land('c1', 0, { kind: 'complete' }, DEFAULTS, NOW).stories[0]
    expect(complete).toMatchObject({ quote: DEFAULTS.stories.complete.quote, durationMs: 6 * MINUTE })
    const error = land('c1', 0, { kind: 'error' }, DEFAULTS, NOW).stories[0]
    expect(error).toMatchObject({ quote: DEFAULTS.stories.error.quote, durationMs: 31 * MINUTE })
  })

  it('cuts text as the mod cuts it', () => {
    const command = land('c1', 0, { kind: 'needs-input', command: 'c'.repeat(70) }, DEFAULTS, NOW).stories[0]
    expect(command?.command).toBe(`${'c'.repeat(59)}…`)
    expect(command?.command).toHaveLength(60)
    const question = land('c1', 0, { kind: 'needs-input', quote: 'q'.repeat(250) }, DEFAULTS, NOW).stories[0]
    expect(question?.quote).toHaveLength(200)
    const words = land('c1', 0, { kind: 'complete', quote: 'w'.repeat(100) }, DEFAULTS, NOW).stories[0]
    expect(words?.quote).toHaveLength(72)
    expect(words?.quote?.endsWith('…')).toBe(true)
  })
})

describe('overlay', () => {
  it('keeps the session on air and takes the story’s state and story', () => {
    const onAir = session('a', {
      title: 'Mine',
      project: 'mine',
      activity: [{ at: 1, text: 'Editing a file' }],
      hours: [{ hour: '2026-10-21T14', added: 1, removed: 2, files: 3 }],
      tunedInAt: 5,
      checkedInAt: 6,
    })
    const landed = land('c1', 0, { kind: 'needs-input' }, DEFAULTS, NOW)
    const overlaid = overlay(onAir, landed)
    expect(overlaid).toEqual({
      ...onAir,
      state: 'needs-input',
      stateAt: landed.stateAt,
      stories: landed.stories,
    })
    expect(overlaid.id).toBe('a')
    expect(overlaid.title).toBe('Mine')
    expect(overlaid.project).toBe('mine')
    expect(overlaid.activity).toBe(onAir.activity)
    expect(overlaid.hours).toBe(onAir.hours)
    expect(overlaid.tunedInAt).toBe(5)
    expect(overlaid.checkedInAt).toBe(6)
  })
})

describe('hourSessions', () => {
  it('is null for a cue that covers the sessions on air', () => {
    expect(hourSessions({ id: 'h', segment: 'hour' }, DEFAULTS, NOW)).toBeNull()
  })

  it('makes the design system’s first sessions for samples', () => {
    const made = hourSessions({ id: 'h', segment: 'hour', samples: 3 }, DEFAULTS, NOW)
    expect(made?.map((one) => one.title)).toEqual(DEFAULTS.sessions.slice(0, 3).map((one) => one.title))
    expect(made?.map((one) => one.state)).toEqual(['needs-input', 'ready', 'working'])
    expect(made?.[0]?.stories).toEqual([{ id: 'dev-h-0:1', kind: 'needs-input', at: at(14, 3) }])
    expect(made?.[0]?.hours).toEqual([])
    expect(made?.[1]?.hours).toEqual([{ hour: '2026-10-21T14', added: 182, removed: 40, files: 4 }])
    expect(made?.[2]?.hours).toEqual([{ hour: '2026-10-21T14', added: 1204, removed: 310, files: 9 }])
    expect(made?.[2]?.stories).toEqual([])
  })

  it('takes a wait back to the start of the hour at most', () => {
    const made = hourSessions({ id: 'h', segment: 'hour', samples: 1 }, DEFAULTS, at(14, 10))
    expect(made?.[0]?.stories[0]?.at).toBe(at(14))
    expect(made?.[0]?.stateAt).toBe(at(14))
  })

  it('makes a quiet hour of sessions that are working and have no story, with their lines', () => {
    const made = hourSessions({ id: 'h', segment: 'hour', samples: 3, quiet: true }, DEFAULTS, NOW)
    expect(made?.map((one) => one.state)).toEqual(['working', 'working', 'working'])
    expect(made?.map((one) => one.stories)).toEqual([[], [], []])
    expect(made?.[1]?.hours).toEqual([{ hour: '2026-10-21T14', added: 182, removed: 40, files: 4 }])
  })

  it('names a session without a title by its place in the design system’s list', () => {
    const made = hourSessions(
      { id: 'h', segment: 'hour', sessions: [{ added: 1 }, { title: 'Mine', project: 'mine' }, {}] },
      DEFAULTS,
      NOW,
    )
    expect(made?.map((one) => [one.title, one.project])).toEqual([
      [DEFAULTS.sessions[0]?.title, DEFAULTS.sessions[0]?.project],
      ['Mine', 'mine'],
      [DEFAULTS.sessions[2]?.title, DEFAULTS.sessions[2]?.project],
    ])
  })

  it('tunes each session in a little after the one before', () => {
    const made = hourSessions({ id: 'h', segment: 'hour', samples: 4 }, DEFAULTS, NOW) ?? []
    const tunedIn = made.map((one) => one.tunedInAt)
    expect(tunedIn).toEqual([...tunedIn].sort((a, b) => a - b))
    expect(new Set(tunedIn).size).toBe(4)
  })
})

describe('syntheticWeek', () => {
  const HOUR = 3_600_000
  // Fri 13 Nov 2026, 15:12, local
  const now = new Date(2026, 10, 13, 15, 12).getTime()
  const forecastOf = (outlook: 'clear' | 'clouds' | 'storm', used?: number, at = now) => {
    const { memory, reading } = syntheticWeek(outlook, used, at)
    return forecastWeek({ resetsAt: memory.resetsAt as number, points: memory.points }, reading.percentUsed, at)
  }

  it.each([
    ['clear', 36, 55],
    ['clouds', 48, 86],
    ['storm', 72, 130],
  ] as const)('makes a week of %s skies: %i%% used by default, ending near %i%%', (outlook, used, target) => {
    const week = syntheticWeek(outlook, undefined, now)
    expect(week.reading).toEqual({ kind: 'week', percentUsed: used, resetsAt: week.memory.resetsAt, at: now })
    const forecast = forecastOf(outlook)
    expect(forecast?.outlook).toBe(outlook)
    expect(Math.abs((forecast?.end ?? 0) - target)).toBeLessThan(6)
  })

  it('gives each outlook at every hour of the day', () => {
    for (let step = 0; step < 24 * 4; step += 1) {
      const at = new Date(2026, 10, 12, 0, 0).getTime() + step * 15 * 60_000
      expect(forecastOf('clear', undefined, at)?.outlook).toBe('clear')
      expect(forecastOf('clouds', undefined, at)?.outlook).toBe('clouds')
      expect(forecastOf('storm', undefined, at)?.outlook).toBe('storm')
    }
  })

  it('puts the week as far along as its share is of the end it aims at, to the hour', () => {
    const { memory } = syntheticWeek('storm', undefined, now)
    // 72 / 130 of 168 h is 93 h
    expect((memory.resetsAt as number) - now).toBe(168 * HOUR - 93 * HOUR)
    // A small share is a fifth of the week at least, and never under 30 hours
    expect((syntheticWeek('storm', 5, now).memory.resetsAt as number) - now).toBe(168 * HOUR - 34 * HOUR)
    expect((syntheticWeek('clear', 1, now).memory.resetsAt as number) - now).toBe(168 * HOUR - 34 * HOUR)
    // A share past the target is nine tenths of the week at most
    expect((syntheticWeek('clear', 99, now).memory.resetsAt as number) - now).toBe(168 * HOUR - 151 * HOUR)
  })

  it('has a point every quarter hour from the week’s start, the last at the share used', () => {
    const { memory, reading } = syntheticWeek('clouds', 60, now)
    const start = (memory.resetsAt as number) - 168 * HOUR
    const times = memory.points.map(([at]) => at)
    expect(times[0]).toBe(start + 15 * MINUTE)
    expect(times[times.length - 1]).toBeLessThanOrEqual(now)
    expect(now - (times[times.length - 1] as number)).toBeLessThan(15 * MINUTE)
    times.slice(1).forEach((at, index) => expect(at - (times[index] as number)).toBe(15 * MINUTE))
    expect(memory.points[memory.points.length - 1]?.[1]).toBe(60)
    expect(reading.percentUsed).toBe(60)
    expect(memory.points.every(([, percent]) => percent * 10 === Math.round(percent * 10))).toBe(true)
    expect(memory.warnedAt).toBeNull()
  })

  it('rises evenly through 09:00 to 21:00 each day and stands still otherwise', () => {
    const { memory } = syntheticWeek('storm', undefined, now)
    let rose = 0
    let stood = 0
    for (let i = 1; i < memory.points.length; i += 1) {
      const [at, percent] = memory.points[i] as [number, number]
      const before = (memory.points[i - 1] as [number, number])[1]
      const hour = new Date(at - 15 * MINUTE).getHours()
      if (hour >= 9 && hour < 21) {
        expect(percent).toBeGreaterThanOrEqual(before)
        rose += 1
      } else {
        expect(percent).toBe(before)
        stood += 1
      }
    }
    expect(rose).toBeGreaterThan(0)
    expect(stood).toBeGreaterThan(0)
  })
})
