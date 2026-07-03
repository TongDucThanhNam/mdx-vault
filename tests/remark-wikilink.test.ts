import { describe, expect, test } from 'bun:test'

import { parseWikilinkText } from '../src/shared/remark-wikilink'
import { parseWikilinkUrl } from '../src/shared/wikilinks'

describe('parseWikilinkText', () => {
  test('turns a basic wikilink into a marked link node', () => {
    const nodes = parseWikilinkText('See [[Bayes Theorem]].')

    expect(nodes).not.toBeNull()
    expect(nodes?.map((node) => node.type)).toEqual(['text', 'link', 'text'])

    const link = nodes?.[1]

    expect(link?.type).toBe('link')

    if (link?.type !== 'link') {
      throw new Error('Expected link node')
    }

    expect(parseWikilinkUrl(link.url)).toBe('Bayes Theorem')
    expect(link.children).toEqual([{ type: 'text', value: 'Bayes Theorem' }])
    expect(link.data?.wikilink).toBe(true)
    expect(link.data?.target).toBe('Bayes Theorem')
  })

  test('uses display text when a pipe is present', () => {
    const nodes = parseWikilinkText('See [[Bayes Theorem|Bayes]].')
    const link = nodes?.[1]

    if (link?.type !== 'link') {
      throw new Error('Expected link node')
    }

    expect(parseWikilinkUrl(link.url)).toBe('Bayes Theorem')
    expect(link.children).toEqual([{ type: 'text', value: 'Bayes' }])
    expect(link.data?.display).toBe('Bayes')
  })

  test('returns null for text without wikilinks', () => {
    expect(parseWikilinkText('No links here.')).toBeNull()
  })
})
