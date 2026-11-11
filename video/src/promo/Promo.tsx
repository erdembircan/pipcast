// KLWD WEATHER's promo, a 90s station's severe-weather promo made of KLWD's
// own pieces, in one shot. Night falls on KLWD's tower from the icon and a
// storm rolls in until lightning strikes its beacon and sends out the signal;
// chrome words ask the question and name the show; KLWD's window flies out of
// the beacon into the storm and shows the forecast a part at a time, flipping
// from one to the next, each named beside it with a line on what it does;
// STORM WARNING breaks in on it and the camera leans into STORMTRACKER; the
// window flies home into the beacon and the storm clears into the icon's dusk
// as the camera pulls back to the icon and its name. timeline.ts has the
// running order.
import type { CSSProperties } from 'react'
import { AbsoluteFill, useCurrentFrame } from 'remotion'

import '../design/fonts.ts'
import { DesignStyles } from '../design/DesignStyles.tsx'
import { OnAir } from '../design/OnAir.tsx'
import { PipNews } from '../design/pipnews.ts'
import type { Scene } from '../design/pipnews.ts'
import { PipWindow } from '../design/PipWindow.tsx'
import { clamp01, ease, mix, seg } from '../lib/anim.ts'
import { Cards } from './Cards.tsx'
import { PromoSound } from './PromoSound.tsx'
import { CLEAR, DURATION, FEATURES, FLIP, FPS, NAME_HITS, SCENES, WINDOW } from './timeline.ts'
import { H, W, World, lightsAt } from './World.tsx'
import type { Cam } from './World.tsx'

const { samples } = PipNews

/* ------------------------------------------------------------- the camera */

interface CamKey {
  t: number
  v: Cam
  e?: (x: number) => number
}

/** The camera through its keys: still at each, moving between them */
function camAt(T: number, keys: CamKey[]): Cam {
  if (T <= keys[0]!.t) return keys[0]!.v
  for (let i = 1; i < keys.length; i += 1) {
    const b = keys[i]!
    if (T <= b.t) {
      const a = keys[i - 1]!
      const e = (b.e ?? ease.camera)(seg(T, a.t, b.t))
      // The scale moves evenly in its logarithm, so a pull back doesn't rush at its end
      return { x: mix(a.v.x, b.v.x, e), y: mix(a.v.y, b.v.y, e), s: Math.exp(mix(Math.log(a.v.s), Math.log(b.v.s), e)) }
    }
  }
  return keys[keys.length - 1]!.v
}

/** The tile at the end: the icon 520 px square, up from the middle to leave room for the name */
const TILE_PX = 520
const TILE_Y = 392

/** One camera for the whole shot */
const CAMERA: CamKey[] = [
  // The city's windows in the rain, then up the tower to its beacon
  { t: 0.3, v: { x: 512, y: 770, s: 1.95 } },
  { t: 6.6, v: { x: 512, y: 345, s: 1.75 } },
  // Back, slowly, under the words: the whole tower in the storm
  { t: 9.2, v: { x: 512, y: 345, s: 1.75 } },
  { t: 15.2, v: { x: 512, y: 420, s: 1.45 }, e: ease.inOut },
  // Over to the left as the window comes out, the tower behind the words beside it, drifting
  { t: 16.6, v: { x: 600, y: 440, s: 1.3 } },
  { t: SCENES.home - 0.4, v: { x: 640, y: 450, s: 1.36 }, e: ease.linear },
  // Back to the tower for the window's flight home, then the clearing and the pull back to the icon
  { t: SCENES.clear + 0.6, v: { x: 512, y: 500, s: 1.5 } },
  { t: CLEAR.tile, v: { x: 512, y: 560, s: 1.32 }, e: ease.linear },
  { t: CLEAR.name, v: { x: 512, y: 512 + (540 - TILE_Y) / (TILE_PX / 1024), s: TILE_PX / 1024 } },
]

/** Where the beacon is on the screen */
function beaconOn(cam: Cam) {
  return { x: W / 2 + (512 - cam.x) * cam.s, y: H / 2 + (236 - cam.y) * cam.s }
}

/* ------------------------------------------------------------- the window */

interface Pose {
  /** Its middle on the screen, its width, and its turn about the upright, in degrees */
  x: number
  y: number
  w: number
  ry: number
  o: number
}

/** At rest in the storm: left of the middle, turned towards the words beside it */
const REST: Pose = { x: 660, y: 560, w: 1060, ry: 13, o: 1 }
/** The camera leaned all the way in: the window fills the frame */
const FULL: Pose = { x: 960, y: 540, w: 1940, ry: 0, o: 1 }

function poseMix(a: Pose, b: Pose, e: number): Pose {
  return { x: mix(a.x, b.x, e), y: mix(a.y, b.y, e), w: Math.exp(mix(Math.log(a.w), Math.log(b.w), e)), ry: mix(a.ry, b.ry, e), o: mix(a.o, b.o, e) }
}

function windowPose(T: number, cam: Cam): Pose | null {
  if (T < WINDOW.out || T >= WINDOW.gone) return null
  const b = beaconOn(cam)
  const BEACON: Pose = { x: b.x, y: b.y, w: 30, ry: -75, o: 0 }
  if (T < WINDOW.landed) {
    // Out of the beacon, turning as it comes, landing with a little give
    const p = seg(T, WINDOW.out, WINDOW.landed)
    const pose = poseMix(BEACON, REST, ease.back(p))
    return { ...pose, o: clamp01(p * 4) }
  }
  if (T < WINDOW.leanIn) return REST
  if (T < WINDOW.back) {
    const into = ease.camera(seg(T, WINDOW.leanIn, WINDOW.inside))
    const outOf = ease.camera(seg(T, WINDOW.leanOut, WINDOW.back))
    return poseMix(REST, FULL, into * (1 - outOf))
  }
  if (T < WINDOW.home) return REST
  // Home into the beacon, as it came
  const p = ease.in(seg(T, WINDOW.home, WINDOW.gone))
  const pose = poseMix(REST, BEACON, p)
  return { ...pose, o: 1 - clamp01((p - 0.75) * 4) }
}

type Feature = (typeof FEATURES)[number]

function featureAt(T: number): { f: Feature; i: number } {
  let i = 0
  for (let k = 0; k < FEATURES.length; k += 1) if (T >= FEATURES[k]!.at) i = k
  return { f: FEATURES[i]!, i }
}

const BOARD: Scene = samples['board-warning']!
/** The board at a quarter hour in the same storm: the week at 72%, turning to the storm's forecast */
const QUARTER: Scene = {
  ...samples['board-forecast']!,
  limits: BOARD.limits,
  forecast: samples['weather-days-storm']!.weather,
  ticker: samples['weather-days-storm']!.ticker,
}

/** What the window shows for a part of the forecast, `t` seconds in */
function featureScene(f: Feature, t: number, T: number) {
  switch (f.scene) {
    case 'alert-outro':
      return <OnAir scene={{ mode: 'outro', open: 'alert', board: BOARD, clock: BOARD.clock }} t={t} clock={T} />
    case 'board-warning':
      return <OnAir scene={BOARD} t={t + 3} clock={T} />
    case 'board-forecast':
      return <OnAir scene={QUARTER} t={t} clock={T} forecastAt={1.4} />
    default:
      return <OnAir scene={samples[f.scene]!} t={t} clock={T} />
  }
}

/** The turn of a flip from one part to the next: 0 to 90 degrees out, then -90 to 0 in */
function flipAt(T: number): number {
  for (const f of FEATURES) {
    if ('flip' in f && f.flip === false) continue
    const d = T - f.at
    if (d > -FLIP / 2 && d < FLIP / 2) {
      const p = (d + FLIP / 2) / FLIP
      return p < 0.5 ? mix(0, 90, ease.in(p * 2)) : mix(-90, 0, ease.out((p - 0.5) * 2))
    }
  }
  return 0
}

/** KLWD's window in the storm: the product's own panel, the station on air in it, the storm's light on its glass */
function Window({ T, cam }: { T: number; cam: Cam }) {
  const pose = windowPose(T, cam)
  if (!pose) return null
  const flip = flipAt(T)
  // During a flip the part it turns away from stays on until its edge is to us
  const shownAt = flip > 0 ? T - FLIP / 2 : T
  const { f } = featureAt(shownAt)
  const t = Math.max(0, shownAt - f.at)
  const h = (pose.w * 9) / 16
  const k = pose.w / 1920
  const lights = lightsAt(T)
  const flash = Math.min(1, lights.reduce((sum, l) => sum + l.i, 0))
  // A glint across the glass as it lands and after each flip
  const glintFrom = [WINDOW.landed - 0.2, ...FEATURES.filter((x) => !('flip' in x && x.flip === false)).map((x) => x.at + FLIP / 2)]
  const g = glintFrom.map((at) => seg(T, at, at + 0.7)).find((p) => p > 0 && p < 1) ?? 0
  return (
    <div style={{ position: 'absolute', left: 0, top: 0, width: W, height: H, perspective: 2400, perspectiveOrigin: `${pose.x}px ${pose.y}px`, opacity: pose.o }}>
      <div
        style={{
          position: 'absolute',
          left: pose.x - pose.w / 2,
          top: pose.y - h / 2,
          width: pose.w,
          height: h,
          transform: `rotateY(${pose.ry + flip}deg)`,
        }}
      >
        <div style={{ position: 'absolute', left: 0, top: 0, width: 1920, height: 1080, transformOrigin: '0 0', transform: `scale(${k})` }}>
          <PipWindow width={1920} style={{ borderRadius: 40 }}>
            {featureScene(f, t, T)}
          </PipWindow>
          {/* The storm's light on the glass, and a glint crossing it */}
          <div
            style={{
              position: 'absolute',
              inset: 0,
              borderRadius: 40,
              pointerEvents: 'none',
              background: `linear-gradient(115deg, rgba(255,255,255,0) ${-30 + 160 * g}%, rgba(255,255,255,${g > 0 && g < 1 ? 0.22 : 0}) ${-15 + 160 * g}%, rgba(255,255,255,0) ${0 + 160 * g}%), linear-gradient(180deg, rgba(190,210,255,${0.1 * flash}) 0%, rgba(190,210,255,0) 60%)`,
              boxShadow: `inset 0 0 0 3px rgba(201,211,227,${0.25 + 0.4 * flash})`,
            }}
          />
        </div>
      </div>
    </div>
  )
}

/* ------------------------------------------------------------- the captions */

function ChromeLine({ word, size, gold, style }: { word: string; size: number; gold?: boolean; style?: CSSProperties }) {
  return (
    <div className={`pn-stinger-line${gold ? ' rv-gold' : ''}`} style={{ fontSize: size, ...style }}>
      <div className="pn-stinger-cast">
        <span className="pn-stinger-ink" aria-hidden="true">
          {word}
        </span>
        <span className="pn-stinger-face">{word}</span>
      </div>
    </div>
  )
}

/** Beside the window: the part's name in chrome, when it airs on a gold tag, and what it does */
function Caption({ T }: { T: number }) {
  if (T < WINDOW.landed - 0.3 || T >= WINDOW.home) return null
  const { f, i } = featureAt(T)
  if (!f.name) return null
  const next = FEATURES[i + 1]
  const until = Math.min(next ? next.at : WINDOW.home, WINDOW.home)
  const from = i === 0 ? WINDOW.landed - 0.1 : f.at + ('flip' in f && f.flip === false ? 0.1 : FLIP / 2)
  const t = T - from
  // Out of the way while the camera is leaned into STORMTRACKER
  const lean = ease.inOut(seg(T, WINDOW.leanIn - 0.4, WINDOW.leanIn + 0.2)) * (1 - ease.inOut(seg(T, WINDOW.back - 0.2, WINDOW.back + 0.3)))
  const gone = ease.in(seg(T, until - 0.4, until))
  const size = Math.min(104, Math.floor(560 / (Math.max(...f.name.map((n) => n.length)) * 0.74)))
  const breaking = f.scene === 'alert' || f.scene === 'stormtracker' || f.scene === 'board-warning'
  return (
    <div style={{ position: 'absolute', left: 1268, top: 250, width: 600, opacity: 1 - lean }}>
      {f.name.map((word, n) => {
        const s = ease.out(seg(t, 0.12 * n, 0.12 * n + 0.26))
        const l = ease.in(seg(T, until - 0.45 + 0.08 * n, until - 0.05 + 0.08 * n))
        return (
          <ChromeLine
            key={word}
            word={word}
            size={size}
            gold={n === 1 && !breaking}
            style={{ opacity: s * (1 - l), transform: `translateX(${mix(140, 0, s) + mix(0, 160, l)}px) scale(${mix(1.3, 1, s)})`, transformOrigin: '0 50%', justifyContent: 'start' }}
          />
        )
      })}
      {(() => {
        const s = ease.out(seg(t, 0.4, 0.86))
        const o = s * (1 - gone)
        return (
          <div style={{ marginTop: 26, opacity: o, transform: `translateX(${mix(-50, 0, s)}px)` }}>
            <div
              style={{
                display: 'inline-block',
                padding: '9px 24px 10px 26px',
                transform: 'skewX(-12deg)',
                background: breaking ? 'linear-gradient(180deg, #ff5a4f 0%, #c4170e 55%, #5c070c 100%)' : 'linear-gradient(180deg, #ffe08a 0%, #f2b630 55%, #b97d0c 100%)',
                boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.5), 0 6px 14px rgba(0,0,0,0.45)',
              }}
            >
              <span style={{ display: 'inline-block', transform: 'skewX(12deg)', font: 'italic 900 30px/1 "Anybody", sans-serif', fontStretch: '106%', color: breaking ? '#ffffff' : '#2a1800', whiteSpace: 'pre' }}>{f.tag}</span>
            </div>
            <div
              style={{
                marginTop: 12,
                padding: '14px 20px 16px',
                background: 'rgba(6, 18, 51, 0.86)',
                borderTop: `3px solid ${breaking ? '#ff5a4f' : '#f2b630'}`,
                boxShadow: '0 10px 24px rgba(0,0,0,0.45)',
                font: '600 34px/1.22 "Archivo", sans-serif',
                color: '#ffffff',
                maxWidth: 560,
              }}
            >
              {f.line}
            </div>
          </div>
        )
      })()}
    </div>
  )
}

/* ------------------------------------------------------------- the end */

function Name({ T }: { T: number }) {
  const a = ease.out(seg(T, CLEAR.name + 0.1, CLEAR.name + 0.6))
  const b = ease.out(seg(T, NAME_HITS[3], NAME_HITS[3] + 0.6))
  const c = ease.out(seg(T, NAME_HITS[3] + 0.5, NAME_HITS[3] + 1.1))
  const g = ease.inOut(seg(T, NAME_HITS[3] + 0.2, NAME_HITS[3] + 0.9))
  const rise = (p: number): CSSProperties => ({ opacity: p, transform: `translateY(${(1 - p) * 24}px)` })
  return (
    <div style={{ position: 'absolute', left: 0, right: 0, top: TILE_Y + TILE_PX / 2 + 40, display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
      <div style={{ display: 'flex', gap: 34, ...rise(a) }}>
        {['KLWD', 'WEATHER'].map((word, i) => (
          <div key={word} className={`pn-stinger-line${i ? ' rv-gold' : ''}`} style={{ fontSize: 118 }}>
            <div className="pn-stinger-cast">
              <span className="pn-stinger-ink" aria-hidden="true">
                {word}
              </span>
              <span className="pn-stinger-face">{word}</span>
            </div>
            <span className="pn-stinger-glint" aria-hidden="true" style={{ transform: `translateX(${-163 + 320 * g}%)` }}>
              <span className="pn-stinger-shine" style={{ transform: `translateX(${163 - 320 * g}%)` }}>
                {word}
              </span>
            </span>
          </div>
        ))}
      </div>
      <div style={{ marginTop: 22, font: 'italic 800 40px/1 "Archivo", sans-serif', letterSpacing: '0.02em', color: '#ffe08a', textShadow: '0 3px 0 rgba(6,18,51,0.7)', ...rise(b) }}>
        YOUR USAGE, AS THE WEATHER · NEW IN PIPCAST
      </div>
      <div
        style={{
          marginTop: 30,
          padding: '13px 26px 14px',
          borderRadius: 12,
          background: 'rgba(6, 18, 51, 0.8)',
          boxShadow: 'inset 0 0 0 2px rgba(201, 211, 227, 0.35), 0 10px 24px rgba(0, 0, 0, 0.4)',
          font: '600 30px/1 "IBM Plex Mono", ui-monospace, Menlo, monospace',
          color: '#ffffff',
          ...rise(c),
        }}
      >
        github.com/erdembircan/pipcast
      </div>
    </div>
  )
}

/* ------------------------------------------------------------- the shot */

export function Promo() {
  const T = useCurrentFrame() / FPS
  const cam = camAt(T, CAMERA)
  const clearing = T >= SCENES.clear
  const clear = ease.inOut(seg(T, SCENES.clear + 0.4, CLEAR.tile + 0.6))
  // Rain the whole storm long, softer behind the window
  const rain = clearing
    ? 1 - ease.inOut(seg(T, SCENES.clear + 0.3, CLEAR.rainOut))
    : ease.inOut(seg(T, 0, 1.6)) * mix(1, 0.6, ease.inOut(seg(T, WINDOW.out, WINDOW.landed)))
  // Held dark under the words and behind the window, and softened behind it as a lens would
  const behind = ease.inOut(seg(T, WINDOW.out, WINDOW.landed)) * (1 - ease.inOut(seg(T, WINDOW.home, SCENES.clear)))
  const words = ease.inOut(seg(T, SCENES.cards - 0.3, SCENES.cards + 0.2)) * (1 - ease.inOut(seg(T, SCENES.show - 0.3, SCENES.show + 0.3)))
  const dim = Math.max(words * 0.72, behind * 0.55)
  // The tile's edges on the screen, once the camera pulls back to it
  const x0 = W / 2 - cam.x * cam.s
  const y0 = H / 2 - cam.y * cam.s
  const tile = clearing ? { x0, y0, x1: x0 + 1024 * cam.s, y1: y0 + 1024 * cam.s, r: 228 * cam.s } : undefined
  const shadow = ease.inOut(seg(T, CLEAR.tile, CLEAR.name))
  const fadeIn = ease.inOut(seg(T, 0, 1.2))
  const fadeOut = 1 - ease.inOut(seg(T, CLEAR.end, DURATION))
  return (
    <AbsoluteFill style={{ background: '#000000' }}>
      <DesignStyles />
      <AbsoluteFill style={{ opacity: fadeIn * fadeOut }}>
        {clearing ? <AbsoluteFill style={{ background: 'radial-gradient(ellipse 80% 80% at 50% 40%, #0b2260 0%, #061233 60%, #01030a 100%)' }} /> : null}
        {tile ? (
          <div style={{ position: 'absolute', left: tile.x0, top: tile.y0, width: tile.x1 - tile.x0, height: tile.y1 - tile.y0, borderRadius: tile.r, boxShadow: `0 30px 90px rgba(0, 0, 0, ${0.55 * shadow})` }} />
        ) : null}
        <AbsoluteFill style={{ filter: behind > 0.01 ? `blur(${3 * behind}px)` : undefined }}>
          <World T={T} cam={cam} clear={clearing ? clear : 0} rain={rain} tile={tile} dim={dim} steady={clearing} />
        </AbsoluteFill>
        <Window T={T} cam={cam} />
        <Caption T={T} />
        {T >= SCENES.cards && T < SCENES.show ? (
          <div style={{ position: 'absolute', left: 0, top: 0, width: 960, height: 540, transformOrigin: '0 0', transform: `scale(${W / 960})` }}>
            <Cards T={T} />
          </div>
        ) : null}
        {T >= CLEAR.name ? <Name T={T} /> : null}
      </AbsoluteFill>
      <PromoSound />
    </AbsoluteFill>
  )
}

