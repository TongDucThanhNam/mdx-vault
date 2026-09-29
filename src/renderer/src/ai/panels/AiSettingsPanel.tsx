/**
 * `AiSettingsPanel` — modal dialog for entering the API key and model.
 *
 * The key is sent over IPC exactly once (when the user clicks Save), is
 * encrypted with Electron `safeStorage` in the main process, and never
 * returned to the renderer in plaintext. The dialog reflects this by never
 * displaying the key after save and by clearing its local draft on close.
 */

import { Eye, EyeOff, KeyRound, ShieldAlert } from 'lucide-react'
import { useState } from 'react'
import {
  AlertDialog,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle
} from '@/components/ui/alert-dialog'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import type { AiPublicSettings, AiSaveSettingsInput } from '../../../../shared/ai'
import { type AiOpenAiModel, DEFAULT_AI_MODEL } from '../../../../shared/ai'
import { createAssistantRuntime } from '../assistant-client'

const MODELS: ReadonlyArray<{ value: AiOpenAiModel; label: string }> = [
  { value: 'gpt-4o-mini', label: 'GPT-4o mini — cheap, fast' },
  { value: 'gpt-4o', label: 'GPT-4o — high quality' },
  { value: 'gpt-4.1', label: 'GPT-4.1 — newer, strong' },
  { value: 'gpt-4.1-mini', label: 'GPT-4.1 mini — fast' },
  { value: 'o4-mini', label: 'o4-mini — reasoning' }
]

const runtime = createAssistantRuntime()

interface AiSettingsPanelProps {
  open: boolean
  settings: AiPublicSettings
  onClose: () => void
  onSaved: (next: AiPublicSettings) => void
}

export function AiSettingsPanel({
  open,
  settings,
  onClose,
  onSaved
}: AiSettingsPanelProps): React.JSX.Element {
  return (
    <AlertDialog open={open} onOpenChange={(next) => !next && onClose()}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>AI assistant</AlertDialogTitle>
          <AlertDialogDescription>
            Configure the model and your OpenAI API key. The key is encrypted with Electron
            <code className="mx-1 bg-muted px-1 py-0.5 text-xs">safeStorage</code>
            and never leaves the main process in plaintext.
          </AlertDialogDescription>
        </AlertDialogHeader>

        <AiSettingsForm settings={settings} onSaved={onSaved} onClose={onClose} />
      </AlertDialogContent>
    </AlertDialog>
  )
}

interface AiSettingsFormProps {
  settings: AiPublicSettings
  onSaved: (next: AiPublicSettings) => void
  onClose?: () => void
}

export function AiSettingsForm({
  settings,
  onSaved,
  onClose
}: AiSettingsFormProps): React.JSX.Element {
  // Local drafts disappear when the form unmounts, so plaintext key material
  // never becomes shared application state.
  const [model, setModel] = useState<AiOpenAiModel>(
    MODELS.find((entry) => entry.value === settings.model)?.value ?? DEFAULT_AI_MODEL
  )
  const [apiKeyDraft, setApiKeyDraft] = useState('')
  const [showKey, setShowKey] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const save = async (): Promise<void> => {
    if (!settings.safeStorageAvailable) {
      setError(
        'Electron safeStorage is not available on this system; refusing to save the API key.'
      )
      return
    }

    const trimmed = apiKeyDraft.trim()
    if (!trimmed && !settings.hasApiKey) {
      setError('Enter an API key, or close this dialog to use the assistant later.')
      return
    }

    setBusy(true)
    setError(null)

    const input: AiSaveSettingsInput = {
      provider: 'openai',
      model,
      ...(trimmed ? { apiKey: trimmed } : {}),
      ...(!trimmed && settings.hasApiKey ? { clearApiKey: false } : {})
    }

    try {
      const next = await runtime.saveSettings(input)
      onSaved(next)
      setApiKeyDraft('')
      setShowKey(false)
      onClose?.()
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : String(saveError))
    } finally {
      setBusy(false)
    }
  }

  const clearKey = async (): Promise<void> => {
    setBusy(true)
    setError(null)
    try {
      const next = await runtime.clearApiKey()
      onSaved(next)
      setApiKeyDraft('')
    } catch (clearError) {
      setError(clearError instanceof Error ? clearError.message : String(clearError))
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="grid gap-4">
      {!settings.safeStorageAvailable ? (
        <div className="flex items-start gap-2 border-2 border-destructive bg-destructive/10 px-3 py-2 font-mono text-xs uppercase tracking-wider text-destructive">
          <ShieldAlert className="mt-0.5 size-3.5 shrink-0" aria-hidden="true" />
          <div className="min-w-0">
            <div className="font-bold">safeStorage unavailable</div>
            <div>
              This OS does not provide a keychain/credential vault. Saving keys is disabled until it
              is. You can still review the assistant UI — sending a chat will not work.
            </div>
          </div>
        </div>
      ) : null}

      <div className="grid gap-3">
        <label className="grid gap-1.5 font-mono text-xs font-bold uppercase tracking-wider">
          Model
          <select
            value={model}
            onChange={(event) => setModel(event.target.value as AiOpenAiModel)}
            disabled={busy}
            className={cn(
              'h-9 border-2 border-foreground bg-background px-2 font-sans text-sm font-normal normal-case tracking-normal outline-none',
              'focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/40',
              'disabled:cursor-not-allowed disabled:opacity-60'
            )}
          >
            {MODELS.map((entry) => (
              <option key={entry.value} value={entry.value}>
                {entry.label}
              </option>
            ))}
          </select>
        </label>

        <label className="grid gap-1.5 font-mono text-xs font-bold uppercase tracking-wider">
          <span className="inline-flex items-center gap-1.5">
            <KeyRound className="size-3" aria-hidden="true" />
            OpenAI API key
          </span>
          <div className="relative">
            <input
              type={showKey ? 'text' : 'password'}
              value={apiKeyDraft}
              onChange={(event) => setApiKeyDraft(event.target.value)}
              disabled={busy || !settings.safeStorageAvailable}
              placeholder={settings.hasApiKey ? '••• stored •••' : 'sk-…'}
              autoComplete="off"
              spellCheck={false}
              className={cn(
                'h-9 w-full border-2 border-foreground bg-background px-2 pr-10 font-sans text-sm font-normal normal-case tracking-normal outline-none',
                'placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/40',
                'disabled:cursor-not-allowed disabled:opacity-60'
              )}
            />
            <button
              type="button"
              onClick={() => setShowKey((value) => !value)}
              disabled={!apiKeyDraft}
              className="absolute top-1/2 right-1.5 -translate-y-1/2 border border-transparent p-1 text-muted-foreground outline-none hover:border-foreground hover:bg-accent focus-visible:ring-[3px] focus-visible:ring-ring/40 disabled:opacity-0"
              aria-label={showKey ? 'Hide API key' : 'Show API key'}
              title={showKey ? 'Hide API key' : 'Show API key'}
            >
              {showKey ? (
                <EyeOff className="size-3.5" aria-hidden="true" />
              ) : (
                <Eye className="size-3.5" aria-hidden="true" />
              )}
            </button>
          </div>
          <span className="font-sans text-xs font-normal normal-case tracking-normal text-muted-foreground">
            {settings.hasApiKey
              ? 'A key is already stored. Type a new one to replace it.'
              : 'Key is sent to the main process, encrypted, and never returned in plaintext.'}
          </span>
        </label>

        {error ? (
          <div className="border-2 border-destructive bg-destructive/10 px-2.5 py-2 font-mono text-xs uppercase tracking-wider text-destructive">
            {error}
          </div>
        ) : null}
      </div>

      <AlertDialogFooter className="flex-wrap">
        {settings.hasApiKey ? (
          <Button type="button" variant="outline" onClick={() => void clearKey()} disabled={busy}>
            Clear stored key
          </Button>
        ) : null}
        {onClose ? (
          <Button type="button" variant="outline" onClick={onClose} disabled={busy}>
            Close
          </Button>
        ) : null}
        <Button type="button" onClick={() => void save()} disabled={busy}>
          {busy ? 'Saving' : 'Save AI settings'}
        </Button>
      </AlertDialogFooter>
    </div>
  )
}
