import { BookmarkService } from './bookmark-service'
import { bindCurrentSandboxService } from './sandbox-session'
import { VaultIndexRuntime } from './vault-index-runtime'
import { VaultService } from './vault-service'

type IndexChangeCallback = () => void
type TreeChangeCallback = () => void

let currentVault: VaultService | null = null
let currentIndex: VaultIndexRuntime | null = null
let currentBookmarks: BookmarkService | null = null

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

  try {
    await index.start()
  } catch (error) {
    currentVault = null
    currentIndex = null
    currentBookmarks = null
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

export async function closeCurrentVault(): Promise<void> {
  const index = currentIndex

  currentVault = null
  currentIndex = null
  currentBookmarks = null

  if (index) {
    await index.close()
  }
}
