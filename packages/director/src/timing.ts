import { hourStart } from '@pipcast/contract'

// How long each step of a segment runs, in milliseconds, and the other
// lengths of time the director goes by.

export const STINGER_MS = 1_900
export const DESK_MS = 10_000
export const STORY_OUTRO_MS = 1_400

export const IDENT_MS = 7_500
export const REVIEW_MS = 10_000
// THE HOUR IN REVIEW shows four rows a page, as the design draws it, and each
// page runs REVIEW_MS
export const REVIEW_ROWS = 4
export const HOUR_OUTRO_MS = 1_600

// KLWD WEATHER: CURRENT CONDITIONS and EXTENDED FORECAST run WEATHER_PAGE_MS
// each, STORMTRACKER STORMTRACKER_MS, and STORM WARNING's open and outro
// ALERT_MS and ALERT_OUTRO_MS
export const WEATHER_PAGE_MS = 10_000
export const STORMTRACKER_MS = 13_000
export const ALERT_MS = 1_900
export const ALERT_OUTRO_MS = 1_400

// The board turns to the weekly forecast at the quarter hours on the clock,
// :15, :30 and :45, and holds it WEATHER_PAGE_MS from when its turn starts
export const QUARTER_MS = 15 * 60_000

// With reduced motion the openers show their last picture for this long
export const REDUCED_OPENER_MS = 1_000

// At least this long between the end of one segment and the start of the next
export const GAP_MS = 2_000

// The ident starts this long before the hour
export const IDENT_LEAD_MS = 5_000

// A story stays BREAKING in the ticker this long after its segment ends
export const BREAKING_MS = 40_000

// ON THE HOUR stays in the ticker this long after a report airs
export const AFTER_REPORT_MS = 10 * 60_000

// A report remembered from an earlier run counts if it is this recent
export const LAST_REPORT_KEEP_MS = 24 * 60 * 60_000

export const HOUR_MS = 60 * 60_000

// STORM WARNING comes due at most this often, counted from when it last did
export const WARNING_EVERY_MS = 60 * 60_000

// The quarter hour a moment is in, as the moment it began: :15, :30 or :45 on
// the clock. The first quarter, which begins on the hour, is null: the hour has
// the report.
export function quarterOf(now: number): number | null {
  const hour = hourStart(now)
  const index = Math.floor((now - hour) / QUARTER_MS)
  return index >= 1 && index <= 3 ? hour + index * QUARTER_MS : null
}
