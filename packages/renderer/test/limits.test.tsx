// @vitest-environment jsdom
// react-global first: the design system's bundle reads window.React as it loads
import '../src/react-global.ts'

import { act } from 'react'
import { createRoot } from 'react-dom/client'
import type { Root } from 'react-dom/client'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import type { LimitMeter, Scene } from '@pipcast/design'

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

// A board with the limits given
function boardWith(limits: LimitMeter[]): Scene {
  return { ...sample('board-limits'), limits }
}

describe('the usage limits on the board', () => {
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

  function advance(ms: number): void {
    act(() => {
      vi.advanceTimersByTime(ms)
    })
  }

  const texts = (selector: string): string[] => Array.from(container.querySelectorAll(selector)).map((node) => node.textContent ?? '')

  const meters = (): HTMLElement[] => Array.from(container.querySelectorAll<HTMLElement>('.pn-board .pn-board-limits .pn-limit'))

  it('puts the two meters under the listing, SESSION then WEEK, each with its figure', () => {
    draw(sample('board-limits'))
    expect(meters()).toHaveLength(2)
    expect(texts('.pn-board-limits .pn-ticker-lead')).toEqual(['SESSION', 'WEEK'])
    expect(texts('.pn-board-limits .pn-limit-figure')).toEqual(['42%', '61%'])
  })

  it('fills each meter to the share used', () => {
    draw(sample('board-limits'))
    const widths = Array.from(container.querySelectorAll<HTMLElement>('.pn-board-limits .pn-limit-fill')).map((fill) => fill.style.width)
    expect(widths).toEqual(['42%', '61%'])
  })

  it('turns a meter gold from 70% and red from 90%', () => {
    const classes = (percent: number): string => {
      draw(boardWith([{ kind: 'session', percent }]))
      return meters()[0]?.className ?? ''
    }
    expect(classes(69)).toBe('pn-limit')
    expect(classes(70)).toBe('pn-limit pn-limit--high')
    expect(classes(89)).toBe('pn-limit pn-limit--high')
    expect(classes(90)).toBe('pn-limit pn-limit--top')
    expect(classes(100)).toBe('pn-limit pn-limit--top')
  })

  it('names each meter for VoiceOver', () => {
    draw(sample('board-limits'))
    expect(meters().map((meter) => meter.getAttribute('role'))).toEqual(['img', 'img'])
    expect(meters().map((meter) => meter.getAttribute('aria-label'))).toEqual(['Session limit, 42% used', 'Weekly limit, 61% used'])
  })

  it('draws only the limit that has a reading', () => {
    draw(boardWith([{ kind: 'week', percent: 61 }]))
    expect(meters()).toHaveLength(1)
    expect(texts('.pn-board-limits .pn-ticker-lead')).toEqual(['WEEK'])
  })

  it('draws the session\'s meter first whatever the order', () => {
    draw(
      boardWith([
        { kind: 'week', percent: 61 },
        { kind: 'session', percent: 42 },
      ]),
    )
    expect(texts('.pn-board-limits .pn-ticker-lead')).toEqual(['SESSION', 'WEEK'])
    expect(texts('.pn-board-limits .pn-limit-figure')).toEqual(['42%', '61%'])
  })

  it('draws no meters before a reading', () => {
    draw(sample('run-board'))
    expect(container.querySelector('.pn-board')).not.toBeNull()
    expect(container.querySelector('.pn-board-limits')).toBeNull()
  })

  it('keeps the meters in place while the pages turn', () => {
    draw(sample('board-limits-near'))
    const before = container.querySelector('.pn-board-limits')
    expect(before).not.toBeNull()
    expect(texts('.pn-board-limits .pn-limit-figure')).toEqual(['74%', '92%'])
    const tab = (): string | null => container.querySelector('.pn-board-tab .pn-page:not(.pn-turn-leave) .pn-page-tab')?.textContent ?? null
    expect(tab()).toBe('1 OF 2')

    advance(8000 + 1320)
    expect(tab()).toBe('2 OF 2')
    expect(container.querySelector('.pn-board-limits')).toBe(before)
    expect(texts('.pn-board-limits .pn-limit-figure')).toEqual(['74%', '92%'])
  })

  it('shows the meters on the board under an outro', () => {
    draw(sample('limits-outro'))
    expect(container.querySelector('.pn-board-under .pn-board-limits')).not.toBeNull()
    expect(texts('.pn-board-under .pn-limit-figure')).toEqual(['42%', '61%'])
  })

  it('leaves the meters off the desk and THE HOUR IN REVIEW', () => {
    const limits: LimitMeter[] = [
      { kind: 'session', percent: 42 },
      { kind: 'week', percent: 61 },
    ]
    draw({ ...sample('ready-desk'), limits })
    expect(container.querySelector('.pn-board-limits')).toBeNull()
    draw({ ...sample('hour-review'), limits })
    expect(container.querySelector('.pn-board-limits')).toBeNull()
  })
})
