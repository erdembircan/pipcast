import { describe, expect, it } from 'vitest'

import { WEATHER_ASK_GRACE_MS } from '@pipcast/contract'
import type { SessionRecord, UsageLimit } from '@pipcast/contract'

import { GAP_MS, STORMTRACKER_MS, WEATHER_PAGE_MS } from '../src/timing.ts'
import { harness, local, session, steadyWeek, story } from './helpers.ts'
import type { Sample } from './helpers.ts'

// Fri 13 Nov 2026 at 10:16, local, on a week using 0.5 an hour: CLEAR SKIES,
// so no STORM WARNING comes in, and the next quarter hour is 10:30
const T = local(13, 10, 16)

// The same week using 1.6 an hour: a storm. Its warning came due a moment ago,
// so the next one is an hour off
const STORM_RATE = 1.6

// A harness on a week with an outlook, and the session that reads it. The
// window shows unless a test says otherwise
function world(rate = 0.5, start = T, warned: number | null = null) {
  const { memory, limit } = steadyWeek(rate, start)
  const h = harness(start, [session('a', { limits: [limit] })])
  h.world.weather = { ...memory, warnedAt: warned }
  return { h, limit }
}

// The session as it reads when /pipcast weather asked at `when`
const asked = (id: string, limit: UsageLimit, when: number): SessionRecord => session(id, { limits: [limit], weatherAskedAt: when })

// The ids of the KLWD WEATHER segments that aired
function aired(history: Sample[]): string[] {
  return [...new Set(history.map((sample) => sample.program.key).filter((key) => key.startsWith('weather:')).map((key) => key.replace(/:\d+$/, '')))]
}

// The modes the segment's steps drew, in order
function modes(history: Sample[]): string[] {
  const seen = new Map<string, string>()
  for (const sample of history) {
    if (sample.program.key.startsWith('weather:') && !seen.has(sample.program.key)) {
      seen.set(sample.program.key, sample.program.scene.mode)
    }
  }
  return [...seen.values()]
}

describe('/pipcast weather', () => {
  it('airs if the window shows within the grace: CURRENT CONDITIONS, EXTENDED FORECAST, the beat in D major, no jingle', () => {
    const { h, limit } = world()
    h.world.visible = false
    h.world.sessions = [asked('a', limit, T)]
    h.until(T + 4_750)
    expect(aired(h.history)).toEqual([])
    expect(h.history.every((sample) => !sample.program.wantsWindow)).toBe(true)
    h.world.visible = true
    h.until(T + 5_000)
    expect(aired(h.history)).toEqual([`weather:${T + 5_000}`])
    h.until(T + 40_000)
    expect(modes(h.history)).toEqual(['weather-now', 'weather-days'])
    expect(h.sounds().map(({ now, sound }) => [now - T, sound])).toEqual([
      [5_000, { type: 'bed', bed: 'beat-major' }],
      [5_000 + 2 * WEATHER_PAGE_MS, { type: 'bed-out' }],
    ])
    expect(h.cues()).toEqual([])
    // Each page runs WEATHER_PAGE_MS
    const key = (now: number) => h.history.find((sample) => sample.now === now)?.program.key
    expect(key(T + 5_000 + WEATHER_PAGE_MS - 250)).toMatch(/:0$/)
    expect(key(T + 5_000 + WEATHER_PAGE_MS)).toMatch(/:1$/)
    expect(key(T + 5_000 + 2 * WEATHER_PAGE_MS)).toBe('board')
    // The window is wanted for as long as it is on air
    const onAir = h.history.filter((sample) => sample.program.key.startsWith('weather:'))
    expect(onAir.length).toBeGreaterThan(0)
    expect(onAir.every((sample) => sample.program.wantsWindow)).toBe(true)
  })

  it('does not air if the window shows just too late, then or later', () => {
    const { h, limit } = world()
    h.world.visible = false
    h.world.sessions = [asked('a', limit, T)]
    h.until(T + 9_750)
    h.world.visible = true
    h.at(T + WEATHER_ASK_GRACE_MS + 1)
    h.until(T + 120_000)
    expect(aired(h.history)).toEqual([])
    expect(h.sounds()).toEqual([])
  })

  it('airs if the window shows exactly at the edge of the grace', () => {
    const { h, limit } = world()
    h.world.visible = false
    h.world.sessions = [asked('a', limit, T)]
    h.until(T + WEATHER_ASK_GRACE_MS - 250)
    h.world.visible = true
    h.until(T + WEATHER_ASK_GRACE_MS)
    expect(aired(h.history)).toEqual([`weather:${T + WEATHER_ASK_GRACE_MS}`])
  })

  it('queues on the tick it comes when the window already shows, and starts at once', () => {
    const { h, limit } = world()
    h.until(T + 1_000)
    h.land([asked('a', limit, T + 2_000)], T + 2_000)
    expect(aired(h.history)).toEqual([`weather:${T + 2_000}`])
    expect(h.history.at(-1)?.program.sounds).toEqual([{ type: 'bed', bed: 'beat-major' }])
  })

  it('adds STORMTRACKER to the pages while a storm is in the forecast', () => {
    const { h, limit } = world(STORM_RATE, T, T)
    h.until(T + 1_000)
    h.land([asked('a', limit, T + 2_000)], T + 2_000)
    h.until(T + 2_000 + 2 * WEATHER_PAGE_MS + STORMTRACKER_MS + 2_000)
    expect(modes(h.history)).toEqual(['weather-now', 'weather-days', 'stormtracker'])
    expect(aired(h.history)).toHaveLength(1)
    const key = (now: number) => h.history.find((sample) => sample.now === now)?.program.key
    expect(key(T + 2_000 + 2 * WEATHER_PAGE_MS + STORMTRACKER_MS - 250)).toMatch(/:2$/)
    expect(key(T + 2_000 + 2 * WEATHER_PAGE_MS + STORMTRACKER_MS)).toBe('board')
  })

  it('airs nothing when the forecast has no outlook', () => {
    const h = harness(T, [session('a', { weatherAskedAt: T + 1_000 })])
    h.until(T + 60_000)
    expect(aired(h.history)).toEqual([])
    expect(h.sounds()).toEqual([])
  })

  it('airs once: more ticks with the same request bring nothing', () => {
    const { h, limit } = world()
    h.until(T + 1_000)
    h.land([asked('a', limit, T + 2_000)], T + 2_000)
    h.until(T + 120_000)
    expect(aired(h.history)).toHaveLength(1)
    expect(h.sounds().filter(({ sound }) => sound.type === 'bed')).toHaveLength(1)
  })

  it('goes by the newest request of the sessions on air, and airs one segment', () => {
    const { h, limit } = world()
    h.until(T + 1_000)
    h.land([asked('a', limit, T + 1_500), asked('b', limit, T + 2_000)], T + 2_000)
    h.until(T + 120_000)
    expect(aired(h.history)).toEqual([`weather:${T + 2_000}`])
  })

  it('adds nothing for a newer request while KLWD WEATHER is on air', () => {
    const { h, limit } = world()
    h.until(T + 1_000)
    h.land([asked('a', limit, T + 2_000)], T + 2_000)
    h.land([asked('a', limit, T + 2_000), asked('b', limit, T + 8_000)], T + 8_000)
    h.until(T + 120_000)
    expect(aired(h.history)).toHaveLength(1)
  })

  it('adds nothing for a newer request while KLWD WEATHER waits', () => {
    const { h, limit } = world()
    h.world.windowOut = false
    h.until(T + 1_000)
    h.land([asked('a', limit, T + 2_000)], T + 2_000)
    h.land([asked('a', limit, T + 2_000), asked('b', limit, T + 4_000)], T + 4_000)
    expect(aired(h.history)).toEqual([])
    h.world.windowOut = true
    h.until(T + 120_000)
    expect(aired(h.history)).toHaveLength(1)
  })

  it('is dropped when the window hides after it queued, and does not come back', () => {
    const { h, limit } = world()
    h.world.windowOut = false
    h.until(T + 1_000)
    h.land([asked('a', limit, T + 2_000)], T + 2_000)
    h.world.visible = false
    h.until(T + 4_000)
    h.world.visible = true
    h.world.windowOut = true
    h.until(T + 120_000)
    expect(aired(h.history)).toEqual([])
  })

  it('brings a minimized window out, and airs once it is out', () => {
    const { h, limit } = world()
    h.world.windowOut = false
    h.until(T + 1_000)
    h.land([asked('a', limit, T + 2_000)], T + 2_000)
    h.until(T + 20_000)
    expect(aired(h.history)).toEqual([])
    expect(h.history.at(-1)?.program.wantsWindow).toBe(true)
    h.world.windowOut = true
    h.until(T + 20_250)
    expect(aired(h.history)).toEqual([`weather:${T + 20_250}`])
    h.until(T + 120_000)
    expect(aired(h.history)).toHaveLength(1)
  })

  it('never airs a request already older than the grace when a director first sees it', () => {
    const { h, limit } = world()
    h.world.sessions = [asked('a', limit, T - 11_000)]
    h.until(T + 120_000)
    expect(aired(h.history)).toEqual([])
  })

  it('waits for a segment on air, then airs after the gap', () => {
    const { h, limit } = world()
    h.until(T + 1_000)
    const landed = story('a:1', 'needs-input', T + 2_000, { command: 'npm install', quote: 'Install dependencies' })
    h.land([session('a', { limits: [limit], state: 'needs-input', stateAt: T + 2_000, stories: [landed], weatherAskedAt: T + 3_000 })], T + 3_000)
    h.until(T + 120_000)
    const keys = h.history.map((sample) => sample.program.key)
    const lastStory = keys.findLastIndex((key) => key.startsWith('story:'))
    const firstWeather = keys.findIndex((key) => key.startsWith('weather:'))
    expect(lastStory).toBeGreaterThan(-1)
    expect(firstWeather).toBeGreaterThan(lastStory)
    // The story's own ids are the first segment; the weather starts when the gap has passed
    const endedAt = (h.history[lastStory]?.now ?? 0) + 250
    expect((h.history[firstWeather]?.now ?? 0) - endedAt).toBeGreaterThanOrEqual(GAP_MS - 500)
    expect(aired(h.history)).toHaveLength(1)
  })
})

describe('a request and the quarter hours', () => {
  it('is not followed by the quarter hour’s turn to the same page', () => {
    const { h, limit } = world(0.5, local(13, 10, 14, 0))
    h.until(local(13, 10, 14, 40))
    h.land([asked('a', limit, local(13, 10, 14, 50))], local(13, 10, 14, 50))
    expect(aired(h.history)).toHaveLength(1)
    h.until(local(13, 10, 16, 0))
    // The :15 began while it was on air, and nothing turns the board after it
    expect(h.history.some((sample) => sample.program.scene.forecast !== undefined)).toBe(false)
    expect(aired(h.history)).toHaveLength(1)
  })
})

describe('a request stamped ahead of the clock', () => {
  it('is no request, and does not hold back a real one a second later', () => {
    const { h, limit } = world()
    h.until(T + 1_000)
    h.land([asked('a', limit, T + 61_000)], T + 1_250)
    h.until(T + 2_000)
    expect(aired(h.history)).toEqual([])
    h.land([asked('a', limit, T + 61_000), asked('b', limit, T + 2_250)], T + 2_250)
    // Up to a few seconds before its stamp, when it would count as made
    h.until(T + 50_000)
    expect(aired(h.history)).toEqual([`weather:${T + 2_250}`])
  })
})

describe('nothing else waits for the window', () => {
  it('a story that lands while the window is hidden never airs when it shows a second later', () => {
    const { h, limit } = world()
    h.until(T + 1_000)
    h.world.visible = false
    const landed = story('a:1', 'needs-input', T + 2_000, { command: 'npm install', quote: 'Install dependencies' })
    h.land([session('a', { limits: [limit], state: 'needs-input', stateAt: T + 2_000, stories: [landed] })], T + 2_000)
    h.until(T + 3_000)
    h.world.visible = true
    h.until(T + 60_000)
    expect(h.history.some((sample) => sample.program.key.startsWith('story:'))).toBe(false)
  })

  it('a quarter hour that begins while the window is hidden gives no turn when it shows a second later', () => {
    const { h } = world(0.5, local(13, 10, 29, 40))
    h.until(local(13, 10, 29, 50))
    h.world.visible = false
    h.until(local(13, 10, 30, 0))
    h.world.visible = true
    h.until(local(13, 10, 30, 1))
    h.until(local(13, 10, 30, 30))
    expect(h.history.some((sample) => sample.program.scene.forecast !== undefined)).toBe(false)
  })

  it('a STORM WARNING that comes due while the window is hidden never airs when it shows a second later', () => {
    const { h } = world(STORM_RATE)
    h.world.visible = false
    h.until(T + 1_000)
    h.world.visible = true
    h.until(T + 2_000)
    h.until(T + 120_000)
    expect(h.history.some((sample) => sample.program.key.startsWith('warning:'))).toBe(false)
  })

  it('the report on the hour is skipped when the window shows a second after the hour', () => {
    const { h } = world(0.5, local(13, 10, 59, 30))
    h.world.visible = false
    h.until(local(13, 11, 0, 0))
    h.world.visible = true
    h.until(local(13, 11, 1, 0))
    h.until(local(13, 11, 30, 0))
    expect(h.history.some((sample) => sample.program.key.startsWith('hour:'))).toBe(false)
  })
})
