import { describe, expect, test } from 'bun:test'

import { resolveWikilinkPreviewPosition } from '../src/renderer/src/preview/wikilink-preview-position'

describe('Wikilink hover preview position', () => {
  test('centers above a link when there is enough room', () => {
    expect(
      resolveWikilinkPreviewPosition(
        {
          top: 700,
          right: 600,
          bottom: 720,
          left: 500,
          width: 100,
          height: 20
        },
        { width: 1000, height: 900 }
      )
    ).toEqual({
      left: 340,
      top: 208,
      width: 420
    })
  })

  test('places below a link near the top edge', () => {
    expect(
      resolveWikilinkPreviewPosition(
        {
          top: 20,
          right: 140,
          bottom: 40,
          left: 40,
          width: 100,
          height: 20
        },
        { width: 1000, height: 800 }
      )
    ).toEqual({
      left: 12,
      top: 52,
      width: 420
    })
  })

  test('clamps the preview inside narrow and right viewport edges', () => {
    const rightEdge = resolveWikilinkPreviewPosition(
      {
        top: 20,
        right: 1000,
        bottom: 40,
        left: 980,
        width: 20,
        height: 20
      },
      { width: 1000, height: 800 }
    )
    const narrowViewport = resolveWikilinkPreviewPosition(
      {
        top: 20,
        right: 280,
        bottom: 40,
        left: 260,
        width: 20,
        height: 20
      },
      { width: 300, height: 800 }
    )

    expect(rightEdge.left).toBe(568)
    expect(rightEdge.width).toBe(420)
    expect(narrowViewport.left).toBe(12)
    expect(narrowViewport.width).toBe(276)
  })
})
