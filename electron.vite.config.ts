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

export default defineConfig({
  main: {
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
    resolve: {
      alias: sharedAliases
    },
    plugins: [react(), tailwindcss()]
  }
})
