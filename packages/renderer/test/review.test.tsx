// @vitest-environment jsdom
// react-global first: the design system's bundle reads window.React as it loads
import '../src/react-global.ts'

import { act } from 'react'
import { createRoot } from 'react-dom/client'
import type { Root } from 'react-dom/client'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import type { Scene } from '@pipcast/design'

import { Broadcast, Stage, samples } from '../src/design.ts'

const flag = globalThis as unknown as { IS_REACT_ACT_ENVIRONMENT: boolean }
flag.IS_REACT_ACT_ENVIRONMENT = true

function sample(name: string): Scene {
  const scene = samples[name]
  if (scene === undefined) {
    throw new Error(`the design system has no sample ${name}`)
  }
  return scene
}

// review-seven's rows in the listing's order, four a page: each session's
// project on its plate, then its title
const FIRST = [
  ['web-shop', 'Fix flaky checkout test'],
  ['docs-site', 'Write release notes for 2.4'],
  ['api-server', 'Refactor auth middleware'],
  ['desktop-app', 'Migrate settings to SQLite'],
]
const LAST = [
  ['mobile-app', 'Check last night’s crash reports'],
  ['search-api', 'Speed up product search'],
  ['ci-config', 'Move CI to the new runners'],
]

describe("THE HOUR IN REVIEW's rows, named as the board names them", () => {
  let container: HTMLElement
  let root: Root

  beforeEach(() => {
    vi.useFakeTimers()
    container = document.createElement('div')
    document.body.append(container)
    root = createRoot(container)
  })

  afterEach(() => {
    act(() => root.unmount())
    container.remove()
    vi.useRealTimers()
  })

  function draw(scene: Scene): void {
    act(() =>
      root.render(
        <Stage width={960} animate>
          <Broadcast scene={scene} animate />
        </Stage>,
      ),
    )
  }

  // Each row's plate and title line; null where a row has no plate
  const named = (selector: string): (string | null)[][] =>
    Array.from(container.querySelectorAll(selector)).map((row) => [
      row.querySelector('.pn-row-project')?.textContent ?? null,
      row.querySelector('.pn-review-name')?.textContent ?? null,
    ])

  it("leads each row with its project on a plate, then its title, in the listing's order", () => {
    draw(sample('review-seven'))
    expect(named('.pn-review .pn-review-row')).toEqual(FIRST)
  })

  it('puts the plate first, then the title over the figure, then the pill', () => {
    draw(sample('review-seven'))
    const row = container.querySelector('.pn-review .pn-review-row') as HTMLElement
    expect(Array.from(row.children).map((child) => child.className)).toEqual(['pn-row-project', 'pn-review-body', 'pn-pill pn-k-needs-input'])
    expect(Array.from(row.querySelectorAll('.pn-review-body > *')).map((child) => child.textContent)).toEqual(['Fix flaky checkout test', 'Waiting 27 min'])
  })

  it('tells apart sessions that share a project by their titles', () => {
    draw({
      mode: 'review',
      clock: '17:00',
      span: '16:00–17:00',
      rows: [
        { id: 'a', project: 'pipcast', name: 'Usage limits in the window', state: 'working', detail: 'No changes this hour' },
        { id: 'b', project: 'pipcast', name: 'Transparent PiP window until hovered (#121)', state: 'working', detail: '+621 −90' },
      ],
      ticker: [],
    })
    expect(named('.pn-review .pn-review-row')).toEqual([
      ['pipcast', 'Usage limits in the window'],
      ['pipcast', 'Transparent PiP window until hovered (#121)'],
    ])
  })

  it('gives a row with no project no plate, and names a row with no title by its project', () => {
    draw({
      mode: 'review',
      clock: '15:00',
      span: '14:00–15:00',
      rows: [
        { id: 'a', name: 'Fix the build', project: '', state: 'working', detail: '+3 −1' },
        { id: 'b', name: 'Write the docs', state: 'working', detail: '+9 −0' },
        { id: 'c', project: 'search-api', state: 'working', detail: '+240 −88' },
      ],
      ticker: [],
    })
    expect(named('.pn-review .pn-review-row')).toEqual([
      [null, 'Fix the build'],
      [null, 'Write the docs'],
      [null, 'search-api'],
    ])
  })

  it('turns the plate and the title with their row', () => {
    draw(sample('review-seven'))
    act(() => {
      vi.advanceTimersByTime(10_000)
    })
    expect(named('.pn-review .pn-review-row.pn-turn-leave')).toEqual(FIRST)
    expect(named('.pn-review .pn-review-row.pn-turn-enter')).toEqual(LAST)
  })
})
