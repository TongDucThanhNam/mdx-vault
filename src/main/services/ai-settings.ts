import { safeStorage } from 'electron'
import { mkdir, readFile, rename, writeFile } from 'fs/promises'
import { dirname } from 'path'

import {
  AI_PROTOCOL_VERSION,
  DEFAULT_AI_MODEL,
  type AiPublicSettings,
  type AiSaveSettingsInput,
  aiPublicSettingsSchema
} from '../../shared/ai'
import { safeJoin } from './safe-path'
import { VaultService } from './vault-service'

/* -------------------------------------------------------------------------- */
/*                                 Constants                                  */
/* -------------------------------------------------------------------------- */

const settingsRelativePath = '.app/ai-settings.bin'

/* -------------------------------------------------------------------------- */
/*                              Schema for blob                               */
/* -------------------------------------------------------------------------- */

interface PersistedSettingsBlob {
  version: 1
  provider: 'openai' | 'none'
  model: string
  /** Base64 of `safeStorage.encryptString(apiKey)`. Empty when no key. */
  encryptedApiKey: string
  baseUrl?: string
  updatedAt: string
}

interface ParsedPersistedSettings {
  provider: 'openai' | 'none'
  model: string
  baseUrl?: string
  apiKey: string | null
  updatedAt: string
}

/* -------------------------------------------------------------------------- */
/*                                Public API                                  */
/* -------------------------------------------------------------------------- */

export class AiSettingsService {
  constructor(private readonly vault: VaultService) {}

  isSafeStorageAvailable(): boolean {
    return safeStorage.isEncryptionAvailable()
  }

  async get(): Promise<AiPublicSettings> {
    const persisted = await readPersistedSettings(this.vault.rootPath)
    return {
      version: AI_PROTOCOL_VERSION,
      provider: persisted.provider,
      model: persisted.model,
      hasApiKey: persisted.apiKey !== null,
      safeStorageAvailable: this.isSafeStorageAvailable(),
      baseUrl: persisted.baseUrl,
      updatedAt: persisted.updatedAt
    }
  }

  /** Persists settings. Plain API key is encrypted in-place; we never log it,
   *  never return it to the renderer, and never persist it unencrypted. */
  async save(input: AiSaveSettingsInput): Promise<AiPublicSettings> {
    if (input.provider !== 'openai' && input.provider !== 'none') {
      throw new AiSettingsError('Invalid provider', 'AI_INVALID_CONFIG')
    }

    const current = await readPersistedSettings(this.vault.rootPath)
    const encryptedAvailable = this.isSafeStorageAvailable()

    let encryptedApiKey = ''
    let nextApiKey: string | null = current.apiKey

    if (input.clearApiKey === true) {
      nextApiKey = null
      encryptedApiKey = ''
    } else if (typeof input.apiKey === 'string' && input.apiKey.length > 0) {
      if (!encryptedAvailable) {
        throw new AiSettingsError(
          'safeStorage is not available on this system; cannot persist the API key. Set it later from a host with a keychain.',
          'AI_INVALID_CONFIG'
        )
      }
      encryptedApiKey = safeStorage.encryptString(input.apiKey).toString('base64')
      nextApiKey = input.apiKey
    } else {
      encryptedApiKey = current.provider === input.provider ? '' : ''
    }

    const blob: PersistedSettingsBlob = {
      version: 1,
      provider: input.provider,
      model: input.model.trim() || DEFAULT_AI_MODEL,
      encryptedApiKey,
      ...(input.baseUrl
        ? { baseUrl: input.baseUrl }
        : current.baseUrl
          ? { baseUrl: current.baseUrl }
          : {}),
      updatedAt: new Date().toISOString()
    }

    await writePersistedSettings(this.vault.rootPath, blob)

    return {
      version: AI_PROTOCOL_VERSION,
      provider: blob.provider,
      model: blob.model,
      hasApiKey: nextApiKey !== null,
      safeStorageAvailable: encryptedAvailable,
      ...(blob.baseUrl ? { baseUrl: blob.baseUrl } : {}),
      updatedAt: blob.updatedAt
    }
  }

  async loadRuntimeKey(): Promise<string | null> {
    const persisted = await readPersistedSettings(this.vault.rootPath)
    return persisted.apiKey
  }

  async clearApiKey(): Promise<AiPublicSettings> {
    return this.save({
      provider: 'openai',
      model: persistedSettingsFallbackModel(),
      clearApiKey: true
    })
  }
}

/* -------------------------------------------------------------------------- */
/*                                   Errors                                   */
/* -------------------------------------------------------------------------- */

export class AiSettingsError extends Error {
  readonly code: string

  constructor(message: string, code = 'AI_INVALID_CONFIG') {
    super(message)
    this.name = 'AiSettingsError'
    this.code = code
  }
}

/* -------------------------------------------------------------------------- */
/*                                  Helpers                                   */
/* -------------------------------------------------------------------------- */

async function readPersistedSettings(vaultRoot: string): Promise<ParsedPersistedSettings> {
  const target = safeJoin(vaultRoot, settingsRelativePath)

  try {
    const raw = await readFile(target, 'utf8')
    const parsed = JSON.parse(raw) as Partial<PersistedSettingsBlob>
    const apiKey = decodeApiKey(parsed.encryptedApiKey)
    const provider: 'openai' | 'none' = parsed.provider === 'openai' ? 'openai' : 'none'

    return {
      provider,
      model:
        typeof parsed.model === 'string' && parsed.model.trim() ? parsed.model : DEFAULT_AI_MODEL,
      apiKey,
      ...(typeof parsed.baseUrl === 'string' && parsed.baseUrl ? { baseUrl: parsed.baseUrl } : {}),
      updatedAt: typeof parsed.updatedAt === 'string' ? parsed.updatedAt : ''
    }
  } catch (error) {
    if (isNotFoundError(error)) {
      return {
        provider: 'none',
        model: DEFAULT_AI_MODEL,
        apiKey: null,
        updatedAt: ''
      }
    }

    if (error instanceof SyntaxError) {
      return {
        provider: 'none',
        model: DEFAULT_AI_MODEL,
        apiKey: null,
        updatedAt: ''
      }
    }

    throw error
  }
}

async function writePersistedSettings(
  vaultRoot: string,
  blob: PersistedSettingsBlob
): Promise<void> {
  const target = safeJoin(vaultRoot, settingsRelativePath)
  const tempPath = `${target}.tmp-${process.pid}-${Date.now()}`
  const serialized = `${JSON.stringify(blob, null, 2)}\n`

  await mkdir(dirname(target), { recursive: true })
  await writeFile(tempPath, serialized, 'utf8')
  await rename(tempPath, target)
}

function decodeApiKey(encryptedApiKey: unknown): string | null {
  if (typeof encryptedApiKey !== 'string' || encryptedApiKey.length === 0) {
    return null
  }

  try {
    const buffer = Buffer.from(encryptedApiKey, 'base64')
    const decrypted = safeStorage.decryptString(buffer)
    return decrypted.length > 0 ? decrypted : null
  } catch {
    return null
  }
}

function persistedSettingsFallbackModel(): string {
  return DEFAULT_AI_MODEL
}

function isNotFoundError(error: unknown): boolean {
  return (
    typeof error === 'object' &&
    error !== null &&
    'code' in error &&
    (error as { code?: unknown }).code === 'ENOENT'
  )
}

/** Validate at the boundary to catch malformed blobs from older versions. */
export function parseAiPublicSettings(value: unknown): AiPublicSettings {
  return aiPublicSettingsSchema.parse(value)
}
