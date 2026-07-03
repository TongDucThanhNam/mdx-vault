export interface VaultFile {
  relativePath: string
  name: string
  directory: string
  extension: '.md' | '.mdx'
}

export interface VaultInfo {
  name: string
  files: VaultFile[]
}
