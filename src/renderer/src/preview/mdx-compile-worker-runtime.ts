import { compile } from '@mdx-js/mdx'
import rehypeHighlight from 'rehype-highlight'
import rehypeKatex from 'rehype-katex'
import remarkFrontmatter from 'remark-frontmatter'
import remarkGfm from 'remark-gfm'
import remarkMath from 'remark-math'

import { remarkCallouts } from '../../../shared/remark-callouts'
import { remarkMarks } from '../../../shared/remark-mark'
import { remarkWikilink } from '../../../shared/remark-wikilink'
import type { MdxCompileWorkerDiagnostic, MdxCompileWorkerResult } from './mdx-compile-protocol'
import { type PreviewWarning, remarkPreviewWarnings } from './preview-metadata'
import {
  rehypePreviewBlockMap,
  rehypePreviewHeadingIdentity,
  rehypePreviewSourceMap
} from './rehype-preview-source-map'
import { rehypeSafeHtml } from './safe-html'

/** Compile and transform MDX as data. Generated code is executed only by the trusted renderer. */
export async function compileMdxFunctionBody(source: string): Promise<MdxCompileWorkerResult> {
  const warnings: PreviewWarning[] = []
  const file = await compile(source, {
    development: false,
    outputFormat: 'function-body',
    remarkPlugins: [
      remarkGfm,
      remarkMath,
      remarkFrontmatter,
      remarkWikilink,
      remarkMarks,
      remarkCallouts,
      [remarkPreviewWarnings, { warnings }]
    ],
    rehypePlugins: [
      [rehypePreviewSourceMap, { source }],
      rehypeSafeHtml,
      rehypePreviewBlockMap,
      rehypePreviewHeadingIdentity,
      rehypeKatex,
      [rehypeHighlight, { plainText: ['mermaid'] }]
    ]
  })

  return {
    code: String(file),
    warnings
  }
}

export function createMdxCompileDiagnostic(error: unknown): MdxCompileWorkerDiagnostic {
  if (!(error instanceof Error)) {
    return { message: String(error) }
  }

  return {
    message: error.message,
    ...readOptionalNumber(error, 'line'),
    ...readOptionalNumber(error, 'column'),
    ...readOptionalString(error, 'source'),
    ...readOptionalString(error, 'ruleId')
  }
}

function readOptionalNumber(
  error: Error,
  key: 'line' | 'column'
): Partial<Record<'line' | 'column', number>> {
  const value = (error as unknown as Record<string, unknown>)[key]
  return typeof value === 'number' ? { [key]: value } : {}
}

function readOptionalString(
  error: Error,
  key: 'source' | 'ruleId'
): Partial<Record<'source' | 'ruleId', string>> {
  const value = (error as unknown as Record<string, unknown>)[key]
  return typeof value === 'string' && value.trim() ? { [key]: value } : {}
}
