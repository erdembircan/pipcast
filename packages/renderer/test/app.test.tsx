// @vitest-environment jsdom
import '../src/react-global.ts'

import { act } from 'react'
import { createRoot } from 'react-dom/client'
import type { Root } from 'react-dom/client'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import type { DirectorOptions, Program } from '@pipcast/director'

import { App } from '../src/App.tsx'
import { receive } from '../src/bridge.ts'

const flag = globalThis as unknown as { IS_REACT_ACT_ENVIRONMENT: boolean }
flag.IS_REACT_ACT_ENVIRONMENT = true

const host = window as unknown as { webkit?: unknown }
const NOW = Date.UTC(2026, 9, 21, 14, 33)

describe('the live page', () => {
  let container: HTMLElement
  let root: Root
  const postMessage = vi.fn()

  beforeEach(() => {
    vi.useFakeTimers()
    vi.setSystemTime(NOW)
    postMessage.mockClear()
    host.webkit = { messageHandlers: { pipcast: { postMessage } } }
    container = document.createElement('div')
    document.body.append(container)
    root = createRoot(container)
  })

  afterEach(() => {
    act(() => root.unmount())
    container.remove()
    delete host.webkit
    vi.useRealTimers()
  })

  // The station's counter of changes to the records rises with each snapshot here, as each one differs
  let records = 0

  function snapshot(sessions: unknown[], extra: Record<string, unknown> = {}) {
    records += 1
    return { type: 'snapshot', now: Date.now(), visible: true, sessions, lastReportAt: null, records, ...extra }
  }

  function record(extra: Record<string, unknown>) {
    return {
      v: 1,
      id: 'a',
      title: 'Fix it',
      project: 'shop',
      state: 'working',
      stateAt: NOW,
      tunedInAt: 0,
      checkedInAt: NOW,
      stories: [],
      activity: [],
      hours: [],
      ...extra,
    }
  }

  it('draws nothing until the first snapshot, then the board', () => {
    act(() => root.render(<App reducedMotion={false} />))
    expect(container.querySelector('.pn-broadcast')).toBeNull()
    act(() => receive(snapshot([record({})])))
    act(() => {
      vi.advanceTimersByTime(250)
    })
    expect(container.querySelector('.pn-mode-board')).not.toBeNull()
  })

  it('posts the cue of a story as it airs, and then the desk follows', () => {
    act(() => root.render(<App reducedMotion={false} />))
    act(() => receive(snapshot([record({})])))
    act(() => {
      vi.advanceTimersByTime(250)
    })
    const story = { id: 'a:1', kind: 'needs-input', at: Date.now(), command: 'npm install', quote: 'Install dependencies' }
    act(() => receive(snapshot([record({ state: 'needs-input', stateAt: story.at, stories: [story] })])))
    act(() => {
      vi.advanceTimersByTime(250)
    })
    expect(postMessage).toHaveBeenCalledWith({ type: 'cue', jingle: 'breaking' })
    expect(container.querySelector('.pn-mode-stinger')).not.toBeNull()
    act(() => {
      vi.advanceTimersByTime(2000)
    })
    expect(container.querySelector('.pn-mode-desk')).not.toBeNull()
    expect(container.textContent).toContain('npm install')
  })

  it('takes what airs from the source it is given', () => {
    const program: Program = {
      scene: { mode: 'board' },
      key: 'board',
      sounds: [{ type: 'cue', jingle: 'breaking' }],
      reported: null,
      wantsWindow: false,
      weather: null,
    }
    act(() => root.render(<App reducedMotion={false} createSource={() => ({ tick: () => program })} />))
    act(() => receive(snapshot([record({})])))
    act(() => {
      vi.advanceTimersByTime(250)
    })
    expect(postMessage).toHaveBeenCalledWith({ type: 'cue', jingle: 'breaking' })
  })

  it('tells the station the weather desk’s memory when the director has some to keep', () => {
    const memory = { v: 1 as const, resetsAt: 1_800_000_000_000, points: [[1_799_000_000_000, 41.5]] as [number, number][], warnedAt: null }
    const program: Program = { scene: { mode: 'board' }, key: 'board', sounds: [], reported: null, wantsWindow: false, weather: memory }
    act(() => root.render(<App reducedMotion={false} createSource={() => ({ tick: () => program })} />))
    act(() => receive(snapshot([record({})])))
    act(() => {
      vi.advanceTimersByTime(250)
    })
    expect(postMessage).toHaveBeenCalledWith({ type: 'weather', memory })
  })

  describe('the weather memory', () => {
    const memory = { v: 1 as const, resetsAt: 1_800_000_000_000, points: [[1_799_000_000_000, 41.5]] as [number, number][], warnedAt: null }
    const newer = { ...memory, points: [...memory.points, [1_799_003_600_000, 42.5]] as [number, number][] }
    const quiet: Program = { scene: { mode: 'board' }, key: 'board', sounds: [], reported: null, wantsWindow: false, weather: null }
    const taken = () => postMessage.mock.calls.filter((call) => (call[0] as { type: string }).type === 'weather-taken')

    // A source that airs what `program` is, and keeps the options it was made with
    function source(program: () => Program) {
      const made: DirectorOptions[] = []
      return {
        made,
        create: (options: DirectorOptions) => {
          made.push(options)
          return { tick: () => program() }
        },
      }
    }

    it('says it has the memory once a snapshot carries it, and not before', () => {
      const { create } = source(() => quiet)
      act(() => root.render(<App reducedMotion={false} createSource={create} />))
      act(() => receive(snapshot([record({})])))
      expect(taken()).toHaveLength(0)
      act(() => receive(snapshot([record({})], { weather: null })))
      expect(taken()).toHaveLength(1)
    })

    it('leaves the first director to take the memory from the snapshot that carries it', () => {
      const { create, made } = source(() => quiet)
      act(() => root.render(<App reducedMotion={false} createSource={create} />))
      act(() => receive(snapshot([record({})], { weather: memory })))
      expect(made).toStrictEqual([{ reducedMotion: false }])
    })

    it('hands the memory it took to a director made later, as when reduced motion changes', () => {
      const { create, made } = source(() => quiet)
      act(() => root.render(<App reducedMotion={false} createSource={create} />))
      act(() => receive(snapshot([record({})], { weather: memory })))
      act(() => root.render(<App reducedMotion createSource={create} />))
      expect(made[made.length - 1]).toStrictEqual({ reducedMotion: true, weather: memory })
    })

    it('hands it that there is no memory too', () => {
      const { create, made } = source(() => quiet)
      act(() => root.render(<App reducedMotion={false} createSource={create} />))
      act(() => receive(snapshot([record({})], { weather: null })))
      act(() => root.render(<App reducedMotion createSource={create} />))
      expect(made[made.length - 1]).toStrictEqual({ reducedMotion: true, weather: null })
    })

    it('hands a director made later the memory the last director posted, not the one the station first sent', () => {
      let program = quiet
      const { create, made } = source(() => program)
      act(() => root.render(<App reducedMotion={false} createSource={create} />))
      act(() => receive(snapshot([record({})], { weather: memory })))
      program = { ...quiet, weather: newer }
      act(() => {
        vi.advanceTimersByTime(250)
      })
      expect(postMessage).toHaveBeenCalledWith({ type: 'weather', memory: newer })
      act(() => root.render(<App reducedMotion createSource={create} />))
      expect(made[made.length - 1]).toStrictEqual({ reducedMotion: true, weather: newer })
    })

    it('keeps what it holds when a snapshot already on its way carries an older memory', () => {
      const { create, made } = source(() => ({ ...quiet, weather: newer }))
      act(() => root.render(<App reducedMotion={false} createSource={create} />))
      act(() => receive(snapshot([record({})], { weather: memory })))
      act(() => {
        vi.advanceTimersByTime(250)
      })
      act(() => receive(snapshot([record({})], { weather: memory })))
      act(() => root.render(<App reducedMotion createSource={create} />))
      expect(made[made.length - 1]).toStrictEqual({ reducedMotion: true, weather: newer })
    })
  })

  it('does not air a story that landed while the window was hidden, when the window shows before the timer ticks', () => {
    act(() => root.render(<App reducedMotion={false} />))
    const story = { id: 'a:1', kind: 'needs-input', at: Date.now(), command: 'npm install', quote: 'Install dependencies' }
    const sessions = [record({ state: 'needs-input', stateAt: story.at, stories: [story] })]
    // No timer runs between the two snapshots, as when a hidden page's timers are late
    act(() => receive({ ...snapshot(sessions), visible: false }))
    act(() => receive(snapshot(sessions)))
    act(() => {
      vi.advanceTimersByTime(5000)
    })
    expect(postMessage).not.toHaveBeenCalledWith({ type: 'cue', jingle: 'breaking' })
    expect(container.querySelector('.pn-mode-stinger')).toBeNull()
    expect(container.querySelector('.pn-mode-board')).not.toBeNull()
  })

  it('tells the station when a segment needs the window, once for each change', () => {
    const windowCalls = () => postMessage.mock.calls.filter((call) => (call[0] as { type: string }).type === 'window')
    act(() => root.render(<App reducedMotion={false} />))
    const story = { id: 'a:1', kind: 'needs-input', at: NOW, command: 'npm install' }
    act(() =>
      receive(
        snapshot([record({ state: 'needs-input', stateAt: NOW, stories: [story] })], { windowOut: false }),
      ),
    )
    act(() => {
      vi.advanceTimersByTime(250)
    })
    expect(windowCalls()).toEqual([[{ type: 'window', wanted: true }]])
    act(() => {
      vi.advanceTimersByTime(1000)
    })
    expect(windowCalls()).toHaveLength(1)

    act(() => receive(snapshot([record({ state: 'working', stateAt: NOW, stories: [story] })], { windowOut: false })))
    act(() => {
      vi.advanceTimersByTime(250)
    })
    expect(windowCalls()).toEqual([[{ type: 'window', wanted: true }], [{ type: 'window', wanted: false }]])
  })
})
