// Tools, permissions, questions and last words, in words. Every word comes
// from ../contract/copy.ts; this file only decides which.

import { COMMAND_MAX, LAST_WORDS_MAX, QUESTION_MAX } from '../../../contract/src/constants.ts'
import { ACTIVITY, PERMISSION, doing } from '../../../contract/src/copy.ts'

export type ToolInput = Record<string, unknown>

function str(value: unknown): string | null {
  return typeof value === 'string' ? value : null
}

// Cut to `max` characters in all, the last of them `…` when anything is lost
function cut(text: string, max: number): string {
  return text.length <= max ? text : `${text.slice(0, max - 1)}…`
}

// The path below `root` when it is inside it, else its last two segments
export function relativePath(path: string, root: string): string {
  const base = root.replace(/\/+$/, '')
  if (base !== '' && path.startsWith(`${base}/`)) {
    return path.slice(base.length + 1)
  }
  return path
    .split('/')
    .filter((segment) => segment !== '')
    .slice(-2)
    .join('/')
}

// The URL's host, default port left out; the string itself when it does not parse
export function host(url: string): string {
  const match = /^([a-z][a-z0-9+.-]*):\/\/([^/?#]*)/i.exec(url.trim())
  if (match === null) {
    return url
  }
  const scheme = (match[1] ?? '').toLowerCase()
  let name = (match[2] ?? '').replace(/^[^@]*@/, '').toLowerCase()
  if ((scheme === 'https' && name.endsWith(':443')) || (scheme === 'http' && name.endsWith(':80'))) {
    name = name.slice(0, name.lastIndexOf(':'))
  }
  return name === '' ? url : name
}

// "mcp__server__tool" -> { server, name }
function mcp(tool: string): { server: string; name: string } | null {
  if (!tool.startsWith('mcp__')) {
    return null
  }
  const rest = tool.slice(5)
  const at = rest.indexOf('__')
  if (at < 0) {
    return { server: rest, name: rest }
  }
  return { server: rest.slice(0, at), name: rest.slice(at + 2) }
}

export function permission(tool: string, input: ToolInput, root: string): { command?: string; quote?: string } {
  switch (tool) {
    case 'Bash': {
      const text = str(input.command)
      const description = str(input.description)?.trim()
      const out: { command?: string; quote?: string } = {}
      if (text !== null) {
        const firstLine = text.split(/\r?\n/, 1)[0] ?? ''
        out.command = cut(firstLine.replace(/\s+/g, ' ').trim(), COMMAND_MAX)
      }
      if (description !== undefined && description !== '') {
        out.quote = description
      }
      return out
    }
    case 'Edit':
    case 'MultiEdit': {
      const path = str(input.file_path)
      return { command: path === null ? tool : PERMISSION.edit(relativePath(path, root)) }
    }
    case 'NotebookEdit': {
      const path = str(input.notebook_path)
      return { command: path === null ? tool : PERMISSION.edit(relativePath(path, root)) }
    }
    case 'Write': {
      const path = str(input.file_path)
      return { command: path === null ? tool : PERMISSION.write(relativePath(path, root)) }
    }
    case 'Read': {
      const path = str(input.file_path)
      return { command: path === null ? tool : PERMISSION.read(relativePath(path, root)) }
    }
    case 'WebFetch': {
      const url = str(input.url)
      return { command: url === null ? tool : PERMISSION.fetch(host(url)) }
    }
    case 'WebSearch':
      return { command: PERMISSION.search }
    default: {
      const server = mcp(tool)
      return { command: server === null ? tool : server.name }
    }
  }
}

export function activity(tool: string, input: ToolInput, root: string): string | null {
  switch (tool) {
    case 'Edit':
    case 'MultiEdit': {
      const path = str(input.file_path)
      return path === null ? ACTIVITY.using(tool) : ACTIVITY.editing(relativePath(path, root))
    }
    case 'NotebookEdit': {
      const path = str(input.notebook_path)
      return path === null ? ACTIVITY.using(tool) : ACTIVITY.editing(relativePath(path, root))
    }
    case 'Write': {
      const path = str(input.file_path)
      return path === null ? ACTIVITY.using(tool) : ACTIVITY.writing(relativePath(path, root))
    }
    case 'Read': {
      const path = str(input.file_path)
      return path === null ? ACTIVITY.using(tool) : ACTIVITY.reading(relativePath(path, root))
    }
    case 'Grep':
    case 'Glob':
      return ACTIVITY.searchingCode
    case 'WebSearch':
      return ACTIVITY.searchingWeb
    case 'WebFetch': {
      const url = str(input.url)
      return url === null ? ACTIVITY.using(tool) : ACTIVITY.readingSite(host(url))
    }
    case 'Task':
    case 'Agent':
      return ACTIVITY.withAgent
    case 'TodoWrite':
      return ACTIVITY.planning
    case 'Bash': {
      const description = str(input.description)?.trim() ?? ''
      if (description !== '') {
        return doing(description)
      }
      const word = (str(input.command)?.trim() ?? '').split(/\s+/, 1)[0] ?? ''
      return word === '' ? ACTIVITY.using(tool) : ACTIVITY.running(word)
    }
    case 'AskUserQuestion':
      return null
    default: {
      const server = mcp(tool)
      return ACTIVITY.using(server === null ? tool : server.server)
    }
  }
}

// The first question's text, or null
export function question(input: ToolInput): string | null {
  const questions = input.questions
  if (!Array.isArray(questions)) {
    return null
  }
  const first: unknown = questions[0]
  if (typeof first !== 'object' || first === null) {
    return null
  }
  const text = str((first as ToolInput).question)?.trim() ?? ''
  return text === '' ? null : cut(text, QUESTION_MAX)
}

// The lines outside fenced code blocks; a block left open runs to the end
function withoutFences(text: string): string {
  const kept: string[] = []
  let fence: string | null = null
  for (const line of text.split(/\r?\n/)) {
    const mark = /^[ \t]*(```+|~~~+)/.exec(line)?.[1]
    if (fence === null) {
      if (mark === undefined) {
        kept.push(line)
      } else {
        fence = mark.charAt(0)
      }
    } else if (mark !== undefined && mark.charAt(0) === fence) {
      fence = null
    }
  }
  return kept.join('\n')
}

// Claude's final message as CLAUDE SAYS quotes it
export function lastWords(text: string): string {
  const plain = withoutFences(text)
    // images, then links
    .replace(/!\[[^\]]*\]\([^)]*\)/g, '')
    .replace(/\[([^\]]*)\]\([^)]*\)/g, '$1')
    // heading, quote and list markers at the start of a line
    .replace(/^[ \t]*#{1,6}[ \t]+/gm, '')
    .replace(/^[ \t]*(?:>[ \t]?)+/gm, '')
    .replace(/^[ \t]*(?:[-*+]|\d+[.)])[ \t]+/gm, '')
    // inline code keeps its text
    .replace(/`+([^`]*)`+/g, '$1')
    // emphasis keeps its text
    .replace(/(\*\*|__)(?=\S)([\s\S]*?\S)\1/g, '$2')
    .replace(/\*(?=\S)([^*]*?\S)\*/g, '$1')
    .replace(/(^|[^\w])_(?=\S)([^_]*?\S)_(?=[^\w]|$)/g, '$1$2')
    .replace(/~~(?=\S)([\s\S]*?\S)~~/g, '$1')
    .replace(/\s+/g, ' ')
    .trim()

  if (plain.length <= LAST_WORDS_MAX) {
    return plain
  }
  let end = -1
  for (let i = 0; i < LAST_WORDS_MAX; i += 1) {
    const ch = plain.charAt(i)
    if ((ch === '.' || ch === '!' || ch === '?') && (i + 1 === plain.length || plain.charAt(i + 1) === ' ')) {
      end = i
    }
  }
  if (end >= 0) {
    return plain.slice(0, end + 1)
  }
  const head = plain.slice(0, LAST_WORDS_MAX - 1)
  const space = head.lastIndexOf(' ')
  return `${(space > 0 ? head.slice(0, space) : head).trimEnd()}…`
}
