// KLWD WEATHER's desk: the readings the forecast goes by, the forecast itself,
// and when STORM WARNING comes due; and what the weather pages and the warning
// draw. The director makes one desk and asks it once a tick.

import { aroundTime, clock, dayName, dayTime, hourStart, OUTLOOK_WORDS, parseWeather, untilTab, WEATHER, weatherStrap } from '@pipcast/contract'
import type { SessionRecord, Snapshot, WeatherMemory } from '@pipcast/contract'
import type { Scene, Sky, TrackMark, WeatherScene } from '@pipcast/design'

import { classifyReading, forecastWeek, hourlyPoints, MAX_POINTS, recordReading, RESET_TOLERANCE_MS } from './forecast.ts'
import type { Forecast, WeekHistory, WeekReading } from './forecast.ts'
import { newestWeekReading } from './limits.ts'
import type { Segment } from './story.ts'
import { ALERT_MS, ALERT_OUTRO_MS, REDUCED_OPENER_MS, STORMTRACKER_MS, WARNING_EVERY_MS } from './timing.ts'
import type { Step } from './types.ts'

export interface WeatherDeskOptions {
  // Tests count how often the forecast runs; the release passes nothing
  forecastWeek?: (history: WeekHistory, used: number, now: number) => Forecast | null
  // Tests count how often the sessions are looked through for the week's reading
  weekReading?: (sessions: readonly SessionRecord[], now: number) => WeekReading | null
  // The memory the desk is handed on its making: null when there is none. Left
  // out, the desk is handed one by the first snapshot that carries it, and
  // until then takes no readings and posts nothing
  memory?: WeatherMemory | null
}

export interface WeatherDesk {
  // Once a tick with a snapshot. The desk looks through the sessions for the
  // week's newest reading only when the snapshot's `limits` differ from the
  // last it looked at (a snapshot with none says nothing, so they are looked
  // through), and does nothing with a reading that is no newer than the last it
  // took. The forecast is worked out only when something has
  // happened (see `scan`); the other moments, the first day ending and the
  // reset passing, are read off the clock.
  tick(snapshot: Snapshot, now: number): void
  // The forecast as it stands
  forecast(): Forecast | null
  // Works the forecast out afresh from the newest reading, as a report on the
  // hour starts
  refresh(now: number): Forecast | null
  // Whether STORM WARNING comes due now: the forecast says storm, the week has
  // not reset, none is queued or on air (`busy`), and its hour since it last
  // came due is up. When the hour is up the forecast is worked out afresh
  // first, once, so a warning airs again only if it is still relevant.
  due(now: number, busy: boolean): boolean
  // STORM WARNING came due at `now`: it started to air, or was skipped
  markDue(now: number): void
  // The memory to post to the station, when it has changed in a way worth
  // keeping (see `behind`); null otherwise
  memory(): WeatherMemory | null
}

// What the desk last gave the station, which what it posts next is measured by
interface Posted {
  // The local hour the last point is in
  hour: number | null
  resetsAt: number | null
  // The share of the last point
  last: number | null
  warnedAt: number | null
}

export function createWeatherDesk(options: WeatherDeskOptions = {}): WeatherDesk {
  const forecastFn = options.forecastWeek ?? forecastWeek
  const readingFn = options.weekReading ?? newestWeekReading

  let loaded = false
  let history: WeekHistory | null = null
  let warnedAt: number | null = null
  let posted: Posted = { hour: null, resetsAt: null, last: null, warnedAt: null }

  // The `limits` of the last snapshot the sessions were looked through for; null before the first
  let scanned: number | undefined | null = null
  // The newest reading the desk has taken, and the forecast it holds
  let reading: WeekReading | null = null
  let cached: Forecast | null = null
  // Whether the history or STORM WARNING's time has changed since `memory` last
  // compared them with what the station holds: it looks no further than this flag
  // on a tick that changed neither
  let changed = false

  function stand(): Posted {
    const last = history === null ? undefined : history.points[history.points.length - 1]
    return {
      hour: last === undefined ? null : hourStart(last[0]),
      resetsAt: history === null ? null : history.resetsAt,
      last: last === undefined ? null : last[1],
      warnedAt,
    }
  }

  // Takes the memory the station has: thinned to the hours, the one place that
  // thins, so a week kept at finer times still reads
  function load(memory: WeatherMemory | null): void {
    loaded = true
    if (memory !== null) {
      history = memory.resetsAt === null ? null : { resetsAt: memory.resetsAt, points: hourlyPoints(memory.points).slice(-MAX_POINTS) }
      warnedAt = memory.warnedAt
    }
    posted = stand()
  }
  if (options.memory !== undefined) {
    load(options.memory)
  }

  function compute(now: number): void {
    // Nothing to work out for a week that has reset
    if (reading === null || history === null || now >= history.resetsAt) {
      cached = null
      return
    }
    // Never from a share lower than the week's last
    const lastPoint = history.points[history.points.length - 1]
    cached = forecastFn(history, lastPoint === undefined ? reading.percent : Math.max(reading.percent, lastPoint[1]), now)
  }

  function stormy(): boolean {
    return cached !== null && cached.outlook === 'storm'
  }

  // The moments that come by the clock alone, read where the director reads it
  // anyway: the reset passing clears the forecast without working anything out,
  // and the week's first day ending works an early forecast out once
  function clock(now: number): void {
    if (cached === null) {
      return
    }
    if (now >= cached.resetsAt) {
      cached = null
    } else if (cached.outlook === 'early' && cached.startsAt !== null && now >= cached.startsAt) {
      compute(now)
    }
  }

  // Looks at the week's reading. Nothing happens unless it is newer than the
  // last, or of another week. The forecast is worked out then only for the first
  // reading the desk takes, a new week (the reset moved), a reset in place, a
  // desk that holds no forecast (its first reading was out of its window, say),
  // or a share a whole point or more above the one the forecast holds.
  function scan(found: WeekReading | null, now: number): void {
    if (found === null) {
      reading = null
      cached = null
      return
    }
    const first = reading === null
    const moved = reading !== null && Math.abs(found.resetsAt - reading.resetsAt) > RESET_TOLERANCE_MS
    if (reading !== null && !moved && found.at <= reading.at) {
      return
    }
    // A share lower than the week's last, in the same window, is a stale reading
    // (a session tuning in gives its last answer, which may be hours old) and
    // changes nothing, unless it is measured and RESET_FALL lower: then it is a
    // reset in place, and the week goes on from it. After a reset in place, a
    // reading not measured may be an answer from before it, and is stale too.
    // When a stale reading is the first the desk sees, the week as it stands is
    // what it forecasts from.
    const kind = classifyReading(history, found)
    if (kind === 'stale') {
      const lastPoint = history === null ? undefined : history.points[history.points.length - 1]
      if (history !== null && lastPoint !== undefined && reading === null) {
        reading = { percent: lastPoint[1], resetsAt: history.resetsAt, at: lastPoint[0] }
        compute(now)
      }
      return
    }
    reading = found
    const before = history
    history = recordReading(history, found)
    if (history !== before) {
      changed = true
    }
    if (history === null) {
      cached = null
      return
    }
    if (first || moved || kind === 'reset' || cached === null || found.percent - cached.used >= 1) {
      compute(now)
    }
  }

  // Whether what the station holds is behind what the desk has, by anything it
  // is worth a write to keep: a new hour's point, the hour's point a whole point
  // higher since the last post (the station quits seconds after the last
  // session, and would otherwise keep each hour's first reading) or lower, a
  // reset in place, another week, or STORM WARNING's time
  function behind(): boolean {
    const now = stand()
    if (now.hour !== posted.hour || now.resetsAt !== posted.resetsAt || now.warnedAt !== posted.warnedAt) {
      return true
    }
    return now.last !== null && posted.last !== null && (now.last - posted.last >= 1 || now.last < posted.last)
  }

  return {
    tick(snapshot, now) {
      if (!loaded) {
        if (snapshot.weather === undefined) {
          return
        }
        // The station sends whatever its file holds
        load(parseWeather(snapshot.weather))
      }
      clock(now)
      if (snapshot.limits !== undefined && snapshot.limits === scanned) {
        return
      }
      scanned = snapshot.limits
      scan(readingFn(snapshot.sessions, now), now)
    },
    forecast: () => cached,
    refresh(now) {
      compute(now)
      return cached
    },
    due(now, busy) {
      if (busy || (warnedAt !== null && now - warnedAt < WARNING_EVERY_MS) || cached === null || cached.resetsAt <= now || !stormy()) {
        return false
      }
      if (warnedAt !== null && cached.computedAt < warnedAt + WARNING_EVERY_MS) {
        compute(now)
        return stormy()
      }
      return true
    },
    markDue(now) {
      warnedAt = now
      changed = true
    },
    memory() {
      if (!loaded || !changed) {
        return null
      }
      changed = false
      if (!behind()) {
        return null
      }
      posted = stand()
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
