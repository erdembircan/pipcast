// Tuning in by itself: what a classic.SessionStart says about the session

// A new session (a fresh start, a /clear, a fork), an old one carried on (a
// resume), or the same one going on (a compaction)
export type StartKind = 'new' | 'old' | 'same'

// A source it does not know counts as an old session, so nothing tunes in by itself
export function startKind(source: unknown): StartKind {
  switch (source) {
    case 'startup':
    case 'clear':
    case 'fork':
      return 'new'
    case 'compact':
      return 'same'
    default:
      return 'old'
  }
}
