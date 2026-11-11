import { parseLimits } from '@pipcast/contract'
import type { LimitKind, SessionRecord, UsageLimit } from '@pipcast/contract'
import type { LimitMeter } from '@pipcast/design'

import { RESET_TOLERANCE_MS } from './forecast.ts'
import type { WeekReading } from './forecast.ts'

const KINDS: readonly LimitKind[] = ['session', 'week']

// What a limit reads at `now`: a whole percent, rounded as usage-band rounds
// it, and 0 once its reset time has passed, until a newer reading
export function limitPercent(limit: UsageLimit, now: number): number {
  if (limit.resetsAt !== null && limit.resetsAt <= now) {
    return 0
  }
  return Math.min(100, Math.max(0, Math.round(limit.percentUsed)))
}

// The account's usage limits on the board: each from the newest reading any
// session on air took. A record comes from a file, so what is not well
// formed is left out
export function limitMeters(sessions: readonly SessionRecord[], now: number): LimitMeter[] {
  const newest = new Map<LimitKind, UsageLimit>()
  for (const session of sessions) {
    for (const limit of parseLimits(session.limits)) {
      const held = newest.get(limit.kind)
      if (held === undefined || limit.at > held.at) {
        newest.set(limit.kind, limit)
      }
    }
  }
  const meters: LimitMeter[] = []
  for (const kind of KINDS) {
    const limit = newest.get(kind)
    if (limit !== undefined) {
      meters.push({ kind, percent: limitPercent(limit, now) })
    }
  }
  return meters
}

// The week's reading among the sessions on air, for the forecast: of the latest
// reset window any of them reads (reset times within RESET_TOLERANCE_MS are one
// window), the one with the highest share, since a window's share never falls
// and a lower one is a session's older answer, as one gives when it tunes in.
// With equal shares, the later reading. Null when none has a reset time, or the
// latest window's reset has passed.
export function newestWeekReading(sessions: readonly SessionRecord[], now: number): WeekReading | null {
  const weeks: { limit: UsageLimit; resetsAt: number; percent: number }[] = []
  let latest = -Infinity
  for (const session of sessions) {
    for (const limit of parseLimits(session.limits)) {
      if (limit.kind === 'week' && limit.resetsAt !== null) {
        weeks.push({ limit, resetsAt: limit.resetsAt, percent: Math.min(100, Math.max(0, limit.percentUsed)) })
        latest = Math.max(latest, limit.resetsAt)
      }
    }
  }
  if (weeks.length === 0 || latest <= now) {
    return null
  }
  let best: (typeof weeks)[number] | undefined
  for (const week of weeks) {
    if (latest - week.resetsAt > RESET_TOLERANCE_MS) {
      continue
    }
    if (best === undefined || week.percent > best.percent || (week.percent === best.percent && week.limit.at > best.limit.at)) {
      best = week
    }
  }
  return best === undefined ? null : { percent: best.percent, resetsAt: best.resetsAt, at: best.limit.at }
}
