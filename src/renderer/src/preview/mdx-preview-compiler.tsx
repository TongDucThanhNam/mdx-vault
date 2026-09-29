import { run } from '@mdx-js/mdx'
import type { MDXContent } from 'mdx/types'
import { Fragment, jsx, jsxs } from 'react/jsx-runtime'
import { MdxCompileCache } from './mdx-compile-cache'
import type { MdxCompileWorkerResult } from './mdx-compile-protocol'
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
const workerCodeCache = new MdxCompileCache<MdxCompileWorkerResult>({
  maxEntries: 12,
  maxSourceLength: 512 * 1024
})

if (import.meta.hot) {
  import.meta.hot.dispose(() => compilerWorker.terminate())
}

export function compileMdxPreview(source: string): Promise<CompiledMdxPreview> {
  return compileCache.getOrCompile(source, compileMdxPreviewUncached)
}

export function warmMdxPreviewCompiler(): void {
  compilerWorker.warm()
}

/** Parse as data only. Do not run generated code until the note is opened. */
export function prefetchMdxPreviewSource(source: string): Promise<void> {
  performance.mark('g39:prefetch-compile-start')
  return workerCodeCache
    .getOrCompile(source, (value) => compilerWorker.compile(value))
    .then(() => {
      performance.mark('g39:prefetch-compile-done')
    })
}

async function compileMdxPreviewUncached(source: string): Promise<CompiledMdxPreview> {
  performance.mark('g39:compile-start')
  if (!source.trim()) {
    return {
      Content: emptyMdxContent,
      warnings: []
    }
  }

  const compiled = await workerCodeCache.getOrCompile(source, (value) =>
    compilerWorker.compile(value)
  )
  performance.mark('g39:worker-compile-done')

  // The existing trust boundary is unchanged: generated code runs only for
  // content from a user-opened vault. Custom code still belongs in the
  // registry or sandboxed interactives described by docs/security.md.
  const mdxModule = await run(compiled.code, {
    Fragment,
    jsx,
    jsxs,
    baseUrl: import.meta.url
  })
  performance.mark('g39:mdx-run-done')

  return {
    Content: mdxModule.default,
    warnings: compiled.warnings
  }
}

function emptyMdxContent(): React.JSX.Element {
  return <div className="text-sm text-muted-foreground">Empty note.</div>
}
