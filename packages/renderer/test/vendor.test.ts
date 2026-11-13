/// <reference types="node" />
import { existsSync, readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'

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
