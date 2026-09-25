import matter from 'gray-matter'
import type { Root } from 'mdast'
import type { MdxjsEsm } from 'mdast-util-mdxjs-esm'
import { visit } from 'unist-util-visit'

export interface PreviewWarning {
  message: string
  line?: number
}

interface PreviewWarningCollectorOptions {
  warnings: PreviewWarning[]
}

export function readPreviewFrontmatter(source: string): Record<string, unknown> {
  try {
    return matter(source).data
  } catch {
    return {}
  }
}

export function isInteractiveNoteTheme(frontmatter: Record<string, unknown>): boolean {
  return frontmatter.theme === 'interactive-note'
}

export function remarkPreviewWarnings({ warnings }: PreviewWarningCollectorOptions) {
  return function collectPreviewWarnings(tree: Root): void {
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
  }
}

function isImportStatement(value: string): boolean {
  return value.split('\n').some((line) => line.trimStart().startsWith('import '))
}
