import { describe, expect, it } from 'vitest'

import { ERROR_WORDS, MAX_ACTIVITY, MAX_HOURS, MAX_STORIES, hourKey } from '@pipcast/contract'
import * as m from '../src/core/model.ts'

const T = Date.UTC(2026, 9, 21, 14, 30, 0)

const fresh = () => m.newModel('abc', 'proj', 'Title', T)
const working = () => m.turnStarted(fresh(), T + 1000, 't1')

// What a turn that ends waits on: nothing, or other work that will wake the session
const NONE = { shells: [], others: false }
const OTHERS = { shells: [], others: true }
// Commands left running in the background, as a Stop lists them
const server = { id: 'b1devsrv0', command: 'npm run dev' }
const tests = { id: 'b2tstrun0', command: 'npm test' }

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
      limits: [],
    })
    expect(model.seq).toBe(0)
    expect(model.turn.ended).toBe(true)
    expect(model.titles).toEqual({ file: null, hook: null, fallback: 'Title' })
    expect(model.held).toBeNull()
  })
})

describe('turnStarted', () => {
  it('makes the session working and starts a fresh turn', () => {
    const model = working()
    expect(model.record.state).toBe('working')
    expect(model.record.stateAt).toBe(T + 1000)
    expect(model.turn).toMatchObject({ id: 't1', startedAt: T + 1000, ended: false })
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
    const model = m.askedPermission(working(), T + 2000, 'rm -rf build', 'Remove the build', null)
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
    const model = m.askedPermission(working(), T + 2000, 'ls', undefined, null)
    expect(model.record.stories[0]).toEqual({ id: 'abc:1', kind: 'needs-input', at: T + 2000, command: 'ls' })
    expect('quote' in (model.record.stories[0] ?? {})).toBe(false)
  })
})

describe('resumed', () => {
  it('takes needs-input back to working and changes nothing else', () => {
    const asked = m.askedPermission(working(), T + 2000, 'ls', undefined, null)
    const model = m.resumed(asked, T + 5000, null)
    expect(model.record.state).toBe('working')
    expect(model.record.stateAt).toBe(T + 5000)
    expect(model.record.stories).toEqual(asked.record.stories)
    expect(model.seq).toBe(1)
  })

  it('does nothing in any other state', () => {
    const model = working()
    expect(m.resumed(model, T + 5000, null)).toBe(model)
  })

  it('ends a main-loop permission when the main loop moves on, not a subagent', () => {
    const asked = m.askedPermission(working(), T + 2000, 'ls', undefined, null)
    expect(asked.waitingOn).toEqual({ agent: null })
    expect(m.resumed(asked, T + 5000, 'a1')).toBe(asked)
    const model = m.resumed(asked, T + 5000, null)
    expect(model.record.state).toBe('working')
    expect(model.waitingOn).toBeNull()
  })

  it('ends a subagent permission when that subagent moves on, and nobody else', () => {
    const asked = m.askedPermission(working(), T + 2000, 'ls', undefined, 'a1')
    expect(asked.waitingOn).toEqual({ agent: 'a1' })
    expect(asked.record.state).toBe('needs-input')
    expect(m.resumed(asked, T + 5000, null)).toBe(asked)
    expect(m.resumed(asked, T + 5000, 'a2')).toBe(asked)
    const model = m.resumed(asked, T + 5000, 'a1')
    expect(model.record.state).toBe('working')
    expect(model.record.stateAt).toBe(T + 5000)
    expect(model.waitingOn).toBeNull()
  })

  it('ends a question with the main loop', () => {
    const asked = m.askedQuestion(working(), T + 2000, 'Which?')
    expect(asked.waitingOn).toEqual({ agent: null })
    expect(m.resumed(asked, T + 3000, 'a1')).toBe(asked)
    expect(m.resumed(asked, T + 3000, null).record.state).toBe('working')
  })

  it('waits on nobody until something is asked', () => {
    expect(fresh().waitingOn).toBeNull()
    expect(working().waitingOn).toBeNull()
  })

  it('is cleared when a turn starts, finishes, fails or is interrupted', () => {
    const asked = () => m.askedPermission(working(), T + 2000, 'ls', undefined, 'a1')
    expect(m.turnStarted(asked(), T + 3000, 't2').waitingOn).toBeNull()
    expect(m.finished(asked(), T + 3000, { lastWords: 'x', waiting: NONE }).waitingOn).toBeNull()
    expect(m.finished(asked(), T + 3000, { lastWords: 'x', waiting: OTHERS }).waitingOn).toBeNull()
    const changed = m.booked(asked(), T + 2500, { added: 1, removed: 0, files: ['/p/a.ts'] })
    expect(m.finished(changed, T + 3000, { lastWords: '', waiting: NONE }).waitingOn).toBeNull()
    expect(m.failed(asked(), T + 3000, 'unknown').waitingOn).toBeNull()
    expect(m.aborted(asked(), T + 3000).waitingOn).toBeNull()
  })
})

describe('booked', () => {
  it('adds the lines to the hour of now and to the tally', () => {
    const model = m.booked(working(), T + 5000, { added: 4, removed: 1, files: ['/p/a.ts'] })
    expect(model.record.hours).toEqual([{ hour: hourKey(T + 5000), added: 4, removed: 1, files: 1 }])
    expect(model.tally).toEqual({ added: 4, removed: 1, files: new Set(['/p/a.ts']) })
    const again = m.booked(model, T + 9000, { added: 2, removed: 2, files: ['/p/b.ts'] })
    expect(again.record.hours).toEqual([{ hour: hourKey(T + 9000), added: 6, removed: 3, files: 2 }])
    expect(again.tally).toEqual({ added: 6, removed: 3, files: new Set(['/p/a.ts', '/p/b.ts']) })
  })

  it('counts each file once in its hour, and once in the tally', () => {
    let model = m.booked(working(), T + 5000, { added: 4, removed: 1, files: ['/p/a.ts', '/p/b.ts'] })
    model = m.booked(model, T + 6000, { added: 3, removed: 0, files: ['/p/a.ts', '/p/c.ts'] })
    expect(model.record.hours).toEqual([{ hour: hourKey(T + 6000), added: 7, removed: 1, files: 3 }])
    expect(model.tally.added).toBe(7)
    expect([...model.tally.files]).toEqual(['/p/a.ts', '/p/b.ts', '/p/c.ts'])
  })

  it('starts a new hour with files of its own', () => {
    let model = m.booked(working(), T + 5000, { added: 4, removed: 0, files: ['/p/a.ts'] })
    model = m.booked(model, T + 3_600_000, { added: 2, removed: 0, files: ['/p/a.ts'] })
    expect(model.record.hours).toEqual([
      { hour: hourKey(T + 5000), added: 4, removed: 0, files: 1 },
      { hour: hourKey(T + 3_600_000), added: 2, removed: 0, files: 1 },
    ])
    expect(model.tally).toEqual({ added: 6, removed: 0, files: new Set(['/p/a.ts']) })
  })

  it('keeps the newest three hours', () => {
    let model = working()
    for (let i = 0; i < 5; i += 1) {
      model = m.booked(model, T + i * 3_600_000, { added: i + 1, removed: 0, files: ['/p/a.ts'] })
    }
    expect(model.record.hours).toHaveLength(MAX_HOURS)
    expect(model.record.hours.map((hour) => hour.added)).toEqual([3, 4, 5])
    expect(model.record.hours.map((hour) => hour.hour)).toEqual([2, 3, 4].map((i) => hourKey(T + i * 3_600_000)))
  })

  it('ignores a booking of nothing', () => {
    const model = working()
    expect(m.booked(model, T + 5000, { added: 0, removed: 0, files: [] })).toBe(model)
  })
})

describe('finished', () => {
  it('with work that will wake the session, stays working with no story, and the turn is over', () => {
    const before = working()
    const model = m.finished(before, T + 8000, { lastWords: 'Waiting.', waiting: OTHERS })
    expect(model.record.state).toBe('working')
    expect(model.record.stories).toEqual([])
    expect(model.record.hours).toEqual([])
    expect(model.turn.ended).toBe(true)
    expect(model.seq).toBe(0)
  })

  it('with work that will wake the session keeps the tally for the next story', () => {
    const booked = m.booked(working(), T + 2000, { added: 5, removed: 1, files: ['/p/a.ts', '/p/b.ts'] })
    const waiting = m.finished(booked, T + 8000, { lastWords: 'Waiting.', waiting: OTHERS })
    expect(waiting.tally).toEqual(booked.tally)
    expect(waiting.record.stories).toEqual([])
    const next = m.finished(m.turnStarted(waiting, T + 9000, 't2'), T + 12_000, { lastWords: 'Done.', waiting: NONE })
    expect(next.record.stories).toEqual([{ id: 'abc:1', kind: 'ready', at: T + 12_000, added: 5, removed: 1, files: 2, durationMs: 3000 }])
  })

  it('a ready story tells the tally, which then starts again', () => {
    const booked = m.booked(working(), T + 2000, { added: 12, removed: 3, files: ['/p/a.ts', '/p/b.ts'] })
    const model = m.finished(booked, T + 61_000, { lastWords: 'Done.', waiting: NONE })
    expect(model.record.state).toBe('ready')
    expect(model.record.stateAt).toBe(T + 61_000)
    expect(model.record.stories).toEqual([{ id: 'abc:1', kind: 'ready', at: T + 61_000, added: 12, removed: 3, files: 2, durationMs: 60_000 }])
    expect(model.turn.ended).toBe(true)
    expect(model.tally).toEqual({ added: 0, removed: 0, files: new Set() })
    const quiet = m.finished(m.turnStarted(model, T + 70_000, 't2'), T + 75_000, { lastWords: 'Nothing to change.', waiting: NONE })
    expect(quiet.record.stories[1]?.kind).toBe('complete')
  })

  it('without changed files is a complete story with the last words', () => {
    const model = m.finished(working(), T + 5000, { lastWords: 'All set.', waiting: NONE })
    expect(model.record.stories).toEqual([{ id: 'abc:1', kind: 'complete', at: T + 5000, quote: 'All set.', durationMs: 4000 }])
    expect(model.record.state).toBe('ready')
  })

  it('is a ready story for a booking that names a file with no lines', () => {
    const booked = m.booked(working(), T + 2000, { added: 0, removed: 0, files: ['/p/image.png'] })
    const model = m.finished(booked, T + 5000, { lastWords: 'x', waiting: NONE })
    expect(model.record.stories[0]).toMatchObject({ kind: 'ready', added: 0, removed: 0, files: 1 })
  })

  it('leaves the quote out when Claude finished without a word', () => {
    const model = m.finished(working(), T + 5000, { lastWords: '', waiting: NONE })
    expect('quote' in (model.record.stories[0] ?? {})).toBe(false)
  })

  it('leaves out the duration for a turn that never started', () => {
    const model = m.finished(fresh(), T + 5000, { lastWords: 'x', waiting: NONE })
    expect('durationMs' in (model.record.stories[0] ?? {})).toBe(false)
  })
})

describe('a held finish', () => {
  it('holds while background commands work: working, no story, and the turn is over', () => {
    const booked = m.booked(working(), T + 2000, { added: 3, removed: 1, files: ['/p/a.ts'] })
    const model = m.finished(booked, T + 8000, { lastWords: 'Started the dev server.', waiting: { shells: [server, tests], others: false } })
    expect(model.record.state).toBe('working')
    expect(model.record.stories).toEqual([])
    expect(model.turn.ended).toBe(true)
    expect(model.held).toEqual({ lastWords: 'Started the dev server.', stoppedAt: T + 8000, shells: [server, tests], others: false, lookedAt: T + 8000 })
    expect(model.tally).toEqual(booked.tally)
  })

  it('lands once no command works: the turn\'s story, timed to when the turn ended', () => {
    const booked = m.booked(working(), T + 2000, { added: 3, removed: 1, files: ['/p/a.ts'] })
    const held = m.finished(booked, T + 8000, { lastWords: 'Done.', waiting: { shells: [server], others: false } })
    const model = m.looked(held, T + 30_000, new Map([[server.id, 'serving']]))
    expect(model.held).toBeNull()
    expect(model.record.state).toBe('ready')
    expect(model.record.stateAt).toBe(T + 30_000)
    expect(model.record.stories).toEqual([{ id: 'abc:1', kind: 'ready', at: T + 30_000, added: 3, removed: 1, files: 1, durationMs: 7000 }])
    expect(model.tally).toEqual({ added: 0, removed: 0, files: new Set() })
  })

  it('lands as a complete story with the last words when no file changed', () => {
    const held = m.finished(working(), T + 8000, { lastWords: 'The site is up.', waiting: { shells: [server], others: false } })
    const model = m.looked(held, T + 18_000, new Map([[server.id, 'watching']]))
    expect(model.record.stories).toEqual([{ id: 'abc:1', kind: 'complete', at: T + 18_000, quote: 'The site is up.', durationMs: 7000 }])
  })

  it('keeps holding while a command works, with the ones that do, and notes the look', () => {
    const held = m.finished(working(), T + 8000, { lastWords: 'x', waiting: { shells: [server, tests], others: false } })
    const model = m.looked(held, T + 18_000, new Map([[server.id, 'following'], [tests.id, 'working']]))
    expect(model.record.state).toBe('working')
    expect(model.record.stories).toEqual([])
    expect(model.held).toEqual({ lastWords: 'x', stoppedAt: T + 8000, shells: [tests], others: false, lookedAt: T + 18_000 })
  })

  it('counts a command the look says nothing about as working', () => {
    const held = m.finished(working(), T + 8000, { lastWords: 'x', waiting: { shells: [tests], others: false } })
    expect(m.looked(held, T + 18_000, new Map()).held?.shells).toEqual([tests])
  })

  it('never lands while other work will wake the session', () => {
    const held = m.finished(working(), T + 8000, { lastWords: 'x', waiting: { shells: [server], others: true } })
    const model = m.looked(held, T + 18_000, new Map([[server.id, 'serving']]))
    expect(model.record.stories).toEqual([])
    expect(model.held).toMatchObject({ shells: [], others: true, lookedAt: T + 18_000 })
  })

  it('is dropped by a new turn, an error or a finish that lands', () => {
    const held = () => m.finished(working(), T + 8000, { lastWords: 'x', waiting: { shells: [tests], others: false } })
    expect(m.turnStarted(held(), T + 9000, 't2').held).toBeNull()
    expect(m.failed(m.turnStarted(held(), T + 9000, 't2'), T + 9500, 'unknown').held).toBeNull()
    expect(m.finished(m.turnStarted(held(), T + 9000, 't2'), T + 9500, { lastWords: 'y', waiting: NONE }).held).toBeNull()
  })

  it('changes nothing when no finish is held', () => {
    const model = m.finished(working(), T + 5000, { lastWords: 'x', waiting: NONE })
    expect(model.held).toBeNull()
    expect(m.looked(model, T + 6000, new Map([[server.id, 'serving']]))).toBe(model)
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

describe('failed and aborted', () => {
  it('an error or an interrupt starts the tally again', () => {
    const booked = m.booked(working(), T + 2000, { added: 5, removed: 1, files: ['/p/a.ts'] })
    const empty = { added: 0, removed: 0, files: new Set<string>() }
    expect(m.failed(booked, T + 3000, 'unknown').tally).toEqual(empty)
    expect(m.aborted(booked, T + 3000).tally).toEqual(empty)
    expect(m.aborted(booked, T + 3000).record.hours).toEqual(booked.record.hours)
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

describe('the title', () => {
  it('is the default name until something names the session', () => {
    expect(fresh().record.title).toBe('Title')
  })

  it('takes a hook title', () => {
    const model = m.hookTitled(fresh(), 'From a hook')
    expect(model.record.title).toBe('From a hook')
    expect(model.titles.hook).toBe('From a hook')
  })

  it('puts the title file before a hook title, whichever came last', () => {
    let model = m.fileTitled(m.hookTitled(fresh(), 'From a hook'), 'From the file')
    expect(model.record.title).toBe('From the file')
    model = m.hookTitled(model, 'A later hook title')
    expect(model.record.title).toBe('From the file')
    expect(model.titles.hook).toBe('A later hook title')
  })

  it('falls back to the hook title, then the default name, when the file holds none', () => {
    const named = m.fileTitled(m.hookTitled(fresh(), 'From a hook'), 'From the file')
    expect(m.fileTitled(named, null).record.title).toBe('From a hook')
    expect(m.fileTitled(m.fileTitled(fresh(), 'From the file'), null).record.title).toBe('Title')
  })

  it('returns the same model when nothing changes, and reads an empty title as none', () => {
    const plain = fresh()
    expect(m.fileTitled(plain, null)).toBe(plain)
    expect(m.fileTitled(plain, '')).toBe(plain)
    expect(m.hookTitled(plain, '')).toBe(plain)
    const named = m.fileTitled(plain, 'From the file')
    expect(m.fileTitled(named, 'From the file')).toBe(named)
  })
})

describe('story ids, stateAt and the lists', () => {
  it('counts stories up through the turns', () => {
    let model = working()
    model = m.askedPermission(model, T + 2000, 'a', undefined, null)
    model = m.resumed(model, T + 3000, null)
    model = m.finished(model, T + 4000, { lastWords: 'x', waiting: NONE })
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
    model = m.resumed(model, T + 5000, null)
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

describe('restored', () => {
  it('takes the stories and hours from the record and numbers the next story after its newest', () => {
    const own = {
      ...fresh().record,
      stories: [
        { id: 'abc:6', kind: 'complete' as const, at: T },
        { id: 'abc:7', kind: 'complete' as const, at: T + 1 },
        { id: 'other:9', kind: 'complete' as const, at: T + 2 },
      ],
      hours: [{ hour: hourKey(T), added: 30, removed: 4, files: 2 }],
    }
    const model = m.restored(fresh(), own)
    expect(model.record.stories.map((story) => story.id)).toEqual(['abc:6', 'abc:7', 'other:9'])
    expect(model.record.hours).toEqual(own.hours)
    expect(model.seq).toBe(7)
    const asked = m.askedQuestion(model, T + 5000, 'Which?')
    expect(asked.record.stories.at(-1)?.id).toBe('abc:8')
  })

  it('keeps the numbering it has when the record holds nothing newer', () => {
    const model = m.restored(m.askedQuestion(working(), T + 2000, 'q'), fresh().record)
    expect(model.seq).toBe(1)
    expect(model.record.stories).toEqual([])
  })

  it('carries the usage limits the session\'s own record kept', () => {
    const limits = [
      { kind: 'session' as const, percentUsed: 42, resetsAt: T + 3_600_000, at: T },
      { kind: 'week' as const, percentUsed: 61, resetsAt: null, at: T },
    ]
    expect(m.restored(fresh(), { ...fresh().record, limits }).record.limits).toEqual(limits)
    expect(m.restored(fresh(), { ...fresh().record, limits: undefined }).record.limits).toEqual([])
  })
})

describe('measured', () => {
  const session = { kind: 'session' as const, percentUsed: 42, resetsAt: T + 3_600_000, at: T }
  const week = { kind: 'week' as const, percentUsed: 61, resetsAt: T + 86_400_000, at: T }

  it('puts a reading of the usage limits on the record', () => {
    const model = m.measured(fresh(), [session, week])
    expect(model.record.limits).toEqual([session, week])
    const later = m.measured(model, [{ ...session, percentUsed: 43, at: T + 1000 }])
    expect(later.record.limits?.[0]).toEqual({ ...session, percentUsed: 43, at: T + 1000 })
  })

  it('keeps a limit the reading leaves out', () => {
    const model = m.measured(m.measured(fresh(), [session, week]), [{ ...week, percentUsed: 62, at: T + 1000 }])
    expect(model.record.limits).toEqual([session, { ...week, percentUsed: 62, at: T + 1000 }])
  })

  it('returns the model it was given for a reading with no limits', () => {
    const model = fresh()
    expect(m.measured(model, [])).toBe(model)
  })
})
