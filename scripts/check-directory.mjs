// Checks plugin/ and the repository against the rules of Anthropic's plugin
// directory that can be checked here, from its plugin pre-submission checklist
// (https://claude.com/docs/plugins/pre-submission-checklist). The developer
// portal's validation runs more, and a security scan and a reviewer read the
// plugin besides. It reads the files git tracks or would add, since the portal
// reads what is committed, and prints each problem it finds.

import { execFileSync } from 'node:child_process'
import { closeSync, lstatSync, openSync, readFileSync, readSync } from 'node:fs'
import { basename, dirname, extname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

import { modNameFindings } from './lib/mod-names.mjs'
import { renameShellNames } from './lib/react-dom-names.mjs'

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..')

// The files in plugin/ that the directory's validator can't inspect, each with
// the reason it ships. Each one holds every version for a reviewer at
// Anthropic, so a file joins this list only when Pipcast can't do without it.
const HELD = {
  'station/pipcast-station': 'the station, a native macOS program built from station/Sources',
  'station/sounds/breaking.m4a': "BREAKING NEWS's jingle, rendered from the design system's score",
  'station/sounds/breaking-out.m4a': "BREAKING NEWS's outro, rendered from the design system's score",
  'station/sounds/hour.m4a': "the hour's jingle, rendered from the design system's score",
  'station/sounds/hour-out.m4a': "the hour's outro, rendered from the design system's score",
  'station/sounds/beat-minor.caf': "the beat under BREAKING NEWS, rendered from the design system's score",
  'station/sounds/beat-major.caf': "the beat under the hour, rendered from the design system's score",
}

// The README sections the listing and this repository's README share, word for word
const SHARED = ['What Pipcast runs and reads', 'Privacy']

// React's own files, as scripts/build-web.mjs copies them into the page
const VENDOR = {
  'station/web/vendor/react.production.min.js': 'node_modules/react/umd/react.production.min.js',
  'station/web/vendor/react-dom.production.min.js': 'node_modules/react-dom/umd/react-dom.production.min.js',
  'station/web/vendor/LICENSE-react.txt': 'node_modules/react/LICENSE',
}

const PLUGIN = 'plugin'
const KIB = 1024
const MIB = 1048576
const IMAGES = { '.png': 'PNG', '.jpg': 'JPEG', '.jpeg': 'JPEG', '.gif': 'GIF', '.webp': 'WebP' }
const FONTS = ['.ttf', '.otf', '.woff', '.woff2']
const READABLE = ['.js', '.mjs', '.cjs', '.css', '.html']
const RESERVED = ['claude', 'anthropic', 'anthropics', 'claude-code', 'claude-mods', 'official', 'plugin', 'mcp', 'test']
const RESERVED_PREFIXES = ['claude-', 'anthropic-', 'anthropics-', 'cc-plugin-']
const SYSTEM_FILES = ['.DS_Store', 'Thumbs.db', 'desktop.ini', '__MACOSX']
const PACKAGE_SETTINGS = ['.npmrc', '.yarnrc', '.yarnrc.yml', 'bunfig.toml', 'uv.toml', 'pip.conf', '.pypirc']
const LOCKFILES = ['package-lock.json', 'npm-shrinkwrap.json', 'bun.lock', 'bun.lockb']
const ATTRIBUTES = ['export-ignore', 'export-subst', 'filter', 'ident', 'eol', 'text', 'crlf', 'working-tree-encoding']
const PNG_END = Buffer.from([0x00, 0x00, 0x00, 0x00, 0x49, 0x45, 0x4e, 0x44, 0xae, 0x42, 0x60, 0x82])
const PNG_START = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])

const problems = []
const problem = (text) => problems.push(text)

const size = (n) => (n < MIB ? `${Math.round(n / KIB)} KiB` : `${(n / MIB).toFixed(1)} MiB`)
const extension = (path) => extname(path).toLowerCase()
const isImage = (path) => extension(path) in IMAGES
const isFont = (path) => FONTS.includes(extension(path))

// The files on disk that git tracks or would add, less what .gitignore keeps out
const listed = execFileSync('git', ['ls-files', '-z', '--cached', '--others', '--exclude-standard'], { cwd: root, encoding: 'utf8', maxBuffer: 1 << 28 })
  .split('\0')
  .filter((path) => path !== '')
const stats = new Map()
for (const path of listed) {
  try {
    stats.set(path, lstatSync(join(root, path)))
  } catch {
    // listed but gone from the disk, as a file deleted and not yet staged
  }
}
const files = listed.filter((path) => stats.has(path))

const modes = new Map()
for (const entry of execFileSync('git', ['ls-files', '-s', '-z'], { cwd: root, encoding: 'utf8', maxBuffer: 1 << 28 }).split('\0')) {
  const tab = entry.indexOf('\t')
  if (tab !== -1) {
    modes.set(entry.slice(tab + 1), entry.slice(0, entry.indexOf(' ')))
  }
}

const folders = new Set()
for (const path of files) {
  const parts = path.split('/')
  for (let i = 1; i < parts.length; i++) {
    folders.add(parts.slice(0, i).join('/'))
  }
}

const readText = (path) => readFileSync(join(root, path), 'utf8')
const pluginFiles = files.filter((path) => path.startsWith(`${PLUGIN}/`) && !stats.get(path).isSymbolicLink()).map((path) => path.slice(PLUGIN.length + 1))
const pluginBytes = new Map(pluginFiles.map((path) => [path, readFileSync(join(root, PLUGIN, path))]))

// README

const readmePath = `${PLUGIN}/README.md`
const readme = pluginBytes.has('README.md') ? pluginBytes.get('README.md').toString('utf8') : null

if (readme === null) {
  problem('plugin/README.md is missing: the directory needs a README of 40 words or more in the plugin folder.')
} else {
  const kept = []
  let fence = null
  for (const line of readme.split('\n')) {
    if (fence === null) {
      if (line.startsWith('```') || line.startsWith('~~~')) {
        fence = line.slice(0, 3)
      } else {
        kept.push(line)
      }
    } else if (line.startsWith(fence)) {
      fence = null
    }
  }
  const words = kept
    .join('\n')
    .split(/\s+/)
    .filter((token) => /[\p{L}\p{N}]/u.test(token)).length
  if (words < 40) {
    problem(`plugin/README.md has ${words} words outside code blocks: the directory needs 40 or more.`)
  }
  for (const path of pluginFiles.filter((file) => isImage(file) || isFont(file))) {
    const name = basename(path)
    const named = readme.includes(path) ? path : readme.includes(name) ? name : null
    if (named !== null) {
      problem(`plugin/README.md names ${named}, an image or font in plugin/: show a bundled image with Markdown image syntax, and leave font paths out.`)
    }
  }
}

const section = (text, heading) => {
  const lines = text.split('\n')
  const start = lines.indexOf(`## ${heading}`)
  if (start === -1) {
    return null
  }
  let end = lines.length
  for (let i = start + 1; i < lines.length; i++) {
    if (lines[i].startsWith('## ')) {
      end = i
      break
    }
  }
  return lines.slice(start, end).join('\n').trimEnd()
}

const rootReadme = files.includes('README.md') ? readText('README.md') : null
for (const heading of SHARED) {
  const mine = readme === null ? undefined : section(readme, heading)
  const theirs = rootReadme === null ? null : section(rootReadme, heading)
  if (mine === null) {
    problem(`${readmePath} has no "## ${heading}" section.`)
  }
  if (rootReadme !== null && theirs === null) {
    problem(`README.md has no "## ${heading}" section.`)
  }
  if (typeof mine === 'string' && typeof theirs === 'string' && mine !== theirs) {
    problem(`The "## ${heading}" section differs between plugin/README.md and README.md: keep it the same, word for word.`)
  }
}

// Manifest and hooks

let manifest = null
try {
  const bytes = pluginBytes.get('.claude-plugin/plugin.json')
  if (bytes === undefined) {
    throw new Error('no such file')
  }
  manifest = JSON.parse(bytes.toString('utf8'))
} catch (error) {
  problem(`plugin/.claude-plugin/plugin.json is missing or not JSON: ${error.message}`)
}

if (manifest !== null) {
  const name = manifest.name
  if (typeof name !== 'string' || !/^[a-z0-9](?:[a-z0-9-]{0,62}[a-z0-9])?$/.test(name)) {
    problem(`The plugin's name, "${name}", must be lowercase letters, digits and hyphens, 64 characters at most, starting and ending with a letter or digit.`)
  }
  if (typeof name === 'string' && (RESERVED.includes(name) || RESERVED_PREFIXES.some((prefix) => name.startsWith(prefix)))) {
    problem(`The plugin's name, "${name}", is reserved, or reads as one of Anthropic's own.`)
  }
  const fields = { description: manifest.description, version: manifest.version, 'author.name': manifest.author?.name, license: manifest.license }
  for (const [field, value] of Object.entries(fields)) {
    if (typeof value !== 'string' || value === '') {
      problem(`plugin/.claude-plugin/plugin.json sets no ${field}.`)
    }
  }
  const hooks = manifest.hooks
  const named = (Array.isArray(hooks) ? hooks : [hooks]).some((entry) => entry === './hooks/hooks.json' || entry === 'hooks/hooks.json')
  if (named) {
    problem('plugin/.claude-plugin/plugin.json names hooks/hooks.json under hooks, which Claude Code loads by itself.')
  }
}

if (!pluginBytes.has('LICENSE')) {
  problem('plugin/LICENSE is missing.')
}

if (pluginBytes.has('hooks/hooks.json')) {
  let hooks = null
  try {
    hooks = JSON.parse(pluginBytes.get('hooks/hooks.json').toString('utf8'))
  } catch (error) {
    problem(`plugin/hooks/hooks.json is not JSON: ${error.message}`)
  }
  if (hooks !== null) {
    const modules = Array.isArray(hooks?.modules) && hooks.modules.every((entry) => typeof entry === 'string')
    const object = typeof hooks?.hooks === 'object' && hooks.hooks !== null && !Array.isArray(hooks.hooks)
    if (!modules && !object) {
      problem('plugin/hooks/hooks.json has neither a modules array nor a hooks object.')
    }
  }
}

// Files in plugin/

const isText = (bytes) => {
  if (bytes.includes(0)) {
    return false
  }
  try {
    new TextDecoder('utf-8', { fatal: true }).decode(bytes)
    return true
  } catch {
    return false
  }
}

const startsWith = (bytes, prefix) => bytes.length >= prefix.length && bytes.subarray(0, prefix.length).equals(prefix)
const endsWith = (bytes, suffix) => bytes.length >= suffix.length && bytes.subarray(bytes.length - suffix.length).equals(suffix)

const whole = (path, bytes) => {
  switch (IMAGES[extension(path)]) {
    case 'PNG':
      return startsWith(bytes, PNG_START) && endsWith(bytes, PNG_END)
    case 'JPEG':
      return startsWith(bytes, Buffer.from([0xff, 0xd8, 0xff])) && endsWith(bytes, Buffer.from([0xff, 0xd9]))
    case 'GIF':
      return (startsWith(bytes, Buffer.from('GIF87a')) || startsWith(bytes, Buffer.from('GIF89a'))) && endsWith(bytes, Buffer.from([0x3b]))
    default:
      return bytes.length >= 12 && bytes.subarray(0, 4).toString('latin1') === 'RIFF' && bytes.subarray(8, 12).toString('latin1') === 'WEBP' && bytes.readUInt32LE(4) + 8 === bytes.length
  }
}

if (pluginFiles.length > 512) {
  problem(`plugin/ holds ${pluginFiles.length} files: the directory holds a plugin of more than 512 for a reviewer.`)
}

for (const path of pluginFiles) {
  const bytes = pluginBytes.get(path)
  if (bytes.length >= 5 * MIB) {
    problem(`plugin/${path} is ${size(bytes.length)}: the directory refuses a file over 5 MiB.`)
  }
  const held = path in HELD
  if (isImage(path)) {
    if (!whole(path, bytes)) {
      problem(`plugin/${path} is not a whole ${IMAGES[extension(path)]} image.`)
    }
  } else if (!isFont(path) && !held) {
    if (!isText(bytes)) {
      problem(`plugin/${path} is neither text nor an image nor a font, so the directory's validator can't inspect it. Leave it out, or add it to HELD in scripts/check-directory.mjs with the reason it ships.`)
    } else if (bytes.length > 256 * KIB) {
      problem(`plugin/${path} is ${size(bytes.length)}: the directory holds a file over 256 KiB that isn't an image or a font for a reviewer.`)
    }
  }
  if (path.split('/').some((segment) => SYSTEM_FILES.includes(segment))) {
    problem(`plugin/${path} is a system file the directory refuses.`)
  }
  if (!path.includes('/') && PACKAGE_SETTINGS.includes(path)) {
    problem(`plugin/${path} sets where packages come from, which the directory refuses beside a package launcher or install.`)
  }
}

for (const path of Object.keys(HELD)) {
  if (!pluginBytes.has(path)) {
    problem(`HELD names plugin/${path}, which plugin/ doesn't hold: take it out of the list.`)
  }
}

if (pluginBytes.has('package.json') && LOCKFILES.some((lockfile) => pluginBytes.has(lockfile))) {
  problem('plugin/package.json sits beside a lockfile, so Claude Code would install packages with the plugin, which the directory holds for a reviewer.')
}

// Readable code

const vendored = Object.keys(VENDOR)
for (const path of pluginFiles.filter((file) => READABLE.includes(extension(file)) && !vendored.includes(file))) {
  const longest = Math.max(...pluginBytes.get(path).toString('utf8').split('\n').map((line) => line.length))
  if (longest > 5000) {
    problem(`plugin/${path} has a line of ${longest} characters: keep what ships readable, and never minify it.`)
  }
}

for (const [path, source] of Object.entries(VENDOR)) {
  let original = null
  try {
    original = readFileSync(join(root, source))
  } catch {
    problem(`${source} is missing: run npm ci first.`)
  }
  if (original === null) {
    continue
  }
  if (path === 'station/web/vendor/react-dom.production.min.js') {
    if (!(pluginBytes.get(path)?.equals(Buffer.from(renameShellNames(original.toString('utf8')))) ?? false)) {
      problem(`plugin/${path} differs from React DOM's own file with sh and Sh renamed: build it with scripts/build-web.mjs, and change nothing else in it.`)
    }
  } else if (!(pluginBytes.get(path)?.equals(original) ?? false)) {
    problem(`plugin/${path} differs from ${source}: copy React's file unchanged.`)
  }
}

// The mod, as the directory reads it

if (pluginBytes.has('hooks/register.js')) {
  for (const finding of modNameFindings(pluginBytes.get('hooks/register.js').toString('utf8'), 'plugin/hooks/register.js')) {
    problem(finding)
  }
}

// The repository

for (const path of files) {
  const mode = modes.get(path)
  if (mode === '120000' || stats.get(path).isSymbolicLink()) {
    problem(`${path} is a symbolic link: commit the file itself.`)
    continue
  }
  if (mode === '160000') {
    problem(`${path} is a Git submodule: the directory reads only regular files.`)
    continue
  }
  if (stats.get(path).isFile()) {
    const head = Buffer.alloc(64)
    const fd = openSync(join(root, path), 'r')
    const read = readSync(fd, head, 0, head.length, 0)
    closeSync(fd)
    if (head.subarray(0, read).toString('latin1').startsWith('version https://git-lfs.github.com/spec/v1')) {
      problem(`${path} is a Git LFS pointer: commit the file itself.`)
    }
  }
}

const unholdable = "which Windows or macOS can't hold, and the portal can't validate the repository."
const show = (char) => (char.charCodeAt(0) < 32 ? JSON.stringify(char).slice(1, -1) : char)
for (const path of [...files, ...folders]) {
  for (const segment of path.split('/')) {
    const bad = [...segment].find((char) => '<>:"|?*\\'.includes(char) || char.charCodeAt(0) < 32)
    if (bad !== undefined) {
      problem(`${path}: its name has "${show(bad)}", ${unholdable}`)
    }
    if (segment.endsWith('.') || segment.endsWith(' ')) {
      problem(`${path}: its name ends with a dot or a space, ${unholdable}`)
    }
    if (/^(con|prn|aux|nul|com[1-9]|lpt[1-9])(\..*)?$/i.test(segment)) {
      problem(`${path}: ${segment} is a Windows device name, ${unholdable}`)
    }
  }
}

const byLowercase = new Map()
for (const path of [...files, ...folders]) {
  const key = path.toLowerCase()
  byLowercase.set(key, [...(byLowercase.get(key) ?? []), path])
}
for (const paths of byLowercase.values()) {
  for (const other of paths.slice(1)) {
    problem(`${paths[0]} and ${other} differ only in capitalization, which the portal can't validate.`)
  }
}

if (!/^[A-Za-z0-9._-]+$/.test(PLUGIN)) {
  problem(`The plugin's folder, ${PLUGIN}, must be named with letters, digits, dots, hyphens and underscores only.`)
}

for (const path of files.filter((file) => basename(file) === '.gitattributes' && !stats.get(file).isSymbolicLink())) {
  for (const line of readText(path).split('\n')) {
    const trimmed = line.trim()
    if (trimmed === '' || trimmed.startsWith('#')) {
      continue
    }
    for (const token of trimmed.split(/\s+/).slice(1)) {
      const attribute = token.replace(/^[-!]/, '').split('=')[0]
      if (ATTRIBUTES.includes(attribute)) {
        problem(`${path} sets ${attribute}, which stops the portal from validating the repository.`)
      }
    }
  }
}

const archive = execFileSync('git', ['archive', '--format=zip', 'HEAD'], { cwd: root, maxBuffer: 1 << 30 }).length
if (archive >= 50 * MIB) {
  problem(`The repository is ${size(archive)} as a zip archive: the portal can't validate one of 50 MiB or more.`)
}
const unpacked = files.reduce((total, path) => total + stats.get(path).size, 0)
if (unpacked >= 256 * MIB) {
  problem(`The repository is ${size(unpacked)} unpacked: the portal can't validate one of 256 MiB or more.`)
}
if (files.length + folders.size >= 10000) {
  problem(`The repository holds ${files.length + folders.size} files and folders: the portal can't validate 10,000 or more.`)
}

const count = problems.length
if (count > 0) {
  for (const text of problems) {
    console.error(text)
  }
  console.error(`Found ${count} ${count === 1 ? 'problem' : 'problems'} with what Anthropic's plugin directory checks. Anthropic's plugin directory in docs/development.md says what each rule is for.`)
  process.exit(1)
}
const held = Object.keys(HELD).length
console.log(`plugin/ and the repository pass every check of Anthropic's plugin directory made here. The ${held} files in HELD hold each version for a reviewer.`)
