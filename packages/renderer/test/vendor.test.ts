/// <reference types="node" />
import { readFileSync } from 'node:fs'
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

describe('the three.js file the page ships', () => {
  const web = (name: string) => readFileSync(new URL(`../../../plugin/station/web/${name}`, import.meta.url))

  it('is version 0.149.0, readable, and sets the THREE the globe is drawn with', () => {
    const source = shipped('three.js')
    expect(source.split('\n').length).toBeGreaterThan(10_000)
    const dom = new JSDOM('<!doctype html>', { runScripts: 'outside-only' })
    dom.window.eval(source)
    expect(dom.window.eval('THREE.REVISION')).toBe('149')
    expect(dom.window.eval('typeof THREE.WebGLRenderer')).toBe('function')
    expect(dom.window.eval('new THREE.Color("#ff0000").r')).toBe(1)
    dom.window.close()
  })

  it('comes with its license', () => {
    expect(shipped('LICENSE-three.txt')).toContain('Copyright © 2010-2023 three.js authors')
  })

  it('loads after React and before the page', () => {
    const html = web('index.html').toString('utf8')
    const order = ['vendor/react.production.min.js', 'vendor/react-dom.production.min.js', 'vendor/three.js', 'station.js'].map((name) => html.indexOf(name))
    expect(order.every((at) => at >= 0)).toBe(true)
    expect(order).toEqual([...order].sort((a, b) => a - b))
  })

  it('has the four pictures of the Earth beside the page, and where they come from', () => {
    for (const name of ['earth.jpg', 'clouds.jpg', 'topo.jpg', 'water.jpg', 'CREDITS.txt']) {
      expect(web(`textures/${name}`).equals(readFileSync(new URL(`../../../design/textures/${name}`, import.meta.url)))).toBe(true)
    }
  })
})
