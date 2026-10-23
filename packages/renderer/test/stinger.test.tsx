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

  // Each line is the word twice: the outline underneath, the chrome on top
  function expectLayers(line: HTMLElement, word: string): void {
    expect(line.children).toHaveLength(2)
    const [ink, face] = Array.from(line.children) as HTMLElement[]
    expect(ink?.tagName).toBe('SPAN')
    expect(face?.tagName).toBe('SPAN')
    expect(ink?.classList.contains('pn-stinger-ink')).toBe(true)
    expect(ink?.getAttribute('aria-hidden')).toBe('true')
    expect(ink?.textContent).toBe(word)
    expect(face?.classList.contains('pn-stinger-face')).toBe(true)
    expect(face?.hasAttribute('aria-hidden')).toBe(false)
    expect(face?.textContent).toBe(word)
    expect(line.style.backgroundPosition).toBe('')
    expect(face?.style.backgroundPosition).not.toBe('')
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

  it('move the glint across the chrome, not the outline', () => {
    const before = draw(stinger(0.74))[0]?.querySelector<HTMLElement>('.pn-stinger-face')?.style.backgroundPosition
    const after = draw(stinger(1))[0]?.querySelector<HTMLElement>('.pn-stinger-face')?.style.backgroundPosition
    expect(before).toBeTruthy()
    expect(after).toBeTruthy()
    expect(before).not.toBe(after)
  })
})
