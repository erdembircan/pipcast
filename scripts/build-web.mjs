// Builds the page the station shows into plugin/station/web/: index.html,
// station.js, station.css, fonts/ and vendor/. Nothing is minified, since
// Anthropic's plugin directory holds code it can't read for a reviewer:
// station.js is the page's own code, bundled as written, and React comes as its
// own production files in vendor/, copied unchanged from its npm package with
// its license. index.html loads them first, and station.js takes React and
// ReactDOM from the globals they set. The output folder is emptied first, so the
// build is reproducible.
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
const out = join(root, 'plugin/station/web')

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

await build({
  entryPoints: [join(renderer, 'src/main.tsx')],
  outfile: join(out, 'station.js'),
  bundle: true,
  format: 'iife',
  target: 'safari16',
  minify: false,
  plugins: [reactGlobals],
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
cpSync(join(renderer, 'index.html'), join(out, 'index.html'))

mkdirSync(join(out, 'vendor'), { recursive: true })
for (const [from, to] of VENDOR) {
  copyFileSync(join(root, from), join(out, to))
}

console.log('plugin/station/web')
