import { describe, expect, test } from 'bun:test'
import {
  resolveFileTreeClickPath,
  shouldActivateTreeSelection
} from '../src/renderer/src/explorer/file-tree-activation'

describe('file tree activation', () => {
  test('resolves a file row from a click composed through the tree shadow root', () => {
    const files = new Set(['notes/Welcome.mdx', '.agents/skills/example/scripts/audit.py'])
    const nestedLabel = { dataset: {} }
    const fileRow = {
      dataset: { itemPath: '.agents/skills/example/scripts/audit.py' }
    }

    expect(resolveFileTreeClickPath([nestedLabel, fileRow, {}], files)).toBe(
      '.agents/skills/example/scripts/audit.py'
    )
    expect(
      resolveFileTreeClickPath(
        [{ dataset: { itemPath: '.agents/skills/example/scripts/' } }],
        files
      )
    ).toBeNull()
  })

  test('click activation owns the matching selection event but keyboard selection still opens', () => {
    const auditPath = '.agents/skills/example/scripts/audit.py'

    expect(shouldActivateTreeSelection(auditPath, null, auditPath)).toBe(false)
    expect(shouldActivateTreeSelection(auditPath, null, null)).toBe(true)
    expect(shouldActivateTreeSelection(auditPath, auditPath, null)).toBe(false)
    expect(shouldActivateTreeSelection(null, null, null)).toBe(false)
  })
})
