import {
  acrossSessions,
  clock,
  figure,
  hourFoot,
  hourHeadline,
  hourKey,
  hourLabel,
  hourStrap,
  quietStrap,
  reviewDetail,
  reviewSpan,
  wholeMinutes,
} from '@pipcast/contract'
import type { SessionRecord, Snapshot, StoryCounts } from '@pipcast/contract'
import type { HourRow, Scene } from '@pipcast/design'

import type { Segment } from './story.ts'
import { DESK_MS, HOUR_OUTRO_MS, IDENT_MS, REDUCED_OPENER_MS, REVIEW_MS } from './timing.ts'
import type { Step } from './types.ts'

export interface HourReport {
  segment: Segment
  stories: number
}

function inWindow(at: number, from: number, hour: number): boolean {
  return at >= from && at < hour
}

// The kind of a session's newest story in the window, if it has one
function newestKindIn(session: SessionRecord, from: number, hour: number): keyof StoryCounts | undefined {
  let found: { at: number; kind: SessionRecord['stories'][number]['kind'] } | undefined
  for (const story of session.stories) {
    if (inWindow(story.at, from, hour) && (found === undefined || story.at >= found.at)) {
      found = story
    }
  }
  switch (found?.kind) {
    case 'needs-input':
      return 'needsInput'
    case 'ready':
      return 'ready'
    case 'complete':
      return 'complete'
    case 'error':
      return 'error'
    default:
      return undefined
  }
}

function linesIn(session: SessionRecord, from: number, hour: number): { added: number; removed: number; files: number } {
  const first = hourKey(from)
  const last = hourKey(hour)
  const sum = { added: 0, removed: 0, files: 0 }
  for (const entry of session.hours) {
    if (entry.hour >= first && entry.hour < last) {
      sum.added += entry.added
      sum.removed += entry.removed
      sum.files += entry.files
    }
  }
  return sum
}

function waitingSince(session: SessionRecord): number {
  let at = session.stateAt
  for (const story of session.stories) {
    if (story.kind === session.state) {
      at = story.at
    }
  }
  return at
}

function rowFor(session: SessionRecord, from: number, hour: number, now: number): HourRow {
  const row: HourRow = { id: session.id, project: session.project, state: session.state }
  switch (session.state) {
    case 'needs-input':
      row.detail = reviewDetail({ kind: 'waiting', minutes: wholeMinutes(now - waitingSince(session)) })
      break
    case 'error':
      row.detail = reviewDetail({ kind: 'error' })
      break
    default: {
      const { added, removed } = linesIn(session, from, hour)
      row.detail = reviewDetail({ kind: 'lines', added, removed })
    }
  }
  return row
}

// The report on the hour, covering `from` to `hour`. Its numbers are taken
// from the snapshot as the report starts.
export function hourReport(
  hour: number,
  from: number,
  snapshot: Snapshot,
  now: number,
  reducedMotion: boolean,
): HourReport {
  const sessions = snapshot.sessions
  const counts: StoryCounts = { needsInput: 0, ready: 0, complete: 0, error: 0 }
  let stories = 0
  let added = 0
  let removed = 0
  for (const session of sessions) {
    const kind = newestKindIn(session, from, hour)
    if (kind !== undefined) {
      counts[kind] += 1
      stories += 1
    }
    const lines = linesIn(session, from, hour)
    added += lines.added
    removed += lines.removed
  }
  const working = sessions.filter((session) => session.state === 'working').length
  const rows = sessions.map((session) => rowFor(session, from, hour, now))
  const label = hourLabel(hour)

  const ident: Step = {
    role: 'opener',
    length: reducedMotion ? REDUCED_OPENER_MS : IDENT_MS,
    cue: 'hour',
    scene: ({ now: at }): Scene => ({ mode: 'ident', clock: clock(at), hour: label, progress: 1 }),
  }
  const desk: Step = {
    role: 'desk',
    length: DESK_MS,
    scene: ({ now: at, ticker }): Scene => ({
      mode: 'desk',
      clock: clock(at),
      act: 'talk',
      event: {
        kind: 'hourly',
        figure: figure(added, removed),
        sub: acrossSessions(sessions.length),
        foot: hourFoot(clock(from), label),
      },
      headline: hourHeadline(stories),
      strap: stories > 0 ? hourStrap(counts) : quietStrap(working),
      ticker,
    }),
  }
  const review: Step = {
    role: 'review',
    length: REVIEW_MS,
    scene: ({ now: at, ticker }): Scene => ({
      mode: 'review',
      clock: clock(at),
      span: reviewSpan(clock(from), label),
      rows,
      ticker,
    }),
  }
  const outro: Step = {
    role: 'outro',
    length: HOUR_OUTRO_MS,
    cue: 'hour-out',
    scene: ({ now: at, board }): Scene => ({
      mode: 'outro',
      open: 'hour',
      hour: label,
      clock: clock(at),
      progress: 1,
      board,
    }),
  }

  const id = `hour:${hour}`
  const shown = stories > 0 ? [ident, desk, review] : [ident, desk]
  if (reducedMotion) {
    return { segment: { id, steps: shown, endCue: 'hour-out' }, stories }
  }
  return { segment: { id, steps: [...shown, outro] }, stories }
}
