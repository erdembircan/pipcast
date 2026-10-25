// @vitest-environment jsdom
// react-global first: the design system's bundle reads window.React as it loads
import '../src/react-global.ts'
import '../src/design.ts'

import { BED_IN_MS, BED_OUT_MS } from '@pipcast/contract'
import { beforeAll, describe, expect, it } from 'vitest'

// A stand-in for the browser's OfflineAudioContext. It plays nothing and keeps
// what a score asks of it: every oscillator, filter and buffer source, each
// parameter's scheduled values, and when each source starts. Its render is
// silence as long as the context.
interface Step {
  kind: 'set' | 'exp' | 'lin'
  value: number
  time: number
}

class FakeParam {
  value = 0
  steps: Step[] = []
  setValueAtTime(value: number, time: number): FakeParam {
    this.steps.push({ kind: 'set', value, time })
    return this
  }
  exponentialRampToValueAtTime(value: number, time: number): FakeParam {
    this.steps.push({ kind: 'exp', value, time })
    return this
  }
  linearRampToValueAtTime(value: number, time: number): FakeParam {
    this.steps.push({ kind: 'lin', value, time })
    return this
  }
}

class FakeNode {
  connect<T>(target: T): T {
    return target
  }
}

class FakeOscillator extends FakeNode {
  type = 'sine'
  frequency = new FakeParam()
  detune = new FakeParam()
  startedAt = Number.NaN
  start(time: number): void {
    this.startedAt = time
  }
  stop(): void {}
}

class FakeFilter extends FakeNode {
  type = 'lowpass'
  frequency = new FakeParam()
  Q = new FakeParam()
}

class FakeSource extends FakeNode {
  buffer: unknown = null
  startedAt = Number.NaN
  start(time: number): void {
    this.startedAt = time
  }
  stop(): void {}
}

class FakeGain extends FakeNode {
  gain = new FakeParam()
}

class FakeCompressor extends FakeNode {
  threshold = new FakeParam()
  knee = new FakeParam()
  ratio = new FakeParam()
  attack = new FakeParam()
  release = new FakeParam()
}

class FakeConvolver extends FakeNode {
  buffer: unknown = null
}

interface Heard {
  oscillators: FakeOscillator[]
  filters: FakeFilter[]
  sources: FakeSource[]
}

// What the last render asked for
let heard: Heard = { oscillators: [], filters: [], sources: [] }

interface FakeBuffer {
  length: number
  getChannelData: (channel: number) => Float32Array
}

class FakeOfflineAudioContext {
  readonly destination = new FakeNode()
  readonly sampleRate: number
  readonly length: number
  constructor(channels: number, length: number, sampleRate: number) {
    this.sampleRate = sampleRate
    this.length = length
    heard = { oscillators: [], filters: [], sources: [] }
  }
  createGain(): FakeGain {
    return new FakeGain()
  }
  createDynamicsCompressor(): FakeCompressor {
    return new FakeCompressor()
  }
  createConvolver(): FakeConvolver {
    return new FakeConvolver()
  }
  createBuffer(channels: number, length: number): FakeBuffer {
    const data = Array.from({ length: channels }, () => new Float32Array(length))
    return { length, getChannelData: (channel: number) => data[channel] ?? new Float32Array(length) }
  }
  createOscillator(): FakeOscillator {
    const node = new FakeOscillator()
    heard.oscillators.push(node)
    return node
  }
  createBiquadFilter(): FakeFilter {
    const node = new FakeFilter()
    heard.filters.push(node)
    return node
  }
  createBufferSource(): FakeSource {
    const node = new FakeSource()
    heard.sources.push(node)
    return node
  }
  startRendering(): Promise<FakeBuffer> {
    return Promise.resolve(this.createBuffer(2, this.length))
  }
}

interface Beat {
  turn: number
  warm: number
  fadeIn: number
  fadeOut: number
}

interface Renderer {
  renderJingle: (name: string, sampleRate?: number) => Promise<FakeBuffer>
  beat: Beat
}

const news = (): Renderer => (window as unknown as { PipNews: Renderer }).PipNews

// renderJingle starts every jingle's score 0.02 s into its render, and the
// beat's at the very start
const T0 = 0.02

async function render(name: string): Promise<Heard> {
  await news().renderJingle(name, 8000)
  return heard
}

// The logo's bell: the only voice with a triangle, an octave over its note
function bells(score: Heard): { at: number; note: number }[] {
  return score.oscillators
    .filter((o) => o.type === 'triangle')
    .map((o) => ({ at: o.startedAt - T0, note: o.frequency.value / 2 }))
    .sort((a, b) => a.at - b.at)
}

// When the timpani strikes: its sine partials drop to their pitch from 1.45
// times it. `from`: when the score starts in its render
function strokes(score: Heard, from = T0): number[] {
  const times = score.oscillators
    .filter((o) => {
      const [start, end] = o.frequency.steps
      return o.type === 'sine' && start?.kind === 'set' && end?.kind === 'exp' && Math.abs(start.value / end.value - 1.45) < 1e-6
    })
    .map((o) => Math.round((o.startedAt - from) * 1000) / 1000)
  return [...new Set(times)].sort((a, b) => a - b)
}

// The beat's ticks: its only square voice, in the order they start
function ticks(score: Heard): FakeOscillator[] {
  return score.oscillators.filter((o) => o.type === 'square').sort((a, b) => a.startedAt - b.startedAt)
}

// The brass notes that start at a moment: sawtooth voices that slide up to
// their pitch from 0.985 of it
function brassAt(score: Heard, at: number): number[] {
  const notes = score.oscillators
    .filter((o) => o.type === 'sawtooth' && Math.abs(o.startedAt - T0 - at) < 1e-6)
    .flatMap((o) => {
      const first = o.frequency.steps[0]
      return first === undefined ? [] : [Math.round((first.value / 0.985) * 100) / 100]
    })
  return [...new Set(notes)].sort((a, b) => a - b)
}

// The intro's signs that a story is coming
const riser = (score: Heard): boolean => score.filters.some((f) => f.type === 'bandpass')
const crash = (score: Heard): boolean => score.filters.some((f) => f.type === 'highpass')
const boom = (score: Heard): boolean => score.oscillators.some((o) => o.type === 'sine' && o.frequency.steps[0]?.value === 120)
const roll = (score: Heard): boolean => {
  const times = strokes(score)
  return times.slice(1).some((at, i) => at - (times[i] ?? Number.NEGATIVE_INFINITY) < 0.2)
}

beforeAll(() => {
  const host = window as unknown as { OfflineAudioContext: unknown }
  host.OfflineAudioContext = FakeOfflineAudioContext
})

describe('the BREAKING NEWS outro', () => {
  it('brings the logo back down: A D A D on the bells, each lower than the last, ending on D', async () => {
    const played = bells(await render('breaking-out'))
    expect(played.map((b) => b.note)).toEqual([880, 587.33, 440, 293.66])
    expect(played.map((b) => Math.round(b.at * 1e6) / 1e6)).toEqual([0.1, 0.34, 0.62, 0.96])
  })

  it('has none of the intro’s signs that a story is coming: no riser, no roll, no boom, no crash', async () => {
    const score = await render('breaking-out')
    expect(riser(score)).toBe(false)
    expect(roll(score)).toBe(false)
    expect(boom(score)).toBe(false)
    expect(crash(score)).toBe(false)
    expect(strokes(score)).toEqual([0.1, 0.62, 0.96])
  })

  it('starts nothing once the board is back, 1.2 s in', async () => {
    const score = await render('breaking-out')
    const starts = [...score.oscillators, ...score.sources].map((node) => node.startedAt - T0)
    expect(Math.max(...starts)).toBeLessThanOrEqual(1.2)
  })

  it('lands home on D major, with the low D in the bass', async () => {
    expect(brassAt(await render('breaking-out'), 0.96)).toEqual([73.42, 146.83, 185, 220, 293.66])
  })
})

describe('the BREAKING NEWS intro, for contrast', () => {
  it('takes the logo up, with a riser, a roll, a boom and a crash', async () => {
    const score = await render('breaking')
    expect(bells(score).map((b) => b.note)).toEqual([440, 587.33, 880, 1174.66])
    expect(riser(score)).toBe(true)
    expect(roll(score)).toBe(true)
    expect(boom(score)).toBe(true)
    expect(crash(score)).toBe(true)
  })
})

describe('the BREAKING NEWS intro', () => {
  it('leaves the beat to the desk: none of its ticks is in the jingle', async () => {
    expect(ticks(await render('breaking'))).toEqual([])
  })
})

describe('the beat', () => {
  it('loops one turn of 43,648 frames at 48 kHz, a whole number of 128-frame blocks', async () => {
    expect(Math.round(news().beat.turn * 48_000)).toBe(43_648)
    expect(43_648 % 128).toBe(0)
    expect((await news().renderJingle('beat-minor')).length).toBe(43_648)
  })

  it('plays sixteenths on the line D D A D F D A D in D minor, with a drum on every beat', async () => {
    const score = await render('beat-minor')
    const played = ticks(score)
    const step = news().beat.turn / 8
    expect(played).toHaveLength((news().beat.warm + 1) * 8)
    played.forEach((o, k) => {
      expect(o.startedAt).toBeCloseTo(k * step, 9)
      expect(o.frequency.value).toBe([293.66, 293.66, 440, 293.66, 349.23, 293.66, 440, 293.66][k % 8])
    })
    expect(strokes(score, 0)).toEqual(played.filter((_, k) => k % 4 === 0).map((o) => Math.round(o.startedAt * 1000) / 1000))
  })

  it('takes F sharp for F in D major, under the hour', async () => {
    const notes = ticks(await render('beat-major')).map((o) => o.frequency.value)
    expect(notes.slice(0, 8)).toEqual([293.66, 293.66, 440, 293.66, 369.99, 293.66, 440, 293.66])
  })

  it('mixes in and phases out over the station’s own lengths', () => {
    expect(Math.round(news().beat.fadeIn * 1000)).toBe(BED_IN_MS)
    expect(Math.round(news().beat.fadeOut * 1000)).toBe(BED_OUT_MS)
  })
})
