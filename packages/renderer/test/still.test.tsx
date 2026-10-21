// @vitest-environment jsdom
// react-global first: the design system's bundle reads window.React as it loads
import '../src/react-global.ts'

import { act } from 'react'
import { createRoot } from 'react-dom/client'
import type { Root } from 'react-dom/client'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import type { StillInput } from '@pipcast/contract'

import { receive } from '../src/bridge.ts'
import { decodeStillInput, StillPage, stillScene } from '../src/still.tsx'

const flag = globalThis as unknown as { IS_REACT_ACT_ENVIRONMENT: boolean }
flag.IS_REACT_ACT_ENVIRONMENT = true

const host = window as unknown as { webkit?: unknown }
const NOW = Date.UTC(2026, 9, 21, 14, 33)

function encode(input: StillInput): string {
  const bytes = new TextEncoder().encode(JSON.stringify(input))
  const base64 = btoa(String.fromCharCode(...bytes))
  return `#still=${base64.replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')}`
}

describe('decodeStillInput', () => {
  it('reads the fragment, text outside ASCII included', () => {
    const input = { scene: { mode: 'desk', event: { kind: 'ready', figure: '+182 −40' } } }
    expect(decodeStillInput(encode(input))).toEqual(input)
  })

  it('returns null for a fragment with no input', () => {
    expect(decodeStillInput('#still')).toBeNull()
    expect(decodeStillInput('')).toBeNull()
  })
})

describe('stillScene', () => {
  it('draws the scene it is given as it is', () => {
    const scene = { mode: 'stinger', progress: 0.74 }
    expect(stillScene({ scene })).toBe(scene)
  })

  it('draws what the director airs at `at`', () => {
    const story = { id: 'a:1', kind: 'needs-input' as const, at: NOW - 10_000, command: 'npm install', quote: 'Install dependencies' }
    const snapshot = {
      now: NOW,
      visible: true,
      lastReportAt: null,
      sessions: [
        {
          v: 1 as const,
          id: 'a',
          title: 'Fix it',
          project: 'shop',
          state: 'needs-input' as const,
          stateAt: story.at,
          tunedInAt: 0,
          checkedInAt: NOW,
          stories: [story],
          activity: [],
          hours: [],
        },
      ],
    }
    expect(stillScene({ snapshot }).mode).toBe('stinger')
    expect(stillScene({ snapshot, at: NOW + 2000 })).toMatchObject({
      mode: 'desk',
      event: { command: 'npm install', foot: 'Waiting 0:12' },
    })
  })

  it('needs a scene or a snapshot', () => {
    expect(() => stillScene({})).toThrow()
  })
})

describe('the still page', () => {
  let container: HTMLElement
  let root: Root
  const postMessage = vi.fn()

  beforeEach(() => {
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
    window.location.hash = ''
  })

  it('posts rendered after the station sends a still', async () => {
    window.location.hash = '#still'
    act(() => root.render(<StillPage />))
    expect(postMessage).not.toHaveBeenCalled()
    expect(container.querySelector('.pn-broadcast')).toBeNull()

    act(() => receive({ type: 'still', input: { scene: { mode: 'board', clock: '14:32', sessions: [], ticker: [] } } }))
    expect(container.querySelector('.pn-mode-board')).not.toBeNull()
    await vi.waitFor(() => expect(postMessage).toHaveBeenCalledWith({ type: 'rendered' }))
    expect(postMessage).toHaveBeenCalledTimes(1)
  })

  it('draws the input in its fragment without waiting', async () => {
    window.location.hash = encode({ scene: { mode: 'ident', hour: '15:00', progress: 1 } })
    act(() => root.render(<StillPage />))
    expect(container.querySelector('.pn-mode-ident')).not.toBeNull()
    await vi.waitFor(() => expect(postMessage).toHaveBeenCalledWith({ type: 'rendered' }))
  })
})
