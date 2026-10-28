// @vitest-environment jsdom
import '../src/react-global.ts'

import { describe, expect, it } from 'vitest'

import type { CrawlBelt, CrawlInput, CrawlStepResult, TickerItem } from '@pipcast/design'

import { crawlRun, crawlSpeed, crawlStep } from '../src/design.ts'

const VIEW = 623

const WIDTHS: Record<string, number> = { A: 300, B: 400, C: 200 }

function wordsOf(item: TickerItem): string {
  return typeof item === 'string' ? item : item.text
}

// A fixed width for each text; any other text is 100
function measure(item: TickerItem): number {
  return WIDTHS[wordsOf(item)] ?? 100
}

function fresh(): CrawlBelt {
  return { offset: -22, units: [], done: {}, last: null, started: false }
}

function belt(offset: number, texts: string[]): CrawlBelt {
  return {
    offset,
    units: texts.map((text) => ({ key: `text:${text}`, item: text, width: measure(text) })),
    done: {},
    last: null,
    started: true,
  }
}

function step(from: CrawlBelt, items: TickerItem[], rest: Partial<CrawlInput> = {}): CrawlStepResult {
  return crawlStep(from, { offset: from.offset, view: VIEW, items, measure, ...rest })
}

// where a run has carried its unit's left edge at `t`, in stage px from the view's left edge
function at(run: { startTime: number | null }, t: number): number {
  return 960 - (t - (run.startTime ?? Number.NaN)) * 53 / 1000
}

function nameOf(item: TickerItem | undefined | null): string {
  return typeof item === 'string' ? item : (item?.key ?? '')
}

// Lays one item a step: the view is 1 px wide and every item 1000 px, so the
// belt fills with the first item laid and stops, and the units are cleared
// between steps to make room for the next
function laying() {
  let current: CrawlBelt = { offset: -1, units: [], done: {}, last: null, started: true }
  return (items: TickerItem[]): string => {
    const result = crawlStep(current, { offset: current.offset, view: 1, items, measure: () => 1000 })
    expect(result.laid).toHaveLength(1)
    current = { ...result.belt, units: [], offset: -1 }
    return nameOf(result.laid[0])
  }
}

describe('the crawl, a look at a time', () => {
  it("runs each unit at 53 stage px a second, from the ticker's right end to past the tab", () => {
    expect(crawlSpeed).toBe(53)
    const run = crawlRun(22, 300, 1000)
    expect(run.keyframes).toEqual([{ transform: 'translateX(960px)' }, { transform: 'translateX(-300px)' }])
    expect(run.duration).toBeCloseTo(((960 + 300) * 1000) / 53, 6)
    expect(run.startTime).toBeCloseTo(1000 - ((960 - 22) * 1000) / 53, 6)
    expect(at(run, 1000)).toBeCloseTo(22, 6)
    expect(at(run, 2000)).toBeCloseTo(22 - 53, 6)
    expect(at(run, run.startTime + run.duration)).toBeCloseTo(-300, 6)
  })

  it('takes a unit off past the tab and its width off the offset', () => {
    const result = step(belt(299, ['A', 'B', 'C']), [], { offset: 300.06 })
    expect(result.dropped).toBe(1)
    expect(result.belt.offset).toBeCloseTo(0.06, 6)
    expect(result.belt.units[0]?.item).toBe('B')
  })

  it('keeps the offset it is given', () => {
    const result = step(belt(0, ['B', 'C']), [], { offset: 2.65 })
    expect(result.belt.offset).toBeCloseTo(2.65, 6)
    expect(result.dropped).toBe(0)
    expect(result.belt.units.map((unit) => unit.item)).toEqual(['B', 'C'])
  })

  it('fills a new belt from 22 px in from the tab', () => {
    const result = step(fresh(), ['A', 'B', 'C'])
    expect(result.belt.offset).toBe(-22)
    expect(result.belt.units.map((unit) => unit.item)).toEqual(['A', 'B', 'C'])
    expect(result.laid).toEqual(['A', 'B', 'C'])
  })

  it('never changes the words of a unit already laid', () => {
    const first = step(fresh(), [
      { key: 'a', text: 'A' },
      { key: 'b', text: 'B' },
    ])
    const before = structuredClone(first.belt.units)
    const second = step(
      first.belt,
      [
        { key: 'a', text: 'D' },
        { key: 'b', text: 'X' },
      ],
      { offset: first.belt.offset + 0.85 },
    )
    expect(second.belt.units.slice(0, before.length)).toEqual(before)
  })

  it('lays every item once a round however the list is reordered', () => {
    const desk = { key: 'desk', text: 'desk line' }
    const first = { key: 's1', text: 'story one' }
    const second = { key: 's2', text: 'story two' }
    const lay = laying()
    const order = [lay([desk, first, second]), lay([desk, first, second])]
    expect(order).toEqual(['desk', 's1'])
    const reordered = [desk, second, first]
    for (let index = 0; index < 4; index += 1) {
      order.push(lay(reordered))
    }
    expect(order).toEqual(['desk', 's1', 's2', 'desk', 's2', 's1'])
  })

  it('lays a line that joins the top of the list next', () => {
    const current: CrawlBelt = {
      offset: -1,
      units: [],
      done: { 'key:desk': true },
      last: 'key:desk',
      started: true,
    }
    const result = crawlStep(current, {
      offset: -1,
      view: 1,
      items: [
        { key: 'brk', lead: 'BREAKING', text: 'X' },
        { key: 'desk', lead: 'ON THE DESK', text: 'Y' },
        { key: 's1', text: 'Z' },
      ],
      measure: () => 1000,
    })
    expect(nameOf(result.laid[0])).toBe('brk')
  })

  it('never lays the same item twice in a row while another waits', () => {
    const two = laying()
    expect(Array.from({ length: 6 }, () => two(['A', 'B']))).toEqual(['A', 'B', 'A', 'B', 'A', 'B'])

    const three = laying()
    const items: TickerItem[] = [
      { key: 'x', text: 'one' },
      { key: 'y', text: 'two' },
      { key: 'z', text: 'three' },
    ]
    const order = Array.from({ length: 9 }, () => three(items))
    for (let index = 1; index < order.length; index += 1) {
      expect(order[index]).not.toBe(order[index - 1])
    }
    for (const key of ['x', 'y', 'z']) {
      expect(order.filter((name) => name === key)).toHaveLength(3)
    }
  })

  it('lets an emptied belt wait at the clock and brings the next item in from there', () => {
    const emptied = step(belt(999, ['A']), [])
    expect(emptied.belt.units).toEqual([])
    expect(emptied.belt.offset).toBe(-VIEW)
    expect(emptied.laid).toEqual([])
    const next = step(emptied.belt, ['A'])
    expect(next.laid).toHaveLength(1)
    expect(next.belt.offset).toBe(-VIEW)
  })

  it('lays nothing it cannot measure', () => {
    const result = step(fresh(), ['A', 'B'], { measure: () => 0 })
    expect(result.laid).toEqual([])
    expect(result.belt.units).toEqual([])
  })

  it("brings the next item on from the clock when the belt's end has come into view", () => {
    const result = step(belt(0, ['C']), ['A'])
    expect(result.belt.units.map((unit) => ({ key: unit.key, item: unit.item, width: unit.width }))).toEqual([
      { key: 'text:C', item: 'C', width: 200 },
      { key: 'gap', item: null, width: 423 },
      { key: 'text:A', item: 'A', width: 300 },
    ])
    expect(result.laid).toEqual(['A'])
    const before = result.belt.units.slice(0, 2).reduce((sum, unit) => sum + unit.width, 0)
    expect(before - result.belt.offset).toBe(VIEW)
  })

  it("lays on at the belt's end while it is still out of sight", () => {
    const result = step(belt(0, ['B', 'A']), ['C'])
    expect(result.belt.units.map((unit) => unit.item)).toEqual(['B', 'A', 'C'])
  })

  it('leaves no empty stretch when there is nothing to lay', () => {
    const result = step(belt(0, ['C']), [])
    expect(result.belt.units.map((unit) => unit.item)).toEqual(['C'])
  })
})
