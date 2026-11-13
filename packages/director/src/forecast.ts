// The weekly forecast: will the week's usage limit last until it resets?
//
// The week's limit is a share used, in percent, that only rises, but for a reset
// in place (RESET_FALL). A session reads it when it replies, so the readings
// come at irregular times, and the hours between two of them are unobserved,
// not idle. Everything here is a pure function of the readings and of the time
// it is given: nothing reads the clock. Times are ms since the epoch, and
// "local" is the Mac's time zone.
//
// The model rebuilds the week so far as one figure for each hour, estimates how
// much each hour of the day uses (recent days counting most, each hour drawn
// toward the day's average while there are few days to go by), plays that
// forward to the reset, and gives the use still to come a Gamma distribution
// from the spread of the days. docs/architecture.md, The weekly forecast, tells
// it in words.

import { hourStart } from '@pipcast/contract'

import { HOUR_MS } from './timing.ts'

export const WEEK_MS = 7 * 24 * HOUR_MS
const DAY_MS = 24 * HOUR_MS
// A gap between readings longer than this is spread by the day's profile
export const SHORT_GAP_MS = 2 * HOUR_MS
// Recency weighting of the hourly series
export const HALF_LIFE_MS = 72 * HOUR_MS
// Pseudo-hours of the overall rate in each hour of the day
export const PROFILE_PRIOR_HOURS = 1
// The day-to-day spread assumed before enough days are seen, and how many days
// that assumption counts as
export const PRIOR_CV = 0.6
export const PRIOR_WEIGHT = 2
// No forecast in the week's first day
export const MIN_ELAPSED_MS = 24 * HOUR_MS
// The first pass needs this many hours of short-gap coverage
export const MIN_SHORT_HOURS = 6
// Also WEATHER_MAX_POINTS in the contract and `Constants.weatherMaxPoints` in
// the station. A week's window is 7 × 24 = 168 hours, 169 slots when both of
// its end hours hold a point; 200 leaves room. At the autumn change of
// daylight-saving time two real hours share one slot, so that week holds one
// point fewer; at the spring change the missing hour has no slot at all.
export const MAX_POINTS = 200
// Two reset times this close are the same window
export const RESET_TOLERANCE_MS = 10 * 60_000
// A measured share at least this much lower than the week's last is a reset in
// place: Anthropic reset the week's usage and kept its reset time
export const RESET_FALL = 5
// The chance of running out from which the outlook is a storm
export const STORM_CHANCE = 0.5
// The end of the week from which the outlook is clouds
export const CLOUDS_END = 70

export interface WeekHistory {
  // When the week's window resets, ms
  resetsAt: number
  // [when (ms), percent used 0 to 100], oldest first, at most one per hour: the
  // hour's last reading, at its own time
  points: [number, number][]
}

export interface WeekReading {
  // 0..100, as the engine reports it (one decimal), not rounded
  percent: number
  resetsAt: number
  // When the session read it
  at: number
  // Read from Claude Code's report after a reply, so its share is as new as the
  // reply; left out for one a session gave as it tuned in, which may be hours old
  measured?: true
}

// `out`: the week is already used up, so there is nothing left to forecast
export type Outlook = 'early' | 'clear' | 'clouds' | 'storm' | 'out'

export interface DayForecast {
  // When the day closes: a local midnight, or the reset for the reset's own day
  closesAt: number
  // The central path's value at the day's start (now, for the first day) and
  // close, percent (may exceed 100)
  low: number
  high: number
}

export interface Forecast {
  computedAt: number
  resetsAt: number
  outlook: Outlook
  // Early only: when the outlook starts (the window's start + MIN_ELAPSED_MS)
  startsAt: number | null
  // Percent used now
  used: number
  // The central path's value at the reset (the Gamma median of the end); equals
  // `used` for early and out
  end: number
  // The chance that the share reaches 100 before the reset; 0 for early, 1 for out
  chance: number
  // The first time the central path reaches 100; null unless the outlook is storm
  runsOutAt: number | null
  // From today to the reset's day, at most 7; empty for early and out
  days: DayForecast[]
}

function clamp(value: number, low: number, high: number): number {
  return Math.min(high, Math.max(low, value))
}

// array[index], 0 past either end
function at(array: readonly number[], index: number): number {
  return array[index] ?? 0
}

// What a reading is to a week's history: `take`, a point of the week; `reset`,
// a measured fall of RESET_FALL or more, the week's usage reset in place, which
// is taken as a point too; `stale`, a reading no newer than the week's last
// point, a session's older answer, or after a reset in place any reading not
// measured, which says nothing
export type ReadingKind = 'take' | 'reset' | 'stale'

// Whether the points hold a reset in place: a point lower than the one before it
function hasReset(points: readonly (readonly [number, number])[]): boolean {
  return points.some((point, i) => i > 0 && point[1] < (points[i - 1] as readonly [number, number])[1])
}

export function classifyReading(history: WeekHistory | null, reading: WeekReading): ReadingKind {
  if (history === null || Math.abs(reading.resetsAt - history.resetsAt) > RESET_TOLERANCE_MS) {
    return 'take'
  }
  const last = history.points[history.points.length - 1]
  if (last === undefined) {
    return 'take'
  }
  // A reading no newer than the week's last point says nothing new: a session
  // that replied before a reset in place still holds that reply's share
  if (reading.at <= last[0]) {
    return 'stale'
  }
  const percent = clamp(reading.percent, 0, 100)
  if (percent < last[1]) {
    return reading.measured === true && last[1] - percent >= RESET_FALL ? 'reset' : 'stale'
  }
  // After a reset in place, a reading not measured may be a session's answer
  // from before it, as one gives when it tunes in: only measured readings, taken
  // after replies, move the week from there
  if (reading.measured !== true && hasReset(history.points)) {
    return 'stale'
  }
  return 'take'
}

// Keeps a reading in the week's history. Returns a new history when something
// changed and the same one (null, given null) when nothing did, so the caller
// can tell by identity.
export function recordReading(history: WeekHistory | null, reading: WeekReading): WeekHistory | null {
  // A reading outside its own window is not one of this week's
  if (reading.at < reading.resetsAt - WEEK_MS || reading.at > reading.resetsAt) {
    return history
  }
  const percent = clamp(reading.percent, 0, 100)
  const last = history === null ? undefined : history.points[history.points.length - 1]
  // A new window: the reset moved. Only that starts the points over.
  if (history === null || Math.abs(reading.resetsAt - history.resetsAt) > RESET_TOLERANCE_MS) {
    return { resetsAt: reading.resetsAt, points: [[reading.at, percent]] }
  }
  let points = history.points
  if (last !== undefined) {
    if (reading.at <= last[0]) {
      return history
    }
    // A lower share is a stale reading (a session's older answer, or a share that
    // jitters by a point) and says nothing, unless it is a reset in place
    const kind = classifyReading(history, reading)
    if (kind === 'stale') {
      return history
    }
    // One point an hour, in the hours the model bins by: a reading in the same
    // hour replaces the last point, but for a reset in place, which keeps the
    // point before it
    if (kind !== 'reset' && hourStart(reading.at) === hourStart(last[0])) {
      points = points.slice(0, -1)
    }
  }
  points = [...points, [reading.at, percent]]
  return { resetsAt: history.resetsAt, points: points.slice(-MAX_POINTS) }
}

// A week's points as the hours hold them: the last point of each local hour.
// The desk thins a memory it is handed with this, which is how it still reads
// a week kept at finer times. A fall, a reset in place, keeps the point before
// it in the same hour.
export function hourlyPoints(points: readonly (readonly [number, number])[]): [number, number][] {
  const out: [number, number][] = []
  for (const [at, percent] of points) {
    const last = out[out.length - 1]
    if (last !== undefined && hourStart(last[0]) === hourStart(at) && percent >= last[1]) {
      out[out.length - 1] = [at, percent]
    } else {
      out.push([at, percent])
    }
  }
  return out
}

// ln Γ(z), by the Lanczos approximation
function lnGamma(z: number): number {
  const c = [
    0.99999999999980993, 676.5203681218851, -1259.1392167224028, 771.32342877765313, -176.61502916214059, 12.507343278686905,
    -0.13857109526572012, 9.9843695780195716e-6, 1.5056327351493116e-7,
  ]
  if (z < 0.5) {
    return Math.log(Math.PI / Math.sin(Math.PI * z)) - lnGamma(1 - z)
  }
  const x0 = z - 1
  let sum = at(c, 0)
  for (let i = 1; i < 9; i += 1) {
    sum += at(c, i) / (x0 + i)
  }
  const t = x0 + 7.5
  return 0.5 * Math.log(2 * Math.PI) + (x0 + 0.5) * Math.log(t) - t + Math.log(sum)
}

// The regularized lower incomplete gamma function P(a, x): a series for x below
// a + 1, a continued fraction above
export function gammaP(a: number, x: number): number {
  if (x <= 0) {
    return 0
  }
  if (x < a + 1) {
    let sum = 1 / a
    let term = sum
    let ap = a
    for (let n = 0; n < 500; n += 1) {
      ap += 1
      term *= x / ap
      sum += term
      if (Math.abs(term) < Math.abs(sum) * 1e-12) {
        break
      }
    }
    return sum * Math.exp(-x + a * Math.log(x) - lnGamma(a))
  }
  let b = x + 1 - a
  let c = 1 / 1e-300
  let d = 1 / b
  let h = d
  for (let i = 1; i < 500; i += 1) {
    const an = -i * (i - a)
    b += 2
    d = an * d + b
    if (Math.abs(d) < 1e-300) {
      d = 1e-300
    }
    c = b + an / c
    if (Math.abs(c) < 1e-300) {
      c = 1e-300
    }
    d = 1 / d
    const delta = d * c
    h *= delta
    if (Math.abs(delta - 1) < 1e-12) {
      break
    }
  }
  return 1 - Math.exp(-x + a * Math.log(x) - lnGamma(a)) * h
}

// The median of a Gamma distribution with this shape and scale: the value y
// with P(shape, y / scale) = 0.5, by 60 bisection steps
export function gammaMedian(shape: number, scale: number): number {
  const mean = shape * scale
  let low = 0
  let high = mean + 12 * Math.sqrt(shape) * scale
  for (let step = 0; step < 60; step += 1) {
    const middle = (low + high) / 2
    if (gammaP(shape, middle / scale) < 0.5) {
      low = middle
    } else {
      high = middle
    }
  }
  return (low + high) / 2
}

// Every local midnight strictly after `now` and strictly before the reset,
// then the reset itself, at most 7
function closesBetween(now: number, resetsAt: number): number[] {
  const closes: number[] = []
  for (let date = new Date(now); ; ) {
    date = new Date(date.getFullYear(), date.getMonth(), date.getDate() + 1)
    if (date.getTime() >= resetsAt) {
      break
    }
    closes.push(date.getTime())
  }
  closes.push(resetsAt)
  return closes.slice(0, 7)
}

// The share used by hour of the day, as percent per hour, from hourly use `x`
// over hours with exposure `e` (hours observed). `weighted` counts recent hours
// more. The overall rate stands in for hours of the day seen too little, and
// each rate is smoothed with its two neighbours round the clock.
function profile(x: readonly number[], e: readonly number[], hods: readonly number[], binStarts: readonly number[], now: number, weighted: boolean): number[] {
  const sums = new Array<number>(24).fill(0)
  const exposures = new Array<number>(24).fill(0)
  let total = 0
  let observed = 0
  for (let j = 0; j < x.length; j += 1) {
    const exposure = at(e, j)
    if (!(exposure > 0)) {
      continue
    }
    const k = at(hods, j)
    const weight = weighted ? Math.pow(0.5, (now - (at(binStarts, j) + HOUR_MS / 2)) / HALF_LIFE_MS) : 1
    sums[k] = at(sums, k) + weight * at(x, j)
    exposures[k] = at(exposures, k) + weight * exposure
    total += weight * at(x, j)
    observed += weight * exposure
  }
  const overall = observed > 0 ? total / observed : 0
  const rates = sums.map((sum, k) => (sum + PROFILE_PRIOR_HOURS * overall) / (at(exposures, k) + PROFILE_PRIOR_HOURS))
  return rates.map((rate, k) => 0.25 * at(rates, (k + 23) % 24) + 0.5 * rate + 0.25 * at(rates, (k + 1) % 24))
}

// What the forecast says of a week, from its history, the share used now and
// the time now. Null once the week has reset.
export function forecastWeek(history: WeekHistory, usedNow: number, now: number): Forecast | null {
  const reset = history.resetsAt
  const start = reset - WEEK_MS
  if (now >= reset) {
    return null
  }
  const used = clamp(usedNow, 0, 100)
  const base = { computedAt: now, resetsAt: reset, used }

  // A week already used up has run out, in its first day as in any other: a
  // storm that has hit is no warning
  if (used >= 100) {
    return { ...base, outlook: 'out', startsAt: null, end: used, chance: 1, runsOutAt: null, days: [] }
  }

  // 0. The week's first day is too early to say
  if (now - start < MIN_ELAPSED_MS) {
    return { ...base, outlook: 'early', startsAt: start + MIN_ELAPSED_MS, end: used, chance: 0, runsOutAt: null, days: [] }
  }
  const closes = closesBetween(now, reset)

  // 1. The readings of this week up to now. Nothing after the last is data.
  const points = history.points.filter(([when]) => when >= start && when <= now)
  const lastAt = points.length > 0 ? (points[points.length - 1] as [number, number])[0] : now

  // 2. Hour bins from the hour the window opened in, each with the hour of the
  // clock it falls in and how much of it was observed
  const origin = hourStart(start)
  const bins = Math.max(0, Math.ceil((lastAt - origin) / HOUR_MS))
  const binStarts: number[] = []
  const hods: number[] = []
  const exposure: number[] = []
  for (let j = 0; j < bins; j += 1) {
    const binStart = origin + j * HOUR_MS
    binStarts.push(binStart)
    hods.push(new Date(binStart).getHours())
    exposure.push(Math.max(0, (Math.min(lastAt, binStart + HOUR_MS) - Math.max(start, binStart)) / HOUR_MS))
  }

  // 3 and 4. The use between two readings, spread over the hours between them
  // by weight (overlap hours times the weight of the hour of the day), or by
  // overlap alone where the weights are all zero
  function spread(into: number[], from: number, to: number, amount: number, weightOf: (hod: number) => number): void {
    if (amount <= 0 || to <= from) {
      return
    }
    const first = Math.floor((from - origin) / HOUR_MS)
    const last = Math.ceil((to - origin) / HOUR_MS) - 1
    const parts: [number, number][] = []
    let total = 0
    for (let j = first; j <= last; j += 1) {
      const overlap = (Math.min(to, at(binStarts, j) + HOUR_MS) - Math.max(from, at(binStarts, j))) / HOUR_MS
      if (overlap > 0) {
        const weight = overlap * weightOf(at(hods, j))
        parts.push([j, weight])
        total += weight
      }
    }
    if (total <= 0) {
      total = 0
      for (const part of parts) {
        const j = part[0]
        part[1] = (Math.min(to, at(binStarts, j) + HOUR_MS) - Math.max(from, at(binStarts, j))) / HOUR_MS
        total += part[1]
      }
    }
    for (const [j, weight] of parts) {
      into[j] = at(into, j) + (amount * weight) / total
    }
  }
  const intervals: [number, number, number][] = []
  let previous: [number, number] = [start, 0]
  for (const point of points) {
    // A fall is a reset in place: the share started again from 0, so the use
    // across it is at least the share read after it
    intervals.push([previous[0], point[0], point[1] >= previous[1] ? point[1] - previous[1] : point[1]])
    previous = point
  }

  // 5. Pass 1: the short gaps alone, spread evenly, say how the day goes
  const short = new Array<number>(bins).fill(0)
  const shortExposure = new Array<number>(bins).fill(0)
  for (const [from, to, amount] of intervals) {
    if (to - from > SHORT_GAP_MS) {
      continue
    }
    spread(short, from, to, amount, () => 1)
    for (let j = Math.floor((from - origin) / HOUR_MS); j <= Math.ceil((to - origin) / HOUR_MS) - 1; j += 1) {
      const overlap = (Math.min(to, at(binStarts, j) + HOUR_MS) - Math.max(from, at(binStarts, j))) / HOUR_MS
      if (overlap > 0) {
        shortExposure[j] = at(shortExposure, j) + overlap
      }
    }
  }
  const covered = shortExposure.reduce((sum, hours) => sum + hours, 0)
  const first = covered >= MIN_SHORT_HOURS ? profile(short, shortExposure, hods, binStarts, now, false) : null

  // 6. Pass 2: every interval, a long gap by pass 1's profile
  const hourly = new Array<number>(bins).fill(0)
  for (const [from, to, amount] of intervals) {
    const byProfile = to - from > SHORT_GAP_MS && first !== null
    spread(hourly, from, to, amount, byProfile ? (hod) => at(first, hod) : () => 1)
  }
  const rates = profile(hourly, exposure, hods, binStarts, now, true)
  const daily = rates.reduce((sum, rate) => sum + rate, 0)

  // 7. The expected path from now to the reset: the share at each day's close
  const expected: number[] = []
  let cum = used
  let closeIndex = 0
  for (let t = hourStart(now); t < reset; t += HOUR_MS) {
    const lo = Math.max(now, t)
    const hi = Math.min(reset, t + HOUR_MS)
    if (hi <= lo) {
      continue
    }
    const rate = at(rates, new Date(t).getHours())
    while (closeIndex < closes.length && at(closes, closeIndex) <= hi) {
      expected.push(cum + (rate * (at(closes, closeIndex) - lo)) / HOUR_MS)
      closeIndex += 1
    }
    cum += (rate * (hi - lo)) / HOUR_MS
  }
  const remaining = cum - used

  // 8. The day-to-day spread, from the whole days before the last reading
  const wholeDays = Math.floor((lastAt - start) / DAY_MS)
  const totals: number[] = []
  for (let i = 0; i < wholeDays; i += 1) {
    let total = 0
    for (let j = 0; j < bins; j += 1) {
      const middle = at(binStarts, j) + HOUR_MS / 2
      if (middle > lastAt - (i + 1) * DAY_MS && middle <= lastAt - i * DAY_MS) {
        total += at(hourly, j)
      }
    }
    totals.push(total)
  }
  const dayMean = totals.length > 0 ? totals.reduce((sum, value) => sum + value, 0) / totals.length : daily
  const dayVariance = totals.length >= 2 ? totals.reduce((sum, value) => sum + (value - dayMean) ** 2, 0) / (totals.length - 1) : 0
  const prior = (PRIOR_CV * Math.max(daily, dayMean)) ** 2
  const degrees = Math.max(0, wholeDays - 1)
  const variance = (degrees * dayVariance + PRIOR_WEIGHT * prior) / (degrees + PRIOR_WEIGHT)
  const daysLeft = (reset - now) / DAY_MS
  // The noise of the days still to come, and the uncertainty of the daily mean
  const spreadOfRemaining = daysLeft * variance + (daysLeft * daysLeft * variance) / Math.max(1, wholeDays)

  // 9. The remaining use as a Gamma distribution matched to its mean and
  // variance: the chance it passes what is left, and its median
  const need = 100 - used
  let chance: number
  let median: number
  if (remaining <= 0) {
    chance = 0
    median = 0
  } else if (spreadOfRemaining <= 0) {
    chance = remaining >= need ? 1 : 0
    median = remaining
  } else {
    const shape = (remaining * remaining) / spreadOfRemaining
    const scale = spreadOfRemaining / remaining
    chance = 1 - gammaP(shape, need / scale)
    median = gammaMedian(shape, scale)
  }

  // 10. The central path: the expected path scaled so its end is the median,
  // so that the days' highs, the end and the hour the limit is reached agree
  // with the outlook
  const scale = remaining > 0 ? median / remaining : 0
  const days: DayForecast[] = []
  let low = used
  closes.forEach((closesAt, i) => {
    const high = used + (at(expected, i) - used) * scale
    days.push({ closesAt, low, high })
    low = high
  })
  const end = used + median
  let runsOutAt: number | null = null
  let central = used
  for (let t = hourStart(now); t < reset && runsOutAt === null; t += HOUR_MS) {
    const lo = Math.max(now, t)
    const hi = Math.min(reset, t + HOUR_MS)
    if (hi <= lo) {
      continue
    }
    const rate = at(rates, new Date(t).getHours()) * scale
    const add = (rate * (hi - lo)) / HOUR_MS
    if (central < 100 && central + add >= 100) {
      runsOutAt = lo + ((100 - central) / rate) * HOUR_MS
    }
    central += add
  }

  // 11. The outlook. A storm's central path reaches 100 by construction; should
  // rounding leave it short, the week runs out at the reset
  const outlook: Outlook = chance >= STORM_CHANCE ? 'storm' : end >= CLOUDS_END ? 'clouds' : 'clear'
  if (outlook !== 'storm') {
    runsOutAt = null
  } else if (runsOutAt === null) {
    runsOutAt = reset
  }
  return { ...base, outlook, startsAt: null, end, chance, runsOutAt, days }
}
