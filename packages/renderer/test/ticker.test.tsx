// @vitest-environment jsdom
import '../src/react-global.ts'

import { act } from 'react'
import { createRoot } from 'react-dom/client'
import type { Root } from 'react-dom/client'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import type { Scene, TickerItem } from '@pipcast/design'

import { Broadcast, Stage, Ticker } from '../src/design.ts'

const flag = globalThis as unknown as { IS_REACT_ACT_ENVIRONMENT: boolean }
flag.IS_REACT_ACT_ENVIRONMENT = true

const VIEW = 600

interface FakeRun {
  node: HTMLElement
  keyframes: Keyframe[]
  options: KeyframeAnimationOptions
  startTime: number | null
  cancel: ReturnType<typeof vi.fn>
}

describe('the ticker on air', () => {
  let container: HTMLElement
  let root: Root

  // jsdom has no layout, no compositor and no clock of its own worth the name
  let clock = 0
  let perChar = 10
  let runs: FakeRun[] = []
  let timers = new Map<number, () => void>()
  let nextTimer = 1
  let visibility: DocumentVisibilityState = 'visible'
  const original = {
    matchMedia: window.matchMedia,
    clientWidth: Object.getOwnPropertyDescriptor(HTMLElement.prototype, 'clientWidth'),
  }

  beforeEach(() => {
    clock = 1000
    perChar = 10
    runs = []
    timers = new Map()
    nextTimer = 1
    visibility = 'visible'

    // jsdom has no document.timeline, so the belt reads performance.now()
    vi.spyOn(window.performance, 'now').mockImplementation(() => clock)

    const getComputedStyle = window.getComputedStyle.bind(window)
    vi.spyOn(window, 'getComputedStyle').mockImplementation((element: Element, pseudo?: string | null) => {
      if (element.classList.contains('pn-ticker-unit')) {
        return { width: `${(element.textContent ?? '').length * perChar}px` } as CSSStyleDeclaration
      }
      return getComputedStyle(element, pseudo)
    })
    Object.defineProperty(HTMLElement.prototype, 'clientWidth', {
      configurable: true,
      get(this: HTMLElement) {
        return this.classList.contains('pn-ticker-view') ? VIEW : 0
      },
    })
    Object.defineProperty(Element.prototype, 'animate', {
      configurable: true,
      writable: true,
      value: function (this: HTMLElement, keyframes: Keyframe[], options: KeyframeAnimationOptions) {
        const run: FakeRun = { node: this, keyframes, options, startTime: null, cancel: vi.fn() }
        runs.push(run)
        return run
      },
    })
    vi.spyOn(window, 'setInterval').mockImplementation(((fn: () => void) => {
      const id = nextTimer
      nextTimer += 1
      timers.set(id, fn)
      return id
    }) as unknown as typeof window.setInterval)
    vi.spyOn(window, 'clearInterval').mockImplementation(((id: number) => {
      timers.delete(id)
    }) as unknown as typeof window.clearInterval)
    Object.defineProperty(document, 'visibilityState', { configurable: true, get: () => visibility })

    container = document.createElement('div')
    document.body.append(container)
    root = createRoot(container)
  })

  afterEach(() => {
    act(() => root.unmount())
    container.remove()
    vi.restoreAllMocks()
    Reflect.deleteProperty(Element.prototype, 'animate')
    Reflect.deleteProperty(document, 'visibilityState')
    Reflect.deleteProperty(window, 'ResizeObserver')
    window.matchMedia = original.matchMedia
    if (original.clientWidth === undefined) {
      Reflect.deleteProperty(HTMLElement.prototype, 'clientWidth')
    } else {
      Object.defineProperty(HTMLElement.prototype, 'clientWidth', original.clientWidth)
    }
  })

  // Advances the clock by `ms` and runs the belt's look once
  function look(ms: number) {
    act(() => {
      clock += ms
      for (const fn of [...timers.values()]) {
        fn()
      }
    })
  }

  function setVisibility(state: DocumentVisibilityState) {
    act(() => {
      visibility = state
      document.dispatchEvent(new Event('visibilitychange'))
    })
  }

  function hide() {
    setVisibility('hidden')
  }

  function show() {
    setVisibility('visible')
  }

  function render(element: React.ReactElement) {
    act(() => root.render(element))
  }

  function belt(): HTMLElement {
    const found = container.querySelector<HTMLElement>('.pn-ticker-belt')
    if (found === null) {
      throw new Error('no belt')
    }
    return found
  }

  function units(): HTMLElement[] {
    return [...belt().querySelectorAll<HTMLElement>('.pn-ticker-unit')]
  }

  function words(): string[] {
    return units().map((unit) => unit.textContent ?? '')
  }

  // The run a unit is on now: the last one handed to its element
  function runOf(node: HTMLElement): FakeRun {
    const found = [...runs].reverse().find((run) => run.node === node)
    if (found === undefined) {
      throw new Error('a unit with no run')
    }
    return found
  }

  function live(): FakeRun[] {
    return units().map(runOf)
  }

  function widthOf(node: HTMLElement): number {
    return (node.textContent ?? '').length * perChar
  }

  // where a run has carried its unit's left edge at `t`, in stage px from the view's left edge
  function at(run: { startTime: number | null }, t: number = clock): number {
    return 960 - (t - (run.startTime ?? Number.NaN)) * 53 / 1000
  }

  function ats(): number[] {
    return live().map((run) => at(run))
  }

  const lines: TickerItem[] = [
    { key: 'desk', lead: 'ON THE DESK', text: '2 sessions working' },
    { key: 'activity:a', text: 'shop: editing cart.ts' },
    { key: 'activity:b', text: 'blog: reading index.md' },
    { key: 'waiting:c', lead: 'STILL WAITING', text: 'Fix the build needs your input · 4 min' },
  ]

  function renderLines() {
    render(
      <Stage width={480} animate>
        <Ticker items={lines} time="14:32" animate />
      </Stage>,
    )
  }

  it('draws a static frame as one pass of the items', () => {
    render(<Ticker items={['A one', 'B two']} time="14:32" />)
    const track = container.querySelector('.pn-ticker-track')
    expect(track).not.toBeNull()
    expect(track?.querySelectorAll('.pn-ticker-item')).toHaveLength(2)
    expect(container.querySelector('.pn-ticker-belt')).toBeNull()
  })

  it('hands each unit to the compositor on a run of its own', () => {
    renderLines()
    expect(container.querySelector('.pn-ticker-track')).toBeNull()
    const nodes = units()
    expect(nodes.length).toBeGreaterThanOrEqual(2)
    expect(belt().style.transform).toBe('')
    nodes.forEach((node, index) => {
      const run = runOf(node)
      const width = widthOf(node)
      expect(Object.keys(run.options).sort()).toEqual(['duration', 'fill'])
      expect(run.options.fill).toBe('both')
      expect(run.options.duration).toBeCloseTo(((960 + width) * 1000) / 53, 6)
      expect(run.keyframes).toEqual([{ transform: 'translateX(960px)' }, { transform: `translateX(-${width}px)` }])
      expect(typeof run.startTime).toBe('number')
      expect(run.cancel).not.toHaveBeenCalled()
      if (index === 0) {
        expect(at(run)).toBeCloseTo(22, 6)
      } else {
        const before = nodes[index - 1]!
        expect(at(run)).toBeCloseTo(at(runOf(before)) + widthOf(before), 6)
      }
    })
  })

  it('moves at 53 stage px a second with nothing from the page', () => {
    renderLines()
    const kept = live()
    const startTimes = kept.map((run) => run.startTime)
    const first = at(kept[0]!)
    look(480)
    expect(at(kept[0]!)).toBeCloseTo(first - 53 * 0.48, 6)
    kept.forEach((run, index) => {
      expect(run.startTime).toBe(startTimes[index])
      expect(run.cancel).not.toHaveBeenCalled()
    })
  })

  it('keeps the words on screen when the items change', () => {
    renderLines()
    look(250)
    look(250)
    const nodes = units()
    const before = nodes.map((node) => node.textContent)
    expect(nodes.length).toBeGreaterThan(0)

    render(
      <Stage width={480} animate>
        <Ticker
          items={lines.map((item) => (typeof item === 'string' ? item : { ...item, text: `${item.text} (changed)` }))}
          time="14:32"
          animate
        />
      </Stage>,
    )
    look(250)
    const stillThere = nodes.filter((node) => node.isConnected)
    expect(stillThere.length).toBeGreaterThan(0)
    for (const node of stillThere) {
      expect(node.textContent).toBe(before[nodes.indexOf(node)])
    }
  })

  it('keeps the view filled when the list gets shorter', () => {
    renderLines()
    look(250)
    look(250)
    render(
      <Stage width={480} animate>
        <Ticker items={[{ key: 'desk', text: 'Brief' }]} time="14:32" animate />
      </Stage>,
    )
    for (let index = 0; index < 120; index += 1) {
      look(250)
      const nodes = units()
      const last = nodes[nodes.length - 1]!
      expect(at(runOf(last)) + widthOf(last)).toBeGreaterThanOrEqual(VIEW)
      for (const word of words()) {
        expect(word).not.toBe('')
      }
    }
  })

  it('carries the crawl on across a cut on the same stage', () => {
    const board: Scene = {
      mode: 'board',
      clock: '14:32',
      sessions: [{ id: 'a', name: 'Fix the build', project: 'shop', state: 'working' }],
      ticker: lines,
    }
    const desk: Scene = {
      mode: 'desk',
      clock: '14:32',
      act: 'talk',
      event: { kind: 'needs-input', session: 'Fix the build', project: 'shop' },
      ticker: [
        { key: 'on-air:a:1', lead: 'BREAKING', text: 'Fix the build needs your input' },
        { key: 'desk', lead: 'ON THE DESK', text: '1 session working' },
      ],
    }
    render(
      <Stage width={480} animate>
        <Broadcast key="board" scene={board} animate />
      </Stage>,
    )
    for (let index = 0; index < 4; index += 1) {
      look(250)
    }
    const wordsBefore = words()
    const beltBefore = belt()
    const atsBefore = ats()
    expect(wordsBefore.length).toBeGreaterThan(0)

    render(
      <Stage width={480} animate>
        <Broadcast key="desk:1" scene={desk} animate />
      </Stage>,
    )
    expect(belt()).not.toBe(beltBefore)
    expect(words()).toEqual(wordsBefore)
    const atsAfter = ats()
    expect(atsAfter).toHaveLength(atsBefore.length)
    atsAfter.forEach((value, index) => expect(value).toBeCloseTo(atsBefore[index]!, 6))
  })

  it('stands still while the window is hidden and carries on from where it stopped', () => {
    renderLines()
    look(250)
    const wordsBefore = words()
    const atsBefore = ats()

    hide()
    const made = runs.length
    for (let index = 0; index < 20; index += 1) {
      look(250)
    }
    expect(runs.length).toBe(made)
    for (const run of runs) {
      expect(run.cancel).not.toHaveBeenCalled()
    }

    show()
    expect(words()).toEqual(wordsBefore)
    const atsAfter = ats()
    expect(atsAfter).toHaveLength(atsBefore.length)
    atsAfter.forEach((value, index) => expect(value).toBeCloseTo(atsBefore[index]!, 6))

    const first = atsAfter[0]!
    look(1000)
    expect(at(live()[0]!)).toBeCloseTo(first - 53, 6)
  })

  it('holds from the start when it is drawn while the window is hidden', () => {
    visibility = 'hidden'
    renderLines()
    clock += 3000
    show()
    expect(at(live()[0]!)).toBeCloseTo(22, 6)
  })

  it("sets the belt again when a typeface changes the units' widths", () => {
    renderLines()
    look(250)
    const kept = units()
    const first = at(runOf(kept[0]!))
    const old = [...runs]

    perChar = 12
    look(250)
    const nodes = units()
    expect(nodes.slice(0, kept.length)).toEqual(kept)
    expect(at(runOf(nodes[0]!))).toBeCloseTo(first - 53 * 0.25, 6)
    nodes.forEach((node, index) => {
      if (index > 0) {
        const before = nodes[index - 1]!
        expect(at(runOf(node))).toBeCloseTo(at(runOf(before)) + widthOf(before), 6)
      }
    })
    for (const run of old) {
      expect(run.cancel).toHaveBeenCalledTimes(1)
    }
  })

  it('sets the belt again before the picture is drawn, with ResizeObserver', () => {
    const callbacks: ResizeObserverCallback[] = []
    class FakeResizeObserver {
      constructor(callback: ResizeObserverCallback) {
        callbacks.push(callback)
      }
      observe() {}
      unobserve() {}
      disconnect() {}
    }
    Object.defineProperty(window, 'ResizeObserver', { configurable: true, writable: true, value: FakeResizeObserver })

    renderLines()
    const first = at(live()[0]!)
    expect(callbacks).toHaveLength(1)

    perChar = 12
    act(() => {
      callbacks[0]!([], new FakeResizeObserver(() => undefined) as unknown as ResizeObserver)
    })
    const nodes = units()
    expect(at(runOf(nodes[0]!))).toBeCloseTo(first, 6)
    nodes.forEach((node, index) => {
      if (index > 0) {
        const before = nodes[index - 1]!
        expect(at(runOf(node))).toBeCloseTo(at(runOf(before)) + widthOf(before), 6)
      }
    })
  })

  it('takes a unit off once it has gone past the tab', () => {
    renderLines()
    const first = units()[0]!
    const run = runOf(first)
    const width = widthOf(first)
    for (let index = 0; index < 200 && at(run) + width > 0; index += 1) {
      look(250)
    }
    look(250)
    expect(first.isConnected).toBe(false)
    expect(run.cancel).toHaveBeenCalledTimes(1)
  })

  it('brings the next unit on from the clock after the page was held up', () => {
    renderLines()
    look(250)
    const kept = units()
    clock += 6000
    look(0)

    const nodes = units()
    const empty = nodes.filter((node) => (node.textContent ?? '') === '')
    expect(empty).toHaveLength(1)
    const gap = nodes.indexOf(empty[0]!)
    expect(gap).toBeGreaterThan(0)
    for (const node of nodes.slice(0, gap)) {
      expect(kept).toContain(node)
    }
    const before = nodes[gap - 1]!
    expect(at(runOf(nodes[gap]!))).toBeCloseTo(at(runOf(before)) + widthOf(before), 6)
    const after = nodes[gap + 1]!
    expect(after.textContent).not.toBe('')
    expect(at(runOf(after))).toBeCloseTo(VIEW, 6)
    for (const node of nodes) {
      if (!kept.includes(node) && (node.textContent ?? '') !== '') {
        expect(at(runOf(node))).toBeGreaterThanOrEqual(VIEW - 1e-6)
      }
    }
  })

  it('stops when it leaves the air', () => {
    renderLines()
    look(250)
    expect(runs.length).toBeGreaterThan(0)
    act(() => root.unmount())
    for (const run of runs) {
      expect(run.cancel).toHaveBeenCalledTimes(1)
    }
    expect(timers.size).toBe(0)
    const made = runs.length
    hide()
    show()
    expect(runs.length).toBe(made)
  })

  it('stands still with reduced motion', () => {
    window.matchMedia = ((query: string) => ({
      matches: query === '(prefers-reduced-motion: reduce)',
      media: query,
      addEventListener: () => undefined,
      removeEventListener: () => undefined,
      addListener: () => undefined,
      removeListener: () => undefined,
    })) as unknown as typeof window.matchMedia
    renderLines()
    expect(container.querySelector('.pn-ticker-track')).not.toBeNull()
    expect(container.querySelector('.pn-ticker-belt')).toBeNull()
  })

  it('stands still without the Web Animations API', () => {
    Reflect.deleteProperty(Element.prototype, 'animate')
    renderLines()
    expect(container.querySelector('.pn-ticker-track')).not.toBeNull()
    expect(container.querySelector('.pn-ticker-belt')).toBeNull()
  })
})
