/// <reference types="node" />
import { existsSync, readFileSync } from 'node:fs'
import { JSDOM } from 'jsdom'
import { describe, expect, it } from 'vitest'

const shipped = (name: string) => readFileSync(new URL(`../../../plugin/station/web/vendor/${name}`, import.meta.url), 'utf8')

describe('the React files the page ships', () => {
  it('React DOM as the page ships it renders and runs effects', async () => {
    const dom = new JSDOM('<!doctype html><div id="root"></div>', { runScripts: 'outside-only' })
    const { window } = dom
    window.eval(shipped('react.production.min.js'))
    window.eval(shipped('react-dom.production.min.js'))
    window.eval(`
      var h = React.createElement
      function Effect() {
        var state = React.useState(0)
        React.useEffect(function () { state[1](1) }, [])
        return h('p', null, 'effect ' + state[0])
      }
      ReactDOM.createRoot(document.getElementById('root')).render(h(Effect))
    `)
    const root = window.document.getElementById('root')
    const deadline = Date.now() + 2000
    while (root?.textContent !== 'effect 1' && Date.now() < deadline) {
      await new Promise((resolve) => setTimeout(resolve, 10))
    }
    expect(root?.textContent).toBe('effect 1')
    window.close()
  })
})

describe('the page and the files beside it', () => {
  const web = (name: string) => readFileSync(new URL(`../../../plugin/station/web/${name}`, import.meta.url))

  it('loads React, then the design system’s bundle, then the page, and no other library', () => {
    const html = web('index.html').toString('utf8')
    expect([...html.matchAll(/<script src="([^"]+)">/g)].map((match) => match[1])).toEqual([
      'vendor/react.production.min.js',
      'vendor/react-dom.production.min.js',
      'design.js',
      'station.js',
    ])
  })

  it('ships the design system’s bundle as its own script, as it is, and the page’s own code holds none of it', () => {
    expect(web('design.js').equals(readFileSync(new URL('../../../design/components/bundle.js', import.meta.url)))).toBe(true)
    const page = web('station.js').toString('utf8')
    expect(page).not.toContain('window.PipNews = {')
    // It reads what the bundle set, from the global
    expect(page).toContain('window.PipNews')
    expect(page.length).toBeLessThan(150_000)
  })

  it('ships no three.js: neither its code nor a license of it, and nothing in the page reads a THREE', () => {
    expect(existsSync(new URL('../../../plugin/station/web/vendor/three.js', import.meta.url))).toBe(false)
    expect(existsSync(new URL('../../../plugin/station/web/vendor/LICENSE-three.txt', import.meta.url))).toBe(false)
    expect(existsSync(new URL('../../../plugin/station/web/LICENSE-three.txt', import.meta.url))).toBe(false)
    expect(web('station.js').toString('utf8')).not.toMatch(/\bTHREE\b/)
  })

  it('has the four pictures of the Earth beside the page, and where they come from', () => {
    for (const name of ['earth.jpg', 'clouds.jpg', 'topo.jpg', 'water.jpg', 'CREDITS.txt']) {
      expect(web(`textures/${name}`).equals(readFileSync(new URL(`../../../design/textures/${name}`, import.meta.url)))).toBe(true)
    }
  })
})
