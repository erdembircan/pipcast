import { describe, expect, it } from 'vitest'

import type { Story } from '@pipcast/contract'
import type { TickerItem } from '@pipcast/design'
import { createDirector } from '@pipcast/director'
import type { Program } from '@pipcast/director'

import { at, harness, session, story, T0 } from './helpers.ts'

function lines(program: Program): string[] {
  return (program.scene.ticker ?? []).map((item: TickerItem) =>
    typeof item === 'string' ? item : `${item.lead} ${item.text}`,
  )
}

function asking(id: string, when: number, rest: Partial<Story> = {}) {
  return session(id, {
    state: 'needs-input',
    stateAt: when,
    stories: [story(`${id}:1`, 'needs-input', when, { command: 'npm install', quote: 'Install dependencies', ...rest })],
  })
}

// The same session after it answered: working again, the story still in its list
function answered(id: string, when: number) {
  return session(id, {
    state: 'working',
    stateAt: when,
    stories: [story(`${id}:1`, 'needs-input', T0 + 1000, { command: 'npm install' })],
  })
}

describe('the board', () => {
  it('shows the working sessions and what each is doing', () => {
    const h = harness(T0, [
      session('a', { activity: [{ at: T0 - 5000, text: 'editing a.ts' }] }),
      session('b', { activity: [{ at: T0 - 1000, text: 'running the tests' }] }),
    ])
    const { program } = h.until(T0)
    expect(program.key).toBe('board')
    expect(program.cues).toEqual([])
    expect(program.reported).toBeNull()
    expect(program.scene.mode).toBe('board')
    expect(program.scene.clock).toBe('14:30')
    expect(program.scene.sessions).toEqual([
      { id: 'a', name: 'Title a', project: 'project-a', state: 'working' },
      { id: 'b', name: 'Title b', project: 'project-b', state: 'working' },
    ])
    expect(lines(program)).toEqual([
      'ON THE DESK 2 sessions working',
      'project-b: running the tests',
      'project-a: editing a.ts',
    ])
  })

  it('draws an empty board with no snapshot', () => {
    const program = createDirector().tick({ now: T0, snapshot: null })
    expect(program.scene).toMatchObject({ mode: 'board', sessions: [] })
    expect(program.key).toBe('board')
  })
})

describe('a story', () => {
  it('airs BREAKING NEWS, the desk and the outro, then leaves the board', () => {
    const h = harness(T0, [session('a')])
    const start = h.land([asking('a', T0 + 5000)], T0 + 5000).program
    expect(start.cues).toEqual(['breaking'])
    expect(start.key).toBe('story:a:1:0')
    expect(start.scene).toMatchObject({ mode: 'stinger', progress: 1, event: { kind: 'needs-input' } })

    expect(h.until(T0 + 5000 + 1750).program.key).toBe('story:a:1:0')

    const desk = h.until(T0 + 5000 + 2000).program
    expect(desk.key).toBe('story:a:1:1')
    expect(desk.cues).toEqual([])
    expect(desk.scene).toMatchObject({
      mode: 'desk',
      act: 'urgent',
      event: {
        kind: 'needs-input',
        session: 'Title a',
        project: 'project-a',
        command: 'npm install',
        quote: 'Install dependencies',
        foot: 'Waiting 0:02',
      },
    })

    expect(h.until(T0 + 5000 + 11_750).program.key).toBe('story:a:1:1')
    const outro = h.until(T0 + 5000 + 12_000).program
    expect(outro.key).toBe('story:a:1:2')
    expect(outro.cues).toEqual(['breaking-out'])
    expect(outro.scene.mode).toBe('outro')
    expect(outro.scene.board?.mode).toBe('board')

    expect(h.until(T0 + 5000 + 13_250).program.key).toBe('story:a:1:2')
    const board = h.until(T0 + 5000 + 13_500).program
    expect(board.key).toBe('board')
    expect(board.scene.mode).toBe('board')
    expect(lines(board)).toContain('BREAKING Title a needs your input')
    expect(lines(board)).toContain('STILL WAITING Title a needs your input')
    expect(h.cues().map((cue) => cue.jingle)).toEqual(['breaking', 'breaking-out'])
  })

  it('leads the ticker at a needs-input desk with the story on air, and skips its own STILL WAITING', () => {
    const h = harness(T0, [session('a'), session('b', { activity: [{ at: T0, text: 'editing b.ts' }] })])
    h.land([asking('a', T0 + 1000), session('b', { activity: [{ at: T0, text: 'editing b.ts' }] })], T0 + 1000)
    const desk = h.until(T0 + 3000).program
    expect(desk.scene.mode).toBe('desk')
    expect(lines(desk)).toEqual([
      'BREAKING Title a needs your input',
      'ON THE DESK 1 session working',
      'project-b: editing b.ts',
    ])
  })

  it('leads the ticker at a ready desk with the story on air', () => {
    const done = story('a:1', 'ready', T0 + 1000, { added: 1, removed: 0, files: 1 })
    const h = harness(T0, [session('a')])
    h.land([session('a', { state: 'ready', stateAt: done.at, stories: [done] })], T0 + 1000)
    const desk = h.until(T0 + 3000).program
    expect(desk.scene.mode).toBe('desk')
    expect(lines(desk)).toEqual(['BREAKING Title a ready for review', 'ON THE DESK 1 session on KLWD'])
  })

  it('puts a story that lands during another in the ticker and airs it 2 s after the outro', () => {
    const h = harness(T0, [session('a'), session('b')])
    expect(h.land([asking('a', T0 + 1000), asking('b', T0 + 1000)], T0 + 1000).program.key).toBe('story:a:1:0')
    const desk = h.until(T0 + 4000).program
    expect(lines(desk)).toContain('COMING UP Title b needs your input')

    // The first outro ends 13.3 s in, the second story starts 2 s after that
    expect(h.until(T0 + 1000 + 15_250).program.key).toBe('board')
    const second = h.until(T0 + 1000 + 15_500).program
    expect(second.key).toBe('story:b:1:0')
    expect(second.cues).toEqual(['breaking'])
  })

  it('cuts the desk when the session answers, and the outro starts on the next tick', () => {
    const h = harness(T0, [session('a')])
    h.land([asking('a', T0 + 1000)], T0 + 1000)
    expect(h.until(T0 + 4000).program.key).toBe('story:a:1:1')

    h.world.sessions = [answered('a', T0 + 4100)]
    const cut = h.until(T0 + 4250).program
    expect(cut.key).toBe('story:a:1:2')
    expect(cut.cues).toEqual(['breaking-out'])
    expect(h.until(T0 + 4250 + 1250).program.key).toBe('story:a:1:2')
    expect(h.until(T0 + 4250 + 1500).program.key).toBe('board')
    // A story cut short is not restarted
    h.until(T0 + 60_000)
    expect(h.cues().map((cue) => cue.jingle)).toEqual(['breaking', 'breaking-out'])
  })

  it('drops a queued story whose session has moved on', () => {
    const h = harness(T0, [session('a'), session('b')])
    h.land([asking('a', T0 + 1000), asking('b', T0 + 1000)], T0 + 1000)
    expect(lines(h.until(T0 + 3000).program)).toContain('COMING UP Title b needs your input')

    h.world.sessions = [asking('a', T0 + 1000), answered('b', T0 + 3100)]
    expect(lines(h.until(T0 + 3250).program).some((line) => line.startsWith('COMING UP'))).toBe(false)

    h.until(T0 + 60_000)
    expect(h.keys().some((key) => key.startsWith('story:b'))).toBe(false)
  })

  it('drops a queued story that a newer story of the session has replaced', () => {
    const h = harness(T0, [session('a'), session('b')])
    h.land([asking('a', T0 + 1000), asking('b', T0 + 1000)], T0 + 1000)
    const replaced = session('b', {
      state: 'needs-input',
      stateAt: T0 + 3000,
      stories: [story('b:1', 'needs-input', T0 + 1000), story('b:2', 'needs-input', T0 + 3000)],
    })
    h.world.sessions = [asking('a', T0 + 1000), replaced]
    h.until(T0 + 60_000)
    expect(h.keys().some((key) => key.startsWith('story:b:1'))).toBe(false)
    expect(h.keys().some((key) => key.startsWith('story:b:2'))).toBe(true)
  })

  it('does not air stories older than two minutes on the first tick', () => {
    const old = story('a:1', 'needs-input', T0 - 3 * 60_000, { command: 'npm install' })
    const fresh = story('b:1', 'complete', T0 - 60_000, { quote: 'Done' })
    const h = harness(T0, [
      session('a', { state: 'needs-input', stateAt: old.at, stories: [old] }),
      session('b', { state: 'ready', stateAt: fresh.at, stories: [fresh] }),
    ])
    h.until(T0 + 30_000)
    expect(h.keys().some((key) => key.startsWith('story:a:1'))).toBe(false)
    expect(h.keys()).toContain('story:b:1:0')
    expect(h.cues().map((cue) => cue.jingle)).toEqual(['breaking', 'breaking-out'])
  })

  it('shows an old story as STILL WAITING instead of airing it', () => {
    const old = story('a:1', 'needs-input', T0 - 3 * 60_000, { command: 'npm install' })
    const h = harness(T0, [session('a', { state: 'needs-input', stateAt: old.at, stories: [old] })])
    const first = h.until(T0).program
    expect(first.key).toBe('board')
    expect(lines(first)).toContain('STILL WAITING Title a needs your input · 3 min')
  })

  it('keeps a finished story BREAKING for 40 s and then says it is waiting for review', () => {
    const done = story('a:1', 'ready', T0 + 1000, { added: 10, removed: 2, files: 3, durationMs: 540_000 })
    const h = harness(T0, [session('a')])
    h.land([session('a', { state: 'ready', stateAt: done.at, stories: [done] })], T0 + 1000)
    const desk = h.until(T0 + 1000 + 2000).program
    expect(desk.scene).toMatchObject({
      act: 'cheer',
      event: { kind: 'ready', figure: '+10 −2', sub: '3 files changed', foot: 'Finished in 9 min' },
    })
    const ended = T0 + 1000 + 13_300
    expect(lines(h.until(ended + 250).program)).toContain('BREAKING Title a ready for review')
    expect(lines(h.until(ended + 39_500).program)).toContain('BREAKING Title a ready for review')
    const later = lines(h.until(ended + 40_250).program)
    expect(later).toContain('READY Title a waiting for review')
    expect(later.some((line) => line.startsWith('BREAKING'))).toBe(false)
  })

  it('airs complete and error stories with their own desks', () => {
    const complete = story('a:1', 'complete', T0 + 1000, { quote: 'All done', durationMs: 42_000 })
    const failed = story('b:1', 'error', T0 + 1000, { durationMs: 31 * 60_000 })
    const h = harness(T0, [session('a'), session('b')])
    h.land(
      [
        session('a', { state: 'ready', stateAt: complete.at, stories: [complete] }),
        session('b', { state: 'error', stateAt: failed.at, stories: [failed] }),
      ],
      T0 + 1000,
    )
    expect(h.until(T0 + 3000).program.scene).toMatchObject({
      act: 'talk',
      event: { kind: 'complete', quote: 'All done', foot: 'Finished in 42 s' },
    })
    expect(h.until(T0 + 1000 + 15_500 + 2000).program.scene).toMatchObject({
      act: 'glance',
      event: { kind: 'error', quote: 'Claude stopped on an error.', foot: 'Stopped after 31 min' },
    })
  })
})

describe('when the window is hidden', () => {
  it('drops a story that lands while it is hidden, and the ticker still says it is waiting', () => {
    const h = harness(T0, [session('a')])
    h.world.visible = false
    const hidden = h.land([asking('a', T0 + 1000)], T0 + 5000)
    expect(hidden.program.key).toBe('board')
    expect(lines(hidden.program).some((line) => line.startsWith('COMING UP'))).toBe(false)

    h.world.visible = true
    const shown = h.until(T0 + 5250).program
    expect(shown.key).toBe('board')
    expect(lines(shown)).toContain('STILL WAITING Title a needs your input')
    h.until(T0 + 60_000)
    expect(h.keys()).toEqual(['board'])
    expect(h.cues()).toEqual([])
  })

  it('airs a story that lands once it shows again', () => {
    const h = harness(T0, [session('a')])
    h.world.visible = false
    h.until(T0 + 5000)
    h.world.visible = true
    const start = h.land([asking('a', T0 + 6000)], T0 + 6000).program
    expect(start.key).toBe('story:a:1:0')
    expect(start.cues).toEqual(['breaking'])
  })

  it('drops the stories waiting their turn when it hides', () => {
    const h = harness(T0, [session('a'), session('b')])
    h.land([asking('a', T0 + 1000), asking('b', T0 + 1000)], T0 + 1000)
    expect(lines(h.until(T0 + 4000).program)).toContain('COMING UP Title b needs your input')

    h.world.visible = false
    const hidden = h.until(T0 + 4250).program
    expect(hidden.key).toBe('board')
    expect(lines(hidden).some((line) => line.startsWith('COMING UP'))).toBe(false)

    h.world.visible = true
    h.until(T0 + 60_000)
    expect(h.keys().some((key) => key.startsWith('story:b'))).toBe(false)
    expect(h.cues()).toEqual([{ now: T0 + 1000, jingle: 'breaking' }])
  })

  it('keeps the report on the hour waiting, and drops the stories around it', () => {
    const h = harness(at(14, 59, 0), [session('a'), session('b')])
    h.land([asking('a', at(14, 59, 50)), session('b')], at(14, 59, 50))
    h.land([asking('a', at(14, 59, 50)), asking('b', at(14, 59, 57))], at(14, 59, 57))
    const desk = h.until(at(14, 59, 58)).program
    expect(lines(desk)).toContain('COMING UP The 15:00 report')
    expect(lines(desk)).toContain('COMING UP Title b needs your input')

    h.world.visible = false
    const hidden = h.until(at(15, 2, 0)).program
    expect(lines(hidden)).toContain('COMING UP The 15:00 report')
    expect(lines(hidden)).not.toContain('COMING UP Title b needs your input')

    h.world.visible = true
    const ident = h.until(at(15, 2, 0) + 250).program
    expect(ident.cues).toEqual(['hour'])
    expect(ident.reported).toBe(at(15))
    h.until(at(15, 3, 0))
    expect(h.keys().some((key) => key.startsWith('story:b'))).toBe(false)
    expect(h.cues().map((cue) => cue.jingle)).toEqual(['breaking', 'hour', 'hour-out'])
  })

  it('cuts a segment on air when it hides and does not air it again', () => {
    const h = harness(T0, [session('a')])
    h.land([asking('a', T0 + 1000)], T0 + 1000)
    expect(h.until(T0 + 4000).program.key).toBe('story:a:1:1')

    h.world.visible = false
    const hidden = h.until(T0 + 4250).program
    expect(hidden.key).toBe('board')
    expect(hidden.cues).toEqual([])

    h.world.visible = true
    h.until(T0 + 60_000)
    expect(h.cues()).toEqual([{ now: T0 + 1000, jingle: 'breaking' }])
  })
})

describe('the hour', () => {
  function afternoon() {
    const asked = story('a:1', 'needs-input', at(14, 20), { command: 'npm install' })
    const ready = story('b:1', 'ready', at(14, 40), { added: 100, removed: 20, files: 3 })
    return [
      session('a', { state: 'needs-input', stateAt: asked.at, stories: [asked] }),
      session('b', {
        state: 'ready',
        stateAt: ready.at,
        stories: [ready],
        hours: [
          { hour: '2026-10-21T13', added: 7, removed: 7, files: 1 },
          { hour: '2026-10-21T14', added: 100, removed: 20, files: 3 },
        ],
      }),
    ]
  }

  it('airs the ident, the desk, the review and the outro, then ON THE HOUR', () => {
    const h = harness(at(14, 59, 0), afternoon())
    const ident = h.until(at(14, 59, 55))
    expect(ident.program.cues).toEqual(['hour'])
    expect(ident.program.reported).toBe(at(15))
    expect(ident.program.scene).toMatchObject({ mode: 'ident', hour: '15:00', progress: 1 })
    expect(ident.program.key).toBe(`hour:${at(15)}:0`)

    expect(h.until(at(15, 0, 2)).program.scene.mode).toBe('ident')
    const desk = h.until(at(15, 0, 3)).program
    expect(desk.reported).toBeNull()
    expect(desk.scene).toMatchObject({
      mode: 'desk',
      act: 'talk',
      headline: '2 STORIES',
      strap: '1 needs you · 1 ready for review',
      event: { kind: 'hourly', figure: '+100 −20', sub: 'Across 2 sessions', foot: '14:00 to 15:00' },
    })
    expect(lines(desk)[0]).toBe('ON THE HOUR 2 stories since 14:00')

    const review = h.until(at(15, 0, 13)).program
    expect(review.scene).toMatchObject({
      mode: 'review',
      span: '14:00–15:00',
      rows: [
        { id: 'a', project: 'project-a', state: 'needs-input', detail: 'Waiting 39 min' },
        { id: 'b', project: 'project-b', state: 'ready', detail: '+100 −20' },
      ],
    })

    // The review carries the report's line and the board's ticker, like the desk
    expect(lines(review)[0]).toBe('ON THE HOUR 2 stories since 14:00')
    expect(lines(review).some((line) => line.startsWith('ON THE DESK'))).toBe(true)
    expect(lines(review).some((line) => line.startsWith('STILL WAITING Title a'))).toBe(true)

    const outro = h.until(at(15, 0, 22) + 500).program
    expect(outro.cues).toEqual(['hour-out'])
    expect(outro.scene).toMatchObject({ mode: 'outro', open: 'hour', hour: '15:00' })

    const board = h.until(at(15, 0, 26)).program
    expect(board.key).toBe('board')
    expect(lines(board)).toContain('ON THE HOUR 2 stories at 15:00 · next report 16:00')
    expect(h.cues().map((cue) => cue.jingle)).toEqual(['hour', 'hour-out'])
  })

  it('waits for a story on air and shows the report as COMING UP', () => {
    const h = harness(at(14, 59, 0), [session('a'), session('b')])
    h.land([asking('a', at(14, 59, 52)), session('b')], at(14, 59, 52))
    const desk = h.until(at(15, 0, 0)).program
    expect(desk.key).toContain('story:a:1')
    expect(lines(desk)).toContain('COMING UP The 15:00 report')

    // The story's outro ends at 14:59:52 + 13.3 s; the report starts 2 s later
    expect(h.until(at(15, 0, 7)).program.key).toBe('board')
    const ident = h.until(at(15, 0, 7) + 500).program
    expect(ident.cues).toEqual(['hour'])
    expect(ident.reported).toBe(at(15))
    expect(ident.scene.mode).toBe('ident')
  })

  it('airs a late report when the window shows within ten minutes, and skips it after that', () => {
    const late = harness(at(14, 59, 0), afternoon())
    late.world.visible = false
    late.until(at(15, 5))
    expect(late.cues()).toEqual([])
    late.world.visible = true
    const shown = late.until(at(15, 5) + 250).program
    expect(shown.cues).toEqual(['hour'])
    expect(shown.reported).toBe(at(15))

    const tooLate = harness(at(14, 59, 0), afternoon())
    tooLate.world.visible = false
    tooLate.until(at(15, 11))
    tooLate.world.visible = true
    tooLate.until(at(15, 20))
    expect(tooLate.cues()).toEqual([])
    expect(tooLate.keys()).toEqual(['board'])
  })

  it('covers everything since the last report that aired', () => {
    const h = harness(at(15, 59, 0), afternoon())
    h.world.lastReportAt = at(13)
    h.until(at(15, 59, 55))
    const desk = h.until(at(16, 0, 3)).program
    expect(desk.scene).toMatchObject({
      headline: '2 STORIES',
      event: { figure: '+107 −27', foot: '13:00 to 16:00' },
    })
  })

  it('covers the last hour when the last report is too old to count', () => {
    const h = harness(at(15, 59, 0), afternoon())
    h.world.lastReportAt = at(15) - 30 * 60 * 60_000
    h.until(at(15, 59, 55))
    const desk = h.until(at(16, 0, 3)).program
    expect(desk.scene).toMatchObject({ event: { foot: '15:00 to 16:00' } })
  })

  it('leaves out the review in a quiet hour', () => {
    const h = harness(at(14, 59, 0), [session('a'), session('b', { state: 'ready' })])
    h.until(at(14, 59, 55))
    const desk = h.until(at(15, 0, 3)).program
    expect(desk.scene).toMatchObject({
      headline: 'A QUIET HOUR',
      strap: '1 session working, nothing needs you',
    })
    expect(lines(desk)[0]).toBe('ON THE HOUR A quiet hour: 1 session working')
    const board = h.until(at(15, 0, 30)).program
    expect(h.history.some((sample) => sample.program.scene.mode === 'review')).toBe(false)
    expect(board.key).toBe('board')
    expect(lines(board)).toContain('ON THE HOUR A quiet hour · next report 16:00')
    expect(h.cues().map((cue) => cue.jingle)).toEqual(['hour', 'hour-out'])
  })

  it('airs each hour once', () => {
    const h = harness(at(14, 59, 0), afternoon())
    h.until(at(16, 5))
    expect(h.history.filter((sample) => sample.program.reported !== null).map((sample) => sample.program.reported)).toEqual([
      at(15),
      at(16),
    ])
  })
})

describe('reduced motion', () => {
  it('shortens the openers to 1 s and leaves the outro out', () => {
    const h = harness(T0, [session('a')], { reducedMotion: true })
    expect(h.land([asking('a', T0 + 1000)], T0 + 1000).program.cues).toEqual(['breaking'])
    expect(h.until(T0 + 1750).program.key).toBe('story:a:1:0')
    expect(h.until(T0 + 2000).program.key).toBe('story:a:1:1')
    expect(h.until(T0 + 11_750).program.key).toBe('story:a:1:1')
    const back = h.until(T0 + 12_000).program
    expect(back.key).toBe('board')
    expect(back.cues).toEqual(['breaking-out'])
    expect(h.history.some((sample) => sample.program.scene.mode === 'outro')).toBe(false)
  })

  it('does the same for the report on the hour', () => {
    const h = harness(at(14, 59, 0), [session('a')], { reducedMotion: true })
    h.until(at(14, 59, 55))
    expect(h.history.at(-1)?.program.cues).toEqual(['hour'])
    expect(h.until(at(14, 59, 56)).program.key).toBe(`hour:${at(15)}:1`)
    h.until(at(15, 0, 30))
    expect(h.history.some((sample) => sample.program.scene.mode === 'outro')).toBe(false)
    expect(h.cues().map((cue) => cue.jingle)).toEqual(['hour', 'hour-out'])
    expect(h.history.at(-1)?.program.key).toBe('board')
  })
})
