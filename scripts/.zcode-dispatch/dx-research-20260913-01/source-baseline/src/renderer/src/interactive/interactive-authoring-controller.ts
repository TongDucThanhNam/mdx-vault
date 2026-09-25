import type {
  InteractiveCreatePayload,
  InteractiveCreateResult,
  InteractiveStarter
} from '../../../shared/interactive-authoring'

export interface InteractiveCreateForm {
  displayName: string
  slug: string
  starter: InteractiveStarter
}

export interface InteractiveCreateInvocation {
  noteRelativePath: string
  insertionOffset: number
  sessionId: number
}

export interface InteractiveCreateScope {
  noteRelativePath: string | null
  sessionId: number
}

export interface InteractiveCreateJourneyResult {
  result: InteractiveCreateResult
  disposition: 'applied' | 'completed-in-background'
  warnings: string[]
}

interface InteractiveCreateJourneyPorts {
  invocation: InteractiveCreateInvocation
  form: InteractiveCreateForm
  saveActiveNote: () => Promise<boolean>
  getCurrentScope: () => InteractiveCreateScope
  getPersistedNoteContent: () => string
  hashContent: (content: string) => Promise<string>
  create: (payload: InteractiveCreatePayload) => Promise<InteractiveCreateResult>
  applyCommittedNote: (result: InteractiveCreateResult) => void
  refreshVaultSnapshot: () => Promise<void>
  openComponent: (result: InteractiveCreateResult) => Promise<boolean>
  onCommitted: (result: InteractiveCreateResult) => void
}

export class InteractiveCreateControllerError extends Error {
  constructor(
    readonly code: 'SAVE_FAILED' | 'STALE_INVOCATION',
    message: string
  ) {
    super(message)
    this.name = 'InteractiveCreateControllerError'
  }
}

export async function runInteractiveCreateJourney(
  ports: InteractiveCreateJourneyPorts
): Promise<InteractiveCreateJourneyResult> {
  if (!(await ports.saveActiveNote())) {
    throw new InteractiveCreateControllerError(
      'SAVE_FAILED',
      'Save failed, so the interactive was not created.'
    )
  }

  if (!scopeMatchesInvocation(ports.getCurrentScope(), ports.invocation)) {
    throw new InteractiveCreateControllerError(
      'STALE_INVOCATION',
      'The active note changed before creation started. Reopen New interactive at the intended caret.'
    )
  }

  const noteContent = ports.getPersistedNoteContent()
  const result = await ports.create({
    noteRelativePath: ports.invocation.noteRelativePath,
    insertionOffset: ports.invocation.insertionOffset,
    expectedContentHash: await ports.hashContent(noteContent),
    displayName: ports.form.displayName,
    slug: ports.form.slug,
    starter: ports.form.starter
  })

  if (!scopeMatchesInvocation(ports.getCurrentScope(), ports.invocation)) {
    return {
      result,
      disposition: 'completed-in-background',
      warnings: []
    }
  }

  ports.applyCommittedNote(result)
  ports.onCommitted(result)

  const warnings: string[] = []
  try {
    await ports.refreshVaultSnapshot()
  } catch {
    warnings.push('The interactive was created, but the explorer could not refresh.')
  }

  try {
    if (!(await ports.openComponent(result))) {
      warnings.push('The interactive was created, but its source file could not be opened.')
    }
  } catch {
    warnings.push('The interactive was created, but its source file could not be opened.')
  }

  return {
    result,
    disposition: 'applied',
    warnings
  }
}

export async function hashInteractiveNoteContent(content: string): Promise<string> {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(content))
  return Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, '0')).join('')
}

function scopeMatchesInvocation(
  scope: InteractiveCreateScope,
  invocation: InteractiveCreateInvocation
): boolean {
  return (
    scope.sessionId === invocation.sessionId &&
    scope.noteRelativePath === invocation.noteRelativePath
  )
}
