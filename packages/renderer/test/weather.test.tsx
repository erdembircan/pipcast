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
    Reflect.deleteProperty(window, 'THREE')
    Reflect.deleteProperty(window, 'WebGLRenderingContext')
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
      expect((window as unknown as { THREE?: unknown }).THREE).toBeUndefined()
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

    it('stays dark when three.js is there and the graphics context cannot be made', () => {
      const made = vi.fn(() => {
        throw new Error('no context')
      })
      ;(window as unknown as { THREE: unknown }).THREE = { WebGLRenderer: made }
      ;(window as unknown as { WebGLRenderingContext: unknown }).WebGLRenderingContext = class {}
      expect(() => draw(<news.Stormtracker weather={weatherOf('stormtracker')} animate />)).not.toThrow()
      expect(made).toHaveBeenCalledTimes(1)
      expect(container.querySelector('.pn-wx-st3')?.classList.contains('pn-wx-st3-plain')).toBe(true)
      expect(container.querySelector('.pn-wx-st3-toa')).not.toBeNull()
    })

    // A THREE whose every constructor and method answers with another stand-in, but for a renderer that cannot draw: it
    // throws as WebKit does when the page may not read the files its pictures come from
    // With `draws`, the renderer draws: then every z the scene is given is kept, which includes the storm's turn
    function brokenThree(draws = false) {
      const zs: number[] = []
      const standIn: object = new Proxy(function () {}, {
        get: (_target, key) => (key === Symbol.toPrimitive ? () => 0 : standIn),
        apply: () => standIn,
        construct: () => standIn,
        set: (_target, key, value) => {
          if (key === 'z' && typeof value === 'number') {
            zs.push(value)
          }
          return true
        },
      })
      const render = vi.fn(() => {
        if (!draws) {
          throw new Error('The operation is insecure.')
        }
      })
      const dispose = vi.fn()
      const forceContextLoss = vi.fn()
      class Renderer {
        setPixelRatio() {}
        setSize() {}
        render = render
        dispose = dispose
        forceContextLoss = forceContextLoss
      }
      class Loader {
        setCrossOrigin() {}
        // The pictures come a moment later, as they do
        load(_url: string, onLoad: () => void) {
          window.setTimeout(onLoad, 0)
          return {}
        }
      }
      const three = new Proxy({}, { get: (_target, key) => (key === 'WebGLRenderer' ? Renderer : key === 'TextureLoader' ? Loader : standIn) })
      ;(window as unknown as { THREE: unknown }).THREE = three
      ;(window as unknown as { WebGLRenderingContext: unknown }).WebGLRenderingContext = class {}
      vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockImplementation((() => standIn) as never)
      return { render, dispose, forceContextLoss, zs }
    }

    it('gives the globe up when a picture is refused as it draws, once, and shows the list and the tag', async () => {
      const three = brokenThree()
      const frames: (() => void)[] = []
      vi.stubGlobal('requestAnimationFrame', (frame: () => void) => frames.push(frame))
      draw(<news.Stormtracker weather={weatherOf('stormtracker')} animate />)
      expect(frames).toHaveLength(1)
      expect(container.querySelector('.pn-wx-st3')?.classList.contains('pn-wx-st3-plain')).toBe(false)
      act(() => frames[0]?.())
      expect(three.render).toHaveBeenCalledTimes(1)
      expect(three.dispose).toHaveBeenCalledTimes(1)
      expect(three.forceContextLoss).toHaveBeenCalledTimes(1)
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

    it('keeps drawing through its 13 s, the storm turning on over the coast, and holds the last picture after', () => {
      const three = brokenThree(true)
      const frames: (() => void)[] = []
      vi.stubGlobal('requestAnimationFrame', (frame: () => void) => frames.push(frame))
      let clock = 5_000
      vi.spyOn(performance, 'now').mockImplementation(() => clock)
      draw(<news.Stormtracker weather={weatherOf('stormtracker')} animate />)
      expect(frames).toHaveLength(1)
      const turn = (seconds: number) => {
        three.zs.length = 0
        clock = 5_000 + seconds * 1000
        act(() => frames.shift()?.())
        expect(frames).toHaveLength(1)
        // The storm's spin, half a turn a second of the timeline
        return three.zs.includes(seconds * 0.5)
      }
      // Past the 11 s the storm used to freeze at, to the end of the 13
      expect(turn(9.5)).toBe(true)
      expect(turn(11.5)).toBe(true)
      expect(turn(12.9)).toBe(true)
      // Then the last picture holds: the timeline stops at 13 s, and the loop goes on drawing it
      expect(turn(14)).toBe(false)
      expect(three.zs).toContain(13 * 0.5)
      expect(three.render).toHaveBeenCalledTimes(4)
      expect(container.querySelector('.pn-wx-st3')?.classList.contains('pn-wx-st3-plain')).toBe(false)
    })

    it('gives a held picture up too, and a still stops waiting for it', async () => {
      const three = brokenThree()
      draw(<news.Stormtracker weather={weatherOf('stormtracker')} />)
      expect((window as unknown as { THREE: unknown }).THREE).toBeDefined()
      const waiting = drawn()
      await act(async () => {
        await new Promise((done) => window.setTimeout(done, 30))
      })
      await expect(waiting).resolves.toBeDefined()
      expect(three.render).toHaveBeenCalledTimes(1)
      expect(three.dispose).toHaveBeenCalledTimes(1)
      expect(container.querySelector('.pn-wx-st3')?.classList.contains('pn-wx-st3-plain')).toBe(true)
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
