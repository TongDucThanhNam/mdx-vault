import { randomUUID } from 'crypto'
import { protocol } from 'electron'

export const SANDBOX_DOCUMENT_SCHEME = 'mdx-vault-sandbox'

const sandboxDocumentOrigin = `${SANDBOX_DOCUMENT_SCHEME}://document`
const documentLifetimeMs = 5 * 60 * 1000
const maxPendingDocuments = 128

interface PendingSandboxDocument {
  html: string
  expiresAt: number
}

const pendingDocuments = new Map<string, PendingSandboxDocument>()

export function registerSandboxDocumentScheme(): void {
  protocol.registerSchemesAsPrivileged([
    {
      scheme: SANDBOX_DOCUMENT_SCHEME,
      privileges: { standard: true }
    }
  ])
}

export function publishSandboxDocument(html: string): string {
  pruneExpiredDocuments()

  while (pendingDocuments.size >= maxPendingDocuments) {
    const oldestToken = pendingDocuments.keys().next().value
    if (typeof oldestToken !== 'string') {
      break
    }
    pendingDocuments.delete(oldestToken)
  }

  const token = randomUUID()
  pendingDocuments.set(token, {
    html,
    expiresAt: Date.now() + documentLifetimeMs
  })
  return `${sandboxDocumentOrigin}/${token}`
}

export function registerSandboxDocumentProtocol(): void {
  protocol.handle(SANDBOX_DOCUMENT_SCHEME, (request) => {
    if (request.method !== 'GET') {
      return createErrorResponse('Method not allowed', 405)
    }

    const token = readDocumentToken(request.url)
    if (!token) {
      return createErrorResponse('Sandbox document not found', 404)
    }

    pruneExpiredDocuments()
    const document = pendingDocuments.get(token)
    if (!document) {
      return createErrorResponse('Sandbox document expired', 404)
    }

    return new Response(document.html, {
      status: 200,
      headers: {
        'Cache-Control': 'no-store',
        'Content-Type': 'text/html; charset=utf-8',
        'X-Content-Type-Options': 'nosniff'
      }
    })
  })
}

function readDocumentToken(requestUrl: string): string | null {
  try {
    const url = new URL(requestUrl)
    const token = url.pathname.slice(1)

    if (
      url.protocol !== `${SANDBOX_DOCUMENT_SCHEME}:` ||
      url.hostname !== 'document' ||
      url.username ||
      url.password ||
      url.port ||
      url.search ||
      url.hash ||
      !/^[0-9a-f-]{36}$/i.test(token)
    ) {
      return null
    }

    return token
  } catch {
    return null
  }
}

function pruneExpiredDocuments(): void {
  const now = Date.now()
  for (const [token, document] of pendingDocuments) {
    if (document.expiresAt <= now) {
      pendingDocuments.delete(token)
    }
  }
}

function createErrorResponse(message: string, status: number): Response {
  return new Response(message, {
    status,
    headers: {
      'Cache-Control': 'no-store',
      'Content-Type': 'text/plain; charset=utf-8',
      'X-Content-Type-Options': 'nosniff'
    }
  })
}
