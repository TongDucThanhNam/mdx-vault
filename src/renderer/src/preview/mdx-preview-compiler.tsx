import { run } from '@mdx-js/mdx'
import type { MDXContent } from 'mdx/types'
import { Fragment, jsx, jsxs } from 'react/jsx-runtime'
import { MdxCompileCache } from './mdx-compile-cache'
import { MdxCompileWorkerClient } from './mdx-compile-worker-client'
import type { PreviewWarning } from './preview-metadata'

export interface CompiledMdxPreview {
  Content: MDXContent
  warnings: PreviewWarning[]
}

const compileCache = new MdxCompileCache<CompiledMdxPreview>({
  maxEntries: 12,
  maxSourceLength: 512 * 1024
})
const compilerWorker = new MdxCompileWorkerClient()

if (import.meta.hot) {
  import.meta.hot.dispose(() => compilerWorker.terminate())
}

export function compileMdxPreview(source: string): Promise<CompiledMdxPreview> {
  return compileCache.getOrCompile(source, compileMdxPreviewUncached)
}

async function compileMdxPreviewUncached(source: string): Promise<CompiledMdxPreview> {
  if (!source.trim()) {
    return {
      Content: emptyMdxContent,
      warnings: []
    }
  }

  const compiled = await compilerWorker.compile(source)

  // The existing trust boundary is unchanged: generated code runs only for
  // content from a user-opened vault. Custom code still belongs in the
  // registry or sandboxed interactives described by docs/security.md.
  const mdxModule = await run(compiled.code, {
    Fragment,
    jsx,
    jsxs,
    baseUrl: import.meta.url
  })

  return {
    Content: mdxModule.default,
    warnings: compiled.warnings
  }
}

function emptyMdxContent(): React.JSX.Element {
  return <div className="text-sm text-muted-foreground">Empty note.</div>
}
