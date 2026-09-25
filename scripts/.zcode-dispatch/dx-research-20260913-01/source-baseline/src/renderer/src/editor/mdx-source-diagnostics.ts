import remarkFrontmatter from 'remark-frontmatter'

let parserPromise: Promise<typeof import('@mdx-js/mdx')> | null = null

export interface MdxSourceIssue {
  message: string
  offset: number
}

/** Parse as data only, in the analysis worker. Never emit or evaluate JavaScript. */
export async function diagnoseMdxSource(source: string): Promise<readonly MdxSourceIssue[]> {
  if (!source.trim() || source.length > 2 * 1024 * 1024) return []
  try {
    parserPromise ??= import('@mdx-js/mdx')
    const { createProcessor } = await parserPromise
    createProcessor({ remarkPlugins: [remarkFrontmatter] }).parse(source)
    return []
  } catch (error) {
    const record = typeof error === 'object' && error !== null ? error : null
    const place = record && 'place' in record ? record.place : null
    const offset =
      typeof place === 'object' &&
      place !== null &&
      'offset' in place &&
      typeof place.offset === 'number'
        ? place.offset
        : 0
    const rawMessage = error instanceof Error ? error.message : 'Invalid MDX source'
    return [
      {
        message: rawMessage.replaceAll(/(?:[A-Za-z]:\\|\/)[^\s:)]+/g, '[path]').slice(0, 600),
        offset: Math.min(source.length, Math.max(0, offset))
      }
    ]
  }
}
