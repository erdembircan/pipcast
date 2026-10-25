// What KLWD airs in the video, scene by scene, in the product's own words:
// every line comes from packages/contract/src/copy.ts, as the director writes
// it on air. The sessions are the design system's examples, not anyone's
// real work.
import {
  ACTIVITY,
  LEAD,
  acrossSessions,
  activityLine,
  afterReportLine,
  deskLine,
  filesChanged,
  finishedFoot,
  hourFoot,
  hourHeadline,
  hourSoFarLine,
  hourStrap,
  reviewDetail,
  reviewSpan,
  storyLine,
  waitingFoot,
  waitingForReviewLine,
} from '../../packages/contract/src/copy.ts'
import { figure } from '../../packages/contract/src/format.ts'
import type { LimitMeter, NewsEvent, Scene, Session, TickerItem } from './design/pipnews.ts'

export const CHECKOUT = { id: 'checkout', name: 'Fix flaky checkout test', project: 'web-shop' }
export const AUTH = { id: 'auth', name: 'Refactor auth middleware', project: 'api-server' }
export const NOTES = { id: 'notes', name: 'Write release notes for 2.4', project: 'docs-site' }
export const SQLITE = { id: 'sqlite', name: 'Migrate settings to SQLite', project: 'desktop-app' }

const at = (s: typeof CHECKOUT, state: Session['state']): Session => ({ ...s, state })

const LIMITS: LimitMeter[] = [
  { kind: 'session', percent: 42 },
  { kind: 'week', percent: 61 },
]
const LIMITS_LATER: LimitMeter[] = [
  { kind: 'session', percent: 47 },
  { kind: 'week', percent: 62 },
]

const doing = {
  checkout: activityLine(CHECKOUT.project, ACTIVITY.running('the checkout tests')),
  notes: activityLine(NOTES.project, ACTIVITY.editing('CHANGELOG.md')),
  auth: activityLine(AUTH.project, ACTIVITY.editing('src/auth/session.ts')),
  sqlite: activityLine(SQLITE.project, ACTIVITY.writing('migrations/004_settings.sql')),
}

/** The cold open's board: three sessions on air, all working */
export function boardThree(clock: string): Scene {
  return {
    mode: 'board',
    clock,
    sessions: [at(AUTH, 'working'), at(NOTES, 'working'), at(SQLITE, 'working')],
    limits: LIMITS,
    ticker: [{ lead: LEAD.onTheDesk, text: deskLine(3, 3) }, doing.notes, doing.auth, doing.sqlite],
  }
}

export const READY_EVENT: NewsEvent = {
  kind: 'ready',
  session: NOTES.name,
  project: NOTES.project,
  figure: figure(182, 40),
  sub: filesChanged(4),
  foot: finishedFoot('9 min'),
}

export const STINGER_READY: Scene = { mode: 'stinger', clock: '17:41', event: READY_EVENT }

export const DESK_READY: Scene = {
  mode: 'desk',
  clock: '17:41',
  act: 'cheer',
  event: READY_EVENT,
  ticker: [{ lead: LEAD.breaking, text: storyLine('ready', NOTES.name) }, doing.auth, doing.sqlite],
}

/** The board once the release notes are ready for review; with the checkout session once it has tuned in */
export function boardReady(clock: string, withCheckout: boolean): Scene {
  const sessions = [at(AUTH, 'working'), at(NOTES, 'ready'), at(SQLITE, 'working')]
  if (withCheckout) sessions.unshift(at(CHECKOUT, 'working'))
  return {
    mode: 'board',
    clock,
    sessions,
    limits: LIMITS,
    ticker: [
      { lead: LEAD.ready, text: waitingForReviewLine(NOTES.name) },
      ...(withCheckout ? [doing.checkout] : []),
      doing.auth,
      doing.sqlite,
    ],
  }
}

export function outroTo(board: Scene, open?: 'hour', hour?: string): Scene {
  return { mode: 'outro', clock: board.clock, progress: 1, board, open, hour }
}

/** Claude asks to run a command in the checkout session; `waited` counts up on the monitor's foot */
export function askEvent(waited: number): NewsEvent {
  const s = Math.max(0, Math.floor(waited))
  return {
    kind: 'needs-input',
    session: CHECKOUT.name,
    project: CHECKOUT.project,
    command: 'npm install',
    quote: 'Install dependencies',
    foot: waitingFoot(`0:${s < 10 ? '0' : ''}${s}`),
  }
}

export const STINGER_ASK: Scene = { mode: 'stinger', clock: '17:47', event: askEvent(0) }

export function deskAsk(waited: number): Scene {
  return {
    mode: 'desk',
    clock: '17:47',
    act: 'urgent',
    event: askEvent(waited),
    ticker: [{ lead: LEAD.breaking, text: storyLine('needs-input', CHECKOUT.name) }, { lead: LEAD.ready, text: waitingForReviewLine(NOTES.name) }, doing.auth],
  }
}

export const IDENT: Scene = { mode: 'ident', clock: '17:59', hour: '18:00' }

const hourTicker: TickerItem[] = [
  { lead: LEAD.onTheHour, text: hourSoFarLine(2, '17:00', 4, 4) },
  { lead: LEAD.ready, text: waitingForReviewLine(NOTES.name) },
  doing.auth,
]

export const HOUR_DESK: Scene = {
  mode: 'desk',
  clock: '18:00',
  act: 'talk',
  event: { kind: 'hourly', figure: figure(1546, 368), sub: acrossSessions(4), foot: hourFoot('17:00', '18:00') },
  headline: hourHeadline(2),
  strap: hourStrap({ needsInput: 1, ready: 1, complete: 0, error: 0 }),
  ticker: hourTicker,
}

export const HOUR_REVIEW: Scene = {
  mode: 'review',
  clock: '18:00',
  span: reviewSpan('17:00', '18:00'),
  rows: [
    { id: NOTES.id, project: NOTES.project, name: NOTES.name, state: 'ready', detail: reviewDetail({ kind: 'lines', added: 182, removed: 40 }) },
    { id: AUTH.id, project: AUTH.project, name: AUTH.name, state: 'working', detail: reviewDetail({ kind: 'lines', added: 1204, removed: 310 }) },
    { id: CHECKOUT.id, project: CHECKOUT.project, name: CHECKOUT.name, state: 'working', detail: reviewDetail({ kind: 'lines', added: 64, removed: 12 }) },
    { id: SQLITE.id, project: SQLITE.project, name: SQLITE.name, state: 'working', detail: reviewDetail({ kind: 'lines', added: 96, removed: 6 }) },
  ],
  ticker: hourTicker,
}

/** The board after the report on the hour */
export function boardAfterHour(clock: string): Scene {
  return {
    mode: 'board',
    clock,
    sessions: [at(CHECKOUT, 'working'), at(AUTH, 'working'), at(NOTES, 'ready'), at(SQLITE, 'working')],
    limits: LIMITS_LATER,
    ticker: [{ lead: LEAD.onTheHour, text: afterReportLine(2, '18:00', '19:00') }, { lead: LEAD.ready, text: waitingForReviewLine(NOTES.name) }, doing.checkout],
  }
}

/** The settings migration finishes while the window is tucked into the side */
export const MIGRATION_EVENT: NewsEvent = {
  kind: 'ready',
  session: SQLITE.name,
  project: SQLITE.project,
  figure: figure(142, 18),
  sub: filesChanged(3),
  foot: finishedFoot('26 min'),
}

export const STINGER_MIGRATION: Scene = { mode: 'stinger', clock: '18:03', event: MIGRATION_EVENT }

export const DESK_MIGRATION: Scene = {
  mode: 'desk',
  clock: '18:03',
  act: 'cheer',
  event: MIGRATION_EVENT,
  ticker: [{ lead: LEAD.breaking, text: storyLine('ready', SQLITE.name) }, { lead: LEAD.ready, text: waitingForReviewLine(NOTES.name) }, doing.checkout],
}

/** The board once the migration is ready for review too */
export function boardAfterMigration(clock: string): Scene {
  return {
    mode: 'board',
    clock,
    sessions: [at(CHECKOUT, 'working'), at(AUTH, 'working'), at(NOTES, 'ready'), at(SQLITE, 'ready')],
    limits: LIMITS_LATER,
    ticker: [{ lead: LEAD.ready, text: waitingForReviewLine(SQLITE.name) }, { lead: LEAD.ready, text: waitingForReviewLine(NOTES.name) }, doing.checkout],
  }
}
