import { describe, expect, it } from 'vitest'

import { TAB_ALT, chipAlt } from '@pipcast/contract'
import { BAND_HEIGHT, band, blankLabel, chip, tab } from '../../plugin/src/core/band.ts'

const count = (text: string, part: string): number => text.split(part).length - 1

describe('the band pictures', () => {
  it('are documents of the band height, as wide as they say', () => {
    for (const picture of [chip(0, false), chip(3, true), tab('in'), tab('out'), tab('off')]) {
      expect(picture.width).toBeGreaterThan(0)
      expect(Number.isInteger(picture.width)).toBe(true)
      expect(picture.svg.startsWith('<svg ')).toBe(true)
      expect(picture.svg).toContain(`height="${BAND_HEIGHT}"`)
      expect(picture.svg).toContain(`width="${picture.width}"`)
      expect(picture.svg).toContain(`viewBox="0 0 ${picture.width} ${BAND_HEIGHT}"`)
    }
  })

  it('keep their width whatever they show', () => {
    const widths = new Set([0, 1, 2, 3, 4].flatMap((n) => [chip(n, false).width, chip(Math.max(n, 1), true).width]))
    expect(widths.size).toBe(1)
    expect(tab('in').width).toBe(tab('off').width)
  })

  it('are the same every time', () => {
    expect(chip(2, true)).toEqual(chip(2, true))
    expect(tab('out')).toEqual(tab('out'))
  })

  it('carry their own outlines and no text', () => {
    for (const picture of [chip(2, true), tab('in'), tab('out'), tab('off')]) {
      expect(picture.svg).not.toContain('<text')
      expect(picture.svg).not.toContain('font-family')
      expect(picture.svg).toContain('<path')
    }
  })
})

describe('the chip', () => {
  it('reads out how many are on air', () => {
    expect(chip(2, false).alt).toBe(chipAlt(2))
    expect(chip(0, false).alt).toBe(chipAlt(0))
    expect(chip(4, false).alt).toBe('KLWD: 4 of 4 sessions on air')
  })

  it('counts this session when it is tuned in, even before the count has caught up', () => {
    expect(chip(0, true).alt).toBe(chipAlt(1))
  })

  it('never shows more than four', () => {
    expect(chip(9, false).alt).toBe(chipAlt(4))
  })

  it('fills one cell per session on air, in blue', () => {
    for (const n of [0, 1, 2, 3, 4]) {
      const svg = chip(n, false).svg
      expect(count(svg, 'fill="url(#r)"')).toBe(n)
      expect(count(svg, 'fill="url(#g)"')).toBe(0)
      // the rest are empty cells
      expect(count(svg, 'fill="#061233"/>')).toBe(4 - n)
    }
  })

  it('draws this session in gold and the others in blue', () => {
    for (const n of [1, 2, 3, 4]) {
      const svg = chip(n, true).svg
      expect(count(svg, 'fill="url(#g)"')).toBe(1)
      expect(count(svg, 'fill="url(#r)"')).toBe(n - 1)
      expect(count(svg, 'fill="#061233"/>')).toBe(4 - n)
    }
  })

  it('has the gold cell first', () => {
    const svg = chip(3, true).svg
    expect(svg.indexOf('fill="url(#g)"')).toBeLessThan(svg.indexOf('fill="url(#r)"'))
  })
})

describe('the tab', () => {
  it('says what it does', () => {
    expect(tab('in').alt).toBe(TAB_ALT.in)
    expect(tab('out').alt).toBe(TAB_ALT.out)
    expect(tab('off').alt).toBe(TAB_ALT.off)
  })

  it('is dimmed with a desaturating filter only when KLWD is full', () => {
    expect(tab('off').svg).toContain('opacity=".4"')
    expect(tab('off').svg).toContain('filter="url(#d)"')
    expect(tab('off').svg).toContain('<feColorMatrix type="saturate" values=".3"/>')
    for (const kind of ['in', 'out'] as const) {
      expect(tab(kind).svg).not.toContain('filter=')
      expect(tab(kind).svg).not.toContain('opacity=".4"')
    }
  })

  it('is gold for TUNE IN and blue with a gold edge for TUNE OUT', () => {
    expect(tab('in').svg).toContain('fill="url(#g)"')
    expect(tab('out').svg).toContain('fill="url(#b)"')
    expect(tab('out').svg).toContain('fill="#f2b630"')
    expect(tab('out').width).toBeGreaterThan(tab('in').width)
  })
})

describe('band', () => {
  it('shows TUNE IN while there is room and this session is off', () => {
    for (const onAir of [0, 1, 2, 3]) {
      const view = band({ tuned: false, onAir })
      expect(view.kind).toBe('in')
      expect(view.tab.alt).toBe(TAB_ALT.in)
    }
  })

  it('shows TUNE OUT when tuned in, even with four on air', () => {
    expect(band({ tuned: true, onAir: 1 }).kind).toBe('out')
    expect(band({ tuned: true, onAir: 4 }).kind).toBe('out')
  })

  it('shows a dim TUNE IN when KLWD is full', () => {
    const view = band({ tuned: false, onAir: 4 })
    expect(view.kind).toBe('off')
    expect(view.tab.alt).toBe(TAB_ALT.off)
    expect(view.chip.alt).toBe(chipAlt(4))
  })
})

describe('blankLabel', () => {
  it('is en spaces, enough to reach across the tab', () => {
    for (const width of [tab('in').width, tab('out').width]) {
      const label = blankLabel(width)
      expect(label.replaceAll('\u2002', '')).toBe('')
      expect(label.length).toBe(Math.ceil(width / 7) + 1)
    }
  })

  it('grows with the width', () => {
    expect(blankLabel(100).length).toBeGreaterThan(blankLabel(50).length)
  })
})
