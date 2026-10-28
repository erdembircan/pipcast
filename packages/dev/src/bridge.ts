// The cues' way into the development build's page. Its station sends each one
// as { type: 'dev', cue: <the cue file's text> }; every other message goes on
// to the page's own bridge.

import { receive } from '../../renderer/src/bridge.ts'

interface Host {
  pipcast?: { receive(message: unknown): void }
}

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null
}

// After installBridge: wraps the page's receive
export function installDevBridge(onCue: (text: string) => void): void {
  const host = window as unknown as Host
  const next = host.pipcast?.receive ?? receive
  host.pipcast = {
    receive(raw: unknown): void {
      let message: unknown = raw
      if (typeof raw === 'string') {
        try {
          message = JSON.parse(raw)
        } catch {
          message = null
        }
      }
      if (isObject(message) && message.type === 'dev') {
        if (typeof message.cue === 'string') {
          onCue(message.cue)
        }
        return
      }
      next(raw)
    },
  }
}
