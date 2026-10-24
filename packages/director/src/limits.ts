import { parseLimits } from '@pipcast/contract'
import type { LimitKind, SessionRecord, UsageLimit } from '@pipcast/contract'
import type { LimitMeter } from '@pipcast/design'

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
