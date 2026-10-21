// The page's side of the bridge to the station. The station calls
// window.pipcast.receive(message); the page posts to the station's script
// message handler when there is one (there is none in an ordinary browser).
import type { HostMessage, PageMessage } from '@pipcast/contract'

interface Host {
  pipcast?: { receive(message: unknown): void }
  webkit?: { messageHandlers?: { pipcast?: { postMessage(message: unknown): void } } }
}

export type Listener = (message: HostMessage) => void

const listeners = new Set<Listener>()

// A still that arrives before anything listens: the station answers `ready`
// as soon as it can, which can be before the page's effects have subscribed
let waitingStill: HostMessage | null = null

export function subscribe(listener: Listener): () => void {
  listeners.add(listener)
  if (waitingStill !== null) {
    const waiting = waitingStill
    waitingStill = null
    listener(waiting)
  }
  return () => {
    listeners.delete(listener)
  }
}

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null
}

// Takes a message as an object or as JSON text, and passes on the types the
// page understands. Anything else is ignored.
export function receive(raw: unknown): void {
  let message = raw
  if (typeof raw === 'string') {
    try {
      message = JSON.parse(raw)
    } catch {
      return
    }
  }
  if (!isObject(message)) {
    return
  }
  if (message.type !== 'snapshot' && message.type !== 'still') {
    return
  }
  if (listeners.size === 0 && message.type === 'still') {
    waitingStill = message as unknown as HostMessage
    return
  }
  for (const listener of [...listeners]) {
    listener(message as unknown as HostMessage)
  }
}

export function installBridge(): void {
  ;(window as unknown as Host).pipcast = { receive }
}

// Does nothing when the station is not there
export function post(message: PageMessage): void {
  const handler = (window as unknown as Host).webkit?.messageHandlers?.pipcast
  if (handler !== undefined) {
    handler.postMessage(message)
  }
}
