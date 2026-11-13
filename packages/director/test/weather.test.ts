import { describe, expect, it } from 'vitest'

import type { SessionRecord, UsageLimit } from '@pipcast/contract'
import type { Scene } from '@pipcast/design'

import { forecastWeek } from '../src/forecast.ts'
import type { Forecast } from '../src/forecast.ts'
import { newestWeekReading } from '../src/limits.ts'
import { skyFor, weatherScene } from '../src/weather.ts'
import type { Outlooked } from '../src/weather.ts'
import { harness, local, posts, RESET, session, steadyWeek, story } from './helpers.ts'
import type { Sample } from './helpers.ts'

const MIN = 60_000

// Fri 13 Nov 2026 at 10:15, local, on a week that is using 1.6 an hour: a storm
const T = local(13, 10, 15)

function stormWorld(start: number, rate = 1.6) {
  const { memory, limit } = steadyWeek(rate, start)
  return { memory, limit, sessions: [session('a', { limits: [limit] })] }
}

// A harness on a storm, with the forecast counted
function onAStorm(start: number, options: { warnedAt?: number | null; visible?: boolean; windowOut?: boolean; rate?: number } = {}) {
  const calls: number[] = []
  const { memory, sessions } = stormWorld(start, options.rate)
  const h = harness(start, sessions, {
    forecastWeek: (history, used, now) => {
      calls.push(now)
      return forecastWeek(history, used, now)
    },
  })
  h.world.weather = { ...memory, warnedAt: options.warnedAt ?? null }
  h.world.visible = options.visible ?? true
  if (options.windowOut !== undefined) {
    h.world.windowOut = options.windowOut
  }
  return { h, calls }
}

// When each STORM WARNING began, from its segment's id
function warnings(history: Sample[]): number[] {
  const started = history.map((sample) => sample.program.key).filter((key) => key.startsWith('warning:')).map((key) => Number(key.split(':')[1]))
  return [...new Set(started)].sort((a, b) => a - b)
}

// The modes a segment's steps drew, in order
function modes(history: Sample[], prefix: string): string[] {
  const seen = new Map<string, string>()
  for (const sample of history) {
    if (sample.program.key.startsWith(prefix) && !seen.has(sample.program.key)) {
      seen.set(sample.program.key, sample.program.scene.mode)
    }
  }
  return [...seen.values()]
}

describe('STORM WARNING', () => {
  it('airs at once on a storm: WEATHER ALERT, STORMTRACKER, the outro, with their sounds', () => {
    const { h } = onAStorm(T)
    h.until(T + 20_000)
    expect(warnings(h.history)).toEqual([T])
    expect(modes(h.history, 'warning:')).toEqual(['alert', 'stormtracker', 'outro'])
    expect(h.cues()).toEqual([
      { now: T, jingle: 'weather-alert' },
      { now: T + 15_000, jingle: 'breaking-out' },
    ])
    expect(h.sounds().map(({ now, sound }) => [now - T, sound.type, 'bed' in sound ? sound.bed : 'jingle' in sound ? sound.jingle : undefined])).toEqual([
      [0, 'cue', 'weather-alert'],
      [2_000, 'bed', 'beat-minor'],
      [15_000, 'cue', 'breaking-out'],
      [15_000, 'bed-out', undefined],
    ])
    // The segment ends 1.9 + 13 + 1.4 s in, on the tick after
    expect(h.history.find((sample) => sample.now === T + 16_000)?.program.key).toMatch(/^warning:.*:2$/)
    expect(h.history.find((sample) => sample.now === T + 16_500)?.program.key).toBe('board')
  })

  it('keeps when it came due, and tells the station', () => {
    const { h } = onAStorm(T)
    h.until(T + 20_000)
    const told = posts(h.history)
    expect(told).toHaveLength(1)
    expect(told[0]?.now).toBe(T)
    expect(told[0]?.memory.warnedAt).toBe(T)
    expect(told[0]?.memory.resetsAt).toBe(RESET)
  })

  it('brings the window out and keeps its place while the window is minimized', () => {
    const { h } = onAStorm(T, { windowOut: false })
    h.until(T + 30_000)
    expect(warnings(h.history)).toEqual([])
    expect(h.history.every((sample) => sample.program.wantsWindow)).toBe(true)
    h.world.windowOut = true
    const sample = h.until(T + 30_250)
    expect(sample.program.key).toMatch(/^warning:/)
    expect(sample.program.sounds).toEqual([{ type: 'cue', jingle: 'weather-alert' }])
  })

  it('airs again an hour after it came due, if the storm is still in the forecast', () => {
    const { h, calls } = onAStorm(T)
    h.until(T + 59 * MIN)
    expect(warnings(h.history)).toEqual([T])
    h.until(T + 61 * MIN)
    expect(warnings(h.history)).toEqual([T, T + 60 * MIN])
    // The hour was up, so the forecast was worked out afresh before it aired
    expect(calls).toContain(T + 60 * MIN)
  })

  it('does not air again if the forecast turns to clouds', () => {
    let calm = false
    const { memory, sessions } = stormWorld(T)
    const h = harness(T, sessions, {
      forecastWeek: (history, used, now) => {
        const forecast = forecastWeek(history, used, now)
        return calm && forecast !== null ? { ...forecast, outlook: 'clouds', runsOutAt: null, chance: 0.2 } : forecast
      },
    })
    h.world.weather = memory
    h.until(T + 20 * MIN)
    calm = true
    h.until(T + 70 * MIN)
    expect(warnings(h.history)).toEqual([T])
  })

  it('goes by the memory the station sent: a warning 30 minutes ago means 30 more minutes without', () => {
    const { h } = onAStorm(T, { warnedAt: T - 30 * MIN })
    h.until(T + 30 * MIN - 250)
    expect(warnings(h.history)).toEqual([])
    h.until(T + 30 * MIN + 5_000)
    expect(warnings(h.history)).toEqual([T + 30 * MIN])
  })

  it('the report on the hour shows STORMTRACKER and leaves the warning’s hour alone; the next warning is at 11:15', () => {
    const { h } = onAStorm(T)
    h.until(local(13, 11, 16))
    expect(warnings(h.history)).toEqual([T, local(13, 11, 15)])
    expect(modes(h.history, `hour:${local(13, 11)}`)).toEqual(['ident', 'desk', 'weather-now', 'weather-days', 'stormtracker', 'outro'])
    expect(posts(h.history).map((post) => post.memory.warnedAt)).toEqual([T, local(13, 11, 15)])
  })

  it('airs at 10:52 and not again before 11:52, the report at 11:00 showing STORMTRACKER too', () => {
    const start = local(13, 10, 52)
    const { h } = onAStorm(start)
    h.until(local(13, 11, 53))
    expect(warnings(h.history)).toEqual([start, local(13, 11, 52)])
    expect(modes(h.history, `hour:${local(13, 11)}`)).toContain('stormtracker')
    expect(posts(h.history).map((post) => post.memory.warnedAt)).toEqual([start, local(13, 11, 52)])
  })
})

describe('STORM WARNING never waits for you to come back', () => {
  it('drops a warning waiting when the window hides, and airs nothing when it shows: the next is an hour on', () => {
    const { h } = onAStorm(T, { windowOut: false })
    h.until(T + 5_000)
    expect(h.history[h.history.length - 1]?.program.wantsWindow).toBe(true)
    h.world.visible = false
    const hid = h.until(T + 5_250)
    expect(hid.program.wantsWindow).toBe(false)
    expect(hid.program.weather?.warnedAt).toBe(T + 5_250)
    h.world.visible = true
    h.world.windowOut = true
    h.until(T + 5_250 + 59 * MIN)
    expect(warnings(h.history)).toEqual([])
    h.until(T + 5_250 + 60 * MIN + 1_000)
    expect(warnings(h.history)).toEqual([T + 5_250 + 60 * MIN])
  })

  it('skips a warning that comes due while the window is hidden, and airs nothing when it shows a minute later', () => {
    const { h } = onAStorm(T, { warnedAt: T - 61 * MIN, visible: false })
    h.until(T + 2_000)
    expect(posts(h.history)).toHaveLength(1)
    expect(posts(h.history)[0]?.memory.warnedAt).toBe(T)
    h.world.visible = true
    h.until(T + 60_000)
    h.until(T + 90_000)
    expect(warnings(h.history)).toEqual([])
  })

  it('cuts a warning on air when the window hides, and does not restart it', () => {
    const { h } = onAStorm(T)
    h.until(T + 5_000)
    expect(h.history[h.history.length - 1]?.program.key).toMatch(/^warning:/)
    h.world.visible = false
    const cut = h.until(T + 5_250)
    expect(cut.program.key).toBe('board')
    expect(cut.program.sounds).toEqual([{ type: 'hush' }])
    h.world.visible = true
    h.until(T + 60_000)
    expect(warnings(h.history)).toEqual([T])
    expect(posts(h.history).map((post) => post.memory.warnedAt)).toEqual([T])
  })
})

describe('the crawl while the week is forecast', () => {
  function board(rate: number, now: number, options: { warnedAt?: number | null; visible?: boolean } = {}) {
    const { h } = onAStorm(now, { rate, ...options })
    return h.until(now + 250).program.scene
  }

  const texts = (scene: Scene) => (scene.ticker ?? []).map((item) => (typeof item === 'string' ? item : `${item.lead ?? ''} ${item.text}`.trim()))

  it('puts a FORECAST line after ON THE DESK, with the sky the week ends under', () => {
    const scene = board(0.9, local(13, 15, 12))
    const items = scene.ticker ?? []
    const desk = items.findIndex((item) => typeof item !== 'string' && item.key === 'desk')
    const forecast = items[desk + 1]
    expect(forecast).toMatchObject({ lead: 'FORECAST', key: 'forecast', sky: 'partly' })
    expect(typeof forecast !== 'string' && forecast?.text).toMatch(/^Clouds gathering: the week ends near \d+%, resets Mon 18:00$/)
    expect(scene.tickerLabel).toBeUndefined()
    expect(items.length).toBeLessThanOrEqual(6)
  })

  it('makes its lines once for a forecast: the same ones are on the crawl at every tick', () => {
    const now = local(13, 15, 12)
    for (const [rate, key] of [
      [0.9, 'forecast'],
      [1.6, 'warning'],
    ] as const) {
      const { h } = onAStorm(now, { rate, warnedAt: now - MIN })
      const line = () => (h.history[h.history.length - 1]?.program.scene.ticker ?? []).find((item) => typeof item !== 'string' && item.key === key)
      h.until(now + 250)
      const first = line()
      expect(first).toBeDefined()
      h.until(now + 5_000)
      expect(line()).toBe(first)
    }
  })

  it('says clear skies under a sun', () => {
    const scene = board(0.6, local(13, 15, 12))
    const forecast = (scene.ticker ?? []).find((item) => typeof item !== 'string' && item.key === 'forecast')
    expect(forecast).toMatchObject({ sky: 'sun' })
    expect(typeof forecast !== 'string' && forecast?.text).toMatch(/^Clear skies: the week ends near \d+%, resets Mon 18:00$/)
  })

  it('leads with the STORM WARNING line, and leaves the tab alone, while a storm holds', () => {
    // Warned a minute ago, so the board is what airs
    const scene = board(1.6, T, { warnedAt: T - MIN })
    expect(texts(scene)[0]).toMatch(/^STORM WARNING in effect until Mon 18:00: at this pace the week runs out (Mon|Sun) around \d\d:00$/)
    expect(scene.tickerLabel).toBeUndefined()
    expect(texts(scene).some((text) => text.startsWith('FORECAST'))).toBe(false)
    expect((scene.ticker ?? []).length).toBeLessThanOrEqual(6)
  })

  it('leaves the tab alone at the desk too', () => {
    const { h } = onAStorm(T, { warnedAt: T - MIN })
    h.until(T + 1_000)
    h.world.sessions = [
      session('a', { limits: [stormWorld(T).limit], state: 'ready', stateAt: T + 2_000, stories: [story('a:1', 'ready', T + 2_000, { added: 4, removed: 1, files: 1 })] }),
    ]
    const desk = h.until(T + 2_000 + 3_000)
    expect(desk.program.scene.mode).toBe('desk')
    expect(desk.program.scene.tickerLabel).toBeUndefined()
  })

  it('says when the outlook starts in the week’s first day', () => {
    const now = RESET - 7 * 24 * 3_600_000 + 20 * 3_600_000
    const limit: UsageLimit = { kind: 'week', percentUsed: 5, resetsAt: RESET, at: now - 1000 }
    const h = harness(now, [session('a', { limits: [limit] })])
    const items = h.until(now + 250).program.scene.ticker ?? []
    const desk = items.findIndex((item) => typeof item !== 'string' && item.key === 'desk')
    expect(items[desk + 1]).toEqual({ lead: 'FORECAST', text: 'The week’s outlook starts Tue 18:00', key: 'forecast' })
  })

  it('has no forecast line before a session has read the week', () => {
    const h = harness(T, [session('a')])
    const items = h.until(T + 250).program.scene.ticker ?? []
    expect(items.some((item) => typeof item !== 'string' && item.key === 'forecast')).toBe(false)
  })
})

describe('a week that is used up', () => {
  function usedUp(start: number) {
    const { memory } = steadyWeek(1.6, start)
    const limit: UsageLimit = { kind: 'week', percentUsed: 100, resetsAt: RESET, at: start }
    const h = harness(start, [session('a', { limits: [limit] })])
    h.world.weather = memory
    return h
  }

  it('airs no STORM WARNING in two hours, and its report on the hour has no weather', () => {
    const h = usedUp(T)
    h.until(T + 2 * 60 * MIN)
    expect(warnings(h.history)).toEqual([])
    expect(h.keys().some((key) => key.startsWith('warning:'))).toBe(false)
    for (const hour of [local(13, 11), local(13, 12)]) {
      expect(modes(h.history, `hour:${hour}`)).toEqual(['ident', 'desk', 'outro'])
    }
    // Nothing was ever skipped or aired, so nothing was kept
    expect(posts(h.history).every((post) => post.memory.warnedAt === null)).toBe(true)
  })

  it('says so on the crawl, with a storm’s sky, and no WARNING tab', () => {
    const h = usedUp(T)
    const scene = h.until(T + 1_000).program.scene
    const items = scene.ticker ?? []
    const desk = items.findIndex((item) => typeof item !== 'string' && item.key === 'desk')
    expect(items[desk + 1]).toEqual({ lead: 'FORECAST', text: 'The week is used up until it resets Mon 18:00', key: 'forecast', sky: 'storm' })
    expect(items.some((item) => typeof item !== 'string' && item.lead === 'STORM WARNING')).toBe(false)
    expect(scene.tickerLabel).toBeUndefined()
  })
})

describe('newestWeekReading', () => {
  const week = (at: number, percentUsed: number, resetsAt: number | null = RESET): UsageLimit => ({ kind: 'week', percentUsed, resetsAt, at })
  const sessionLimit = (at: number): UsageLimit => ({ kind: 'session', percentUsed: 90, resetsAt: RESET, at })
  const hold = (...limits: UsageLimit[]): SessionRecord => session('x', { limits })

  it('takes the week limit with the greatest time among the sessions', () => {
    const reading = newestWeekReading([hold(week(100, 10)), hold(week(300, 30.5), sessionLimit(900)), hold(week(200, 20))], T)
    expect(reading).toEqual({ percent: 30.5, resetsAt: RESET, at: 300 })
  })

  it('takes the highest share, not the newest reading, when none is measured: a window’s share only rises but for a reset in place', () => {
    // A session that tuned in gives its last answer, stamped now, with a lower share
    const reading = newestWeekReading([hold(week(100, 55)), hold(week(900, 41))], T)
    expect(reading).toEqual({ percent: 55, resetsAt: RESET, at: 100 })
    expect(newestWeekReading([hold(week(900, 41)), hold(week(100, 55))], T)).toEqual(reading)
  })

  it('takes the newest measured reading over a higher one that is not measured, though that is stamped later', () => {
    const measured = (at: number, percentUsed: number): UsageLimit => ({ ...week(at, percentUsed), measured: true })
    const reading = newestWeekReading([hold(week(900, 98)), hold(measured(100, 8))], T)
    expect(reading).toEqual({ percent: 8, resetsAt: RESET, at: 100, measured: true })
    expect(newestWeekReading([hold(measured(100, 8)), hold(week(900, 98))], T)).toEqual(reading)
  })

  it('takes the newest of the measured readings, not the highest, and the higher share of equal times', () => {
    const measured = (at: number, percentUsed: number): UsageLimit => ({ ...week(at, percentUsed), measured: true })
    expect(newestWeekReading([hold(measured(100, 98)), hold(measured(200, 8))], T)).toEqual({ percent: 8, resetsAt: RESET, at: 200, measured: true })
    expect(newestWeekReading([hold(measured(200, 8)), hold(measured(200, 9))], T)).toEqual({ percent: 9, resetsAt: RESET, at: 200, measured: true })
  })

  it('leaves the mark out of a reading when none is measured', () => {
    expect(newestWeekReading([hold(week(100, 10)), hold(week(200, 20))], T)).not.toHaveProperty('measured')
  })

  it('takes the later reading of equal shares', () => {
    expect(newestWeekReading([hold(week(100, 50)), hold(week(300, 50)), hold(week(200, 50))], T)).toEqual({ percent: 50, resetsAt: RESET, at: 300 })
  })

  it('reads only the latest reset window: another window’s higher share is not the reading', () => {
    const later = RESET + 7 * 24 * 3_600_000
    // A session still reading last week's window, at a share that is higher than the new week has
    expect(newestWeekReading([hold(week(500, 97, RESET)), hold(week(400, 3, later))], T)).toEqual({ percent: 3, resetsAt: later, at: 400 })
  })

  it('counts reset times within the tolerance as one window', () => {
    const reading = newestWeekReading([hold(week(100, 55, RESET)), hold(week(200, 41, RESET + 9 * MIN))], T)
    expect(reading).toEqual({ percent: 55, resetsAt: RESET, at: 100 })
  })

  it('holds the percent to 0..100', () => {
    expect(newestWeekReading([hold(week(100, 140))], T)?.percent).toBe(100)
    expect(newestWeekReading([hold(week(100, -3))], T)?.percent).toBe(0)
  })

  it('is null with no week limit, no reset time, or a reset that has passed', () => {
    expect(newestWeekReading([], T)).toBeNull()
    expect(newestWeekReading([hold(sessionLimit(100))], T)).toBeNull()
    expect(newestWeekReading([hold(week(100, 10, null))], T)).toBeNull()
    expect(newestWeekReading([hold(week(100, 10, T))], T)).toBeNull()
    expect(newestWeekReading([hold(week(100, 10, T - 1))], T)).toBeNull()
  })

  it('leaves out limits that are not well formed', () => {
    const broken = session('y', { limits: [{ kind: 'week', percentUsed: 'x' } as unknown as UsageLimit] })
    expect(newestWeekReading([broken], T)).toBeNull()
  })
})

describe('weatherScene', () => {
  const storm = (): Outlooked => {
    const { memory, limit } = steadyWeek(1.3, local(13, 15, 12))
    const forecast = forecastWeek(memory as never as { resetsAt: number; points: [number, number][] }, limit.percentUsed, local(13, 15, 12)) as Forecast
    return forecast as Outlooked
  }
  const NOW = local(13, 15, 12)

  it('names the days, the reset day last, and says which are out', () => {
    const scene = weatherScene(storm(), NOW)
    expect(scene.outlook).toBe('storm')
    expect(scene.sky).toBe('storm')
    expect(scene.word).toBe('STORM WARNING')
    expect(scene.used).toBe('59%')
    expect(scene.until).toBe('TO MON 18:00')
    expect(scene.days.map((day) => day.name)).toEqual(['FRI', 'SAT', 'SUN', 'MON'])
    const monday = scene.days[3]
    expect(monday).toMatchObject({ high: 'OUT', out: true, sky: 'storm' })
    expect(scene.days[0]?.low).toBe('59%')
    scene.days.forEach((day, i) => {
      expect(day.high === 'OUT' || /^\d+%$/.test(day.high)).toBe(true)
      if (i > 0) {
        expect(day.low).toBe(scene.days[i - 1]?.high === 'OUT' ? '—' : scene.days[i - 1]?.high)
      }
    })
  })

  it('says when the week runs out, to the hour, and marks the last two closes before it', () => {
    const forecast = storm()
    const scene = weatherScene(forecast, NOW)
    const runsOut = forecast.runsOutAt as number
    expect(scene.strap).toMatch(/^The week runs out (Sun|Mon) around \d\d:00$/)
    expect(scene.track?.out).toMatch(/^(SUN|MON) \d\d:00$/)
    const marks = scene.track?.marks ?? []
    expect(marks.length).toBeGreaterThan(0)
    expect(marks.length).toBeLessThanOrEqual(2)
    const closes = forecast.days.map((day) => day.closesAt).filter((close) => close > NOW && close < runsOut)
    expect(marks.map((mark) => mark.when)).toEqual(closes.slice(-2).map((close) => `${['SUN', 'MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT'][new Date(close).getDay()]} 00:00`))
    marks.forEach((mark, i) => {
      expect(mark.at).toBeGreaterThan(0)
      expect(mark.at).toBeLessThan(1)
      if (i > 0) {
        expect(mark.at).toBeGreaterThan(marks[i - 1]?.at as number)
      }
      expect(mark.share).toMatch(/^\d+%$/)
    })
  })

  it('has no track without a storm, and ends below 100', () => {
    const { memory, limit } = steadyWeek(0.9, NOW)
    const forecast = forecastWeek(memory as never as { resetsAt: number; points: [number, number][] }, limit.percentUsed, NOW) as Outlooked
    const scene = weatherScene(forecast, NOW)
    expect(scene.outlook).toBe('clouds')
    expect(scene.track).toBeUndefined()
    expect(scene.sky).toBe('partly')
    expect(scene.word).toBe('CLOUDS GATHERING')
    expect(scene.strap).toMatch(/^The week ends near (7\d|8\d|9\d)%$/)
    expect(scene.days.some((day) => day.out === true)).toBe(false)
  })

  it('never reads 100% for a week that has not run out', () => {
    const forecast = { ...storm(), used: 99.6 }
    expect(weatherScene(forecast, NOW).used).toBe('99%')
    expect(weatherScene({ ...forecast, used: 48.4 }, NOW).used).toBe('48%')
  })

  it('chooses a sky for a share', () => {
    expect([0, 69.9, 70, 89.9, 90, 99.9, 100, 130].map(skyFor)).toEqual(['sun', 'sun', 'partly', 'partly', 'overcast', 'overcast', 'storm', 'storm'])
  })
})
