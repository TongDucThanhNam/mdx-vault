import { describe, expect, test } from 'bun:test'
import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'

import { ComponentDefinitionPopover } from '../src/renderer/src/editor/ComponentDefinitionPopover'
import { resolveGotoTarget } from '../src/renderer/src/editor/goto-definition'
import { componentRegistry } from '../src/renderer/src/preview/registry'
import { resolveVaultNavigationTarget } from '../src/renderer/src/vault/goto-definition-path'

describe('GOAL-18 go-to-definition target resolution', () => {
  test('resolves wikilinks from the middle and both token boundaries', () => {
    const doc = 'Before [[Bayes Theorem|Bayes]] after'
    const from = doc.indexOf('[[')
    const to = doc.indexOf(']]') + 2
    const expected = {
      type: 'wikilink',
      value: 'Bayes Theorem',
      from,
      to
    } as const

    expect(resolveGotoTarget(doc, from)).toEqual(expected)
    expect(resolveGotoTarget(doc, from + 8)).toEqual(expected)
    expect(resolveGotoTarget(doc, to)).toEqual(expected)
  })

  test('resolves Interactive and SandboxedHTML src attribute values', () => {
    const interactive = '<Interactive src="../interactives/react-counter" />'
    const interactiveFrom = interactive.indexOf('../interactives')
    const interactiveTo = interactiveFrom + '../interactives/react-counter'.length

    expect(resolveGotoTarget(interactive, interactiveFrom + 5)).toEqual({
      type: 'path',
      value: '../interactives/react-counter',
      from: interactiveFrom,
      to: interactiveTo
    })

    const sandbox = '<SandboxedHTML title="Demo" src=\'../interactives/example/index.html\' />'
    const sandboxFrom = sandbox.indexOf('../interactives')

    expect(resolveGotoTarget(sandbox, sandboxFrom)).toEqual({
      type: 'path',
      value: '../interactives/example/index.html',
      from: sandboxFrom,
      to: sandboxFrom + '../interactives/example/index.html'.length
    })
  })

  test('resolves Markdown link and image destinations', () => {
    const doc = '[component](../interactives/widget/component.tsx) ![chart](../assets/chart.png)'
    const componentFrom = doc.indexOf('../interactives')
    const imageFrom = doc.indexOf('../assets')

    expect(resolveGotoTarget(doc, componentFrom + 10)).toEqual({
      type: 'path',
      value: '../interactives/widget/component.tsx',
      from: componentFrom,
      to: componentFrom + '../interactives/widget/component.tsx'.length
    })
    expect(resolveGotoTarget(doc, imageFrom + 5)).toEqual({
      type: 'path',
      value: '../assets/chart.png',
      from: imageFrom,
      to: imageFrom + '../assets/chart.png'.length
    })
  })

  test('resolves PascalCase opening and closing component tag names', () => {
    const doc = '<QuizBlock question="Why?" />\n<KhongTonTai />\n</WidgetFrame>'

    for (const name of ['QuizBlock', 'KhongTonTai', 'WidgetFrame']) {
      const from = doc.indexOf(name)

      expect(resolveGotoTarget(doc, from + 1)).toEqual({
        type: 'component',
        value: name,
        from,
        to: from + name.length
      })
    }
  })

  test('returns null outside a supported target', () => {
    const doc = 'Plain text [label](../assets/chart.png) <div src="local.txt">lowercase</div>'

    expect(resolveGotoTarget(doc, doc.indexOf('Plain'))).toBeNull()
    expect(resolveGotoTarget(doc, doc.indexOf('label'))).toBeNull()
    expect(resolveGotoTarget(doc, doc.indexOf('local.txt') + 2)).toBeNull()
    expect(resolveGotoTarget(doc, doc.length)).toBeNull()
  })

  test('renders registry details and the unknown-component warning', () => {
    const quizBlock = componentRegistry.find((entry) => entry.name === 'QuizBlock')
    if (!quizBlock) {
      throw new Error('QuizBlock registry fixture is missing')
    }

    const registered = renderToStaticMarkup(
      createElement(ComponentDefinitionPopover, {
        componentName: 'QuizBlock',
        position: { left: 0, top: 0 },
        onClose: () => undefined
      })
    )
    const missing = renderToStaticMarkup(
      createElement(ComponentDefinitionPopover, {
        componentName: 'KhongTonTai',
        position: { left: 0, top: 0 },
        onClose: () => undefined
      })
    )

    expect(registered).toContain(quizBlock.description)
    expect(registered).toContain('question')
    expect(registered).toContain('answerIndex')
    expect(registered).toContain('optional')
    expect(missing).toContain('Not in registry')
  })

  test('opens exact vault files and Interactive component folders only when they exist', () => {
    const files = [
      { relativePath: 'assets/chart.png' },
      { relativePath: 'interactives/react-counter/component.tsx' }
    ]

    expect(resolveVaultNavigationTarget(files, 'assets/chart.png')).toBe('assets/chart.png')
    expect(resolveVaultNavigationTarget(files, 'interactives/react-counter')).toBe(
      'interactives/react-counter/component.tsx'
    )
    expect(resolveVaultNavigationTarget(files, 'interactives/missing')).toBeNull()
  })
})
