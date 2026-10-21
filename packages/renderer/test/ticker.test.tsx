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

describe('the ticker on air', () => {
  let container: HTMLElement
  let root: Root

  // jsdom has no layout, no frames and no clock of its own worth the name
  let clock = 0
  let nextFrame = 1
  let queued = new Map<number, FrameRequestCallback>()
  const original = {
    requestAnimationFrame: window.requestAnimationFrame,
    cancelAnimationFrame: window.cancelAnimationFrame,
    matchMedia: window.matchMedia,
    clientWidth: Object.getOwnPropertyDescriptor(HTMLElement.prototype, 'clientWidth'),
  }

  beforeEach(() => {
    clock = 1000
    nextFrame = 1
    queued = new Map()

    const getComputedStyle = window.getComputedStyle.bind(window)
    vi.spyOn(window, 'getComputedStyle').mockImplementation((element: Element, pseudo?: string | null) => {
      if (element.classList.contains('pn-ticker-unit')) {
        return { width: `${(element.textContent ?? '').length * 10}px` } as CSSStyleDeclaration
      }
      return getComputedStyle(element, pseudo)
    })
    Object.defineProperty(HTMLElement.prototype, 'clientWidth', {
      configurable: true,
      get(this: HTMLElement) {
        return this.classList.contains('pn-ticker-view') ? VIEW : 0
      },
    })
    window.requestAnimationFrame = (callback: FrameRequestCallback) => {
      const id = nextFrame
      nextFrame += 1
      queued.set(id, callback)
      return id
    }
    window.cancelAnimationFrame = (id: number) => {
      queued.delete(id)
    }
    vi.spyOn(window.performance, 'now').mockImplementation(() => clock)

    container = document.createElement('div')
    document.body.append(container)
    root = createRoot(container)
  })

  afterEach(() => {
    act(() => root.unmount())
    container.remove()
    vi.restoreAllMocks()
    window.requestAnimationFrame = original.requestAnimationFrame
    window.cancelAnimationFrame = original.cancelAnimationFrame
    window.matchMedia = original.matchMedia
    if (original.clientWidth === undefined) {
      Reflect.deleteProperty(HTMLElement.prototype, 'clientWidth')
    } else {
      Object.defineProperty(HTMLElement.prototype, 'clientWidth', original.clientWidth)
    }
  })

  // Advances the clock by `ms` and runs the queued frames with that time, `count` times
  function frames(count: number, ms: number) {
    act(() => {
      for (let index = 0; index < count; index += 1) {
        clock += ms
        const due = [...queued.values()]
        queued.clear()
        for (const callback of due) {
          callback(clock)
        }
      }
    })
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

  // How far the belt has moved past the view's left edge, from its transform
  function offset(): number {
    const match = /^translateX\((.+)px\)$/.exec(belt().style.transform)
    const value = match === null ? Number.NaN : Number(match[1])
    if (!Number.isFinite(value)) {
      throw new Error(`no transform: ${belt().style.transform}`)
    }
    return -value
  }

  const lines: TickerItem[] = [
    { key: 'desk', lead: 'ON THE DESK', text: '2 sessions working' },
    { key: 'activity:a', text: 'shop: editing cart.ts' },
    { key: 'activity:b', text: 'blog: reading index.md' },
    { key: 'waiting:c', lead: 'STILL WAITING', text: 'Fix the build needs your input · 4 min' },
  ]

  it('draws a static frame as one pass of the items', () => {
    render(<Ticker items={['A one', 'B two']} time="14:32" />)
    const track = container.querySelector('.pn-ticker-track')
    expect(track).not.toBeNull()
    expect(track?.querySelectorAll('.pn-ticker-item')).toHaveLength(2)
    expect(container.querySelector('.pn-ticker-belt')).toBeNull()
  })

  it('crawls on a belt when animated', () => {
    render(
      <Stage width={480} animate>
        <Ticker items={lines} time="14:32" animate />
      </Stage>,
    )
    expect(container.querySelector('.pn-ticker-track')).toBeNull()
    expect(units().length).toBeGreaterThan(0)
    expect(belt().style.transform).toBe('translateX(22px)')
    frames(30, 16)
    expect(offset()).toBeCloseTo(-22 + 53 * 0.48, 2)
    expect(belt().style.transform).toMatch(/^translateX\(-3\.4\d*px\)$/)
  })

  it('keeps the words on screen when the items change', () => {
    render(
      <Stage width={480} animate>
        <Ticker items={lines} time="14:32" animate />
      </Stage>,
    )
    frames(10, 16)
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
    frames(5, 16)
    const stillThere = nodes.filter((node) => node.isConnected)
    expect(stillThere.length).toBeGreaterThan(0)
    for (const node of stillThere) {
      expect(node.textContent).toBe(before[nodes.indexOf(node)])
    }
  })

  it('keeps the view filled when the list gets shorter', () => {
    render(
      <Stage width={480} animate>
        <Ticker items={lines} time="14:32" animate />
      </Stage>,
    )
    frames(20, 16)
    render(
      <Stage width={480} animate>
        <Ticker items={[{ key: 'desk', text: 'Brief' }]} time="14:32" animate />
      </Stage>,
    )
    for (let index = 0; index < 600; index += 1) {
      frames(1, 16)
      const laid = units().reduce((sum, unit) => sum + (unit.textContent ?? '').length * 10, 0)
      expect(laid - offset()).toBeGreaterThanOrEqual(VIEW)
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
    frames(40, 16)
    const wordsBefore = words()
    const beltBefore = belt()
    const transformBefore = belt().style.transform
    expect(wordsBefore.length).toBeGreaterThan(0)

    render(
      <Stage width={480} animate>
        <Broadcast key="desk:1" scene={desk} animate />
      </Stage>,
    )
    expect(belt()).not.toBe(beltBefore)
    expect(words()).toEqual(wordsBefore)
    expect(belt().style.transform).toBe(transformBefore)
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
    render(
      <Stage width={480} animate>
        <Ticker items={lines} time="14:32" animate />
      </Stage>,
    )
    expect(container.querySelector('.pn-ticker-track')).not.toBeNull()
    expect(container.querySelector('.pn-ticker-belt')).toBeNull()
  })
})
