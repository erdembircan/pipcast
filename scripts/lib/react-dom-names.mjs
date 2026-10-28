// React DOM's production file with two of its minified names given others:
// Anthropic's plugin directory reads the functions React's minifier named sh
// and Sh as the shell, and warns that the file holds a command that downloads
// and runs code (RUNTIME_FETCH_EXEC). Nothing else in the file changes, and the
// new names appear nowhere in it before, so naming them back gives React's own
// file again.
import { createRequire } from 'node:module'
import vm from 'node:vm'

const ts = createRequire(import.meta.url)('typescript')

export const RENAMED = { sh: 'sQ9', Sh: 'SQ9' }

export function renameShellNames(source) {
  for (const name of Object.values(RENAMED)) {
    if (new RegExp(`(?<![\\w$])${name}(?![\\w$])`).test(source)) {
      throw new Error(`React DOM already has a name ${name}`)
    }
  }
  const file = ts.createSourceFile('react-dom.production.min.js', source, ts.ScriptTarget.Latest, true, ts.ScriptKind.JS)
  const spots = []
  const visit = (node) => {
    if (ts.isIdentifier(node) && Object.hasOwn(RENAMED, node.text)) {
      const parent = node.parent
      if (ts.isShorthandPropertyAssignment(parent) || ((ts.isPropertyAccessExpression(parent) || ts.isPropertyAssignment(parent)) && parent.name === node)) {
        throw new Error(`React DOM uses ${node.text} as a property name, which renaming would change`)
      }
      spots.push(node)
    }
    ts.forEachChild(node, visit)
  }
  visit(file)
  spots.sort((a, b) => a.getStart(file) - b.getStart(file))
  let renamed = ''
  let from = 0
  for (const node of spots) {
    renamed += source.slice(from, node.getStart(file)) + RENAMED[node.text]
    from = node.getEnd()
  }
  renamed += source.slice(from)
  new vm.Script(renamed)
  return renamed
}
