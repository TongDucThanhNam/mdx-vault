import { describe, expect, test } from 'bun:test'
import { compile } from '@mdx-js/mdx'
import {
  decodeBase64Image,
  inferImageMimeType,
  PreviewImageCache,
  resolvePreviewImageSource
} from '../src/renderer/src/preview/preview-image'
import { rehypeSafeHtml } from '../src/renderer/src/preview/safe-html'

describe('preview image paths', () => {
  test('keeps safe image sources through the preview sanitizer', async () => {
    const compiled = String(
      await compile(
        [
          '![Local](../assets/sample.png)',
          '',
          '![Remote](https://example.com/sample.png)',
          '',
          '<img src="data:image/png;base64,AA==" alt="Data" />',
          '',
          '<img src="blob:https://example.com/image-id" alt="Blob" />',
          '',
          '<img src="javascript:alert(1)" alt="Unsafe" />'
        ].join('\n'),
        { rehypePlugins: [rehypeSafeHtml] }
      )
    )

    expect(compiled).toContain('src: "../assets/sample.png"')
    expect(compiled).toContain('src: "https://example.com/sample.png"')
    expect(compiled).toContain('src: "data:image/png;base64,AA=="')
    expect(compiled).toContain('src: "blob:https://example.com/image-id"')
    expect(compiled).not.toContain('javascript:alert')
  })

  test('resolves note-relative paths and decodes path segments', () => {
    expect(resolvePreviewImageSource('notes/Welcome.mdx', '../assets/sample.png')).toEqual({
      kind: 'vault',
      relativePath: 'assets/sample.png'
    })
    expect(
      resolvePreviewImageSource('notes/guides/Images.mdx', '../../assets/my%20image.png')
    ).toEqual({
      kind: 'vault',
      relativePath: 'assets/my image.png'
    })
  })

  test('rejects paths that escape the vault or use unsupported URL schemes', () => {
    expect(resolvePreviewImageSource('notes/Welcome.mdx', '../../outside.png').kind).toBe('error')
    expect(resolvePreviewImageSource('notes/Welcome.mdx', 'file:///tmp/image.png').kind).toBe(
      'error'
    )
  })

  test('passes supported remote and in-memory URLs through untouched', () => {
    for (const src of [
      'https://example.com/image.png',
      'http://example.com/image.png',
      'data:image/png;base64,AA==',
      'blob:https://example.com/image-id'
    ]) {
      expect(resolvePreviewImageSource('notes/Welcome.mdx', src)).toEqual({
        kind: 'passthrough',
        src
      })
    }
  })
})

describe('preview image blobs', () => {
  test('infers common MIME types and decodes base64', async () => {
    expect(inferImageMimeType('assets/sample.PNG')).toBe('image/png')
    expect(inferImageMimeType('assets/photo.jpeg')).toBe('image/jpeg')
    expect(inferImageMimeType('assets/unknown.bin')).toBe('application/octet-stream')

    const blob = decodeBase64Image('AQIDBA==', 'image/png')
    expect(blob.type).toBe('image/png')
    expect([...new Uint8Array(await blob.arrayBuffer())]).toEqual([1, 2, 3, 4])
  })

  test('deduplicates reads and revokes object URLs when disposed', async () => {
    let readCount = 0
    let objectUrlSequence = 0
    const revoked: string[] = []
    const cache = new PreviewImageCache({
      readImageFile: async () => {
        readCount += 1
        return 'AQIDBA=='
      },
      createObjectUrl: () => `blob:test-${++objectUrlSequence}`,
      revokeObjectUrl: (url) => revoked.push(url),
      decodeObjectUrl: async () => undefined
    })

    const [first, second] = await Promise.all([
      cache.load('assets/sample.png'),
      cache.load('assets/sample.png')
    ])

    expect(first).toBe('blob:test-1')
    expect(second).toBe('blob:test-1')
    expect(readCount).toBe(1)

    cache.dispose()
    expect(revoked).toEqual(['blob:test-1'])

    expect(await cache.load('assets/sample.png')).toBe('blob:test-2')
    expect(readCount).toBe(2)
  })

  test('rejects corrupt image bytes before exposing the object URL and allows retry', async () => {
    let readCount = 0
    let objectUrlSequence = 0
    let shouldDecode = false
    const revoked: string[] = []
    const cache = new PreviewImageCache({
      readImageFile: async () => {
        readCount += 1
        return 'AQIDBA=='
      },
      createObjectUrl: () => `blob:test-${++objectUrlSequence}`,
      revokeObjectUrl: (url) => revoked.push(url),
      decodeObjectUrl: async () => {
        if (!shouldDecode) {
          throw new Error('browser decode failed')
        }
      }
    })

    await expect(cache.load('images/sample.png')).rejects.toThrow('Image data could not be decoded')
    expect(revoked).toEqual(['blob:test-1'])

    shouldDecode = true
    expect(await cache.load('images/sample.png')).toBe('blob:test-2')
    expect(readCount).toBe(2)

    cache.dispose()
    expect(revoked).toEqual(['blob:test-1', 'blob:test-2'])
  })
})
