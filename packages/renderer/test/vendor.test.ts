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
