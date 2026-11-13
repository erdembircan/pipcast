import { dayName, hourStart } from '@pipcast/contract'
import { describe, expect, it } from 'vitest'

import { classifyReading, forecastWeek, gammaMedian, gammaP, hourlyPoints, MAX_POINTS, recordReading, RESET_FALL, WEEK_MS } from '../src/forecast.ts'
import type { Forecast, WeekHistory, WeekReading } from '../src/forecast.ts'
import { HOUR_MS } from '../src/timing.ts'

// Local-time constructors, so the cases hold in any time zone. The reference
// week resets Mon 16 Nov 2026 at 18:00, and it is Fri 13 Nov, 15:12.
const RESET = new Date(2026, 10, 16, 18, 0).getTime()
const NOW = new Date(2026, 10, 13, 15, 12).getTime()
const START = RESET - WEEK_MS
// The fixtures' weeks are read at a point every quarter hour, finer than the one an hour the desk keeps
const QUARTER_MS = 15 * 60_000

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

  it('is out when the week is used up even in its first day, not early', () => {
    const now = START + 20 * HOUR_MS
    const forecast = forecastWeek({ resetsAt: RESET, points: [[now - 1000, 100]] }, 100, now)
    expect(forecast).toEqual({
      computedAt: now,
      resetsAt: RESET,
      outlook: 'out',
      startsAt: null,
      used: 100,
      end: 100,
      chance: 1,
      runsOutAt: null,
      days: [],
    })
    // A week that has not run out is still early in its first day
    expect(forecastWeek({ resetsAt: RESET, points: [[now - 1000, 99]] }, 99, now)?.outlook).toBe('early')
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

  it('appends a reading in a new hour', () => {
    const first = recordReading(null, reading(10, NOW)) as WeekHistory
    const next = recordReading(first, reading(11, NOW + HOUR_MS)) as WeekHistory
    expect(next).not.toBe(first)
    expect(next.points).toEqual([
      [NOW, 10],
      [NOW + HOUR_MS, 11],
    ])
  })

  it('replaces the last point for a reading in the same hour, so the point holds the hour’s last reading at its own time', () => {
    const slot = hourStart(NOW)
    const first = recordReading(null, reading(10, slot + 1000)) as WeekHistory
    const next = recordReading(first, reading(10.6, slot + 20 * 60_000)) as WeekHistory
    expect(next).not.toBe(first)
    expect(next.points).toEqual([[slot + 20 * 60_000, 10.6]])
    const last = recordReading(next, reading(11.2, slot + HOUR_MS - 1000)) as WeekHistory
    expect(last.points).toEqual([[slot + HOUR_MS - 1000, 11.2]])
    const following = recordReading(last, reading(11.3, slot + HOUR_MS)) as WeekHistory
    expect(following.points).toEqual([
      [slot + HOUR_MS - 1000, 11.2],
      [slot + HOUR_MS, 11.3],
    ])
  })

  it('keeps a week of readings at every minute to its 168 hours', () => {
    let history: WeekHistory | null = null
    for (let t = START + 60_000; t < START + WEEK_MS; t += 60_000) {
      history = recordReading(history, reading(Math.min(100, (t - START) / WEEK_MS * 100), t))
    }
    expect(history?.points.length).toBeLessThanOrEqual(169)
    expect(history?.points.length).toBeGreaterThanOrEqual(168)
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
    const jitter = recordReading(first, reading(41, NOW + HOUR_MS, RESET + 9 * 60_000)) as WeekHistory
    expect(jitter.resetsAt).toBe(RESET)
    expect(jitter.points).toHaveLength(2)
  })

  it('ignores a lower share in the same window that was not measured, by any amount: it is a stale reading, not a reset', () => {
    const first = recordReading(null, reading(40, NOW)) as WeekHistory
    for (const lower of [39.9, 39.5, 39, 10, 0]) {
      expect(recordReading(first, reading(lower, NOW + HOUR_MS))).toBe(first)
    }
    // Nor does it restart for a reset time that jitters within the tolerance
    expect(recordReading(first, reading(10, NOW + HOUR_MS, RESET + 9 * 60_000))).toBe(first)
  })

  it('keeps the same share as a flat point, and leaves the points whole for a share that steps down a point and back up', () => {
    let history = recordReading(null, reading(41, NOW)) as WeekHistory
    const stepDown = recordReading(history, reading(40, NOW + HOUR_MS)) as WeekHistory
    expect(stepDown).toBe(history)
    history = recordReading(stepDown, reading(41, NOW + 2 * HOUR_MS)) as WeekHistory
    expect(history.points).toEqual([
      [NOW, 41],
      [NOW + 2 * HOUR_MS, 41],
    ])
    history = recordReading(history, reading(41.6, NOW + 3 * HOUR_MS)) as WeekHistory
    expect(history.points.map(([, percent]) => percent)).toEqual([41, 41, 41.6])
  })

  it('keeps the newest points when there are more than the cap', () => {
    // A week holds 168 hours, so a full history is made by hand, a point a minute
    const points = Array.from({ length: MAX_POINTS }, (_, i): [number, number] => [START + i * 60_000, i / 10])
    const next = recordReading({ resetsAt: RESET, points }, reading(99, START + MAX_POINTS * 60_000 + HOUR_MS)) as WeekHistory
    expect(next.points).toHaveLength(MAX_POINTS)
    expect(next.points[0]).toEqual(points[1])
    expect(next.points[MAX_POINTS - 1]).toEqual([START + MAX_POINTS * 60_000 + HOUR_MS, 99])
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

describe('a reset in place', () => {
  const measured = (percent: number, at: number, resetsAt = RESET): WeekReading => ({ percent, resetsAt, at, measured: true })
  const unmeasured = (percent: number, at: number, resetsAt = RESET): WeekReading => ({ percent, resetsAt, at })
  const week = (...shares: number[]): WeekHistory => ({ resetsAt: RESET, points: shares.map((share, i): [number, number] => [NOW + i * HOUR_MS, share]) })
  const after = NOW + 10 * HOUR_MS

  it('is a measured share at least RESET_FALL lower than the week’s last, and is appended', () => {
    expect(RESET_FALL).toBe(5)
    for (const lower of [3, 35, 0]) {
      const first = week(40)
      expect(classifyReading(first, measured(lower, after))).toBe('reset')
      const next = recordReading(first, measured(lower, after)) as WeekHistory
      expect(next).not.toBe(first)
      expect(next.points).toEqual([
        [NOW, 40],
        [after, lower],
      ])
    }
  })

  it('is no reset when the fall is under RESET_FALL, and the history is the same one', () => {
    const first = week(40)
    expect(classifyReading(first, measured(35.1, after))).toBe('stale')
    expect(classifyReading(first, measured(40 - 4.9, after))).toBe('stale')
    expect(recordReading(first, measured(35.1, after))).toBe(first)
  })

  it('is no reset when the reading is not measured, or is no newer than the last point', () => {
    const first = week(40)
    expect(classifyReading(first, unmeasured(3, after))).toBe('stale')
    expect(recordReading(first, unmeasured(3, after))).toBe(first)
    expect(classifyReading(first, measured(3, NOW))).toBe('stale')
    expect(recordReading(first, measured(3, NOW))).toBe(first)
    expect(recordReading(first, measured(3, NOW - 1000))).toBe(first)
  })

  it('is a new week, and not a reset, when the reset time has moved', () => {
    const nextWeek = RESET + WEEK_MS
    expect(classifyReading(week(40), measured(3, nextWeek - WEEK_MS + HOUR_MS, nextWeek))).toBe('take')
    expect(classifyReading(null, unmeasured(3, NOW))).toBe('take')
  })

  it('leaves the points before it, and makes any reading not measured stale after it, whatever its share', () => {
    let history = week(30, 40)
    history = recordReading(history, measured(3, after)) as WeekHistory
    expect(history.points.map(([, share]) => share)).toEqual([30, 40, 3])
    // A session tuning in may give the share it read before the reset, or any older one
    for (const share of [39, 40, 55, 2]) {
      expect(classifyReading(history, unmeasured(share, after + HOUR_MS))).toBe('stale')
      expect(recordReading(history, unmeasured(share, after + HOUR_MS))).toBe(history)
    }
    // Only a measured reading moves the week from there
    expect(classifyReading(history, measured(10, after + HOUR_MS))).toBe('take')
    expect(classifyReading(history, measured(45, after + HOUR_MS))).toBe('take')
    expect((recordReading(history, measured(10, after + HOUR_MS)) as WeekHistory).points.map(([, share]) => share)).toEqual([30, 40, 3, 10])
  })

  it('in the same hour as the peak keeps both points, and a reading after it in that hour replaces the fall', () => {
    const slot = hourStart(NOW)
    const first = recordReading(null, measured(40, slot + 1000)) as WeekHistory
    const next = recordReading(first, measured(3, slot + 20 * 60_000)) as WeekHistory
    expect(next.points).toEqual([
      [slot + 1000, 40],
      [slot + 20 * 60_000, 3],
    ])
    const rising = recordReading(next, measured(4, slot + 30 * 60_000)) as WeekHistory
    expect(rising.points).toEqual([
      [slot + 1000, 40],
      [slot + 30 * 60_000, 4],
    ])
  })

  it('counts the share read after it as the use across it, for the hourly rates', () => {
    const base: [number, number][] = [
      [START + 24 * HOUR_MS, 20],
      [START + 48 * HOUR_MS, 40],
      [START + 60 * HOUR_MS, 90],
    ]
    const at = START + 60 * HOUR_MS + 30 * 60_000
    const reset = forecastWeek({ resetsAt: RESET, points: [...base, [at, 6]] }, 6, at + 60_000) as Forecast
    const flat = forecastWeek({ resetsAt: RESET, points: [...base, [at, 0]] }, 0, at + 60_000) as Forecast
    expect(reset.end - reset.used).toBeGreaterThan(flat.end - flat.used)
  })

  it('takes a week used up and reset in place for one that is no longer out', () => {
    const history = week(100)
    const out = forecastWeek(history, 100, after) as Forecast
    expect(out.outlook).toBe('out')
    const next = recordReading(history, measured(3, after)) as WeekHistory
    const forecast = forecastWeek(next, 3, after) as Forecast
    expect(forecast.outlook).not.toBe('out')
    expect(forecast.used).toBe(3)
  })
})

describe('hourlyPoints', () => {
  it('keeps the last point of each hour, at its own time', () => {
    const slot = hourStart(NOW)
    const points: [number, number][] = [
      [slot + 5 * 60_000, 10],
      [slot + 20 * 60_000, 10.4],
      [slot + 50 * 60_000, 10.9],
      [slot + HOUR_MS + 10 * 60_000, 11.5],
      [slot + 3 * HOUR_MS, 12],
    ]
    expect(hourlyPoints(points)).toEqual([
      [slot + 50 * 60_000, 10.9],
      [slot + HOUR_MS + 10 * 60_000, 11.5],
      [slot + 3 * HOUR_MS, 12],
    ])
  })

  it('keeps a fall in the same hour, a reset in place, and still thins a rise in it', () => {
    const slot = hourStart(NOW)
    expect(
      hourlyPoints([
        [slot + 5 * 60_000, 40],
        [slot + 20 * 60_000, 3],
        [slot + 30 * 60_000, 4],
        [slot + 50 * 60_000, 6],
      ]),
    ).toEqual([
      [slot + 5 * 60_000, 40],
      [slot + 50 * 60_000, 6],
    ])
    expect(
      hourlyPoints([
        [slot + 5 * 60_000, 40],
        [slot + 20 * 60_000, 3],
      ]),
    ).toEqual([
      [slot + 5 * 60_000, 40],
      [slot + 20 * 60_000, 3],
    ])
  })

  it('leaves an hourly week alone, and an empty one', () => {
    const hourly = steady(0.9).points.filter(([t]) => t % HOUR_MS === 0)
    expect(hourlyPoints(hourly)).toEqual(hourly)
    expect(hourlyPoints([])).toEqual([])
  })
})

describe('a week kept at one point an hour', () => {
  const HOURLY_SHAPES: [string, (t: number) => number][] = [
    ['steady 0.6', () => 0.6],
    ['steady 0.9', () => 0.9],
    ['steady 1.2', () => 1.2],
    ['steady 1.5', () => 1.5],
    ['front-loaded', (t) => (t < START + 48 * HOUR_MS ? 2.4 : 0.15)],
    ['ramp-up', (t) => (t > START + 5 * 24 * HOUR_MS ? 2.0 : 0.25)],
  ]

  // The week up to `now` at a point every quarter hour
  function quarters(rate: (t: number) => number, now: number): [number, number][] {
    const points: [number, number][] = []
    let cum = 0
    for (let t = START; t + QUARTER_MS <= now; t += QUARTER_MS) {
      const hour = new Date(t).getHours()
      if (hour >= 9 && hour < 21) {
        cum += rate(t) / 4
      }
      points.push([t + QUARTER_MS, Math.round(cum * 10) / 10])
    }
    return points
  }

  it('reads as the same weather as the same week at a point every quarter hour: no outlook changes, the changes small', () => {
    let largestChance = 0
    let largestEnd = 0
    let moments = 0
    for (const [name, rate] of HOURLY_SHAPES) {
      // Every 45 minutes from Tue 18:00 to the day before the reset
      for (let now = START + 24 * HOUR_MS; now < RESET - HOUR_MS; now += 45 * 60_000) {
        const full = quarters(rate, now)
        if (full.length < 2 || (full[full.length - 1] as [number, number])[1] >= 100) {
          continue
        }
        const used = (full[full.length - 1] as [number, number])[1]
        const quarter = forecastWeek({ resetsAt: RESET, points: full }, used, now)
        const hourly = forecastWeek({ resetsAt: RESET, points: hourlyPoints(full) }, used, now)
        expect(hourly?.outlook, `${name} at ${new Date(now).toString()}`).toBe(quarter?.outlook)
        if (quarter !== null && hourly !== null) {
          moments += 1
          largestChance = Math.max(largestChance, Math.abs(quarter.chance - hourly.chance))
          largestEnd = Math.max(largestEnd, Math.abs(quarter.end - hourly.end))
        }
      }
    }
    expect(moments).toBeGreaterThan(500)
    expect(largestChance).toBeLessThan(0.02)
    expect(largestEnd).toBeLessThan(1)
  })
})
