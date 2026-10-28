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

// A whole number of the signal's 9 s loops since the epoch
const LOOP = Date.UTC(2026, 9, 21, 14, 33)

// The pictures that stand on the backdrop, and the layer each one draws it in
const STANDING: [string, string][] = [
  ['run-board', '.pn-broadcast.pn-mode-board'],
  ['hour-review', '.pn-broadcast.pn-mode-review'],
  ['review-seven', '.pn-broadcast.pn-mode-review'],
  ['brk-outro-1', '.pn-mode-outro > .pn-board-under'],
  ['hour-outro-1', '.pn-mode-outro > .pn-board-under'],
]

function sample(name: string): Scene {
  const scene = samples[name]
  if (scene === undefined) {
    throw new Error(`the design system has no sample ${name}`)
  }
  return scene
}

describe('the backdrop', () => {
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

  function draw(scene: Scene, animate: boolean): void {
    act(() =>
      root.render(
        <Stage width={960} animate={animate}>
          <Broadcast scene={scene} animate={animate} />
        </Stage>,
      ),
    )
  }

  function layer(selector: string): Element {
    const found = container.querySelector(selector)
    if (found === null) {
      throw new Error(`nothing is drawn at ${selector}`)
    }
    return found
  }

  // The backdrop beneath everything else in a layer: what it holds, by class
  function backdrop(selector: string): string[] {
    const first = layer(selector).firstElementChild
    expect(first?.className).toBe('pn-backdrop')
    expect(first?.getAttribute('aria-hidden')).toBe('true')
    return Array.from(first?.children ?? []).map((child) => child.className)
  }

  // Each wave's delay, in the order the waves are drawn
  function delays(selector: string): string[] {
    const waves = Array.from(layer(selector).querySelectorAll(':scope > .pn-backdrop > .pn-signal > i'))
    return waves.map((wave) => (wave as HTMLElement).style.animationDelay)
  }

  it("lays one backdrop beneath the board, THE HOUR IN REVIEW and an outro's board, the ring and its signal together", () => {
    vi.setSystemTime(LOOP + 1000)
    for (const [name, selector] of STANDING) {
      draw(sample(name), true)
      expect(backdrop(selector)).toEqual(['pn-backdrop-ring', 'pn-signal'])
      expect(container.querySelectorAll('.pn-backdrop')).toHaveLength(1)
    }
  })

  it('sends three waves, 3 s apart, from the ring', () => {
    vi.setSystemTime(LOOP + 1000)
    draw(sample('run-board'), true)
    expect(delays('.pn-mode-board')).toEqual(['-1000ms', '-4000ms', '-7000ms'])
  })

  it('sends the same waves behind every picture that stands on it, at the same moment', () => {
    vi.setSystemTime(LOOP + 8500)
    for (const [name, selector] of STANDING) {
      draw(sample(name), true)
      expect(delays(selector)).toEqual(['-8500ms', '-2500ms', '-5500ms'])
    }
  })

  it("carries the waves on from THE HOUR IN REVIEW through the hour's outro to the board", () => {
    // Each picture takes its waves from the clock as it is drawn, so they
    // are where the waves before it had got to: 3 s on, each is 3 s further
    vi.setSystemTime(LOOP + 1000)
    draw(sample('hour-review'), true)
    expect(delays('.pn-mode-review')).toEqual(['-1000ms', '-4000ms', '-7000ms'])
    vi.setSystemTime(LOOP + 4000)
    draw(sample('hour-outro-1'), true)
    expect(delays('.pn-mode-outro > .pn-board-under')).toEqual(['-4000ms', '-7000ms', '-1000ms'])
    vi.setSystemTime(LOOP + 5500)
    draw(sample('run-board'), true)
    expect(delays('.pn-mode-board')).toEqual(['-5500ms', '-8500ms', '-2500ms'])
  })

  it('shows the ring alone when the picture holds still', () => {
    vi.setSystemTime(LOOP + 1000)
    for (const [name, selector] of STANDING) {
      draw(sample(name), false)
      expect(backdrop(selector)).toEqual(['pn-backdrop-ring'])
    }
    expect(container.querySelector('.pn-signal')).toBeNull()
  })

  it('stays off the desks and the opens', () => {
    vi.setSystemTime(LOOP + 1000)
    for (const name of ['run-needs-input', 'hour-desk', 'brk-stinger-1', 'hour-ident-1']) {
      draw(sample(name), true)
      expect(container.querySelector(`.pn-mode-${sample(name).mode}`)).not.toBeNull()
      expect(container.querySelector('.pn-backdrop')).toBeNull()
    }
  })
})
