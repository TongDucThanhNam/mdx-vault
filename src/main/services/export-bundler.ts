import { build } from 'esbuild'
import { writeFile, mkdtemp, rm } from 'fs/promises'
import { dirname, join, resolve } from 'path'

/**
 * Registry components are React components defined in `src/renderer/src/preview/islands`.
 * Main process bundles them with esbuild into a single IIFE so the export
 * file is fully self-contained (no CDN, no relative paths). The entry stub
 * exposes them on `window.__mdxVaultIslands` keyed by component name; a
 * hydration script in the writer picks them up after DOMContentLoaded.
 */
const REGISTRY_COMPONENT_MAP: Record<string, string> = {
  Counter: 'src/renderer/src/preview/Counter.tsx',
  QuizBlock: 'src/renderer/src/preview/islands/QuizBlock.tsx',
  EquationSlider: 'src/renderer/src/preview/islands/EquationSlider.tsx',
  DataChart: 'src/renderer/src/preview/islands/DataChart.tsx',
  AlgorithmVisualizer: 'src/renderer/src/preview/islands/AlgorithmVisualizer.tsx'
}

export interface BundleOptions {
  usedComponents: string[]
}

export interface BundleResult {
  script: string
  /** Names that were not found in the registry — caller may emit placeholders. */
  unknownComponents: string[]
}

export class RegistryBundler {
  async bundle({ usedComponents }: BundleOptions): Promise<BundleResult> {
    const filtered = [
      ...new Set(
        usedComponents.filter((name) =>
          Object.prototype.hasOwnProperty.call(REGISTRY_COMPONENT_MAP, name)
        )
      )
    ]
    const unknownComponents = usedComponents.filter(
      (name) => !Object.prototype.hasOwnProperty.call(REGISTRY_COMPONENT_MAP, name)
    )

    if (filtered.length === 0) {
      return {
        script: '/* no registry components used in this note */',
        unknownComponents
      }
    }

    const repoRoot = findRepoRoot(__dirname)
    const workingDir = await mkdtemp(join(repoRoot, '.export-bundle-'))
    const entryPath = join(workingDir, 'entry.ts')
    const stubSource = buildEntryStub(filtered)

    try {
      await writeFile(entryPath, stubSource, 'utf8')

      const result = await build({
        entryPoints: [entryPath],
        bundle: true,
        format: 'iife',
        jsx: 'automatic',
        legalComments: 'none',
        logLevel: 'silent',
        platform: 'browser',
        sourcemap: false,
        target: 'es2022',
        minify: true,
        treeShaking: true,
        write: false,
        // The renderer ships React 19 as a bundled dependency. We *also*
        // bundle react into the export because the file must run from
        // file:// without any network access.
        external: [],
        // The entry stub lives in a project-local tempdir so esbuild can
        // resolve `react`, `react-dom/client`, and the registry source files
        // from node_modules / the project source tree.
        nodePaths: [join(repoRoot, 'node_modules')],
        define: {
          'process.env.NODE_ENV': '"production"'
        }
      })

      const script = result.outputFiles[0]?.text

      if (!script) {
        throw new Error('esbuild did not return an output file for registry bundle')
      }

      return {
        script,
        unknownComponents
      }
    } finally {
      void rm(workingDir, { recursive: true, force: true }).catch(() => {
        /* best-effort cleanup */
      })
    }
  }
}

function buildEntryStub(componentNames: string[]): string {
  const importLines = componentNames
    .map((name) => `import { ${name} as ${name}Component } from '${REGISTRY_COMPONENT_MAP[name]}'`)
    .join('\n')

  const registrations = componentNames
    .map((name) => `  ${JSON.stringify(name)}: ${name}Component,`)
    .join('\n')

  return `
import * as React from 'react'
import { createRoot } from 'react-dom/client'

${importLines}

const registry = {
${registrations}
}

;(function () {
  if (typeof window === 'undefined') {
    return
  }
  Object.defineProperty(window, '__mdxVaultIslands', {
    value: Object.freeze(registry),
    writable: false,
    configurable: false
  })
  Object.defineProperty(window, '__mdxVaultReact', {
    value: Object.freeze({ React: React, createRoot: createRoot }),
    writable: false,
    configurable: false
  })
  window.dispatchEvent(new CustomEvent('mdx-vault-islands-ready'))
})();
`
}

/**
 * Walk up from a tempdir entry path until we find the closest directory
 * containing `package.json` — that's the repo root where esbuild should
 * resolve `react` and the source files.
 */
function findRepoRoot(start: string): string {
  let current = resolve(start)
  for (let depth = 0; depth < 8; depth += 1) {
    const parent = dirname(current)
    if (parent === current) break
    try {
      // require synchronously to avoid pulling fs into hot path
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      const fs = require('node:fs') as typeof import('node:fs')
      if (fs.existsSync(join(parent, 'package.json'))) {
        return parent
      }
    } catch {
      /* ignore */
    }
    current = parent
  }
  return resolve(start)
}
