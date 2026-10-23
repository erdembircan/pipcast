import type { On } from 'claude-code'
import type { Engine } from 'claude-code/testing'
import { expect, test } from 'claude-code/testing'

import { ERROR_WORDS, REPLY, TAB_ALT, TOAST_CANNOT_START, chipAlt } from '../src/contract/copy.ts'
import { TITLE_CHECK_MS } from '../src/core/title.ts'
import { BAND, HOME, ID, PROJECT_DIR, ROOT, RECORD, RUN, STATION, T0, TITLE_FILE, TRANSCRIPT, world } from './world.tsx'
import type { WorldOptions } from './world.tsx'

const START = { cwd: ROOT, surface: 'desktop', isInteractive: true } as const

type Run = ($: Engine, on: On) => Promise<void>

// A test in the world above: the session starts first and ends last, so one
// test's module state never reaches the next
function scenario(name: string, options: WorldOptions, body: (w: ReturnType<typeof world>, $: Engine) => Promise<void>) {
  const run: Run = async ($, on) => {
    const w = world(on, options)
    on('ui.render', { component: 'AbovePrompt' }, ($ui, e) => {
      const { Box, Text } = $ui.ui.resolve(e)
      if (options.hasOtherBand === false) {
        return <Box />
      }
      if (options.otherBand === 'row') {
        return (
          <Box alignItems="center" columnGap={3} flexWrap="wrap">
            <Text>dial one</Text>
            <Text>dial two</Text>
          </Box>
        )
      }
      return (
        <Box>
          <Text>another band</Text>
        </Box>
      )
    })
    await $.session.start(START)
    try {
      await body(w, $)
    } finally {
      await $.session.end({ reason: 'other', sessionId: ID, resume: { id: ID } })
    }
  }
  test(name, run)
}

const tuneIn = ($: Engine) => $.command.run(RUN)

const turn = async ($: Engine, id = 't1') => {
  await $.turn.start({ text: 'go', turnId: id })
}

const stop = (
  $: Engine,
  fields: { last_assistant_message?: string; background_tasks?: unknown[]; session_crons?: unknown[] } = {},
) => $.classic.Stop({ stop_hook_active: false, ...fields } as never)

const mounted = ($: Engine, surface: 'desktop' | 'terminal' = 'desktop', props: Record<string, unknown> = {}) =>
  $.ui.mount({ ...BAND, props: { ...BAND.props, ...props }, surface } as never)

// What a classic hook says about the session: its id and where its transcript is
const located = { session_id: ID, transcript_path: TRANSCRIPT } as const

scenario('the band on the desktop: our own line under another mod\'s', {}, async (w, $) => {
  w.other('aaaa', T0 - 2000)
  w.other('bbbb', T0 - 1000)
  w.other('stale', T0 - 100_000, T0 - 60_000)
  // The count is taken at session.start and by the heartbeat
  await $.session.end({ reason: 'other', sessionId: ID, resume: { id: ID } })
  await $.session.start(START)

  const ui = await mounted($)
  const svgs = await ui.findAll({ type: 'Svg' })
  expect(svgs.map((svg) => svg.props.alt)).toEqual([chipAlt(2), TAB_ALT.in])
  const button = await ui.find({ type: 'Button' })
  expect(button?.key).toBe('tune-in')
  expect(button?.props.plain).toBe(true)
  expect(await ui.find({ type: 'Text', text: 'another band' })).toBeDefined()
  const drawn = JSON.stringify(await ui.drawn())
  expect(drawn.indexOf('another band')).toBeLessThan(drawn.indexOf('KLWD'))

  const root = await ui.drawn()
  expect(root.type).toBe('Box')
  expect(root.props).toEqual({ flexDirection: 'column', rowGap: 'md' })
  const [beneath, ours, ...rest] = root.children ?? []
  expect(rest).toEqual([])
  expect(JSON.stringify(beneath)).toContain('another band')
  expect(ours?.type).toBe('Box')
  expect(ours?.props.columnGap).toBe(1)
  expect(ours?.children?.map((child) => child.type)).toEqual(['Svg', 'Box'])
  expect(JSON.stringify(beneath)).not.toContain('Svg')
  await ui.unmount()
})

scenario('the band leaves another mod\'s line exactly as it was drawn', { otherBand: 'row' }, async (_w, $) => {
  const ui = await mounted($)
  const root = await ui.drawn()
  expect(root.type).toBe('Box')
  expect(root.props).toEqual({ flexDirection: 'column', rowGap: 'md' })
  expect(root.children?.length).toBe(2)
  const other = root.children?.[0]
  expect(other?.type).toBe('Box')
  expect(other?.props).toEqual({ alignItems: 'center', columnGap: 3, flexWrap: 'wrap' })
  expect(other?.children).toMatchObject([
    { type: 'Text', children: ['dial one'] },
    { type: 'Text', children: ['dial two'] },
  ])
  expect(other?.children?.length).toBe(2)
  const text = JSON.stringify(other)
  expect(text).not.toContain('"Svg"')
  expect(text).not.toContain('"Button"')
  await ui.unmount()
})

scenario('the band leaves the terminal and a survey to what was beneath', {}, async (_w, $) => {
  const terminal = await mounted($, 'terminal')
  expect(await terminal.find({ type: 'Svg' })).toBeUndefined()
  expect(await terminal.find({ type: 'Button' })).toBeUndefined()
  expect(await terminal.find({ type: 'Text', text: 'another band' })).toBeDefined()
  await terminal.unmount()

  const survey = await mounted($, 'desktop', { hasSurvey: true })
  expect(await survey.find({ type: 'Svg' })).toBeUndefined()
  expect(await survey.find({ type: 'Button' })).toBeUndefined()
  expect(await survey.find({ type: 'Text', text: 'another band' })).toBeDefined()
  await survey.unmount()
})

scenario('the band draws alone when nothing else is in the band', { hasOtherBand: false }, async (_w, $) => {
  const ui = await mounted($)
  const drawn = await ui.drawn()
  expect(drawn.type).toBe('Box')
  expect(drawn.props.columnGap).toBe(1)
  expect(drawn.props.flexDirection).toBeUndefined()
  expect(drawn.props.rowGap).toBeUndefined()
  expect(drawn.children?.map((child) => child.type)).toEqual(['Svg', 'Box'])
  await ui.unmount()
})

scenario('the tab\'s button stays inside its box', {}, async (_w, $) => {
  const ui = await mounted($)
  const drawn = await ui.drawn()
  const tabWidth = (await ui.findAll({ type: 'Svg' }))[1]?.props.width
  const label = (await ui.find({ type: 'Button' }))?.props.label
  expect(typeof tabWidth).toBe('number')
  expect(typeof label).toBe('string')
  expect((label as string).replaceAll('\u2002', '')).toBe('')
  expect((label as string).length).toBe(Math.floor((tabWidth as number) / 8))
  expect(JSON.stringify(drawn)).not.toContain('\u2026')
  // Our line is [chip, tab Box]; the tab Box holds [tab picture, the button's Box]
  const ours = drawn.children?.[1]
  const tabBox = ours !== undefined && typeof ours !== 'string' ? ours.children?.[1] : undefined
  const holder = tabBox !== undefined && typeof tabBox !== 'string' ? tabBox.children?.[1] : undefined
  expect(holder).toMatchObject({ type: 'Box', props: { position: 'absolute', left: -2, right: -2 } })
  await ui.unmount()
})

scenario('pressing the tab tunes in: the record, the station, then TUNE OUT', { env: { PIPCAST_TARGET_BUNDLE_ID: 'com.example.never' } }, async (w, $) => {
  const ui = await mounted($)
  await ui.press({ key: 'tune-in' })
  await ui.redraw()

  const record = w.record()
  expect(record?.id).toBe(ID)
  expect(record?.tunedInAt).toBe(T0)
  expect(record?.checkedInAt).toBe(T0)
  // written whole to .tmp, then renamed into place
  expect(w.writes).toContain(`${RECORD}.tmp`)
  expect(w.ran).toContainEqual(['/bin/mv', '-f', `${RECORD}.tmp`, RECORD])
  expect(w.files.has(`${RECORD}.tmp`)).toBe(false)

  expect(w.launched.length).toBe(1)
  const launch = w.launched[0] ?? []
  expect(launch.slice(0, 3)).toEqual(['launch', '--home', HOME])
  expect(launch[3]).toBe('--assets')
  expect(launch[4]?.endsWith('/station')).toBe(true)
  expect(launch.slice(5)).toEqual(['--target-bundle-id', 'com.example.never'])
  expect(w.ran).toContainEqual(['/bin/chmod', '+x', STATION])

  expect((await ui.findAll({ type: 'Svg' })).map((svg) => svg.props.alt)).toEqual([chipAlt(1), TAB_ALT.out])
  expect((await ui.find({ type: 'Button' }))?.key).toBe('tune-out')

  await ui.press({ key: 'tune-out' })
  await ui.redraw()
  expect(w.record()).toBeNull()
  expect((await ui.find({ type: 'Button' }))?.key).toBe('tune-in')
  await ui.unmount()
})

scenario('the station is launched without a target when the variable is not set', {}, async (w, $) => {
  await tuneIn($)
  expect(w.launched[0]?.includes('--target-bundle-id')).toBe(false)
})

scenario('with four others on air the tab is dim, has no button, and /pipcast says so', {}, async (w, $) => {
  for (const [index, id] of ['a', 'b', 'c', 'd'].entries()) {
    w.other(id, T0 - 10_000 + index)
  }
  await $.session.end({ reason: 'other', sessionId: ID, resume: { id: ID } })
  await $.session.start(START)

  const ui = await mounted($)
  expect((await ui.findAll({ type: 'Svg' })).map((svg) => svg.props.alt)).toEqual([chipAlt(4), TAB_ALT.off])
  expect(await ui.find({ type: 'Button' })).toBeUndefined()
  await ui.unmount()

  expect((await tuneIn($)).text).toBe(REPLY.full)
  expect(w.record()).toBeNull()
  expect(w.launched.length).toBe(0)
})

scenario('/pipcast tunes in, then out', {}, async (w, $) => {
  expect((await tuneIn($)).text).toBe(REPLY.tunedIn)
  expect(w.record()).not.toBeNull()
  expect((await tuneIn($)).text).toBe(REPLY.tunedOut)
  expect(w.record()).toBeNull()
})

scenario('a station that will not start leaves a toast and no record', { launchExit: 1, launchOut: '' }, async (w, $) => {
  const ui = await mounted($)
  await ui.press({ key: 'tune-in' })
  await ui.redraw()
  expect(w.toasts).toEqual([TOAST_CANNOT_START])
  expect(w.record()).toBeNull()
  expect((await ui.find({ type: 'Button' }))?.key).toBe('tune-in')
  await ui.unmount()

  expect((await tuneIn($)).text).toBe(REPLY.cannotStart)
})

scenario('turn.start writes working', {}, async (w, $) => {
  await tuneIn($)
  expect(w.record()?.state).toBe('ready')
  await turn($)
  expect(w.record()?.state).toBe('working')
})

scenario('a Bash permission is a needs-input story with its command and description', {}, async (w, $) => {
  await tuneIn($)
  await turn($)
  await $.classic.PermissionRequest({
    tool_name: 'Bash',
    tool_input: { command: 'rm -rf build\necho done', description: 'Remove the build folder' },
  } as never)
  const record = w.record()
  expect(record?.state).toBe('needs-input')
  expect(record?.stories.length).toBe(1)
  expect(record?.stories[0]).toMatchObject({
    id: `${ID}:1`,
    kind: 'needs-input',
    command: 'rm -rf build',
    quote: 'Remove the build folder',
  })
})

scenario('a permission is answered when the tool call returns', {}, async (w, $) => {
  await tuneIn($)
  await turn($)
  await $.classic.PermissionRequest({ tool_name: 'Edit', tool_input: { file_path: `${ROOT}/src/a.ts` } } as never)
  expect(w.record()?.stories[0]?.command).toBe('Edit src/a.ts')
  await $.tool.call({ tool: 'Edit', file_path: `${ROOT}/src/a.ts`, old_string: 'a', new_string: 'b' } as never)
  expect(w.record()?.state).toBe('working')
  expect(w.record()?.stories.length).toBe(1)
})

scenario('a subagent permission is answered when that subagent call returns', {}, async (w, $) => {
  await tuneIn($)
  await turn($)
  await $.classic.PermissionRequest({ agent_id: 'a1', tool_name: 'Bash', tool_input: { command: 'ls' } } as never)
  expect(w.record()?.state).toBe('needs-input')
  await $.tool.call({ tool: 'Bash', command: 'ls', agentId: 'a1' } as never)
  expect(w.record()?.state).toBe('working')
  expect(w.record()?.stories.length).toBe(1)
  // the subagent's call made no activity line
  expect(w.record()?.activity.length).toBe(0)
})

scenario('a main-loop permission is not answered by a subagent call returning', {}, async (w, $) => {
  await tuneIn($)
  await turn($)
  await $.classic.PermissionRequest({ tool_name: 'Bash', tool_input: { command: 'ls' } } as never)
  await $.tool.call({ tool: 'Bash', command: 'ls', agentId: 'a1' } as never)
  expect(w.record()?.state).toBe('needs-input')
  await $.tool.call({ tool: 'Bash', command: 'ls' } as never)
  expect(w.record()?.state).toBe('working')
})

scenario('AskUserQuestion is a story with the question, and the answer ends it', {}, async (w, $) => {
  await tuneIn($)
  await turn($)
  await $.tool.call({
    tool: 'AskUserQuestion',
    questions: [{ question: ' Which database should it use? ', header: 'Database', options: [], multiSelect: false }],
  } as never)
  expect(w.atTool).toEqual(['needs-input'])
  expect(w.record()?.stories[0]).toMatchObject({ kind: 'needs-input', quote: 'Which database should it use?' })
  expect(w.record()?.state).toBe('working')
})

scenario('Stop with a last message and no changes is a complete story', {}, async (w, $) => {
  await tuneIn($)
  await turn($)
  await w.clock.advance(5000)
  await stop($, { last_assistant_message: 'All **done**. See `notes.md` for more.' })
  const record = w.record()
  expect(record?.state).toBe('ready')
  expect(record?.stories[0]).toMatchObject({ kind: 'complete', quote: 'All done. See notes.md for more.', durationMs: 5000 })
})

scenario('Stop with changes in git is a ready story with the diff', {}, async (w, $) => {
  w.git.numstat = '3\t1\tsrc/a.ts\n'
  w.git.untracked = ['old.txt']
  await tuneIn($)
  await turn($)
  await w.clock.settle()
  w.git.numstat = '10\t4\tsrc/a.ts\n2\t0\tsrc/b.ts\n'
  w.git.untracked = ['old.txt', 'new.txt']
  w.files.set(`${ROOT}/new.txt`, 'one\ntwo\nthree\n')
  await stop($, { last_assistant_message: 'Done.' })
  expect(w.record()?.stories[0]).toMatchObject({ kind: 'ready', added: 7 + 2 + 3, removed: 3, files: 3 })
  expect(w.record()?.hours.at(-1)).toMatchObject({ added: 12, removed: 3, files: 3 })
})

scenario('git is read without ever taking the index lock', {}, async (w, $) => {
  w.git.numstat = '3\t1\tsrc/a.ts\n'
  await tuneIn($)
  await turn($)
  await w.clock.settle()
  await stop($, { last_assistant_message: 'Done.' })
  const git = w.ran.filter((argv) => argv[0] === '/usr/bin/git')
  expect(git.length > 0).toBe(true)
  for (const argv of git) {
    expect([
      ['/usr/bin/git', 'diff-index', '-M', '--numstat', 'HEAD'],
      ['/usr/bin/git', 'ls-files', '--others', '--exclude-standard', '-z'],
    ]).toContainEqual(argv)
  }
})

scenario('a new binary file, or one too big to read, is a file with no lines', {}, async (w, $) => {
  await tuneIn($)
  await turn($)
  await w.clock.settle()
  w.git.untracked = ['shot.png', 'dump.log', 'notes.md']
  w.files.set(`${ROOT}/shot.png`, '\u0089PNG\r\n\u001a\n\u0000\u0000\u0000\rIHDR\nwide\nhigh\n')
  w.files.set(`${ROOT}/dump.log`, 'line\n'.repeat(250_000))
  w.files.set(`${ROOT}/notes.md`, 'one\ntwo\n')
  w.reads.length = 0
  await stop($, { last_assistant_message: 'Done.' })
  expect(w.record()?.stories[0]).toMatchObject({ kind: 'ready', added: 2, removed: 0, files: 3 })
  expect(w.reads).not.toContain(`${ROOT}/dump.log`)
})

scenario('with no repository the edit tools are counted', { hasRepo: false }, async (w, $) => {
  w.git.fails = true
  await tuneIn($)
  await turn($)
  await w.clock.settle()
  await $.tool.call({ tool: 'Write', file_path: `${ROOT}/a.txt`, content: 'x\ny\n' } as never)
  await $.tool.call({ tool: 'Edit', file_path: `${ROOT}/b.txt`, old_string: 'a\nb', new_string: 'c' } as never)
  await stop($, { last_assistant_message: 'Done.' })
  expect(w.record()?.stories[0]).toMatchObject({ kind: 'ready', added: 3, removed: 2, files: 2 })
})

scenario('Stop while work the session started will wake it stays working and tells no story', {}, async (w, $) => {
  await tuneIn($)
  const waits: { background_tasks?: unknown[]; session_crons?: unknown[] }[] = [
    { background_tasks: [{ id: 'b8d2k1q9z', type: 'shell', status: 'running', description: 'Thirty-minute check-in timer', command: 'sleep 1800' }] },
    { background_tasks: [{ id: 'a3f9c2m7x', type: 'subagent', status: 'running', description: 'Implement the fix', agent_type: 'implementer' }] },
    { background_tasks: [{ id: 'w5h1n8r2c', type: 'workflow', status: 'running', description: 'Review the change', name: 'review-changes' }] },
    { background_tasks: [{ id: 'k7t4e6p1b', type: 'MCP task', status: 'pending', description: 'Render the deck', server: 'slides', tool: 'render' }] },
    { background_tasks: [{ id: 'm2v9s4d6f', type: 'monitor', status: 'running', description: 'Watch the deploy', server: 'ci', tool: 'watch' }] },
    { session_crons: [{ id: 'cron-1', schedule: '*/5 * * * *', recurring: true, prompt: 'Check the build' }] },
  ]
  for (const [index, wait] of waits.entries()) {
    const id = `t${index + 1}`
    await turn($, id)
    await stop($, { last_assistant_message: 'Waiting.', ...wait })
    // The turn is over, and its end changes nothing
    await $.turn.complete({ answer: 'Waiting.', durationMs: 5, isAborted: false, turnId: id, reason: 'answer' } as never)
    expect(w.record()?.state).toBe('working')
    expect(w.record()?.stories.length).toBe(0)
  }
})

scenario('Stop with only artifact watches, housekeeping and idle helpers in flight is finished', {}, async (w, $) => {
  await tuneIn($)
  await turn($)
  await stop($, {
    last_assistant_message: 'Published the board.',
    background_tasks: [
      { id: 's4j8w2n6q', type: 'monitor', status: 'running', description: 'PiP Newsroom · Station' },
      { id: 'd9x3b7k1m', type: 'dream', status: 'running', description: 'Consolidating memory' },
      { id: 'e6c2v8h4t', type: 'auto-mode scan', status: 'running', description: 'Auto-mode scan' },
      { id: 'n1p5z9r3y', type: 'memory import', status: 'pending', description: 'Importing memory' },
      { id: 't8f2l6q0w', type: 'teammate', status: 'running', description: 'scout@team' },
      { id: 'r3m7c1k5j', type: 'cloud session', status: 'running', description: 'Long-running session' },
      { id: 'x0y1z2a3b', type: 'something-new', status: 'running', description: 'A task of a kind added later' },
    ],
  })
  expect(w.record()?.state).toBe('ready')
  expect(w.record()?.stories).toHaveLength(1)
  expect(w.record()?.stories[0]).toMatchObject({ kind: 'complete', quote: 'Published the board.' })
})

scenario('a turn that ends with no Stop the mod saw leaves the session ready, with no story', {}, async (w, $) => {
  await tuneIn($)
  await turn($)
  expect(w.record()?.state).toBe('working')
  await $.turn.complete({ answer: 'Done.', durationMs: 5, isAborted: false, turnId: 't1', reason: 'answer' } as never)
  expect(w.record()?.state).toBe('ready')
  expect(w.record()?.stories.length).toBe(0)
})

scenario('StopFailure is an error story in words', {}, async (w, $) => {
  await tuneIn($)
  await turn($)
  await $.classic.StopFailure({ error: 'overloaded' } as never)
  expect(w.record()?.state).toBe('error')
  expect(w.record()?.stories[0]).toMatchObject({ kind: 'error', quote: ERROR_WORDS.overloaded })
  // the turn that follows ends with reason "error": no second story
  await $.turn.complete({ answer: '', durationMs: 5, isAborted: false, turnId: 't1', reason: 'error' } as never)
  expect(w.record()?.stories.length).toBe(1)
})

scenario('a turn that dies on an error with no StopFailure is an unknown error', {}, async (w, $) => {
  await tuneIn($)
  await turn($)
  await $.turn.complete({ answer: '', durationMs: 5, isAborted: false, turnId: 't1', reason: 'error' } as never)
  expect(w.record()?.stories[0]).toMatchObject({ kind: 'error', quote: ERROR_WORDS.unknown })
})

scenario('an interrupted turn leaves the session ready, with no story', {}, async (w, $) => {
  await tuneIn($)
  await turn($)
  expect(w.record()?.state).toBe('working')
  await $.turn.complete({ answer: '', durationMs: 5, isAborted: true, turnId: 't1', reason: 'aborted' } as never)
  expect(w.record()?.state).toBe('ready')
  expect(w.record()?.stories.length).toBe(0)
})

scenario('a subagent changes nothing', {}, async (w, $) => {
  await tuneIn($)
  await turn($)
  await $.tool.call({ tool: 'Bash', command: 'ls', description: 'List files', agentId: 'sub' } as never)
  await $.turn.complete({ answer: '', durationMs: 5, isAborted: true, turnId: 'x', reason: 'aborted', agentId: 'sub' } as never)
  expect(w.record()?.activity.length).toBe(0)
  expect(w.record()?.state).toBe('working')
})

scenario('activity lines are written at most every two seconds, the last one by a timer', {}, async (w, $) => {
  await tuneIn($)
  await turn($)
  await w.clock.advance(2000)
  await $.tool.call({ tool: 'Bash', command: 'npm test', description: 'Run the test suite' } as never)
  expect(w.record()?.activity.map((line) => line.text)).toEqual(['running the test suite'])
  await $.tool.call({ tool: 'Read', file_path: `${ROOT}/src/a.ts` } as never)
  expect(w.record()?.activity.length).toBe(1)
  await w.clock.advance(2000)
  expect(w.record()?.activity.map((line) => line.text)).toEqual(['running the test suite', 'reading src/a.ts'])
})

scenario('the heartbeat writes the record again', {}, async (w, $) => {
  await tuneIn($)
  expect(w.record()?.checkedInAt).toBe(T0)
  await w.clock.advance(10_000)
  expect(w.record()?.checkedInAt).toBe(T0 + 10_000)
  expect(w.record()?.tunedInAt).toBe(T0)
})

scenario('a window close after tuning in removes the record and turns the band off', {}, async (w, $) => {
  await tuneIn($)
  w.files.set(`${HOME}/control.json`, JSON.stringify({ v: 1, closedAt: T0 + 1 }))
  await w.clock.advance(10_000)
  expect(w.record()).toBeNull()
  const ui = await mounted($)
  expect((await ui.find({ type: 'Button' }))?.key).toBe('tune-in')
  await ui.unmount()
})

scenario('a close before tuning in changes nothing', {}, async (w, $) => {
  w.files.set(`${HOME}/control.json`, JSON.stringify({ v: 1, closedAt: T0 - 1 }))
  await tuneIn($)
  await w.clock.advance(10_000)
  expect(w.record()?.checkedInAt).toBe(T0 + 10_000)
})

scenario('the heartbeat starts the station again when it has gone quiet', {}, async (w, $) => {
  await tuneIn($)
  expect(w.launched.length).toBe(1)
  w.files.set(`${HOME}/station.json`, JSON.stringify({ v: 1, pid: 1, startedAt: T0, heartbeatAt: T0, version: '1' }))
  await w.clock.advance(10_000)
  expect(w.launched.length).toBe(1)
  await w.clock.advance(20_000)
  expect(w.launched.length).toBeGreaterThan(1)
})

scenario('an untuned session counts who is on air at each heartbeat', {}, async (w, $) => {
  w.other('aaaa', T0 - 1000)
  await w.clock.advance(10_000)
  w.other('aaaa', T0 - 1000, T0 + 10_000)
  const ui = await mounted($)
  expect((await ui.findAll({ type: 'Svg' })).map((svg) => svg.props.alt)[0]).toBe(chipAlt(1))
  await ui.unmount()
})

scenario('session.end removes the record', {}, async (w, $) => {
  await tuneIn($)
  expect(w.files.has(RECORD)).toBe(true)
  await $.session.end({ reason: 'clear', sessionId: ID, resume: { id: ID } })
  expect(w.files.has(RECORD)).toBe(false)
})

scenario('a title from classic.SessionStart becomes the record title', {}, async (w, $) => {
  await tuneIn($)
  await $.classic.SessionStart({ source: 'startup', session_title: 'Refactor the importer' } as never)
  expect(w.record()?.title).toBe('Refactor the importer')
  await $.classic.UserPromptSubmit({ prompt: 'go', session_title: 'Fix the importer' } as never)
  expect(w.record()?.title).toBe('Fix the importer')
})

scenario('a title that arrives before the session starts is kept', {}, async (w, $) => {
  await $.session.end({ reason: 'other', sessionId: ID, resume: { id: ID } })
  await $.classic.SessionStart({ source: 'startup', session_title: 'Early title' } as never)
  await $.session.start(START)
  await tuneIn($)
  expect(w.record()?.title).toBe('Early title')
})

scenario("the engine's title file names a session that no hook has named", { transcriptDir: PROJECT_DIR }, async (w, $) => {
  w.titleFile('From the title file')
  await tuneIn($)
  expect(w.record()?.title).toBe('From the title file')
})

scenario('a rename while on air reaches the record at the next check', { transcriptDir: PROJECT_DIR }, async (w, $) => {
  await tuneIn($)
  expect(w.record()?.title).toBe('proj-82')
  w.titleFile('Renamed on air')
  await w.clock.advance(TITLE_CHECK_MS - 1000)
  expect(w.record()?.title).toBe('proj-82')
  await w.clock.advance(1000)
  expect(w.record()?.title).toBe('Renamed on air')
})

scenario("the engine's title wins over a hook's, which no longer holds the title", {}, async (w, $) => {
  await $.classic.SessionStart({ source: 'startup', session_title: 'Advisor fable', ...located } as never)
  await tuneIn($)
  expect(w.record()?.title).toBe('Advisor fable')
  w.titleFile('Fix the ticker')
  await w.clock.advance(TITLE_CHECK_MS)
  expect(w.record()?.title).toBe('Fix the ticker')
  await $.classic.UserPromptSubmit({ prompt: 'go', session_title: 'Advisor fable', ...located } as never)
  expect(w.record()?.title).toBe('Fix the ticker')
  expect(w.ran.some((argv) => argv[0] === '/usr/bin/find')).toBe(false)
})

scenario('tuning in reads the title before the first write', { transcriptDir: PROJECT_DIR }, async (w, $) => {
  w.titleFile('Named off air')
  await tuneIn($)
  expect(w.written.length).toBeGreaterThan(0)
  expect(w.written.every((title) => title === 'Named off air')).toBe(true)
})

scenario('a rename while tuned out is on the record when it tunes in again', { transcriptDir: PROJECT_DIR }, async (w, $) => {
  w.titleFile('One')
  await tuneIn($)
  await tuneIn($)
  expect(w.record()).toBeNull()
  w.titleFile('Two')
  await tuneIn($)
  expect(w.record()?.title).toBe('Two')
})

scenario("after the window's close, tuning in again carries the newest title", { transcriptDir: PROJECT_DIR }, async (w, $) => {
  w.titleFile('One')
  await tuneIn($)
  w.files.set(`${HOME}/control.json`, JSON.stringify({ v: 1, closedAt: T0 + 1 }))
  await w.clock.advance(10_000)
  expect(w.record()).toBeNull()
  w.titleFile('Two')
  await tuneIn($)
  expect(w.record()?.title).toBe('Two')
})

scenario('each check reads the one small file, and find runs only once', { transcriptDir: PROJECT_DIR }, async (w, $) => {
  await tuneIn($)
  w.reads.length = 0
  await w.clock.advance(3 * TITLE_CHECK_MS)
  expect(w.reads.filter((path) => path === TITLE_FILE)).toEqual([TITLE_FILE, TITLE_FILE, TITLE_FILE])
  const finds = w.ran.filter((argv) => argv[0] === '/usr/bin/find')
  expect(finds).toEqual([['/usr/bin/find', '/Users/me/.claude/projects', '-maxdepth', '2', '-name', `${ID}.jsonl`, '-print', '-quit']])
})

scenario('no check runs while tuned out', { transcriptDir: PROJECT_DIR }, async (w, $) => {
  await tuneIn($)
  await tuneIn($)
  w.reads.length = 0
  await w.clock.advance(2 * TITLE_CHECK_MS)
  expect(w.reads).not.toContain(TITLE_FILE)
})

scenario('CLAUDE_CONFIG_DIR moves where the transcript is looked for', { env: { CLAUDE_CONFIG_DIR: '/cfg' } }, async (w, $) => {
  await tuneIn($)
  expect(w.ran.find((argv) => argv[0] === '/usr/bin/find')?.[1]).toBe('/cfg/projects')
})

scenario('a title file with no title gives the hook title back, and a half-written one changes nothing', {}, async (w, $) => {
  await $.classic.SessionStart({ source: 'startup', session_title: 'Hook name', ...located } as never)
  await tuneIn($)
  w.titleFile('File name')
  await w.clock.advance(TITLE_CHECK_MS)
  expect(w.record()?.title).toBe('File name')
  w.files.set(TITLE_FILE, '{"customTitle":"Fi')
  await w.clock.advance(TITLE_CHECK_MS)
  expect(w.record()?.title).toBe('File name')
  w.titleFile('   ')
  await w.clock.advance(TITLE_CHECK_MS)
  expect(w.record()?.title).toBe('Hook name')
  w.titleFile('File name')
  await w.clock.advance(TITLE_CHECK_MS)
  expect(w.record()?.title).toBe('File name')
  w.titleFile(null)
  await w.clock.advance(TITLE_CHECK_MS)
  expect(w.record()?.title).toBe('Hook name')
})

scenario("a subagent's transcript is not taken for the session's", {}, async (w, $) => {
  await $.classic.PermissionRequest({
    tool_name: 'Bash',
    tool_input: { command: 'ls' },
    agent_id: 'sub',
    session_id: ID,
    transcript_path: `${PROJECT_DIR}/${ID}/subagents/agent-sub.jsonl`,
  } as never)
  await tuneIn($)
  expect(w.ran.some((argv) => argv[0] === '/usr/bin/find')).toBe(true)
})

scenario('a reload reads the title again and keeps checking', { transcriptDir: PROJECT_DIR }, async (w, $) => {
  w.titleFile('Before the reload')
  await tuneIn($)
  w.titleFile('After the reload')
  // The module starts over; $.state says tuned in
  await $.session.start(START)
  expect(w.record()?.title).toBe('After the reload')
  w.titleFile('Later')
  await w.clock.advance(TITLE_CHECK_MS)
  expect(w.record()?.title).toBe('Later')
})

scenario('a session with no title goes by its project and id', {}, async (w, $) => {
  await tuneIn($)
  expect(w.record()?.title).toBe('proj-82')
  expect(w.record()?.project).toBe('proj')
})

scenario('a reload carries on from the session own record', {}, async (w, $) => {
  await tuneIn($)
  await w.clock.advance(3000)
  const before = w.record()
  // The module starts over; $.state says tuned in
  await $.session.start(START)
  expect(w.record()?.tunedInAt).toBe(before?.tunedInAt)
})

