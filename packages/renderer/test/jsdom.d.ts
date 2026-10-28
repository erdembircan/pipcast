// The little of jsdom that vendor.test.ts uses
declare module 'jsdom' {
  export class JSDOM {
    constructor(html?: string, options?: { runScripts?: 'dangerously' | 'outside-only' })
    readonly window: {
      eval(code: string): unknown
      close(): void
      document: { getElementById(id: string): { textContent: string | null } | null }
    }
  }
}
