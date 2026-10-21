import { describe, expect, it } from 'vitest'

import { ERROR_WORDS, MAX_ACTIVITY, MAX_HOURS, MAX_STORIES, hourKey } from '@pipcast/contract'
import * as m from '../../plugin/src/core/model.ts'

const T = Date.UTC(2026, 9, 21, 14, 30, 0)
const none = { added: 0, removed: 0, files: 0 }

const fresh = () => m.newModel('abc', 'proj', 'Title', T)
const working = () => m.turnStarted(fresh(), T + 1000, 't1')

describe('newModel', () => {
  it('starts ready, empty and not yet written', () => {
    const model = fresh()
    expect(model.record).toEqual({
      v: 1,
      id: 'abc',
      title: 'Title',
      project: 'proj',
      state: 'ready',
      stateAt: T,
      tunedInAt: 0,
      checkedInAt: 0,
      stories: [],
      activity: [],
      hours: [],
    })
    expect(model.seq).toBe(0)
    expect(model.turn.ended).toBe(true)
    expect(model.titleFromHook).toBe(false)
  })
})

describe('turnStarted', () => {
  it('makes the session working and starts a fresh turn', () => {
    const model = working()
    expect(model.record.state).toBe('working')
    expect(model.record.stateAt).toBe(T + 1000)
    expect(model.turn).toMatchObject({ id: 't1', startedAt: T + 1000, baseline: null, ended: false })
    expect(model.turn.edits.files.size).toBe(0)
  })

  it('leaves stateAt alone when the state does not change', () => {
    const once = working()
    const twice = m.turnStarted(once, T + 9000, 't2')
    expect(twice.record.stateAt).toBe(T + 1000)
    expect(twice.turn.id).toBe('t2')
    expect(twice.turn.startedAt).toBe(T + 9000)
  })

  it('does not change the model it was given', () => {
    const before = fresh()
    m.turnStarted(before, T + 1, 't')
    expect(before.record.state).toBe('ready')
  })
})

describe('activity', () => {
  it('adds a line and keeps the newest three, oldest first', () => {
    let model = working()
    for (let i = 1; i <= 5; i += 1) {
      model = m.activity(model, T + i, `line ${i}`)
    }
    expect(model.record.activity).toHaveLength(MAX_ACTIVITY)
    expect(model.record.activity.map((line) => line.text)).toEqual(['line 3', 'line 4', 'line 5'])
    expect(model.record.activity[2]?.at).toBe(T + 5)
    expect(model.record.state).toBe('working')
  })
})

describe('askedQuestion', () => {
  it('lands a needs-input story with the question', () => {
    const model = m.askedQuestion(working(), T + 2000, 'Which one?')
    expect(model.record.state).toBe('needs-input')
    expect(model.record.stateAt).toBe(T + 2000)
    expect(model.record.stories).toEqual([{ id: 'abc:1', kind: 'needs-input', at: T + 2000, quote: 'Which one?' }])
    expect(model.seq).toBe(1)
  })
})

describe('askedPermission', () => {
  it('lands a needs-input story with the command and the quote', () => {
    const model = m.askedPermission(working(), T + 2000, 'rm -rf build', 'Remove the build')
    expect(model.record.state).toBe('needs-input')
    expect(model.record.stories[0]).toEqual({
      id: 'abc:1',
      kind: 'needs-input',
      at: T + 2000,
      command: 'rm -rf build',
      quote: 'Remove the build',
    })
  })

  it('leaves out what it was not given', () => {
    const model = m.askedPermission(working(), T + 2000, 'ls', undefined)
    expect(model.record.stories[0]).toEqual({ id: 'abc:1', kind: 'needs-input', at: T + 2000, command: 'ls' })
    expect('quote' in (model.record.stories[0] ?? {})).toBe(false)
  })
})

describe('resumed', () => {
  it('takes needs-input back to working and changes nothing else', () => {
    const asked = m.askedPermission(working(), T + 2000, 'ls', undefined)
    const model = m.resumed(asked, T + 5000)
    expect(model.record.state).toBe('working')
    expect(model.record.stateAt).toBe(T + 5000)
    expect(model.record.stories).toEqual(asked.record.stories)
    expect(model.seq).toBe(1)
  })

  it('does nothing in any other state', () => {
    const model = working()
    expect(m.resumed(model, T + 5000)).toBe(model)
  })
})

describe('finished', () => {
  it('with background work is working and nothing else', () => {
    const before = working()
    const model = m.finished(before, T + 8000, { lastWords: 'Waiting.', changes: { added: 5, removed: 1, files: 2 }, background: true })
    expect(model.record.state).toBe('working')
    expect(model.record.stories).toEqual([])
    expect(model.record.hours).toEqual([])
    expect(model.turn.ended).toBe(false)
    expect(model.seq).toBe(0)
  })

  it('with changed files is a ready story with the diff and how long the turn ran', () => {
    const model = m.finished(working(), T + 61_000, { lastWords: 'Done.', changes: { added: 12, removed: 3, files: 2 }, background: false })
    expect(model.record.state).toBe('ready')
    expect(model.record.stateAt).toBe(T + 61_000)
    expect(model.record.stories).toEqual([{ id: 'abc:1', kind: 'ready', at: T + 61_000, added: 12, removed: 3, files: 2, durationMs: 60_000 }])
    expect(model.turn.ended).toBe(true)
  })

  it('without changed files is a complete story with the last words', () => {
    const model = m.finished(working(), T + 5000, { lastWords: 'All set.', changes: none, background: false })
    expect(model.record.stories).toEqual([{ id: 'abc:1', kind: 'complete', at: T + 5000, quote: 'All set.', durationMs: 4000 }])
    expect(model.record.state).toBe('ready')
  })

  it('leaves the quote out when Claude finished without a word', () => {
    const model = m.finished(working(), T + 5000, { lastWords: '', changes: none, background: false })
    expect('quote' in (model.record.stories[0] ?? {})).toBe(false)
  })

  it('adds the changes to the hour of now, and to the same hour again', () => {
    let model = m.finished(working(), T + 5000, { lastWords: '', changes: { added: 4, removed: 1, files: 1 }, background: false })
    expect(model.record.hours).toEqual([{ hour: hourKey(T + 5000), added: 4, removed: 1, files: 1 }])
    model = m.turnStarted(model, T + 6000, 't2')
    model = m.finished(model, T + 9000, { lastWords: '', changes: { added: 2, removed: 2, files: 3 }, background: false })
    expect(model.record.hours).toEqual([{ hour: hourKey(T + 9000), added: 6, removed: 3, files: 4 }])
  })

  it('starts another hour when the clock moves on, and keeps the newest three', () => {
    let model = working()
    for (let i = 0; i < 5; i += 1) {
      model = m.turnStarted(model, T + i * 3_600_000, `t${i}`)
      model = m.finished(model, T + i * 3_600_000 + 10, { lastWords: '', changes: { added: i + 1, removed: 0, files: 1 }, background: false })
    }
    expect(model.record.hours).toHaveLength(MAX_HOURS)
    expect(model.record.hours.map((hour) => hour.added)).toEqual([3, 4, 5])
    expect(model.record.hours.map((hour) => hour.hour)).toEqual([2, 3, 4].map((i) => hourKey(T + i * 3_600_000 + 10)))
  })

  it('leaves out the duration for a turn that never started', () => {
    const model = m.finished(fresh(), T + 5000, { lastWords: 'x', changes: none, background: false })
    expect('durationMs' in (model.record.stories[0] ?? {})).toBe(false)
  })
})

describe('failed', () => {
  it('lands an error story in words, and the state is error', () => {
    const model = m.failed(working(), T + 3000, 'overloaded')
    expect(model.record.state).toBe('error')
    expect(model.record.stories).toEqual([{ id: 'abc:1', kind: 'error', at: T + 3000, quote: ERROR_WORDS.overloaded, durationMs: 2000 }])
    expect(model.turn.ended).toBe(true)
  })

  it('says the unknown words for a kind it does not know', () => {
    expect(m.failed(working(), T + 3000, 'something_new').record.stories[0]?.quote).toBe(ERROR_WORDS.unknown)
  })
})

describe('aborted', () => {
  it('leaves the session ready with no story', () => {
    const model = m.aborted(working(), T + 3000)
    expect(model.record.state).toBe('ready')
    expect(model.record.stateAt).toBe(T + 3000)
    expect(model.record.stories).toEqual([])
    expect(model.turn.ended).toBe(true)
  })

  it('does nothing once the turn has ended', () => {
    const done = m.failed(working(), T + 3000, 'unknown')
    expect(m.aborted(done, T + 4000)).toBe(done)
  })
})

describe('titled', () => {
  it('sets the title', () => {
    const model = m.titled(fresh(), 'From the transcript', false)
    expect(model.record.title).toBe('From the transcript')
    expect(model.titleFromHook).toBe(false)
  })

  it('lets a hook title win over the transcript afterwards', () => {
    let model = m.titled(fresh(), 'Hook title', true)
    expect(model.titleFromHook).toBe(true)
    model = m.titled(model, 'Transcript title', false)
    expect(model.record.title).toBe('Hook title')
    model = m.titled(model, 'Newer hook title', true)
    expect(model.record.title).toBe('Newer hook title')
  })

  it('ignores an empty title', () => {
    const model = fresh()
    expect(m.titled(model, '', true)).toBe(model)
  })
})

describe('story ids, stateAt and the lists', () => {
  it('counts stories up through the turns', () => {
    let model = working()
    model = m.askedPermission(model, T + 2000, 'a', undefined)
    model = m.resumed(model, T + 3000)
    model = m.finished(model, T + 4000, { lastWords: 'x', changes: none, background: false })
    model = m.turnStarted(model, T + 5000, 't2')
    model = m.failed(model, T + 6000, 'unknown')
    expect(model.record.stories.map((story) => story.id)).toEqual(['abc:1', 'abc:2', 'abc:3'])
    expect(model.seq).toBe(3)
  })

  it('changes stateAt only when the state does', () => {
    let model = working()
    expect(model.record.stateAt).toBe(T + 1000)
    model = m.activity(model, T + 2000, 'x')
    expect(model.record.stateAt).toBe(T + 1000)
    model = m.askedQuestion(model, T + 3000, 'q')
    model = m.askedQuestion(model, T + 4000, 'q again')
    expect(model.record.stateAt).toBe(T + 3000)
    model = m.resumed(model, T + 5000)
    expect(model.record.stateAt).toBe(T + 5000)
  })

  it('keeps the newest ten stories, and keeps numbering past them', () => {
    let model = working()
    for (let i = 0; i < 14; i += 1) {
      model = m.askedQuestion(model, T + 2000 + i, `q${i}`)
    }
    expect(model.record.stories).toHaveLength(MAX_STORIES)
    expect(model.record.stories[0]?.id).toBe('abc:5')
    expect(model.record.stories.at(-1)?.id).toBe('abc:14')
    expect(model.seq).toBe(14)
  })
})

describe('the turn', () => {
  it('takes a baseline only for the turn that is running', () => {
    const baseline = { numstat: new Map<string, [number, number]>([['a', [1, 0]]]), untracked: new Set(['n']) }
    const model = m.baselineTaken(working(), 't1', baseline)
    expect(model.turn.baseline).toBe(baseline)
    expect(m.baselineTaken(working(), 'other', baseline).turn.baseline).toBeNull()
    const ended = m.aborted(working(), T + 2000)
    expect(m.baselineTaken(ended, 't1', baseline).turn.baseline).toBeNull()
  })

  it('adds up what the edit tools did, a file once', () => {
    let model = working()
    model = m.edited(model, '/p/a.ts', 3, 1)
    model = m.edited(model, '/p/a.ts', 2, 0)
    model = m.edited(model, '/p/b.ts', 1, 1)
    expect(model.turn.edits.added).toBe(6)
    expect(model.turn.edits.removed).toBe(2)
    expect([...model.turn.edits.files]).toEqual(['/p/a.ts', '/p/b.ts'])
  })

  it('does not share its edits with the model it came from', () => {
    const before = working()
    m.edited(before, '/p/a.ts', 3, 1)
    expect(before.turn.edits.files.size).toBe(0)
  })
})
