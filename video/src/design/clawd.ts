// Clawd's acts at the desk, pose by pose: the design system's own schedule
// (actFrame in design/components/bundle.js), which there runs only on Clawd's
// timer. Drawn from a time here, so the video can scrub through it. Clawd
// appears only at the anchor desk.
import type { ClawdArms, ClawdEyes, ClawdFacing } from './pipnews.ts'

export type ClawdAct = 'idle' | 'talk' | 'urgent' | 'cheer' | 'swivel' | 'glance'

export interface ClawdFrame {
  eyes: ClawdEyes
  arms: ClawdArms
  facing?: ClawdFacing
  bob: number
}

const SWIVEL: ClawdFacing[] = ['edge', 'right-75', 'right-55', 'right-30', 'right-12']

/** Clawd steps 12 times a second, so the time is taken to his last step. */
export function clawdFrame(act: ClawdAct, seconds: number): ClawdFrame {
  const t = Math.floor(Math.max(0, seconds) * 12) / 12
  const f: ClawdFrame = { eyes: 'open', arms: 'down', bob: 0 }
  const blink = t % 3.8 < 0.14
  if (act === 'talk') {
    f.arms = (['down', 'one-up', 'down', 'down'] as const)[Math.floor(t * 2.4) % 4] ?? 'down'
    f.bob = Math.round(Math.sin(t * 8) * 2)
    if (blink) f.eyes = 'closed'
  } else if (act === 'urgent') {
    f.arms = Math.floor(t * 3) % 2 ? 'up' : 'one-up'
    f.bob = -Math.round(Math.abs(Math.sin(t * 9)) * 3)
    if (blink) f.eyes = 'closed'
  } else if (act === 'cheer') {
    f.arms = Math.floor(t * 3) % 2 ? 'down' : 'up'
    f.bob = -Math.round(Math.abs(Math.sin(t * 6)) * 6)
    if (blink) f.eyes = 'closed'
  } else if (act === 'swivel') {
    const i = Math.floor(t * 10)
    if (i < SWIVEL.length) f.facing = SWIVEL[i]
    else if (blink) f.eyes = 'closed'
  } else if (act === 'glance') {
    f.eyes = t % 5 < 2.5 ? 'right' : 'open'
  } else {
    if (blink) f.eyes = 'closed'
    const c = t % 9
    if (c > 6 && c < 6.9) f.eyes = 'left'
  }
  return f
}
