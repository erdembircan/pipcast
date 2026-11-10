// KLWD WEATHER's desk: the readings the forecast goes by, the forecast itself,
// and when STORM WARNING comes due; and what the weather pages and the warning
// draw. The director makes one desk and asks it once a tick.

import { aroundTime, clock, dayName, dayTime, hourStart, OUTLOOK_WORDS, parseWeather, untilTab, WEATHER, weatherStrap } from '@pipcast/contract'
import type { Snapshot, WeatherMemory } from '@pipcast/contract'
import type { Scene, Sky, TrackMark, WeatherScene } from '@pipcast/design'

import { forecastWeek, recordReading, RESET_TOLERANCE_MS } from './forecast.ts'
import type { Forecast, WeekHistory, WeekReading } from './forecast.ts'
import { newestWeekReading } from './limits.ts'
import type { Segment } from './story.ts'
import { ALERT_MS, ALERT_OUTRO_MS, FORECAST_EVERY_MS, REDUCED_OPENER_MS, STORMTRACKER_MS, WARNING_EVERY_MS } from './timing.ts'
import type { Step } from './types.ts'

export interface WeatherDeskOptions {
  // Tests count how often the forecast runs; the release passes nothing
  forecastWeek?: (history: WeekHistory, used: number, now: number) => Forecast | null
}

export interface WeatherDesk {
  // Once a tick with a snapshot: takes the memory on the first, keeps the
  // newest reading of the week, and works the forecast out when it can have
  // changed. Every other tick reads the forecast it has.
  tick(snapshot: Snapshot, now: number): void
  // The forecast as it stands
  forecast(): Forecast | null
  // Works the forecast out afresh from the newest reading, as a report on the
  // hour starts
  refresh(now: number): Forecast | null
  // Whether STORM WARNING comes due now: the forecast says storm, none is
  // queued or on air (`busy`), and its hour since it last came due is up. When
  // the hour is up the forecast is worked out afresh first, so a warning airs
  // again only if it is still relevant.
  due(now: number, busy: boolean): boolean
  // STORM WARNING came due at `now`: it started to air, or was skipped
  markDue(now: number): void
  // The memory to post to the station, once, when it has changed
  memory(): WeatherMemory | null
}

export function createWeatherDesk(options: WeatherDeskOptions = {}): WeatherDesk {
  const forecastFn = options.forecastWeek ?? forecastWeek

  let loaded = false
  let history: WeekHistory | null = null
  let warnedAt: number | null = null
  let dirty = false

  let reading: WeekReading | null = null
  let cached: Forecast | null = null
  let computedAt = 0
  // The `at` of the newest reading the forecast includes; null when none has been tried
  let computedReadingAt: number | null = null

  function compute(now: number): void {
    if (reading === null || history === null) {
      cached = null
      computedReadingAt = null
      return
    }
    cached = forecastFn(history, reading.percent, now)
    computedAt = now
    computedReadingAt = reading.at
  }

  function stormy(): boolean {
    return cached !== null && cached.outlook === 'storm'
  }

  function keep(next: WeekHistory | null): void {
    if (next === history) {
      return
    }
    const before = history
    history = next
    if (next === null || before === null) {
      dirty = true
      return
    }
    // A reading in the quarter hour's slot replaces the last point and is
    // written with the next one appended, so the disk takes at most a write a
    // quarter hour. A new week, or a share that fell, is written at once.
    const last = next.points[next.points.length - 1]
    const was = before.points[before.points.length - 1]
    if (next.points.length !== before.points.length || next.resetsAt !== before.resetsAt || (last !== undefined && was !== undefined && last[1] < was[1])) {
      dirty = true
    }
  }

  function tick(snapshot: Snapshot, now: number): void {
    if (!loaded) {
      loaded = true
      // The station sends whatever its file holds
      const memory = parseWeather(snapshot.weather)
      if (memory !== null) {
        history = memory.resetsAt === null ? null : { resetsAt: memory.resetsAt, points: memory.points }
        warnedAt = memory.warnedAt
      }
    }
    reading = newestWeekReading(snapshot.sessions, now)
    if (reading === null) {
      cached = null
      computedReadingAt = null
      return
    }
    keep(recordReading(history, reading))
    if (history === null) {
      cached = null
      return
    }
    const held = cached
    if (computedReadingAt === null) {
      // The first time, or the first reading after there was none
      compute(now)
    } else if (held !== null && Math.abs(held.resetsAt - reading.resetsAt) > RESET_TOLERANCE_MS) {
      // A new week
      compute(now)
    } else if (reading.at > computedReadingAt && (held === null || now - computedAt >= FORECAST_EVERY_MS || reading.percent - held.used >= 1)) {
      compute(now)
    } else if (held !== null && held.outlook === 'early' && held.startsAt !== null && now >= held.startsAt) {
      // The week's first day is over
      compute(now)
    } else if (held !== null && now >= held.resetsAt) {
      // The week has reset: no forecast until the new week's first reading
      cached = null
    }
  }

  return {
    tick,
    forecast: () => cached,
    refresh(now) {
      compute(now)
      return cached
    },
    due(now, busy) {
      if (busy || (warnedAt !== null && now - warnedAt < WARNING_EVERY_MS) || !stormy()) {
        return false
      }
      if (warnedAt !== null && cached !== null && cached.computedAt < warnedAt + WARNING_EVERY_MS) {
        compute(now)
        return stormy()
      }
      return true
    },
    markDue(now) {
      warnedAt = now
      dirty = true
    },
    memory() {
      if (!dirty) {
        return null
      }
      dirty = false
      return { v: 1, resetsAt: history?.resetsAt ?? null, points: history?.points ?? [], warnedAt }
    },
  }
}

// The sky a day's high reaches: sun below 70%, partly cloudy to 89%, overcast
// to 99%, storms at 100%
export function skyFor(share: number): Sky {
  if (share >= 100) {
    return 'storm'
  }
  if (share >= 90) {
    return 'overcast'
  }
  return share >= 70 ? 'partly' : 'sun'
}

// A forecast with an outlook to show: not the week's first day, and not a week
// that is used up
export type Outlooked = Forecast & { outlook: 'clear' | 'clouds' | 'storm' }

export function hasOutlook(forecast: Forecast | null): forecast is Outlooked {
  return forecast !== null && forecast.outlook !== 'early' && forecast.outlook !== 'out'
}

// A figure for a share that has not run out: a whole percent, never 100
function share(value: number): string {
  return `${Math.min(99, Math.round(value))}%`
}

// The pages' forecast, worked out as a segment starts and held through it.
// `now` is when the segment starts: the storm's marks sit at how far along
// its track each day's close is from there.
export function weatherScene(forecast: Outlooked, now: number): WeatherScene {
  const { outlook, end, runsOutAt } = forecast
  const runsOut = runsOutAt === null ? '' : aroundTime(runsOutAt)
  const scene: WeatherScene = {
    outlook,
    used: share(forecast.used),
    sky: outlook === 'storm' ? 'storm' : skyFor(end),
    word: OUTLOOK_WORDS[outlook],
    strap: weatherStrap(outlook, Math.min(99, Math.round(end)), runsOut),
    until: untilTab(dayTime(forecast.resetsAt)),
    days: forecast.days.map((day) => {
      const out = day.high >= 100
      return {
        // The day that closes, which for the reset's own day is the day before the reset
        name: dayName(day.closesAt - 1),
        sky: skyFor(day.high),
        high: out ? WEATHER.out : share(day.high),
        low: day.low >= 100 ? WEATHER.none : share(day.low),
        ...(out ? { out } : {}),
      }
    }),
  }
  if (outlook === 'storm' && runsOutAt !== null) {
    const marks: TrackMark[] = forecast.days
      .filter((day) => day.closesAt > now && day.closesAt < runsOutAt)
      .slice(-2)
      .map((day) => ({
        when: dayTime(day.closesAt).toUpperCase(),
        share: share(day.high),
        at: (day.closesAt - now) / (runsOutAt - now),
      }))
    // Rounded to the hour as the strap is
    scene.track = { marks, out: dayTime(hourStart(runsOutAt + 30 * 60_000)).toUpperCase() }
  }
  return scene
}

// STORM WARNING: WEATHER ALERT, STORMTRACKER, the outro. The beat in D minor
// plays under the tracker as it does under a story's desk.
export function warningSegment(forecast: Outlooked, now: number, reducedMotion: boolean): Segment {
  const weather = weatherScene(forecast, now)
  const opener: Step = {
    role: 'opener',
    length: reducedMotion ? REDUCED_OPENER_MS : ALERT_MS,
    cue: 'weather-alert',
    scene: ({ now: at }): Scene => ({ mode: 'alert', clock: clock(at), progress: 1 }),
  }
  const tracker: Step = {
    role: 'weather',
    length: STORMTRACKER_MS,
    bed: 'beat-minor',
    scene: ({ now: at, ticker }): Scene => ({ mode: 'stormtracker', clock: clock(at), ticker, weather }),
  }
  const outro: Step = {
    role: 'outro',
    length: ALERT_OUTRO_MS,
    cue: 'breaking-out',
    scene: ({ now: at, board }): Scene => ({ mode: 'outro', open: 'alert', clock: clock(at), progress: 1, board }),
  }
  const id = `warning:${now}`
  if (reducedMotion) {
    return { id, steps: [opener, tracker], endCue: 'breaking-out' }
  }
  return { id, steps: [opener, tracker, outro] }
}
