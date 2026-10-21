// Importing the design system's bundle for its side effect: it defines
// window.PipNews. react-global.ts must have run first, because the bundle
// reads window.React as it loads.
import '../../../design/components/bundle.js'

import type { ComponentType, ReactNode } from 'react'

import type { BroadcastProps, Scene } from '@pipcast/design'

export interface StageProps {
  // Width in px; the stage keeps 16:9
  width?: number
  animate?: boolean
  children?: ReactNode
}

export interface PipNewsHandle {
  Broadcast: ComponentType<BroadcastProps>
  Stage: ComponentType<StageProps>
  // The design system's example scenes, by name
  samples: Record<string, Scene>
}

export const PipNews = (window as unknown as { PipNews?: PipNewsHandle }).PipNews as PipNewsHandle

if (PipNews === undefined) {
  throw new Error('the design system did not load: window.React was missing when its bundle ran')
}

export const { Broadcast, Stage, samples } = PipNews
