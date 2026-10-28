import js from '@eslint/js'
import dotignore from 'eslint-plugin-dotignore'
import globals from 'globals'
import tseslint from 'typescript-eslint'

const sources = ['**/*.{ts,tsx,js,mjs}']

export default tseslint.config(
  {
    ignores: [
      'node_modules',
      '.dev/**',
      'design/**',
      'plugin/**',
      'station/.build/**',
      'artifacts/**',
      'packages/mod/src/core/*.generated.ts',
      'video/src/generated/**',
      'video/out/**',
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
    files: ['packages/renderer/**', 'packages/dev/**', 'video/src/**'],
    languageOptions: { globals: globals.browser },
  },
  {
    files: ['video/scripts/**', 'video/remotion.config.ts'],
    languageOptions: { globals: globals.node },
  },
  {
    files: ['video/scripts/music/**'],
    languageOptions: { globals: globals.browser },
  },
  {
    files: ['packages/mod/src/register.tsx', 'packages/mod/kit/**'],
    languageOptions: { globals: { h: 'readonly', Fragment: 'readonly' } },
  },
  dotignore.configs.recommended,
)
