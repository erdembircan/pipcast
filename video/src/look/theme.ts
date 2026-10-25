// The look around the product: a warm paper ground and quiet ink, in the
// manner of Claude Code's own films, with KLWD's colours for accents.
import { loadFont as loadInter } from '@remotion/google-fonts/InterTight'
import { loadFont as loadNewsreader } from '@remotion/google-fonts/Newsreader'

export const SERIF = loadNewsreader('normal', { weights: ['400', '500', '600'], subsets: ['latin'] }).fontFamily
loadNewsreader('italic', { weights: ['400', '500'], subsets: ['latin'] })
export const SANS = loadInter('normal', { weights: ['400', '500', '600', '700'], subsets: ['latin'] }).fontFamily
export const MONO = 'ui-monospace, "SF Mono", Menlo, monospace'
export const STATION = '"Anybody", "Arial Black", sans-serif'

export const PAPER = '#f2f0e9'
export const INK = '#141413'
export const INK_SOFT = '#5e5d59'

/** KLWD's own colours, from design/tokens.json */
export const KLWD = {
  studioTop: '#1a3f93',
  studioInk: '#0b2260',
  studioDeep: '#061233',
  bar: '#1d48a8',
  gold: '#f2b630',
  goldHi: '#ffe08a',
  breaking: '#c4170e',
  breakingHi: '#ff5a4f',
  breakingDeep: '#5c070c',
}
