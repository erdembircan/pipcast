import type { On } from 'claude-code'
import type { Engine } from 'claude-code/testing'
import { expect, test } from 'claude-code/testing'

import { ACTIVITY_WRITE_MS } from '../src/contract/constants.ts'
import { BAND_ALT, ERROR_WORDS, OPTION_REPLY, REPLY, TOAST_CANNOT_START, optionState } from '../src/contract/copy.ts'
import { hourKey } from '../src/contract/format.ts'
import { TITLE_CHECK_MS } from '../src/core/title.ts'
import { BAND, ENGINE, HOME, ID, PROJECT_DIR, ROOT, RECORD, OPTIONS_FILE, RUN, STATION, T0, TITLE_FILE, TRANSCRIPT, WORKTREE, world } from './world.tsx'
import type { FakeTree, WorldOptions } from './world.tsx'

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
  if (options.settings === undefined) {
    test(name, run)
  } else {
    test(name, { options: options.settings }, run)
  }
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

// Tune in every new session, on
const AUTO = { settings: { autoTuneIn: true } } as const

// Transparent window, on
const SEE_THROUGH = { settings: { transparentWindow: true } } as const

// The engine starting a session, as classic.SessionStart says where it came from
const started = ($: Engine, source: 'startup' | 'resume' | 'clear' | 'compact' | 'fork') =>
  $.classic.SessionStart({ source, ...located } as never)

// The desktop app showing the session; each window is a client of its own
const shown = ($: Engine, clientId = 'window-1', surface: 'desktop' | 'mobile' = 'desktop') =>
  $.session.attach({ surface, clientId })

// /pipcast with words after it
const option = ($: Engine, args: string) => $.command.run({ ...RUN, args })

scenario('the band on the desktop: our own line under another mod\'s', {}, async (_w, $) => {
  const ui = await mounted($)
  const svgs = await ui.findAll({ type: 'Svg' })
  expect(svgs.map((svg) => svg.props.alt)).toEqual([BAND_ALT.in])
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
  expect(ours?.props).toEqual({ alignItems: 'center' })
  expect(ours?.children?.map((child) => child.type)).toEqual(['Box'])
  expect(ours?.children?.[0]?.children?.map((child) => child.type)).toEqual(['Svg', 'Box'])
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
  expect(drawn.props).toEqual({ alignItems: 'center' })
  expect(drawn.children?.map((child) => child.type)).toEqual(['Box'])
  expect(drawn.children?.[0]?.children?.map((child) => child.type)).toEqual(['Svg', 'Box'])
  await ui.unmount()
})

scenario('the plate\'s button stays inside its box', {}, async (_w, $) => {
  const ui = await mounted($)
  const drawn = await ui.drawn()
  const width = (await ui.findAll({ type: 'Svg' }))[0]?.props.width
  const label = (await ui.find({ type: 'Button' }))?.props.label
  expect(typeof width).toBe('number')
  expect(typeof label).toBe('string')
  expect((label as string).replaceAll('\u2002', '')).toBe('')
  expect((label as string).length).toBe(Math.floor((width as number) / 8))
  expect(JSON.stringify(drawn)).not.toContain('\u2026')
  // Our line is [plate Box]; the plate Box holds [the picture, the button's Box]
  const ours = drawn.children?.[1]
  const plateBox = ours !== undefined && typeof ours !== 'string' ? ours.children?.[0] : undefined
  const holder = plateBox !== undefined && typeof plateBox !== 'string' ? plateBox.children?.[1] : undefined
  expect(holder).toMatchObject({ type: 'Box', props: { position: 'absolute', left: -2, right: -2 } })
  await ui.unmount()
})

scenario('pressing the plate tunes in: the record, the station, then TUNE OUT', { env: { PIPCAST_TARGET_BUNDLE_ID: 'com.example.never' } }, async (w, $) => {
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

  expect((await ui.findAll({ type: 'Svg' })).map((svg) => svg.props.alt)).toEqual([BAND_ALT.out])
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

scenario('with ten others on air TUNE IN still tunes in, and the plate shows no count', {}, async (w, $) => {
  const first = await mounted($)
  const source = (await first.find({ type: 'Svg' }))?.props.source
  expect(typeof source).toBe('string')
  await first.unmount()

  for (const [index, id] of ['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h', 'i', 'j'].entries()) {
    w.other(id, T0 - 10_000 + index)
  }
  await $.session.end({ reason: 'other', sessionId: ID, resume: { id: ID } })
  await $.session.start(START)

  const ui = await mounted($)
  const svgs = await ui.findAll({ type: 'Svg' })
  expect(svgs.length).toBe(1)
  expect(svgs[0]?.props.source).toBe(source)
  expect(svgs[0]?.props.alt).toBe(BAND_ALT.in)
  expect((await ui.find({ type: 'Button' }))?.key).toBe('tune-in')
  await ui.unmount()

  expect((await tuneIn($)).text).toBe(REPLY.tunedIn)
  expect(w.record()?.id).toBe(ID)
  expect(w.launched.length).toBe(1)
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
  w.files.set(`${ROOT}/old.txt`, 'before\n')
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
      ['/usr/bin/git', 'rev-parse', '--show-toplevel'],
      ['/usr/bin/git', 'rev-parse', '--verify', '-q', 'HEAD'],
      ['/usr/bin/git', 'diff-index', '-M', '--numstat', 'c0ffee1'],
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

// A command left running in the background, as a Stop lists it
const command = (id: string, line: string, description = 'A command in the background') => ({ id, type: 'shell', status: 'running', description, command: line })

scenario('Stop with a dev server left running in the background is finished at once', {}, async (w, $) => {
  await tuneIn($)
  await turn($)
  w.task('b1devsrv0', { listens: true, output: '  VITE v5.4.0  ready in 300 ms\n' })
  await stop($, { last_assistant_message: 'The site is up at localhost:5173.', background_tasks: [command('b1devsrv0', 'npm run dev', 'Start the dev server')] })
  expect(w.record()?.state).toBe('ready')
  expect(w.record()?.stories).toHaveLength(1)
  expect(w.record()?.stories[0]).toMatchObject({ kind: 'complete', quote: 'The site is up at localhost:5173.' })
})

scenario('Stop with a watcher left running is finished: by what it runs, or by what it says', {}, async (w, $) => {
  await tuneIn($)
  await turn($, 't1')
  await stop($, { last_assistant_message: 'Types are watched.', background_tasks: [command('b2tscwch0', 'npx tsc --watch')] })
  expect(w.record()?.state).toBe('ready')
  expect(w.record()?.stories.at(-1)).toMatchObject({ kind: 'complete', quote: 'Types are watched.' })
  await turn($, 't2')
  w.task('b3build00', { output: '[watch] build finished, watching for changes...\n' })
  await stop($, { last_assistant_message: 'The bundle rebuilds on save.', background_tasks: [command('b3build00', 'npm run build:watch')] })
  expect(w.record()?.state).toBe('ready')
  expect(w.record()?.stories.at(-1)).toMatchObject({ kind: 'complete', quote: 'The bundle rebuilds on save.' })
})

scenario('Stop while a background command works stays working, and its finish lands once the command serves', {}, async (w, $) => {
  await tuneIn($)
  await turn($)
  await $.tool.call({ tool: 'Write', file_path: `${ROOT}/a.txt`, content: 'x\ny\n' } as never)
  w.git.untracked = ['a.txt']
  w.files.set(`${ROOT}/a.txt`, 'x\ny\n')
  const dev = w.task('b4devsrv0')
  await w.clock.advance(1000)
  await stop($, { last_assistant_message: 'Starting the dev server.', background_tasks: [command('b4devsrv0', 'npm install && npm run dev')] })
  expect(w.record()?.state).toBe('working')
  expect(w.record()?.stories).toEqual([])
  // Still installing at the next beat
  await w.clock.advance(10_000)
  expect(w.record()?.state).toBe('working')
  expect(w.record()?.stories).toEqual([])
  dev.listen()
  await w.clock.advance(10_000)
  expect(w.record()?.state).toBe('ready')
  expect(w.record()?.stories).toEqual([{ id: `${ID}:1`, kind: 'ready', at: T0 + 20_000, added: 2, removed: 0, files: 1, durationMs: 1000 }])
})

scenario('a session waiting on a command the look cannot find stays working: a Monitor writes to the engine', {}, async (w, $) => {
  await tuneIn($)
  await turn($)
  await stop($, {
    last_assistant_message: 'Watching the deploy.',
    background_tasks: [command('blv20kp2f', 'until gh run view 9 --json status | grep -q completed; do sleep 30; done', 'Deploy finished')],
  })
  await w.clock.advance(180_000)
  expect(w.record()?.state).toBe('working')
  expect(w.record()?.stories).toEqual([])
})

scenario('a look that cannot be made leaves the session working', {}, async (w, $) => {
  await tuneIn($)
  await turn($)
  w.task('b5devsrv0', { listens: true })
  w.procs.fails = true
  await stop($, { last_assistant_message: 'Up.', background_tasks: [command('b5devsrv0', 'npm run dev')] })
  expect(w.record()?.state).toBe('working')
  expect(w.record()?.stories).toEqual([])
})

scenario('with a subagent at work beside a dev server, the finish waits and nothing is looked at', {}, async (w, $) => {
  await tuneIn($)
  await turn($)
  w.task('b6devsrv0', { listens: true })
  await stop($, {
    last_assistant_message: 'The implementer is on it.',
    background_tasks: [
      { id: 'a3f9c2m7x', type: 'subagent', status: 'running', description: 'Implement the fix', agent_type: 'implementer' },
      command('b6devsrv0', 'npm run dev'),
    ],
  })
  await w.clock.advance(30_000)
  expect(w.record()?.state).toBe('working')
  expect(w.record()?.stories).toEqual([])
  expect(w.ran.some((argv) => argv[0] === '/bin/ps' || argv[0] === '/usr/sbin/lsof')).toBe(false)
})

scenario('a new turn takes a waiting finish back: only the new turn\'s story lands', {}, async (w, $) => {
  await tuneIn($)
  await turn($, 't1')
  const run = w.task('b7tstrun0')
  await stop($, { last_assistant_message: 'Running the tests.', background_tasks: [command('b7tstrun0', 'npm test')] })
  expect(w.record()?.state).toBe('working')
  run.end()
  await turn($, 't2')
  await stop($, { last_assistant_message: 'All tests pass.' })
  await w.clock.advance(30_000)
  expect(w.record()?.stories).toHaveLength(1)
  expect(w.record()?.stories[0]).toMatchObject({ kind: 'complete', quote: 'All tests pass.' })
})

scenario('a Stop with nothing in the background looks at no process', {}, async (w, $) => {
  await tuneIn($)
  await turn($)
  await stop($, { last_assistant_message: 'Done.', background_tasks: [{ id: 's4j8w2n6q', type: 'monitor', status: 'running', description: 'PiP Newsroom · Station' }] })
  await w.clock.advance(30_000)
  expect(w.record()?.state).toBe('ready')
  expect(w.ran.some((argv) => argv[0] === '/bin/ps' || argv[0] === '/usr/sbin/lsof')).toBe(false)
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

scenario("a subagent's calls and its end leave the activity and the turn alone", {}, async (w, $) => {
  await tuneIn($)
  await turn($)
  await $.tool.call({ tool: 'Bash', command: 'ls', description: 'List files', agentId: 'sub' } as never)
  await $.turn.complete({ answer: '', durationMs: 5, isAborted: true, turnId: 'x', reason: 'aborted', agentId: 'sub' } as never)
  expect(w.record()?.activity.length).toBe(0)
  expect(w.record()?.state).toBe('working')
})

scenario("a subagent's lines in its own worktree reach the hour and the story", { transcriptDir: PROJECT_DIR }, async (w, $) => {
  const tree = w.subagent('a1')
  await tuneIn($)
  await turn($)
  // A read-only call: the subagent's worktree is read first, nothing is booked
  await $.tool.call({ tool: 'Bash', command: 'git log --oneline', agentId: 'a1' } as never)
  tree.numstat = '12\t3\tsrc/a.ts\n'
  await $.tool.call({ tool: 'Edit', file_path: `${WORKTREE}/src/a.ts`, old_string: 'a', new_string: 'b', agentId: 'a1' } as never)
  await w.clock.advance(ACTIVITY_WRITE_MS)
  expect(w.record()?.hours.at(-1)).toMatchObject({ added: 12, removed: 3, files: 1 })
  // The commit moves the tree's head: nothing more is booked
  tree.head = 'beef002'
  tree.numstat = ''
  await $.tool.call({ tool: 'Bash', command: 'git commit -am "Fix"', agentId: 'a1' } as never)
  tree.untracked = ['src/b.ts']
  w.files.set(`${WORKTREE}/src/b.ts`, 'one\ntwo\nthree\nfour\n')
  await $.tool.call({ tool: 'Write', file_path: `${WORKTREE}/src/b.ts`, content: 'x', agentId: 'a1' } as never)
  await stop($, { last_assistant_message: 'The implementer is done.' })
  expect(w.record()?.stories.at(-1)).toMatchObject({ kind: 'ready', added: 16, removed: 3, files: 2 })
  expect(w.record()?.hours.at(-1)).toMatchObject({ added: 16, removed: 3, files: 2 })
})

scenario('outside git, an edit to a file in a repository counts once, as git counts it', { hasRepo: false }, async (w, $) => {
  const other: FakeTree = { head: 'cafe001', numstat: '', untracked: [] }
  w.git.worktrees.set('/work/other', other)
  await tuneIn($)
  await turn($)
  const edit = { tool: 'Edit', file_path: '/work/other/src/a.ts', old_string: 'a', new_string: 'b\nc\nd' } as never
  // Its tree is read before the call, nothing has changed, so nothing is booked
  await $.tool.call(edit)
  other.numstat = '3\t0\tsrc/a.ts\n'
  await $.tool.call(edit)
  await stop($, { last_assistant_message: 'Done.' })
  expect(w.record()?.stories.at(-1)).toMatchObject({ kind: 'ready', added: 3, removed: 0, files: 1 })
})

scenario('a commit keeps the lines counted before it', {}, async (w, $) => {
  await tuneIn($)
  await turn($)
  w.git.numstat = '5\t1\tsrc/a.ts\n'
  await $.tool.call({ tool: 'Edit', file_path: `${ROOT}/src/a.ts`, old_string: 'a', new_string: 'b' } as never)
  w.git.head = 'c0ffee2'
  w.git.numstat = ''
  await $.tool.call({ tool: 'Bash', command: 'git commit -am "Fix"' } as never)
  await stop($, { last_assistant_message: 'Done.' })
  expect(w.record()?.stories.at(-1)).toMatchObject({ kind: 'ready', added: 5, removed: 1, files: 1 })
  expect(w.record()?.hours.at(-1)).toMatchObject({ added: 5, removed: 1, files: 1 })
})

scenario('a turn that ends with work still running keeps its lines for the next story', {}, async (w, $) => {
  await tuneIn($)
  await turn($, 't1')
  w.git.numstat = '7\t0\tsrc/a.ts\n'
  await $.tool.call({ tool: 'Bash', command: 'npm run gen' } as never)
  await stop($, {
    last_assistant_message: 'Building.',
    background_tasks: [{ id: 'b1', type: 'shell', status: 'running', description: 'Build', command: 'npm run build' }],
  })
  expect(w.record()?.stories).toHaveLength(0)
  expect(w.record()?.hours.at(-1)).toMatchObject({ added: 7, files: 1 })
  await turn($, 't2')
  await stop($, { last_assistant_message: 'Built.' })
  expect(w.record()?.stories[0]).toMatchObject({ kind: 'ready', added: 7, removed: 0, files: 1 })
})

scenario('lines count in the hour they are written', {}, async (w, $) => {
  await tuneIn($)
  await turn($)
  w.git.numstat = '4\t0\tsrc/a.ts\n'
  await $.tool.call({ tool: 'Bash', command: 'npm run gen' } as never)
  await w.clock.advance(60 * 60_000)
  w.git.numstat = '6\t0\tsrc/a.ts\n'
  await $.tool.call({ tool: 'Bash', command: 'npm run gen' } as never)
  await stop($, { last_assistant_message: 'Done.' })
  expect(w.record()?.hours).toEqual([
    { hour: hourKey(T0), added: 4, removed: 0, files: 1 },
    { hour: hourKey(T0 + 60 * 60_000), added: 2, removed: 0, files: 1 },
  ])
  expect(w.record()?.stories.at(-1)).toMatchObject({ kind: 'ready', added: 6, files: 1 })
})

scenario('a call the engine ran read-only reads no git', {}, async (w, $) => {
  await tuneIn($)
  await turn($)
  await w.clock.settle()
  w.ran.length = 0
  await $.tool.call({ tool: 'Bash', command: 'git log --oneline' } as never)
  expect(w.ran.filter((argv) => argv[0] === '/usr/bin/git')).toEqual([])
})

scenario("what you change between turns is not the session's", {}, async (w, $) => {
  await tuneIn($)
  await turn($, 't1')
  await stop($, { last_assistant_message: 'One.' })
  w.git.numstat = '9\t2\tsrc/a.ts\n'
  await turn($, 't2')
  await stop($, { last_assistant_message: 'Two.' })
  expect(w.record()?.stories.map((story) => story.kind)).toEqual(['complete', 'complete'])
  expect(w.record()?.hours).toEqual([])
})

scenario('a reload keeps the stories and hours on the record, and numbers new stories after them', {}, async (w, $) => {
  await tuneIn($)
  const own = w.record()
  // What the module before the reload left on the record
  w.files.set(
    RECORD,
    JSON.stringify({
      ...own,
      stories: [{ id: `${ID}:7`, kind: 'complete', at: T0 }],
      hours: [{ hour: hourKey(T0), added: 30, removed: 4, files: 2 }],
    }),
  )
  // The module starts over; $.state says tuned in
  await $.session.start(START)
  expect(w.record()?.stories.map((story) => story.id)).toEqual([`${ID}:7`])
  expect(w.record()?.hours).toEqual([{ hour: hourKey(T0), added: 30, removed: 4, files: 2 }])
  await turn($)
  await stop($, { last_assistant_message: 'Done.' })
  expect(w.record()?.stories.at(-1)?.id).toBe(`${ID}:8`)
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

scenario('with Tune in every new session on, a new session tunes in when the desktop app shows it', AUTO, async (w, $) => {
  await started($, 'startup')
  expect(w.record()).toBeNull()
  expect(w.launched.length).toBe(0)

  await shown($)
  expect(w.record()?.id).toBe(ID)
  expect(w.record()?.tunedInAt).toBe(T0)
  expect(w.launched.length).toBe(1)
  expect(w.toasts).toEqual([])

  const ui = await mounted($)
  expect((await ui.findAll({ type: 'Svg' })).map((svg) => svg.props.alt)).toEqual([BAND_ALT.out])
  expect((await ui.find({ type: 'Button' }))?.key).toBe('tune-out')
  await ui.unmount()
})

scenario('a session the desktop app shows before it starts tunes in as it starts', AUTO, async (w, $) => {
  await shown($)
  expect(w.record()).toBeNull()
  await started($, 'startup')
  expect(w.record()?.id).toBe(ID)
  expect(w.launched.length).toBe(1)
})

scenario('after /clear the new session tunes in again', AUTO, async (w, $) => {
  await started($, 'startup')
  await shown($)
  expect(w.record()?.id).toBe(ID)

  await $.session.end({ reason: 'clear', sessionId: ID, resume: { id: ID } })
  expect(w.record()).toBeNull()
  await started($, 'clear')
  expect(w.record()?.id).toBe(ID)
  expect(w.launched.length).toBe(2)
})

scenario('a fork tunes in like a new session', AUTO, async (w, $) => {
  await started($, 'fork')
  await shown($)
  expect(w.record()?.id).toBe(ID)
})

scenario('a resumed session waits for TUNE IN', AUTO, async (w, $) => {
  await started($, 'resume')
  await shown($)
  expect(w.record()).toBeNull()
  expect(w.launched.length).toBe(0)
})

scenario('a compaction keeps a new session waiting for the desktop app', AUTO, async (w, $) => {
  await started($, 'startup')
  await started($, 'compact')
  await shown($)
  expect(w.record()?.id).toBe(ID)
})

scenario('with Tune in every new session off, a new session waits for TUNE IN', {}, async (w, $) => {
  await started($, 'startup')
  await shown($)
  expect(w.record()).toBeNull()
  expect(w.launched.length).toBe(0)
  const ui = await mounted($)
  expect((await ui.find({ type: 'Button' }))?.key).toBe('tune-in')
  await ui.unmount()
})

scenario('a session nothing shows, as in a headless run, never tunes itself in', AUTO, async (w, $) => {
  await started($, 'startup')
  await turn($)
  await w.clock.advance(10_000)
  expect(w.record()).toBeNull()
  expect(w.launched.length).toBe(0)
})

scenario('a session only a phone shows waits for the desktop app', AUTO, async (w, $) => {
  await started($, 'startup')
  await shown($, 'phone-1', 'mobile')
  expect(w.record()).toBeNull()
  await shown($)
  expect(w.record()?.id).toBe(ID)
})

scenario('a session tuned out stays off the air when the desktop app shows it again or the mod reloads', AUTO, async (w, $) => {
  await started($, 'startup')
  await shown($)
  expect((await tuneIn($)).text).toBe(REPLY.tunedOut)
  expect(w.record()).toBeNull()

  await shown($, 'window-2')
  expect(w.record()).toBeNull()
  // The module starts over; $.state says tuned out
  await $.session.start(START)
  await shown($, 'window-3')
  expect(w.record()).toBeNull()
  expect(w.launched.length).toBe(1)
})

scenario('/pipcast before the desktop app shows the session settles it', AUTO, async (w, $) => {
  await started($, 'startup')
  expect((await tuneIn($)).text).toBe(REPLY.tunedIn)
  expect((await tuneIn($)).text).toBe(REPLY.tunedOut)
  await shown($)
  expect(w.record()).toBeNull()
  expect(w.launched.length).toBe(1)
})

scenario('a reload keeps a new session waiting for the desktop app', AUTO, async (w, $) => {
  await started($, 'startup')
  // The module starts over; $.state says the session waits
  await $.session.start(START)
  await shown($)
  expect(w.record()?.id).toBe(ID)
  expect(w.launched.length).toBe(1)
})

scenario('a new session tunes in once, however many windows show it at once', AUTO, async (w, $) => {
  await started($, 'startup')
  await Promise.all([shown($), shown($, 'window-2')])
  expect(w.record()?.id).toBe(ID)
  expect(w.launched.length).toBe(1)
})

scenario('a station that will not start: a new session leaves the toast once and no record', { ...AUTO, launchExit: 1, launchOut: '' }, async (w, $) => {
  await started($, 'startup')
  await shown($)
  expect(w.toasts).toEqual([TOAST_CANNOT_START])
  expect(w.record()).toBeNull()
  await shown($, 'window-2')
  expect(w.toasts).toEqual([TOAST_CANNOT_START])
})

scenario("the window's close takes a session that tuned in by itself off the air for good", AUTO, async (w, $) => {
  await started($, 'startup')
  await shown($)
  expect(w.record()?.id).toBe(ID)
  w.files.set(`${HOME}/control.json`, JSON.stringify({ v: 1, closedAt: T0 + 1 }))
  await w.clock.advance(10_000)
  expect(w.record()).toBeNull()
  await shown($, 'window-2')
  expect(w.record()).toBeNull()
})


scenario('/pipcast auto says what Tune in every new session is set to', {}, async (w, $) => {
  expect((await option($, 'auto')).text).toBe(optionState('auto', false))
  w.saved.autoTuneIn = 'true'
  expect((await option($, 'auto')).text).toBe(optionState('auto', true))
  expect(w.record()).toBeNull()
})

scenario("/pipcast auto on and off save the setting with Claude Code's own command", {}, async (w, $) => {
  expect((await option($, 'auto on')).text).toBe(optionState('auto', true))
  expect(w.saved.autoTuneIn).toBe('true')
  expect(w.engineCalls.find((call) => call.argv.includes('--values-stdin'))?.stdin).toBe(JSON.stringify({ autoTuneIn: 'true' }))
  expect((await option($, 'auto off')).text).toBe(optionState('auto', false))
  expect(w.saved.autoTuneIn).toBe('false')
  // Neither tunes the session in or out
  expect(w.record()).toBeNull()
  expect(w.launched.length).toBe(0)
})

scenario('a copy Claude Code did not install keeps its options as pipcast@inline', {}, async (w, $) => {
  await option($, 'auto on')
  const save = w.engineCalls.find((call) => call.argv.includes('--values-stdin'))
  expect(save?.argv[0]).toBe(ENGINE)
  expect(save?.argv[1]).toBe('--plugin-dir')
  expect(save?.argv.slice(3)).toEqual(['plugin', 'configure', '--json', '--values-stdin', '--', 'pipcast@inline'])
})

scenario('the words after /pipcast are read in any case and spacing', {}, async (w, $) => {
  expect((await option($, '  AUTO   On ')).text).toBe(optionState('auto', true))
  expect(w.saved.autoTuneIn).toBe('true')
})

scenario('an option /pipcast does not know, or a value that is not on or off, saves nothing', {}, async (w, $) => {
  expect((await option($, 'volume on')).text).toBe(OPTION_REPLY.unknown('volume'))
  expect((await option($, 'auto maybe')).text).toBe(OPTION_REPLY.badValue('auto'))
  expect((await option($, 'auto on now')).text).toBe(OPTION_REPLY.badValue('auto'))
  expect(w.engineCalls).toEqual([])
  expect(w.record()).toBeNull()
})

scenario('a save or a read Claude Code refuses says so', { configureFails: true }, async (_w, $) => {
  expect((await option($, 'auto on')).text).toBe(OPTION_REPLY.cannotSave('auto', true))
  expect((await option($, 'auto')).text).toBe(OPTION_REPLY.cannotRead('auto'))
})

scenario('the engine is the parent of a command the mod starts', {}, async (w, $) => {
  await option($, 'auto')
  expect(w.ran.some((argv) => argv[0] === '/bin/sh')).toBe(true)
  expect(w.engineCalls[0]?.argv[0]).toBe(ENGINE)
})

scenario('CLAUDE_CODE_EXECPATH names the engine when it is set', { env: { CLAUDE_CODE_EXECPATH: '/pip/env/claude' } }, async (w, $) => {
  await option($, 'auto')
  expect(w.ran.some((argv) => argv[0] === '/bin/sh')).toBe(false)
  expect(w.engineCalls[0]?.argv[0]).toBe('/pip/env/claude')
})

scenario('with no engine to be found, /pipcast auto says it could not read or save', { engine: null }, async (_w, $) => {
  expect((await option($, 'auto')).text).toBe(OPTION_REPLY.cannotRead('auto'))
  expect((await option($, 'auto on')).text).toBe(OPTION_REPLY.cannotSave('auto', true))
})

scenario('/pipcast transparency says what Transparent window is set to', {}, async (w, $) => {
  expect((await option($, 'transparency')).text).toBe(optionState('transparency', false))
  w.saved.transparentWindow = 'true'
  expect((await option($, 'transparency')).text).toBe(optionState('transparency', true))
  // Reading it tells the station nothing
  expect(w.shared()).toBeNull()
})

scenario('/pipcast transparency on and off save the setting and tell the station at once, tuned in or not', {}, async (w, $) => {
  expect((await option($, 'transparency on')).text).toBe(optionState('transparency', true))
  expect(w.saved.transparentWindow).toBe('true')
  expect(w.engineCalls.find((call) => call.argv.includes('--values-stdin'))?.stdin).toBe(JSON.stringify({ transparentWindow: 'true' }))
  expect(w.shared()).toEqual({ v: 1, transparent: true })
  expect((await option($, 'transparency off')).text).toBe(optionState('transparency', false))
  expect(w.saved.transparentWindow).toBe('false')
  expect(w.shared()).toEqual({ v: 1, transparent: false })
  // Neither tunes the session in or out
  expect(w.record()).toBeNull()
  expect(w.launched.length).toBe(0)
})

scenario('options.json goes through a temporary file named after the session', {}, async (w, $) => {
  await option($, 'transparency on')
  expect(w.writes).toContain(`${OPTIONS_FILE}.${ID}.tmp`)
  expect(w.writes).not.toContain(`${OPTIONS_FILE}.tmp`)
  expect(w.files.has(`${OPTIONS_FILE}.${ID}.tmp`)).toBe(false)
})

scenario('a save Claude Code refuses tells the station nothing', { configureFails: true }, async (w, $) => {
  expect((await option($, 'transparency on')).text).toBe(OPTION_REPLY.cannotSave('transparency', true))
  expect(w.shared()).toBeNull()
})

scenario('/pipcast auto on tells the station nothing', {}, async (w, $) => {
  await option($, 'auto on')
  expect(w.shared()).toBeNull()
})

scenario('tuning in tells the station Transparent window before the station starts', SEE_THROUGH, async (w, $) => {
  await tuneIn($)
  expect(w.shared()).toEqual({ v: 1, transparent: true })
  const order = w.ran.flatMap((argv) => (argv[0] === STATION ? ['station'] : argv[0] === '/bin/mv' && argv.includes(OPTIONS_FILE) ? ['options'] : []))
  expect(order).toEqual(['options', 'station'])
})

scenario('tuning in leaves options.json alone when it already agrees', SEE_THROUGH, async (w, $) => {
  w.files.set(OPTIONS_FILE, JSON.stringify({ v: 1, transparent: true }))
  await tuneIn($)
  expect(w.writes.filter((path) => path.startsWith(OPTIONS_FILE))).toEqual([])
  expect(w.shared()).toEqual({ v: 1, transparent: true })
})

scenario('tuning in puts its own value over an options.json that says otherwise or cannot be read', {}, async (w, $) => {
  w.files.set(OPTIONS_FILE, JSON.stringify({ v: 1, transparent: true }))
  await tuneIn($)
  expect(w.shared()).toEqual({ v: 1, transparent: false })
  expect((await tuneIn($)).text).toBe(REPLY.tunedOut)
  w.files.set(OPTIONS_FILE, 'not json')
  await tuneIn($)
  expect(w.shared()).toEqual({ v: 1, transparent: false })
})

scenario('a session that tunes in by itself tells the station too', { settings: { autoTuneIn: true, transparentWindow: true } }, async (w, $) => {
  await started($, 'startup')
  await shown($)
  expect(w.record()?.id).toBe(ID)
  expect(w.shared()).toEqual({ v: 1, transparent: true })
})

scenario('a reload while tuned in tells the station the value it brings', SEE_THROUGH, async (w, $) => {
  await tuneIn($)
  // An older load's value
  w.files.set(OPTIONS_FILE, JSON.stringify({ v: 1, transparent: false }))
  // The module starts over; $.state says tuned in
  await $.session.start(START)
  expect(w.shared()).toEqual({ v: 1, transparent: true })
})

scenario('a session that is not tuned in tells the station nothing as it loads and works', SEE_THROUGH, async (w, $) => {
  await $.session.start(START)
  await turn($)
  await w.clock.advance(10_000)
  expect(w.shared()).toBeNull()
})
