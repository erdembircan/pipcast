// react-global.ts first: the design system's bundle reads window.React as it loads
import './react-global.ts'

import { createRoot } from 'react-dom/client'

import { App } from './App.tsx'
import { installBridge, post } from './bridge.ts'
import { startDemo } from './demo.ts'
import { StillPage } from './still.tsx'

function boot(): void {
  const container = document.getElementById('root')
  if (container === null) {
    return
  }
  installBridge()
  window.addEventListener('error', (event) => {
    post({ type: 'log', level: 'error', text: event.message })
  })

  const hash = window.location.hash
  const root = createRoot(container)
  if (hash.startsWith('#still')) {
    root.render(<StillPage />)
  } else {
    root.render(<App />)
    if (hash === '#demo') {
      startDemo()
    }
  }
}

boot()
