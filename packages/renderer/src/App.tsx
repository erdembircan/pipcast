import { useEffect, useMemo, useRef, useState } from 'react'

import type { Snapshot } from '@pipcast/contract'
import { createDirector } from '@pipcast/director'
import type { Program } from '@pipcast/director'

import { post, subscribe } from './bridge.ts'
import { Broadcast, Stage } from './design.ts'

export const TICK_MS = 250

export function prefersReducedMotion(): boolean {
  try {
    return window.matchMedia('(prefers-reduced-motion: reduce)').matches
  } catch {
    return false
  }
}

// The live page: keeps the latest snapshot, ticks the director on a timer and
// as each snapshot comes, and draws what it airs
export function App({ reducedMotion = prefersReducedMotion() }: { reducedMotion?: boolean }) {
  const director = useMemo(() => createDirector({ reducedMotion }), [reducedMotion])
  const snapshot = useRef<Snapshot | null>(null)
  const [program, setProgram] = useState<Program | null>(null)
  const [width, setWidth] = useState(window.innerWidth)

  useEffect(() => {
    const onResize = () => setWidth(window.innerWidth)
    window.addEventListener('resize', onResize)
    return () => window.removeEventListener('resize', onResize)
  }, [])

  useEffect(() => {
    const tick = () => {
      const next = director.tick({ now: Date.now(), snapshot: snapshot.current })
      for (const jingle of next.cues) {
        post({ type: 'cue', jingle })
      }
      if (next.reported !== null) {
        post({ type: 'reported', at: next.reported })
      }
      // Nothing is drawn until the station has sent its first snapshot
      if (snapshot.current !== null) {
        setProgram(next)
      }
    }
    // Each snapshot is ticked as it comes, as well as on the timer: a page the
    // system counts as hidden gets its timers late, and the director has to
    // see every snapshot the window was hidden in
    const unsubscribe = subscribe((message) => {
      if (message.type === 'snapshot') {
        snapshot.current = message
        tick()
      }
    })
    tick()
    const timer = window.setInterval(tick, TICK_MS)
    return () => {
      unsubscribe()
      window.clearInterval(timer)
    }
  }, [director])

  if (program === null) {
    return null
  }
  return (
    <Stage width={width} animate>
      <Broadcast key={program.key} scene={program.scene} animate />
    </Stage>
  )
}
