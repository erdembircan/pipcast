// The mod's state contract: the values the band draws from, and one the hooks keep.
// `tuned`: this session is on air. `onAir`: how many sessions are on air across the Mac.
// `due`: a new session waits to tune in by itself until the desktop app shows it.
export type BandState = { tuned: boolean; onAir: number }

declare module 'claude-code' {
  interface PluginState {
    pipcast: { tuned: boolean; onAir: number; due: boolean }
  }
}
