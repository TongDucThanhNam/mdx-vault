import { z } from 'zod'

export const exportModeSchema = z.enum(['static', 'interactive'])
export type ExportMode = z.infer<typeof exportModeSchema>

export const exportDiagnosticSchema = z
  .object({
    code: z.string().min(1),
    severity: z.enum(['blocking', 'warning']),
    message: z.string().min(1),
    line: z.number().int().positive().optional(),
    column: z.number().int().positive().optional(),
    nodeId: z.string().min(1).optional(),
    componentName: z.string().min(1).optional(),
    propName: z.string().min(1).optional(),
    modes: z.array(exportModeSchema).min(1).default(['static', 'interactive'])
  })
  .strict()
export type ExportDiagnostic = z.infer<typeof exportDiagnosticSchema>

export const exportScanResultSchema = z
  .object({
    noteRelativePath: z.string().min(1),
    noteTitle: z.string().min(1),
    usedComponents: z.array(z.string().min(1)).default([]),
    sandboxIslands: z
      .array(
        z
          .object({
            nodeId: z.string().min(1),
            line: z.number().int().positive().optional(),
            kind: z.enum(['html', 'interactive']),
            src: z.string().min(1),
            resolvedPath: z.string().min(1),
            manifestName: z.string().min(1),
            permissionStatus: z.enum(['allowed', 'denied', 'prompt']),
            fallback: z.string().optional(),
            fallbackAvailable: z.boolean().default(false),
            networkRequested: z.boolean().default(false),
            dataPaths: z.array(z.string().min(1)).default([])
          })
          .strict()
      )
      .default([]),
    imageAssets: z.array(z.string().min(1)).default([]),
    datasetAssets: z.array(z.string().min(1)).default([]),
    wikilinkTargets: z.array(z.string().min(1)).default([]),
    diagnostics: z.array(exportDiagnosticSchema).default([])
  })
  .strict()
export type ExportScanResult = z.infer<typeof exportScanResultSchema>

export const exportPickTargetPayloadSchema = z
  .object({
    noteRelativePath: z.string().min(1),
    mode: exportModeSchema,
    defaultFileName: z.string().min(1)
  })
  .strict()

export const exportPickTargetResultSchema = z
  .object({
    absolutePath: z.string().min(1)
  })
  .strict()
export type ExportPickTargetResult = z.infer<typeof exportPickTargetResultSchema>

export const exportRunPayloadSchema = z
  .object({
    noteRelativePath: z.string().min(1),
    mode: exportModeSchema,
    target: z.object({ absolutePath: z.string().min(1) }).strict(),
    confirmedOversized: z.boolean().optional()
  })
  .strict()
export type ExportRunPayload = z.infer<typeof exportRunPayloadSchema>

export const exportRunResultSchema = z
  .object({
    size: z.number().int().nonnegative(),
    warnings: z.array(z.string().min(1)).default([]),
    fallbacksUsed: z.array(z.string().min(1)).default([]),
    sandboxSkipped: z
      .array(
        z
          .object({
            resolvedPath: z.string().min(1),
            reason: z.string().min(1)
          })
          .strict()
      )
      .default([])
  })
  .strict()
export type ExportRunResult = z.infer<typeof exportRunResultSchema>

export const exportProgressEventSchema = z.discriminatedUnion('phase', [
  z
    .object({
      phase: z.literal('scan'),
      message: z.string().min(1)
    })
    .strict(),
  z
    .object({
      phase: z.literal('render'),
      message: z.string().min(1)
    })
    .strict(),
  z
    .object({
      phase: z.literal('bundle'),
      message: z.string().min(1)
    })
    .strict(),
  z
    .object({
      phase: z.literal('inline'),
      message: z.string().min(1)
    })
    .strict(),
  z
    .object({
      phase: z.literal('leak-check')
    })
    .strict(),
  z
    .object({
      phase: z.literal('write')
    })
    .strict(),
  z
    .object({
      phase: z.literal('done'),
      size: z.number().int().nonnegative()
    })
    .strict(),
  z
    .object({
      phase: z.literal('error'),
      code: z.string().min(1),
      message: z.string().min(1)
    })
    .strict(),
  z
    .object({
      phase: z.literal('size-warning'),
      totalBytes: z.number().int().nonnegative(),
      thresholdBytes: z.number().int().positive()
    })
    .strict()
])
export type ExportProgressEvent = z.infer<typeof exportProgressEventSchema>

export const exportProgressChannel = 'export:progress'

export const EXPORT_SIZE_WARNING_THRESHOLD_BYTES = 5 * 1024 * 1024
export const EXPORT_HARD_LIMIT_BYTES = 25 * 1024 * 1024
