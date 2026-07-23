import { type IpcMainInvokeEvent, ipcMain } from 'electron'
import { z } from 'zod'

import type {
  KnowledgeNoteSnapshot,
  LinkMentionRequest,
  PropertyMutationResponse,
  PropertyRenamePlan,
  PropertyRenameResult,
  PropertySummary
} from '../../shared/knowledge'
import { extractFootnotes, findUnlinkedMentions } from '../../shared/knowledge-source'
import { parseFrontmatterProperties } from '../services/frontmatter-properties'
import {
  applyPropertyRename,
  linkNoteMention,
  mutateNoteProperty,
  planPropertyRename
} from '../services/property-service'
import { getCurrentIndex, getCurrentVault } from '../services/vault-session'
import type { IpcFailure, IpcResult } from './vault-ipc'

const relativePathSchema = z
  .string()
  .min(1)
  .max(1_024)
  .refine((value) => {
    const normalized = value.replaceAll('\\', '/')
    return (
      !normalized.startsWith('/') &&
      !/^[a-z]:/iu.test(normalized) &&
      !normalized.split('/').includes('..')
    )
  }, 'Knowledge paths must stay vault-relative')
const propertyNameSchema = z.string().min(1).max(200)
const propertyScalarSchema = z.union([z.string().max(10_000), z.number(), z.boolean(), z.null()])
const propertyValueSchema = z.union([
  propertyScalarSchema,
  z.array(z.union([z.string().max(10_000), z.number(), z.boolean()])).max(500)
])
const notePayloadSchema = z.object({ relativePath: relativePathSchema })
const mutationPayloadSchema = z.object({
  relativePath: relativePathSchema,
  expectedContentHash: z.string().length(64),
  mutation: z.discriminatedUnion('kind', [
    z.object({ kind: z.literal('add'), name: propertyNameSchema, value: propertyValueSchema }),
    z.object({ kind: z.literal('set'), name: propertyNameSchema, value: propertyValueSchema }),
    z.object({ kind: z.literal('delete'), name: propertyNameSchema })
  ])
})
const renamePlanPayloadSchema = z.object({
  oldName: propertyNameSchema,
  newName: propertyNameSchema
})
const mentionCandidateSchema = z.object({
  relativePath: relativePathSchema,
  title: z.string().max(500),
  aliases: z.array(z.string().max(500)).max(100)
})
const linkMentionPayloadSchema: z.ZodType<LinkMentionRequest> = z.object({
  relativePath: relativePathSchema,
  expectedContentHash: z.string().length(64),
  mention: z.object({
    text: z.string().min(1).max(2_000),
    range: z.object({
      from: z.number().int().nonnegative(),
      to: z.number().int().nonnegative()
    }),
    sourceHash: z.string().length(64),
    candidates: z.array(mentionCandidateSchema).min(1).max(100)
  }),
  targetRelativePath: relativePathSchema
})
const renameApplyPayloadSchema = renamePlanPayloadSchema.extend({
  expectedFiles: z
    .array(
      z.object({
        relativePath: relativePathSchema,
        contentHash: z.string().length(64)
      })
    )
    .max(5_000)
})

export function registerKnowledgeIpc(): void {
  ipcMain.handle(
    'knowledge:link-mention',
    (event, payload): Promise<IpcResult<PropertyMutationResponse>> =>
      handleKnowledgeRequest(event, async () => {
        const input = linkMentionPayloadSchema.parse(payload)
        return linkNoteMention(getCurrentVault(), getCurrentIndex(), input)
      })
  )

  ipcMain.handle(
    'knowledge:note-snapshot',
    (event, payload): Promise<IpcResult<KnowledgeNoteSnapshot>> =>
      handleKnowledgeRequest(event, async () => {
        const input = notePayloadSchema.parse(payload)
        const vault = getCurrentVault()
        const index = getCurrentIndex()
        const source = await vault.readFile(input.relativePath)
        const parsedProperties = parseFrontmatterProperties(source)
        const footnotes = extractFootnotes(source)

        return {
          relativePath: input.relativePath,
          // Mutations are guarded against the bytes that were actually read,
          // even if the watcher/index is still catching up.
          contentHash: footnotes.sourceHash,
          outgoingLinks: index.database.getOutgoingLinks(input.relativePath),
          mentions: findUnlinkedMentions({
            source,
            activeRelativePath: input.relativePath,
            candidates: index.database.listNotes().map((candidate) => ({
              relativePath: candidate.relativePath,
              title: candidate.title,
              aliases: candidate.aliases
            }))
          }),
          properties: parsedProperties.properties,
          propertyParseError: parsedProperties.parseError,
          footnotes
        }
      })
  )

  ipcMain.handle(
    'knowledge:property-inventory',
    (event, payload): Promise<IpcResult<PropertySummary[]>> =>
      handleKnowledgeRequest(event, async () => {
        z.undefined().parse(payload)
        return getCurrentIndex().database.listProperties()
      })
  )

  ipcMain.handle(
    'knowledge:mutate-property',
    (event, payload): Promise<IpcResult<PropertyMutationResponse>> =>
      handleKnowledgeRequest(event, async () => {
        const input = mutationPayloadSchema.parse(payload)
        return mutateNoteProperty(getCurrentVault(), getCurrentIndex(), input)
      })
  )

  ipcMain.handle(
    'knowledge:plan-property-rename',
    (event, payload): Promise<IpcResult<PropertyRenamePlan>> =>
      handleKnowledgeRequest(event, async () => {
        const input = renamePlanPayloadSchema.parse(payload)
        return planPropertyRename(
          getCurrentVault(),
          getCurrentIndex(),
          input.oldName,
          input.newName
        )
      })
  )

  ipcMain.handle(
    'knowledge:apply-property-rename',
    (event, payload): Promise<IpcResult<PropertyRenameResult>> =>
      handleKnowledgeRequest(event, async () => {
        const input = renameApplyPayloadSchema.parse(payload)
        return applyPropertyRename(getCurrentVault(), getCurrentIndex(), input)
      })
  )
}

async function handleKnowledgeRequest<T>(
  event: IpcMainInvokeEvent,
  operation: () => Promise<T>
): Promise<IpcResult<T>> {
  try {
    assertMainFrame(event)
    return { ok: true, data: await operation() }
  } catch (error) {
    return { ok: false, error: toIpcError(error) }
  }
}

function assertMainFrame(event: IpcMainInvokeEvent): void {
  if (!event.senderFrame || event.senderFrame !== event.sender.mainFrame) {
    throw new Error('Knowledge operations are only available to the main application frame')
  }
}

function toIpcError(error: unknown): IpcFailure['error'] {
  if (error instanceof z.ZodError) {
    return { code: 'VALIDATION_ERROR', message: 'Invalid knowledge utility request' }
  }
  return {
    code: 'KNOWLEDGE_ERROR',
    message: error instanceof Error ? error.message : 'Knowledge utility operation failed'
  }
}
