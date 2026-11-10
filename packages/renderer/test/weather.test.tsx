// @vitest-environment jsdom
// react-global first: the design system's bundle reads window.React as it loads
import '../src/react-global.ts'

import { act } from 'react'
import type { ComponentType } from 'react'
import { createRoot } from 'react-dom/client'
import type { Root } from 'react-dom/client'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { OUTLOOK_WORDS, outTag, WEATHER } from '@pipcast/contract'
import type { Scene, WeatherScene } from '@pipcast/design'

import { Broadcast, drawn, samples, Stage } from '../src/design.ts'
import { fakeGL, stubWebGL } from './fakegl.ts'

const flag = globalThis as unknown as { IS_REACT_ACT_ENVIRONMENT: boolean }
flag.IS_REACT_ACT_ENVIRONMENT = true

interface Weather {
  WeatherIcon: ComponentType<{ sky: string; size?: number }>
  WeatherNow: ComponentType<{ weather?: WeatherScene }>
  WeatherDays: ComponentType<{ weather?: WeatherScene }>
  Stormtracker: ComponentType<{ weather?: WeatherScene; animate?: boolean }>
  AlertOpen: ComponentType<{ progress?: number; animate?: boolean; outro?: boolean }>
  weatherIconMarkup: (sky: string, uid: number) => string
  WEATHER: Record<string, unknown>
  OUTLOOKS: Record<string, { word: string; k: string }>
}

const news = (window as unknown as { PipNews: Weather }).PipNews

function scene(name: string): Scene {
  const found = samples[name]
  if (found === undefined) {
    throw new Error(`the design system has no sample ${name}`)
  }
  return found
}

function weatherOf(name: string): WeatherScene {
  const found = scene(name).weather
  if (found === undefined) {
    throw new Error(`the sample ${name} has no weather`)
  }
  return found
}

describe('KLWD WEATHER', () => {
  let container: HTMLElement
  let root: Root

  beforeEach(() => {
    container = document.createElement('div')
    document.body.append(container)
    root = createRoot(container)
  })

  afterEach(() => {
    act(() => root.unmount())
    container.remove()
    Reflect.deleteProperty(window, 'WebGL2RenderingContext')
    vi.restoreAllMocks()
    vi.unstubAllGlobals()
  })

  function draw(element: React.ReactElement): void {
    act(() => root.render(element))
  }

  function broadcast(of: Scene): void {
    draw(
      <Stage width={960}>
        <Broadcast scene={of} />
      </Stage>,
    )
  }

  const text = () => container.textContent ?? ''

  describe('CURRENT CONDITIONS', () => {
    it('shows the week used under THE WEEK, in the outlook’s words', () => {
      draw(<news.WeatherNow weather={weatherOf('weather-now')} />)
      expect(container.querySelector('.pn-wx-head')?.textContent).toBe('CURRENT CONDITIONS')
      expect(container.querySelector('.pn-wx-now-cap')?.textContent).toBe('THE WEEK')
      expect(container.querySelector('.pn-wx-now-temp .pn-stinger-face')?.textContent).toBe('48%')
      expect(container.querySelector('.pn-wx-now-word')?.textContent).toBe('CLOUDS GATHERING')
      expect(container.querySelector('.pn-wx-wall')?.classList.contains('pn-k-hourly')).toBe(true)
      expect(container.querySelector('.pn-wx-now-sky')?.getAttribute('aria-label')).toBe('Partly cloudy')
    })

    it('draws a storm for a storm', () => {
      draw(<news.WeatherNow weather={weatherOf('weather-now-storm')} />)
      expect(container.querySelector('.pn-wx-now-sky')?.getAttribute('aria-label')).toBe('Storms')
      expect(container.querySelector('.pn-wx-now-word')?.textContent).toBe('STORM WARNING')
    })
  })

  describe('EXTENDED FORECAST', () => {
    it('has a panel a day, each with its high and low, and the verdict on a tag in the outlook’s colour', () => {
      draw(<news.WeatherDays weather={weatherOf('weather-days')} />)
      expect(container.querySelector('.pn-wx-head')?.textContent).toBe('EXTENDED FORECASTTO MON 18:00')
      const days = [...container.querySelectorAll('.pn-wx-day')]
      expect(days.map((day) => [...day.querySelectorAll('span')].map((span) => span.textContent))).toEqual([
        ['FRI', '52%', '48%'],
        ['SAT', '64%', '52%'],
        ['SUN', '77%', '64%'],
        ['MON', '86%', '77%'],
      ])
      expect(container.querySelector('.pn-wx-days')?.classList.contains('pn-wx-days--7')).toBe(false)
      const tag = container.querySelector('.pn-wx-tag')
      expect(tag?.textContent).toBe('CLOUDS GATHERING')
      expect(tag?.classList.contains('pn-k-working')).toBe(true)
      expect(container.querySelector('.pn-wx-strip')?.textContent).toBe('CLOUDS GATHERINGThe week ends near 86%')
    })

    it('marks the days the week has run out by, and goes red', () => {
      draw(<news.WeatherDays weather={weatherOf('weather-days-storm')} />)
      const out = [...container.querySelectorAll('.pn-wx-out')]
      expect(out.map((day) => day.querySelector('.pn-wx-day-name')?.textContent)).toEqual(['SUN', 'MON'])
      expect(out.map((day) => day.querySelector('.pn-wx-hi')?.textContent)).toEqual(['OUT', 'OUT'])
      expect(container.querySelector('.pn-wx-tag')?.classList.contains('pn-k-breaking')).toBe(true)
      expect(container.querySelector('.pn-wx-strip')?.textContent).toContain('The week runs out Sun around 05:00')
    })

    it('narrows its panels for seven days', () => {
      const weather = weatherOf('weather-days')
      const seven = { ...weather, days: [...weather.days, ...weather.days.slice(0, 3)] }
      draw(<news.WeatherDays weather={seven} />)
      expect(container.querySelectorAll('.pn-wx-day')).toHaveLength(7)
      expect(container.querySelector('.pn-wx-days')?.classList.contains('pn-wx-days--7')).toBe(true)
    })

    it('colours the tag for clear skies green', () => {
      draw(<news.WeatherDays weather={{ ...weatherOf('weather-days'), outlook: 'clear', word: 'CLEAR SKIES' }} />)
      expect(container.querySelector('.pn-wx-tag')?.classList.contains('pn-k-ready')).toBe(true)
    })
  })

  describe('STORMTRACKER with no WebGL', () => {
    it('draws no globe, and shows TIME OF ARRIVAL with every row and the OUT tag', () => {
      expect((window as unknown as { WebGL2RenderingContext?: unknown }).WebGL2RenderingContext).toBeUndefined()
      expect(() => draw(<news.Stormtracker weather={weatherOf('stormtracker')} animate />)).not.toThrow()
      expect(container.querySelector('.pn-wx-head')?.textContent).toBe('STORMTRACKERTO MON 18:00')
      expect(container.querySelector('.pn-wx-wall')?.classList.contains('pn-k-breaking')).toBe(true)
      const globe = container.querySelector('.pn-wx-st3')
      expect(globe?.classList.contains('pn-wx-st3-plain')).toBe(true)
      expect(container.querySelector('canvas')?.getAttribute('width')).toBe('1680')
      expect(container.querySelector('.pn-wx-st3-toa > b')?.textContent).toBe('TIME OF ARRIVAL')
      const rows = [...container.querySelectorAll('.pn-wx-st3-toa > span')].map((row) => row.textContent)
      expect(rows).toEqual(['SAT 00:00   78%', 'SUN 00:00   96%', 'SUN 05:00   OUT'])
      expect(container.querySelector('.pn-wx-st3-out')?.textContent).toBe('OUT · SUN 05:00')
      expect([...container.querySelectorAll('.pn-wx-st3-mark')].map((mark) => mark.textContent)).toEqual(['78%', '96%'])
    })

    it('says what it shows to someone who cannot see it, from the scene’s own marks', () => {
      draw(<news.Stormtracker weather={weatherOf('stormtracker')} />)
      const label = container.querySelector('.pn-wx-st3')?.getAttribute('aria-label')
      expect(label).toBe(
        'STORMTRACKER: a storm forms at now and grows as it crosses the Gulf, 78% by SAT 00:00, 96% by SUN 00:00, and the week runs out at SUN 05:00',
      )
      const weather = weatherOf('stormtracker')
      const track = { out: 'SUN 05:00', marks: weather.track?.marks.slice(1) ?? [] }
      draw(<news.Stormtracker weather={{ ...weather, track }} />)
      expect(container.querySelector('.pn-wx-st3')?.getAttribute('aria-label')).toBe(
        'STORMTRACKER: a storm forms at now and grows as it crosses the Gulf, 96% by SUN 00:00, and the week runs out at SUN 05:00',
      )
      draw(<news.Stormtracker weather={{ ...weather, track: { out: 'SUN 05:00', marks: [] } }} />)
      expect(container.querySelector('.pn-wx-st3')?.getAttribute('aria-label')).toBe(
        'STORMTRACKER: a storm forms at now and grows as it crosses the Gulf, and the week runs out at SUN 05:00',
      )
      expect(container.querySelectorAll('.pn-wx-st3-toa > span')).toHaveLength(1)
    })

    it('stays dark when WebGL 2 is there and the graphics context cannot be made', () => {
      const get = stubWebGL(null)
      expect(() => draw(<news.Stormtracker weather={weatherOf('stormtracker')} animate />)).not.toThrow()
      expect(get).toHaveBeenCalledWith('webgl2', expect.objectContaining({ antialias: true }))
      expect(container.querySelector('.pn-wx-st3')?.classList.contains('pn-wx-st3-plain')).toBe(true)
      expect(container.querySelector('.pn-wx-st3-toa')).not.toBeNull()
    })

    it('stays dark when its shaders do not compile, and gives back what it made', () => {
      const fake = fakeGL({ badShader: true })
      stubWebGL(fake)
      expect(() => draw(<news.Stormtracker weather={weatherOf('stormtracker')} animate />)).not.toThrow()
      expect(container.querySelector('.pn-wx-st3')?.classList.contains('pn-wx-st3-plain')).toBe(true)
      expect(fake.live()).toEqual({})
      expect(fake.count('loseContext')).toBe(1)
      expect(fake.count('drawElements')).toBe(0)
    })

    it('asks for no context where there is no WebGL 2', () => {
      const get = vi.spyOn(HTMLCanvasElement.prototype, 'getContext')
      draw(<news.Stormtracker weather={weatherOf('stormtracker')} animate />)
      expect(get).not.toHaveBeenCalled()
      expect(container.querySelector('.pn-wx-st3')?.classList.contains('pn-wx-st3-plain')).toBe(true)
    })

    // The four pictures come a moment later, as they do
    const picturesCome = async () => {
      await act(async () => {
        await new Promise((done) => window.setTimeout(done, 30))
      })
    }

    it('draws a held moment once, when its pictures have come, and then a still stops waiting', async () => {
      const fake = fakeGL()
      const get = stubWebGL(fake)
      draw(<news.Stormtracker weather={weatherOf('stormtracker')} />)
      // The buffer is kept for the picture the station takes of it
      expect(get).toHaveBeenCalledWith('webgl2', expect.objectContaining({ preserveDrawingBuffer: true }))
      expect(fake.count('clear')).toBe(0)
      const waiting = drawn()
      await picturesCome()
      await expect(waiting).resolves.toBeDefined()
      expect(fake.count('clear')).toBe(1)
      // The stars, the earth, the clouds and their shadow, the air, the track, the dots and the target, the storm and its shadow
      expect(fake.count('drawElements') + fake.count('drawArrays')).toBeGreaterThanOrEqual(12)
      // Four pictures of the Earth and the three canvases' (the spiral, the dot and the ring) go up
      expect(fake.count('texSubImage2D')).toBe(7)
      expect(fake.count('generateMipmap')).toBe(7)
      expect(container.querySelector('.pn-wx-st3')?.classList.contains('pn-wx-st3-plain')).toBe(false)
      expect(container.querySelector('.pn-wx-st3')?.classList.contains('pn-wx-st3-held')).toBe(true)
      // Nothing more is drawn while it holds
      await picturesCome()
      expect(fake.count('clear')).toBe(1)
    })

    it('stores the colour picture as sRGB and the others as plain bytes, flipped and not premultiplied', async () => {
      const fake = fakeGL()
      stubWebGL(fake)
      draw(<news.Stormtracker weather={weatherOf('stormtracker')} />)
      await picturesCome()
      const storage = fake.calls.filter((call) => call.name === 'texStorage2D')
      expect(storage).toHaveLength(7)
      // One picture, the earth's, is stored one way, and the other six the other
      const formats = storage.map((call) => call.args[2])
      expect(formats.filter((format) => format === formats[0])).toHaveLength(1)
      expect(new Set(formats).size).toBe(2)
      const stores = fake.calls.filter((call) => call.name === 'pixelStorei')
      expect(stores).toHaveLength(28)
      // UNPACK_FLIP_Y true for every picture and UNPACK_PREMULTIPLY_ALPHA false for every one
      expect(stores.filter((call) => call.args[1] === true)).toHaveLength(7)
      expect(stores.filter((call) => call.args[1] === false)).toHaveLength(7)
    })

    // Draws the run from mount, one frame at each of the seconds, and gives what each frame did
    function runOf(seconds: number[], after: (second: number) => void = () => undefined) {
      const fake = fakeGL()
      stubWebGL(fake)
      const frames: (() => void)[] = []
      vi.stubGlobal('requestAnimationFrame', (frame: () => void) => frames.push(frame))
      let clock = 5_000
      vi.spyOn(performance, 'now').mockImplementation(() => clock)
      draw(<news.Stormtracker weather={weatherOf('stormtracker')} animate />)
      expect(frames).toHaveLength(1)
      return seconds.map((second) => {
        clock = 5_000 + second * 1000
        fake.since()
        act(() => frames.shift()?.())
        // Another frame is asked for each time
        expect(frames).toHaveLength(1)
        after(second)
        return fake.since()
      })
    }
    const uniforms = (frame: { name: string; args: unknown[] }[]) => JSON.stringify(frame.filter((call) => call.name.startsWith('uniform')))

    it('keeps drawing through its 13 s, the storm turning on over the coast, and holds the last picture after', () => {
      const [a, b, c, over, after] = runOf([9.5, 11.5, 12.9, 14, 20])
      // The storm turns on, a different picture each time, to the end of the 13 s
      expect(new Set([uniforms(a ?? []), uniforms(b ?? []), uniforms(c ?? [])]).size).toBe(3)
      // Then the last picture holds: the timeline stops at 13 s, and the loop goes on drawing it
      expect(uniforms(over ?? [])).toBe(uniforms(after ?? []))
      expect(uniforms(over ?? [])).not.toBe(uniforms(c ?? []))
      expect((over ?? []).filter((call) => call.name === 'clear')).toHaveLength(1)
      expect(container.querySelector('.pn-wx-st3')?.classList.contains('pn-wx-st3-plain')).toBe(false)
    })

    it('draws a moment the same each time it comes, whatever was drawn between: its frame keeps nothing of the one before', () => {
      const [first, between, again, later] = runOf([5, 9.3, 5, 9.3])
      expect(uniforms(first ?? [])).toBe(uniforms(again ?? []))
      expect(uniforms(between ?? [])).toBe(uniforms(later ?? []))
      expect(uniforms(first ?? [])).not.toBe(uniforms(between ?? []))
      // and in the same order, with the same sizes of what it draws
      const draws = (frame: { name: string; args: unknown[] }[] | undefined) => JSON.stringify((frame ?? []).filter((call) => call.name.startsWith('draw')))
      expect(draws(first)).toBe(draws(again))
      expect(draws(between)).toBe(draws(later))
    })

    it('draws the solid things first and the storm’s sheet last', () => {
      const [frame] = runOf([5])
      const draws = (frame ?? []).filter((call) => call.name === 'drawElements' || call.name === 'drawArrays')
      // The stars are points, the first thing drawn
      expect(draws[0]?.name).toBe('drawArrays')
      expect(draws.length).toBeGreaterThanOrEqual(14)
      // The storm's sheet, 220 x 220 quads of two triangles, is the last (it is drawn after everything else that is see-through)
      const last = draws[draws.length - 1]
      expect(last?.name).toBe('drawElements')
      expect(last?.args[1]).toBe(220 * 220 * 6)
    })

    it('puts the labels where the camera sees their places, and lights the rows as the storm passes them', () => {
      const lit: number[] = []
      runOf([1, 9.5], (second) => {
        const now = container.querySelector<HTMLElement>('.pn-wx-st3-now')
        expect(now?.style.transform).toMatch(/^translate\(-?[\d.]+px,-?[\d.]+px\)$/)
        // The dive is still on at 1 s, the storm is past two of the marks at 9.5 s
        expect(now?.classList.contains('pn-wx-on')).toBe(second > 3)
        lit.push(container.querySelectorAll('.pn-wx-st3-toa [data-row].pn-wx-on').length)
      })
      expect(lit[0]).toBe(0)
      expect(lit[1]).toBeGreaterThanOrEqual(2)
    })

    it('gives the globe up when a picture is refused as it uploads, once, giving back all it made, and shows the list and the tag', () => {
      const fake = fakeGL({ insecure: true })
      stubWebGL(fake)
      const frames: (() => void)[] = []
      vi.stubGlobal('requestAnimationFrame', (frame: () => void) => frames.push(frame))
      draw(<news.Stormtracker weather={weatherOf('stormtracker')} animate />)
      expect(frames).toHaveLength(1)
      expect(container.querySelector('.pn-wx-st3')?.classList.contains('pn-wx-st3-plain')).toBe(false)
      // The first frame cannot put the pictures on the card
      act(() => frames[0]?.())
      expect(fake.count('texSubImage2D')).toBe(1)
      expect(fake.count('loseContext')).toBe(1)
      expect(fake.live()).toEqual({})
      // Never tried again, so it never throws every frame
      expect(frames).toHaveLength(1)
      const globe = container.querySelector('.pn-wx-st3')
      expect(globe?.classList.contains('pn-wx-st3-plain')).toBe(true)
      expect(globe?.classList.contains('pn-wx-st3-tracking')).toBe(false)
      expect(container.querySelector('.pn-wx-st3-toa')).not.toBeNull()
      expect(container.querySelector('.pn-wx-st3-out')?.textContent).toBe('OUT · SUN 05:00')
      for (const label of container.querySelectorAll<HTMLElement>('.pn-wx-st3-label')) {
        expect(label.classList.contains('pn-wx-on')).toBe(false)
        expect(label.style.transform).toBe('')
      }
    })

    it('gives a held picture up too, and a still stops waiting for it', async () => {
      const fake = fakeGL({ insecure: true })
      stubWebGL(fake)
      draw(<news.Stormtracker weather={weatherOf('stormtracker')} />)
      const waiting = drawn()
      await picturesCome()
      await expect(waiting).resolves.toBeDefined()
      expect(fake.count('texSubImage2D')).toBe(1)
      expect(fake.count('loseContext')).toBe(1)
      expect(fake.live()).toEqual({})
      expect(container.querySelector('.pn-wx-st3')?.classList.contains('pn-wx-st3-plain')).toBe(true)
    })

    it('gives back every buffer, picture, program and array it made, and loses the context, when it is taken away', async () => {
      const fake = fakeGL()
      stubWebGL(fake)
      draw(<news.Stormtracker weather={weatherOf('stormtracker')} />)
      await picturesCome()
      const made = fake.live()
      expect(made.Program).toBe(10)
      expect(made.Texture).toBe(7)
      expect(made.VertexArray).toBeGreaterThanOrEqual(10)
      expect(made.Buffer).toBeGreaterThan(20)
      expect(fake.count('loseContext')).toBe(0)
      act(() => root.unmount())
      root = createRoot(container)
      expect(fake.live()).toEqual({})
      expect(fake.count('loseContext')).toBe(1)
    })

    it('stops when the page takes its canvas away, and draws nothing more', () => {
      const fake = fakeGL()
      stubWebGL(fake)
      const frames: (() => void)[] = []
      vi.stubGlobal('requestAnimationFrame', (frame: () => void) => frames.push(frame))
      draw(<news.Stormtracker weather={weatherOf('stormtracker')} animate />)
      act(() => frames.shift()?.())
      const before = fake.count('clear')
      container.remove()
      act(() => frames.shift()?.())
      expect(fake.count('clear')).toBe(before)
      expect(fake.live()).toEqual({})
      expect(frames).toHaveLength(0)
      document.body.append(container)
    })

    it('has nothing to wait for in a still with no globe', async () => {
      draw(<news.Stormtracker weather={weatherOf('stormtracker')} />)
      await expect(drawn()).resolves.toBeDefined()
    })
  })

  describe('WEATHER ALERT', () => {
    it('slams WEATHER and ALERT in over the glass wall, with the storm in the clock’s face', () => {
      draw(<news.AlertOpen />)
      expect([...container.querySelectorAll('.pn-wx-alert-line .pn-stinger-face')].map((line) => line.textContent)).toEqual(['WEATHER', 'ALERT'])
      expect(container.querySelector('.pn-stinger-wall')).not.toBeNull()
      expect(container.querySelector('.pn-dial .pn-dial-face svg[aria-label="Storms"]')).not.toBeNull()
      expect(container.querySelector('.pn-dial-face .pn-wx-alert-bolt')).not.toBeNull()
      expect(container.querySelector('.pn-wx-flash')).not.toBeNull()
      expect(container.querySelector('.pn-wx-alert-out')).toBeNull()
    })

    it('runs out with no flash, on a wrapper of its own', () => {
      draw(<news.AlertOpen outro />)
      expect(container.querySelector('.pn-wx-alert-out')).not.toBeNull()
      expect(container.querySelector('.pn-wx-flash')).toBeNull()
      expect([...container.querySelectorAll('.pn-wx-alert-line .pn-stinger-face')]).toHaveLength(2)
    })
  })

  describe('the broadcast', () => {
    it.each([
      ['weather-now', 'weather-now', '.pn-wx-now'],
      ['weather-days', 'weather-days', '.pn-wx-days'],
      ['stormtracker', 'stormtracker', '.pn-wx-st3'],
    ])('draws %s on the weather wall under the backdrop and the crawl', (name, mode, selector) => {
      broadcast(scene(name))
      const root = container.querySelector(`.pn-mode-${mode}`)
      expect(root).not.toBeNull()
      expect(root?.querySelector('.pn-backdrop')).not.toBeNull()
      expect(root?.querySelector(selector)).not.toBeNull()
      expect(root?.querySelector('.pn-top')).not.toBeNull()
      expect(root?.querySelector('.pn-ticker')).not.toBeNull()
    })

    it('reads WARNING on the crawl’s tab, with the storm warning leading it', () => {
      broadcast(scene('stormtracker'))
      expect(container.querySelector('.pn-ticker-label')?.textContent).toBe('WARNING')
      expect(container.querySelector('.pn-ticker-track .pn-ticker-lead')?.textContent).toBe('STORM WARNING ')
    })

    it('opens STORM WARNING with WEATHER ALERT in BREAKING’s red and no crawl', () => {
      broadcast(scene('alert'))
      const root = container.querySelector('.pn-mode-alert')
      expect(root?.classList.contains('pn-k-breaking')).toBe(true)
      expect(root?.querySelector('.pn-wx-alert')).not.toBeNull()
      expect(root?.querySelector('.pn-top')).not.toBeNull()
      expect(root?.querySelector('.pn-ticker')).toBeNull()
    })

    it('hands WEATHER ALERT’s outro back to the board underneath, with its warning', () => {
      broadcast(scene('alert-outro-1'))
      const root = container.querySelector('.pn-mode-outro')
      expect(root?.querySelector('.pn-board-under .pn-ticker-label')?.textContent).toBe('WARNING')
      expect(root?.querySelector('.pn-wx-alert-out')).not.toBeNull()
      expect(root?.querySelector('.pn-ticker')?.parentElement?.classList.contains('pn-board-under')).toBe(true)
    })

    it('draws the board while the warning holds, its tab reading WARNING', () => {
      broadcast(scene('board-warning'))
      expect(container.querySelector('.pn-ticker-label')?.textContent).toBe('WARNING')
      expect(text()).toContain('STORM WARNING')
    })
  })

  describe('the icons', () => {
    it.each([
      ['sun', 'Sunny'],
      ['partly', 'Partly cloudy'],
      ['overcast', 'Overcast'],
      ['storm', 'Storms'],
    ])('draws %s', (sky, label) => {
      draw(<news.WeatherIcon sky={sky} />)
      const svg = container.querySelector('svg.pn-wx-icon')
      expect(svg?.getAttribute('aria-label')).toBe(label)
      expect(svg?.getAttribute('viewBox')).toBe('0 0 120 100')
      expect(svg?.querySelectorAll('defs > *')).toHaveLength(5)
      expect(svg?.querySelector('circle, polygon')).not.toBeNull()
    })

    it('gives every icon gradients of its own, so two never share a url(#…)', () => {
      draw(
        <>
          <news.WeatherIcon sky="partly" />
          <news.WeatherIcon sky="partly" />
          <news.WeatherIcon sky="storm" />
        </>,
      )
      const ids = [...container.querySelectorAll('[id]')].map((node) => node.id)
      expect(ids).toHaveLength(15)
      expect(new Set(ids).size).toBe(ids.length)
      for (const svg of container.querySelectorAll('svg')) {
        const own = new Set([...svg.querySelectorAll('[id]')].map((node) => node.id))
        const used = [...(svg.innerHTML.matchAll(/url\(#([^)]+)\)/g))].map((match) => match[1] as string)
        expect(used.length).toBeGreaterThan(0)
        for (const id of used) {
          expect(own.has(id)).toBe(true)
        }
      }
    })

    it('has the same picture as markup for the crawl, under another id', () => {
      const one = news.weatherIconMarkup('overcast', 1)
      const two = news.weatherIconMarkup('overcast', 2)
      expect(one).toContain('pn-wx-cloud-d-1')
      expect(two).toContain('pn-wx-cloud-d-2')
      expect(one.replaceAll('-1"', '-N"').replaceAll('-1)', '-N)')).toBe(two.replaceAll('-2"', '-N"').replaceAll('-2)', '-N)'))
      expect(one.startsWith('<svg class="pn-wx-icon"')).toBe(true)
    })

    it('sizes an icon by its width when told to', () => {
      draw(<news.WeatherIcon sky="sun" size={60} />)
      const svg = container.querySelector('svg')
      expect(svg?.getAttribute('style')).toContain('width: 60px')
      expect(svg?.getAttribute('style')).toContain('height: 50px')
    })
  })

  describe('the words', () => {
    it('are the contract’s own', () => {
      expect(news.WEATHER).toEqual({
        now: WEATHER.now,
        days: WEATHER.days,
        tracker: WEATHER.tracker,
        week: WEATHER.week,
        arrival: WEATHER.arrival,
        start: WEATHER.start,
        out: WEATHER.out,
        alert: [...WEATHER.alert],
      })
      expect(Object.fromEntries(Object.entries(news.OUTLOOKS).map(([outlook, { word }]) => [outlook, word]))).toEqual(OUTLOOK_WORDS)
    })

    it('make the tag at landfall the contract’s', () => {
      draw(<news.Stormtracker weather={weatherOf('stormtracker')} />)
      expect(container.querySelector('.pn-wx-st3-out')?.textContent).toBe(outTag('SUN 05:00'))
    })
  })
})
