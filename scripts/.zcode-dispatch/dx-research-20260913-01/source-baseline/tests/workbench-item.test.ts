import { describe, expect, test } from 'bun:test'
import { createWorkbenchItemForPath } from '../src/renderer/src/workbench/workbench-item'

describe('workbench item defaults', () => {
  test('seeds each new note tab with the configured default view', () => {
    expect(createWorkbenchItemForPath('notes/Reading.mdx', 'reading').viewState?.viewMode).toBe(
      'reading'
    )
    expect(createWorkbenchItemForPath('notes/Source.md', 'source').viewState?.viewMode).toBe(
      'source'
    )
    expect(createWorkbenchItemForPath('notes/Live.mdx', 'live').viewState?.viewMode).toBe('live')
  })

  test('does not attach a note view mode to text, image, or unsupported tabs', () => {
    expect(createWorkbenchItemForPath('data/sample.json', 'reading').viewState).toBeUndefined()
    expect(createWorkbenchItemForPath('assets/diagram.png', 'reading').viewState).toBeUndefined()
    expect(createWorkbenchItemForPath('archive/sample.zip', 'reading').viewState).toBeUndefined()
  })
})
