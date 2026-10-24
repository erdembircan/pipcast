// The band's picture, as an SVG document: one plate. The bug's KLWD in chrome
// on the studio plate with its gold edge, and at its end the action, TUNE IN
// on the lower third's gold or TUNE OUT on the ticker clock's blue, parted
// from the mark by an edge of its own. There is no count: the plate is the
// same however many sessions are on KLWD. It is the design system's Band
// (design/components/Band) drawn for the desktop, which draws a mod's Svg as
// an image: an image loads no fonts and cannot read the app's theme, so the
// lettering is outlines (art.generated.ts) and the plate carries its own
// ground.

import { BAND_ALT } from '../../../contract/src/copy.ts'
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
const GOLD =
  '<linearGradient id="g" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#ffe08a"/><stop offset=".55" stop-color="#f2b630"/><stop offset="1" stop-color="#b97d0c"/></linearGradient>'
const BAR =
  '<linearGradient id="b" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#1d48a8"/><stop offset="1" stop-color="#163a8c"/></linearGradient>'

export interface Picture {
  svg: string
  width: number
  alt: string
}

// What pressing the plate does: tune this session in, or out
export type BandKind = 'in' | 'out'

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

// The plate: the gold edge, the studio plate with its lit top edge, KLWD in
// chrome with its shadow, then the action's own edge and the action. TUNE IN
// is gold with a dark gold edge and words in on-gold; TUNE OUT is the bar's
// blue with a lit top, a gold edge and white words.
export function plate(kind: BandKind): Picture {
  const word = kind === 'out' ? TUNE_OUT : TUNE_IN
  const mark = KLWD.width + 1.3
  const edge = 1 + HALF
  const plateX = edge + 2
  const textX = plateX + 6
  const partX = textX + mark + 6
  const actX = partX + 2
  const actWidth = 10 + word.width + 10
  const plateWidth = actX + actWidth - plateX
  const width = Math.ceil(actX + actWidth + HALF + 1)

  const action =
    kind === 'out'
      ? `<rect x="${num(partX)}" y="0" width="2" height="22" fill="#f2b630"/>` +
        `<rect x="${num(actX)}" y="0" width="${num(actWidth)}" height="22" fill="url(#b)"/>` +
        `<rect x="${num(actX)}" y="0" width="${num(actWidth)}" height="1" fill="#8fb0ff"/>`
      : `<rect x="${num(partX)}" y="0" width="2" height="22" fill="#b97d0c"/>` +
        `<rect x="${num(actX)}" y="0" width="${num(actWidth)}" height="22" fill="url(#g)"/>` +
        `<rect x="${num(actX)}" y="0" width="${num(actWidth)}" height="1" fill="#ffffff" fill-opacity=".5"/>`
  const body =
    `<g transform="${LEAN}">` +
    `<rect x="${num(edge)}" y="0" width="2" height="22" fill="#f2b630"/>` +
    `<rect x="${num(plateX)}" y="0" width="${num(plateWidth)}" height="22" fill="url(#s)"/>` +
    `<rect x="${num(plateX)}" y="0" width="${num(plateWidth)}" height="1" fill="#8fb0ff" fill-opacity=".55"/>` +
    action +
    '</g>'
  const shadow = lettering(KLWD, textX, 10.5 + 0.975, 'fill="#061233" fill-opacity=".75"')
  const letters = lettering(KLWD, textX, 10.5, 'fill="url(#c)" stroke="#061233" stroke-opacity=".6" stroke-width=".33"')
  const words = lettering(word, actX + 10, 11, kind === 'out' ? 'fill="#ffffff"' : 'fill="#2a1800"')
  const defs = STUDIO + CHROME + (kind === 'out' ? BAR : GOLD)

  return { svg: svgDocument(width, defs, body + shadow + letters + words), width, alt: BAND_ALT[kind] }
}

// What the band shows for this session
export function band(state: { tuned: boolean }): { picture: Picture; kind: BandKind } {
  const kind: BandKind = state.tuned ? 'out' : 'in'
  return { picture: plate(kind), kind }
}

// How far the box that holds the plate's button reaches past the plate on
// each side, in columns
export const REACH = 2

// A mod's Button shows only text, so the plate's button has a blank label: en
// spaces, about one for every 8 px of the plate. The desktop draws a Button no
// wider than the Box that holds it and cuts a longer label with an ellipsis,
// so the label stays short of the plate and its Box reaches REACH columns past
// the plate on each side, as usage-band's padlock does.
export function blankLabel(width: number): string {
  return ' '.repeat(Math.max(1, Math.floor(width / 8)))
}
