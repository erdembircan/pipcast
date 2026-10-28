import { describe, expect, it } from 'vitest'

import type { StoryKind } from '../../contract/src/types.ts'

import { STATE_AFTER } from '../src/cue.ts'
import { hourSessions, land, overlay } from '../src/world.ts'

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
