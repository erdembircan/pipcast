// The video's running order, in seconds. The soundtrack's score reads it too
// (scripts/render-audio.mjs), so the music's sections and hits stay on the
// picture's cuts. It holds plain data only, with no imports, so Node can load
// it as it is.

export const FPS = 30
export const BPM = 120
/** One bar of 4/4 at 120 BPM: 2 seconds */
export const BAR = (4 * 60) / BPM
export const DURATION = 96

/** The scenes, in order, each from its start to the next one's */
export const SCENES = {
  /** Cold open: a working desktop, KLWD in its corner, and BREAKING NEWS */
  cold: 0,
  /** PiP and broadcast become one word */
  name: 10,
  tuneIn: 16,
  board: 28,
  /** A session needs you: BREAKING NEWS, then Back to Claude */
  needsYou: 36,
  hour: 51,
  window: 65,
  /** The window becomes the icon, and the icon builds itself */
  finale: 79,
  endCard: 89,
} as const

/** The cold open's story */
export const COLD = { stinger: 2.0, desk: 3.9, outro: 8.0, board: 9.2 } as const
/** The story that needs you, cut short by Back to Claude */
export const ASK = { stinger: 38.0, desk: 39.9, back: 43.8 } as const
/** The report on the hour: the ident joins two seconds before the strike */
export const HOUR = { ident: 53.0, strike: 55.0, desk: 57.5, review: 60.0, outro: 63.5, board: 64.9 } as const

/** When each jingle starts, and from where in its file */
export const JINGLES = [
  { name: 'breaking', at: COLD.stinger, from: 0 },
  { name: 'breaking-out', at: COLD.outro, from: 0 },
  { name: 'breaking', at: ASK.stinger, from: 0 },
  // three seconds into its 7.5 s run, so the strike lands at HOUR.strike
  { name: 'hour', at: HOUR.ident, from: 3 },
  { name: 'hour-out', at: HOUR.outro, from: 0 },
] as const

/**
 * The soundtrack's plan: each section from its start to the next one's, with
 * how much it carries (0 is silence, 1 the full groove). The music never stops
 * once it has started. Only while a jingle plays does it break down, to a
 * pedal (a soft D, no third, no rhythm) under BREAKING NEWS, which is in D
 * minor and brings its own beat, or to a warm D major pad under the hour's
 * fanfare; as soon as the jingle is done, the drive brings the beat back (drums
 * and bass over the D, no third) until the groove returns.
 */
export const MUSIC = [
  // The cold open belongs to KLWD's own jingles, over a soft D held from the first frame; the music proper starts on the outro's D major chord
  { at: 0, section: 'pedal', energy: 0.25 },
  { at: 9.0, section: 'intro', energy: 0.35 },
  { at: 12.0, section: 'logo', energy: 0.45 },
  { at: 14.0, section: 'lift', energy: 0.5 },
  { at: 16.0, section: 'groove', energy: 0.75 },
  { at: 28.0, section: 'groove', energy: 0.9 },
  { at: 36.0, section: 'groove', energy: 0.8 },
  // BREAKING NEWS's own beat runs to about 41.8 and fades by 43.1
  { at: 37.5, section: 'pedal', energy: 0.3 },
  { at: 42.0, section: 'drive', energy: 0.6 },
  { at: 43.8, section: 'build', energy: 0.6 },
  { at: 46.0, section: 'groove', energy: 0.9 },
  // The hour's pips and fanfare ring out by about 58
  { at: 52.5, section: 'pad', energy: 0.4 },
  { at: 58.0, section: 'drive', energy: 0.6 },
  { at: 64.5, section: 'build', energy: 0.6 },
  { at: 65.0, section: 'groove', energy: 0.85 },
  { at: 78.0, section: 'build', energy: 0.7 },
  { at: 83.75, section: 'logo', energy: 0.9 },
  { at: 86.5, section: 'finale', energy: 1 },
  { at: 89.0, section: 'outro', energy: 0.5 },
  { at: 96.0, section: 'end', energy: 0 },
] as const

/** The station's four-note logo on the bells as the icon's beacon lights and its signals go out: A, D, A, D */
export const LOGO_HITS = [83.75, 84.5, 85.25, 86.25] as const

/** The name card's logo, as PiP and broadcast become Pipcast */
export const NAME_HITS = [12.0, 12.25, 12.5, 13.0] as const
