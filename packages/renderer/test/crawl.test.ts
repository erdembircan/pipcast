// @vitest-environment jsdom
import '../src/react-global.ts'

import { describe, expect, it } from 'vitest'

import type { CrawlBelt, CrawlInput, CrawlStepResult, TickerItem } from '@pipcast/design'

import { crawlSpeed, crawlStep } from '../src/design.ts'

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
  return crawlStep(from, { dt: 0, speed: crawlSpeed, view: VIEW, items, measure, ...rest })
}

function nameOf(item: TickerItem | undefined): string {
  return typeof item === 'string' ? item : (item?.key ?? '')
}

// Lays one item a step: the view is 1 px wide and every item 1000 px, so the
// belt fills with the first item laid and stops, and the units are cleared
// between steps to make room for the next
function laying() {
  let current: CrawlBelt = { offset: -1, units: [], done: {}, last: null, started: true }
  return (items: TickerItem[]): string => {
    const result = crawlStep(current, { dt: 0, speed: crawlSpeed, view: 1, items, measure: () => 1000 })
    expect(result.laid).toHaveLength(1)
    current = { ...result.belt, units: [], offset: -1 }
    return nameOf(result.laid[0])
  }
}

describe('the crawl, a step at a time', () => {
  it('moves at 53 stage px a second', () => {
    expect(crawlSpeed).toBe(53)
    const result = step(belt(0, ['B', 'C']), [], { dt: 0.05 })
    expect(result.belt.offset).toBeCloseTo(2.65, 6)
  })

  it('carries on after a pause from where it stopped', () => {
    const paused = step(belt(0, ['B', 'C']), [], { dt: 5 })
    const tenth = step(belt(0, ['B', 'C']), [], { dt: 0.1 })
    expect(paused.belt.offset).toBeCloseTo(tenth.belt.offset, 6)
    expect(paused.belt.offset).toBeCloseTo(5.3, 6)
    expect(step(belt(0, ['B', 'C']), [], { dt: -1 }).belt.offset).toBe(0)
  })

  it('fills a new belt from 22 px in from the tab', () => {
    const result = step(fresh(), ['A', 'B', 'C'])
    expect(result.belt.offset).toBe(-22)
    expect(result.belt.units.map((unit) => unit.item)).toEqual(['A', 'B', 'C'])
    expect(result.laid).toEqual(['A', 'B', 'C'])
  })

  it('takes a unit off past the tab and its width off the offset', () => {
    const result = step(belt(299, ['A', 'B', 'C']), ['A', 'B', 'C'], { dt: 0.02 })
    expect(result.dropped).toBe(1)
    expect(result.belt.offset).toBeCloseTo(299 + 1.06 - 300, 6)
    expect(result.belt.units[0]?.item).toBe('B')
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
      { dt: 0.016 },
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
      dt: 0,
      speed: crawlSpeed,
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
})
