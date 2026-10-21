import { describe, expect, it } from 'vitest'
import {
  clock,
  duration,
  figure,
  hourKey,
  hourLabel,
  hourStart,
  plural,
  thousands,
  waited,
  wholeMinutes,
} from '@pipcast/contract'

// The `test` script runs with TZ=UTC, so local time is UTC here.
const at = Date.UTC(2026, 9, 21, 14, 32, 45)

describe('numbers', () => {
  it('writes lines changed with a real minus sign', () => {
    expect(figure(1546, 368)).toBe('+1,546 −368')
    expect(figure(182, 40)).toBe('+182 −40')
  })

  it('groups thousands', () => {
    expect(thousands(1234567)).toBe('1,234,567')
    expect(thousands(999)).toBe('999')
    expect(thousands(1000)).toBe('1,000')
    expect(thousands(0)).toBe('0')
  })

  it('picks the singular or the plural', () => {
    expect(plural(1, 'story', 'stories')).toBe('story')
    expect(plural(0, 'story', 'stories')).toBe('stories')
    expect(plural(2, 'story', 'stories')).toBe('stories')
  })
})

describe('durations', () => {
  it('says how long a turn ran', () => {
    expect(duration(42_000)).toBe('42 s')
    expect(duration(540_000)).toBe('9 min')
    expect(duration(6_480_000)).toBe('1 h 48 min')
    expect(duration(7_200_000)).toBe('2 h')
  })

  it('never says less than a second', () => {
    expect(duration(0)).toBe('1 s')
  })

  it('counts how long a story has waited', () => {
    expect(waited(12_000)).toBe('0:12')
    expect(waited(1_625_000)).toBe('27:05')
    expect(waited(3_780_000)).toBe('1 h 3 min')
    expect(waited(3_600_000)).toBe('1 h')
  })

  it('counts whole minutes and never goes below zero', () => {
    expect(wholeMinutes(125_000)).toBe(2)
    expect(wholeMinutes(-5000)).toBe(0)
  })
})

describe('local time', () => {
  it('reads the clock', () => {
    expect(clock(at)).toBe('14:32')
    expect(clock(Date.UTC(2026, 9, 21, 9, 5))).toBe('09:05')
  })

  it('finds the start of the hour', () => {
    expect(hourStart(at)).toBe(Date.UTC(2026, 9, 21, 14))
  })

  it('labels an hour', () => {
    expect(hourLabel(at)).toBe('14:00')
    expect(hourLabel(Date.UTC(2026, 9, 21, 7, 59))).toBe('07:00')
  })

  it('keys an hour', () => {
    expect(hourKey(at)).toBe('2026-10-21T14')
    expect(hourKey(Date.UTC(2026, 0, 2, 3))).toBe('2026-01-02T03')
  })
})
