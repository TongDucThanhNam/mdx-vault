export type VaultSwitchResult = 'save_failed' | 'cancelled' | 'committed'

interface SwitchVaultOptions<TVault> {
  saveActiveItem: () => Promise<boolean>
  chooseVault: () => Promise<TVault | null>
  commitVault: (vault: TVault) => Promise<void>
}

/**
 * Keeps vault replacement behind the same save-first boundary as tab navigation.
 * A rejected save never opens the native picker, and picker cancellation never
 * resets the current workbench.
 */
export async function switchVault<TVault>(
  options: SwitchVaultOptions<TVault>
): Promise<VaultSwitchResult> {
  if (!(await options.saveActiveItem())) {
    return 'save_failed'
  }

  const chosenVault = await options.chooseVault()
  if (!chosenVault) {
    return 'cancelled'
  }

  await options.commitVault(chosenVault)
  return 'committed'
}
