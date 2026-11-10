import {
  acrossSessions,
  clock,
  figure,
  LEAD,
  hourFoot,
  hourHeadline,
  hourKey,
  hourLabel,
  hourSoFarLine,
  hourStrap,
  quietStrap,
  reviewDetail,
  reviewSpan,
  wholeMinutes,
} from '@pipcast/contract'
import type { SessionRecord, Snapshot, StoryCounts } from '@pipcast/contract'
import type { HourRow, Scene } from '@pipcast/design'

import type { TickerExtra } from './board.ts'
import type { Forecast } from './forecast.ts'
import { inListingOrder, waitingSince } from './listing.ts'
import type { Segment } from './story.ts'
import {
  DESK_MS,
  HOUR_OUTRO_MS,
  IDENT_MS,
  REDUCED_OPENER_MS,
  REVIEW_MS,
  REVIEW_ROWS,
  STORMTRACKER_MS,
  WEATHER_PAGE_MS,
} from './timing.ts'
import type { Step } from './types.ts'
import { hasOutlook, weatherScene } from './weather.ts'

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

// A session's row in THE HOUR IN REVIEW, named as the board names it: its
// title, and its project on the plate
function rowFor(session: SessionRecord, from: number, hour: number, now: number): HourRow {
  const row: HourRow = { id: session.id, project: session.project, name: session.title, state: session.state }
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
// from the snapshot as the report starts. With a forecast that has an outlook,
// KLWD WEATHER follows the review (or the desk, in a quiet hour): CURRENT
// CONDITIONS, EXTENDED FORECAST, and with a storm STORMTRACKER.
export function hourReport(
  hour: number,
  from: number,
  snapshot: Snapshot,
  now: number,
  reducedMotion: boolean,
  forecast: Forecast | null = null,
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
  // In the listing's order, so the review reads as the board does
  const rows = inListingOrder(sessions).map((session) => rowFor(session, from, hour, now))
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
    // The beat, in D major, comes in with the desk and plays on under the review
    bed: 'beat-major',
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
    // A desk's 10 s for each page of four rows
    length: REVIEW_MS * Math.max(1, Math.ceil(rows.length / REVIEW_ROWS)),
    bed: 'beat-major',
    scene: ({ now: at, ticker }): Scene => ({
      mode: 'review',
      clock: clock(at),
      span: reviewSpan(clock(from), label),
      rows,
      ticker,
    }),
  }
  // KLWD WEATHER, drawn from the forecast as the report starts
  const weatherSteps: Step[] = []
  if (hasOutlook(forecast)) {
    const weather = weatherScene(forecast, now)
    const page = (mode: 'weather-now' | 'weather-days' | 'stormtracker', length: number): Step => ({
      role: 'weather',
      length,
      bed: 'beat-major',
      scene: ({ now: at, ticker }): Scene => ({ mode, clock: clock(at), ticker, weather }),
    })
    weatherSteps.push(page('weather-now', WEATHER_PAGE_MS), page('weather-days', WEATHER_PAGE_MS))
    if (forecast.outlook === 'storm') {
      weatherSteps.push(page('stormtracker', STORMTRACKER_MS))
    }
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
  const shown = [...(stories > 0 ? [ident, desk, review] : [ident, desk]), ...weatherSteps]
  const ticker = (live: Snapshot): TickerExtra => ({
    lead: {
      lead: LEAD.onTheHour,
      key: `on-air:hour:${hour}`,
      text: hourSoFarLine(
        stories,
        clock(from),
        live.sessions.filter((session) => session.state === 'working').length,
        live.sessions.length,
      ),
    },
  })
  if (reducedMotion) {
    return { segment: { id, steps: shown, endCue: 'hour-out', ticker }, stories }
  }
  return { segment: { id, steps: [...shown, outro], ticker }, stories }
}
