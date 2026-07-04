import { SandboxService } from './sandbox-service'
import { VaultService } from './vault-service'
import { getCurrentVault } from './vault-session'

let currentSandbox: SandboxService | null = null

export function bindCurrentSandboxService(vault: VaultService): SandboxService {
  currentSandbox = new SandboxService(vault)
  return currentSandbox
}

export function getCurrentSandboxService(): SandboxService {
  if (!currentSandbox) {
    currentSandbox = new SandboxService(getCurrentVault())
  }
  return currentSandbox
}

export async function closeCurrentSandboxService(): Promise<void> {
  currentSandbox = null
}
