import { describe, expect, test } from 'bun:test'
import { readdirSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { createFileLabelCache, displayFileName } from '../src/renderer/src/explorer/file-label'
import { FILE_TREE_ICONS } from '../src/renderer/src/explorer/file-tree-icons'
import { selectVisibleGraphLabels } from '../src/renderer/src/graph/graph-label-culling'
import { focusAfterViewModeSwitch } from '../src/renderer/src/workbench/document-focus'

describe('GOAL-33 navigation and accessibility', () => {
  test('keeps the shadow-DOM icon sprite out of the file-tree layout', () => {
    expect(FILE_TREE_ICONS.spriteSheet).toMatch(/^<svg[^>]*\bwidth="0"[^>]*\bheight="0"/)
    expect(FILE_TREE_ICONS.spriteSheet).toContain('aria-hidden="true"')
  })

  test('hides note extensions, except ambiguous visible siblings', () => {
    const files = [
      'notes/Alpha.mdx',
      'notes/Beta.md',
      'notes/Beta.mdx',
      'other/Beta.md',
      'data.json'
    ]
    expect(displayFileName('notes/Alpha.mdx', false, files)).toBe('Alpha')
    expect(displayFileName('notes/Alpha.mdx', true, files)).toBe('Alpha.mdx')
    expect(displayFileName('notes/Beta.md', false, files)).toBe('Beta.md')
    expect(displayFileName('notes/Beta.mdx', false, files)).toBe('Beta.mdx')
    expect(displayFileName('other/Beta.md', false, files)).toBe('Beta')
    expect(displayFileName('data.json', false, files)).toBe('data.json')
  })

  test('caches tree labels until the visible path set changes', () => {
    const paths = ['notes/Alpha.mdx']
    const label = createFileLabelCache(paths, false)
    expect(label('notes/Alpha.mdx')).toBe('Alpha')
    paths.push('notes/Alpha.md')
    expect(label('notes/Alpha.mdx')).toBe('Alpha')
    const updated = createFileLabelCache(paths, false)
    expect(updated('notes/Alpha.mdx')).toBe('Alpha.mdx')
    expect(updated('notes/Alpha.md')).toBe('Alpha.md')
  })

  test('restores focus only after a committed mode change', () => {
    let calls = 0
    const focus = (): void => {
      calls += 1
    }
    focusAfterViewModeSwitch(null, 'live', focus)
    focusAfterViewModeSwitch('live', 'live', focus)
    focusAfterViewModeSwitch('live', 'reading', focus)
    focusAfterViewModeSwitch('reading', 'source', focus)
    expect(calls).toBe(2)
  })

  test('culls overlapping graph labels by priority and reveals more on zoom', () => {
    const nodes = [
      { id: 'a', title: 'Alpha', x: 100, y: 100, radius: 12, degree: 9 },
      { id: 'b', title: 'Beta', x: 102, y: 102, radius: 12, degree: 1 },
      { id: 'c', title: 'Gamma', x: 300, y: 100, radius: 12, degree: 0 },
      { id: 'd', title: 'Delta', x: 500, y: 100, radius: 12, degree: 0 },
      { id: 'e', title: 'Epsilon', x: 700, y: 100, radius: 12, degree: 0 }
    ]
    const baseline = selectVisibleGraphLabels(nodes, {
      zoom: 1,
      hoveredId: 'b',
      selectedId: null,
      neighborIds: new Set()
    })
    expect(baseline.has('b')).toBe(true)
    expect(baseline.has('a')).toBe(false)
    const zoomed = selectVisibleGraphLabels(nodes, {
      zoom: 1.5,
      hoveredId: null,
      selectedId: null,
      neighborIds: new Set()
    })
    expect(zoomed.size).toBeGreaterThanOrEqual(baseline.size)
  })

  test('has no renderer text below 12px', () => {
    const failures: string[] = []
    function scan(directory: string): void {
      for (const entry of readdirSync(directory, { withFileTypes: true })) {
        const path = join(directory, entry.name)
        if (entry.isDirectory()) {
          scan(path)
          continue
        }
        if (!/\.(tsx?|css)$/.test(entry.name)) continue
        const content = readFileSync(path, 'utf8')
        for (const match of content.matchAll(
          /text-\[([\d.]+)(px|rem)\]|font-size:\s*([\d.]+)(px|rem)/g
        )) {
          const value = Number(match[1] ?? match[3]) * ((match[2] ?? match[4]) === 'rem' ? 16 : 1)
          if (value < 12) failures.push(`${path}: ${match[0]}`)
        }
      }
    }
    scan('src/renderer/src')
    expect(failures).toEqual([])
  })
})
