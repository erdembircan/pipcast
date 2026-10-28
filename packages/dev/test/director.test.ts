import { describe, expect, it } from 'vitest'

import {
  acrossSessions,
  clock,
  duration,
  figure,
  filesChanged,
  finishedFoot,
  hourHeadline,
  hourStrap,
  LEAD,
  quietStrap,
} from '../../contract/src/index.ts'
import type { Snapshot } from '../../contract/src/types.ts'
import { createDirector } from '../../director/src/director.ts'
import { DESK_MS, GAP_MS, IDENT_MS, REVIEW_MS, STINGER_MS } from '../../director/src/timing.ts'

import { CUE_WAIT_MS, createDevDirector } from '../src/director.ts'
import { DEFAULTS, T0, at, cue, devHarness, jingles, keys, session, story } from './helpers.ts'

describe('a story cue', () => {
  it('airs BREAKING NEWS as soon as the air is clear, with the sample story, and leaves nothing behind', () => {
    const h = devHarness(T0, [session('a')])
    h.until(T0 + 3000)
    h.dev.cue(cue({ id: 'c1', segment: 'story', stories: [{ kind: 'ready' }] }))
    const open = h.step()
    expect(open.program.key).toBe('story:dev-c1-0:1:0')
    expect(jingles(open.program)).toEqual(['breaking'])
    const desk = h.until(open.now + STINGER_MS + 250)
    expect(desk.program.key).toBe('story:dev-c1-0:1:1')
    expect(desk.program.scene.event).toMatchObject({
      kind: 'ready',
      session: 'Write release notes for 2.4',
      project: 'docs-site',
      figure: figure(182, 40),
      sub: filesChanged(4),
      foot: finishedFoot(duration(9 * 60_000)),
    })
    const after = h.until(open.now + 20_000)
    expect(after.program.key).toBe('board')
    expect((after.program.scene.sessions ?? []).map((row) => row.id)).toEqual(['a'])
    expect(h.lines).toEqual(['dev: c1 waits for the window to show and the air to clear', 'dev: c1 on air', 'dev: c1 off air'])
    expect(h.history.every((sample) => sample.program.reported === null)).toBe(true)
  })

  it('airs its own words and figures', () => {
    const h = devHarness(T0, [session('a')])
    h.until(T0 + 3000)
    h.dev.cue(cue({ id: 'c1', segment: 'story', stories: [{ kind: 'needs-input', title: 'Tidy up', project: 'docs', command: 'npm test', quote: 'Run the tests?', minutes: 3 }] }))
    const open = h.step()
    const desk = h.until(open.now + STINGER_MS + 250)
    expect(desk.program.scene.event).toMatchObject({ kind: 'needs-input', session: 'Tidy up', project: 'docs', command: 'npm test', quote: 'Run the tests?' })
    expect(desk.program.scene.event?.foot).toMatch(/^Waiting 3:0\d$/)
  })

  it('waits while the window is hidden, and airs once it shows', () => {
    const h = devHarness(T0, [session('a')])
    h.world.visible = false
    h.until(T0 + 3000)
    h.dev.cue(cue({ id: 'c1', segment: 'story', stories: [{ kind: 'ready' }] }))
    h.until(T0 + 60_000)
    expect(keys(h.history).some((key) => key.startsWith('story:'))).toBe(false)
    h.world.visible = true
    expect(h.step().program.key).toBe('story:dev-c1-0:1:0')
  })

  it("waits for the station's own story, and airs 2 s after it ends", () => {
    const a = session('a')
    const h = devHarness(T0, [a])
    h.until(T0 + 3000)
    h.world.sessions = [{ ...a, state: 'needs-input', stateAt: T0 + 3000, stories: [story('a:1', 'needs-input', T0 + 3000, { command: 'ls' })] }]
    const real = h.step()
    expect(real.program.key).toBe('story:a:1:0')
    h.dev.cue(cue({ id: 'c1', segment: 'story', stories: [{ kind: 'ready' }] }))
    h.until(real.now + 40_000)
    const realEnd = h.history.findIndex((sample, index) => index > 0 && sample.program.key === 'board' && h.history[index - 1]?.program.key.startsWith('story:a:1'))
    const cueStart = h.history.findIndex((sample) => sample.program.key === 'story:dev-c1-0:1:0')
    const ended = h.history[realEnd]?.now ?? 0
    const started = h.history[cueStart]?.now ?? 0
    expect(started - ended).toBeGreaterThanOrEqual(GAP_MS)
    expect(started - ended).toBeLessThan(GAP_MS + 500)
  })

  it('is dropped once it has waited five minutes', () => {
    const h = devHarness(T0, [session('a')])
    h.world.visible = false
    h.dev.cue(cue({ id: 'c1', segment: 'story', stories: [{ kind: 'ready' }] }))
    h.until(T0 + CUE_WAIT_MS + 1000)
    expect(h.lines).toContain('dev: c1 dropped: it waited 5 min for the window to show and the air to clear')
    h.world.visible = true
    h.until(T0 + CUE_WAIT_MS + 10_000)
    expect(keys(h.history).some((key) => key.startsWith('story:'))).toBe(false)
  })

  it('lands on a session on air that it names, which shows that story alone, then is itself again', () => {
    const a = session('a', { stories: [story('a:1', 'ready', T0 - 600_000)] })
    const h = devHarness(T0, [a])
    h.until(T0 + 3000)
    h.dev.cue(cue({ id: 'c1', segment: 'story', stories: [{ kind: 'needs-input', session: 'a' }] }))
    const open = h.step()
    const desk = h.until(open.now + STINGER_MS + 250)
    expect(desk.program.scene.event).toMatchObject({ kind: 'needs-input', session: 'Title a', project: 'project-a', command: 'npm install' })
    const outro = h.until(open.now + STINGER_MS + DESK_MS + 250)
    expect(outro.program.scene.mode).toBe('outro')
    expect(outro.program.scene.board?.sessions).toEqual([expect.objectContaining({ id: 'a', state: 'needs-input' })])
    const after = h.until(open.now + 20_000)
    expect(after.program.scene.sessions).toEqual([expect.objectContaining({ id: 'a', state: 'working' })])
  })

  it('lands on a session of its own when the session it names is not on air', () => {
    const h = devHarness(T0, [session('a')])
    h.until(T0 + 3000)
    h.dev.cue(cue({ id: 'c1', segment: 'story', stories: [{ kind: 'error', session: 'gone', title: 'Gone away' }] }))
    const open = h.step()
    const desk = h.until(open.now + STINGER_MS + 250)
    expect(desk.program.scene.event).toMatchObject({ kind: 'error', session: 'Gone away' })
    expect(h.lines).toContain('dev: c1: gone is not on air, so story 1 lands on a session of its own')
  })

  it('airs its stories one after another, the next one COMING UP', () => {
    const h = devHarness(T0, [session('a')])
    h.until(T0 + 3000)
    h.dev.cue(cue({ id: 'c1', segment: 'story', stories: [{ kind: 'error' }, { kind: 'complete' }] }))
    const open = h.step()
    const desk = h.until(open.now + STINGER_MS + 1000)
    expect(desk.program.scene.ticker).toContainEqual(expect.objectContaining({ lead: LEAD.comingUp }))
    h.until(open.now + 40_000)
    const seen = keys(h.history)
    expect(seen.indexOf('story:dev-c1-1:1:0')).toBeGreaterThan(seen.indexOf('story:dev-c1-0:1:2'))
  })

  it('leaves a story that lands meanwhile to the station, which airs it once, after the cue', () => {
    const a = session('a')
    const h = devHarness(T0, [a])
    h.until(T0 + 3000)
    h.dev.cue(cue({ id: 'c1', segment: 'story', stories: [{ kind: 'ready' }] }))
    const open = h.step()
    const desk = h.until(open.now + STINGER_MS + 1000)
    h.world.sessions = [{ ...a, state: 'needs-input', stateAt: desk.now, stories: [story('a:1', 'needs-input', desk.now, { command: 'ls' })] }]
    h.until(desk.now + 40_000)
    const seen = keys(h.history)
    expect(seen.filter((key) => key === 'story:a:1:0')).toHaveLength(1)
    expect(seen.indexOf('story:a:1:0')).toBeGreaterThan(seen.indexOf('story:dev-c1-0:1:2'))
  })

  it('is cut when the window hides, and never airs again', () => {
    const h = devHarness(T0, [session('a')])
    h.until(T0 + 3000)
    h.dev.cue(cue({ id: 'c1', segment: 'story', stories: [{ kind: 'ready' }] }))
    const open = h.step()
    h.until(open.now + STINGER_MS + 1000)
    h.world.visible = false
    const cut = h.step()
    expect(cut.program.sounds).toContainEqual({ type: 'hush' })
    expect(h.lines).toContain('dev: c1 off air')
    h.world.visible = true
    const from = h.history.length
    h.until(cut.now + 30_000)
    expect(keys(h.history.slice(from)).some((key) => key.startsWith('story:dev-c1'))).toBe(false)
  })

  it('brings a minimized window out, and airs once it is out', () => {
    const h = devHarness(T0, [session('a')])
    h.world.windowOut = false
    h.until(T0 + 3000)
    h.dev.cue(cue({ id: 'c1', segment: 'story', stories: [{ kind: 'ready' }] }))
    const asks = h.step()
    expect(asks.program.key).toBe('board')
    expect(asks.program.wantsWindow).toBe(true)
    h.world.windowOut = true
    expect(h.step().program.key).toBe('story:dev-c1-0:1:0')
  })

  it('leaves out the outro with reduced motion', () => {
    const h = devHarness(T0, [session('a')], { reducedMotion: true })
    h.until(T0 + 3000)
    h.dev.cue(cue({ id: 'c1', segment: 'story', stories: [{ kind: 'ready' }] }))
    h.until(T0 + 30_000)
    expect(keys(h.history).filter((key) => key.startsWith('story:dev-c1'))).toEqual(['story:dev-c1-0:1:0', 'story:dev-c1-0:1:1'])
    expect(h.history.some((sample) => jingles(sample.program).includes('breaking-out'))).toBe(true)
  })
})

describe('an hour cue', () => {
  const worked = () =>
    session('a', {
      state: 'ready',
      stateAt: at(14, 10),
      stories: [story('a:1', 'ready', at(14, 10), { added: 50, removed: 5, files: 1 })],
      hours: [{ hour: '2026-10-21T14', added: 50, removed: 5, files: 1 }],
    })

  // The director must queue the next hour's report on a tick five seconds before
  // it, with the window held to the side, and start it on the next tick at the
  // real time: the dev director brings the report forward that way
  it('airs the report on the next hour at once, from the sessions on air, on the real clock', () => {
    const h = devHarness(T0, [worked()])
    h.until(T0 + 3000)
    h.dev.cue(cue({ id: 'h1', segment: 'hour' }))
    const ident = h.step()
    expect(ident.program.key).toBe(`hour:${at(15)}:0`)
    expect(jingles(ident.program)).toEqual(['hour'])
    expect(ident.program.scene).toMatchObject({ mode: 'ident', hour: '15:00' })
    const desk = h.until(ident.now + IDENT_MS)
    expect(desk.program.key).toBe(`hour:${at(15)}:1`)
    expect(desk.program.scene).toMatchObject({
      clock: clock(desk.now),
      headline: hourHeadline(1),
      strap: hourStrap({ needsInput: 0, ready: 1, complete: 0, error: 0 }),
    })
    expect(desk.program.scene.event).toMatchObject({ figure: figure(50, 5), sub: acrossSessions(1) })
  })

  it('leaves the real hour as it was: no report is posted, and the report at the hour still airs', () => {
    const h = devHarness(T0, [worked()])
    h.until(T0 + 3000)
    h.dev.cue(cue({ id: 'h1', segment: 'hour' }))
    h.until(at(14, 59, 50))
    expect(h.history.every((sample) => sample.program.reported === null)).toBe(true)
    const real = h.until(at(14, 59, 55))
    expect(real.program.key).toBe(`hour:${at(15)}:0`)
    expect(real.program.reported).toBe(at(15))
  })

  it("covers the design system's sample sessions, a review page for every four", () => {
    const h = devHarness(T0, [session('a')])
    h.until(T0 + 3000)
    h.dev.cue(cue({ id: 'h2', segment: 'hour', samples: 5 }))
    const ident = h.step()
    const desk = h.until(ident.now + IDENT_MS)
    expect(desk.program.scene.event).toMatchObject({ figure: figure(1468, 365), sub: acrossSessions(5) })
    expect(desk.program.scene).toMatchObject({ headline: hourHeadline(2), strap: hourStrap({ needsInput: 1, ready: 1, complete: 0, error: 0 }) })
    const review = h.until(ident.now + IDENT_MS + DESK_MS)
    expect(review.program.key).toBe(`hour:${at(15)}:2`)
    expect((review.program.scene.rows ?? []).map((row) => row.name)).toEqual(
      expect.arrayContaining(DEFAULTS.sessions.slice(0, 5).map((sample) => sample.title)),
    )
    expect((review.program.scene.rows ?? []).some((row) => row.id === 'a')).toBe(false)
    const outro = h.until(ident.now + IDENT_MS + DESK_MS + 2 * REVIEW_MS)
    expect(outro.program.scene.mode).toBe('outro')
  })

  it('makes a quiet hour of them: no story, so no review', () => {
    const h = devHarness(T0, [session('a')])
    h.until(T0 + 3000)
    h.dev.cue(cue({ id: 'h3', segment: 'hour', samples: 4, quiet: true }))
    const ident = h.step()
    const desk = h.until(ident.now + IDENT_MS)
    expect(desk.program.scene).toMatchObject({ headline: hourHeadline(0), strap: quietStrap(4) })
    const next = h.until(ident.now + IDENT_MS + DESK_MS)
    expect(next.program.scene.mode).toBe('outro')
  })
})

describe('the dev director', () => {
  it('with no cue, airs what the director does, tick for tick', () => {
    const plain = createDirector()
    const dev = createDevDirector({ defaults: DEFAULTS, log: () => undefined })
    let sessions = [session('b')]
    for (let n = 0; n < 7_400; n += 1) {
      const now = at(14, 30) + n * 250
      if (n === 40) {
        sessions = [{ ...sessions[0]!, state: 'ready', stateAt: now, stories: [story('b:1', 'ready', now, { added: 3, removed: 1, files: 1 })] }]
      }
      const snapshot: Snapshot = { now, visible: true, sessions, lastReportAt: null }
      expect(dev.tick({ now, snapshot })).toEqual(plain.tick({ now, snapshot }))
    }
  })

  it('drops what is not a cue, and a cue that comes twice, saying why', () => {
    const h = devHarness(T0, [session('a')])
    h.dev.cue('{')
    h.dev.cue(cue({ id: 'c1', segment: 'news' }))
    h.dev.cue(cue({ id: 'c2', segment: 'story', stories: [{ kind: 'ready' }] }))
    h.dev.cue(cue({ id: 'c2', segment: 'story', stories: [{ kind: 'ready' }] }))
    expect(h.lines).toEqual([
      'dev: a cue was dropped: not JSON',
      'dev: a cue was dropped: segment must be story or hour',
      'dev: c2 waits for the window to show and the air to clear',
      'dev: c2 came twice; the second was dropped',
    ])
  })
})
