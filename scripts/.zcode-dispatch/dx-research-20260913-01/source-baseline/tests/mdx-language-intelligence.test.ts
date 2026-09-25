import { describe, expect, test } from 'bun:test'
import { diagnoseMdxSource } from '../src/renderer/src/editor/mdx-language-intelligence'

describe('MDX Source diagnostics', () => {
  test('accepts prose, JSX components, and JavaScript expressions without evaluating them', async () => {
    expect(
      await diagnoseMdxSource(
        '---\nmetadata: "{kept as data}"\n---\n\n# Cache\n\n<Widget value={items.map((item) => item.id)} />'
      )
    ).toEqual([])
  })

  test('reports the real MDX parser offset for a malformed expression', async () => {
    const issues = await diagnoseMdxSource('<Widget value={items.map((item) => item.id) />')
    expect(issues).toHaveLength(1)
    expect(issues[0]?.offset).toBeGreaterThan(0)
    expect(issues[0]?.message).toContain('closing brace')
  })

  test('parses ESM and expressions without resolving imports or running their side effects', async () => {
    expect(
      await diagnoseMdxSource(
        'import Widget from "./missing-vault-module.js"\n\n{(() => { throw new Error("never execute") })()}\n\n<Widget />'
      )
    ).toEqual([])
  })
})
