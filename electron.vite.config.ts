import tailwindcss from '@tailwindcss/vite'
import react from '@vitejs/plugin-react'
import { defineConfig } from 'electron-vite'
import { resolve } from 'path'

// The main process reuses a few renderer source files (e.g. registry
// components for the export SSR snapshot in export-static-snapshot.ts). Those
// files import via the `@/` and `@renderer/` aliases, so the same aliases must
// resolve in the main build pass — otherwise Rollup fails to bundle them.
const sharedAliases = {
  '@renderer': resolve('src/renderer/src'),
  '@': resolve('src/renderer/src')
}
const rendererWorkerSafeAliases = {
  // Vite's browser condition selects DOM implementations even inside module
  // workers. These package defaults are API-equivalent worker-safe builds.
  'decode-named-character-reference': resolve(
    'node_modules/decode-named-character-reference/index.js'
  ),
  'hast-util-from-html-isomorphic': resolve('node_modules/hast-util-from-html-isomorphic/index.js')
}

export default defineConfig({
  main: {
    plugins: [tailwindcss()],
    resolve: {
      alias: sharedAliases
    },
    build: {
      // @tanstack/ai and @tanstack/ai-openai are ESM-only ("type": "module"
      // with no "require" export condition). electron-vite externalizes
      // node_modules by default, which leaves Electron's CJS main process to
      // require() them at runtime → ERR_PACKAGE_PATH_NOT_EXPORTED. Bundling
      // them into the main output instead sidesteps the ESM/CJS mismatch.
      externalizeDeps: {
        exclude: ['@tanstack/ai', '@tanstack/ai-openai']
      }
    }
  },
  preload: {},
  renderer: {
    build: { sourcemap: process.env['MDX_VAULT_PERF'] === '1' },
    // Analysis workers lazily import parser chunks; IIFE cannot code-split.
    worker: { format: 'es' },
    resolve: {
      alias: {
        ...sharedAliases,
        ...rendererWorkerSafeAliases
      }
    },
    optimizeDeps: {
      esbuildOptions: {
        alias: rendererWorkerSafeAliases
      }
    },
    plugins: [react(), tailwindcss()]
  }
})
