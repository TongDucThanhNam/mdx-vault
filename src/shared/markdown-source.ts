import type { Root } from 'mdast'
import remarkFrontmatterImport from 'remark-frontmatter'
import remarkGfmImport from 'remark-gfm'
import remarkMdxImport from 'remark-mdx'
import remarkParseImport from 'remark-parse'
import { type Pluggable, unified } from 'unified'

import { remarkWikilink } from './remark-wikilink'

const remarkParse = resolvePluginDefault(remarkParseImport)
const remarkMdx = resolvePluginDefault(remarkMdxImport)
const remarkGfm = resolvePluginDefault(remarkGfmImport)
const remarkFrontmatter = resolvePluginDefault(remarkFrontmatterImport)

const markdownProcessor = unified()
  .use(remarkParse)
  .use(remarkMdx)
  .use(remarkGfm)
  .use(remarkFrontmatter, ['yaml'])
  .use(remarkWikilink)

const markdownFallbackProcessor = unified()
  .use(remarkParse)
  .use(remarkGfm)
  .use(remarkFrontmatter, ['yaml'])
  .use(remarkWikilink)

export function parseSourceAst(source: string): Root {
  try {
    return markdownProcessor.runSync(markdownProcessor.parse(source)) as Root
  } catch {
    return markdownFallbackProcessor.runSync(markdownFallbackProcessor.parse(source)) as Root
  }
}

function resolvePluginDefault<TPlugin extends Pluggable>(plugin: TPlugin): TPlugin {
  if (typeof plugin === 'function') {
    return plugin
  }

  const maybeModule = plugin as { default?: unknown }

  return typeof maybeModule.default === 'function' ? (maybeModule.default as TPlugin) : plugin
}
