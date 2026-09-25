import { describe, expect, test } from 'bun:test'
import {
  InteractiveCreateControllerError,
  type InteractiveCreateScope,
  runInteractiveCreateJourney
} from '../src/renderer/src/interactive/interactive-authoring-controller'
import type {
  InteractiveCreatePayload,
  InteractiveCreateResult
} from '../src/shared/interactive-authoring'

const invocation = {
  noteRelativePath: 'notes/deep/topic.mdx',
  insertionOffset: 17,
  sessionId: 4
}

const result: InteractiveCreateResult = {
  noteRelativePath: invocation.noteRelativePath,
  noteContent: '# Topic\n\n<Interactive src="../../interactives/reading-timer" />\n',
  projectRoot: 'interactives/reading-timer',
  componentRelativePath: 'interactives/reading-timer/Component.tsx',
  insertedSource: '../../interactives/reading-timer',
  contentHash: 'b'.repeat(64)
}

describe('GOAL-25 interactive authoring renderer controller', () => {
  test('saves first and rejects a stale captured note before the create bridge', async () => {
    let createCalls = 0
    const ports = createPorts({
      saveActiveNote: async () => true,
      getCurrentScope: () => ({ noteRelativePath: 'notes/other.mdx', sessionId: 4 }),
      create: async () => {
        createCalls += 1
        return result
      }
    })

    await expect(runInteractiveCreateJourney(ports)).rejects.toEqual(
      new InteractiveCreateControllerError(
        'STALE_INVOCATION',
        'The active note changed before creation started. Reopen New interactive at the intended caret.'
      )
    )
    expect(createCalls).toBe(0)
  })

  test('hashes the persisted revision and reconciles the committed note before opening source', async () => {
    const events: string[] = []
    let payload: InteractiveCreatePayload | null = null
    const ports = createPorts({
      saveActiveNote: async () => {
        events.push('save')
        return true
      },
      hashContent: async (content) => {
        events.push(`hash:${content}`)
        return 'a'.repeat(64)
      },
      create: async (nextPayload) => {
        events.push('create')
        payload = nextPayload
        return result
      },
      applyCommittedNote: () => events.push('apply-note'),
      onCommitted: () => events.push('proof-session'),
      refreshVaultSnapshot: async () => {
        events.push('refresh')
      },
      openComponent: async () => {
        events.push('open-source')
        return true
      }
    })

    const journey = await runInteractiveCreateJourney(ports)

    expect(payload).toEqual({
      noteRelativePath: invocation.noteRelativePath,
      insertionOffset: 17,
      expectedContentHash: 'a'.repeat(64),
      displayName: 'Reading timer',
      slug: 'reading-timer',
      starter: 'blank'
    })
    expect(events).toEqual([
      'save',
      'hash:# Topic\n',
      'create',
      'apply-note',
      'proof-session',
      'refresh',
      'open-source'
    ])
    expect(journey).toEqual({ result, disposition: 'applied', warnings: [] })
  })

  test('does not overwrite or navigate an unrelated active note after a mid-flight switch', async () => {
    let scope: InteractiveCreateScope = {
      noteRelativePath: invocation.noteRelativePath,
      sessionId: invocation.sessionId
    }
    const events: string[] = []
    const ports = createPorts({
      getCurrentScope: () => scope,
      create: async () => {
        scope = { noteRelativePath: 'notes/other.mdx', sessionId: invocation.sessionId }
        return result
      },
      applyCommittedNote: () => events.push('apply-note'),
      onCommitted: () => events.push('proof-session'),
      refreshVaultSnapshot: async () => {
        events.push('refresh')
      },
      openComponent: async () => {
        events.push('open-source')
        return true
      }
    })

    const journey = await runInteractiveCreateJourney(ports)

    expect(events).toEqual([])
    expect(journey).toEqual({
      result,
      disposition: 'completed-in-background',
      warnings: []
    })
  })

  test('reports post-commit refresh and navigation failures as warnings, not transaction failure', async () => {
    const journey = await runInteractiveCreateJourney(
      createPorts({
        refreshVaultSnapshot: async () => {
          throw new Error('refresh failed')
        },
        openComponent: async () => {
          throw new Error('open failed')
        }
      })
    )

    expect(journey.disposition).toBe('applied')
    expect(journey.warnings).toEqual([
      'The interactive was created, but the explorer could not refresh.',
      'The interactive was created, but its source file could not be opened.'
    ])
  })
})

function createPorts(
  overrides: Partial<Parameters<typeof runInteractiveCreateJourney>[0]> = {}
): Parameters<typeof runInteractiveCreateJourney>[0] {
  return {
    invocation,
    form: {
      displayName: 'Reading timer',
      slug: 'reading-timer',
      starter: 'blank'
    },
    saveActiveNote: async () => true,
    getCurrentScope: () => ({
      noteRelativePath: invocation.noteRelativePath,
      sessionId: invocation.sessionId
    }),
    getPersistedNoteContent: () => '# Topic\n',
    hashContent: async () => 'a'.repeat(64),
    create: async () => result,
    applyCommittedNote: () => undefined,
    refreshVaultSnapshot: async () => undefined,
    openComponent: async () => true,
    onCommitted: () => undefined,
    ...overrides
  }
}
