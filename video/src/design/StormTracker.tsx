// STORMTRACKER at a moment of its 13 s timeline, for the video. The design
// system's globe (PipNews.stormScene) runs itself once from when it mounts, on
// the browser's clock, and the only moment it takes is a still. Its drawing is
// a function of the time alone, so the video keeps one scene and hands it the
// time it wants: while the scene runs a frame, the clock it reads and the
// request for the next frame are the video's. The markup is the design
// system's Stormtracker, as its weatherWall lays it.
import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import { continueRender, delayRender, staticFile } from 'remotion'

import { PipNews } from './pipnews.ts'
import type { WeatherScene } from './pipnews.ts'

const W = PipNews.WEATHER

interface Scene3d {
  dispose(): void
}

type StormScene = (root: HTMLElement, options: Record<string, unknown>) => Scene3d | null

/** One scene that draws whatever moment it is handed. */
class Driven {
  private next: FrameRequestCallback | null = null
  private clock = 0
  private scene: Scene3d | null = null
  readonly loaded: Promise<void>

  constructor(root: HTMLElement, marks: unknown[], textures: string) {
    const images: HTMLImageElement[] = []
    const scene = this.within(() => {
      const Original = window.Image
      // The pictures it loads, so the video can wait for them
      window.Image = class extends Original {
        constructor(width?: number, height?: number) {
          super(width, height)
          images.push(this)
        }
      } as typeof Image
      // A canvas the renderer can read back between frames
      const getContext = HTMLCanvasElement.prototype.getContext
      HTMLCanvasElement.prototype.getContext = function (this: HTMLCanvasElement, kind: string, attrs?: Record<string, unknown>) {
        return getContext.call(this, kind as '2d', kind === 'webgl2' ? { ...attrs, preserveDrawingBuffer: true } : attrs)
      } as typeof getContext
      try {
        return (PipNews.stormScene as unknown as StormScene)(root, { textures, marks, hold: null })
      } finally {
        window.Image = Original
        HTMLCanvasElement.prototype.getContext = getContext
      }
    })
    this.scene = scene
    // Each picture's own onload comes first and hands it to the scene
    this.loaded = Promise.all(
      images.map((img) => (img.complete ? Promise.resolve() : new Promise<void>((done) => {
        img.addEventListener('load', () => done())
        img.addEventListener('error', () => done())
      }))),
    ).then(() => undefined)
  }

  /** Runs `fn` with the browser's clock and frame requests swapped for the video's. */
  private within<T>(fn: () => T): T {
    const raf = window.requestAnimationFrame
    const perf = performance.now
    window.requestAnimationFrame = (cb: FrameRequestCallback) => {
      this.next = cb
      return 1
    }
    performance.now = () => this.clock
    try {
      return fn()
    } finally {
      window.requestAnimationFrame = raf
      performance.now = perf
    }
  }

  /** Draws the timeline at `t` seconds. */
  draw(t: number) {
    const frame = this.next
    if (frame === null || this.scene === null) return
    this.next = null
    // The scene counts from the clock it read when it was made, 0
    this.within(() => {
      this.clock = t * 1000
      frame(this.clock)
    })
  }

  dispose() {
    this.scene?.dispose()
    this.scene = null
  }
}

/** The track's labels and list as the scene leaves them, with the motion the held picture drops, from the time. */
function driveLabels(root: HTMLElement, t: number) {
  const tracking = root.classList.contains('pn-wx-st3-tracking')
  const toa = root.querySelector<HTMLElement>('.pn-wx-st3-toa')
  if (toa) toa.style.opacity = tracking ? '' : '0'
  // The tag at landfall pops in, and its row blinks
  const out = root.querySelector<HTMLElement>('.pn-wx-st3-out > span')
  const hit = root.querySelector<HTMLElement>('.pn-wx-st3-hit')
  const LAND = 9.15
  if (out) {
    const p = Math.min(1, Math.max(0, (t - LAND) / 0.36))
    const e = 1 - Math.pow(1 - p, 3)
    out.style.transform = `translateX(-50%) scale(${1.5 - 0.5 * e})`
  }
  if (hit && hit.classList.contains('pn-wx-on')) {
    hit.style.opacity = Math.floor((t - 9) / 0.4) % 2 === 0 ? '1' : '0.35'
  }
  // The lens flare as the camera dives, 2.4 s from the start
  const flare = root.querySelector<HTMLElement>('.pn-wx-st3-flare')
  if (flare) {
    const p = Math.min(1, Math.max(0, t / 2.4))
    const o = p < 0.2 ? p / 0.2 : 1 - (p - 0.2) / 0.8
    const s = p < 0.2 ? 0.6 + 2 * p : 1 + 0.3 * ((p - 0.2) / 0.8)
    const x = p < 0.2 ? 0 : -60 * ((p - 0.2) / 0.8)
    flare.style.opacity = String(Math.max(0, o * (1 - p * p * 0.2)))
    flare.style.transform = `scale(${s}) translateX(${x}px)`
  }
}

export interface StormTrackerProps {
  weather: WeatherScene
  /** Seconds into the 13 s timeline */
  t: number
}

/** STORMTRACKER: the weather wall in red, the globe, its labels and TIME OF ARRIVAL. */
export function StormTracker({ weather, t }: StormTrackerProps) {
  const ref = useRef<HTMLDivElement>(null)
  const driven = useRef<Driven | null>(null)
  const [handle] = useState(() => delayRender('STORMTRACKER loading its pictures'))
  const [ready, setReady] = useState(false)
  const track = weather.track ?? { marks: [], out: '' }
  const marks = track.marks

  useEffect(() => {
    const root = ref.current
    if (!root) return undefined
    const scene = new Driven(root, marks, staticFile('textures/'))
    driven.current = scene
    let live = true
    scene.loaded.then(() => {
      if (!live) return
      setReady(true)
      continueRender(handle)
    })
    return () => {
      live = false
      scene.dispose()
      driven.current = null
    }
    // One scene for the marks it was made with
  }, [JSON.stringify(marks)])

  useLayoutEffect(() => {
    const root = ref.current
    if (!root || !ready || !driven.current) return
    driven.current.draw(Math.max(0, Math.min(13, t)))
    driveLabels(root, t)
  }, [t, ready])

  return (
    <div className="pn-wx-wall pn-k-breaking">
      <div className="pn-wx-screen">
        <div className="pn-wx-head">
          <span>{W.tracker}</span>
          {weather.until ? <small>{weather.until}</small> : null}
        </div>
        <div className="pn-wx-st3-box">
          <div ref={ref} className="pn-wx-st3 rv-st3" role="img">
            <canvas width={1680} height={612} />
            <i className="pn-wx-st3-flare" aria-hidden="true" />
            <div className="pn-wx-st3-label pn-wx-st3-now" data-at="now">
              <span>{W.start}</span>
            </div>
            {marks.map((m, i) => (
              <div key={`m${i}`} className="pn-wx-st3-label pn-wx-st3-mark" data-at={`m${i}`}>
                <span>{m.share}</span>
              </div>
            ))}
            <div className="pn-wx-st3-label pn-wx-st3-out" data-at="end">
              <span>{`${W.out} · ${track.out}`}</span>
            </div>
            <div className="pn-wx-st3-toa">
              <b>{W.arrival}</b>
              {marks.map((m, i) => (
                <span key={`r${i}`} data-row={i}>{`${m.when}   ${m.share}`}</span>
              ))}
              <span data-row="end" className="pn-wx-st3-hit">{`${track.out}   ${W.out}`}</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
