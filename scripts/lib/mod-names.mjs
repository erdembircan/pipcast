// What Anthropic's plugin directory reads a mod's hooks module for, as far as
// it can be read here, in the codes its developer portal gives:
// MOD_CAPABILITY_USE_NOT_PLAIN: every `on` in the file is taken for the function
// that registers hooks, so `on` is used for nothing else.
// MOD_PERMISSION_ANSWER_UNREAD: to see that a hook passes a permission request
// on, the names hooks give their event and `next` are bound nowhere else in the
// file, a `.catch` handler's parameters included.
import { createRequire } from 'node:module'

const ts = createRequire(import.meta.url)('typescript')

export function modNameFindings(source, path = 'plugin/hooks/register.js') {
  const file = ts.createSourceFile(path, source, ts.ScriptTarget.Latest, true, ts.ScriptKind.JS)
  const lineOf = (node) => file.getLineAndCharacterOfPosition(node.getStart(file)).line + 1
  const findings = []

  const register = file.statements.find((statement) => ts.isFunctionDeclaration(statement) && statement.name?.text === 'register')
  const onParameter = register?.parameters[0]
  if (onParameter === undefined || !ts.isIdentifier(onParameter.name)) {
    return [`${path} declares no register(on, options) function, so there is no hook for the directory to read.`]
  }
  const onName = onParameter.name.text

  // on('event', …) as a statement of its own or as what is returned, .catch(…) chained or not
  const isRegistration = (node) => {
    if (!ts.isCallExpression(node) || !ts.isIdentifier(node.expression) || node.expression.text !== onName) {
      return false
    }
    if (node.arguments.length < 2 || !ts.isStringLiteralLike(node.arguments[0])) {
      return false
    }
    let whole = node
    if (ts.isPropertyAccessExpression(node.parent) && node.parent.name.text === 'catch' && ts.isCallExpression(node.parent.parent)) {
      whole = node.parent.parent
    }
    return ts.isExpressionStatement(whole.parent) || ts.isReturnStatement(whole.parent)
  }

  const hooks = new Set()
  const findHooks = (node) => {
    if (isRegistration(node)) {
      const hook = node.arguments[node.arguments.length - 1]
      if (ts.isArrowFunction(hook) || ts.isFunctionExpression(hook)) {
        hooks.add(hook)
      }
    }
    ts.forEachChild(node, findHooks)
  }
  findHooks(file)

  const hookNames = new Set()
  for (const hook of hooks) {
    for (const parameter of hook.parameters.slice(1, 3)) {
      if (ts.isIdentifier(parameter.name)) {
        hookNames.add(parameter.name.text)
      }
    }
  }

  const isPropertyName = (id) => {
    const parent = id.parent
    return (
      ((ts.isPropertyAccessExpression(parent) || ts.isPropertyAssignment(parent) || ts.isMethodDeclaration(parent) || ts.isPropertyDeclaration(parent) || ts.isGetAccessorDeclaration(parent) || ts.isSetAccessorDeclaration(parent)) && parent.name === id) ||
      (ts.isBindingElement(parent) && parent.propertyName === id)
    )
  }

  const isBinding = (id) => {
    const parent = id.parent
    return (
      ((ts.isParameter(parent) || ts.isVariableDeclaration(parent) || ts.isBindingElement(parent) || ts.isFunctionDeclaration(parent) || ts.isFunctionExpression(parent) || ts.isClassDeclaration(parent) || ts.isImportSpecifier(parent) || ts.isImportClause(parent) || ts.isNamespaceImport(parent)) && parent.name === id)
    )
  }

  const check = (node) => {
    if (ts.isIdentifier(node) && !isPropertyName(node)) {
      if (node.text === onName && node.parent !== onParameter && !(ts.isCallExpression(node.parent) && node.parent.expression === node && isRegistration(node.parent))) {
        findings.push(`${path}:${lineOf(node)} uses ${onName} for something other than registering a hook. Anthropic's plugin directory reads every ${onName} in the file as the function that registers hooks, and refuses the plugin (MOD_CAPABILITY_USE_NOT_PLAIN): give this one another name.`)
      }
      if (hookNames.has(node.text) && isBinding(node) && !(ts.isParameter(node.parent) && hooks.has(node.parent.parent))) {
        findings.push(`${path}:${lineOf(node)} binds ${node.text}, a name the hooks give their event or next. Anthropic's plugin directory then can't see that a hook passes a permission request on, and refuses the plugin (MOD_PERMISSION_ANSWER_UNREAD): give this one another name.`)
      }
    }
    ts.forEachChild(node, check)
  }
  check(file)
  return findings
}
