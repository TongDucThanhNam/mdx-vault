import type { WorkbenchRequestOperation, WorkbenchRequestToken, WorkbenchState } from './types'
import {
  runWorkbenchTransaction,
  type WorkbenchRequestCoordinator,
  type WorkbenchTransactionResult,
  type WorkbenchTransactionStore
} from './workbench-state'

export interface PreparedControllerEffect<T> {
  value: T
}

interface RunWorkbenchControllerTransactionOptions<T> {
  coordinator: WorkbenchRequestCoordinator
  store: WorkbenchTransactionStore
  operation: WorkbenchRequestOperation
  targetId?: string
  prepare: (token: WorkbenchRequestToken) => Promise<PreparedControllerEffect<T> | false>
  /** Snapshot live view refs after preparation awaits, while the request still owns navigation. */
  captureLatest?: (prepared: T) => void
  transition: (state: WorkbenchState, prepared: T) => WorkbenchState | false
  commit: (prepared: T, state: WorkbenchState) => void
}

/**
 * Thin-controller boundary for staged editor effects. Preparation may read and
 * save through live controller refs, but editor/view/focus commits run only
 * after the matching workbench transition owns the latest request.
 */
export async function runWorkbenchControllerTransaction<T>(
  options: RunWorkbenchControllerTransactionOptions<T>
): Promise<WorkbenchTransactionResult> {
  let preparedValue: T | undefined
  let hasPreparedValue = false
  const result = await runWorkbenchTransaction({
    coordinator: options.coordinator,
    store: options.store,
    operation: options.operation,
    targetId: options.targetId,
    prepare: async (token) => {
      const prepared = await options.prepare(token)
      if (prepared === false) {
        return false
      }

      const latestState = options.store.getState()
      if (latestState.sessionId === token.sessionId && options.coordinator.isCurrent(token)) {
        options.captureLatest?.(prepared.value)
      }

      preparedValue = prepared.value
      hasPreparedValue = true
      return true
    },
    transition: (state) =>
      hasPreparedValue ? options.transition(state, preparedValue as T) : false
  })

  if (result.status === 'committed' && hasPreparedValue) {
    options.commit(preparedValue as T, result.state)
  }

  return result
}
