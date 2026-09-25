import { describe, expect, test } from 'bun:test'
import { isVisibleVaultPath } from '../src/shared/vault-path-visibility'

describe('vault path visibility', () => {
  test('hides files and folders whose path contains a dot-prefixed segment', () => {
    expect(isVisibleVaultPath('.env')).toBe(false)
    expect(isVisibleVaultPath('.agents/skills/interactive-mdx/SKILL.md')).toBe(false)
    expect(isVisibleVaultPath('.claude\\skills\\interactive-mdx\\SKILL.md')).toBe(false)
    expect(isVisibleVaultPath('notes/.drafts/Secret.mdx')).toBe(false)
  })

  test('keeps ordinary files whose names contain non-leading dots', () => {
    expect(isVisibleVaultPath('notes/Version 1.2.mdx')).toBe(true)
    expect(isVisibleVaultPath('assets/avatar.profile.png')).toBe(true)
  })
})
