import { useEffect, useMemo, useState } from 'react'

import type { Snapshot, StillInput } from '@pipcast/contract'
import { createDirector } from '@pipcast/director'
import type { Scene } from '@pipcast/design'

import { post, subscribe } from './bridge.ts'
import { Broadcast, Stage } from './design.ts'

const STEP_MS = 250
// How long to wait after the fonts are ready before the picture counts as drawn
const SETTLE_MS = 100

// The fragment `#still=<base64url of a StillInput as JSON>`
export function decodeStillInput(fragment: string): StillInput | null {
  const match = /^#still=([A-Za-z0-9_-]+)$/.exec(fragment)
  if (match === null || match[1] === undefined) {
    return null
  }
  const base64 = match[1].replace(/-/g, '+').replace(/_/g, '/')
  const binary = atob(base64)
  const bytes = Uint8Array.from(binary, (char) => char.charCodeAt(0))
  return JSON.parse(new TextDecoder().decode(bytes)) as StillInput
}

// The scene a still draws: the one it is given, or what the director airs at
// `at` when it runs from the snapshot's time with that snapshot
export function stillScene(input: StillInput): Scene {
  if (input.scene !== undefined) {
    return input.scene as Scene
  }
  const snapshot: Snapshot | undefined = input.snapshot
  if (snapshot === undefined) {
    throw new Error('a still needs a scene or a snapshot')
  }
  const until = input.at ?? snapshot.now
  const director = createDirector()
  let now = snapshot.now
  let program = director.tick({ now, snapshot })
  while (now < until) {
    now = Math.min(now + STEP_MS, until)
    program = director.tick({ now, snapshot })
  }
  return program.scene
}

// A timer, not animation frames: a page the system counts as hidden gets none
function settled(): Promise<void> {
  const fonts = (document as { fonts?: { ready: Promise<unknown> } }).fonts
  const ready = fonts === undefined ? Promise.resolve() : fonts.ready.then(() => undefined)
  return ready.then(() => new Promise<void>((done) => window.setTimeout(done, SETTLE_MS)))
}

export function Still({ input }: { input: StillInput | null }) {
  const scene = useMemo(() => (input === null ? null : stillScene(input)), [input])

  useEffect(() => {
    if (scene === null) {
      return undefined
    }
    let live = true
    void settled().then(() => {
      if (live) {
        post({ type: 'rendered' })
      }
    })
    return () => {
      live = false
    }
  }, [scene])

  if (scene === null) {
    return null
  }
  return (
    <Stage width={window.innerWidth}>
      <Broadcast scene={scene} />
    </Stage>
  )
}

// Takes its input from the fragment when it has one, else waits for the
// station's `still` message
export function StillPage() {
  const [input, setInput] = useState<StillInput | null>(() => decodeStillInput(window.location.hash))

  useEffect(() => {
    return subscribe((message) => {
      if (message.type === 'still') {
        setInput(message.input)
      }
    })
  }, [])

  return <Still input={input} />
}
