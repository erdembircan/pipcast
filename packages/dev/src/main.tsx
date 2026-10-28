// The development build's page, which scripts/build-web.mjs --dev builds into
// .dev/web, and scripts/build-dev.sh puts in the development build of the
// plugin, never in plugin/: the station's own page, with the dev director in
// front of its director, taking the cues the development build of the station
// hands it.

// react-global.ts first: the design system's bundle reads window.React as it loads
import '../../renderer/src/react-global.ts'

import { createRoot } from 'react-dom/client'

import { App, prefersReducedMotion } from '../../renderer/src/App.tsx'
import { installBridge, post } from '../../renderer/src/bridge.ts'
import { samples } from '../../renderer/src/design.ts'
import { installDevBridge } from './bridge.ts'
import { defaultsFrom } from './defaults.ts'
import { createDevDirector } from './director.ts'
import type { DevDirector } from './director.ts'

function boot(): void {
  const container = document.getElementById('root')
  if (container === null) {
    return
  }
  installBridge()
  window.addEventListener('error', (event) => {
    post({ type: 'log', level: 'error', text: event.message })
  })
  const reducedMotion = prefersReducedMotion()
  const dev: DevDirector = createDevDirector({
    reducedMotion,
    defaults: defaultsFrom(samples),
    log: (text) => post({ type: 'log', level: 'info', text }),
  })
  installDevBridge((text) => dev.cue(text))
  // The one dev director, for as long as the page lives
  const source = () => dev
  createRoot(container).render(<App reducedMotion={reducedMotion} createSource={source} />)
}

boot()
