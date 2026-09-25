import {
  formatKeyBinding,
  getEffectiveBindings,
  type KeymapOverrides
} from '../../../shared/keybindings'
import {
  type KeybindingPlatform,
  WORKSPACE_ACTION_DEFINITIONS,
  type WorkspaceActionDefinition
} from '../../../shared/workspace-actions'

export function keymapMatchesQuery(
  query: string,
  platform: KeybindingPlatform,
  overrides: KeymapOverrides
): boolean {
  const normalizedQuery = query.trim().toLocaleLowerCase()
  if (!normalizedQuery) {
    return true
  }
  return WORKSPACE_ACTION_DEFINITIONS.some((action) =>
    actionMatchesKeymapQuery(action, normalizedQuery, platform, overrides)
  )
}

export function actionMatchesKeymapQuery(
  action: WorkspaceActionDefinition,
  normalizedQuery: string,
  platform: KeybindingPlatform,
  overrides: KeymapOverrides
): boolean {
  if (!normalizedQuery) {
    return true
  }

  const bindings = getEffectiveBindings(action.id, platform, overrides)
  const searchText = [
    action.id,
    action.title,
    action.description,
    action.category,
    action.context,
    ...action.keywords,
    ...bindings,
    ...bindings.map((binding) => formatKeyBinding(binding, platform) ?? binding)
  ]
    .join(' ')
    .toLocaleLowerCase()

  return normalizedQuery.split(/\s+/).every((term) => searchText.includes(term))
}
