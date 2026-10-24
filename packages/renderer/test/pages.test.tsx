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

// The seven sessions of board-seven, in the listing's order
const SEVEN = [
  'Fix flaky checkout test',
  'Write release notes for 2.4',
  'Refactor auth middleware',
  'Migrate settings to SQLite',
  'Check last night’s crash reports',
  'Speed up product search',
  'Move CI to the new runners',
]
const FIRST = SEVEN.slice(0, 4)
const LAST = SEVEN.slice(4)

// The last thing to move in a turn: four rows apart, the leave and the enter
const TURN = 1320

describe("the listing's pages", () => {
  let container: HTMLElement
  let root: Root
  const original = window.matchMedia

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
    window.matchMedia = original
  })

  function draw(scene: Scene, animate = true): void {
    act(() =>
      root.render(
        <Stage width={960} animate={animate}>
          <Broadcast scene={scene} animate={animate} />
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

  const rows = (): string[] => texts('.pn-board .pn-row:not(.pn-turn-leave) .pn-row-name')

  function faces(selector: string, name: string): { name: string; delay: string }[] {
    return Array.from(container.querySelectorAll(selector)).map((row) => ({
      name: row.querySelector(name)?.textContent ?? '',
      delay: (row as HTMLElement).style.animationDelay,
    }))
  }
  const leaving = () => faces('.pn-board .pn-row.pn-turn-leave', '.pn-row-name')
  const entering = () => faces('.pn-board .pn-row.pn-turn-enter', '.pn-row-name')

  function tab(): string | null {
    if (container.querySelector('.pn-board-tab') === null) {
      return null
    }
    return container.querySelector('.pn-board-tab .pn-page:not(.pn-turn-leave) .pn-page-tab')?.textContent ?? null
  }

  const turning = (): number => container.querySelectorAll('.pn-turn-leave, .pn-turn-enter').length

  it('draws four or fewer as they are: one page, no tab, nothing turns', () => {
    draw(sample('run-return'))
    expect(rows()).toEqual(FIRST)
    expect(tab()).toBeNull()
    advance(20_000)
    expect(rows()).toEqual(FIRST)
    expect(turning()).toBe(0)
  })

  it('shows seven sessions four at a time and says which page', () => {
    draw(sample('board-seven'))
    expect(rows()).toEqual(FIRST)
    expect(tab()).toBe('1 OF 2')
  })

  it('turns the page every 8 s: rows leave to the right one after another and the next page slides in', () => {
    draw(sample('board-seven'))
    advance(8000)
    expect(leaving()).toEqual([
      { name: FIRST[0], delay: '0ms' },
      { name: FIRST[1], delay: '110ms' },
      { name: FIRST[2], delay: '220ms' },
      { name: FIRST[3], delay: '330ms' },
    ])
    expect(entering()).toEqual([
      { name: LAST[0], delay: '420ms' },
      { name: LAST[1], delay: '530ms' },
      { name: LAST[2], delay: '640ms' },
    ])
    const out = container.querySelector('.pn-board-tab .pn-page.pn-turn-leave') as HTMLElement
    expect(out.textContent).toBe('1 OF 2')
    expect(out.style.animationDelay).toBe('440ms')
    const into = container.querySelector('.pn-board-tab .pn-page.pn-turn-enter') as HTMLElement
    expect(into.textContent).toBe('2 OF 2')
    expect(into.style.animationDelay).toBe('860ms')

    advance(TURN)
    expect(turning()).toBe(0)
    expect(rows()).toEqual(LAST)
    expect(tab()).toBe('2 OF 2')

    advance(16_000 - 8000 - TURN)
    advance(TURN)
    expect(rows()).toEqual(FIRST)
    expect(tab()).toBe('1 OF 2')
  })

  it('keeps a change for the next turn', () => {
    draw(sample('board-seven'))
    advance(3000)
    const base = sample('board-seven')
    draw({
      ...base,
      sessions: (base.sessions ?? []).map((session) =>
        session.name === 'Move CI to the new runners' ? { ...session, state: 'needs-input' as const } : session,
      ),
    })
    expect(rows()).toEqual(FIRST)
    advance(7999 - 3000)
    expect(rows()).toEqual(FIRST)
    advance(1 + TURN)
    expect(rows()).toEqual(['Migrate settings to SQLite', 'Check last night’s crash reports', 'Speed up product search'])
  })

  it('comes back on its first page', () => {
    draw(sample('board-seven'))
    advance(8000 + TURN)
    expect(rows()).toEqual(LAST)
    draw(sample('run-needs-input'))
    draw(sample('board-seven'))
    expect(rows()).toEqual(FIRST)
    expect(tab()).toBe('1 OF 2')
    expect(turning()).toBe(0)
  })

  it('cuts from page to page with reduced motion, on the same clock', () => {
    window.matchMedia = ((query: string) => ({
      matches: query === '(prefers-reduced-motion: reduce)',
      media: query,
      addEventListener: () => undefined,
      removeEventListener: () => undefined,
      addListener: () => undefined,
      removeListener: () => undefined,
    })) as unknown as typeof window.matchMedia
    draw(sample('board-seven'))
    advance(8000)
    expect(turning()).toBe(0)
    expect(rows()).toEqual(LAST)
    expect(tab()).toBe('2 OF 2')
  })

  it('holds its first page and its tab when held still', () => {
    draw(sample('board-seven'), false)
    advance(20_000)
    expect(rows()).toEqual(FIRST)
    expect(tab()).toBe('1 OF 2')
  })

  it('holds the board under an outro on its first page', () => {
    draw({ mode: 'outro', clock: '14:40', progress: 1, board: sample('board-seven') })
    advance(9000)
    expect(texts('.pn-board-under .pn-row-name')).toEqual(FIRST)
    expect(texts('.pn-board-under .pn-board-tab .pn-page-tab')).toEqual(['1 OF 2'])
  })

  it("turns THE HOUR IN REVIEW's pages every 10 s, its tab in the header", () => {
    const names = (): string[] => texts('.pn-review .pn-review-row:not(.pn-turn-leave) .pn-review-name')
    const page = (): string | null =>
      container.querySelector('.pn-review-tab .pn-page:not(.pn-turn-leave) .pn-page-tab')?.textContent ?? null
    draw(sample('review-seven'))
    expect(names()).toEqual(FIRST)
    expect(page()).toBe('1 OF 2')
    advance(8000)
    expect(names()).toEqual(FIRST)
    expect(turning()).toBe(0)
    advance(2000 + TURN)
    expect(names()).toEqual(LAST)
    expect(page()).toBe('2 OF 2')
  })

  it('gives four review rows one page and no tab', () => {
    draw(sample('hour-review'))
    expect(container.querySelector('.pn-review-tab')).toBeNull()
  })
})
