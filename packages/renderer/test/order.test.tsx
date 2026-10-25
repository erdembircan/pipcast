// @vitest-environment jsdom
// react-global first: the design system's bundle reads window.React as it loads
import '../src/react-global.ts'

import { act } from 'react'
import { createRoot } from 'react-dom/client'
import type { Root } from 'react-dom/client'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import type { Scene } from '@pipcast/design'

import { Broadcast, Stage } from '../src/design.ts'

const flag = globalThis as unknown as { IS_REACT_ACT_ENVIRONMENT: boolean }
flag.IS_REACT_ACT_ENVIRONMENT = true

// The director puts the sessions in the listing's order. The window sorts
// them by state again, so it has to keep the director's order within each.
describe('the order the window draws', () => {
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

  it('sorts the listing by state and keeps the order it is given within each', () => {
    draw({
      mode: 'board',
      clock: '14:38',
      sessions: [
        { id: 'a', name: 'Fix the build', project: 'web-shop', state: 'working' },
        { id: 'b', name: 'Write the docs', project: 'docs-site', state: 'ready' },
        { id: 'c', name: 'Fix flaky checkout test', project: 'web-shop', state: 'needs-input' },
        { id: 'd', name: 'Release notes for 2.4', project: 'docs-site', state: 'ready' },
      ],
      ticker: [],
    })
    expect(texts('.pn-board .pn-row .pn-row-name')).toEqual([
      'Fix flaky checkout test',
      'Write the docs',
      'Release notes for 2.4',
      'Fix the build',
    ])
  })

  it('keeps the same order in THE HOUR IN REVIEW', () => {
    draw({
      mode: 'review',
      clock: '15:00',
      span: '14:00–15:00',
      rows: [
        { id: 'a', project: 'web-shop', name: 'Fix the build', state: 'working', detail: '+3 −1' },
        { id: 'b', project: 'docs-site', name: 'Write the docs', state: 'ready', detail: '+9 −0' },
        { id: 'c', project: 'web-shop', name: 'Fix flaky checkout test', state: 'needs-input', detail: 'Waiting 4 min' },
        { id: 'd', project: 'docs-site', name: 'Release notes for 2.4', state: 'ready', detail: '+182 −40' },
      ],
      ticker: [],
    })
    expect(texts('.pn-review .pn-review-row .pn-review-name')).toEqual([
      'Fix flaky checkout test',
      'Write the docs',
      'Release notes for 2.4',
      'Fix the build',
    ])
  })
})
