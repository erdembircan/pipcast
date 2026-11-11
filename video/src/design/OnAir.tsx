// What KLWD airs at one moment, drawn with the design system's own parts the
// way its Broadcast draws them, but from a time instead of timers: the opens
// and outros take their one progress value, the crawl its offset, Clawd his
// pose, and the CSS motion its custom properties (DesignStyles). `t` is the
// seconds since this scene came on air, `clock` the station's running time,
// which keeps the crawl and the ring's signal going across cuts.
import { useEffect, useLayoutEffect, useRef } from 'react'
import { continueRender, delayRender } from 'remotion'
import type { CSSProperties } from 'react'

import { clawdFrame } from './clawd.ts'
import type { ClawdAct } from './clawd.ts'
import { CRAWL_SPEED, leave, power, signalWave, slide, sweep } from './motion.ts'
import { PipNews } from './pipnews.ts'
import type { Scene, TickerItem } from './pipnews.ts'
import { StormTracker } from './StormTracker.tsx'

const { Backdrop, TopBand, Ticker, SessionBoard, Stinger, Ident, NewsDesk, OTSBox, LowerThird, HourReview, WeatherNow, WeatherDays, AlertOpen } = PipNews

const STAGE: CSSProperties = { position: 'absolute', left: 0, top: 0, width: 960, height: 540 }

/** The opens and outros, in seconds, as the design system times them. */
export const STINGER_S = 1.4
export const STINGER_OUTRO_S = 1.2
export const IDENT_S = 7.5
export const IDENT_OUTRO_S = 1.4
export const ALERT_S = 1.9
export const ALERT_OUTRO_S = 1.4

/**
 * WEATHER ALERT, its open and its outro: their motion is the stylesheet's
 * keyframes, which play under .pn-anim. The video plays them too, but holds
 * each one paused at the scene's own time, so a frame is the same picture
 * however it is rendered.
 */
function Alert({ t, outro }: { t: number; outro: boolean }) {
  const ref = useRef<HTMLDivElement>(null)
  const hold = () => {
    const el = ref.current
    if (!el) return
    for (const a of el.getAnimations({ subtree: true })) {
      a.pause()
      a.currentTime = Math.max(0, t) * 1000
    }
  }
  useLayoutEffect(hold)
  // A render that starts in the middle of the open draws its first frame before the
  // chrome words have their animations: once the fonts are in and a frame has passed,
  // hold them all again before the frame is taken
  useEffect(() => {
    const handle = delayRender('WEATHER ALERT holding its motion')
    let raf = 0
    void document.fonts.ready.then(() => {
      raf = requestAnimationFrame(() => {
        hold()
        continueRender(handle)
      })
    })
    return () => {
      cancelAnimationFrame(raf)
      continueRender(handle)
    }
  })
  const progress = clamp01(t / (outro ? ALERT_OUTRO_S : 1.4))
  return (
    <div ref={ref} className="pn-anim" style={STAGE}>
      <AlertOpen outro={outro} progress={progress} />
    </div>
  )
}

const clamp01 = (x: number) => (x < 0 ? 0 : x > 1 ? 1 : x)

function textOf(item: TickerItem): string {
  return typeof item === 'string' ? item : `${item.lead ?? ''} ${item.text}`
}

/** The crawl, laid out as a static track long enough for its run, moved by its offset. */
export function Crawl({ items, time, label, seconds }: { items: TickerItem[]; time?: string; label?: string; seconds: number }) {
  const offset = Math.max(0, seconds) * CRAWL_SPEED
  // A generous estimate of one pass, so the track never runs out on screen
  const pass = items.reduce((sum, item) => sum + textOf(item).length * 17 + 60, 0)
  const passes = Math.max(2, Math.ceil((offset + 1400) / Math.max(pass, 200)) + 1)
  const laid: TickerItem[] = []
  for (let i = 0; i < passes; i += 1) {
    laid.push(...items)
  }
  return <Ticker items={laid} time={time} label={label} offset={offset} />
}

export interface OnAirProps {
  scene: Scene
  /** Seconds since this scene came on air */
  t: number
  /** Seconds since the crawl's items came on air */
  crawl?: number
  /** The station's running time, for the ring's signal */
  clock: number
  /** Where an ident starts, as a share of its run: 0 is five seconds before the hour */
  identFrom?: number
  /** The board with a forecast: when, in the scene's seconds, it turns from the listing to the forecast, as at a quarter hour */
  forecastAt?: number
}

export function OnAir({ scene, t, crawl, clock, identFrom = 0, forecastAt }: OnAirProps) {
  const mode = scene.mode ?? 'board'
  const ms = t * 1000
  const ev = scene.event ?? { kind: 'needs-input' as const }
  const kind = ev.kind ?? 'needs-input'
  const vars: Record<string, string | number> = {}
  const parts: JSX.Element[] = []
  const crawlSeconds = crawl ?? t

  // The backdrop's signal at the station's clock. Backdrop draws its waves
  // with `animate`, but nothing plays them in the video, which has no
  // pn-anim: DesignStyles puts each one where pn-signal has it now.
  for (let i = 0; i < 3; i += 1) {
    const wave = signalWave(clock * 1000 + i * 3000)
    vars[`--rv-wave-${i + 1}-s`] = wave.scale
    vars[`--rv-wave-${i + 1}-o`] = wave.o
  }

  if (mode === 'desk') {
    const line = slide(ms, 0)
    const strap = slide(ms, 150)
    const tube = power(ms)
    const act = (scene.act ?? 'idle') as ClawdAct
    const pose = clawdFrame(act, t)
    vars['--rv-l3-x'] = `${line.x}%`
    vars['--rv-l3-o'] = line.o
    vars['--rv-strap-x'] = `${strap.x}%`
    vars['--rv-strap-o'] = strap.o
    vars['--rv-sweep'] = `${sweep(ms)}%`
    vars['--rv-ots-sy'] = tube.scaleY
    vars['--rv-ots-b'] = tube.brightness
    vars['--rv-bob'] = `${pose.bob}px`
    parts.push(
      <NewsDesk key="desk" kind={kind} act={act} time={scene.clock} eyes={pose.eyes} arms={pose.arms} facing={pose.facing} />,
      <OTSBox key="ots" kind={kind} label={ev.label} command={ev.command} quote={ev.quote} figure={ev.figure} sub={ev.sub} foot={ev.foot} />,
      <LowerThird key="l3" kind={kind} headline={scene.headline} strap={scene.strap} session={ev.session} project={ev.project} />,
    )
  } else if (mode === 'stinger') {
    parts.push(<Stinger key="st" kind={kind} progress={clamp01(t / STINGER_S)} />)
  } else if (mode === 'alert') {
    parts.push(<Alert key="alert" t={t} outro={false} />)
  } else if (mode === 'weather-now' || mode === 'weather-days') {
    const Page = mode === 'weather-now' ? WeatherNow : WeatherDays
    parts.push(<Backdrop key="backdrop" animate />, <Page key="wx" weather={scene.weather} />)
  } else if (mode === 'stormtracker') {
    parts.push(<Backdrop key="backdrop" animate />, <StormTracker key="wx" weather={scene.weather!} t={t} />)
  } else if (mode === 'outro') {
    const back = scene.board ?? { mode: 'board' }
    parts.push(
      <div key="under" className="pn-board-under" style={{ ...STAGE, zIndex: 0 }}>
        <Backdrop animate />
        <SessionBoard sessions={back.sessions} limits={back.limits} />
        <Crawl items={back.ticker ?? []} time={back.clock} seconds={crawlSeconds} />
      </div>,
      scene.open === 'hour' ? (
        <Ident key="id-out" outro hour={scene.hour} progress={clamp01(t / IDENT_OUTRO_S)} />
      ) : scene.open === 'alert' ? (
        <Alert key="alert-out" t={t} outro />
      ) : (
        <Stinger key="st-out" outro progress={clamp01(t / STINGER_OUTRO_S)} />
      ),
    )
  } else if (mode === 'ident') {
    parts.push(<Ident key="id" hour={scene.hour} progress={clamp01(identFrom + t / IDENT_S)} />)
  } else if (mode === 'review') {
    parts.push(<Backdrop key="backdrop" animate />, <HourReview key="rv" rows={scene.rows} span={scene.span} label={scene.label} />)
  } else if (scene.forecast && forecastAt !== undefined) {
    // The board turning to the forecast: the listing leaves to the right (pn-turn-leave) as the forecast comes in from the left (pn-slide)
    const turn = (t - forecastAt) * 1000
    const out = leave(turn)
    const inn = slide(turn)
    parts.push(<Backdrop key="backdrop" animate />)
    if (turn < 420) {
      parts.push(
        <div key="listing" style={{ ...STAGE, transform: `translateX(${out.x}px)`, opacity: out.o }}>
          <SessionBoard sessions={scene.sessions} limits={scene.limits} />
        </div>,
      )
    }
    if (turn > 0) {
      parts.push(
        <div key="forecast" style={{ ...STAGE, transform: `translateX(${inn.x * 0.4}%)`, opacity: inn.o }}>
          <SessionBoard sessions={scene.sessions} limits={scene.limits} forecast={scene.forecast} />
        </div>,
      )
    }
  } else {
    parts.push(<Backdrop key="backdrop" animate />, <SessionBoard key="board" sessions={scene.sessions} limits={scene.limits} forecast={scene.forecast} />)
  }
  parts.push(<TopBand key="top" />)
  if (mode !== 'stinger' && mode !== 'outro' && mode !== 'ident' && mode !== 'alert') {
    parts.push(<Crawl key="tick" items={scene.ticker ?? []} time={scene.clock} label={scene.tickerLabel} seconds={crawlSeconds} />)
  }
  const breaking = mode === 'stinger' || mode === 'alert' || (mode === 'outro' && scene.open !== 'hour')
  return (
    <div className={`rv-air pn-broadcast pn-mode-${mode}${breaking ? ' pn-k-breaking' : ''}`} style={{ ...STAGE, ...(vars as CSSProperties) }}>
      {parts}
    </div>
  )
}
