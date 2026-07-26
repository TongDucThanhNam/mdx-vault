import { mkdir, readFile, rename, rm, writeFile } from 'node:fs/promises'
import { dirname, join } from 'node:path'

import {
  createDefaultGraphViewManifest,
  GRAPH_CONFIG_RELATIVE_PATH,
  GRAPH_VIEW_VERSION,
  type GraphConfigLoadResult,
  type GraphConfigRecovery,
  type GraphViewManifest,
  graphConfigLoadResultSchema,
  graphViewManifestSchema
} from '../../shared/graph'

export class GraphConfigService {
  private readonly filePath: string
  private writeQueue: Promise<void> = Promise.resolve()

  constructor(vaultRoot: string) {
    this.filePath = join(vaultRoot, GRAPH_CONFIG_RELATIVE_PATH)
  }

  async load(): Promise<GraphConfigLoadResult> {
    let raw: string

    try {
      raw = await readFile(this.filePath, 'utf8')
    } catch (error) {
      if (isNodeError(error) && error.code === 'ENOENT') {
        return graphConfigLoadResultSchema.parse({
          manifest: createDefaultGraphViewManifest(),
          recovery: null
        })
      }
      throw error
    }

    let parsed: unknown
    try {
      parsed = JSON.parse(raw)
    } catch {
      return createRecoveryResult('corrupt')
    }

    if (
      typeof parsed === 'object' &&
      parsed !== null &&
      'version' in parsed &&
      parsed.version !== GRAPH_VIEW_VERSION
    ) {
      return createRecoveryResult('unsupported-version')
    }

    const manifest = graphViewManifestSchema.safeParse(parsed)
    return manifest.success
      ? graphConfigLoadResultSchema.parse({ manifest: manifest.data, recovery: null })
      : createRecoveryResult('corrupt')
  }

  async save(
    manifest: GraphViewManifest,
    expectedRevision: number
  ): Promise<GraphConfigLoadResult> {
    const validated = graphViewManifestSchema.parse(manifest)
    let result: GraphConfigLoadResult = {
      manifest: validated,
      recovery: null
    }

    const operation = this.writeQueue.then(async () => {
      const current = await this.load()
      if (current.recovery) {
        throw new Error(
          `Graph configuration recovery is required at ${GRAPH_CONFIG_RELATIVE_PATH}; the existing file was preserved.`
        )
      }
      if (current.manifest.revision !== expectedRevision) {
        throw new Error('Graph settings changed in another operation. Reload before saving.')
      }
      if (validated.revision !== expectedRevision + 1) {
        throw new Error('Graph configuration revisions must advance by exactly one.')
      }

      result = graphConfigLoadResultSchema.parse({
        manifest: validated,
        recovery: null
      })
      await this.writeAtomic(`${JSON.stringify(validated, null, 2)}\n`)
    })

    this.writeQueue = operation.catch(() => undefined)
    await operation
    return result
  }

  private async writeAtomic(serialized: string): Promise<void> {
    await mkdir(dirname(this.filePath), { recursive: true })
    const tempPath = `${this.filePath}.${process.pid}.${Date.now()}.tmp`
    try {
      await writeFile(tempPath, serialized, 'utf8')
      await rename(tempPath, this.filePath)
    } catch (error) {
      await rm(tempPath, { force: true }).catch(() => undefined)
      throw error
    }
  }
}

function createRecoveryResult(kind: GraphConfigRecovery['kind']): GraphConfigLoadResult {
  return graphConfigLoadResultSchema.parse({
    manifest: createDefaultGraphViewManifest(),
    recovery: {
      kind,
      relativePath: GRAPH_CONFIG_RELATIVE_PATH
    }
  })
}

function isNodeError(error: unknown): error is NodeJS.ErrnoException {
  return error instanceof Error && 'code' in error
}
