import { FilePlus } from 'lucide-react'
import type { KeyboardEvent } from 'react'
import { useEffect, useMemo, useRef, useState } from 'react'

import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle
} from '@/components/ui/dialog'
import type { NoteTemplate } from '@/vault/types'

interface CreateNoteDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  onCreate: (relativePath: string, content: string) => Promise<void>
}

const RESERVED_NAMES = /^(CON|PRN|AUX|NUL|COM[1-9]|LPT[1-9])$/i

export function CreateNoteDialog({
  open,
  onOpenChange,
  onCreate
}: CreateNoteDialogProps): React.JSX.Element {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        {/* The form only mounts when the dialog is open, so its local state
            (name, error) naturally resets each time the dialog is reopened. */}
        {open ? <CreateNoteForm onOpenChange={onOpenChange} onCreate={onCreate} /> : null}
      </DialogContent>
    </Dialog>
  )
}

function CreateNoteForm({
  onOpenChange,
  onCreate
}: {
  onOpenChange: (open: boolean) => void
  onCreate: (relativePath: string, content: string) => Promise<void>
}): React.JSX.Element {
  const [name, setName] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [templates, setTemplates] = useState<NoteTemplate[]>([])
  const [templatesError, setTemplatesError] = useState<string | null>(null)
  const [selectedTemplatePath, setSelectedTemplatePath] = useState('')
  const [isCreating, setIsCreating] = useState(false)
  const inputRef = useRef<HTMLInputElement | null>(null)

  // Autofocus the title input on mount. setTimeout avoids a focus race with
  // the dialog's own mount animation.
  useEffect(() => {
    const timer = window.setTimeout(() => inputRef.current?.focus(), 0)
    return () => {
      window.clearTimeout(timer)
    }
  }, [])

  useEffect(() => {
    let cancelled = false

    void window.vaultApi
      .listTemplates()
      .then((nextTemplates) => {
        if (cancelled) {
          return
        }
        setTemplates(nextTemplates)
        setTemplatesError(null)
      })
      .catch((loadError: unknown) => {
        if (cancelled) {
          return
        }
        setTemplates([])
        setTemplatesError(formatError(loadError))
      })

    return () => {
      cancelled = true
    }
  }, [])

  const trimmedName = name.trim()
  const validation = useMemo(() => validateNoteName(trimmedName), [trimmedName])

  const submit = async (): Promise<void> => {
    if (!validation.ok) {
      setError(validation.error)
      return
    }

    setError(null)
    setIsCreating(true)

    try {
      const content = selectedTemplatePath
        ? await window.vaultApi.renderTemplate(selectedTemplatePath, validation.baseTitle)
        : buildNoteScaffold(validation.baseTitle)

      await onCreate(validation.relativePath, content)
      onOpenChange(false)
    } catch (createError) {
      setError(formatError(createError))
    } finally {
      setIsCreating(false)
    }
  }

  const handleKeyDown = (event: KeyboardEvent<HTMLInputElement>): void => {
    if (event.key === 'Enter') {
      event.preventDefault()
      void submit()
    }
  }

  return (
    <>
      <DialogHeader>
        <DialogTitle className="flex items-center gap-2">
          <FilePlus className="size-4" aria-hidden="true" />
          New note
        </DialogTitle>
        <DialogDescription>
          Create a new MDX note in the vault root. You can move it later.
        </DialogDescription>
      </DialogHeader>

      <div className="flex flex-col gap-3">
        <div className="flex items-center gap-2">
          <input
            ref={inputRef}
            value={name}
            placeholder="Note title"
            aria-label="Note title"
            disabled={isCreating}
            className="flex h-9 w-full min-w-0 border-2 border-foreground bg-transparent px-3 py-1 font-mono text-sm transition-colors outline-none placeholder:text-muted-foreground focus-visible:ring-[3px] focus-visible:ring-ring/50 focus-visible:border-ring disabled:cursor-not-allowed disabled:opacity-50"
            onChange={(event) => {
              setName(event.target.value)
              setError(null)
            }}
            onKeyDown={handleKeyDown}
          />
          <span className="shrink-0 font-mono text-xs text-muted-foreground">.mdx</span>
        </div>
        {templates.length > 0 ? (
          <label className="flex flex-col gap-1.5">
            <span className="font-mono text-[11px] font-bold uppercase tracking-wider text-muted-foreground">
              Template
            </span>
            <select
              value={selectedTemplatePath}
              disabled={isCreating}
              className="h-9 w-full border-2 border-foreground bg-background px-2 font-mono text-sm outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50 focus-visible:border-ring disabled:cursor-not-allowed disabled:opacity-50"
              onChange={(event) => setSelectedTemplatePath(event.target.value)}
            >
              <option value="">Blank note</option>
              {templates.map((template) => (
                <option key={template.relativePath} value={template.relativePath}>
                  {template.name}
                </option>
              ))}
            </select>
          </label>
        ) : null}
        {error ? (
          <p className="font-mono text-xs text-destructive" role="alert">
            {error}
          </p>
        ) : templatesError ? (
          <p className="font-mono text-xs text-muted-foreground">
            Templates unavailable: {templatesError}
          </p>
        ) : validation.ok ? (
          <p className="truncate font-mono text-xs text-muted-foreground">
            Will create: {validation.relativePath}
          </p>
        ) : null}
      </div>

      <DialogFooter>
        <Button
          type="button"
          variant="outline"
          disabled={isCreating}
          onClick={() => onOpenChange(false)}
        >
          Cancel
        </Button>
        <Button type="button" disabled={!validation.ok || isCreating} onClick={() => void submit()}>
          {isCreating ? 'Creating' : 'Create note'}
        </Button>
      </DialogFooter>
    </>
  )
}

interface ValidationResult {
  ok: true
  baseTitle: string
  relativePath: string
}
interface ValidationFailure {
  ok: false
  error: string
}

function validateNoteName(rawName: string): ValidationResult | ValidationFailure {
  if (!rawName) {
    return { ok: false, error: 'Enter a note title.' }
  }

  // Reject anything that looks like an attempt to inject path structure or
  // traversal. The backend re-validates via safeJoin, but we want a friendly
  // error here instead of a raw IPC error.
  if (/[\\/]/.test(rawName)) {
    return { ok: false, error: 'Use a plain title — folders are not supported here yet.' }
  }

  const baseTitle = rawName.replace(/\.(md|mdx)$/i, '').trim()

  if (!baseTitle) {
    return { ok: false, error: 'Enter a note title.' }
  }

  if (RESERVED_NAMES.test(baseTitle)) {
    return { ok: false, error: 'That name is reserved by the OS.' }
  }

  // Strip characters that are illegal or hostile in filenames across OSes.
  // (Control characters 0x00-0x1f are checked via charCode to avoid a
  // control-character regex literal, which trips lint rules.)
  const sanitized = baseTitle
    .split('')
    .filter((char) => !isIllegalFilenameChar(char))
    .join('')
    .trim()

  if (!sanitized) {
    return { ok: false, error: 'The title contains only unsupported characters.' }
  }

  return { ok: true, baseTitle: sanitized, relativePath: `${sanitized}.mdx` }
}

function buildNoteScaffold(title: string): string {
  const today = new Date().toISOString().slice(0, 10)
  return `---\ntitle: ${title}\ncreated: ${today}\n---\n\n# ${title}\n\nStart writing...\n`
}

function formatError(error: unknown): string {
  if (error instanceof Error) {
    return error.message
  }
  return String(error)
}

const ILLEGAL_FILENAME_CHARS = new Set(['<', '>', ':', '"', '/', '\\', '|', '?', '*'])

function isIllegalFilenameChar(char: string): boolean {
  if (ILLEGAL_FILENAME_CHARS.has(char)) {
    return true
  }
  const code = char.charCodeAt(0)
  return code <= 0x1f // ASCII control characters
}
