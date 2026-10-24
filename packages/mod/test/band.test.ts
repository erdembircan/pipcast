import { describe, expect, it } from 'vitest'

import { BAND_ALT } from '@pipcast/contract'
import { KLWD, TUNE_IN, TUNE_OUT } from '../src/core/art.generated.ts'
import { BAND_HEIGHT, REACH, band, blankLabel, plate } from '../src/core/band.ts'

const count = (text: string, part: string): number => text.split(part).length - 1

describe('the plate', () => {
  it('is a document of the band height, as wide as it says', () => {
    for (const kind of ['in', 'out'] as const) {
      const picture = plate(kind)
      expect(picture.width).toBeGreaterThan(0)
      expect(Number.isInteger(picture.width)).toBe(true)
      expect(picture.svg.startsWith('<svg xmlns="http://www.w3.org/2000/svg"')).toBe(true)
      expect(picture.svg).toContain(`height="${BAND_HEIGHT}"`)
      expect(picture.svg).toContain(`width="${picture.width}"`)
      expect(picture.svg).toContain(`viewBox="0 0 ${picture.width} ${BAND_HEIGHT}"`)
    }
  })

  it('is 151 px wide with TUNE IN and 164 px with TUNE OUT', () => {
    expect(plate('in').width).toBe(151)
    expect(plate('out').width).toBe(164)
  })

  it('is the same every time', () => {
    expect(plate('in').svg).toBe(plate('in').svg)
    expect(plate('out').svg).toBe(plate('out').svg)
  })

  it('carries its own outlines and no text', () => {
    for (const kind of ['in', 'out'] as const) {
      expect(plate(kind).svg).not.toContain('<text')
      expect(plate(kind).svg).toContain(KLWD.d)
    }
    expect(plate('in').svg).toContain(TUNE_IN.d)
    expect(plate('out').svg).toContain(TUNE_OUT.d)
  })

  it('shows no count', () => {
    for (const kind of ['in', 'out'] as const) {
      expect(plate(kind).svg).not.toContain('id="r"')
      expect(plate(kind).svg).not.toContain('width="6" height="12"')
    }
  })

  it('is gold with TUNE IN and blue with a gold edge with TUNE OUT', () => {
    const tuneIn = plate('in').svg
    expect(tuneIn).toContain('url(#g)')
    expect(tuneIn).toContain('fill="#2a1800"')
    expect(tuneIn).toContain('fill="#b97d0c"')
    expect(tuneIn).not.toContain('url(#b)')
    const tuneOut = plate('out').svg
    expect(tuneOut).toContain('url(#b)')
    expect(tuneOut).toContain('fill="#ffffff"')
    expect(count(tuneOut, 'fill="#f2b630"')).toBeGreaterThanOrEqual(2)
    expect(tuneOut).not.toContain('url(#g)')
  })

  it('reads out KLWD and the action', () => {
    expect(plate('in').alt).toBe(BAND_ALT.in)
    expect(plate('out').alt).toBe(BAND_ALT.out)
  })
})

describe('band', () => {
  it('shows TUNE IN while this session is off the air', () => {
    const view = band({ tuned: false })
    expect(view.kind).toBe('in')
    expect(view.picture).toEqual(plate('in'))
  })

  it('shows TUNE OUT while it is on', () => {
    const view = band({ tuned: true })
    expect(view.kind).toBe('out')
    expect(view.picture).toEqual(plate('out'))
  })
})

describe('blankLabel', () => {
  it('is en spaces, short of the plate', () => {
    for (const width of [plate('in').width, plate('out').width]) {
      const label = blankLabel(width)
      expect(label.replaceAll(' ', '')).toBe('')
      expect(label.length).toBe(Math.max(1, Math.floor(width / 8)))
      expect(label.length * 7).toBeLessThan(width)
    }
  })

  it('reaches two columns past the plate on each side', () => {
    expect(REACH).toBe(2)
  })

  it('grows with the width', () => {
    expect(blankLabel(100).length).toBeGreaterThan(blankLabel(50).length)
  })
})
