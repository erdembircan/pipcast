import {
  activityLine,
  afterReportLine,
  clock,
  deskLine,
  hourLabel,
  LEAD,
  reportComingUp,
  stillWaitingLine,
  storyLine,
  wholeMinutes,
  waitingForReviewLine,
} from '@pipcast/contract'
import type { SessionRecord, Snapshot, Story } from '@pipcast/contract'
import type { Scene, Session, TickerItem } from '@pipcast/design'

import { movedOn } from './story.ts'
import { AFTER_REPORT_MS, BREAKING_MS, HOUR_MS } from './timing.ts'
import type { BoardState } from './types.ts'

const MAX_TICKER = 6
const MAX_COMING_UP = 2
const MAX_BREAKING = 2

function newestOfKind(session: SessionRecord, kind: Story['kind']): Story | undefined {
  let found: Story | undefined
  for (const story of session.stories) {
    if (story.kind === kind && (found === undefined || story.at >= found.at)) {
      found = story
    }
  }
  return found
}

function newestStory(session: SessionRecord): Story | undefined {
  let found: Story | undefined
  for (const story of session.stories) {
    if (found === undefined || story.at >= found.at) {
      found = story
    }
  }
  return found
}

function titleOf(snapshot: Snapshot, sessionId: string): string | undefined {
  return snapshot.sessions.find((session) => session.id === sessionId)?.title
}

export function boardTicker(now: number, snapshot: Snapshot, state: BoardState): TickerItem[] {
  const leads: TickerItem[] = []

  // 1. What is waiting its turn
  let comingUp = 0
  for (const item of state.queue) {
    if (comingUp >= MAX_COMING_UP) {
      break
    }
    if (item.kind === 'hour') {
      leads.push({ lead: LEAD.comingUp, text: reportComingUp(hourLabel(item.hour)) })
      comingUp += 1
    } else if (!movedOn(snapshot, item.sessionId, item.story)) {
      const title = titleOf(snapshot, item.sessionId)
      if (title !== undefined) {
        leads.push({ lead: LEAD.comingUp, text: storyLine(item.story.kind, title) })
        comingUp += 1
      }
    }
  }

  // 2. What has just aired
  const breaking = [...state.carried.values()]
    .filter((carried) => now - carried.endedAt < BREAKING_MS)
    .sort((a, b) => b.endedAt - a.endedAt)
  let shown = 0
  for (const carried of breaking) {
    if (shown >= MAX_BREAKING) {
      break
    }
    const title = titleOf(snapshot, carried.sessionId)
    if (title !== undefined) {
      leads.push({ lead: LEAD.breaking, text: storyLine(carried.kind, title) })
      shown += 1
    }
  }

  // 3. Sessions that still need you, the longest waiting first
  const waiting: { at: number; item: TickerItem }[] = []
  for (const session of snapshot.sessions) {
    if (session.state === 'needs-input' || session.state === 'error') {
      const at = newestOfKind(session, session.state)?.at ?? session.stateAt
      waiting.push({
        at,
        item: { lead: LEAD.stillWaiting, text: stillWaitingLine(session.state, session.title, wholeMinutes(now - at)) },
      })
    }
  }
  waiting.sort((a, b) => a.at - b.at)
  for (const entry of waiting) {
    leads.push(entry.item)
  }

  // 4. Finished sessions whose story has left the BREAKING line, or never aired
  const queuedIds = new Set<string>()
  for (const item of state.queue) {
    if (item.kind === 'story') {
      queuedIds.add(item.story.id)
    }
  }
  for (const session of snapshot.sessions) {
    if (session.state !== 'ready') {
      continue
    }
    const story = newestStory(session)
    if (story === undefined || story.kind !== 'ready') {
      continue
    }
    if (queuedIds.has(story.id) || state.onAirStoryId === story.id) {
      continue
    }
    const carried = state.carried.get(story.id)
    if (carried !== undefined && now - carried.endedAt < BREAKING_MS) {
      continue
    }
    leads.push({ lead: LEAD.ready, text: waitingForReviewLine(session.title) })
  }

  // 5. The report that just aired
  if (state.lastReport !== null && state.reportEndedAt !== null && now - state.reportEndedAt < AFTER_REPORT_MS) {
    const { hour, stories } = state.lastReport
    leads.push({
      lead: LEAD.onTheHour,
      text: afterReportLine(stories, hourLabel(hour), hourLabel(hour + HOUR_MS)),
    })
  }

  // 6. How the desk is, always: the items before it make room for it
  const onAir = snapshot.sessions.length
  const working = snapshot.sessions.filter((session) => session.state === 'working')
  const items: TickerItem[] = leads.slice(0, MAX_TICKER - 1)
  items.push({ lead: LEAD.onTheDesk, text: deskLine(working.length, onAir) })

  // 7. What the working sessions are doing, newest first
  const activity = working
    .flatMap((session) => {
      const latest = session.activity[session.activity.length - 1]
      return latest === undefined ? [] : [{ at: latest.at, text: activityLine(session.project, latest.text) }]
    })
    .sort((a, b) => b.at - a.at)
  for (const entry of activity) {
    if (items.length >= MAX_TICKER) {
      break
    }
    items.push(entry.text)
  }
  return items
}

export function boardScene(now: number, snapshot: Snapshot | null, state: BoardState): Scene {
  if (snapshot === null) {
    return { mode: 'board', clock: clock(now), sessions: [], ticker: [] }
  }
  const sessions: Session[] = snapshot.sessions.map((session) => ({
    id: session.id,
    name: session.title,
    project: session.project,
    state: session.state,
  }))
  return { mode: 'board', clock: clock(now), sessions, ticker: boardTicker(now, snapshot, state) }
}
