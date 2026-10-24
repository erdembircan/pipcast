// @vitest-environment jsdom
// react-global first: the design system's bundle reads window.React as it loads
import '../src/react-global.ts'
import '../src/design.ts'

import { beforeAll, describe, expect, it } from 'vitest'

// A stand-in for the browser's OfflineAudioContext. It plays nothing and keeps
// what a score asks of it: every oscillator, filter and buffer source, each
// parameter's scheduled values, and when each source starts.
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

class FakeOfflineAudioContext {
  readonly destination = new FakeNode()
  readonly sampleRate: number
  constructor(channels: number, length: number, sampleRate: number) {
    this.sampleRate = sampleRate
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
  createBuffer(channels: number, length: number): { getChannelData: (channel: number) => Float32Array } {
    const data = Array.from({ length: channels }, () => new Float32Array(length))
    return { getChannelData: (channel: number) => data[channel] ?? new Float32Array(length) }
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
  startRendering(): Promise<null> {
    return Promise.resolve(null)
  }
}

interface Renderer {
  renderJingle: (name: string, sampleRate?: number) => Promise<unknown>
}

// renderJingle starts every score 0.02 s into its render
const T0 = 0.02

async function render(name: string): Promise<Heard> {
  const news = (window as unknown as { PipNews: Renderer }).PipNews
  await news.renderJingle(name, 8000)
  return heard
}

// The logo's bell: the only voice with a triangle, an octave over its note
function bells(score: Heard): { at: number; note: number }[] {
  return score.oscillators
    .filter((o) => o.type === 'triangle')
    .map((o) => ({ at: o.startedAt - T0, note: o.frequency.value / 2 }))
    .sort((a, b) => a.at - b.at)
}

// When the timpani strikes: its sine partials drop to their pitch from 1.45 times it
function strokes(score: Heard): number[] {
  const times = score.oscillators
    .filter((o) => {
      const [from, to] = o.frequency.steps
      return o.type === 'sine' && from?.kind === 'set' && to?.kind === 'exp' && Math.abs(from.value / to.value - 1.45) < 1e-6
    })
    .map((o) => Math.round((o.startedAt - T0) * 1000) / 1000)
  return [...new Set(times)].sort((a, b) => a - b)
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
