// The account's usage limits, as Claude Code reports them to a mod: after a
// reply (session.measure) and when asked ($.session.usage()). Claude's
// five-hour window is the session's limit and its seven-day window the
// week's; a Claude gateway's spend limit is not shown. They are read the way
// usage-band reads them, so the band and the window agree.

import type { LimitKind, UsageLimit } from '../../../contract/src/types.ts'

// One window as the engine reports it
interface Reported {
  kind: string
  percentUsed: number
  resetsAt?: string
}

// Our kinds, each with the engine's name for its window, session first
const WINDOWS: readonly { kind: LimitKind; name: string }[] = [
  { kind: 'session', name: 'five_hour' },
  { kind: 'week', name: 'seven_day' },
]

function isReported(value: unknown): value is Reported {
  if (typeof value !== 'object' || value === null) {
    return false
  }
  const { kind, percentUsed, resetsAt } = value as { kind?: unknown; percentUsed?: unknown; resetsAt?: unknown }
  return (
    typeof kind === 'string' &&
    typeof percentUsed === 'number' &&
    Number.isFinite(percentUsed) &&
    (resetsAt === undefined || typeof resetsAt === 'string')
  )
}

// The engine's window by its name, else the first whose name begins with it
function windowNamed(list: readonly Reported[], name: string): Reported | undefined {
  return list.find((one) => one.kind === name) ?? list.find((one) => one.kind.startsWith(name))
}

// What a report says at `now`: one limit for each of our kinds it holds
export function readLimits(reported: unknown, now: number): UsageLimit[] {
  const list: Reported[] = Array.isArray(reported) ? reported.filter(isReported) : []
  const read: UsageLimit[] = []
  for (const { kind, name } of WINDOWS) {
    const found = windowNamed(list, name)
    if (found !== undefined) {
      const resetsAt = found.resetsAt === undefined ? Number.NaN : Date.parse(found.resetsAt)
      read.push({ kind, percentUsed: found.percentUsed, resetsAt: Number.isFinite(resetsAt) ? resetsAt : null, at: now })
    }
  }
  return read
}

// A reading replaces the kept limit of its kind and never removes one: Claude
// Code stops reporting a window once its reset time has passed, and that
// limit still shows, at 0%, until a new one is reported
export function keepLimits(kept: readonly UsageLimit[], read: readonly UsageLimit[]): UsageLimit[] {
  const out: UsageLimit[] = []
  for (const { kind } of WINDOWS) {
    const limit = read.find((one) => one.kind === kind) ?? kept.find((one) => one.kind === kind)
    if (limit !== undefined) {
      out.push(limit)
    }
  }
  return out
}

// Whether a figure moved: a share used or a reset time, or a limit that came
// or went. A reading that moved only the time it was read leaves the record
// to the next heartbeat
export function limitsMoved(before: readonly UsageLimit[], after: readonly UsageLimit[]): boolean {
  return (
    before.length !== after.length ||
    after.some((limit) => {
      const old = before.find((one) => one.kind === limit.kind)
      return old === undefined || old.percentUsed !== limit.percentUsed || old.resetsAt !== limit.resetsAt
    })
  )
}
