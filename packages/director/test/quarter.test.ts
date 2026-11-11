import { describe, expect, it } from 'vitest'

import { forecastWeek } from '../src/forecast.ts'
import type { Forecast } from '../src/forecast.ts'
import { GAP_MS, quarterOf, QUARTER_MS, WEATHER_PAGE_MS } from '../src/timing.ts'
import { harness, local, session, steadyWeek, story } from './helpers.ts'
import type { Sample } from './helpers.ts'

const MIN = 60_000

// Fri 13 Nov 2026 at 10:10, local, a few minutes before the first quarter hour,
// on a week using 0.5 an hour: CLEAR SKIES, so no STORM WARNING comes in
const T = local(13, 10, 10)

function clearWorld(start: number, options: { forecastWeek?: (...args: Parameters<typeof forecastWeek>) => Forecast | null } = {}) {
  const calls: number[] = []
  const { memory, limit } = steadyWeek(0.5, start)
  const h = harness(start, [session('a', { limits: [limit] })], {
    forecastWeek: (history, used, now) => {
      calls.push(now)
      return (options.forecastWeek ?? forecastWeek)(history, used, now)
    },
  })
  h.world.weather = memory
  return { h, calls, limit }
}

// The ticks the board showed the forecast on, in runs: when each run began and
// how long it lasted
function turns(history: Sample[]): { from: number; to: number }[] {
  const runs: { from: number; to: number }[] = []
  let open: { from: number; to: number } | null = null
  for (const sample of history) {
    if (sample.program.scene.forecast !== undefined) {
      if (open === null) {
        open = { from: sample.now, to: sample.now }
        runs.push(open)
      }
      open.to = sample.now
    } else {
      open = null
    }
  }
  return runs
}

describe('the quarter hours', () => {
  it('names the quarter a moment is in: :15, :30 and :45, never the first', () => {
    const hour = local(13, 10)
    expect(quarterOf(hour)).toBeNull()
    expect(quarterOf(hour + 15 * MIN - 1)).toBeNull()
    expect(quarterOf(hour + 15 * MIN)).toBe(hour + 15 * MIN)
    expect(quarterOf(hour + 29 * MIN + 59_999)).toBe(hour + 15 * MIN)
    expect(quarterOf(hour + 30 * MIN)).toBe(hour + 30 * MIN)
    expect(quarterOf(hour + 45 * MIN)).toBe(hour + 45 * MIN)
    expect(quarterOf(hour + 60 * MIN - 1)).toBe(hour + 45 * MIN)
    expect(quarterOf(hour + 60 * MIN)).toBeNull()
    expect(QUARTER_MS).toBe(15 * MIN)
  })

  it('turns the board to the forecast at :15, :30 and :45, and never at :00', () => {
    const { h } = clearWorld(T)
    h.until(local(13, 12, 5))
    expect(turns(h.history).map((turn) => turn.from)).toEqual([
      local(13, 10, 15),
      local(13, 10, 30),
      local(13, 10, 45),
      local(13, 11, 15),
      local(13, 11, 30),
      local(13, 11, 45),
    ])
    // Three an hour; nothing at the top of the hour, where the report airs
    for (const hour of [local(13, 11), local(13, 12)]) {
      const around = h.history.filter((sample) => sample.now >= hour - 10_000 && sample.now < hour + 10_000)
      expect(around.every((sample) => sample.program.scene.forecast === undefined)).toBe(true)
    }
  })

  it('turns once for each quarter, and holds the forecast WEATHER_PAGE_MS', () => {
    const { h } = clearWorld(T)
    h.until(local(13, 10, 59))
    const found = turns(h.history)
    expect(found).toHaveLength(3)
    for (const turn of found) {
      expect(turn.to - turn.from + 250).toBe(WEATHER_PAGE_MS)
    }
  })

  it('shows the board, not a segment: the same key, no sound, no window asked for, no report', () => {
    const { h } = clearWorld(T)
    h.until(local(13, 10, 50))
    const turning = h.history.filter((sample) => sample.program.scene.forecast !== undefined)
    expect(turning).toHaveLength(3 * (WEATHER_PAGE_MS / 250))
    for (const sample of turning) {
      expect(sample.program.scene.mode).toBe('board')
      expect(sample.program.key).toBe('board')
      expect(sample.program.sounds).toEqual([])
      expect(sample.program.wantsWindow).toBe(false)
      expect(sample.program.reported).toBeNull()
    }
    // No sound anywhere in these 40 minutes
    expect(h.sounds()).toEqual([])
    expect(h.history.every((sample) => !sample.program.wantsWindow)).toBe(true)
  })

  it('keeps the crawl and the clock of the board while the forecast shows', () => {
    const { h } = clearWorld(T)
    const before = h.until(local(13, 10, 14, 59)).program.scene
    const during = h.until(local(13, 10, 15, 5)).program.scene
    expect(during.forecast).toBeDefined()
    expect(during.ticker).toEqual(before.ticker)
    expect(during.sessions).toEqual(before.sessions)
    expect(during.clock).toBe('10:15')
    expect(during.tickerLabel).toBeUndefined()
  })

  it('shows EXTENDED FORECAST: the days to the reset, made once for the turn', () => {
    const { h } = clearWorld(T)
    h.until(local(13, 10, 25))
    const scenes = h.history.flatMap((sample) => (sample.program.scene.forecast === undefined ? [] : [sample.program.scene.forecast]))
    const first = scenes[0]
    expect(first?.outlook).toBe('clear')
    expect(first?.days.length).toBeGreaterThan(1)
    expect(first?.days.map((day) => day.name)).toEqual(['FRI', 'SAT', 'SUN', 'MON'])
    expect(first?.until).toBe('TO MON 18:00')
    // One scene for the whole turn
    expect(scenes.every((scene) => scene === first)).toBe(true)
  })

  it('works out no forecast for a turn', () => {
    const { h, calls } = clearWorld(T)
    h.until(local(13, 10, 14))
    const before = calls.length
    expect(before).toBe(1)
    h.until(local(13, 10, 59))
    expect(turns(h.history)).toHaveLength(3)
    // The report on the hour works one out as it starts; the quarters do not
    const atQuarters = calls.filter((at) => at < local(13, 10, 59))
    expect(atQuarters).toHaveLength(before)
  })

  it('does not turn for a quarter that has begun when the director first ticks', () => {
    const { h } = clearWorld(local(13, 10, 20))
    h.until(local(13, 10, 40))
    expect(turns(h.history).map((turn) => turn.from)).toEqual([local(13, 10, 30)])
  })

  describe('is skipped', () => {
    it('while the window is hidden at the quarter, and not turned for later in it', () => {
      const { h } = clearWorld(T)
      h.until(local(13, 10, 14, 30))
      h.world.visible = false
      h.until(local(13, 10, 16))
      h.world.visible = true
      h.until(local(13, 10, 29))
      expect(turns(h.history)).toEqual([])
      h.until(local(13, 10, 41))
      expect(turns(h.history).map((turn) => turn.from)).toEqual([local(13, 10, 30)])
    })

    it('while the window is minimized to the side or moving, and not turned for later in the quarter', () => {
      const { h } = clearWorld(T)
      h.until(local(13, 10, 14, 30))
      h.world.windowOut = false
      h.until(local(13, 10, 16))
      h.world.windowOut = true
      h.until(local(13, 10, 29))
      expect(turns(h.history)).toEqual([])
    })

    it('cuts a turn when the window hides or goes into the side', () => {
      const { h } = clearWorld(T)
      h.until(local(13, 10, 15, 4))
      expect(turns(h.history)).toHaveLength(1)
      h.world.windowOut = false
      const cut = h.until(local(13, 10, 15, 5))
      expect(cut.program.scene.forecast).toBeUndefined()
      h.world.windowOut = true
      h.until(local(13, 10, 15, 20))
      expect(turns(h.history)).toHaveLength(1)
    })

    it('when the forecast has no outlook: the first day of the week', () => {
      const { h } = clearWorld(T, { forecastWeek: (history, used, now) => early(forecastWeek(history, used, now)) })
      h.until(local(13, 10, 59))
      expect(turns(h.history)).toEqual([])
    })

    it('when the week is used up', () => {
      const { h } = clearWorld(T, { forecastWeek: (history, used, now) => usedUp(forecastWeek(history, used, now)) })
      h.until(local(13, 10, 59))
      expect(turns(h.history)).toEqual([])
    })
  })

  describe('with a segment on air', () => {
    // A story landing at 10:14:55 airs from then: the stinger 1.9 s, the desk
    // 10 s and the outro 1.4 s
    function withStory() {
      const { h, limit } = clearWorld(T)
      h.until(local(13, 10, 14, 54))
      h.land([session('a', { limits: [limit], stories: [story('s1', 'ready', local(13, 10, 14, 55))] })], local(13, 10, 14, 55))
      return h
    }

    it('waits for it and its gap, and shows if the quarter is not over', () => {
      const h = withStory()
      h.until(local(13, 10, 16))
      const aired = h.history.filter((sample) => sample.program.key !== 'board')
      const endedAt = (aired[aired.length - 1]?.now ?? 0) + 250
      const found = turns(h.history)
      expect(found).toHaveLength(1)
      expect((found[0]?.from ?? 0) - endedAt).toBeGreaterThanOrEqual(0)
      expect((found[0]?.from ?? 0) - endedAt).toBeLessThanOrEqual(GAP_MS)
      // It held the full time, not from the quarter's moment
      h.until(local(13, 10, 40))
      const all = turns(h.history)
      expect(all[0]?.to).toBeGreaterThan(local(13, 10, 15) + WEATHER_PAGE_MS)
    })

    it('is cut by a segment that starts during it, and the outro hands back the plain board', () => {
      const { h, limit } = clearWorld(T)
      h.until(local(13, 10, 15, 4))
      const landed = h.land([session('a', { limits: [limit], stories: [story('s1', 'ready', local(13, 10, 15, 5))] })], local(13, 10, 15, 5))
      expect(landed.program.key).not.toBe('board')
      expect(landed.program.scene.forecast).toBeUndefined()
      h.until(local(13, 10, 15, 30))
      const outros = h.history.filter((sample) => sample.program.scene.mode === 'outro')
      expect(outros.length).toBeGreaterThan(0)
      expect(outros.every((sample) => sample.program.scene.board?.forecast === undefined)).toBe(true)
      expect(turns(h.history)).toHaveLength(1)
    })

    it('is dropped when the quarter is over before the segment is', () => {
      // A quarter of 8 s, so a segment can outlast it
      const quarter = local(13, 10, 15)
      const calls: number[] = []
      const { memory, limit } = steadyWeek(0.5, T)
      const h = harness(T, [session('a', { limits: [limit] })], {
        quarters: (now) => (now >= quarter && now < quarter + 8_000 ? quarter : null),
        forecastWeek: (history, used, now) => {
          calls.push(now)
          return forecastWeek(history, used, now)
        },
      })
      h.world.weather = memory
      h.until(quarter - 250)
      h.land([session('a', { limits: [limit], stories: [story('s1', 'ready', quarter)] })], quarter)
      h.until(quarter + 40_000)
      expect(h.history.some((sample) => sample.program.key !== 'board')).toBe(true)
      expect(turns(h.history)).toEqual([])
    })
  })

  it('has the top of the hour for the report: it shows no forecast turn then, and the report is unchanged', () => {
    const { h } = clearWorld(local(13, 10, 58))
    h.until(local(13, 11, 2))
    expect(h.history.some((sample) => sample.program.reported === local(13, 11))).toBe(true)
    expect(turns(h.history)).toEqual([])
  })
})

function early(forecast: Forecast | null): Forecast | null {
  return forecast === null ? null : { ...forecast, outlook: 'early', startsAt: forecast.resetsAt - 1, days: [] }
}

function usedUp(forecast: Forecast | null): Forecast | null {
  return forecast === null ? null : { ...forecast, outlook: 'out', chance: 1, days: [] }
}
