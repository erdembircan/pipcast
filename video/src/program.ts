// What KLWD airs at every moment of the video, in global seconds, the way the
// director runs it: the board, then each story's BREAKING NEWS, desk and
// outro, the report on the hour, and the board again.
import type { Scene } from './design/pipnews.ts'
import {
  DESK_MIGRATION,
  DESK_READY,
  HOUR_DESK,
  HOUR_REVIEW,
  IDENT,
  STINGER_ASK,
  STINGER_MIGRATION,
  STINGER_READY,
  boardAfterHour,
  boardAfterMigration,
  boardReady,
  boardThree,
  deskAsk,
  outroTo,
} from './stories.ts'
import { ASK, COLD, HOUR, NEWS, SCENES } from './timeline.ts'

export interface OnAirStep {
  at: number
  scene: Scene | ((t: number) => Scene)
  /** When this scene's crawl started, if before the scene itself: a board keeps the crawl its outro began */
  crawlFrom?: number
  identFrom?: number
}

export const PROGRAM: OnAirStep[] = [
  { at: 0, scene: boardThree('17:40') },
  { at: COLD.stinger, scene: STINGER_READY },
  { at: COLD.desk, scene: DESK_READY },
  { at: COLD.outro, scene: outroTo(boardReady('17:41', false)) },
  { at: COLD.board, scene: boardReady('17:41', false), crawlFrom: COLD.outro },
  // The checkout session tunes in during the tune-in scene, and is on the board when the window next shows
  { at: SCENES.tuneIn, scene: boardReady('17:43', true) },
  { at: ASK.stinger, scene: STINGER_ASK },
  { at: ASK.desk, scene: (t) => deskAsk(3 + t) },
  // Back to Claude: the window hides, and when it shows again the board has the checkout session working again
  { at: ASK.back, scene: boardReady('17:48', true) },
  { at: SCENES.hour, scene: boardReady('17:59', true), crawlFrom: ASK.back },
  { at: HOUR.ident, scene: IDENT, identFrom: 0.4 },
  { at: HOUR.desk, scene: HOUR_DESK },
  { at: HOUR.review, scene: HOUR_REVIEW, crawlFrom: HOUR.desk },
  { at: HOUR.outro, scene: outroTo(boardAfterHour('18:00'), 'hour', '18:00') },
  { at: HOUR.board, scene: boardAfterHour('18:00'), crawlFrom: HOUR.outro },
  { at: SCENES.window, scene: boardAfterHour('18:02'), crawlFrom: HOUR.outro },
  // The window is tucked into the side when the migration finishes: the story brings it out, and it goes back as the outro ends
  { at: NEWS.stinger, scene: STINGER_MIGRATION },
  { at: NEWS.desk, scene: DESK_MIGRATION },
  { at: NEWS.outro, scene: outroTo(boardAfterMigration('18:03')) },
  { at: NEWS.board, scene: boardAfterMigration('18:03'), crawlFrom: NEWS.outro },
]

export interface OnAirNow {
  scene: Scene
  t: number
  crawl: number
  identFrom: number
}

export function onAir(T: number): OnAirNow {
  let step = PROGRAM[0]!
  for (const s of PROGRAM) {
    if (s.at <= T) step = s
  }
  const t = T - step.at
  const scene = typeof step.scene === 'function' ? step.scene(t) : step.scene
  return { scene, t, crawl: T - (step.crawlFrom ?? step.at), identFrom: step.identFrom ?? 0 }
}
