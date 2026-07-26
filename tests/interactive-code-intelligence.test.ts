import { describe, expect, test } from 'bun:test'
import {
  mapInteractiveDiagnosticsForEditor,
  planCompletionChanges
} from '../src/renderer/src/interactive/interactive-code-intelligence'

describe('GOAL-25 CodeMirror intelligence adapters', () => {
  test('maps only current-file ranges and clamps stale offsets to the document', () => {
    const diagnostics = mapInteractiveDiagnosticsForEditor(
      [
        {
          source: 'typescript',
          severity: 'error',
          code: 'TS2322',
          message: 'Type mismatch',
          relativePath: 'interactives/demo/component.tsx',
          from: 4,
          to: 99,
          line: 1,
          column: 5
        },
        {
          source: 'typescript',
          severity: 'error',
          code: 'TS2345',
          message: 'Other file',
          relativePath: 'interactives/demo/helper.ts',
          from: 0,
          to: 1,
          line: 1,
          column: 1
        }
      ],
      'interactives/demo/component.tsx',
      12
    )

    expect(diagnostics).toEqual([
      {
        from: 4,
        to: 12,
        severity: 'error',
        message: 'TS2322 · Type mismatch'
      }
    ])
  })

  test('applies a safe auto-import and completion as one sorted transaction', () => {
    expect(
      planCompletionChanges({
        from: 52,
        to: 58,
        insert: 'useState',
        additionalEdits: [
          {
            from: 0,
            to: 0,
            insert: "import { useState } from 'react'\n"
          }
        ]
      })
    ).toEqual([
      { from: 0, to: 0, insert: "import { useState } from 'react'\n" },
      { from: 52, to: 58, insert: 'useState' }
    ])
  })

  test('rejects overlapping completion edits instead of corrupting the buffer', () => {
    expect(
      planCompletionChanges({
        from: 10,
        to: 18,
        insert: 'useState',
        additionalEdits: [{ from: 12, to: 14, insert: '' }]
      })
    ).toBeNull()
  })
})
