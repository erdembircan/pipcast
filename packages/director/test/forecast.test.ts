import { dayName } from '@pipcast/contract'
import { describe, expect, it } from 'vitest'

import { forecastWeek, gammaMedian, gammaP, MAX_POINTS, QUARTER_MS, recordReading, WEEK_MS } from '../src/forecast.ts'
import type { Forecast, WeekHistory } from '../src/forecast.ts'
import { HOUR_MS } from '../src/timing.ts'

// Local-time constructors, so the cases hold in any time zone. The reference
// week resets Mon 16 Nov 2026 at 18:00, and it is Fri 13 Nov, 15:12.
const RESET = new Date(2026, 10, 16, 18, 0).getTime()
const NOW = new Date(2026, 10, 13, 15, 12).getTime()
const START = RESET - WEEK_MS

// A week of steady use: `rate` percent an hour from 09:00 to 21:00 local, every
// day, one point a quarter hour, rounded to one decimal
function steady(rate: number): WeekHistory {
  const points: [number, number][] = []
  let cum = 0
  for (let t = START; t < NOW; t += QUARTER_MS) {
    const hour = new Date(t).getHours()
    if (hour >= 9 && hour < 21) {
      cum += rate / 4
    }
    points.push([t + QUARTER_MS, Math.round(cum * 10) / 10])
  }
  return { resetsAt: RESET, points: points.filter(([t]) => t <= NOW) }
}

// A week that uses `rate(t)` an hour from 09:00 to 21:00
function shaped(rate: (t: number) => number): WeekHistory {
  const points: [number, number][] = []
  let cum = 0
  for (let t = START; t < NOW; t += QUARTER_MS) {
    const hour = new Date(t).getHours()
    if (hour >= 9 && hour < 21) {
      cum += rate(t) / 4
    }
    points.push([t + QUARTER_MS, Math.round(cum * 10) / 10])
  }
  return { resetsAt: RESET, points: points.filter(([t]) => t <= NOW) }
}

function usedOf(history: WeekHistory): number {
  return (history.points[history.points.length - 1] as [number, number])[1]
}

function run(history: WeekHistory, now = NOW): Forecast {
  const forecast = forecastWeek(history, usedOf(history), now)
  if (forecast === null) {
    throw new Error('no forecast')
  }
  return forecast
}

function names(forecast: Forecast): string[] {
  return forecast.days.map((day) => dayName(day.closesAt - 1))
}

describe('the gamma functions', () => {
  it('knows P(1, 1) and P(5, 3)', () => {
    expect(gammaP(1, 1)).toBeCloseTo(0.632121, 6)
    expect(gammaP(5, 3)).toBeCloseTo(0.184737, 6)
  })

  it('is 0 at or below 0', () => {
    expect(gammaP(2, 0)).toBe(0)
    expect(gammaP(2, -1)).toBe(0)
  })

  it('finds the median, where P is one half', () => {
    for (const [shape, scale] of [
      [0.5, 2],
      [3, 1],
      [40, 0.25],
    ] as const) {
      const median = gammaMedian(shape, scale)
      expect(Math.abs(gammaP(shape, median / scale) - 0.5)).toBeLessThan(1e-6)
    }
  })
})

describe('the forecast of a steady week', () => {
  it('0.6 an hour is clear, ending near 49%', () => {
    const forecast = run(steady(0.6))
    expect(forecast.used).toBe(27)
    expect(forecast.outlook).toBe('clear')
    expect(Math.abs(forecast.end - 48.9)).toBeLessThan(1.5)
    expect(forecast.chance).toBeLessThan(0.01)
    expect(forecast.runsOutAt).toBeNull()
    expect(names(forecast)).toEqual(['FRI', 'SAT', 'SUN', 'MON'])
    expect(forecast.days[3]?.closesAt).toBe(RESET)
  })

  it('0.9 an hour is clouds, ending near 73%', () => {
    const forecast = run(steady(0.9))
    expect(forecast.used).toBe(40.5)
    expect(forecast.outlook).toBe('clouds')
    expect(Math.abs(forecast.end - 73.4)).toBeLessThan(1.5)
    expect(forecast.chance).toBeLessThan(0.1)
  })

  it('1.3 an hour is a storm that runs out on Monday, in working hours', () => {
    const forecast = run(steady(1.3))
    expect(forecast.used).toBe(58.5)
    expect(forecast.outlook).toBe('storm')
    expect(Math.abs(forecast.chance - 0.65)).toBeLessThan(0.05)
    expect(Math.abs(forecast.end - 106)).toBeLessThan(2)
    const out = new Date(forecast.runsOutAt ?? 0)
    expect(out.getFullYear()).toBe(2026)
    expect(out.getMonth()).toBe(10)
    expect(out.getDate()).toBe(16)
    expect(out.getHours()).toBeGreaterThanOrEqual(9)
    expect(out.getHours()).toBeLessThanOrEqual(20)
  })

  it('stamps when it was worked out, and the week it is for', () => {
    const forecast = run(steady(0.9))
    expect(forecast.computedAt).toBe(NOW)
    expect(forecast.resetsAt).toBe(RESET)
    expect(forecast.startsAt).toBeNull()
  })
})

describe('the forecast follows how the week is going', () => {
  it('a front-loaded week does not run on at its early pace', () => {
    const history = shaped((t) => (t < START + 48 * HOUR_MS ? 2.4 : 0.15))
    const forecast = run(history)
    const linear = (usedOf(history) * 168) / ((NOW - START) / HOUR_MS)
    expect(forecast.outlook).not.toBe('storm')
    expect(forecast.end).toBeLessThan(100)
    expect(forecast.end).toBeLessThan(linear)
  })

  it('a ramp-up runs on past the straight line', () => {
    const history = shaped((t) => (t > NOW - 36 * HOUR_MS ? 2.0 : 0.25))
    const forecast = run(history)
    const linear = (usedOf(history) * 168) / ((NOW - START) / HOUR_MS)
    expect(forecast.end).toBeGreaterThan(linear)
  })

  it('a long gap in the readings does not move the end by more than a point', () => {
    const whole = steady(0.9)
    const gap = { resetsAt: RESET, points: whole.points.filter(([t]) => t < NOW - 40 * HOUR_MS || t > NOW - 10 * HOUR_MS) }
    const withGap = forecastWeek(gap, usedOf(whole), NOW)
    const without = run(whole)
    expect(Math.abs((withGap?.end ?? 0) - without.end)).toBeLessThan(1)
  })

  it('a single reading is enough to go by', () => {
    const forecast = forecastWeek({ resetsAt: RESET, points: [[NOW - 10 * 60_000, 48]] }, 48, NOW)
    expect(forecast?.outlook).toBe('clouds')
    expect(Math.abs((forecast?.end ?? 0) - 85)).toBeLessThan(2)
  })

  it('a week that has used everything is out: there is nothing left to forecast', () => {
    const forecast = forecastWeek({ resetsAt: RESET, points: [[NOW - 600_000, 100]] }, 100, NOW)
    expect(forecast).toEqual({
      computedAt: NOW,
      resetsAt: RESET,
      outlook: 'out',
      startsAt: null,
      used: 100,
      end: 100,
      chance: 1,
      runsOutAt: null,
      days: [],
    })
    expect(forecastWeek({ resetsAt: RESET, points: [[NOW - 600_000, 100]] }, 130, NOW)?.outlook).toBe('out')
    expect(forecastWeek({ resetsAt: RESET, points: [[NOW - 600_000, 99.9]] }, 99.9, NOW)?.outlook).not.toBe('out')
  })
})

describe('the week’s edges', () => {
  it('is early in the first day, and says when the outlook starts', () => {
    const now = START + 20 * HOUR_MS
    const forecast = forecastWeek({ resetsAt: RESET, points: [[now - 1000, 5]] }, 5, now)
    expect(forecast?.outlook).toBe('early')
    expect(forecast?.startsAt).toBe(START + 24 * HOUR_MS)
    expect(forecast?.days).toEqual([])
    expect(forecast?.used).toBe(5)
    expect(forecast?.end).toBe(5)
    expect(forecast?.chance).toBe(0)
    expect(forecast?.runsOutAt).toBeNull()
  })

  it('has no forecast once the week has reset', () => {
    expect(forecastWeek(steady(0.9), 40, RESET)).toBeNull()
    expect(forecastWeek(steady(0.9), 40, RESET + HOUR_MS)).toBeNull()
  })

  it('shows at most seven days, a day a close', () => {
    const now = START + 25 * HOUR_MS
    const forecast = forecastWeek({ resetsAt: RESET, points: [[now - 60_000, 10]] }, 10, now)
    expect(forecast?.days).toHaveLength(7)
    expect(names(forecast as Forecast)).toEqual(['TUE', 'WED', 'THU', 'FRI', 'SAT', 'SUN', 'MON'])
  })
})

describe('what holds in every forecast', () => {
  const cases: [string, WeekHistory][] = [
    ['0.6', steady(0.6)],
    ['0.9', steady(0.9)],
    ['1.3', steady(1.3)],
    ['2.0', steady(2.0)],
    ['front-loaded', shaped((t) => (t < START + 48 * HOUR_MS ? 2.4 : 0.15))],
    ['ramp-up', shaped((t) => (t > NOW - 36 * HOUR_MS ? 2.0 : 0.25))],
  ]

  it('raises the chance with the share used', () => {
    const base = steady(0.9)
    const chances = [1.0, 1.2, 1.4, 1.6, 1.8].map((factor) => {
      const history = { resetsAt: RESET, points: base.points.map(([t, p]): [number, number] => [t, Math.min(100, p * factor)]) }
      return run(history).chance
    })
    for (let i = 1; i < chances.length; i += 1) {
      expect(chances[i] as number).toBeGreaterThanOrEqual(chances[i - 1] as number)
    }
  })

  it.each(cases)('keeps each day above the last, starting from the share used: %s', (_name, history) => {
    const forecast = run(history)
    expect(forecast.days[0]?.low).toBeCloseTo(forecast.used, 9)
    forecast.days.forEach((day, i) => {
      expect(day.high).toBeGreaterThanOrEqual(day.low)
      if (i > 0) {
        expect(day.low).toBe(forecast.days[i - 1]?.high)
      }
    })
    expect(forecast.days[forecast.days.length - 1]?.high).toBeCloseTo(forecast.end, 9)
  })

  it.each(cases)('runs out exactly when it storms, and a storm has a day at 100: %s', (_name, history) => {
    const forecast = run(history)
    expect(forecast.runsOutAt !== null).toBe(forecast.outlook === 'storm')
    expect(forecast.outlook === 'storm').toBe(forecast.chance >= 0.5)
    if (forecast.outlook === 'storm') {
      expect(forecast.days.some((day) => day.high >= 100 - 1e-9)).toBe(true)
      expect(forecast.runsOutAt as number).toBeGreaterThanOrEqual(NOW)
      expect(forecast.runsOutAt as number).toBeLessThanOrEqual(RESET)
    }
  })

  it('takes under a few milliseconds a forecast', () => {
    const history = steady(0.9)
    const before = performance.now()
    for (let i = 0; i < 20; i += 1) {
      run(history)
    }
    expect((performance.now() - before) / 20).toBeLessThan(10)
  })
})

describe('recordReading', () => {
  const reading = (percent: number, at: number, resetsAt = RESET) => ({ percent, resetsAt, at })

  it('starts a history from the first reading', () => {
    const history = recordReading(null, reading(12.3, NOW))
    expect(history).toEqual({ resetsAt: RESET, points: [[NOW, 12.3]] })
  })

  it('appends a reading in a new quarter hour', () => {
    const first = recordReading(null, reading(10, NOW)) as WeekHistory
    const next = recordReading(first, reading(11, NOW + QUARTER_MS)) as WeekHistory
    expect(next).not.toBe(first)
    expect(next.points).toEqual([
      [NOW, 10],
      [NOW + QUARTER_MS, 11],
    ])
  })

  it('replaces the last point for a reading in the same quarter hour', () => {
    const slot = Math.floor(NOW / QUARTER_MS) * QUARTER_MS
    const first = recordReading(null, reading(10, slot + 1000)) as WeekHistory
    const next = recordReading(first, reading(10.6, slot + 5000)) as WeekHistory
    expect(next).not.toBe(first)
    expect(next.points).toEqual([[slot + 5000, 10.6]])
  })

  it('returns the same history for an older reading, or one at the same moment', () => {
    const first = recordReading(null, reading(10, NOW)) as WeekHistory
    expect(recordReading(first, reading(11, NOW - 1000))).toBe(first)
    expect(recordReading(first, reading(11, NOW))).toBe(first)
  })

  it('starts over for a new reset time beyond ten minutes, and not within it', () => {
    const first = recordReading(null, reading(40, NOW)) as WeekHistory
    const nextWeek = RESET + WEEK_MS
    const over = recordReading(first, reading(2, nextWeek - WEEK_MS + HOUR_MS, nextWeek)) as WeekHistory
    expect(over.resetsAt).toBe(nextWeek)
    expect(over.points).toEqual([[nextWeek - WEEK_MS + HOUR_MS, 2]])
    const jitter = recordReading(first, reading(41, NOW + QUARTER_MS, RESET + 9 * 60_000)) as WeekHistory
    expect(jitter.resetsAt).toBe(RESET)
    expect(jitter.points).toHaveLength(2)
  })

  it('starts over when the share falls by more than half a point, and keeps the old share for a smaller fall', () => {
    const first = recordReading(null, reading(40, NOW)) as WeekHistory
    const restart = recordReading(first, reading(10, NOW + QUARTER_MS)) as WeekHistory
    expect(restart.points).toEqual([[NOW + QUARTER_MS, 10]])
    const small = recordReading(first, reading(39.8, NOW + QUARTER_MS)) as WeekHistory
    expect(small.points).toEqual([
      [NOW, 40],
      [NOW + QUARTER_MS, 40],
    ])
  })

  it('keeps the newest points when there are more than the cap', () => {
    // A week holds 672 quarter hours, so a full history is made by hand
    const points = Array.from({ length: MAX_POINTS }, (_, i): [number, number] => [START + i * 60_000, i / 10])
    const next = recordReading({ resetsAt: RESET, points }, reading(99, START + MAX_POINTS * 60_000 + QUARTER_MS)) as WeekHistory
    expect(next.points).toHaveLength(MAX_POINTS)
    expect(next.points[0]).toEqual(points[1])
    expect(next.points[MAX_POINTS - 1]).toEqual([START + MAX_POINTS * 60_000 + QUARTER_MS, 99])
  })

  it('ignores a reading outside its own window', () => {
    const first = recordReading(null, reading(10, NOW)) as WeekHistory
    expect(recordReading(first, reading(11, RESET + 1000))).toBe(first)
    expect(recordReading(first, reading(11, START - 1000))).toBe(first)
    expect(recordReading(null, reading(11, RESET + 1000))).toBeNull()
  })

  it('holds a reading to 0..100', () => {
    expect(recordReading(null, reading(130, NOW))?.points).toEqual([[NOW, 100]])
    expect(recordReading(null, reading(-4, NOW))?.points).toEqual([[NOW, 0]])
  })
})
