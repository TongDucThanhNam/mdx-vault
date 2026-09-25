import type { ComponentDraft } from '../../shared/ai'
import { repairComponentDraft } from './ai-repair-loop'

declare function test(name: string, run: () => void | Promise<void>): void
declare function expect<T>(actual: T): { toBe(expected: T): void }

test('GOAL-06 repair loop stops after exactly three failed compile rounds', async () => {
  let compileRounds = 0
  let repairRounds = 0
  const result = await repairComponentDraft(draft(), {
    maxRounds: 3,
    compileDraft: async () => {
      compileRounds += 1
      return { ok: false, errors: [`failure ${compileRounds}`] }
    },
    nextDraft: async (current) => {
      repairRounds += 1
      return {
        ...current,
        componentSource: `${current.componentSource}\n// repair ${repairRounds}`
      }
    }
  })

  expect(result.ok).toBe(false)
  expect(result.rounds).toBe(3)
  expect(compileRounds).toBe(3)
  expect(repairRounds).toBe(2)
})

function draft(): ComponentDraft {
  return {
    kind: 'componentDraft',
    folderRelativePath: 'interactives/test',
    componentSource: 'export default function Test() { return null }',
    manifestJson: JSON.stringify({
      name: 'Test',
      version: '1',
      runtime: 'react',
      permissions: { network: false, filesystem: false, dataPaths: [] },
      propsSchema: {},
      dependencies: {}
    }),
    readmeMarkdown: '# Test',
    provenance: {
      prompt: 'test',
      noteRelativePath: 'Note.mdx',
      modelName: 'test',
      generatedAt: 'now'
    }
  }
}
