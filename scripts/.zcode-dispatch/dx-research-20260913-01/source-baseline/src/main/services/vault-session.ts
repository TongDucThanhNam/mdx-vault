import { BookmarkService } from './bookmark-service'
import { GraphConfigService } from './graph-config-service'
import { bindCurrentSandboxService } from './sandbox-session'
import { VaultIndexRuntime } from './vault-index-runtime'
import { VaultService } from './vault-service'

type IndexChangeCallback = () => void
type TreeChangeCallback = () => void

let currentVault: VaultService | null = null
let currentIndex: VaultIndexRuntime | null = null
let currentBookmarks: BookmarkService | null = null
let currentGraphConfig: GraphConfigService | null = null
let vaultSessionRevision = 0

export async function openCurrentVault(
  root: string,
  onIndexChanged?: IndexChangeCallback,
  onTreeChanged?: TreeChangeCallback
): Promise<VaultService> {
  await closeCurrentVault()

  const vault = new VaultService(root)
  const index = VaultIndexRuntime.open(vault, onIndexChanged, onTreeChanged)
  bindCurrentSandboxService(vault)

  currentVault = vault
  currentIndex = index
  currentBookmarks = new BookmarkService(vault.rootPath)
  currentGraphConfig = new GraphConfigService(vault.rootPath)
  vaultSessionRevision += 1

  try {
    await index.start()
  } catch (error) {
    currentVault = null
    currentIndex = null
    currentBookmarks = null
    currentGraphConfig = null
    vaultSessionRevision += 1
    await index.close()
    throw error
  }

  return vault
}

export function getCurrentVault(): VaultService {
  if (!currentVault) {
    throw new Error('No vault is open')
  }

  return currentVault
}

export function getCurrentIndex(): VaultIndexRuntime {
  if (!currentIndex) {
    throw new Error('No vault index is open')
  }

  return currentIndex
}

export function getCurrentBookmarks(): BookmarkService {
  if (!currentBookmarks) {
    throw new Error('No vault bookmark store is open')
  }
  return currentBookmarks
}

export function getCurrentGraphConfig(): GraphConfigService {
  if (!currentGraphConfig) {
    throw new Error('No vault graph configuration store is open')
  }
  return currentGraphConfig
}

export function getCurrentVaultSessionRevision(): number {
  return vaultSessionRevision
}

export async function closeCurrentVault(): Promise<void> {
  const index = currentIndex
  const hadOpenVault = Boolean(currentVault || currentIndex)

  currentVault = null
  currentIndex = null
  currentBookmarks = null
  currentGraphConfig = null

  if (hadOpenVault) {
    vaultSessionRevision += 1
  }

  if (index) {
    await index.close()
  }
}
