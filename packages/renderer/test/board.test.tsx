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

// The projects of board-seven, in the listing's order, four a page
const FIRST = ['web-shop', 'docs-site', 'api-server', 'desktop-app']
const LAST = ['mobile-app', 'search-api', 'ci-config']

describe("the listing's project plates", () => {
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

  const texts = (selector: string): string[] => Array.from(container.querySelectorAll(selector)).map((node) => node.textContent ?? '')

  it("leads each row with its project as written, in the listing's order", () => {
    draw(sample('run-return'))
    expect(texts('.pn-board .pn-row .pn-row-project')).toEqual(FIRST)
  })

  it('puts the plate before the title and the pill', () => {
    draw(sample('run-return'))
    const row = container.querySelector('.pn-board .pn-row') as HTMLElement
    expect(Array.from(row.children).map((child) => child.className)).toEqual(['pn-row-project', 'pn-row-name', 'pn-pill pn-k-needs-input'])
  })

  it('gives a session with no project no plate', () => {
    draw({
      mode: 'board',
      clock: '14:38',
      sessions: [
        { id: 'a', name: 'Fix the build', project: '', state: 'working' },
        { id: 'b', name: 'Write the docs', state: 'working' },
        { id: 'c', name: 'Speed up search', project: 'search-api', state: 'working' },
      ],
      ticker: [],
    })
    const plates = Array.from(container.querySelectorAll('.pn-board .pn-row')).map(
      (row) => row.querySelector('.pn-row-project')?.textContent ?? null,
    )
    expect(plates).toEqual([null, null, 'search-api'])
  })

  it('turns the plate with its row', () => {
    draw(sample('board-seven'))
    act(() => {
      vi.advanceTimersByTime(8000)
    })
    expect(texts('.pn-board .pn-row.pn-turn-leave .pn-row-project')).toEqual(FIRST)
    expect(texts('.pn-board .pn-row.pn-turn-enter .pn-row-project')).toEqual(LAST)
  })

  it('keeps the plates on the board under an outro', () => {
    draw({ mode: 'outro', clock: '14:40', progress: 1, board: sample('board-seven') })
    expect(texts('.pn-board-under .pn-row-project')).toEqual(FIRST)
  })
})
