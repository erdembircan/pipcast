// The video's running order, in seconds. The soundtrack's score reads it too
// (scripts/render-audio.mjs), so the music's sections and hits stay on the
// picture's cuts. It holds plain data only, with no imports, so Node can load
// it as it is.

export const FPS = 30
export const BPM = 120
/** One bar of 4/4 at 120 BPM: 2 seconds */
export const BAR = (4 * 60) / BPM

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
  /** The window's tricks: another desktop, another corner, into the side and out for the news, smaller */
  window: 65,
  /** The window becomes the icon, and the icon builds itself */
  finale: 87,
  endCard: 97,
} as const

/** The finale runs 17 seconds, to the end */
export const DURATION = SCENES.finale + 17

/** The cold open's story */
export const COLD = { stinger: 2.0, desk: 3.9, outro: 8.0, board: 9.2 } as const
/** The story that needs you, cut short by Back to Claude */
export const ASK = { stinger: 38.0, desk: 39.9, back: 43.8 } as const
/** The report on the hour: the ident joins two seconds before the strike */
export const HOUR = { ident: 53.0, strike: 55.0, desk: 57.5, review: 60.0, outro: 63.5, board: 64.9 } as const
/**
 * The story that brings the window out of the side: shorter than on air, to
 * show the window coming out as it starts and going back as it ends
 */
export const NEWS = { stinger: 74.0, desk: 75.9, outro: 77.4, board: 78.6 } as const

/** When each jingle starts, from where in its file, when a story that is cut hushes it, and a level for one that lands on a loud beat */
export const JINGLES = [
  { name: 'breaking', at: COLD.stinger, from: 0 },
  { name: 'breaking-out', at: COLD.outro, from: 0 },
  // Back to Claude hides the window, and the story's jingle with it
  { name: 'breaking', at: ASK.stinger, from: 0, cut: ASK.back },
  // three seconds into its 7.5 s run, so the strike lands at HOUR.strike
  { name: 'hour', at: HOUR.ident, from: 3 },
  { name: 'hour-out', at: HOUR.outro, from: 0 },
  { name: 'breaking', at: NEWS.stinger, from: 0 },
  // its last chord lands on the drive's kick: a little lower, so the encoded peak stays under -1 dBFS
  { name: 'breaking-out', at: NEWS.outro, from: 0, level: 0.85 },
] as const

/**
 * Where KLWD's beat plays, as the station plays it: it mixes in as a desk
 * starts, plays on under the hour's review, and phases out as the outro
 * starts, or hushes with everything else when a story is cut
 * (scripts/render-beat.mjs lays it)
 */
export const BEDS = [
  { bed: 'beat-minor', from: COLD.desk, until: COLD.outro },
  // Back to Claude hides the window: the beat hushes with the story
  { bed: 'beat-minor', from: ASK.desk, until: ASK.back, cut: true },
  { bed: 'beat-major', from: HOUR.desk, until: HOUR.outro },
  { bed: 'beat-minor', from: NEWS.desk, until: NEWS.outro },
] as const

/**
 * The soundtrack's plan: each section from its start to the next one's, with
 * how much it carries (0 is silence, 1 the full groove). The music never stops
 * once it has started. Only while KLWD's own sound plays does it break down: to
 * a pedal (a soft D, no third, no rhythm) under BREAKING NEWS, which is in D
 * minor, and the beat that comes in with its desk, or to a warm D major pad
 * under the hour's fanfare and its beat. As soon as the beat goes, the drive
 * brings the music's own beat back (drums and bass over the D, no third) until
 * the groove returns, so its 120 to the minute never plays against the beat's
 * 132.
 */
export const MUSIC = [
  // The cold open belongs to KLWD's own jingles and beat, over a soft D held from the first frame; the music proper starts on the outro's D major chord
  { at: 0, section: 'pedal', energy: 0.25 },
  { at: 9.0, section: 'intro', energy: 0.35 },
  { at: 12.0, section: 'logo', energy: 0.45 },
  { at: 14.0, section: 'lift', energy: 0.5 },
  { at: 16.0, section: 'groove', energy: 0.75 },
  { at: 28.0, section: 'groove', energy: 0.9 },
  { at: 36.0, section: 'groove', energy: 0.8 },
  // BREAKING NEWS, then the beat under its desk until Back to Claude hushes it
  { at: 37.5, section: 'pedal', energy: 0.3 },
  { at: ASK.back, section: 'build', energy: 0.6 },
  { at: 46.0, section: 'groove', energy: 0.9 },
  // The hour's pips and fanfare, then the beat under its desk and review until the outro
  { at: 52.5, section: 'pad', energy: 0.4 },
  { at: HOUR.outro, section: 'drive', energy: 0.6 },
  { at: 64.5, section: 'build', energy: 0.6 },
  { at: 65.0, section: 'groove', energy: 0.85 },
  // The story while the window is tucked away: its jingle, then the beat under its desk until its outro
  { at: NEWS.stinger - 0.5, section: 'pedal', energy: 0.3 },
  { at: NEWS.outro, section: 'drive', energy: 0.6 },
  { at: 79.5, section: 'build', energy: 0.6 },
  { at: 80.0, section: 'groove', energy: 0.85 },
  { at: SCENES.finale - 1, section: 'build', energy: 0.7 },
  { at: SCENES.finale + 4.75, section: 'logo', energy: 0.9 },
  { at: SCENES.finale + 7.5, section: 'finale', energy: 1 },
  { at: SCENES.endCard, section: 'outro', energy: 0.5 },
  { at: DURATION, section: 'end', energy: 0 },
] as const

/** The station's four-note logo on the bells as the icon's beacon lights and its signals go out: A, D, A, D */
export const LOGO_HITS = [SCENES.finale + 4.75, SCENES.finale + 5.5, SCENES.finale + 6.25, SCENES.finale + 7.25] as const

/** The name card's logo, as PiP and broadcast become Pipcast */
export const NAME_HITS = [12.0, 12.25, 12.5, 13.0] as const
