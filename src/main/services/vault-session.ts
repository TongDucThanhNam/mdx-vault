import { VaultIndexRuntime } from './vault-index-runtime'
import { VaultService } from './vault-service'
import { bindCurrentSandboxService } from './sandbox-session'

type IndexChangeCallback = () => void

let currentVault: VaultService | null = null
let currentIndex: VaultIndexRuntime | null = null

export async function openCurrentVault(
  root: string,
  onIndexChanged?: IndexChangeCallback
): Promise<VaultService> {
  await closeCurrentVault()

  const vault = new VaultService(root)
  const index = VaultIndexRuntime.open(vault, onIndexChanged)
  bindCurrentSandboxService(vault)

  currentVault = vault
  currentIndex = index

  try {
    await index.start()
  } catch (error) {
    currentVault = null
    currentIndex = null
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

export async function closeCurrentVault(): Promise<void> {
  const index = currentIndex

  currentVault = null
  currentIndex = null

  if (index) {
    await index.close()
  }
}
