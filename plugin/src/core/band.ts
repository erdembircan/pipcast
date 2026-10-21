// The band's two pictures, as SVG documents: the chip (KLWD in chrome on the
// studio plate, and four cells for the four places on air) and the tab
// (TUNE IN, TUNE OUT, or TUNE IN dimmed when KLWD is full). They are the
// design system's Band (design/components/Band) drawn for the desktop, which
// draws a mod's Svg as an image: an image loads no fonts and cannot read the
// app's theme, so the lettering is outlines (art.generated.ts) and every
// piece carries its own ground.

import { MAX_ON_AIR } from '../contract/constants.ts'
import { TAB_ALT, chipAlt } from '../contract/copy.ts'
import { KLWD, TUNE_IN, TUNE_OUT } from './art.generated.ts'
import type { Word } from './art.generated.ts'

export const BAND_HEIGHT = 22

// Graphics lean forward by 12 degrees (the design system's `slant`), about
// the band's centre line, so a slanted shape reaches HALF further right at
// its top and HALF further left at its foot.
const HALF = (BAND_HEIGHT * Math.tan((12 * Math.PI) / 180)) / 2
const LEAN = 'translate(0 11) skewX(-12) translate(0 -11)'

const STUDIO =
  '<linearGradient id="s" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#1a3f93"/><stop offset=".55" stop-color="#0b2260"/><stop offset="1" stop-color="#061233"/></linearGradient>'
const CHROME =
  '<linearGradient id="c" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#ffffff"/><stop offset=".46" stop-color="#c9d3e3"/><stop offset=".52" stop-color="#7f90b3"/><stop offset=".74" stop-color="#c9d3e3"/><stop offset="1" stop-color="#ffffff"/></linearGradient>'
const ROW =
  '<linearGradient id="r" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#5b8be8"/><stop offset=".48" stop-color="#2a57bf"/><stop offset=".52" stop-color="#1d449e"/><stop offset="1" stop-color="#2550b0"/></linearGradient>'
const GOLD =
  '<linearGradient id="g" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#ffe08a"/><stop offset=".55" stop-color="#f2b630"/><stop offset="1" stop-color="#b97d0c"/></linearGradient>'
const BAR =
  '<linearGradient id="b" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#1d48a8"/><stop offset="1" stop-color="#163a8c"/></linearGradient>'
const DIM = '<filter id="d"><feColorMatrix type="saturate" values=".3"/></filter>'

export interface Picture {
  svg: string
  width: number
  alt: string
}

export type TabKind = 'in' | 'out' | 'off'

function num(x: number): string {
  return String(Math.round(x * 100) / 100)
}

function svgDocument(width: number, defs: string, body: string): string {
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${BAND_HEIGHT}" viewBox="0 0 ${width} ${BAND_HEIGHT}"><defs>${defs}</defs>${body}</svg>`
}

// A word's outline, its capitals centred on `centre`
function lettering(word: Word, x: number, centre: number, paint: string): string {
  const y = centre - (word.top + word.bottom) / 2
  return `<path transform="translate(${num(x)} ${num(y)})" d="${word.d}" ${paint}/>`
}

function cell(x: number, fill: 'empty' | 'on' | 'this'): string {
  const at = num(x)
  if (fill === 'this') {
    return `<rect x="${at}" y="5" width="6" height="12" rx="1" fill="url(#g)"/><rect x="${at}" y="5" width="6" height="1" fill="#ffffff" fill-opacity=".6"/>`
  }
  if (fill === 'on') {
    return `<rect x="${at}" y="5" width="6" height="12" rx="1" fill="url(#r)"/><rect x="${at}" y="5" width="6" height="1" fill="#ffffff" fill-opacity=".45"/>`
  }
  return `<rect x="${at}" y="5" width="6" height="12" rx="1" fill="#061233"/><rect x="${num(x + 0.5)}" y="5.5" width="5" height="11" rx=".5" fill="none" stroke="#8fb0ff" stroke-opacity=".4"/>`
}

// The chip: the gold edge, the studio plate with its lit top edge, KLWD in
// chrome with its shadow, and the four cells: empty, on air (the listing's
// blue) or this session (gold)
export function chip(onAir: number, tuned: boolean): Picture {
  const count = Math.max(tuned ? 1 : 0, Math.min(MAX_ON_AIR, Math.round(onAir)))
  const mark = KLWD.width + 1.3
  const edge = 1 + HALF
  const plateX = edge + 2
  const plateWidth = 6 + mark + 6 + 30 + 7
  const textX = plateX + 6
  const cellsX = plateX + 6 + mark + 6
  const width = Math.ceil(plateX + plateWidth + HALF + 1)

  let cells = ''
  for (let i = 0; i < MAX_ON_AIR; i += 1) {
    cells += cell(cellsX + i * 8, tuned && i === 0 ? 'this' : i < count ? 'on' : 'empty')
  }

  const plate =
    `<g transform="${LEAN}">` +
    `<rect x="${num(edge)}" y="0" width="2" height="22" fill="#f2b630"/>` +
    `<rect x="${num(plateX)}" y="0" width="${num(plateWidth)}" height="22" fill="url(#s)"/>` +
    `<rect x="${num(plateX)}" y="0" width="${num(plateWidth)}" height="1" fill="#8fb0ff" fill-opacity=".55"/>` +
    cells +
    '</g>'
  const shadow = lettering(KLWD, textX, 10.5 + 0.975, 'fill="#061233" fill-opacity=".75"')
  const letters = lettering(KLWD, textX, 10.5, 'fill="url(#c)" stroke="#061233" stroke-opacity=".6" stroke-width=".33"')

  return { svg: svgDocument(width, STUDIO + CHROME + ROW + GOLD, plate + shadow + letters), width, alt: chipAlt(count) }
}

// The tab: TUNE IN is the lower third's tab in gold; TUNE OUT the ticker
// clock's blue tab with its gold edge; TUNE IN dimmed when KLWD is full
export function tab(kind: TabKind): Picture {
  const word = kind === 'out' ? TUNE_OUT : TUNE_IN
  const x0 = 1 + HALF
  const face = 10 + word.width + 10

  if (kind === 'out') {
    const width = Math.ceil(x0 + 2 + face + HALF + 1)
    const body =
      `<g transform="${LEAN}">` +
      `<rect x="${num(x0)}" y="0" width="2" height="22" fill="#f2b630"/>` +
      `<rect x="${num(x0 + 2)}" y="0" width="${num(face)}" height="22" fill="url(#b)"/>` +
      `<rect x="${num(x0 + 2)}" y="0" width="${num(face)}" height="1" fill="#8fb0ff"/>` +
      '</g>' +
      lettering(word, x0 + 2 + 10, 11, 'fill="#ffffff"')
    return { svg: svgDocument(width, BAR, body), width, alt: TAB_ALT.out }
  }

  const width = Math.ceil(x0 + face + HALF + 1)
  const body =
    `<g transform="${LEAN}">` +
    `<rect x="${num(x0)}" y="0" width="${num(face)}" height="22" fill="url(#g)"/>` +
    `<rect x="${num(x0)}" y="0" width="${num(face)}" height="1" fill="#ffe08a"/>` +
    `<rect x="${num(x0)}" y="21" width="${num(face)}" height="1" fill="#b97d0c"/>` +
    `<rect x="${num(x0)}" y="1" width="${num(face)}" height="1" fill="#ffffff" fill-opacity=".5"/>` +
    '</g>' +
    lettering(word, x0 + 10, 11, 'fill="#2a1800"')

  if (kind === 'off') {
    return { svg: svgDocument(width, GOLD + DIM, `<g opacity=".4" filter="url(#d)">${body}</g>`), width, alt: TAB_ALT.off }
  }
  return { svg: svgDocument(width, GOLD, body), width, alt: TAB_ALT.in }
}

// What the band shows for this session
export function band(state: { tuned: boolean; onAir: number }): { chip: Picture; tab: Picture; kind: TabKind } {
  const kind: TabKind = state.tuned ? 'out' : state.onAir >= MAX_ON_AIR ? 'off' : 'in'
  return { chip: chip(state.onAir, state.tuned), tab: tab(kind), kind }
}

// A mod's Button shows only text, so the tab's button has a blank label: en
// spaces, enough to reach across the tab. The desktop draws a Button no wider
// than the Box that holds it, which is the tab's width.
export function blankLabel(width: number): string {
  return ' '.repeat(Math.ceil(width / 7) + 1)
}

// What a mod drew, as far as the band needs to know: an element with a type,
// props and children
export type Drawn<Child = unknown> = { type: string; props?: Record<string, unknown>; children?: readonly Child[] }

// The engine's own band is an empty Box; another mod's band has content.
export const hasContent = (drawn: Drawn): boolean => drawn.type !== 'Box' || (drawn.children?.length ?? 0) > 0

// The props of a plain row: the row's own layout and nothing else
const ROW_PROPS = new Set(['alignItems', 'columnGap', 'gap', 'rowGap', 'flexWrap', 'flexDirection'])

// What another mod drew, as items for our row. Its own row is lifted in item
// by item: a wrapping row nested in a wrapping row takes a whole line on the
// desktop, and would push the chip and the tab under it. Anything else it drew
// stays whole, styling and all.
export function besideItems<Whole extends Drawn<Child>, Child>(beneath: Whole): readonly (Whole | Child)[] {
  const props = beneath.props ?? {}
  const plain =
    beneath.type === 'Box' &&
    (beneath.children?.length ?? 0) > 0 &&
    Object.keys(props).every((key) => ROW_PROPS.has(key)) &&
    (props.flexDirection === undefined || props.flexDirection === 'row')
  return plain && beneath.children !== undefined ? beneath.children : [beneath]
}
