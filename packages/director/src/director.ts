import { hourStart, STORY_FRESH_MS } from '@pipcast/contract'
import type { Bed, SessionRecord, Snapshot, Sound, Story, WeatherMemory } from '@pipcast/contract'
import type { Scene, WeatherScene } from '@pipcast/design'

import { boardScene, boardTicker } from './board.ts'
import type { Forecast, WeekHistory, WeekReading } from './forecast.ts'
import { hourReport } from './hour.ts'
import { movedOn, storySegment } from './story.ts'
import type { Segment } from './story.ts'
import { GAP_MS, HOUR_MS, IDENT_LEAD_MS, LAST_REPORT_KEEP_MS, quarterOf, WEATHER_PAGE_MS } from './timing.ts'
import type { BoardState, Carried, QueueItem, ReportMemory } from './types.ts'
import { createWeatherDesk, hasOutlook, warningSegment, weatherScene } from './weather.ts'

export interface DirectorOptions {
  reducedMotion?: boolean
  // Tests count how often the forecast runs, and how often the sessions are
  // looked through for the week's reading; the release passes nothing
  forecastWeek?: (history: WeekHistory, used: number, now: number) => Forecast | null
  weekReading?: (sessions: readonly SessionRecord[], now: number) => WeekReading | null
  // The page's copy of the station's weather.json, handed to a director it
  // makes after the first (as when reduced motion changes), which would
  // otherwise start the week's readings over. Left out, the director takes the
  // memory from the first snapshot that carries one, and takes no readings
  // until it has one
  weather?: WeatherMemory | null
  // Tests and the development build say which quarter hour a moment is in, as
  // the moment it began, or null for none; the release passes nothing, and has
  // :15, :30 and :45 on the clock
  quarters?: (now: number) => number | null
}

export interface Tick {
  now: number
  snapshot: Snapshot | null
}

export interface Program {
  // What Broadcast draws now
  scene: Scene
  // 'board' between segments, else `${segmentId}:${stepIndex}`
  key: string
  // What the station is to play from this tick, as the events happen: the
  // jingle a step starts with, the beat mixing in or phasing out as a step
  // starts or the segment ends, and a hush when a segment is cut
  sounds: Sound[]
  // The hour (ms) whose report started this tick
  reported: number | null
  // Whether a segment needs the window out: one is on air, one is due to
  // start, or one is waiting while the window is out between two segments.
  // The page posts it to the station whenever it changes
  wantsWindow: boolean
  // The weather desk's memory for the station to keep, when it has changed this
  // tick: the week's readings, and when STORM WARNING last came due
  weather: WeatherMemory | null
}

interface OnAir {
  item: QueueItem
  segment: Segment
  index: number
  stepStartedAt: number
  // The beat playing under the segment, if one is
  bed: Bed | undefined
}

export function createDirector(options: DirectorOptions = {}): { tick(input: Tick): Program } {
  const reducedMotion = options.reducedMotion === true
  const quarters = options.quarters ?? quarterOf
  const desk = createWeatherDesk({
    ...(options.forecastWeek === undefined ? {} : { forecastWeek: options.forecastWeek }),
    ...(options.weekReading === undefined ? {} : { weekReading: options.weekReading }),
    ...(options.weather === undefined ? {} : { memory: options.weather }),
  })

  let initialized = false
  const seen = new Set<string>()
  const queue: QueueItem[] = []
  let onAir: OnAir | null = null
  let lastEnded: number | null = null
  const carried = new Map<string, Carried>()
  let lastReport: ReportMemory | null = null
  let reportEndedAt: number | null = null
  let scheduledHour = 0
  // The board's turn to the weekly forecast, no segment: the last quarter hour
  // dealt with; the one that is due and waits to start, if one is; and the
  // turn on the board now, its forecast made as it started
  let servedQuarter = 0
  let dueQuarter: number | null = null
  let turn: { weather: WeatherScene; startedAt: number } | null = null

  function boardState(): BoardState {
    const story = onAir?.item.kind === 'story' ? onAir.item.story : null
    return {
      queue,
      carried,
      onAirStoryId: story === null ? null : story.id,
      lastReport,
      reportEndedAt,
      forecast: desk.forecast(),
    }
  }

  // Empties the queue: every story, STORM WARNING and report on the hour
  // waiting its turn. Says whether a warning went. In place: the board reads
  // this same array.
  function dropWaiting(): boolean {
    const warning = queue.some((item) => item.kind === 'warning')
    queue.length = 0
    return warning
  }

  // Takes out the stories waiting their turn whose session has moved on, so
  // one never brings a minimized window out for nothing. In place, as above
  function dropMovedOnStories(snapshot: Snapshot | null): void {
    for (let index = queue.length - 1; index >= 0; index -= 1) {
      const item = queue[index]
      if (item?.kind === 'story' && movedOn(snapshot, item.sessionId, item.story)) {
        queue.splice(index, 1)
      }
    }
  }

  // Takes out a report still waiting when the next one comes due: it has
  // missed its hour. In place, as above
  function dropMissedReports(now: number): void {
    for (let index = queue.length - 1; index >= 0; index -= 1) {
      const item = queue[index]
      if (item?.kind === 'hour' && now >= item.hour + HOUR_MS - IDENT_LEAD_MS) {
        queue.splice(index, 1)
      }
    }
  }

  function tick({ now, snapshot }: Tick): Program {
    const sounds: Sound[] = []
    let reported: number | null = null

    function end(at: number, normally: boolean): void {
      if (onAir === null) {
        return
      }
      const { item, segment, bed } = onAir
      if (item.kind === 'story') {
        carried.set(item.story.id, { endedAt: at, kind: item.story.kind, sessionId: item.sessionId })
      } else if (item.kind === 'hour') {
        reportEndedAt = at
      }
      if (!normally) {
        // Cut: what it was playing fades out at once
        sounds.push({ type: 'hush' })
      } else {
        if (segment.endCue !== undefined) {
          sounds.push({ type: 'cue', jingle: segment.endCue })
        }
        if (bed !== undefined) {
          sounds.push({ type: 'bed-out' })
        }
      }
      onAir = null
      lastEnded = at
    }

    function enter(index: number, at: number): void {
      if (onAir === null) {
        return
      }
      onAir.index = index
      onAir.stepStartedAt = at
      const step = onAir.segment.steps[index]
      if (step?.cue !== undefined) {
        sounds.push({ type: 'cue', jingle: step.cue })
      }
      // The beat mixes in, phases out, or plays on
      if (step?.bed !== onAir.bed) {
        if (onAir.bed !== undefined) {
          sounds.push({ type: 'bed-out' })
        }
        if (step?.bed !== undefined) {
          sounds.push({ type: 'bed', bed: step.bed })
        }
        onAir.bed = step?.bed
      }
    }

    const visible = snapshot !== null && snapshot.visible
    // The window is out in its quadrant unless the station says it is
    // minimized to the side or on its way out or in
    const windowOut = snapshot === null || snapshot.windowOut !== false

    if (snapshot !== null) {
      // 1. The first tick
      if (!initialized) {
        initialized = true
        for (const session of snapshot.sessions) {
          for (const story of session.stories) {
            if (story.at < now - STORY_FRESH_MS) {
              seen.add(story.id)
            }
          }
        }
        scheduledHour = hourStart(now)
        // A quarter hour that has begun is not one to turn for
        servedQuarter = quarters(now) ?? 0
        if (snapshot.lastReportAt !== null && now - snapshot.lastReportAt <= LAST_REPORT_KEEP_MS) {
          lastReport = { hour: snapshot.lastReportAt, stories: 0 }
        }
      }

      // 2. New stories, in the order they landed. While the window is hidden
      // Claude is in front and shows every story itself, so a story that
      // lands then is seen and never waits its turn
      const landed: { sessionId: string; story: Story }[] = []
      for (const session of snapshot.sessions) {
        for (const story of session.stories) {
          if (!seen.has(story.id)) {
            landed.push({ sessionId: session.id, story })
          }
        }
      }
      landed.sort((a, b) => a.story.at - b.story.at)
      for (const { sessionId, story } of landed) {
        seen.add(story.id)
        if (visible) {
          queue.push({ kind: 'story', sessionId, story })
        }
      }

      // 3. The hour. Its report joins the queue only while the window shows
      // in the five seconds before the hour, as its ident is due; a window
      // hidden all that time skips the hour, and so does one that hides before
      // the report airs (4). A report still waiting when the next one comes due
      // is dropped
      dropMissedReports(now)
      const next = hourStart(now) + HOUR_MS
      if (visible && now >= next - IDENT_LEAD_MS && next > scheduledHour) {
        queue.push({ kind: 'hour', hour: next })
        scheduledHour = next
      }

      // The weather. A storm in the forecast brings STORM WARNING, at most
      // once an hour: it joins the queue like a story, and like a story it
      // never airs while Claude is in front. One that comes due then is skipped
      // and the hour counts from now all the same
      desk.tick(snapshot, now)
      const warningWaits = queue.some((item) => item.kind === 'warning') || onAir?.item.kind === 'warning'
      if (desk.due(now, warningWaits)) {
        if (visible) {
          queue.push({ kind: 'warning' })
        } else {
          desk.markDue(now)
        }
      }

      // The quarter hours. Each :15, :30 and :45 is dealt with once, at the
      // moment it begins; one that is due is dropped when its quarter is over, or
      // when the forecast has no outlook
      const quarter = quarters(now)
      if (quarter !== null && quarter > servedQuarter) {
        servedQuarter = quarter
        dueQuarter = quarter
      }
      if (dueQuarter !== null && (quarter !== dueQuarter || !hasOutlook(desk.forecast()))) {
        dueQuarter = null
      }
    }

    if (!visible) {
      // 4. Hidden: what is on air is cut and not restarted, and everything
      // waiting its turn is dropped: the stories, a STORM WARNING, which came
      // due at this moment, and the report on the hour, whose hour is skipped
      end(now, false)
      if (dropWaiting()) {
        desk.markDue(now)
      }
      turn = null
      dueQuarter = null
    } else if (!windowOut) {
      // 5. Minimized to the side, or on its way out or in: a segment on air
      // is cut, as when the window hides, and not restarted. What waits
      // keeps its place, less any story whose session has moved on, and
      // nothing starts until the window is out
      end(now, false)
      dropMovedOnStories(snapshot)
      turn = null
      dueQuarter = null
    } else {
      // 6. Advance
      while (onAir !== null) {
        const { item, segment, index, stepStartedAt } = onAir
        const step = segment.steps[index]
        if (step === undefined) {
          end(now, true)
          break
        }
        if (step.role === 'desk' && item.kind === 'story' && movedOn(snapshot, item.sessionId, item.story)) {
          const outro = segment.steps.findIndex((other) => other.role === 'outro')
          if (outro < 0) {
            end(now, true)
          } else {
            enter(outro, now)
          }
          continue
        }
        if (now - stepStartedAt < step.length) {
          break
        }
        const boundary = stepStartedAt + step.length
        if (index + 1 >= segment.steps.length) {
          end(boundary, true)
        } else {
          enter(index + 1, boundary)
        }
      }

      // 7. Start the next
      if (onAir === null && (lastEnded === null || now - lastEnded >= GAP_MS)) {
        while (queue.length > 0 && onAir === null) {
          const item = queue.shift()
          if (item === undefined) {
            break
          }
          if (item.kind === 'story') {
            if (movedOn(snapshot, item.sessionId, item.story)) {
              continue
            }
            onAir = { item, segment: storySegment(item.sessionId, item.story, snapshot, reducedMotion), index: 0, stepStartedAt: now, bed: undefined }
          } else if (item.kind === 'warning') {
            // Airs only if the storm is still in the forecast
            const forecast = desk.forecast()
            if (!hasOutlook(forecast) || forecast.outlook !== 'storm') {
              continue
            }
            onAir = { item, segment: warningSegment(forecast, now, reducedMotion), index: 0, stepStartedAt: now, bed: undefined }
            // The hour is counted from when it airs, as the report's is
            desk.markDue(now)
          } else {
            if (snapshot === null) {
              continue
            }
            const from = lastReport !== null && lastReport.hour < item.hour ? lastReport.hour : item.hour - HOUR_MS
            // The report goes by a forecast worked out as it starts
            const report = hourReport(item.hour, from, snapshot, now, reducedMotion, desk.refresh(now))
            onAir = { item, segment: report.segment, index: 0, stepStartedAt: now, bed: undefined }
            lastReport = { hour: item.hour, stories: report.stories }
            reportEndedAt = null
            reported = item.hour
          }
          enter(0, now)
        }
      }

      // The weekly forecast on the board. A segment on air cuts the turn. One
      // that is due starts when nothing is on air or waiting, the gap since the
      // last segment having passed, and only if the desk holds a forecast with
      // an outlook: it is the one the desk holds, none is worked out for it
      if (onAir !== null) {
        turn = null
      } else if (turn !== null) {
        if (now - turn.startedAt >= WEATHER_PAGE_MS) {
          turn = null
        }
      } else if (dueQuarter !== null && queue.length === 0 && (lastEnded === null || now - lastEnded >= GAP_MS)) {
        const forecast = desk.forecast()
        if (hasOutlook(forecast)) {
          turn = { weather: weatherScene(forecast, now), startedAt: now }
        }
        dueQuarter = null
      }
    }

    // 8. Whether a segment needs the window out. False in the tick the last
    // outro ends with nothing waiting, so a minimized window goes back at once
    const due = queue.length > 0 && (lastEnded === null || now - lastEnded >= GAP_MS)
    const wantsWindow = visible && (onAir !== null || due || (windowOut && queue.length > 0))

    // 9. The scene
    const weather = desk.memory()
    const board = boardScene(now, snapshot, boardState())
    const current: OnAir | null = onAir
    const step = current?.segment.steps[current.index]
    if (current === null || step === undefined) {
      const scene: Scene = turn === null ? board : { ...board, forecast: turn.weather }
      return { scene, key: 'board', sounds, reported, wantsWindow, weather }
    }
    // At the desk, the review and the weather pages the ticker also carries the
    // segment's own line
    const extra = current.segment.ticker
    const atDesk = step.role === 'desk' || step.role === 'review' || step.role === 'weather'
    const ticker =
      atDesk && snapshot !== null && extra !== undefined
        ? boardTicker(now, snapshot, boardState(), extra(snapshot))
        : (board.ticker ?? [])
    const made = step.scene({ now, ticker, board })
    return { scene: made, key: `${current.segment.id}:${current.index}`, sounds, reported, wantsWindow, weather }
  }

  return { tick }
}
