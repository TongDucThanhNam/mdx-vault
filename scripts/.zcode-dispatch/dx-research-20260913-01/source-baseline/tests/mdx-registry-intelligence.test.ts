import { describe, expect, test } from 'bun:test'
import {
  getMdxRegistryCompletions,
  getMdxRegistryHover,
  type MdxRegistryComponentMetadata
} from '../src/renderer/src/editor/mdx-registry-intelligence'

const components: MdxRegistryComponentMetadata[] = [
  {
    name: 'QuizBlock',
    description: 'A guided multiple-choice check.',
    category: 'content',
    props: [
      { name: 'question', description: 'The prompt shown to the reader.' },
      { name: 'answers', description: 'Candidate answers.' },
      { name: 'correctIndex', description: 'Zero-based correct answer.' }
    ]
  },
  {
    name: 'Counter',
    description: 'A small stateful counter.',
    category: 'demo',
    props: [{ name: 'initial', description: null }]
  }
]

describe('GOAL-27 MDX registry intelligence', () => {
  test('completes trusted registry components after an opening angle bracket', () => {
    const source = '# Check\n\n<Qui'
    expect(getMdxRegistryCompletions(source, source.length, components)).toEqual([
      {
        kind: 'component',
        from: source.indexOf('Qui'),
        to: source.length,
        label: 'QuizBlock',
        detail: 'content',
        description: 'A guided multiple-choice check.'
      }
    ])
  })

  test('completes only unused props and stays out of attribute values', () => {
    const source = '<QuizBlock question="Ready?" ans'
    expect(
      getMdxRegistryCompletions(source, source.length, components).map((item) => item.label)
    ).toEqual(['answers'])

    const quoted = '<QuizBlock question="ans'
    expect(getMdxRegistryCompletions(quoted, quoted.length, components)).toEqual([])
    const expression = '<QuizBlock answers={ans'
    expect(getMdxRegistryCompletions(expression, expression.length, components)).toEqual([])
  })

  test('returns component and prop hover metadata only inside a known opening tag', () => {
    const source = '<QuizBlock question="Ready?" />'
    expect(getMdxRegistryHover(source, source.indexOf('QuizBlock') + 2, components)).toMatchObject({
      title: '<QuizBlock>',
      detail: 'content'
    })
    expect(getMdxRegistryHover(source, source.indexOf('question') + 2, components)).toMatchObject({
      title: 'question',
      description: 'The prompt shown to the reader.'
    })
    expect(getMdxRegistryHover('Plain QuizBlock prose', 8, components)).toBeNull()
  })
})
