// Builds the page the station shows into plugin/station/web/: index.html,
// station.js, design.js, station.css, fonts/, textures/ and vendor/. None of
// Pipcast's own code is minified, so the people who install it can read it as
// written:
// station.js is the page's own code, bundled as written, design.js is the
// design system's bundle, design/components/bundle.js, copied as it is (the
// design's comments, which say where code follows another's, are kept), and
// React comes as its own production files in vendor/, copied unchanged from
// its npm package with its license. STORMTRACKER draws its globe in design.js
// itself, with WebGL, so there is no library for it, and the pictures of the
// Earth it draws on are copied from design/textures into textures/.
// index.html loads React first, then design.js, which takes React from its
// global and sets PipNews, then station.js, which takes React, ReactDOM and
// PipNews from the globals they set. The output folder is emptied first, so
// the build is reproducible.
// With --dev it builds the development build's page instead, from
// packages/dev/src/main.tsx into .dev/web, for scripts/build-dev.sh: never into
// plugin/.
import { build, transform } from 'esbuild'
import { cpSync, copyFileSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const VENDOR = [
  ['node_modules/react/umd/react.production.min.js', 'vendor/react.production.min.js'],
  ['node_modules/react-dom/umd/react-dom.production.min.js', 'vendor/react-dom.production.min.js'],
  ['node_modules/react/LICENSE', 'vendor/LICENSE-react.txt'],
]

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const renderer = join(root, 'packages/renderer')

const args = process.argv.slice(2)
if (args.length > 1 || (args.length === 1 && args[0] !== '--dev')) {
  throw new Error('usage: node scripts/build-web.mjs [--dev]')
}
const dev = args[0] === '--dev'
const entry = dev ? join(root, 'packages/dev/src/main.tsx') : join(renderer, 'src/main.tsx')
const out = dev ? join(root, '.dev/web') : join(root, 'plugin/station/web')

rmSync(out, { recursive: true, force: true })
mkdirSync(out, { recursive: true })

// react and react-dom are the globals React's own files set, never a copy in
// the bundle
const reactGlobals = {
  name: 'react-globals',
  setup(pluginBuild) {
    pluginBuild.onResolve({ filter: /^react(-dom)?(\/.*)?$/ }, (args) => {
      if (args.path === 'react') {
        return { path: 'React', namespace: 'react-global' }
      }
      if (args.path === 'react-dom' || args.path === 'react-dom/client') {
        return { path: 'ReactDOM', namespace: 'react-global' }
      }
      return { errors: [{ text: `station.js takes React from vendor/, and nothing else from react or react-dom: ${args.path}` }] }
    })
    pluginBuild.onLoad({ filter: /.*/, namespace: 'react-global' }, (args) => ({
      contents: `module.exports = window.${args.path}`,
      loader: 'js',
    }))
  },
}

// The design system's bundle is its own script in the page, loaded before
// station.js, so the page's code reads PipNews from the global it sets and the
// import that loads the bundle (packages/renderer/src/design.ts, which the
// tests use) is an empty module here
const designGlobal = {
  name: 'design-global',
  setup(pluginBuild) {
    pluginBuild.onResolve({ filter: /design\/components\/bundle\.js$/ }, () => ({ path: 'design.js', namespace: 'design-global' }))
    pluginBuild.onLoad({ filter: /.*/, namespace: 'design-global' }, () => ({ contents: '', loader: 'js' }))
  },
}

await build({
  entryPoints: [entry],
  outfile: join(out, 'station.js'),
  bundle: true,
  format: 'iife',
  target: 'safari16',
  minify: false,
  plugins: [reactGlobals, designGlobal],
  // JSX compiles to React.createElement, against the global React. No
  // tsconfig.json is read, since its own jsx setting would win over esbuild's;
  // the aliases stand in for its paths.
  tsconfigRaw: { compilerOptions: { jsx: 'react', jsxFactory: 'React.createElement', jsxFragmentFactory: 'React.Fragment' } },
  alias: {
    '@pipcast/contract': join(root, 'packages/contract/src/index.ts'),
    '@pipcast/director': join(root, 'packages/director/src/index.ts'),
  },
  define: { 'process.env.NODE_ENV': '"production"' },
  logLevel: 'warning',
})

// The design system's stylesheet asks Google Fonts for its typefaces; the
// page carries them itself, so that line goes.
const design = readFileSync(join(root, 'design/components/bundle.css'), 'utf8').replace(/^@import url\([^)]*\);?[ \t]*\r?\n/gm, '')
const css = [
  readFileSync(join(renderer, 'src/fonts.css'), 'utf8'),
  readFileSync(join(renderer, 'src/page.css'), 'utf8'),
  design,
].join('\n')
const styles = await transform(css, { loader: 'css', minify: false, target: 'safari16' })
// The station must never reach the network
if (/@import/i.test(styles.code) || /https?:/i.test(styles.code)) {
  throw new Error('station.css must contain no @import and no http URL')
}
writeFileSync(join(out, 'station.css'), styles.code)

cpSync(join(root, 'assets/fonts'), join(out, 'fonts'), { recursive: true })
cpSync(join(root, 'design/textures'), join(out, 'textures'), { recursive: true })
cpSync(join(renderer, 'index.html'), join(out, 'index.html'))
copyFileSync(join(root, 'design/components/bundle.js'), join(out, 'design.js'))

mkdirSync(join(out, 'vendor'), { recursive: true })
for (const [from, to] of VENDOR) {
  copyFileSync(join(root, from), join(out, to))
}

console.log(dev ? '.dev/web' : 'plugin/station/web')
