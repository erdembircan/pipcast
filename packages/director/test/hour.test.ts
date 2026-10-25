import { describe, expect, it } from 'vitest'

import type { Snapshot } from '@pipcast/contract'

import { hourReport } from '../src/hour.ts'
import { at, session, story } from './helpers.ts'

function snap(...sessions: ReturnType<typeof session>[]): Snapshot {
  return { now: at(14, 59, 55), visible: true, sessions, lastReportAt: null }
}

const context = { now: at(15), ticker: [], board: { mode: 'board' as const } }

describe('hourReport', () => {
  it('counts each session once, by its newest story in the window', () => {
    const early = story('a:1', 'needs-input', at(14, 5))
    const late = story('a:2', 'ready', at(14, 50), { added: 5, removed: 1, files: 1 })
    const before = story('b:1', 'error', at(13, 59))
    const after = story('c:1', 'complete', at(15))
    const { stories, segment } = hourReport(
      at(15),
      at(14),
      snap(
        session('a', { state: 'ready', stories: [early, late] }),
        session('b', { state: 'error', stories: [before] }),
        session('c', { state: 'ready', stories: [after] }),
      ),
      at(14, 59, 55),
      false,
    )
    expect(stories).toBe(1)
    const desk = segment.steps[1]?.scene(context)
    expect(desk).toMatchObject({ headline: '1 STORY', strap: '1 ready for review' })
  })

  it('sums the hours that fall in the window', () => {
    const { segment } = hourReport(
      at(15),
      at(13),
      snap(
        session('a', {
          hours: [
            { hour: '2026-10-21T12', added: 1000, removed: 1000, files: 9 },
            { hour: '2026-10-21T13', added: 10, removed: 1, files: 1 },
            { hour: '2026-10-21T14', added: 20, removed: 2, files: 1 },
            { hour: '2026-10-21T15', added: 1000, removed: 1000, files: 9 },
          ],
        }),
        session('b', { hours: [{ hour: '2026-10-21T14', added: 5, removed: 4, files: 1 }] }),
      ),
      at(14, 59, 55),
      false,
    )
    expect(segment.steps[1]?.scene(context).event).toMatchObject({
      figure: '+35 −7',
      sub: 'Across 2 sessions',
      foot: '13:00 to 15:00',
    })
  })

  it('has no review when nothing changed state, and the review otherwise', () => {
    const quiet = hourReport(at(15), at(14), snap(session('a')), at(14, 59, 55), false)
    expect(quiet.segment.steps.map((step) => step.role)).toEqual(['opener', 'desk', 'outro'])
    const busy = hourReport(
      at(15),
      at(14),
      snap(session('a', { stories: [story('a:1', 'complete', at(14, 30))] })),
      at(14, 59, 55),
      false,
    )
    expect(busy.segment.steps.map((step) => [step.role, step.length, step.cue])).toEqual([
      ['opener', 7500, 'hour'],
      ['desk', 10_000, undefined],
      ['review', 10_000, undefined],
      ['outro', 1600, 'hour-out'],
    ])
  })

  it('gives THE HOUR IN REVIEW 10 s for each page of four rows', () => {
    const lengthWith = (sessions: number): number | undefined => {
      const ids = Array.from({ length: sessions }, (_, i) => `s${i}`)
      const report = hourReport(
        at(15),
        at(14),
        snap(...ids.map((id, i) => session(id, i === 0 ? { stories: [story(`${id}:1`, 'complete', at(14, 30))] } : {}))),
        at(14, 59, 55),
        false,
      )
      return report.segment.steps.find((step) => step.role === 'review')?.length
    }
    expect(lengthWith(4)).toBe(10_000)
    expect(lengthWith(5)).toBe(20_000)
    expect(lengthWith(8)).toBe(20_000)
    expect(lengthWith(9)).toBe(30_000)
  })

  it('words the review rows from each session', () => {
    const waiting = story('a:1', 'needs-input', at(14, 50))
    const report = hourReport(
      at(15),
      at(14),
      snap(
        session('a', { state: 'needs-input', stories: [waiting] }),
        session('b', { state: 'error' }),
        session('c', { state: 'working' }),
        session('d', { state: 'working', hours: [{ hour: '2026-10-21T14', added: 3, removed: 0, files: 1 }] }),
      ),
      at(14, 59, 55),
      false,
    )
    expect(report.stories).toBe(1)
    const rows = report.segment.steps[2]?.scene(context).rows
    expect(rows?.map((row) => row.detail)).toEqual(['Waiting 9 min', 'Stopped on an error', 'No changes this hour', '+3 −0'])
  })

  it('names each review row as the board names its session: its title and its project', () => {
    const report = hourReport(
      at(15),
      at(14),
      snap(
        session('a', { title: 'Usage limits in the window', project: 'pipcast', stories: [story('a:1', 'complete', at(14, 30))] }),
        session('b', { title: 'Marketplace plugin distribution', project: 'pipcast' }),
      ),
      at(14, 59, 55),
      false,
    )
    const rows = report.segment.steps[2]?.scene(context).rows
    expect(rows?.map((row) => [row.id, row.project, row.name])).toEqual([
      ['a', 'pipcast', 'Usage limits in the window'],
      ['b', 'pipcast', 'Marketplace plugin distribution'],
    ])
  })

  it("lists the review rows in the listing's order", () => {
    const report = hourReport(
      at(15),
      at(14),
      snap(
        session('working', { state: 'working', stateAt: at(14, 40) }),
        session('finished-early', { state: 'ready', stateAt: at(14, 10), stories: [story('finished-early:1', 'ready', at(14, 10))] }),
        session('asking', { state: 'needs-input', stateAt: at(14, 50), stories: [story('asking:1', 'needs-input', at(14, 50))] }),
        session('finished-late', { state: 'ready', stateAt: at(14, 30), stories: [story('finished-late:1', 'complete', at(14, 30))] }),
      ),
      at(14, 59, 55),
      false,
    )
    const rows = report.segment.steps[2]?.scene(context).rows
    expect(rows?.map((row) => row.id)).toEqual(['asking', 'finished-late', 'finished-early', 'working'])
  })
})
