// The design system the product draws with, loaded as it is: bundle.js defines
// window.PipNews and reads window.React as it loads, so React goes on window
// first. Its stylesheet comes in as a string (see DesignStyles).
import './react-global.ts'
import '../../../design/components/bundle.js'

import type { ComponentType, ReactNode } from 'react'

import type {
  BandProps,
  ClawdProps,
  HourReviewProps,
  IdentProps,
  LowerThirdProps,
  MarkProps,
  NewsDeskProps,
  OTSBoxProps,
  PipControlsProps,
  PipProps,
  PromptSketchProps,
  Scene,
  SessionBoardProps,
  StatePillProps,
  StingerProps,
  TickerProps,
  TopBandProps,
} from '../../../design/components/index.d.ts'

export type {
  ClawdArms,
  ClawdEyes,
  ClawdFacing,
  EventKind,
  HourRow,
  LimitMeter,
  NewsEvent,
  Scene,
  Session,
  SessionState,
  TickerItem,
} from '../../../design/components/index.d.ts'

export interface StageProps {
  width?: number
  animate?: boolean
  children?: ReactNode
}

export interface PipNewsHandle {
  Pip: ComponentType<PipProps & { children?: ReactNode }>
  PipControls: ComponentType<PipControlsProps>
  Stage: ComponentType<StageProps>
  TopBand: ComponentType<TopBandProps>
  Ticker: ComponentType<TickerProps>
  LowerThird: ComponentType<LowerThirdProps>
  Stinger: ComponentType<StingerProps>
  Ident: ComponentType<IdentProps>
  SessionBoard: ComponentType<SessionBoardProps>
  StatePill: ComponentType<StatePillProps>
  NewsDesk: ComponentType<NewsDeskProps>
  OTSBox: ComponentType<OTSBoxProps>
  HourReview: ComponentType<HourReviewProps>
  Clawd: ComponentType<ClawdProps>
  Mark: ComponentType<MarkProps>
  Band: ComponentType<BandProps>
  PromptSketch: ComponentType<PromptSketchProps>
  samples: Record<string, Scene>
  crawlSpeed: number
}

const handle = (window as unknown as { PipNews?: PipNewsHandle }).PipNews

if (handle === undefined) {
  throw new Error('the design system did not load: window.React was missing when its bundle ran')
}

export const PipNews: PipNewsHandle = handle
