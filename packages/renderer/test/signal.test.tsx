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

function sample(name: string): Scene {
  const scene = samples[name]
  if (scene === undefined) {
    throw new Error(`the design system has no sample ${name}`)
  }
  return scene
}

describe("the board's signal", () => {
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

  // Each wave's delay, in the order the waves are drawn
  function delays(layer: Element | null): string[] {
    const waves = layer === null ? [] : Array.from(layer.querySelectorAll(':scope > .pn-signal > i'))
    return waves.map((wave) => (wave as HTMLElement).style.animationDelay)
  }

  it('sends three waves, 3 s apart, from the ring behind the board', () => {
    vi.setSystemTime(LOOP + 1000)
    draw(sample('run-board'), true)
    const board = container.querySelector('.pn-broadcast.pn-mode-board')
    expect(board?.querySelector(':scope > .pn-signal')?.getAttribute('aria-hidden')).toBe('true')
    expect(delays(board)).toEqual(['-1000ms', '-4000ms', '-7000ms'])
  })

  it('takes each wave from the clock, so a board drawn later carries on the same waves', () => {
    vi.setSystemTime(LOOP + 8500)
    draw(sample('run-board'), true)
    expect(delays(container.querySelector('.pn-mode-board'))).toEqual(['-8500ms', '-2500ms', '-5500ms'])
  })

  it("sends the same waves under an outro's board, after BREAKING NEWS and after the hour", () => {
    vi.setSystemTime(LOOP + 1000)
    for (const name of ['brk-outro-1', 'hour-outro-1']) {
      draw(sample(name), true)
      expect(delays(container.querySelector('.pn-mode-outro > .pn-board-under'))).toEqual(['-1000ms', '-4000ms', '-7000ms'])
    }
  })

  it("puts the ring's layer under an outro's board, still or not", () => {
    draw(sample('brk-outro-1'), false)
    expect(container.querySelector('.pn-mode-outro > .pn-board-under')).not.toBeNull()
  })

  it('draws no signal when the picture holds still', () => {
    vi.setSystemTime(LOOP + 1000)
    draw(sample('run-board'), false)
    expect(container.querySelector('.pn-mode-board')).not.toBeNull()
    expect(container.querySelector('.pn-signal')).toBeNull()
    draw(sample('brk-outro-1'), false)
    expect(container.querySelector('.pn-signal')).toBeNull()
  })

  it('stays off the desk, the opens and THE HOUR IN REVIEW', () => {
    vi.setSystemTime(LOOP + 1000)
    for (const name of ['run-needs-input', 'brk-stinger-1', 'hour-ident-1', 'hour-review']) {
      draw(sample(name), true)
      expect(container.querySelector(`.pn-mode-${sample(name).mode}`)).not.toBeNull()
      expect(container.querySelector('.pn-signal')).toBeNull()
    }
  })
})
