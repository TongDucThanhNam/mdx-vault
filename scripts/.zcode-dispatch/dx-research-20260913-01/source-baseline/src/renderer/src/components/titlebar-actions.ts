import type { CommandActionRegistry } from '@/commands/actions'

export function openVaultFromTitlebar(
  commandActions: Pick<CommandActionRegistry, 'dispatch'>
): Promise<boolean> {
  return commandActions.dispatch('vault.open')
}
