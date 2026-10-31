// The numbers every part agrees on. Times are in milliseconds.

export const SCHEMA_VERSION = 1

// On air
export const HEARTBEAT_MS = 10_000
export const STALE_MS = 45_000
export const ACTIVITY_WRITE_MS = 2_000

// What a record keeps
export const MAX_STORIES = 10
export const MAX_ACTIVITY = 3
export const MAX_HOURS = 3

// The station
export const STATION_HEARTBEAT_MS = 5_000
export const STATION_STALE_MS = 20_000
export const STATION_EMPTY_GRACE_MS = 5_000
export const STATION_START_GRACE_MS = 20_000
export const SNAPSHOT_EVERY_MS = 1_000

// The window: the smallest it can be resized to, as a share of its full size,
// its quarter of the screen
export const MIN_SCALE = 0.5

// A story older than this when the station first sees it does not air
export const STORY_FRESH_MS = 120_000

// How the station mixes the beat. It comes in over BED_IN_MS on the last notes
// of its line, rising evenly from silence, so that its first downbeat lands at
// full, and goes out over BED_OUT_MS falling as the square of what is left,
// fast at first, so it carries into an outro's first chord and is gone before
// its second. A cut fades everything evenly over HUSH_MS
export const BED_IN_MS = 300
export const BED_OUT_MS = 500
export const HUSH_MS = 80

// Where things live
export const STORE_FOLDER = 'Pipcast'
export const CLAUDE_BUNDLE_ID = 'com.anthropic.claudefordesktop'

// Text limits
export const COMMAND_MAX = 60
export const QUESTION_MAX = 200
export const LAST_WORDS_MAX = 72
