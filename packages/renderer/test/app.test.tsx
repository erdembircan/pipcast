// @vitest-environment jsdom
import '../src/react-global.ts'

import { act } from 'react'
import { createRoot } from 'react-dom/client'
import type { Root } from 'react-dom/client'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import type { Program } from '@pipcast/director'

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

  function snapshot(sessions: unknown[], extra: Record<string, unknown> = {}) {
    return { type: 'snapshot', now: Date.now(), visible: true, sessions, lastReportAt: null, ...extra }
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
    }
    act(() => root.render(<App reducedMotion={false} createSource={() => ({ tick: () => program })} />))
    act(() => receive(snapshot([record({})])))
    act(() => {
      vi.advanceTimersByTime(250)
    })
    expect(postMessage).toHaveBeenCalledWith({ type: 'cue', jingle: 'breaking' })
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
