import { describe, expect, it } from 'vitest'

import { ACTIVITY, COMMAND_MAX, LAST_WORDS_MAX, PERMISSION, QUESTION_MAX, doing } from '@pipcast/contract'
import { activity, host, lastWords, permission, question, relativePath } from '../../plugin/src/core/describe.ts'

const ROOT = '/work/proj'

describe('relativePath', () => {
  it('is the path below the root when inside it', () => {
    expect(relativePath('/work/proj/src/a.ts', ROOT)).toBe('src/a.ts')
    expect(relativePath('/work/proj/src/a.ts', '/work/proj/')).toBe('src/a.ts')
  })

  it('is the last two segments when outside it', () => {
    expect(relativePath('/etc/nginx/nginx.conf', ROOT)).toBe('nginx/nginx.conf')
    expect(relativePath('/work/project/src/a.ts', ROOT)).toBe('src/a.ts')
    expect(relativePath('/a.ts', ROOT)).toBe('a.ts')
  })
})

describe('host', () => {
  it('is the URL host', () => {
    expect(host('https://docs.example.com/a/b?c=d#e')).toBe('docs.example.com')
    expect(host('http://localhost:3000/x')).toBe('localhost:3000')
    expect(host('https://user:pw@Example.com:443/')).toBe('example.com')
  })

  it('is the string itself when it does not parse', () => {
    expect(host('not a url')).toBe('not a url')
    expect(host('')).toBe('')
  })
})

describe('permission', () => {
  it('quotes a Bash command on one line and its description', () => {
    expect(permission('Bash', { command: 'npm   test\n  --silent', description: '  Run the tests ' }, ROOT)).toEqual({
      command: 'npm test',
      quote: 'Run the tests',
    })
  })

  it('collapses white space in the first line', () => {
    expect(permission('Bash', { command: 'git\t log   --oneline' }, ROOT)).toEqual({ command: 'git log --oneline' })
  })

  it('cuts a long command with an ellipsis, to the limit in all', () => {
    const long = permission('Bash', { command: 'x'.repeat(200) }, ROOT)
    expect(long.command?.length).toBe(COMMAND_MAX)
    expect(long.command?.endsWith('…')).toBe(true)
    const exact = permission('Bash', { command: 'y'.repeat(COMMAND_MAX) }, ROOT)
    expect(exact.command).toBe('y'.repeat(COMMAND_MAX))
  })

  it('has no quote without a description', () => {
    expect(permission('Bash', { command: 'ls', description: '   ' }, ROOT)).toEqual({ command: 'ls' })
    expect(permission('Bash', { command: 'ls', description: 4 }, ROOT)).toEqual({ command: 'ls' })
  })

  it('names the verb and the target for the file and web tools', () => {
    expect(permission('Edit', { file_path: `${ROOT}/src/a.ts` }, ROOT)).toEqual({ command: PERMISSION.edit('src/a.ts') })
    expect(permission('MultiEdit', { file_path: `${ROOT}/src/a.ts` }, ROOT)).toEqual({ command: PERMISSION.edit('src/a.ts') })
    expect(permission('NotebookEdit', { notebook_path: `${ROOT}/n.ipynb` }, ROOT)).toEqual({ command: PERMISSION.edit('n.ipynb') })
    expect(permission('Write', { file_path: '/tmp/out/x.txt' }, ROOT)).toEqual({ command: PERMISSION.write('out/x.txt') })
    expect(permission('Read', { file_path: `${ROOT}/README.md` }, ROOT)).toEqual({ command: PERMISSION.read('README.md') })
    expect(permission('WebFetch', { url: 'https://example.com/page' }, ROOT)).toEqual({ command: PERMISSION.fetch('example.com') })
    expect(permission('WebSearch', { query: 'x' }, ROOT)).toEqual({ command: PERMISSION.search })
  })

  it('names an MCP tool by its own name, and any other by the tool', () => {
    expect(permission('mcp__github__create_issue', {}, ROOT)).toEqual({ command: 'create_issue' })
    expect(permission('mcp__srv__a__b', {}, ROOT)).toEqual({ command: 'a__b' })
    expect(permission('Glob', {}, ROOT)).toEqual({ command: 'Glob' })
  })

  it('falls back to the tool when the input has no path', () => {
    expect(permission('Edit', {}, ROOT)).toEqual({ command: 'Edit' })
  })
})

describe('activity', () => {
  it('describes the file tools with the path below the root', () => {
    expect(activity('Edit', { file_path: `${ROOT}/src/a.ts` }, ROOT)).toBe(ACTIVITY.editing('src/a.ts'))
    expect(activity('MultiEdit', { file_path: `${ROOT}/src/a.ts` }, ROOT)).toBe(ACTIVITY.editing('src/a.ts'))
    expect(activity('NotebookEdit', { notebook_path: `${ROOT}/n.ipynb` }, ROOT)).toBe(ACTIVITY.editing('n.ipynb'))
    expect(activity('Write', { file_path: `${ROOT}/b.ts` }, ROOT)).toBe(ACTIVITY.writing('b.ts'))
    expect(activity('Read', { file_path: `${ROOT}/c.ts` }, ROOT)).toBe(ACTIVITY.reading('c.ts'))
  })

  it('describes searching, the web, agents and the task list', () => {
    expect(activity('Grep', {}, ROOT)).toBe(ACTIVITY.searchingCode)
    expect(activity('Glob', {}, ROOT)).toBe(ACTIVITY.searchingCode)
    expect(activity('WebSearch', {}, ROOT)).toBe(ACTIVITY.searchingWeb)
    expect(activity('WebFetch', { url: 'https://example.com/x' }, ROOT)).toBe(ACTIVITY.readingSite('example.com'))
    expect(activity('Task', {}, ROOT)).toBe(ACTIVITY.withAgent)
    expect(activity('Agent', {}, ROOT)).toBe(ACTIVITY.withAgent)
    expect(activity('TodoWrite', {}, ROOT)).toBe(ACTIVITY.planning)
  })

  it('describes Bash by its description, else by the first word of the command', () => {
    expect(activity('Bash', { command: 'npm test', description: 'Run the test suite' }, ROOT)).toBe(doing('Run the test suite'))
    expect(activity('Bash', { command: 'npm test', description: 'Run the test suite' }, ROOT)).toBe('running the test suite')
    expect(activity('Bash', { command: '  cargo build --release' }, ROOT)).toBe(ACTIVITY.running('cargo'))
    expect(activity('Bash', { command: 'ls', description: '  ' }, ROOT)).toBe(ACTIVITY.running('ls'))
    expect(activity('Bash', {}, ROOT)).toBe(ACTIVITY.using('Bash'))
  })

  it('leaves AskUserQuestion to its story', () => {
    expect(activity('AskUserQuestion', { questions: [] }, ROOT)).toBeNull()
  })

  it('names the server of an MCP tool and the tool otherwise', () => {
    expect(activity('mcp__github__create_issue', {}, ROOT)).toBe(ACTIVITY.using('github'))
    expect(activity('SomethingNew', {}, ROOT)).toBe(ACTIVITY.using('SomethingNew'))
  })
})

describe('question', () => {
  it('is the first question, trimmed', () => {
    expect(question({ questions: [{ question: '  Which one?  ' }, { question: 'Another?' }] })).toBe('Which one?')
  })

  it('is cut to the limit with an ellipsis', () => {
    const text = question({ questions: [{ question: 'q'.repeat(400) }] })
    expect(text?.length).toBe(QUESTION_MAX)
    expect(text?.endsWith('…')).toBe(true)
  })

  it('is null without one', () => {
    expect(question({})).toBeNull()
    expect(question({ questions: [] })).toBeNull()
    expect(question({ questions: [{}] })).toBeNull()
    expect(question({ questions: [{ question: '   ' }] })).toBeNull()
    expect(question({ questions: [null] })).toBeNull()
  })
})

describe('lastWords', () => {
  it('keeps a short plain message as it is', () => {
    expect(lastWords('All done.')).toBe('All done.')
    expect(lastWords('')).toBe('')
  })

  it('drops fenced code blocks, closed or not', () => {
    expect(lastWords('Here it is:\n```ts\nconst a = 1\n```\nThat is all.')).toBe('Here it is: That is all.')
    expect(lastWords('Before.\n~~~\ncode\n~~~\nAfter.')).toBe('Before. After.')
    expect(lastWords('Run this:\n```\nnpm test\nnever closed')).toBe('Run this:')
  })

  it('drops images and keeps the text of links, code and emphasis', () => {
    expect(lastWords('See ![chart](a.png) and [the docs](https://x.y/z) for `foo()`.')).toBe('See and the docs for foo().')
    expect(lastWords('This is **bold**, *italic*, __strong__, _em_ and ~~gone~~.')).toBe('This is bold, italic, strong, em and gone.')
  })

  it('leaves identifiers with underscores and a lone star alone', () => {
    expect(lastWords('Set snake_case_name to 2 * 3.')).toBe('Set snake_case_name to 2 * 3.')
  })

  it('drops heading, list and quote markers', () => {
    expect(lastWords('## Summary\n- first\n* second\n+ third\n1. fourth\n2) fifth\n> quoted')).toBe('Summary first second third fourth fifth quoted')
  })

  it('makes runs of white space one space', () => {
    expect(lastWords('  a \n\n  b\t\tc  ')).toBe('a b c')
  })

  it('cuts a long message after the last sentence end that fits', () => {
    const text = 'First sentence is here. Second one follows it closely! Third goes on and on and on and on and on.'
    const out = lastWords(text)
    expect(out).toBe('First sentence is here. Second one follows it closely!')
    expect(out.length).toBeLessThanOrEqual(LAST_WORDS_MAX)
  })

  it('counts a question mark and the end of the text as sentence ends', () => {
    const asked = `${'Does it work for you? '}${'x'.repeat(100)}`
    expect(lastWords(asked)).toBe('Does it work for you?')
    const exact = 'a'.repeat(LAST_WORDS_MAX - 1) + '.'
    expect(lastWords(exact)).toBe(exact)
  })

  it('does not end a sentence inside a word or a number', () => {
    const text = `Version 1.2.3 is out and the build of src/a.ts passed ${'word '.repeat(20)}`
    const out = lastWords(text)
    expect(out.endsWith('…')).toBe(true)
    expect(out.length).toBeLessThanOrEqual(LAST_WORDS_MAX)
  })

  it('cuts a long first sentence at a space and adds an ellipsis', () => {
    const text = 'This single sentence just keeps going without any end in sight for far longer than the limit allows'
    const out = lastWords(text)
    expect(out).toBe('This single sentence just keeps going without any end in sight for far…')
    expect(out.length).toBeLessThanOrEqual(LAST_WORDS_MAX)
  })

  it('cuts a long word with no space at the limit', () => {
    const out = lastWords('z'.repeat(200))
    expect(out).toBe(`${'z'.repeat(LAST_WORDS_MAX - 1)}…`)
  })

  it('keeps exactly the limit whole', () => {
    const text = 'w'.repeat(LAST_WORDS_MAX)
    expect(lastWords(text)).toBe(text)
  })
})
