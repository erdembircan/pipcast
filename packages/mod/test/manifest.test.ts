/// <reference types="node" />
import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'

// The plugin's manifest, the marketplace's entry for it and the root package
// agree: one version, set in the manifest, and the same display fields where
// the entry repeats them, since Claude Code shows the entry's own values
const read = (path: string) => JSON.parse(readFileSync(new URL(path, import.meta.url), 'utf8'))

const manifest = read('../plugin.json')
const marketplace = read('../../../.claude-plugin/marketplace.json')
const root = read('../../../package.json')
const entry = marketplace.plugins.find((plugin: { name: string }) => plugin.name === manifest.name)

const DISPLAY = ['displayName', 'description', 'author', 'homepage', 'repository', 'license', 'keywords'] as const

describe('the plugin manifest and the marketplace entry', () => {
  it('lists the plugin from plugin/', () => {
    expect(entry?.source).toBe('./plugin')
  })

  it('sets the version in the manifest alone', () => {
    expect(manifest.version).toMatch(/^\d+\.\d+\.\d+$/)
    expect(entry).not.toHaveProperty('version')
    expect(root.version).toBe(manifest.version)
  })

  it.each(DISPLAY)('repeats the manifest’s %s', (field) => {
    expect(entry?.[field]).toEqual(manifest[field])
  })
})
