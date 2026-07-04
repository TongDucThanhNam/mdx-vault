/// <reference types="vite/client" />

import type { VaultApi, SandboxApi } from '../preload/index'

declare global {
  interface Window {
    vaultApi?: VaultApi
    sandboxApi?: SandboxApi
  }
}

export {}
