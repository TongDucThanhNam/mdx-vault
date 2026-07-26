import type { AssistantApprovePatchOutput, PatchOperation } from '../../../shared/ai'
import type { VaultTreeFile } from '../vault/types'

export interface InteractiveAiHandoffInput {
  noteRelativePath: string
  operations: PatchOperation[]
  output: AssistantApprovePatchOutput
}

interface InteractiveAiHandoffDependencies {
  refreshVaultSnapshot: () => Promise<VaultTreeFile[]>
  getSelectedNotePath: () => string | null
  readFile: (relativePath: string) => Promise<string>
  restoreNoteBuffer: (
    relativePath: string,
    value: string,
    persistedValue: string,
    missing: boolean
  ) => void
  openOrActivate: (
    relativePath: string,
    options: { focus: true; knownFile?: VaultTreeFile }
  ) => Promise<boolean>
}

export interface InteractiveAiHandoffResult {
  componentRelativePath: string | null
  noteBufferReconciled: boolean
  componentOpened: boolean
}

/**
 * Converges approved AI component drafts onto the same physical-file workbench
 * lifecycle used by manual scaffolds. This never grants proof consent.
 */
export async function completeInteractiveAiHandoff(
  input: InteractiveAiHandoffInput,
  dependencies: InteractiveAiHandoffDependencies
): Promise<InteractiveAiHandoffResult> {
  const treeFiles = await dependencies.refreshVaultSnapshot()
  let noteBufferReconciled = false

  if (
    input.output.writtenPaths.includes(input.noteRelativePath) &&
    dependencies.getSelectedNotePath() === input.noteRelativePath
  ) {
    const noteContent = await dependencies.readFile(input.noteRelativePath)
    dependencies.restoreNoteBuffer(input.noteRelativePath, noteContent, noteContent, false)
    noteBufferReconciled = true
  }

  const draft = input.operations.find(
    (operation): operation is Extract<PatchOperation, { kind: 'componentDraft' }> =>
      operation.kind === 'componentDraft'
  )
  const componentRelativePath = draft
    ? `${draft.folderRelativePath}/component.tsx`
    : (input.output.writtenPaths.find((path) => path.endsWith('/component.tsx')) ?? null)

  if (!componentRelativePath || !input.output.writtenPaths.includes(componentRelativePath)) {
    return {
      componentRelativePath: null,
      noteBufferReconciled,
      componentOpened: false
    }
  }

  const knownFile = treeFiles.find((file) => file.relativePath === componentRelativePath)
  const componentOpened = await dependencies.openOrActivate(componentRelativePath, {
    focus: true,
    ...(knownFile ? { knownFile } : {})
  })

  return {
    componentRelativePath,
    noteBufferReconciled,
    componentOpened
  }
}
