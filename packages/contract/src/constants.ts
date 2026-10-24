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

// A story older than this when the station first sees it does not air
export const STORY_FRESH_MS = 120_000

// Where things live
export const STORE_FOLDER = 'Pipcast'
export const CLAUDE_BUNDLE_ID = 'com.anthropic.claudefordesktop'

// Text limits
export const COMMAND_MAX = 60
export const QUESTION_MAX = 200
export const LAST_WORDS_MAX = 72
