import { describe, expect, it } from 'vitest'

import { hourStart } from '@pipcast/contract'
import type { SessionRecord, UsageLimit, WeatherMemory } from '@pipcast/contract'

import { forecastWeek, MAX_POINTS } from '../src/forecast.ts'
import type { Forecast } from '../src/forecast.ts'
import { newestWeekReading } from '../src/limits.ts'
import { createWeatherDesk } from '../src/weather.ts'
import { harness, local, posts, RESET, session, steadyWeek, WEEK_START } from './helpers.ts'

const MIN = 60_000
const HOUR = 3_600_000

const weekLimit = (percentUsed: number, at: number, resetsAt = RESET): UsageLimit => ({ kind: 'week', percentUsed, resetsAt, at })
const oneDecimal = (value: number): number => Math.round(value * 10) / 10

// A harness that counts the work the weather desk does: each look through the
// sessions for the week's reading, and each time the forecast is worked out.
// With `weather`, the director is made with that memory (null for none).
function counted(start: number, sessions: SessionRecord[] = [], options: { weather?: WeatherMemory | null } = {}) {
  const scans: number[] = []
  const forecasts: number[] = []
  // The share each forecast was worked out from
  const used: number[] = []
  const h = harness(start, sessions, {
    ...(options.weather === undefined ? {} : { weather: options.weather }),
    weekReading: (found, now) => {
      scans.push(now)
      return newestWeekReading(found, now)
    },
    forecastWeek: (history, share, now) => {
      forecasts.push(now)
      used.push(share)
      return forecastWeek(history, share, now)
    },
  })
  return { h, scans, forecasts, used }
}

// The forecasts that were not for a report on the hour, which is worked out at
// five to
const apartFromReports = (forecasts: number[]): number[] => forecasts.filter((at) => new Date(at).getMinutes() !== 59)

describe('the weather desk does nothing while nothing happens', () => {
  const start = local(13, 13, 0, 10)

  function onAQuietWeek() {
    const { memory, limit } = steadyWeek(0.9, start)
    const counting = counted(start, [session('a', { limits: [limit] })])
    counting.h.world.weather = memory
    return { ...counting, limit }
  }

  it('looks through the sessions once for an hour of 250 ms ticks over one snapshot, works the forecast out once, and posts nothing', () => {
    const { h, scans, forecasts } = onAQuietWeek()
    h.until(start)
    expect(scans).toHaveLength(1)
    expect(forecasts).toHaveLength(1)
    h.until(local(13, 13, 59, 50))
    expect(h.history.length).toBeGreaterThan(14_000)
    expect(scans).toHaveLength(1)
    expect(forecasts).toHaveLength(1)
    expect(posts(h.history)).toEqual([])
    // The hour striking is the next thing: the report works the forecast out
    // afresh, and the desk still looks at nothing
    h.until(local(13, 14, 0, 10))
    expect(forecasts).toEqual([start, local(13, 13, 59, 55)])
    expect(scans).toHaveLength(1)
    expect(posts(h.history)).toEqual([])
  })

  it('looks through nothing for an hour of snapshots every second while the limits counter is unchanged', () => {
    const { h, scans, forecasts, limit } = onAQuietWeek()
    h.world.limits = 7
    for (let at = start; at < local(13, 13, 59, 50); at += 1_000) {
      // The station sends the sessions as they are, each snapshot a new object,
      // with the session checking in again
      h.world.sessions = [session('a', { limits: [limit], checkedInAt: at })]
      h.at(at)
    }
    expect(h.history.length).toBeGreaterThan(3_500)
    expect(scans).toHaveLength(1)
    expect(forecasts).toHaveLength(1)
    expect(posts(h.history)).toEqual([])
  })

  it('looks through nothing for ten heartbeats over unchanged limits, and looks when a session joins or leaves or a limit changes', () => {
    const { h, scans, forecasts, limit } = onAQuietWeek()
    h.until(start)
    expect(scans).toHaveLength(1)
    // A heartbeat rewrites the whole record with a new check-in
    for (let beat = 1; beat <= 10; beat += 1) {
      const at = start + beat * 10_000
      h.until(at - 250)
      h.world.sessions = [session('a', { limits: [limit], checkedInAt: at, stateAt: at })]
      h.until(at)
    }
    expect(scans).toHaveLength(1)
    expect(forecasts).toHaveLength(1)
    expect(posts(h.history)).toEqual([])
    // A session going on air
    const joined = [session('a', { limits: [limit] }), session('b')]
    h.world.sessions = joined
    h.until(start + 110_000)
    expect(scans).toHaveLength(2)
    // and going off it
    h.world.sessions = [joined[0] as SessionRecord]
    h.until(start + 120_000)
    expect(scans).toHaveLength(3)
    // and a session's limits changing
    h.world.sessions = [session('a', { limits: [weekLimit(limit.percentUsed + 0.2, start + 125_000)] })]
    h.until(start + 130_000)
    expect(scans).toHaveLength(4)
  })

  it('looks through the sessions when the counter moves, and does nothing with a reading that is no newer or that moved the share by less than a point', () => {
    const { h, scans, forecasts, limit } = onAQuietWeek()
    h.world.limits = 1
    h.until(start + 1_000)
    h.world.limits = 2
    h.until(start + 2_000)
    h.world.limits = 3
    h.until(start + 3_000)
    expect(scans).toHaveLength(3)
    expect(forecasts).toHaveLength(1)
    expect(posts(h.history)).toEqual([])
    h.world.sessions = [session('a', { limits: [weekLimit(limit.percentUsed + 0.4, start + 4_000)] })]
    h.world.limits = 4
    h.until(start + 5_000)
    expect(scans).toHaveLength(4)
    expect(forecasts).toHaveLength(1)
    expect(posts(h.history)).toEqual([])
  })

  it('looks through the sessions at every snapshot that carries no counter, as one says nothing of whether the limits changed', () => {
    const scans: number[] = []
    const desk = createWeatherDesk({
      memory: null,
      weekReading: (found, now) => {
        scans.push(now)
        return newestWeekReading(found, now)
      },
    })
    const snapshot = { now: start, visible: true, sessions: [session('a', { limits: [weekLimit(10, start - 1_000)] })], lastReportAt: null }
    for (let i = 0; i < 5; i += 1) {
      desk.tick(snapshot, start + i * 1_000)
    }
    expect(scans).toHaveLength(5)
    // A counter, then the same one again, then none, then it moves: it is looked at when it differs, and when there is none
    desk.tick({ ...snapshot, limits: 4 }, start + 5_000)
    desk.tick({ ...snapshot, limits: 4 }, start + 6_000)
    expect(scans).toHaveLength(6)
    desk.tick(snapshot, start + 7_000)
    desk.tick({ ...snapshot, limits: 4 }, start + 8_000)
    expect(scans).toHaveLength(8)
    desk.tick({ ...snapshot, limits: 4 }, start + 9_000)
    expect(scans).toHaveLength(8)
  })

  it('goes on taking readings from snapshots that carry no counter', () => {
    const desk = createWeatherDesk({ memory: null })
    const snapshot = (percent: number, at: number) => ({ now: at, visible: true, sessions: [session('a', { limits: [weekLimit(percent, at)] })], lastReportAt: null })
    desk.tick(snapshot(10, start), start)
    expect(desk.memory()?.points).toEqual([[start, 10]])
    // The share rises 2.5 in the hour: a reading the desk has to see, and tell the station
    desk.tick(snapshot(12.5, start + 10 * MIN), start + 10 * MIN)
    expect(desk.memory()?.points).toEqual([[start + 10 * MIN, 12.5]])
    desk.tick(snapshot(16, start + 2 * HOUR), start + 2 * HOUR)
    expect(desk.memory()?.points).toEqual([
      [start + 10 * MIN, 12.5],
      [start + 2 * HOUR, 16],
    ])
  })
})

describe('the forecast runs on these events only', () => {
  const start = local(13, 13, 0, 10)

  // Readings a `gap` apart from `start`, the first at the first tick
  function feed(percents: number[], gap = MIN) {
    const counting = counted(start, [], { weather: null })
    percents.forEach((percent, i) => {
      const at = start + i * gap
      if (i > 0) {
        counting.h.until(at - 250)
      }
      counting.h.world.sessions = [session('a', { limits: [weekLimit(percent, at)] })]
    })
    counting.h.until(start + percents.length * gap - 250)
    return counting
  }

  it('for the first reading it takes', () => {
    const { forecasts } = feed([30])
    expect(forecasts).toEqual([start])
  })

  it('for a share a whole point or more above the one the forecast holds, and for no smaller rise', () => {
    // 30 is held; 30.4, 30.9 and 30.99 are under a point above it; 31.0 is a whole point; 31.8 is under a point above that; 32.0 is a whole point again
    const { forecasts, scans } = feed([30, 30.4, 30.9, 30.99, 31.0, 31.8, 32.0, 32.1])
    expect(scans).toHaveLength(8)
    expect(forecasts).toEqual([start, start + 4 * MIN, start + 6 * MIN])
  })

  it('for a new week: the reset moved', () => {
    const { h, forecasts } = feed([30, 30.2])
    expect(forecasts).toHaveLength(1)
    const tick = start + 2 * MIN
    h.world.sessions = [session('a', { limits: [weekLimit(30.3, tick - 1_000, RESET + 24 * HOUR)] })]
    h.until(tick)
    expect(forecasts).toEqual([start, tick])
  })

  it('for a new week: the reset moved, and the memory is told of it at once, starting over', () => {
    const { h, forecasts } = feed([60, 60.2])
    const tick = start + 2 * MIN
    // The reset moves a day on, so the reading is still within its window
    const next = RESET + 24 * HOUR
    h.world.sessions = [session('a', { limits: [weekLimit(4, tick - 1_000, next)] })]
    h.until(tick)
    expect(forecasts).toEqual([start, tick])
    const told = posts(h.history)
    expect(told[told.length - 1]?.memory.resetsAt).toBe(next)
    expect(told[told.length - 1]?.memory.points.map(([, percent]) => percent)).toEqual([4])
  })

  it.each([59.8, 59, 30, 0])('and not for a share of %s after 60.2 in the same week: it is stale, so nothing runs and nothing is posted', (lower) => {
    const { h, forecasts } = feed([60, 60.2])
    const told = posts(h.history).length
    const tick = start + 2 * MIN
    h.world.sessions = [session('a', { limits: [weekLimit(lower, tick - 1_000)] })]
    h.until(tick)
    expect(forecasts).toHaveLength(1)
    expect(posts(h.history)).toHaveLength(told)
  })

  it('for the report on the hour, and for a warning’s hour up while the forecast says storm', () => {
    // A week using 1.6 an hour: a storm, warned at 10:15 on Friday
    const T = local(13, 10, 15)
    const { memory, limit } = steadyWeek(1.6, T)
    const counting = counted(T, [session('a', { limits: [limit] })])
    counting.h.world.weather = memory
    counting.h.until(T + 2 * HOUR + 2 * MIN)
    // The first reading; the report at 11:00; the hour up at 11:15; the report at 12:00; the hour up at 12:15
    expect(counting.forecasts).toEqual([T, local(13, 10, 59, 55), T + HOUR, local(13, 11, 59, 55), T + 2 * HOUR])
  })
})

describe('a stale reading', () => {
  const start = local(13, 13, 0, 10)
  const { memory, limit } = steadyWeek(0.9, start)
  const share = limit.percentUsed

  it('from a session tuning in, an older and lower share stamped now, neither restarts the week, nor lowers the share forecast from, nor posts', () => {
    const { h, forecasts, used } = counted(start, [session('a', { limits: [weekLimit(share - 8, start)] })])
    h.world.weather = memory
    h.until(start + 30 * MIN)
    // The forecast is worked out once, from the week as it stands
    expect(forecasts).toEqual([start])
    expect(used).toEqual([share])
    expect(posts(h.history)).toEqual([])
    // Then the week's own next reading: the history is whole, with every earlier point
    const next = start + 31 * MIN
    h.until(next - 250)
    h.world.sessions = [session('a', { limits: [weekLimit(share + 1.2, next)] })]
    h.until(next)
    const told = posts(h.history)
    expect(told).toHaveLength(1)
    expect(told[0]?.memory.resetsAt).toBe(RESET)
    expect(told[0]?.memory.points.slice(0, memory.points.length - 1)).toEqual(memory.points.slice(0, -1))
    expect(told[0]?.memory.points[told[0].memory.points.length - 1]).toEqual([next, share + 1.2])
  })

  it('that comes while the desk holds the week changes nothing, and a true reading dated before it is still taken', () => {
    const { h, forecasts, scans } = counted(start, [], { weather: null })
    h.world.sessions = [session('a', { limits: [weekLimit(50, start)] })]
    h.until(start + 10 * MIN)
    expect(forecasts).toEqual([start])
    const told = posts(h.history).length
    // The stale one, stamped later than the reading that follows it
    h.world.sessions = [session('a', { limits: [weekLimit(40, start + 20 * MIN)] })]
    h.until(start + 21 * MIN)
    expect(scans.length).toBeGreaterThan(1)
    expect(forecasts).toEqual([start])
    expect(posts(h.history)).toHaveLength(told)
    // A true reading from before the stale stamp, a whole point higher: taken
    h.world.sessions = [session('a', { limits: [weekLimit(51.5, start + 15 * MIN)] })]
    h.until(start + 22 * MIN)
    expect(forecasts).toHaveLength(2)
    const last = posts(h.history).pop()
    expect(last?.memory.points[last.memory.points.length - 1]).toEqual([start + 15 * MIN, 51.5])
  })

  it('from a share that steps down a point and back up leaves the points whole', () => {
    const desk = createWeatherDesk({ memory: null })
    const tick = (percent: number, at: number, limits: number) =>
      desk.tick({ now: at, visible: true, sessions: [session('a', { limits: [weekLimit(percent, at)] })], lastReportAt: null, limits }, at)
    tick(41, local(13, 10, 5), 1)
    expect(desk.memory()?.points).toEqual([[local(13, 10, 5), 41]])
    tick(40, local(13, 11, 5), 2)
    expect(desk.memory()).toBeNull()
    tick(41.3, local(13, 12, 5), 3)
    expect(desk.memory()?.points).toEqual([
      [local(13, 10, 5), 41],
      [local(13, 12, 5), 41.3],
    ])
  })

  it('takes the highest share across the sessions on air, not the newest reading', () => {
    const { h, used } = counted(start, [
      session('a', { limits: [weekLimit(55, start - 600_000)] }),
      session('b', { limits: [weekLimit(41, start)] }),
    ], { weather: null })
    h.until(start + 10_000)
    expect(used).toEqual([55])
    expect(posts(h.history)[0]?.memory.points).toEqual([[start - 600_000, 55]])
  })

  it('works a forecast out when the first reading is stale against the memory it was handed, from that memory', () => {
    // The memory ends at `share`; a session reads far below it
    const { h, forecasts, used } = counted(start, [session('a', { limits: [weekLimit(10, start)] })], { weather: memory })
    h.until(start + 250)
    expect(forecasts).toEqual([start])
    expect(used).toEqual([share])
    const items = h.history[h.history.length - 1]?.program.scene.ticker ?? []
    expect(items.some((item) => typeof item !== 'string' && item.key === 'forecast')).toBe(true)
  })
})

describe('a desk with a reading and no forecast', () => {
  const start = local(13, 13, 0, 10)

  it('works one out when a newer reading comes, once, though the first reading was outside its window', () => {
    const forecasts: number[] = []
    const desk = createWeatherDesk({
      memory: null,
      forecastWeek: (history, used, now) => {
        forecasts.push(now)
        return forecastWeek(history, used, now)
      },
    })
    const tick = (percent: number, at: number, now: number, limits: number) =>
      desk.tick({ now, visible: true, sessions: [session('a', { limits: [weekLimit(percent, at)] })], lastReportAt: null, limits }, now)
    // Read before its own window began: not one of this week's, so the desk has a reading and no history
    tick(20, WEEK_START - HOUR, start, 1)
    expect(forecasts).toEqual([])
    expect(desk.forecast()).toBeNull()
    expect(desk.memory()).toBeNull()
    // The next, inside it, with a share under a point above nothing held
    tick(20.2, start + MIN, start + MIN, 2)
    expect(forecasts).toEqual([start + MIN])
    expect(desk.forecast()).not.toBeNull()
    expect(desk.memory()?.points).toEqual([[start + MIN, 20.2]])
    // And then it holds one again, so a small rise works nothing out
    tick(20.5, start + 2 * MIN, start + 2 * MIN, 3)
    expect(forecasts).toHaveLength(1)
  })
})

describe('the moments that come by the clock alone', () => {
  it('works out the forecast once when the week’s first day ends, with no new reading', () => {
    const start = WEEK_START + 20 * HOUR
    const startsAt = WEEK_START + 24 * HOUR
    const { h, forecasts } = counted(start, [session('a', { limits: [weekLimit(5, start - 1_000)] })], { weather: null })
    const forecastLine = () => {
      const items = h.history[h.history.length - 1]?.program.scene.ticker ?? []
      const item = items.find((entry) => typeof entry !== 'string' && entry.key === 'forecast')
      return typeof item === 'string' || item === undefined ? undefined : item.text
    }
    h.until(startsAt - 30 * MIN)
    expect(apartFromReports(forecasts)).toEqual([start])
    expect(forecastLine()).toBe('The week’s outlook starts Tue 18:00')
    h.until(startsAt - 250)
    expect(apartFromReports(forecasts)).toEqual([start])
    h.until(startsAt)
    expect(apartFromReports(forecasts)).toEqual([start, startsAt])
    h.until(startsAt + 30 * MIN)
    expect(forecastLine()).not.toBe('The week’s outlook starts Tue 18:00')
    h.until(startsAt + 3 * HOUR)
    expect(apartFromReports(forecasts)).toEqual([start, startsAt])
  })

  it('clears the forecast when the week resets, with no run, and airs no STORM WARNING after it', () => {
    // A storm that the forecast holds until the reset, whatever the time
    const T = RESET - 90 * MIN
    const { memory, limit } = steadyWeek(1.6, local(13, 10, 15))
    const forecasts: number[] = []
    let reference: Forecast | null = null
    const h = harness(T, [session('a', { limits: [limit] })], {
      forecastWeek: (history, used, now) => {
        forecasts.push(now)
        reference ??= forecastWeek(history, used, local(13, 10, 15))
        return reference === null ? null : { ...reference, computedAt: now }
      },
    })
    h.world.weather = memory
    h.until(RESET - 250)
    expect(forecasts.length).toBeGreaterThan(0)
    const warned = h.history.filter((sample) => sample.program.key.startsWith('warning:'))
    expect(warned.length).toBeGreaterThan(0)
    h.until(RESET + 150 * MIN)
    // Nothing was worked out for the week that had reset, and no warning aired in it
    expect(forecasts.filter((at) => at >= RESET)).toEqual([])
    expect(h.history.filter((sample) => sample.now >= RESET && sample.program.key.startsWith('warning:'))).toEqual([])
    // Nor does the board speak of a forecast
    const board = h.history[h.history.length - 1]?.program.scene.ticker ?? []
    expect(board.length).toBeGreaterThan(0)
    expect(board.some((item) => typeof item !== 'string' && (item.key === 'forecast' || item.lead === 'STORM WARNING'))).toBe(false)
  })
})

describe('the memory the desk goes by', () => {
  const start = local(13, 13, 0, 10)
  const { memory, limit } = steadyWeek(0.9, start)
  const rising = (percent: number, at: number) => [session('a', { limits: [weekLimit(percent, at)] })]

  it('takes no readings and posts nothing for a desk that was never handed a memory', () => {
    const { h, scans, forecasts } = counted(start, [session('a', { limits: [limit] })])
    h.world.weather = undefined
    for (let at = start; at < start + 3 * HOUR; at += 20 * MIN) {
      h.world.sessions = rising(limit.percentUsed + ((at - start) / HOUR) * 2, at)
      h.until(at + 20 * MIN - 250)
    }
    expect(scans).toEqual([])
    expect(forecasts).toEqual([])
    expect(posts(h.history)).toEqual([])
    const items = h.history[h.history.length - 1]?.program.scene.ticker ?? []
    expect(items.some((item) => typeof item !== 'string' && item.key === 'forecast')).toBe(false)
  })

  it('takes the memory from the next snapshot that carries it when the first never arrived, and posts nothing in between', () => {
    const { h, forecasts } = counted(start, [session('a', { limits: [limit] })])
    h.world.weather = undefined
    h.until(start + 10 * MIN)
    expect(forecasts).toEqual([])
    expect(posts(h.history)).toEqual([])
    h.world.weather = memory
    h.until(start + 10 * MIN + 250)
    expect(forecasts).toEqual([start + 10 * MIN + 250])
    expect(posts(h.history)).toEqual([])
    // From then on the snapshots leave it out, and the desk goes on with what it took
    h.world.weather = undefined
    h.until(start + 11 * MIN - 250)
    h.world.sessions = rising(limit.percentUsed + 1.2, start + 11 * MIN)
    h.until(start + 12 * MIN)
    const told = posts(h.history)
    expect(told).toHaveLength(1)
    expect(told[0]?.memory.points).toEqual([...memory.points.slice(0, -1), [start + 11 * MIN, limit.percentUsed + 1.2]])
  })

  it('goes by the memory it was made with, so a director built again mid-week keeps the whole week in its first post', () => {
    const h = harness(start, [session('a', { limits: [limit] })], { weather: memory })
    // A snapshot that does not carry the memory, as every one after the page took it
    h.world.weather = undefined
    h.until(start + 5 * MIN)
    expect(posts(h.history)).toEqual([])
    // The first reading of the next hour
    const next = local(13, 14, 0, 30)
    h.until(next - 250)
    h.world.sessions = rising(limit.percentUsed + 0.4, next)
    h.until(next + 250)
    const told = posts(h.history)
    expect(told).toHaveLength(1)
    const kept = told[0]?.memory
    expect(kept?.points).toHaveLength(memory.points.length + 1)
    expect(kept?.points.slice(0, memory.points.length)).toEqual(memory.points)
    expect(kept?.resetsAt).toBe(RESET)
  })

  it('thins a memory of finer times to the hours as it takes it', () => {
    const fine = steadyWeek(0.9, start, 15 * MIN)
    const hourly = steadyWeek(0.9, start)
    expect(fine.memory.points.length).toBeGreaterThan(3 * hourly.memory.points.length)
    const h = harness(start, [session('a', { limits: [fine.limit] })], { weather: fine.memory })
    h.world.weather = undefined
    const next = local(13, 14, 0, 30)
    h.until(next - 250)
    h.world.sessions = rising(fine.limit.percentUsed + 0.4, next)
    h.until(next + 250)
    const kept = posts(h.history)[0]?.memory.points ?? []
    expect(kept.length).toBeGreaterThan(0)
    expect(kept.length).toBeLessThanOrEqual(hourly.memory.points.length + 2)
    const hours = kept.map(([at]) => hourStart(at))
    expect(new Set(hours).size).toBe(hours.length)
  })

  it('starts a history from the first reading when there is no memory', () => {
    const { h } = counted(start, [session('a', { limits: [weekLimit(12, start - 1_000)] })], { weather: null })
    h.until(start + 250)
    const told = posts(h.history)
    expect(told).toHaveLength(1)
    expect(told[0]?.memory.points).toEqual([[start - 1_000, 12]])
  })
})

describe('what the station is told to keep', () => {
  // Wed 11 Nov, 09:00, on a week that has used 0.5 an hour so far
  const start = local(11, 9, 0)
  const base = steadyWeek(0.5, start)
  const last = base.limit.percentUsed

  // Readings a `gap` apart from `gap` after 09:00, over that week's memory
  function day(readings: number[], gap: number) {
    const counting = counted(start, [session('a', { limits: [base.limit] })])
    counting.h.world.weather = base.memory
    readings.forEach((percent, i) => {
      const at = start + (i + 1) * gap
      counting.h.until(at - 250)
      counting.h.world.sessions = [session('a', { limits: [weekLimit(percent, at)] })]
    })
    counting.h.until(start + (readings.length + 1) * gap - 250)
    return counting
  }

  it('is a post for a new hour’s point or a whole point more in the hour, and nothing for less', () => {
    // 09:15 and 09:30 rise less than a point; 09:45 a whole point; 10:00 is a new hour; 10:15 rises 0.6 in its hour; 10:30 a whole point
    const { h } = day([last + 0.2, last + 0.7, last + 1.1, last + 1.3, last + 1.9, last + 2.4].map(oneDecimal), 15 * MIN)
    const told = posts(h.history)
    expect(told.map((post) => post.now)).toEqual([start + 3 * 15 * MIN, start + 4 * 15 * MIN, start + 6 * 15 * MIN])
    expect(told.map((post) => post.memory.points[post.memory.points.length - 1]?.[1])).toEqual([oneDecimal(last + 1.1), oneDecimal(last + 1.3), oneDecimal(last + 2.4)])
    expect(told.map((post) => post.memory.points.length - base.memory.points.length)).toEqual([0, 1, 1])
  })

  it('is a post for a new hour’s point when the history is full and the oldest point goes as the new one comes', () => {
    const end = local(13, 13, 0)
    const points = Array.from({ length: MAX_POINTS }, (_, i): [number, number] => [end - (MAX_POINTS - 1 - i) * HOUR, oneDecimal(10 + i * 0.1)])
    const full: WeatherMemory = { v: 1, resetsAt: RESET, points, warnedAt: null }
    const h = harness(end, [session('a', { limits: [weekLimit(30, end)] })], { weather: full })
    h.world.weather = undefined
    h.until(end + 10 * MIN)
    expect(posts(h.history)).toEqual([])
    // The next hour's reading: the count of points stays at the cap
    const next = end + HOUR + 20 * MIN
    h.world.sessions = [session('a', { limits: [weekLimit(30.2, next)] })]
    h.until(next + 250)
    const told = posts(h.history)
    expect(told).toHaveLength(1)
    expect(told[0]?.memory.points).toHaveLength(MAX_POINTS)
    expect(told[0]?.memory.points[0]).toEqual(points[1])
    expect(told[0]?.memory.points[MAX_POINTS - 1]).toEqual([next, 30.2])
  })

  it('is the hour’s last whole-point reading when the station quits mid-hour after the share rose 3 points in it', () => {
    const at = local(11, 13, 0, 5)
    const week = steadyWeek(0.5, at)
    const counting = counted(at, [session('a', { limits: [week.limit] })])
    counting.h.world.weather = week.memory
    // A reading every 4 minutes from 13:00:05 to 13:56:05, 0.26 a time: 3.9 in the hour
    const percents: number[] = []
    for (let i = 0; i < 15; i += 1) {
      const when = at + i * 4 * MIN
      const percent = week.limit.percentUsed + (i + 1) * 0.26
      percents.push(percent)
      if (i > 0) {
        counting.h.until(when - 250)
      }
      counting.h.world.sessions = [session('a', { limits: [weekLimit(percent, when)] })]
    }
    counting.h.until(at + 15 * 4 * MIN - 250)
    // The station quits here, and its file holds the last post
    const told = posts(counting.h.history)
    const file = told[told.length - 1]?.memory
    const kept = file?.points[file.points.length - 1] as [number, number]
    const final = percents[percents.length - 1] as number
    expect(told).toHaveLength(3)
    // The reading that rose the hour's point a third whole point, 13:44:05, not the hour's first
    expect(kept).toEqual([at + 11 * 4 * MIN, percents[11]])
    expect(final - kept[1]).toBeLessThan(1)
    expect(final - week.limit.percentUsed).toBeGreaterThan(3)
    expect(file?.points).toHaveLength(week.memory.points.length)
  })

  it('is at most a post an hour, one for each whole point and one for each warning over a working day of readings every 5 minutes, each moving the share 0.1 to 0.4 points; and the forecast runs once for each whole point', () => {
    const gap = 5 * MIN
    const steps = [0.1, 0.4, 0.2, 0.3]
    const percents: number[] = []
    let running = last
    for (let i = 0; i < 144; i += 1) {
      running = oneDecimal(running + (steps[i % steps.length] as number))
      percents.push(running)
    }
    const { h, forecasts } = day(percents, gap)
    const readingTimes = percents.map((_, i) => start + (i + 1) * gap)
    const percentAt = (when: number): number => {
      let found = last
      readingTimes.forEach((at, i) => {
        if (at <= when) {
          found = percents[i] as number
        }
      })
      return found
    }
    const warnings = new Set(h.history.map((sample) => sample.program.key).filter((key) => key.startsWith('warning:')).map((key) => Number(key.split(':')[1])))
    const isReport = (when: number) => new Date(when).getMinutes() === 59 && new Date(when).getSeconds() === 55
    const isWarningsHourUp = (when: number) => warnings.has(when - HOUR)
    // Every forecast is for a reading a whole point above the one held, a report on the hour or a warning's hour up
    // (the first is for the first reading), and no whole point passed without one
    const calls = new Set(forecasts)
    let held = last
    let wholePoints = 0
    for (const when of [...new Set([...readingTimes, ...forecasts])].sort((a, b) => a - b)) {
      if (when === start) {
        continue
      }
      const rise = readingTimes.includes(when) && percentAt(when) - held >= 1
      if (rise) {
        wholePoints += 1
        expect(calls.has(when), `no forecast at ${new Date(when).toString()}`).toBe(true)
      } else if (calls.has(when)) {
        expect(isReport(when) || isWarningsHourUp(when), `forecast at ${new Date(when).toString()}`).toBe(true)
      }
      if (calls.has(when)) {
        held = percentAt(when)
      }
    }
    expect(forecasts[0]).toBe(start)
    expect(wholePoints).toBeGreaterThan(5)
    expect(forecasts.filter(isReport).length).toBeGreaterThanOrEqual(10)
    // Memory posts: a new hour's point, a whole point in the hour, a warning's time
    const told = posts(h.history)
    expect(told.length).toBeGreaterThan(0)
    expect(told.length).toBeLessThanOrEqual(12 + Math.floor(running - last) + warnings.size + 1)
    const points = told[told.length - 1]?.memory.points.length ?? 0
    // A point an hour at most
    expect(points - base.memory.points.length).toBeLessThanOrEqual(13)
  })
})
