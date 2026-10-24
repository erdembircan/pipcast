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
