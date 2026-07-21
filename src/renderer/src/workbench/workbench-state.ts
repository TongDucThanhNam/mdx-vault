import type {
  ActivateOnClose,
  CloseActiveIntent,
  CloseAuthorization,
  CloseRequirement,
  MruSwitchState,
  WhenClosingWithNoTabs,
  WorkbenchItem,
  WorkbenchItemKind,
  WorkbenchRequestOperation,
  WorkbenchRequestToken,
  WorkbenchState,
  WorkbenchViewState
} from './types'

export const DEFAULT_CLOSED_ITEM_LIMIT = 20

export interface CreateWorkbenchItemInput {
  relativePath: string
  kind: WorkbenchItemKind
  dirty?: boolean
  missing?: boolean
  autosavePaused?: boolean
  viewState?: WorkbenchViewState
}

export interface CloseWorkbenchItemOptions {
  activateOnClose?: ActivateOnClose
  authorization?: CloseAuthorization
  closedItemLimit?: number
}

export interface TransactionalCloseOptions {
  id: string
  wasActive: boolean
  discardMissing: boolean
  activeBufferClean: boolean
  preparedDestinationId: string | null
  activateOnClose: ActivateOnClose
}

export interface ReopenCandidateResolution {
  state: WorkbenchState
  candidateId: string | null
  skippedIds: string[]
}

export type WorkbenchAction =
  | { type: 'open_or_activate'; item: WorkbenchItem }
  | { type: 'activate'; id: string }
  | { type: 'activate_visual'; direction: 1 | -1 }
  | { type: 'close'; id: string; options?: CloseWorkbenchItemOptions }
  | { type: 'reopen'; item: WorkbenchItem }
  | { type: 'rename'; id: string; newRelativePath: string }
  | { type: 'delete'; id: string; activateOnClose?: ActivateOnClose }
  | { type: 'mark_missing'; id: string }
  | { type: 'mark_present'; id: string }
  | { type: 'set_dirty'; id: string; dirty: boolean }
  | { type: 'capture_view'; id: string; viewState: WorkbenchViewState }
  | { type: 'mru_start'; direction?: 1 | -1 }
  | { type: 'mru_cycle'; direction: 1 | -1 }
  | { type: 'mru_cancel' }
  | { type: 'mru_commit' }
  | { type: 'reset_vault' }

export function createWorkbenchState(sessionId = 0): WorkbenchState {
  return {
    sessionId,
    items: [],
    activeId: null,
    mruIds: [],
    closedIds: [],
    mruSwitch: null
  }
}

export function resetWorkbenchState(state: WorkbenchState): WorkbenchState {
  return createWorkbenchState(state.sessionId + 1)
}

export function canonicalizeWorkbenchPath(relativePath: string): string {
  if (relativePath.includes('\0')) {
    throw new Error('Workbench paths cannot contain NUL bytes')
  }

  const slashedPath = relativePath.replaceAll('\\', '/')

  if (slashedPath.startsWith('/') || /^[A-Za-z]:\//u.test(slashedPath)) {
    throw new Error('Workbench paths must be vault-relative')
  }

  const segments = slashedPath.split('/').filter((segment) => segment !== '' && segment !== '.')

  if (segments.length === 0 || segments.some((segment) => segment === '..')) {
    throw new Error('Workbench path is empty or escapes the vault')
  }

  return segments.join('/')
}

export function createWorkbenchItem(input: CreateWorkbenchItemInput): WorkbenchItem {
  const relativePath = canonicalizeWorkbenchPath(input.relativePath)
  const missing = input.missing ?? false

  return {
    id: relativePath,
    relativePath,
    kind: input.kind,
    dirty: input.dirty ?? false,
    missing,
    autosavePaused: missing || (input.autosavePaused ?? false),
    viewState: input.viewState
  }
}

export function isEditableWorkbenchItem(item: WorkbenchItem): boolean {
  return item.kind === 'note' || item.kind === 'text'
}

export function getCloseRequirement(item: WorkbenchItem): CloseRequirement {
  if (!item.dirty) {
    return 'none'
  }

  return item.missing ? 'confirm_discard_missing' : 'save'
}

export function openOrActivateWorkbenchItem(
  state: WorkbenchState,
  incomingItem: WorkbenchItem
): WorkbenchState {
  const normalizedItem = createWorkbenchItem(incomingItem)
  const existing = state.items.find((item) => item.id === normalizedItem.id)

  if (existing) {
    return activateWorkbenchItem(state, existing.id)
  }

  return {
    ...state,
    items: [...state.items, normalizedItem],
    activeId: normalizedItem.id,
    mruIds: promoteId(state.mruIds, normalizedItem.id),
    closedIds: state.closedIds.filter((id) => id !== normalizedItem.id),
    mruSwitch: null
  }
}

export function activateWorkbenchItem(state: WorkbenchState, id: string): WorkbenchState {
  const canonicalId = canonicalizeWorkbenchPath(id)

  if (!state.items.some((item) => item.id === canonicalId)) {
    return state
  }

  const nextMruIds = promoteId(state.mruIds, canonicalId)

  if (
    state.activeId === canonicalId &&
    arraysEqual(state.mruIds, nextMruIds) &&
    state.mruSwitch === null
  ) {
    return state
  }

  return {
    ...state,
    activeId: canonicalId,
    mruIds: nextMruIds,
    mruSwitch: null
  }
}

export function activateVisualWorkbenchItem(
  state: WorkbenchState,
  direction: 1 | -1
): WorkbenchState {
  if (state.items.length === 0) {
    return state
  }

  const currentIndex = state.activeId
    ? state.items.findIndex((item) => item.id === state.activeId)
    : -1
  const startIndex = currentIndex === -1 ? (direction === 1 ? -1 : 0) : currentIndex
  const nextIndex = (startIndex + direction + state.items.length) % state.items.length
  const nextItem = state.items[nextIndex]

  return nextItem ? activateWorkbenchItem(state, nextItem.id) : state
}

export function closeWorkbenchItem(
  state: WorkbenchState,
  id: string,
  options: CloseWorkbenchItemOptions = {}
): WorkbenchState {
  const canonicalId = canonicalizeWorkbenchPath(id)
  const itemIndex = state.items.findIndex((item) => item.id === canonicalId)

  if (itemIndex === -1) {
    return state
  }

  const item = state.items[itemIndex]
  const requirement = getCloseRequirement(item)

  if (
    (requirement === 'save' && options.authorization !== 'saved') ||
    (requirement === 'confirm_discard_missing' && options.authorization !== 'discard_missing') ||
    options.authorization === 'cancel'
  ) {
    return state
  }

  return removeWorkbenchItem(state, canonicalId, {
    activateOnClose: options.activateOnClose ?? 'history',
    rememberClosed: true,
    closedItemLimit: options.closedItemLimit ?? DEFAULT_CLOSED_ITEM_LIMIT
  })
}

/** Validates state/editor preconditions captured by the thin close controller. */
export function commitTransactionalWorkbenchClose(
  state: WorkbenchState,
  options: TransactionalCloseOptions
): WorkbenchState | false {
  const canonicalId = canonicalizeWorkbenchPath(options.id)
  const item = state.items.find((candidate) => candidate.id === canonicalId)
  if (!item || (state.activeId === canonicalId) !== options.wasActive) {
    return false
  }

  if (options.discardMissing) {
    if (!item.missing || !item.dirty) {
      return false
    }
  } else if (item.dirty || (options.wasActive && !options.activeBufferClean)) {
    return false
  }

  const nextState = closeWorkbenchItem(state, canonicalId, {
    activateOnClose: options.activateOnClose,
    authorization: options.discardMissing ? 'discard_missing' : 'saved'
  })
  if (
    nextState.items.some((candidate) => candidate.id === canonicalId) ||
    (options.wasActive && nextState.activeId !== options.preparedDestinationId) ||
    (!options.wasActive && options.preparedDestinationId !== null)
  ) {
    return false
  }

  return nextState
}

export function resolveCloseActiveIntent(
  state: WorkbenchState,
  whenClosingWithNoTabs: WhenClosingWithNoTabs
): CloseActiveIntent {
  if (state.activeId) {
    return { type: 'close_item', id: state.activeId }
  }

  return whenClosingWithNoTabs === 'close_window'
    ? { type: 'close_window' }
    : { type: 'keep_window_open' }
}

export function resolveReopenCandidate(
  state: WorkbenchState,
  exists: (relativePath: string) => boolean
): ReopenCandidateResolution {
  const skippedIds: string[] = []
  let candidateId: string | null = null

  for (const id of state.closedIds) {
    if (exists(id)) {
      candidateId = id
      break
    }

    skippedIds.push(id)
  }

  if (skippedIds.length === 0) {
    return { state, candidateId, skippedIds }
  }

  const skippedSet = new Set(skippedIds)
  return {
    state: {
      ...state,
      closedIds: state.closedIds.filter((id) => !skippedSet.has(id))
    },
    candidateId,
    skippedIds
  }
}

export function reopenWorkbenchItem(state: WorkbenchState, item: WorkbenchItem): WorkbenchState {
  const normalizedItem = createWorkbenchItem(item)
  const withoutClosedEntry = {
    ...state,
    closedIds: state.closedIds.filter((id) => id !== normalizedItem.id)
  }

  return openOrActivateWorkbenchItem(withoutClosedEntry, normalizedItem)
}

export function renameWorkbenchItem(
  state: WorkbenchState,
  id: string,
  newRelativePath: string
): WorkbenchState {
  const canonicalId = canonicalizeWorkbenchPath(id)
  const newId = canonicalizeWorkbenchPath(newRelativePath)
  const itemIndex = state.items.findIndex((item) => item.id === canonicalId)

  if (itemIndex === -1 || state.items[itemIndex]?.kind !== 'note' || canonicalId === newId) {
    return state
  }

  if (state.items.some((item) => item.id === newId)) {
    return state
  }

  const items = [...state.items]
  const currentItem = items[itemIndex]
  items[itemIndex] = {
    ...currentItem,
    id: newId,
    relativePath: newId,
    dirty: false,
    missing: false,
    autosavePaused: false
  }

  return {
    ...state,
    items,
    activeId: state.activeId === canonicalId ? newId : state.activeId,
    mruIds: replaceId(state.mruIds, canonicalId, newId),
    closedIds: replaceId(state.closedIds, canonicalId, newId),
    mruSwitch: replaceMruSwitchId(state.mruSwitch, canonicalId, newId)
  }
}

/** Commit-only transition. Call it only after save, confirmation, and trash all succeed. */
export function deleteWorkbenchItem(
  state: WorkbenchState,
  id: string,
  activateOnClose: ActivateOnClose = 'history'
): WorkbenchState {
  const canonicalId = canonicalizeWorkbenchPath(id)
  if (state.items.find((item) => item.id === canonicalId)?.kind !== 'note') {
    return state
  }

  const removed = removeWorkbenchItem(state, canonicalId, {
    activateOnClose,
    rememberClosed: false,
    closedItemLimit: DEFAULT_CLOSED_ITEM_LIMIT
  })

  if (removed === state) {
    return state
  }

  return {
    ...removed,
    closedIds: removed.closedIds.filter((closedId) => closedId !== canonicalId)
  }
}

export function markWorkbenchItemMissing(state: WorkbenchState, id: string): WorkbenchState {
  return updateWorkbenchItem(state, id, (item) => ({
    ...item,
    missing: true,
    autosavePaused: true
  }))
}

export function markWorkbenchItemPresent(state: WorkbenchState, id: string): WorkbenchState {
  return updateWorkbenchItem(state, id, (item) => ({
    ...item,
    missing: false,
    autosavePaused: false
  }))
}

export function setWorkbenchItemDirty(
  state: WorkbenchState,
  id: string,
  dirty: boolean
): WorkbenchState {
  return updateWorkbenchItem(state, id, (item) => {
    if (!isEditableWorkbenchItem(item) || item.dirty === dirty) {
      return item
    }

    return { ...item, dirty }
  })
}

export function captureWorkbenchViewState(
  state: WorkbenchState,
  id: string,
  viewState: WorkbenchViewState
): WorkbenchState {
  return updateWorkbenchItem(state, id, (item) => ({
    ...item,
    viewState: {
      ...item.viewState,
      ...viewState,
      selection: viewState.selection ? { ...viewState.selection } : item.viewState?.selection
    }
  }))
}

export function startMruSwitch(state: WorkbenchState, direction: 1 | -1 = 1): WorkbenchState {
  if (!state.activeId || state.items.length < 2) {
    return state.mruSwitch ? { ...state, mruSwitch: null } : state
  }

  const candidateIds = normalizeMruIds(state)
  const originIndex = candidateIds.indexOf(state.activeId)
  const highlightedIndex = (originIndex + direction + candidateIds.length) % candidateIds.length
  const highlightedId = candidateIds[highlightedIndex]

  if (!highlightedId) {
    return state
  }

  return {
    ...state,
    mruSwitch: {
      originId: state.activeId,
      candidateIds,
      highlightedId
    }
  }
}

export function cycleMruSwitch(state: WorkbenchState, direction: 1 | -1): WorkbenchState {
  if (!state.mruSwitch) {
    return startMruSwitch(state, direction)
  }

  const currentIndex = state.mruSwitch.candidateIds.indexOf(state.mruSwitch.highlightedId)
  const nextIndex =
    (currentIndex + direction + state.mruSwitch.candidateIds.length) %
    state.mruSwitch.candidateIds.length
  const highlightedId = state.mruSwitch.candidateIds[nextIndex]

  if (!highlightedId || highlightedId === state.mruSwitch.highlightedId) {
    return state
  }

  return {
    ...state,
    mruSwitch: {
      ...state.mruSwitch,
      highlightedId
    }
  }
}

export function cancelMruSwitch(state: WorkbenchState): WorkbenchState {
  return state.mruSwitch ? { ...state, mruSwitch: null } : state
}

export function getMruSwitchCommitTarget(state: WorkbenchState): string | null {
  return state.mruSwitch?.highlightedId ?? null
}

/** Commit-only transition. Invoke after the ordinary activation transaction succeeds. */
export function commitMruSwitch(state: WorkbenchState): WorkbenchState {
  const targetId = getMruSwitchCommitTarget(state)
  return targetId ? activateWorkbenchItem(state, targetId) : state
}

export function workbenchReducer(state: WorkbenchState, action: WorkbenchAction): WorkbenchState {
  switch (action.type) {
    case 'open_or_activate':
      return openOrActivateWorkbenchItem(state, action.item)
    case 'activate':
      return activateWorkbenchItem(state, action.id)
    case 'activate_visual':
      return activateVisualWorkbenchItem(state, action.direction)
    case 'close':
      return closeWorkbenchItem(state, action.id, action.options)
    case 'reopen':
      return reopenWorkbenchItem(state, action.item)
    case 'rename':
      return renameWorkbenchItem(state, action.id, action.newRelativePath)
    case 'delete':
      return deleteWorkbenchItem(state, action.id, action.activateOnClose)
    case 'mark_missing':
      return markWorkbenchItemMissing(state, action.id)
    case 'mark_present':
      return markWorkbenchItemPresent(state, action.id)
    case 'set_dirty':
      return setWorkbenchItemDirty(state, action.id, action.dirty)
    case 'capture_view':
      return captureWorkbenchViewState(state, action.id, action.viewState)
    case 'mru_start':
      return startMruSwitch(state, action.direction)
    case 'mru_cycle':
      return cycleMruSwitch(state, action.direction)
    case 'mru_cancel':
      return cancelMruSwitch(state)
    case 'mru_commit':
      return commitMruSwitch(state)
    case 'reset_vault':
      return resetWorkbenchState(state)
  }
}

interface RemoveWorkbenchItemOptions {
  activateOnClose: ActivateOnClose
  rememberClosed: boolean
  closedItemLimit: number
}

function removeWorkbenchItem(
  state: WorkbenchState,
  id: string,
  options: RemoveWorkbenchItemOptions
): WorkbenchState {
  const itemIndex = state.items.findIndex((item) => item.id === id)

  if (itemIndex === -1) {
    return state
  }

  const items = state.items.filter((item) => item.id !== id)
  const survivingMru = state.mruIds.filter((mruId) => mruId !== id)
  let activeId = state.activeId

  if (state.activeId === id) {
    activeId = choosePostCloseActiveId(items, survivingMru, itemIndex, options.activateOnClose)
  }

  const mruIds = activeId ? promoteId(survivingMru, activeId) : survivingMru
  const closedIds = options.rememberClosed
    ? [id, ...state.closedIds.filter((closedId) => closedId !== id)].slice(
        0,
        Math.max(0, options.closedItemLimit)
      )
    : state.closedIds

  return {
    ...state,
    items,
    activeId,
    mruIds,
    closedIds,
    mruSwitch: null
  }
}

function choosePostCloseActiveId(
  items: WorkbenchItem[],
  survivingMru: string[],
  removedIndex: number,
  policy: ActivateOnClose
): string | null {
  if (items.length === 0) {
    return null
  }

  const rightId = items[removedIndex]?.id ?? null
  const leftId = items[removedIndex - 1]?.id ?? null

  if (policy === 'history') {
    const itemIds = new Set(items.map((item) => item.id))
    return survivingMru.find((id) => itemIds.has(id)) ?? rightId ?? leftId
  }

  if (policy === 'right') {
    return rightId ?? leftId
  }

  return leftId ?? rightId
}

function updateWorkbenchItem(
  state: WorkbenchState,
  id: string,
  update: (item: WorkbenchItem) => WorkbenchItem
): WorkbenchState {
  const canonicalId = canonicalizeWorkbenchPath(id)
  const index = state.items.findIndex((item) => item.id === canonicalId)

  if (index === -1) {
    return state
  }

  const currentItem = state.items[index]
  const nextItem = update(currentItem)

  if (nextItem === currentItem) {
    return state
  }

  const items = [...state.items]
  items[index] = nextItem
  return { ...state, items }
}

function normalizeMruIds(state: WorkbenchState): string[] {
  const itemIds = new Set(state.items.map((item) => item.id))
  const seen = new Set<string>()
  const result: string[] = []

  for (const id of [state.activeId, ...state.mruIds, ...state.items.map((item) => item.id)]) {
    if (!id || seen.has(id) || !itemIds.has(id)) {
      continue
    }

    seen.add(id)
    result.push(id)
  }

  return result
}

function promoteId(ids: string[], id: string): string[] {
  return [id, ...ids.filter((candidate) => candidate !== id)]
}

function replaceId(ids: string[], oldId: string, newId: string): string[] {
  const seen = new Set<string>()
  const result: string[] = []

  for (const id of ids) {
    const replacement = id === oldId ? newId : id
    if (!seen.has(replacement)) {
      seen.add(replacement)
      result.push(replacement)
    }
  }

  return result
}

function replaceMruSwitchId(
  mruSwitch: MruSwitchState | null,
  oldId: string,
  newId: string
): MruSwitchState | null {
  if (!mruSwitch) {
    return null
  }

  return {
    originId: mruSwitch.originId === oldId ? newId : mruSwitch.originId,
    candidateIds: replaceId(mruSwitch.candidateIds, oldId, newId),
    highlightedId: mruSwitch.highlightedId === oldId ? newId : mruSwitch.highlightedId
  }
}

function arraysEqual(left: string[], right: string[]): boolean {
  return left.length === right.length && left.every((value, index) => value === right[index])
}

export interface WorkbenchRequestCoordinator {
  begin: (
    sessionId: number,
    operation: WorkbenchRequestOperation,
    targetId?: string
  ) => WorkbenchRequestToken
  isCurrent: (token: WorkbenchRequestToken) => boolean
  finish: (token: WorkbenchRequestToken) => boolean
  invalidate: () => void
}

/**
 * Issues monotonically increasing request tokens. Beginning a request makes
 * every older request stale; invalidating on a vault switch prevents late
 * effects from committing into the next session.
 */
export function createWorkbenchRequestCoordinator(): WorkbenchRequestCoordinator {
  let sequence = 0
  let current: WorkbenchRequestToken | null = null

  return {
    begin(sessionId, operation, targetId) {
      sequence += 1
      current = { id: sequence, sessionId, operation, targetId }
      return current
    },
    isCurrent(token) {
      return current?.id === token.id && current.sessionId === token.sessionId
    },
    finish(token) {
      if (current?.id !== token.id || current.sessionId !== token.sessionId) {
        return false
      }

      current = null
      return true
    },
    invalidate() {
      sequence += 1
      current = null
    }
  }
}

export interface WorkbenchTransactionStore {
  getState: () => WorkbenchState
  commit: (state: WorkbenchState) => void
}

export interface RunWorkbenchTransactionOptions {
  coordinator: WorkbenchRequestCoordinator
  store: WorkbenchTransactionStore
  operation: WorkbenchRequestOperation
  targetId?: string
  /**
   * Perform save/load/filesystem effects. Throw, reject, or return false to
   * abort without a state commit. Boolean support is intentional because the
   * existing editor save adapters report failure as false.
   */
  prepare: (token: WorkbenchRequestToken) => Promise<void> | Promise<boolean>
  /** Pure commit applied to the latest state only after prepare succeeds. */
  transition: (state: WorkbenchState) => WorkbenchState | false
}

export type WorkbenchTransactionResult =
  | { status: 'committed'; state: WorkbenchState }
  | { status: 'stale' }
  | { status: 'failed'; error: unknown }

/**
 * Transaction boundary used by thin controllers: no workbench state changes
 * until all injected effects succeed, and a late result cannot overwrite a
 * newer request or a reset vault session.
 */
export async function runWorkbenchTransaction(
  options: RunWorkbenchTransactionOptions
): Promise<WorkbenchTransactionResult> {
  const initialState = options.store.getState()
  const token = options.coordinator.begin(
    initialState.sessionId,
    options.operation,
    options.targetId
  )

  try {
    const prepared = await options.prepare(token)

    const currentState = options.store.getState()
    if (currentState.sessionId !== token.sessionId || !options.coordinator.isCurrent(token)) {
      options.coordinator.finish(token)
      return { status: 'stale' }
    }

    if (prepared === false) {
      options.coordinator.finish(token)
      return {
        status: 'failed',
        error: new Error('Workbench transaction preparation was rejected')
      }
    }

    const nextState = options.transition(currentState)

    if (nextState === false) {
      options.coordinator.finish(token)
      return {
        status: 'failed',
        error: new Error('Workbench transaction commit precondition was rejected')
      }
    }

    if (!options.coordinator.isCurrent(token)) {
      options.coordinator.finish(token)
      return { status: 'stale' }
    }

    options.store.commit(nextState)
    options.coordinator.finish(token)
    return { status: 'committed', state: nextState }
  } catch (error) {
    options.coordinator.finish(token)
    return { status: 'failed', error }
  }
}
