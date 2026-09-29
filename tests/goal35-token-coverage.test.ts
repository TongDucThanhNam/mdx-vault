import { describe, expect, test } from 'bun:test'
import { readdirSync, readFileSync } from 'node:fs'
import { join } from 'node:path'

describe('trusted island color tokens', () => {
  test('registry island components contain no hardcoded hex palette', () => {
    for (const root of ['src/renderer/src/preview/islands', 'src/renderer/src/preview/registry']) {
      for (const entry of readdirSync(root, { recursive: true })) {
        if (!entry.endsWith('.tsx')) continue
        expect(readFileSync(join(root, entry), 'utf8')).not.toMatch(/#[0-9a-f]{3,8}\b/i)
      }
    }
  })
})
