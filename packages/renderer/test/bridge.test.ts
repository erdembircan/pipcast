// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest'

import { installBridge, post, receive, subscribe } from '../src/bridge.ts'

interface Host {
  pipcast?: { receive(message: unknown): void }
  webkit?: unknown
}

const host = window as unknown as Host

afterEach(() => {
  delete host.webkit
  delete host.pipcast
})

describe('receive', () => {
  it('dispatches a snapshot and a still to the listeners', () => {
    const listener = vi.fn()
    const stop = subscribe(listener)
    const snapshot = { type: 'snapshot', now: 1, visible: true, sessions: [], lastReportAt: null }
    const still = { type: 'still', input: { scene: { mode: 'board' } } }
    receive(snapshot)
    receive(still)
    expect(listener.mock.calls).toEqual([[snapshot], [still]])
    stop()
  })

  it('takes a message as JSON text too', () => {
    const listener = vi.fn()
    const stop = subscribe(listener)
    receive('{"type":"snapshot","now":2,"visible":false,"sessions":[],"lastReportAt":null}')
    expect(listener).toHaveBeenCalledTimes(1)
    expect(listener.mock.calls[0]?.[0]).toMatchObject({ type: 'snapshot', now: 2 })
    stop()
  })

  it('ignores anything else', () => {
    const listener = vi.fn()
    const stop = subscribe(listener)
    receive({ type: 'ready' })
    receive({ type: 'nonsense' })
    receive({ now: 1 })
    receive('not json')
    receive(null)
    receive(42)
    expect(listener).not.toHaveBeenCalled()
    stop()
  })

  it('stops calling a listener that unsubscribed', () => {
    const listener = vi.fn()
    subscribe(listener)()
    receive({ type: 'snapshot', now: 1, visible: true, sessions: [], lastReportAt: null })
    expect(listener).not.toHaveBeenCalled()
  })

  it('holds a still that arrives before anything listens, for the first listener', () => {
    const still = { type: 'still', input: { scene: { mode: 'board' } } }
    receive({ type: 'snapshot', now: 1, visible: true, sessions: [], lastReportAt: null })
    receive(still)
    const first = vi.fn()
    const stopFirst = subscribe(first)
    expect(first.mock.calls).toEqual([[still]])
    stopFirst()
    const second = vi.fn()
    subscribe(second)()
    expect(second).not.toHaveBeenCalled()
  })

  it('is what the station calls on window.pipcast', () => {
    installBridge()
    const listener = vi.fn()
    const stop = subscribe(listener)
    host.pipcast?.receive({ type: 'still', input: {} })
    expect(listener).toHaveBeenCalledTimes(1)
    stop()
  })
})

describe('post', () => {
  it('does nothing without the host', () => {
    expect(() => post({ type: 'ready' })).not.toThrow()
  })

  it('sends the message to the host when there is one', () => {
    const postMessage = vi.fn()
    host.webkit = { messageHandlers: { pipcast: { postMessage } } }
    post({ type: 'cue', jingle: 'breaking' })
    post({ type: 'reported', at: 5 })
    expect(postMessage.mock.calls).toEqual([[{ type: 'cue', jingle: 'breaking' }], [{ type: 'reported', at: 5 }]])
  })
})
