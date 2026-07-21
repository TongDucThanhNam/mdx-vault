import { describe, expect, test } from 'bun:test'

import {
  isEditableTextPath,
  isNotePath,
  isPreviewableVaultImagePath
} from '../src/renderer/src/vault/file-kind'

describe('GOAL-16 renderer file kinds', () => {
  test('routes the main text whitelist to the editable text view', () => {
    for (const path of [
      'assets/datasets/sample.csv',
      'interactives/counter/component.tsx',
      'interactives/counter/manifest.json',
      'scripts/build.mjs',
      'styles/theme.css',
      'config/settings.toml'
    ]) {
      expect(isEditableTextPath(path)).toBe(true)
    }

    expect(isEditableTextPath('notes/Welcome.mdx')).toBe(false)
    expect(isEditableTextPath('downloads/archive.bin')).toBe(false)
    expect(isNotePath('notes/Welcome.mdx')).toBe(true)
  })

  test('recognizes supported images anywhere in the vault', () => {
    expect(isPreviewableVaultImagePath('notes/pic.png')).toBe(true)
    expect(isPreviewableVaultImagePath('covers/HERO.JPEG')).toBe(true)
    expect(isPreviewableVaultImagePath('assets/pic.png')).toBe(true)
    expect(isPreviewableVaultImagePath('notes/pic.bmp')).toBe(false)
  })
})
