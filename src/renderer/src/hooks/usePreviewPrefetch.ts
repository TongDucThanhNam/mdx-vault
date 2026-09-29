import { useEffect } from 'react'
import { IdlePreviewPrefetch } from '@/preview/idle-preview-prefetch'
import { prefetchMdxPreviewSource } from '@/preview/mdx-preview-compiler'
import type { VaultInfo } from '@/vault/types'

/** Warm a few likely next files after Welcome is visibly laid out. */
export function usePreviewPrefetch(
  vault: VaultInfo | null,
  selectedPath: string | null,
  viewMode: string,
  isDirty: boolean
): void {
  useEffect(() => {
    if (!vault || !selectedPath || viewMode !== 'reading' || isDirty) return
    const firstFile =
      vault.files.find((file) => file.relativePath.endsWith('/Welcome.mdx')) ??
      vault.files.find((file) => file.relativePath === 'Welcome.mdx') ??
      vault.files[0]
    if (selectedPath !== firstFile?.relativePath) return

    const prefetch = new IdlePreviewPrefetch(
      prefetchMdxPreviewSource,
      (callback) => window.requestIdleCallback(callback, { timeout: 50 }),
      (id) => window.cancelIdleCallback(id),
      2
    )
    let cancelled = false
    const cancelOnInput = (): void => {
      cancelled = true
      prefetch.cancel()
    }
    document.addEventListener('pointerdown', cancelOnInput, true)
    document.addEventListener('keydown', cancelOnInput, true)
    const candidates = vault.files
      .filter((file) => file.extension === '.mdx' && file.relativePath !== selectedPath)
      .slice(0, 8)
    const filesPromise = Promise.allSettled(
      candidates.map(async (file) => ({
        path: file.relativePath,
        source: await window.vaultApi.readFile(file.relativePath)
      }))
    )
    const start = (): void => {
      const ready = document.querySelector('[data-preview-layout-ready="true"]')
      if (!ready) return
      observer.disconnect()
      void filesPromise.then((results) => {
        if (cancelled) return
        performance.mark('g39:prefetch-candidates-ready')
        const files = results.flatMap((result) =>
          result.status === 'fulfilled' ? [result.value] : []
        )
        const longest = files.reduce<(typeof files)[number] | null>(
          (candidate, file) =>
            !candidate || file.source.length > candidate.source.length ? file : candidate,
          null
        )
        const first = files[0]
        const sources = first ? [first.source] : []
        if (longest && longest.path !== first?.path) sources.push(longest.source)
        prefetch.enqueue(sources)
      })
    }
    const observer = new MutationObserver(start)
    observer.observe(document.body, { subtree: true, attributes: true, childList: true })
    start()
    return () => {
      cancelled = true
      document.removeEventListener('pointerdown', cancelOnInput, true)
      document.removeEventListener('keydown', cancelOnInput, true)
      observer.disconnect()
      prefetch.cancel()
    }
  }, [vault, selectedPath, viewMode, isDirty])
}
