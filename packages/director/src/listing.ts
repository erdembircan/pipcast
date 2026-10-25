import type { SessionRecord, SessionState } from '@pipcast/contract'

// The listing's order, which THE HOUR IN REVIEW keeps too. The states come in
// the order the window's listing sorts them (STATES in
// design/components/bundle.js): what needs you, then what has finished, then
// what is working. Within a state the window keeps the order it is given, and
// this is that order.
const STATE_ORDER: Record<SessionState, number> = {
  'needs-input': 0,
  error: 1,
  ready: 2,
  working: 3,
}

// When a session began to wait in its state: its newest story of that kind,
// else when its state last changed. The ticker's STILL WAITING and the
// review's "Waiting 4 min" count from it.
export function waitingSince(session: SessionRecord): number {
  let at: number | undefined
  for (const story of session.stories) {
    if (story.kind === session.state && (at === undefined || story.at >= at)) {
      at = story.at
    }
  }
  return at ?? session.stateAt
}

// The sessions in the listing's order: within needs input and error the
// longest waiting first, within ready and working the newest change first.
// Sessions that tie keep the order on air.
export function inListingOrder(sessions: readonly SessionRecord[]): SessionRecord[] {
  return [...sessions].sort((a, b) => {
    if (a.state !== b.state) {
      return STATE_ORDER[a.state] - STATE_ORDER[b.state]
    }
    if (a.state === 'needs-input' || a.state === 'error') {
      return waitingSince(a) - waitingSince(b)
    }
    return b.stateAt - a.stateAt
  })
}
