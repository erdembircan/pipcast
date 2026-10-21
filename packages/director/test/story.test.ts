import { describe, expect, it } from 'vitest'

import type { Snapshot } from '@pipcast/contract'

import { movedOn, storySegment } from '../src/story.ts'
import { session, story, T0 } from './helpers.ts'

function snap(...sessions: ReturnType<typeof session>[]): Snapshot {
  return { now: T0, visible: true, sessions, lastReportAt: null }
}

describe('movedOn', () => {
  const asked = story('a:1', 'needs-input', T0)

  it('is true when the session is no longer on air', () => {
    expect(movedOn(snap(), 'a', asked)).toBe(true)
    expect(movedOn(null, 'a', asked)).toBe(true)
  })

  it('holds a needs-input story while the session still waits on it', () => {
    const waiting = session('a', { state: 'needs-input', stories: [asked] })
    expect(movedOn(snap(waiting), 'a', asked)).toBe(false)
    expect(movedOn(snap(session('a', { state: 'working', stories: [asked] })), 'a', asked)).toBe(true)
  })

  it('is true when the session waits on another needs-input story', () => {
    const newer = story('a:2', 'needs-input', T0 + 5000)
    expect(movedOn(snap(session('a', { state: 'needs-input', stories: [asked, newer] })), 'a', asked)).toBe(true)
    expect(movedOn(snap(session('a', { state: 'needs-input', stories: [asked, newer] })), 'a', newer)).toBe(false)
  })

  it('treats an error story the same way', () => {
    const failed = story('a:1', 'error', T0)
    expect(movedOn(snap(session('a', { state: 'error', stories: [failed] })), 'a', failed)).toBe(false)
    expect(movedOn(snap(session('a', { state: 'working', stories: [failed] })), 'a', failed)).toBe(true)
  })

  it('holds a ready or complete story until a newer story or a new turn', () => {
    const done = story('a:1', 'ready', T0)
    expect(movedOn(snap(session('a', { state: 'ready', stateAt: T0, stories: [done] })), 'a', done)).toBe(false)
    const newer = story('a:2', 'needs-input', T0 + 1000)
    expect(movedOn(snap(session('a', { state: 'needs-input', stories: [done, newer] })), 'a', done)).toBe(true)
    expect(movedOn(snap(session('a', { state: 'working', stateAt: T0 + 500, stories: [done] })), 'a', done)).toBe(true)
    expect(movedOn(snap(session('a', { state: 'working', stateAt: T0 - 500, stories: [done] })), 'a', done)).toBe(false)

    const complete = story('a:1', 'complete', T0)
    expect(movedOn(snap(session('a', { state: 'ready', stateAt: T0, stories: [complete] })), 'a', complete)).toBe(false)
  })

  it('is true when the story has left the session record', () => {
    expect(movedOn(snap(session('a', { state: 'ready', stories: [] })), 'a', story('a:1', 'ready', T0))).toBe(true)
  })
})

describe('storySegment', () => {
  const one = snap(session('a', { title: 'Fix it', project: 'shop' }))

  it('builds the three steps with their cues', () => {
    const { id, steps, endCue } = storySegment('a', story('a:1', 'complete', T0), one, false)
    expect(id).toBe('story:a:1')
    expect(steps.map((step) => [step.role, step.length, step.cue])).toEqual([
      ['opener', 1900, 'breaking'],
      ['desk', 10_000, undefined],
      ['outro', 1400, 'breaking-out'],
    ])
    expect(endCue).toBeUndefined()
  })

  it('leaves the outro out in reduced motion and cues it at the end', () => {
    const { steps, endCue } = storySegment('a', story('a:1', 'complete', T0), one, true)
    expect(steps.map((step) => [step.role, step.length])).toEqual([
      ['opener', 1000],
      ['desk', 10_000],
    ])
    expect(endCue).toBe('breaking-out')
  })

  it('says Finished when Claude had no last words, and leaves the foot out without a duration', () => {
    const { steps } = storySegment('a', story('a:1', 'complete', T0), one, false)
    const scene = steps[1]?.scene({ now: T0, ticker: [], board: { mode: 'board' } })
    expect(scene?.event).toEqual({ kind: 'complete', session: 'Fix it', project: 'shop', quote: 'Finished' })
  })

  it('shows an error in words and the changes of a ready story', () => {
    const failed = storySegment('a', story('a:1', 'error', T0, { durationMs: 90_000 }), one, false).steps[1]
    expect(failed?.scene({ now: T0, ticker: [], board: { mode: 'board' } }).event).toMatchObject({
      quote: 'Claude stopped on an error.',
      foot: 'Stopped after 1 min',
    })
    const ready = storySegment('a', story('a:2', 'ready', T0, { added: 1546, removed: 368, files: 1 }), one, false).steps[1]
    expect(ready?.scene({ now: T0, ticker: [], board: { mode: 'board' } }).event).toMatchObject({
      figure: '+1,546 −368',
      sub: '1 file changed',
    })
  })
})
