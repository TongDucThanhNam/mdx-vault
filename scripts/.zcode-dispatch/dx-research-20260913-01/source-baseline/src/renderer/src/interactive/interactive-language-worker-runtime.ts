import {
  createInteractiveProjectSnapshot,
  INTERACTIVE_PROJECT_MAX_FILE_BYTES,
  type InteractiveProjectSnapshot,
  resolveInteractiveProjectPath
} from '../../../shared/interactive-authoring'
import { InteractiveLanguageProject } from '../../../shared/interactive-language'
import type {
  InteractiveLanguageOperation,
  InteractiveLanguageRequest,
  InteractiveLanguageResponse,
  InteractiveLanguageResultMap
} from '../../../shared/interactive-language-protocol'

export class InteractiveLanguageWorkerRuntime {
  private project: InteractiveLanguageProject | null = null
  private snapshot: InteractiveProjectSnapshot | null = null

  constructor(private readonly typeLibraries: ReadonlyMap<string, string>) {}

  handle(request: InteractiveLanguageRequest): InteractiveLanguageResponse {
    try {
      return this.handleValidated(request)
    } catch (error) {
      return {
        type: 'error',
        requestId: request.requestId,
        projectId: request.projectId,
        version: request.version,
        operation: request.operation,
        code: classifyRuntimeError(error),
        message: error instanceof Error ? error.message : String(error)
      }
    }
  }

  dispose(): void {
    this.project?.dispose()
    this.project = null
    this.snapshot = null
  }

  private handleValidated(request: InteractiveLanguageRequest): InteractiveLanguageResponse {
    if (request.operation === 'initialize') {
      let snapshot: InteractiveProjectSnapshot
      try {
        snapshot = createInteractiveProjectSnapshot({
          projectRoot: request.snapshot.projectRoot,
          version: request.snapshot.version,
          files: request.snapshot.files
        })
      } catch (error) {
        throw new WorkerRuntimeError(
          'INVALID_REQUEST',
          error instanceof Error ? error.message : 'Interactive project snapshot is invalid'
        )
      }
      if (snapshot.projectId !== request.projectId || snapshot.version !== request.version) {
        throw new WorkerRuntimeError(
          'PROJECT_MISMATCH',
          'Worker initialization did not match the requested project and version'
        )
      }

      this.dispose()
      this.snapshot = snapshot
      this.project = new InteractiveLanguageProject(snapshot, this.typeLibraries)
      return resultResponse(request, { ready: true })
    }

    const project = this.requireProject(request)
    if (request.operation === 'dispose') {
      this.dispose()
      return resultResponse(request, { disposed: true })
    }
    if (request.operation === 'update') {
      const nextSnapshot = this.createUpdatedSnapshot(
        request.relativePath,
        request.content,
        request.version
      )
      project.updateFile(request.relativePath, request.content, request.version)
      this.snapshot = nextSnapshot
      return resultResponse(request, { updated: true })
    }
    if (request.operation === 'diagnostics') {
      return resultResponse(request, project.getDiagnostics())
    }
    if (request.operation === 'completion') {
      return resultResponse(request, project.getCompletions(request.relativePath, request.position))
    }
    if (request.operation === 'completion-details') {
      return resultResponse(
        request,
        project.getCompletionDetails(request.relativePath, request.position, request.completion)
      )
    }
    if (request.operation === 'hover') {
      return resultResponse(request, project.getHover(request.relativePath, request.position))
    }
    if (request.operation === 'signature') {
      return resultResponse(
        request,
        project.getSignatureHelp(request.relativePath, request.position)
      )
    }
    if (request.operation === 'definition') {
      return resultResponse(request, project.getDefinitions(request.relativePath, request.position))
    }
    if (request.operation === 'references') {
      return resultResponse(request, project.getReferences(request.relativePath, request.position))
    }
    if (request.operation === 'rename') {
      return resultResponse(
        request,
        project.getRename(request.relativePath, request.position, request.newName)
      )
    }
    return resultResponse(
      request,
      project.getCodeActions(request.relativePath, request.from, request.to)
    )
  }

  private requireProject(request: InteractiveLanguageRequest): InteractiveLanguageProject {
    if (!this.project || !this.snapshot) {
      throw new WorkerRuntimeError(
        'PROJECT_NOT_INITIALIZED',
        'Type intelligence has not initialized an interactive project'
      )
    }
    if (request.projectId !== this.project.projectId) {
      throw new WorkerRuntimeError(
        'PROJECT_MISMATCH',
        'Type intelligence request belongs to a different project'
      )
    }
    const expectedVersion =
      request.operation === 'update' ? this.project.projectVersion + 1 : this.project.projectVersion
    if (request.version !== expectedVersion) {
      throw new WorkerRuntimeError(
        'STALE_VERSION',
        `Type intelligence expected project version ${expectedVersion}`
      )
    }
    return this.project
  }

  private createUpdatedSnapshot(
    relativePath: string,
    content: string,
    version: number
  ): InteractiveProjectSnapshot {
    if (!this.snapshot) {
      throw new WorkerRuntimeError(
        'PROJECT_NOT_INITIALIZED',
        'Type intelligence has not initialized an interactive project'
      )
    }
    if (new TextEncoder().encode(content).byteLength > INTERACTIVE_PROJECT_MAX_FILE_BYTES) {
      throw new WorkerRuntimeError(
        'INVALID_REQUEST',
        'Interactive source exceeds the 5 MiB text-file limit'
      )
    }
    const resolved = resolveInteractiveProjectPath(`${this.snapshot.projectRoot}/${relativePath}`)
    if (
      !resolved ||
      resolved.projectRoot !== this.snapshot.projectRoot ||
      resolved.kind !== 'source'
    ) {
      throw new WorkerRuntimeError(
        'INVALID_REQUEST',
        'Worker updates must stay inside the active interactive source project'
      )
    }

    const files = this.snapshot.files.filter(
      (file) => file.relativePath.toLowerCase() !== relativePath.toLowerCase()
    )
    files.push({ relativePath, content })
    try {
      return createInteractiveProjectSnapshot({
        projectRoot: this.snapshot.projectRoot,
        version,
        files
      })
    } catch (error) {
      throw new WorkerRuntimeError(
        'INVALID_REQUEST',
        error instanceof Error ? error.message : 'Interactive project update is invalid'
      )
    }
  }
}

class WorkerRuntimeError extends Error {
  constructor(
    readonly code:
      | 'INVALID_REQUEST'
      | 'PROJECT_NOT_INITIALIZED'
      | 'PROJECT_MISMATCH'
      | 'STALE_VERSION',
    message: string
  ) {
    super(message)
    this.name = 'WorkerRuntimeError'
  }
}

function classifyRuntimeError(
  error: unknown
): Extract<InteractiveLanguageResponse, { type: 'error' }>['code'] {
  return error instanceof WorkerRuntimeError ? error.code : 'WORKER_FAILURE'
}

function resultResponse<TOperation extends InteractiveLanguageOperation>(
  request: Extract<InteractiveLanguageRequest, { operation: TOperation }>,
  result: InteractiveLanguageResultMap[TOperation]
): InteractiveLanguageResponse {
  return {
    type: 'result',
    requestId: request.requestId,
    projectId: request.projectId,
    version: request.version,
    operation: request.operation,
    result
  } as InteractiveLanguageResponse
}
