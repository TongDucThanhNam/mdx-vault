/**
 * Renderer-side mirror of `SELECTED_ACTIONS` from
 * `src/main/services/ai-system-prompt.ts`. The two are intentionally
 * duplicated so the renderer doesn't import the main-process module.
 *
 * If you add an action on the main side, mirror it here too. Keep them
 * in sync; the main process is the source of truth for the prompt text.
 */

export type SelectedActionMode = 'template' | 'draft' | 'chat'

export interface SelectedAction {
  id: string
  label: string
  mode: SelectedActionMode
}

export const SELECTED_ACTIONS: ReadonlyArray<SelectedAction> = [
  {
    id: 'rewrite-selection',
    label: 'Rewrite selection',
    mode: 'template'
  },
  {
    id: 'summarise-selection',
    label: 'Summarise selection',
    mode: 'template'
  },
  {
    id: 'create-quiz-on-selection',
    label: 'Create a quiz on the selection',
    mode: 'template'
  },
  {
    id: 'insert-counter-on-selection',
    label: 'Insert a counter on the selection',
    mode: 'template'
  },
  {
    id: 'expand-selection',
    label: 'Expand the selection with more detail',
    mode: 'chat'
  },
  {
    id: 'find-related-notes',
    label: 'Find related notes for the selection',
    mode: 'chat'
  },
  {
    id: 'make-interactive',
    label: 'Turn this idea into an interactive component',
    mode: 'draft'
  },
  {
    id: 'open-chat',
    label: 'Ask anything about this note',
    mode: 'chat'
  }
]

export function findSelectedAction(id: string): SelectedAction | null {
  return SELECTED_ACTIONS.find((action) => action.id === id) ?? null
}

/** Template-mode actions can produce an `interactiveInsert` patch that
 *  references a trusted registry component by name (no AI-generated code). */
export function isTemplateAction(actionId: string): boolean {
  const action = findSelectedAction(actionId)
  return action?.mode === 'template'
}

/** Draft-mode actions may emit a `componentDraft` patch — i.e. AI-generated
 *  code that will live in a sandboxed vault component, never in the trusted
 *  registry. */
export function isDraftAction(actionId: string): boolean {
  const action = findSelectedAction(actionId)
  return action?.mode === 'draft'
}
