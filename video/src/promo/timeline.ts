// KLWD WEATHER's promo, in seconds: one shot of the storm over KLWD's tower
// from start to end. Lightning strikes the beacon, the words ask the question
// and name the show, and KLWD's window flies out of the beacon into the storm
// to show each part of the forecast, with its name and what it does beside it,
// flipping from one to the next as a 90s station's graphics do; STORM WARNING
// breaks in on it as KLWD airs it, and the camera leans into STORMTRACKER.
// Then the window flies home into the beacon and the storm clears into the
// icon's dusk. The picture and the sound (scripts/music/storm.js,
// scripts/render-beat.mjs) both read it. Plain data only, with no imports, so
// Node can load it as it is.

export const FPS = 30

/** The parts of the one shot, each from its start to the next one's */
export const SCENES = {
  /** Night, rain, and the storm rolling in over KLWD's tower until the lightning strikes its beacon */
  storm: 0,
  /** The question, and the show's name, over the storm */
  cards: 9.0,
  /** KLWD's window flies out of the beacon and shows the forecast, one part at a time */
  show: 15.6,
  /** STORM WARNING breaking in on the window */
  alert: 31.4,
  /** The window flies home into the beacon */
  home: 50.6,
  /** The storm clearing into the icon's dusk; the icon and the name */
  clear: 51.4,
} as const

export const DURATION = 63.5

/** Lightning: when, where in the icon's units (a strike runs down to `to`), how bright, and whether a bolt shows */
export const FLASHES = [
  { at: 1.7, x: 120, y: 120, power: 0.35, r: 420 },
  { at: 3.4, x: 900, y: 60, power: 0.5, r: 480 },
  { at: 3.62, x: 940, y: 90, power: 0.3, r: 380 },
  { at: 5.1, x: 300, y: 40, power: 0.7, r: 560 },
  // The strike: down into the beacon
  { at: 6.9, x: 512, y: 20, power: 1.4, r: 700, bolt: { from: [430, -260], to: [512, 226], seed: 7 } },
  { at: 9.0, x: 760, y: 80, power: 0.9, r: 600, bolt: { from: [860, -300], to: [720, 300], seed: 3 } },
  { at: 12.2, x: 512, y: 30, power: 1.3, r: 760, bolt: { from: [600, -300], to: [512, 226], seed: 21 } },
  // Far off behind the window as it shows the forecast
  { at: 18.6, x: 980, y: 60, power: 0.45, r: 520 },
  { at: 23.8, x: 60, y: 80, power: 0.4, r: 520 },
  { at: 28.9, x: 900, y: 40, power: 0.5, r: 560 },
  { at: 31.4, x: 600, y: 30, power: 1.1, r: 700, bolt: { from: [760, -300], to: [700, 330], seed: 5 } },
  { at: 52.3, x: 980, y: 80, power: 0.35, r: 420 },
] as const

/** The strike into the beacon, and the signal it sends out: one ring on each of the logo's notes */
export const STRIKE = 6.9
export const SIGNAL_HITS = [6.9, 7.35, 7.8, 8.55] as const

/** The words over the storm: each slams in on its first hit, line by line, and leaves before the next */
export const CARDS = [
  { at: 9.0, until: 12.0, words: ['WILL YOUR WEEK', 'LAST?'] },
  { at: 12.2, until: 15.4, words: ['KLWD', 'WEATHER'], title: true, strap: 'YOUR USAGE, AS THE WEATHER' },
] as const

/**
 * What KLWD's window shows, one part of the forecast after another: the
 * scene (a sample of the design system's), its name beside the window, a tag
 * for when it airs and a line on what it does. The window flips from one to
 * the next; the parts of STORM WARNING follow on as KLWD airs them.
 */
export const FEATURES = [
  { at: 15.6, scene: 'weather-now-storm', name: ['CURRENT', 'CONDITIONS'], tag: 'ON THE HOUR', line: 'Your week so far, as the temperature' },
  { at: 21.0, scene: 'weather-days-storm', name: ['EXTENDED', 'FORECAST'], tag: 'ON THE HOUR', line: 'A day each until it resets: does the week last?' },
  { at: 26.4, scene: 'board-forecast', name: ['EVERY', 'QUARTER HOUR'], tag: ':15  :30  :45', line: 'The board turns to the forecast, and back' },
  { at: 31.4, scene: 'alert', name: ['STORM', 'WARNING'], tag: 'BREAKS IN', line: 'When the week looks like running out first', flip: false },
  { at: 33.3, scene: 'stormtracker', name: ['STORM', 'TRACKER'], tag: 'STORM WARNING', line: 'Follows the storm to the hour it hits', flip: false },
  { at: 46.3, scene: 'alert-outro', name: null, flip: false },
  { at: 47.7, scene: 'board-warning', name: ['WARNING', 'IN EFFECT'], tag: 'ON THE CRAWL', line: 'Until the week is safe again', flip: false },
] as const

/** The window: out of the beacon, the camera leaning into STORMTRACKER and back, home into the beacon */
export const WINDOW = { out: SCENES.show, landed: SCENES.show + 0.9, leanIn: 35.4, inside: 36.4, leanOut: 43.6, back: 44.6, home: SCENES.home, gone: SCENES.clear - 0.1 } as const

/** The window flips from one part to the next in this long, centred on the change */
export const FLIP = 0.5

/** STORM WARNING as KLWD airs it: WEATHER ALERT (1.9 s), STORMTRACKER, the outro (1.4 s), back to the board */
export const WARNING = { alert: 31.4, tracker: 33.3, outro: 46.3, board: 47.7, until: SCENES.home } as const

/** The clearing: the rain stops and the clouds part over the city, the camera pulls back to the icon's tile, then the name */
export const CLEAR = { rainOut: 54.0, tile: 55.0, name: 56.9, end: 62.7 } as const

/** KLWD's jingles where the station plays them, from plugin/station/sounds */
export const JINGLES = [
  { name: 'weather-alert', at: WARNING.alert, from: 0 },
  { name: 'breaking-out', at: WARNING.outro, from: 0 },
] as const

/** KLWD's beat, as the station lays it: under the forecast, cut as WEATHER ALERT breaks in, and in D minor under STORMTRACKER as under a story's desk */
export const BEDS = [
  { bed: 'beat-minor', from: WINDOW.landed, until: WARNING.alert, cut: true },
  { bed: 'beat-minor', from: WARNING.tracker, until: WARNING.outro },
] as const

/** The name card's logo on the bells, in D major as the storm clears: A, D, A, D */
export const NAME_HITS = [CLEAR.name, CLEAR.name + 0.25, CLEAR.name + 0.5, CLEAR.name + 1.0] as const
