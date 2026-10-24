// @vitest-environment jsdom
// react-global first: the design system's bundle reads window.React as it loads
import '../src/react-global.ts'

import { act } from 'react'
import { createRoot } from 'react-dom/client'
import type { Root } from 'react-dom/client'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'

import type { Scene } from '@pipcast/design'

import { Broadcast, Stage } from '../src/design.ts'

const flag = globalThis as unknown as { IS_REACT_ACT_ENVIRONMENT: boolean }
flag.IS_REACT_ACT_ENVIRONMENT = true

function stinger(progress: number): Scene {
  return {
    mode: 'stinger',
    progress,
    event: { kind: 'needs-input', session: 'Fix flaky checkout test', project: 'web-shop' },
  } as Scene
}

describe('the chrome words', () => {
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
  })

  function draw(scene: Scene): HTMLElement[] {
    act(() =>
      root.render(
        <Stage width={960} animate={false}>
          <Broadcast scene={scene} animate={false} />
        </Stage>,
      ),
    )
    return Array.from(container.querySelectorAll<HTMLElement>('.pn-stinger-line'))
  }

  // Each line is the word three times: the outline and the chrome, which cast its shadow, and the glint's bright copy over them
  function expectLayers(line: HTMLElement, word: string): void {
    expect(line.children).toHaveLength(2)
    const [cast, glint] = Array.from(line.children) as HTMLElement[]
    expect(cast?.tagName).toBe('DIV')
    expect(cast?.classList.contains('pn-stinger-cast')).toBe(true)
    expect(glint?.tagName).toBe('SPAN')
    expect(glint?.classList.contains('pn-stinger-glint')).toBe(true)
    expect(glint?.getAttribute('aria-hidden')).toBe('true')
    expect(cast?.children).toHaveLength(2)
    const [ink, face] = Array.from(cast?.children ?? []) as HTMLElement[]
    expect(ink?.tagName).toBe('SPAN')
    expect(face?.tagName).toBe('SPAN')
    expect(ink?.classList.contains('pn-stinger-ink')).toBe(true)
    expect(ink?.getAttribute('aria-hidden')).toBe('true')
    expect(ink?.textContent).toBe(word)
    expect(face?.classList.contains('pn-stinger-face')).toBe(true)
    expect(face?.hasAttribute('aria-hidden')).toBe(false)
    expect(face?.getAttribute('style')).toBeNull()
    expect(face?.textContent).toBe(word)
    expect(glint?.children).toHaveLength(1)
    const shine = glint?.children[0] as HTMLElement | undefined
    expect(shine?.tagName).toBe('SPAN')
    expect(shine?.classList.contains('pn-stinger-shine')).toBe(true)
    expect(shine?.textContent).toBe(word)
    expect(line.style.backgroundPosition).toBe('')
  }

  it('draw BREAKING NEWS as an outline under the chrome', () => {
    const lines = draw(stinger(1))
    expect(lines.map((line) => line.querySelector('.pn-stinger-face')?.textContent)).toEqual(['BREAKING', 'NEWS'])
    lines.forEach((line, i) => expectLayers(line, ['BREAKING', 'NEWS'][i] ?? ''))
  })

  it("draw the outro's words the same way", () => {
    const lines = draw({ mode: 'outro', progress: 0.2, board: { mode: 'board' } } as Scene)
    expect(lines.map((line) => line.querySelector('.pn-stinger-face')?.textContent)).toEqual(['BREAKING', 'NEWS'])
    lines.forEach((line, i) => expectLayers(line, ['BREAKING', 'NEWS'][i] ?? ''))
  })

  it("draw the hour's words the same way", () => {
    const lines = draw({ mode: 'ident', hour: '15:00', progress: 1 } as Scene)
    expect(lines.map((line) => line.querySelector('.pn-stinger-face')?.textContent)).toEqual(['ON THE', 'HOUR'])
    lines.forEach((line, i) => {
      expect(line.classList.contains('pn-ident-line')).toBe(true)
      expectLayers(line, ['ON THE', 'HOUR'][i] ?? '')
    })
  })

  it("slide the glint's window across the line and the bright copy back, so the word stays put", () => {
    const NUMBER = /-?(?:\d+\.?\d*|\.\d+)(?:e[-+]?\d+)?/i
    const first = (el: HTMLElement | null | undefined): number =>
      parseFloat(NUMBER.exec(el?.style.transform ?? '')?.[0] ?? 'NaN')
    const at = (progress: number): { glint: number; shine: number } => {
      const line = draw(stinger(progress))[0]
      return {
        glint: first(line?.querySelector<HTMLElement>('.pn-stinger-glint')),
        shine: first(line?.querySelector<HTMLElement>('.pn-stinger-shine')),
      }
    }
    const before = at(0.74)
    const after = at(1)
    expect(before.glint).not.toBe(after.glint)
    expect(before.shine).toBeCloseTo(-before.glint, 6)
    expect(after.shine).toBeCloseTo(-after.glint, 6)
  })
})
