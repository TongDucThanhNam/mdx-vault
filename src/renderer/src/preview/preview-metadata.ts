import matter from 'gray-matter'
import type { Root } from 'mdast'
import type { MdxjsEsm } from 'mdast-util-mdxjs-esm'
import remarkFrontmatter from 'remark-frontmatter'
import remarkGfm from 'remark-gfm'
import remarkMdx from 'remark-mdx'
import remarkParse from 'remark-parse'
import { unified } from 'unified'
import { visit } from 'unist-util-visit'

export interface PreviewWarning {
  message: string
  line?: number
}

export interface PreviewMetadata {
  frontmatter: Record<string, unknown>
  warnings: PreviewWarning[]
}

const diagnosticProcessor = unified()
  .use(remarkParse)
  .use(remarkMdx)
  .use(remarkGfm)
  .use(remarkFrontmatter, ['yaml'])

export function readPreviewMetadata(source: string): PreviewMetadata {
  return {
    frontmatter: readFrontmatter(source),
    warnings: readWarnings(source)
  }
}

function readFrontmatter(source: string): Record<string, unknown> {
  try {
    return matter(source).data
  } catch {
    return {}
  }
}

function readWarnings(source: string): PreviewWarning[] {
  const warnings: PreviewWarning[] = []

  try {
    const tree = diagnosticProcessor.runSync(diagnosticProcessor.parse(source)) as Root

    visit(tree, 'mdxjsEsm', (node: MdxjsEsm) => {
      if (!isImportStatement(node.value)) {
        return
      }

      warnings.push({
        message:
          'Import statements in notes are discouraged. Use the registry or interactives/ instead.',
        line: node.position?.start.line
      })
    })
  } catch {
    return warnings
  }

  return warnings
}

function isImportStatement(value: string): boolean {
  return value.split('\n').some((line) => line.trimStart().startsWith('import '))
}
