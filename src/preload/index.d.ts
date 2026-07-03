interface VaultFile {
  relativePath: string
  name: string
  directory: string
  extension: '.md' | '.mdx'
}

interface VaultInfo {
  name: string
  files: VaultFile[]
}

interface VaultApi {
  openVault: () => Promise<VaultInfo | null>
  listFiles: () => Promise<VaultFile[]>
  readFile: (relativePath: string) => Promise<string>
  writeFile: (relativePath: string, content: string) => Promise<void>
}

declare global {
  interface Window {
    vaultApi: VaultApi
  }
}

export {}
