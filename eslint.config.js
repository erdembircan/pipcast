import js from '@eslint/js'
import dotignore from 'eslint-plugin-dotignore'
import globals from 'globals'
import tseslint from 'typescript-eslint'

const sources = ['**/*.{ts,tsx,js,mjs}']

export default tseslint.config(
  {
    ignores: [
      'node_modules',
      'design/**',
      'plugin/station/**',
      'plugin/.claude-plugin/types/**',
      'station/.build/**',
      'artifacts/**',
      'plugin/src/core/*.generated.ts',
    ],
  },
  {
    files: sources,
    extends: [js.configs.recommended, ...tseslint.configs.recommended],
  },
  {
    files: ['scripts/**'],
    languageOptions: { globals: globals.node },
  },
  {
    files: ['packages/renderer/**'],
    languageOptions: { globals: globals.browser },
  },
  {
    files: ['plugin/hooks/**', 'plugin/tests/**'],
    languageOptions: { globals: { h: 'readonly', Fragment: 'readonly' } },
  },
  dotignore.configs.recommended,
)
