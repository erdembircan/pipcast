// @vitest-environment jsdom
/// <reference types="node" />
// react-global first: the design system's bundle reads window.React as it loads
import '../src/react-global.ts'

import { readFileSync } from 'node:fs'
import { URL as NodeURL, fileURLToPath } from 'node:url'

import { act } from 'react'
import { createRoot } from 'react-dom/client'
import type { Root } from 'react-dom/client'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import type { Scene } from '@pipcast/design'

import { Broadcast, Stage } from '../src/design.ts'

const flag = globalThis as unknown as { IS_REACT_ACT_ENVIRONMENT: boolean }
flag.IS_REACT_ACT_ENVIRONMENT = true

const NUMBER = /-?(?:\d+\.?\d*|\.\d+)(?:e[-+]?\d+)?/gi

function numbers(text: string): number[] {
  return (text.match(NUMBER) ?? []).map(parseFloat)
}

type Frame = Record<string, string | number | null | undefined>

interface Run {
  element: Element
  keyframes: Frame[]
  options: { duration: number; fill: string }
  animation: { cancel: ReturnType<typeof vi.fn> }
}

interface Mounted {
  container: HTMLElement
  root: Root
  mounted: boolean
}

// the pieces' value at an offset, between the two keyframes that bracket it
function valueAt(keyframes: Frame[], offset: number, name: string): number[] {
  let lo = keyframes[0]
  let hi = keyframes[keyframes.length - 1]
  for (const frame of keyframes) {
    if ((frame.offset as number) <= offset) lo = frame
  }
  for (const frame of [...keyframes].reverse()) {
    if ((frame.offset as number) >= offset) hi = frame
  }
  const from = numbers(String(lo?.[name]))
  const to = numbers(String(hi?.[name]))
  const span = ((hi?.offset as number) ?? 0) - ((lo?.offset as number) ?? 0)
  const t = span === 0 ? 0 : (offset - ((lo?.offset as number) ?? 0)) / span
  return from.map((v, i) => v + ((to[i] ?? v) - v) * t)
}

const BREAKING: Scene = {
  mode: 'stinger',
  event: { kind: 'needs-input', session: 'Fix flaky checkout test', project: 'web-shop' },
} as Scene
const BREAKING_OUTRO: Scene = { mode: 'outro', board: { mode: 'board' } } as Scene
const HOUR: Scene = { mode: 'ident', hour: '15:00' } as Scene
const HOUR_OUTRO: Scene = { mode: 'outro', open: 'hour', hour: '15:00', board: { mode: 'board' } } as Scene

const RUNS = [
  { name: 'BREAKING NEWS', scene: BREAKING, duration: 1400, pieces: 72, crawl: false },
  { name: "BREAKING NEWS's outro", scene: BREAKING_OUTRO, duration: 1200, pieces: 73, crawl: true },
  { name: 'ON THE HOUR', scene: HOUR, duration: 7500, pieces: 12, crawl: false },
  { name: "the hour's outro", scene: HOUR_OUTRO, duration: 1400, pieces: 13, crawl: true },
]

describe('the opens and outros on the compositor', () => {
  let runs: Run[]
  let roots: Mounted[]

  beforeEach(() => {
    runs = []
    roots = []
    Object.defineProperty(Element.prototype, 'animate', {
      configurable: true,
      writable: true,
      value: function (this: Element, keyframes: Frame[], options: Run['options']) {
        const animation = { cancel: vi.fn() }
        runs.push({ element: this, keyframes, options, animation })
        return animation
      },
    })
  })

  afterEach(() => {
    delete (Element.prototype as unknown as { animate?: unknown }).animate
    delete (window as unknown as { matchMedia?: unknown }).matchMedia
    for (const entry of roots) {
      if (entry.mounted) act(() => entry.root.unmount())
      entry.container.remove()
    }
    vi.useRealTimers()
    vi.restoreAllMocks()
  })

  function mount(element: React.ReactElement): Mounted {
    const container = document.createElement('div')
    document.body.append(container)
    const root = createRoot(container)
    const entry = { container, root, mounted: true }
    roots.push(entry)
    act(() => root.render(element))
    return entry
  }

  function unmount(entry: Mounted): void {
    act(() => entry.root.unmount())
    entry.mounted = false
  }

  function play(scene: Scene): Mounted {
    return mount(
      <Stage width={960} animate>
        <Broadcast scene={scene} animate />
      </Stage>,
    )
  }

  function still(scene: Scene, progress: number): Mounted {
    return mount(
      <Stage width={960} animate={false}>
        <Broadcast scene={{ ...scene, progress } as Scene} animate={false} />
      </Stage>,
    )
  }

  function runOf(id: string): Run | undefined {
    return runs.find((run) => run.element.getAttribute('data-pn-move') === id)
  }

  function mockReducedMotion(): void {
    Object.defineProperty(window, 'matchMedia', {
      configurable: true,
      writable: true,
      value: (query: string) => ({
        matches: query.includes('prefers-reduced-motion'),
        media: query,
        onchange: null,
        addListener: () => undefined,
        removeListener: () => undefined,
        addEventListener: () => undefined,
        removeEventListener: () => undefined,
        dispatchEvent: () => false,
      }),
    })
  }

  it.each(RUNS)('hand each moving piece of $name to the compositor once, for the whole run', ({ scene, duration, pieces }) => {
    const { container } = play(scene)
    expect(runs).toHaveLength(pieces)
    expect(container.querySelectorAll('[data-pn-move]')).toHaveLength(pieces)
    expect(new Set(runs.map((run) => run.element)).size).toBe(pieces)
    for (const el of Array.from(container.querySelectorAll('[data-pn-move]'))) {
      expect(runs.some((run) => run.element === el)).toBe(true)
    }
    for (const run of runs) {
      expect(run.options).toEqual({ duration, fill: 'both' })
      const offsets = run.keyframes.map((frame) => frame.offset as number)
      expect(offsets[0]).toBe(0)
      expect(offsets[offsets.length - 1]).toBe(1)
      offsets.forEach((offset, i) => {
        if (i > 0) expect(offset).toBeGreaterThan(offsets[i - 1] ?? 0)
      })
    }
  })

  it.each(RUNS)('play $name as the storyboard draws it, moment for moment', ({ scene, duration }) => {
    play(scene)
    const n = Math.round((duration / 1000) * 60)
    const moments: number[] = []
    for (let k = 0; k < n; k += 5) moments.push(k)
    moments.push(n)
    for (const k of moments) {
      const frame = still(scene, k / n)
      const drawn = new Map<string, Element>()
      frame.container.querySelectorAll('[data-pn-move]').forEach((el) => {
        drawn.set(el.getAttribute('data-pn-move') ?? '', el)
      })
      for (const run of runs) {
        const id = run.element.getAttribute('data-pn-move') ?? ''
        const el = drawn.get(id) as HTMLElement | undefined
        expect(el, `${id} at ${k}/${n}`).toBeDefined()
        const names = new Set(run.keyframes.flatMap((keyframe) => Object.keys(keyframe)))
        names.delete('offset')
        for (const name of names) {
          const want = valueAt(run.keyframes, k / n, name)
          const got = numbers(el?.style.getPropertyValue(name) ?? '')
          expect(got, `${id} ${name} at ${k}/${n}`).toHaveLength(want.length)
          got.forEach((value, i) =>
            expect(Math.abs(value - (want[i] ?? NaN)), `${id} ${name} at ${k}/${n}`).toBeLessThanOrEqual(0.002),
          )
        }
      }
      unmount(frame)
    }
  })

  it.each(RUNS)("leave $name's pictures alone while it plays", ({ scene, duration, crawl }) => {
    vi.useFakeTimers()
    const interval = vi.spyOn(globalThis, 'setInterval')
    const { container } = play(scene)
    const open = container.querySelector('.pn-stinger, .pn-ident')
    const before = open?.outerHTML
    expect(before).toBeTruthy()
    act(() => {
      vi.advanceTimersByTime(duration + 500)
    })
    expect(open?.outerHTML).toBe(before)
    // Nothing draws the open from a timer. The one interval an outro starts is
    // the crawl's, under the board it fades to: it looks at its belt four times a second
    expect(interval.mock.calls.map((call) => call[1])).toEqual(crawl ? [250] : [])
  })

  it.each(RUNS)('stop $name when it leaves the air', ({ scene, pieces }) => {
    const entry = play(scene)
    expect(runs).toHaveLength(pieces)
    unmount(entry)
    for (const run of runs) expect(run.animation.cancel).toHaveBeenCalledTimes(1)
  })

  it('turn the seconds hand on through the hour, never back round the dial', () => {
    play(HOUR)
    const hand = runOf('second-hand')
    expect(hand).toBeDefined()
    const angles = (hand?.keyframes ?? []).map((frame) => numbers(String(frame.transform))[0] ?? NaN)
    expect(angles[0]).toBeCloseTo(324, 3)
    expect(angles[angles.length - 1]).toBeCloseTo(372, 3)
    angles.forEach((angle, i) => {
      if (i > 0) expect(Math.abs(angle - (angles[i - 1] ?? NaN))).toBeLessThanOrEqual(6)
    })
  })

  it('fold a run that moves in a straight line to its two ends', () => {
    const turns = (id: string): number[][] =>
      (runOf(id)?.keyframes ?? []).map((frame) => numbers(String(frame.transform)))

    const entry = play(HOUR)
    expect(turns('rays')).toEqual([[0], [30]])
    unmount(entry)
    runs.length = 0

    const outro = play(HOUR_OUTRO)
    expect(turns('rays')).toEqual([[30], [42]])
    unmount(outro)
    runs.length = 0

    play(BREAKING)
    const panes = runs.filter((run) => /^pane-/.test(run.element.getAttribute('data-pn-move') ?? ''))
    expect(panes).toHaveLength(66)
    for (const pane of panes) {
      expect(pane.keyframes.length).toBeGreaterThanOrEqual(3)
      expect(pane.keyframes.length).toBeLessThanOrEqual(10)
    }
  })

  it('keep the last frame under reduced motion, and start nothing', () => {
    mockReducedMotion()
    const { container } = play(BREAKING)
    expect(runs).toHaveLength(0)
    const last = still(BREAKING, 1).container
    expect(container.querySelector('.pn-stinger')?.outerHTML).toBe(last.querySelector('.pn-stinger')?.outerHTML)
  })

  it('keep the last frame where there is no Web Animations API', () => {
    delete (Element.prototype as unknown as { animate?: unknown }).animate
    expect(typeof Element.prototype.animate).toBe('undefined')
    let entry: Mounted | undefined
    expect(() => {
      entry = play(BREAKING)
    }).not.toThrow()
    const last = still(BREAKING, 1).container
    expect(entry?.container.querySelector('.pn-stinger')?.outerHTML).toBe(last.querySelector('.pn-stinger')?.outerHTML)
  })
})

describe("bundle.css's keyframes", () => {
  it('animate only transform, opacity and filter, which the compositor plays', () => {
    const css = readFileSync(fileURLToPath(new NodeURL('../../../design/components/bundle.css', import.meta.url)), 'utf8')
    const names: string[] = []
    const properties = new Set<string>()
    const start = /@keyframes\s+([\w-]+)\s*\{/g
    let found: RegExpExecArray | null
    while ((found = start.exec(css)) !== null) {
      names.push(found[1] ?? '')
      let depth = 1
      let i = start.lastIndex
      while (depth > 0 && i < css.length) {
        if (css[i] === '{') depth += 1
        else if (css[i] === '}') depth -= 1
        i += 1
      }
      const body = css.slice(start.lastIndex, i - 1)
      for (const decl of body.matchAll(/([a-z-]+)\s*:/g)) properties.add(decl[1] ?? '')
    }
    expect(names).toContain('pn-sweep')
    expect(names).not.toContain('pn-glint')
    expect(Array.from(properties).filter((name) => !['transform', 'opacity', 'filter'].includes(name))).toEqual([])
    expect(properties.size).toBeGreaterThan(0)
  })
})
