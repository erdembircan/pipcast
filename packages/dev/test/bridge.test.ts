// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest'

import { installBridge, subscribe } from '../../renderer/src/bridge.ts'
import { installDevBridge } from '../src/bridge.ts'

interface Host {
  pipcast?: { receive(message: unknown): void }
  webkit?: unknown
}

const host = window as unknown as Host

afterEach(() => {
  delete host.webkit
  delete host.pipcast
})

function receive(message: unknown): void {
  host.pipcast?.receive(message)
}

describe('installDevBridge', () => {
  it('hands the text of a cue to the page’s cue listener', () => {
    const onCue = vi.fn()
    installBridge()
    installDevBridge(onCue)
    receive({ type: 'dev', cue: '{"a":1}' })
    expect(onCue).toHaveBeenCalledWith('{"a":1}')
  })

  it('takes the message as JSON text too', () => {
    const onCue = vi.fn()
    installBridge()
    installDevBridge(onCue)
    receive(JSON.stringify({ type: 'dev', cue: '{"a":1}' }))
    expect(onCue).toHaveBeenCalledWith('{"a":1}')
  })

  it('still passes a snapshot on to the page', () => {
    const onCue = vi.fn()
    const listener = vi.fn()
    installBridge()
    installDevBridge(onCue)
    const stop = subscribe(listener)
    receive({ type: 'snapshot', now: 1, visible: true, sessions: [], lastReportAt: null })
    expect(listener).toHaveBeenCalledTimes(1)
    expect(onCue).not.toHaveBeenCalled()
    stop()
  })

  it('drops a cue that is not text', () => {
    const onCue = vi.fn()
    const listener = vi.fn()
    installBridge()
    installDevBridge(onCue)
    const stop = subscribe(listener)
    receive({ type: 'dev', cue: 5 })
    expect(onCue).not.toHaveBeenCalled()
    expect(listener).not.toHaveBeenCalled()
    stop()
  })
})
