// A stand-in for a WebGL 2 context that does no drawing and records what it is asked. Its constants are numbers, its
// calls are logged with their arguments, and it keeps count of what it has made and not yet deleted.
import { vi } from 'vitest'

export interface Call {
  name: string
  args: unknown[]
}

export interface FakeGL {
  gl: object
  calls: Call[]
  // How many times a call was made
  count(name: string): number
  // What was made with `create…` and not given back with `delete…`, by kind
  live(): Record<string, number>
  // The calls made since the last time it was asked: a frame's, when it is asked after each
  since(): Call[]
}

interface Options {
  // The pictures cannot be uploaded, as WebKit refuses where the page may not read other files
  insecure?: boolean
  // The shaders do not compile
  badShader?: boolean
}

export function fakeGL(options: Options = {}): FakeGL {
  const calls: Call[] = []
  const made = new Set<{ kind: string }>()
  const constants = new Map<string, number>()
  const target: Record<string, unknown> = {}

  function record(name: string, args: unknown[]): void {
    calls.push({ name, args: args.map((arg) => (ArrayBuffer.isView(arg) ? Array.from(arg as unknown as ArrayLike<number>) : Array.isArray(arg) ? [...arg] : arg)) })
  }
  function answer(name: string, args: unknown[]): unknown {
    if (name.startsWith('create')) {
      const thing = { kind: name.slice('create'.length) }
      made.add(thing)
      return thing
    }
    if (name.startsWith('delete')) {
      made.delete(args[0] as { kind: string })
      return undefined
    }
    switch (name) {
      case 'getShaderParameter':
      case 'getProgramParameter':
        return !options.badShader
      case 'getShaderInfoLog':
      case 'getProgramInfoLog':
        return 'a stand-in log'
      case 'getUniformLocation':
        return { uniform: args[1] }
      case 'getExtension':
        if (args[0] === 'WEBGL_lose_context') {
          return { loseContext: () => record('loseContext', []) }
        }
        return { MAX_TEXTURE_MAX_ANISOTROPY_EXT: 1, TEXTURE_MAX_ANISOTROPY_EXT: 2 }
      case 'getParameter':
        return 16
      case 'isContextLost':
        return false
      case 'texSubImage2D':
        if (options.insecure) {
          throw new DOMException('The operation is insecure.', 'SecurityError')
        }
        return undefined
      default:
        return undefined
    }
  }
  const gl = new Proxy(target, {
    get(_target, key) {
      if (typeof key !== 'string') {
        return undefined
      }
      if (key === key.toUpperCase()) {
        if (!constants.has(key)) {
          constants.set(key, constants.size + 1)
        }
        return constants.get(key)
      }
      return (...args: unknown[]) => {
        record(key, args)
        return answer(key, args)
      }
    },
  })

  let since = 0
  return {
    gl,
    calls,
    count: (name) => calls.filter((call) => call.name === name).length,
    live() {
      const kinds: Record<string, number> = {}
      for (const thing of made) {
        kinds[thing.kind] = (kinds[thing.kind] ?? 0) + 1
      }
      return kinds
    },
    since() {
      const out = calls.slice(since)
      since = calls.length
      return out
    },
  }
}

// A 2D context for the canvases the globe paints its spiral and its dots on: every call answers with another stand-in
export function paintContext(): object {
  const standIn: object = new Proxy(function () {}, {
    get: (_target, key) => (key === Symbol.toPrimitive ? () => 0 : standIn),
    apply: () => standIn,
    construct: () => standIn,
    set: () => true,
  })
  return standIn
}

// Makes `getContext` answer 'webgl2' with the fake and '2d' with a painter, and the pictures load a moment later
export function stubWebGL(fake: FakeGL | null) {
  const get = vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockImplementation(((kind: string) => {
    if (kind === 'webgl2') {
      return fake === null ? null : fake.gl
    }
    return paintContext()
  }) as never)
  ;(window as unknown as { WebGL2RenderingContext: unknown }).WebGL2RenderingContext = class {}
  class Picture {
    width = 4096
    height = 2048
    crossOrigin = ''
    onload: (() => void) | null = null
    onerror: (() => void) | null = null
    set src(_url: string) {
      window.setTimeout(() => this.onload?.(), 0)
    }
  }
  vi.stubGlobal('Image', Picture)
  return get
}
