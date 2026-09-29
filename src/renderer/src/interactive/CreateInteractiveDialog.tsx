import { Blocks, ShieldCheck } from 'lucide-react'
import { type FormEvent, useEffect, useMemo, useRef, useState } from 'react'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle
} from '@/components/ui/dialog'
import type { InteractiveCreateForm } from '@/interactive/interactive-authoring-controller'
import { cn } from '@/lib/utils'
import {
  deriveInteractiveSlug,
  type InteractiveStarter,
  interactiveDisplayNameSchema,
  interactiveSlugSchema,
  interactiveStarterSchema
} from '../../../shared/interactive-authoring'

interface CreateInteractiveDialogProps {
  open: boolean
  isCreating: boolean
  onOpenChange: (open: boolean) => void
  onCreate: (form: InteractiveCreateForm) => Promise<void>
}

export function CreateInteractiveDialog({
  open,
  isCreating,
  onOpenChange,
  onCreate
}: CreateInteractiveDialogProps): React.JSX.Element {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-xl">
        {open ? (
          <CreateInteractiveForm
            isCreating={isCreating}
            onOpenChange={onOpenChange}
            onCreate={onCreate}
          />
        ) : null}
      </DialogContent>
    </Dialog>
  )
}

function CreateInteractiveForm({
  isCreating,
  onOpenChange,
  onCreate
}: Omit<CreateInteractiveDialogProps, 'open'>): React.JSX.Element {
  const [displayName, setDisplayName] = useState('')
  const [slug, setSlug] = useState('')
  const [slugWasEdited, setSlugWasEdited] = useState(false)
  const [starter, setStarter] = useState<InteractiveStarter>('blank')
  const [error, setError] = useState<string | null>(null)
  const displayNameRef = useRef<HTMLInputElement | null>(null)

  useEffect(() => {
    const timer = window.setTimeout(() => displayNameRef.current?.focus(), 0)
    return () => window.clearTimeout(timer)
  }, [])

  const validation = useMemo(() => {
    const displayNameResult = interactiveDisplayNameSchema.safeParse(displayName)
    if (!displayNameResult.success) {
      return { ok: false as const, error: displayNameResult.error.issues[0]?.message }
    }

    const slugResult = interactiveSlugSchema.safeParse(slug)
    if (!slugResult.success) {
      return { ok: false as const, error: slugResult.error.issues[0]?.message }
    }

    const starterResult = interactiveStarterSchema.safeParse(starter)
    if (!starterResult.success) {
      return { ok: false as const, error: 'Choose a starter.' }
    }

    return {
      ok: true as const,
      form: {
        displayName: displayNameResult.data,
        slug: slugResult.data,
        starter: starterResult.data
      }
    }
  }, [displayName, slug, starter])

  const submit = async (event: FormEvent<HTMLFormElement>): Promise<void> => {
    event.preventDefault()
    if (!validation.ok) {
      setError(validation.error ?? 'Review the interactive details.')
      return
    }

    setError(null)
    try {
      await onCreate(validation.form)
      onOpenChange(false)
    } catch (createError) {
      setError(createError instanceof Error ? createError.message : String(createError))
    }
  }

  return (
    <form onSubmit={(event) => void submit(event)}>
      <DialogHeader>
        <DialogTitle className="flex items-center gap-2">
          <Blocks className="size-5" aria-hidden="true" />
          New interactive
        </DialogTitle>
        <DialogDescription>
          Scaffold a reviewed React island and insert it at the captured caret.
        </DialogDescription>
      </DialogHeader>

      <div className="mt-5 grid gap-4">
        <label className="grid gap-1.5" htmlFor="interactive-display-name">
          <span className="font-mono text-xs font-bold uppercase tracking-wider text-muted-foreground">
            Display name
          </span>
          <input
            ref={displayNameRef}
            id="interactive-display-name"
            name="interactive-display-name"
            autoComplete="off"
            disabled={isCreating}
            value={displayName}
            aria-describedby="interactive-destination"
            className="h-9 w-full border-2 border-foreground bg-background px-3 font-mono text-sm outline-none transition-colors placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50 motion-reduce:transition-none disabled:cursor-not-allowed disabled:opacity-50"
            placeholder="Reading timer"
            onChange={(event) => {
              const nextName = event.target.value
              setDisplayName(nextName)
              if (!slugWasEdited) {
                setSlug(deriveInteractiveSlug(nextName))
              }
              setError(null)
            }}
          />
        </label>

        <label className="grid gap-1.5" htmlFor="interactive-slug">
          <span className="font-mono text-xs font-bold uppercase tracking-wider text-muted-foreground">
            Folder slug
          </span>
          <input
            id="interactive-slug"
            name="interactive-slug"
            autoComplete="off"
            spellCheck={false}
            disabled={isCreating}
            value={slug}
            className="h-9 w-full border-2 border-foreground bg-background px-3 font-mono text-sm outline-none transition-colors placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50 motion-reduce:transition-none disabled:cursor-not-allowed disabled:opacity-50"
            placeholder="reading-timer"
            onChange={(event) => {
              setSlugWasEdited(true)
              setSlug(event.target.value)
              setError(null)
            }}
          />
        </label>

        <fieldset className="grid gap-2">
          <legend className="font-mono text-xs font-bold uppercase tracking-wider text-muted-foreground">
            Starter
          </legend>
          <div className="grid gap-2 sm:grid-cols-2">
            <StarterOption
              value="blank"
              selected={starter === 'blank'}
              disabled={isCreating}
              title="Blank"
              description="A focused component shell with typed props."
              onSelect={setStarter}
            />
            <StarterOption
              value="stateful-control"
              selected={starter === 'stateful-control'}
              disabled={isCreating}
              title="Stateful control"
              description="A small counter demonstrating local React state."
              onSelect={setStarter}
            />
          </div>
        </fieldset>

        <div
          id="interactive-destination"
          className="border-l-4 border-editorial-blue bg-muted px-3 py-2"
        >
          <p className="font-mono text-xs font-bold uppercase tracking-wider text-muted-foreground">
            Destination
          </p>
          <p className="mt-1 truncate font-mono text-xs text-foreground">
            interactives/{slug || '…'}/
          </p>
        </div>

        <div className="flex gap-2 border-2 border-foreground bg-background p-3">
          <ShieldCheck className="mt-0.5 size-4 shrink-0 text-success" aria-hidden="true" />
          <p className="font-mono text-xs leading-relaxed text-muted-foreground">
            The starter requests zero capabilities. Its source opens for review; execution still
            requires explicit Run consent in the sandbox.
          </p>
        </div>

        {error ? (
          <p className="font-mono text-xs text-destructive" role="alert">
            {error}
          </p>
        ) : null}
      </div>

      <DialogFooter className="mt-5">
        <Button
          type="button"
          variant="outline"
          disabled={isCreating}
          onClick={() => onOpenChange(false)}
        >
          Cancel
        </Button>
        <Button type="submit" disabled={!validation.ok || isCreating}>
          {isCreating ? 'Creating…' : 'Create interactive'}
        </Button>
      </DialogFooter>
    </form>
  )
}

function StarterOption({
  value,
  selected,
  disabled,
  title,
  description,
  onSelect
}: {
  value: InteractiveStarter
  selected: boolean
  disabled: boolean
  title: string
  description: string
  onSelect: (starter: InteractiveStarter) => void
}): React.JSX.Element {
  return (
    <label
      className={cn(
        'grid min-h-24 cursor-pointer content-start gap-1 border-2 p-3 transition-[color,background-color,border-color] motion-reduce:transition-none',
        selected
          ? 'border-foreground bg-foreground text-background'
          : 'border-border bg-background hover:border-foreground',
        disabled && 'cursor-not-allowed opacity-50'
      )}
    >
      <input
        className="sr-only"
        type="radio"
        name="interactive-starter"
        value={value}
        checked={selected}
        disabled={disabled}
        onChange={() => onSelect(value)}
      />
      <span className="font-display text-sm font-black">{title}</span>
      <span
        className={cn(
          'font-mono text-xs leading-relaxed',
          selected ? 'text-background/75' : 'text-muted-foreground'
        )}
      >
        {description}
      </span>
    </label>
  )
}
