import { describe, expect, test } from 'bun:test'
import {
  normalizeCreateNoteDirectory,
  validateCreateNotePath
} from '../src/renderer/src/explorer/create-note-path'

describe('create note path', () => {
  test('creates notes at the vault root by default', () => {
    expect(validateCreateNotePath('Project plan', null)).toEqual({
      ok: true,
      baseTitle: 'Project plan',
      relativePath: 'Project plan.mdx'
    })
  })

  test('creates notes inside the selected folder', () => {
    expect(validateCreateNotePath('Project plan.mdx', 'notes/projects/')).toEqual({
      ok: true,
      baseTitle: 'Project plan',
      relativePath: 'notes/projects/Project plan.mdx'
    })
    expect(normalizeCreateNoteDirectory('notes\\projects\\')).toBe('notes/projects')
  })

  test('keeps path structure out of the note title field', () => {
    expect(validateCreateNotePath('../Project plan', 'notes/')).toEqual({
      ok: false,
      error: 'Enter a title without folder separators.'
    })
  })

  test('rejects an invalid selected folder path', () => {
    expect(validateCreateNotePath('Project plan', 'notes/../archive')).toEqual({
      ok: false,
      error: 'The selected folder path is invalid.'
    })
  })
})
