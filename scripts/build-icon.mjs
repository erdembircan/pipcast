// Draws pipcast's icon, KLWD's tower over the city at dusk with its beacon
// sending out the board's signal, in layers. assets/icon.svg stacks them as
// named groups, and assets/icon-layers holds each one on the icon's own canvas,
// with layers.json saying how they stack, for animating the icon. The colours
// are the design system's tokens and the call letters the band's outline, so
// the icon follows them. What it writes is the same on every machine; on a
// Mac, scripts/render-icon.sh renders the PNGs from it.

import { mkdirSync, readdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const root = fileURLToPath(new URL('..', import.meta.url))
const layersDir = path.join(root, 'assets', 'icon-layers')

const tokens = new Map(
  JSON.parse(readFileSync(path.join(root, 'design', 'tokens.json'), 'utf8')).color.tokens.map((t) => [t.name, t.value]),
)
function token(name) {
  if (!tokens.has(name)) throw new Error(`design/tokens.json has no colour named ${name}`)
  return tokens.get(name)
}

const art = readFileSync(path.join(root, 'packages', 'mod', 'src', 'core', 'art.generated.ts'), 'utf8')
const match = art.match(/export const KLWD: Word = \{ d: '([^']+)', width: ([\d.]+), top: (-?[\d.]+)/)
if (!match) {
  throw new Error('packages/mod/src/core/art.generated.ts has no KLWD outline: run npm run build:band-art first')
}
const KLWD = { d: match[1], width: +match[2], top: +match[3], cap: -match[3] }

const C = {
  skyTop: token('dusk-top'),
  skyMid: token('dusk-mid'),
  skyLow: token('dusk-glow'),
  tower: token('tower'),
  lit: token('window-lit'),
  beacon: token('beacon'),
  lampHi: token('breaking-text'),
  lampLo: token('breaking'),
  lampEdge: token('breaking-deep'),
  rim: token('bar-edge'),
  chromeHi: token('chrome-hi'),
  chrome: token('chrome'),
  chromeLo: token('chrome-lo'),
  onAir: token('on-air'),
  glass: 'rgba(255,255,255,0.06)',
  ink: 'rgba(6, 18, 51, 0.6)',
  inkShadow: 'rgba(6, 18, 51, 0.75)',
}

const TILE_RX = 228
const f = (n) => +n.toFixed(2)

function seeded(a) {
  return function () {
    a = (a + 0x6d2b79f5) | 0
    let t = Math.imul(a ^ (a >>> 15), 1 | a)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

const k = 2.5
const rnd = seeded(20261020)
const bx = 512
const beaconY = 236
const stW = 300
const stTop = 650
const st0 = bx - stW / 2
const base = 46
const tip = 12
const mTop = beaconY + 40
const bs = 44

function windows(x, top, w, from = 10 * k) {
  let lit = ''
  let dark = ''
  for (let wy = top + from; wy < 1024; wy += 14 * k) {
    for (let wx = x + 6 * k; wx < x + w - 8 * k; wx += 10 * k) {
      const r = rnd()
      const d = `M${f(wx)} ${f(wy)}h${4 * k}v${6 * k}h-${4 * k}z`
      if (r < 0.3) lit += d
      else dark += d
    }
  }
  return { lit, dark }
}

const sideTowers = []
function side(from, to, dir, prefix) {
  let x = from
  let n = 0
  while (dir > 0 ? x < to : x > to) {
    const w = (36 + Math.floor(rnd() * 5) * 10) * k
    const tall = (60 + Math.floor(rnd() * 10) * 10) * k * 0.8
    const top = 1024 - tall
    const x0 = dir > 0 ? x : x - w
    let body = `M${f(x0)} ${f(top)}h${f(w)}v${f(tall)}h-${f(w)}z`
    let beacons = ''
    let mast = false
    if (rnd() < 0.35) {
      mast = true
      const mx = x0 + Math.floor(w / 2) - k
      body += `M${f(mx)} ${f(top - 24 * k)}h${3 * k}v${24 * k}h-${3 * k}z`
      beacons = `M${f(mx - k)} ${f(top - 29 * k)}h${5 * k}v${5 * k}h-${5 * k}z`
    }
    const { lit, dark } = windows(x0, top, w)
    n += 1
    sideTowers.push({ name: `tower-${prefix}${n}`, x0, w, top, mast, body, dark, lit, beacons })
    x += dir * (w + (4 + Math.floor(rnd() * 3) * 4) * k)
  }
}
side(st0 - 6 * k, -40, -1, 'l')
side(st0 + stW + 6 * k, 1064, 1, 'r')
const stationBody = `M${st0} ${stTop}h${stW}v${1024 - stTop}h-${stW}z`
const station = windows(st0, stTop, stW, 96)

const mastPath = `M${bx - base} ${stTop}L${bx - tip} ${mTop}H${bx + tip}L${bx + base} ${stTop}Z`
let cuts = ''
const bays = 6
for (let i = 0; i < bays; i++) {
  const y1 = stTop - ((stTop - mTop) * i) / bays
  const y2 = stTop - ((stTop - mTop) * (i + 1)) / bays
  const w1 = base - ((base - tip) * i) / bays
  const w2 = base - ((base - tip) * (i + 1)) / bays
  const e = 9
  const a1 = w1 - e
  const a2 = w2 - e
  const gy = 4
  const yA = y1 - gy
  const yB = y2 + gy
  const ym = (y1 + y2) / 2
  cuts += `M${f(bx - a1 + 6)} ${f(yA)}L${f(bx + a1 - 6)} ${f(yA)}L${f(bx)} ${f(ym + 6)}Z`
  cuts += `M${f(bx - a2 + 4)} ${f(yB)}L${f(bx + a2 - 4)} ${f(yB)}L${f(bx)} ${f(ym - 6)}Z`
  cuts += `M${f(bx - a1 + 2)} ${f(yA - 4)}L${f(bx - a2 + 2)} ${f(yB + 4)}L${f(bx - 8)} ${f(ym)}Z`
  cuts += `M${f(bx + a1 - 2)} ${f(yA - 4)}L${f(bx + a2 - 2)} ${f(yB + 4)}L${f(bx + 8)} ${f(ym)}Z`
}

const RINGS = [
  [150, 16, 0.62],
  [272, 13, 0.38],
  [404, 10, 0.2],
]

function mark(cx, baseline, cap, id) {
  const s = cap / KLWD.cap
  const w = KLWD.width * s
  const x = cx - w / 2
  const em = 13
  return `<g transform="translate(${x.toFixed(2)} ${baseline.toFixed(2)}) scale(${s.toFixed(4)})">
    <linearGradient id="${id}" gradientUnits="userSpaceOnUse" x1="0" y1="${-KLWD.cap}" x2="0" y2="0">
      <stop offset="0" stop-color="${C.chromeHi}"/><stop offset="0.46" stop-color="${C.chrome}"/>
      <stop offset="0.52" stop-color="${C.chromeLo}"/><stop offset="0.74" stop-color="${C.chrome}"/>
      <stop offset="1" stop-color="${C.chromeHi}"/>
    </linearGradient>
    <path d="${KLWD.d}" transform="translate(0 ${0.075 * em})" fill="${C.inkShadow}" stroke="${C.inkShadow}" stroke-width="${0.05 * em}" stroke-linejoin="round"/>
    <path d="${KLWD.d}" fill="url(#${id})" stroke="${C.ink}" stroke-width="${0.05 * em}" stroke-linejoin="round" paint-order="stroke"/>
  </g>`
}

const DEFS = {
  'sky-fill': `<linearGradient id="sky-fill" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0" stop-color="${C.skyTop}"/><stop offset="0.6" stop-color="${C.skyMid}"/><stop offset="1" stop-color="${C.skyLow}"/>
    </linearGradient>`,
  'glow-fill': `<radialGradient id="glow-fill" cx="${bx}" cy="${beaconY}" r="170" gradientUnits="userSpaceOnUse">
      <stop offset="0" stop-color="${C.beacon}" stop-opacity="0.8"/><stop offset="0.3" stop-color="${C.beacon}" stop-opacity="0.28"/><stop offset="1" stop-color="${C.beacon}" stop-opacity="0"/>
    </radialGradient>`,
  'mast-fill': `<linearGradient id="mast-fill" x1="${bx - base}" y1="0" x2="${bx + base}" y2="0" gradientUnits="userSpaceOnUse">
      <stop offset="0" stop-color="${C.chromeLo}"/><stop offset="0.42" stop-color="${C.chromeHi}"/><stop offset="0.62" stop-color="${C.chrome}"/><stop offset="1" stop-color="${C.chromeLo}"/>
    </linearGradient>`,
  'lamp-fill': `<linearGradient id="lamp-fill" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0" stop-color="${C.lampHi}"/><stop offset="0.5" stop-color="${C.beacon}"/><stop offset="1" stop-color="${C.lampLo}"/>
    </linearGradient>`,
  'gloss-fill': `<linearGradient id="gloss-fill" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0" stop-color="${C.onAir}" stop-opacity="0.16"/><stop offset="1" stop-color="${C.onAir}" stop-opacity="0"/>
    </linearGradient>`,
}
const CLIP = `<clipPath id="tile-clip"><rect width="1024" height="1024" rx="${TILE_RX}"/></clipPath>`

const layers = []
function layer(name, parts, o) {
  const content = parts.filter((p) => p !== null).join('\n    ')
  layers.push({ name, content, defs: o.defs ?? [], entry: { name, svg: `${name}.svg`, png: `png/${name}.png`, bounds: o.bounds.map(f), anchor: o.anchor.map(f), with: o.with ?? null, ...(o.ring ? { ring: o.ring } : {}) } })
}
const pathOf = (d, attrs) => (d ? `<path d="${d}" ${attrs}/>` : null)

layer('sky', [`<rect width="1024" height="1024" fill="url(#sky-fill)"/>`], { defs: ['sky-fill'], bounds: [0, 0, 1024, 1024], anchor: [512, 512] })

RINGS.forEach(([r, w, a], i) => {
  layer(
    `ring-${i + 1}`,
    [`<circle cx="${bx}" cy="${beaconY}" r="${r}" fill="none" stroke="${C.onAir}" stroke-opacity="${a}" stroke-width="${w}"/>`],
    {
      bounds: [bx - r - w / 2, beaconY - r - w / 2, bx + r + w / 2, beaconY + r + w / 2],
      anchor: [bx, beaconY],
      ring: { cx: bx, cy: beaconY, r, strokeWidth: w, opacity: a },
    },
  )
})

for (const t of sideTowers) {
  const y = t.mast ? t.top - 29 * k : t.top
  const bounds = [t.x0, y, t.x0 + t.w, 1024]
  const anchor = [t.x0 + t.w / 2, 1024]
  layer(t.name, [pathOf(t.body, `fill="${C.tower}"`), pathOf(t.dark, `fill="${C.glass}"`)], { bounds, anchor })
  layer(`${t.name}-lights`, [pathOf(t.lit, `fill="${C.lit}" opacity="0.85"`), pathOf(t.beacons, `fill="${C.beacon}"`)], {
    bounds,
    anchor,
    with: t.name,
  })
}

const stationBounds = [st0, stTop, st0 + stW, 1024]
layer('station', [pathOf(stationBody, `fill="${C.tower}"`), pathOf(station.dark, `fill="${C.glass}"`)], {
  bounds: stationBounds,
  anchor: [bx, 1024],
})
layer('station-lights', [pathOf(station.lit, `fill="${C.lit}" opacity="0.85"`)], {
  bounds: stationBounds,
  anchor: [bx, 1024],
  with: 'station',
})
layer('station-sign', [mark(bx, stTop + 64, 40, 'sign-fill')], { bounds: stationBounds, anchor: [bx, 1024], with: 'station' })
layer(
  'mast',
  [
    `<path d="${mastPath}" fill="url(#mast-fill)" stroke="${C.ink}" stroke-width="3"/>`,
    `<path d="${cuts}" fill="${C.tower}" fill-opacity="0.9"/>`,
    `<rect x="${bx - 7}" y="${beaconY + bs / 2 - 2}" width="14" height="${mTop - beaconY - bs / 2 + 4}" fill="url(#mast-fill)"/>`,
  ],
  { defs: ['mast-fill'], bounds: [bx - base - 1.5, beaconY + bs / 2 - 2, bx + base + 1.5, stTop + 1.5], anchor: [bx, stTop], with: 'station' },
)
layer('beacon-glow', [`<circle cx="${bx}" cy="${beaconY}" r="170" fill="url(#glow-fill)"/>`], {
  defs: ['glow-fill'],
  bounds: [bx - 170, beaconY - 170, bx + 170, beaconY + 170],
  anchor: [bx, beaconY],
  with: 'mast',
})
layer(
  'beacon',
  [
    `<rect x="${bx - bs / 2}" y="${beaconY - bs / 2}" width="${bs}" height="${bs}" rx="4" fill="url(#lamp-fill)" stroke="${C.lampEdge}" stroke-opacity="0.5" stroke-width="2"/>`,
    `<rect x="${bx - bs / 2 + 6}" y="${beaconY - bs / 2 + 5}" width="${bs - 12}" height="${(bs - 12) / 2.4}" rx="3" fill="${C.onAir}" fill-opacity="0.4"/>`,
  ],
  { defs: ['lamp-fill'], bounds: [bx - bs / 2 - 1, beaconY - bs / 2 - 1, bx + bs / 2 + 1, beaconY + bs / 2 + 1], anchor: [bx, beaconY], with: 'mast' },
)
layer('gloss', [`<rect width="1024" height="560" fill="url(#gloss-fill)" opacity="0.5"/>`], {
  defs: ['gloss-fill'],
  bounds: [0, 0, 1024, 560],
  anchor: [512, 0],
})
layer(
  'rim',
  [`<rect x="1.5" y="1.5" width="1021" height="1021" rx="${TILE_RX - 1.5}" fill="none" stroke="${C.rim}" stroke-opacity="0.35" stroke-width="3"/>`],
  { bounds: [0, 0, 1024, 1024], anchor: [512, 512] },
)

const OPEN = '<svg xmlns="http://www.w3.org/2000/svg" width="1024" height="1024" viewBox="0 0 1024 1024">'
const group = (name, content) => `<g id="${name}">
    ${content}
  </g>`

function layerSvg(l) {
  const defs = l.defs.length ? `\n  <defs>\n    ${l.defs.map((id) => DEFS[id]).join('\n    ')}\n  </defs>` : ''
  return `${OPEN}
  <title>Pipcast icon: ${l.name}</title>${defs}
  ${group(l.name, l.content)}
</svg>
`
}

const compositeDefs = ['sky-fill', 'glow-fill', 'mast-fill', 'lamp-fill', 'gloss-fill'].map((id) => DEFS[id]).concat(CLIP)
const composite = `${OPEN}
  <title>Pipcast</title>
  <defs>
    ${compositeDefs.join('\n    ')}
  </defs>
  <g id="icon" clip-path="url(#tile-clip)">
  ${layers.map((l) => group(l.name, l.content)).join('\n  ')}
  </g>
</svg>
`

const mask = { name: 'tile-mask', content: `<rect width="1024" height="1024" rx="${TILE_RX}" fill="${C.onAir}"/>`, defs: [] }

const manifest = {
  name: 'Pipcast icon',
  canvas: [1024, 1024],
  png: [2048, 2048],
  points: { beacon: [bx, beaconY], mastFoot: [bx, stTop] },
  mask: { name: 'tile-mask', svg: 'tile-mask.svg', png: 'png/tile-mask.png' },
  layers: layers.map((l) => l.entry),
}

mkdirSync(layersDir, { recursive: true })
for (const file of readdirSync(layersDir)) {
  if (file.endsWith('.svg') || file === 'layers.json') rmSync(path.join(layersDir, file))
}
writeFileSync(path.join(root, 'assets', 'icon.svg'), composite)
for (const l of [...layers, mask]) writeFileSync(path.join(layersDir, `${l.name}.svg`), layerSvg(l))
writeFileSync(path.join(layersDir, 'layers.json'), JSON.stringify(manifest, null, 2) + '\n')
