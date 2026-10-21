// The mod's state contract: the values the band draws from.
// `tuned`: this session is on air. `onAir`: how many sessions are on air across the Mac.
export type BandState = { tuned: boolean; onAir: number }

declare module 'claude-code' {
  interface PluginState {
    pipcast: { tuned: boolean; onAir: number }
  }
}
