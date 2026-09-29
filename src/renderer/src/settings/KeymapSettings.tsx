import { Keyboard, Plus, RotateCcw, Trash2, X } from 'lucide-react'
import { useLayoutEffect, useMemo, useState } from 'react'
import {
  AlertDialog,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle
} from '@/components/ui/alert-dialog'
import { Button } from '@/components/ui/button'
import type { AppSettingsController } from '@/hooks/useAppSettings'
import { cn } from '@/lib/utils'
import { APP_SETTINGS_CATALOG } from '../../../shared/app-settings'
import {
  assignKeyBinding,
  formatKeyBinding,
  getEffectiveBindings,
  type KeyBindingConflict,
  type KeymapOverrides,
  keyBindingFromEvent,
  removeKeyBinding,
  resetKeymapOverride,
  unbindAction,
  validateUserKeyBinding
} from '../../../shared/keybindings'
import {
  type KeybindingPlatform,
  WORKSPACE_ACTION_DEFINITIONS,
  type WorkspaceActionDefinition,
  type WorkspaceActionId
} from '../../../shared/workspace-actions'
import { isKeyRecorderCapturing } from './key-recorder-state'
import { actionMatchesKeymapQuery } from './keymap-search'
import { SettingsPage } from './SettingsLayout'

interface KeymapSettingsProps {
  controller: AppSettingsController
  query: string
  platform: KeybindingPlatform
  onRecorderChange?: (active: boolean) => void
}

interface RecorderState {
  actionId: WorkspaceActionId
  candidate: string | null
  conflicts: readonly KeyBindingConflict[]
  message: string | null
}

export function KeymapSettings({
  controller,
  query,
  platform,
  onRecorderChange
}: KeymapSettingsProps): React.JSX.Element {
  const [recorder, setRecorder] = useState<RecorderState | null>(null)
  const recorderCapturing = isKeyRecorderCapturing(recorder)
  const snapshot = controller.snapshot
  const overrides = snapshot?.keymapOverrides ?? {}
  const normalizedQuery = query.trim().toLocaleLowerCase()
  const visibleActions = useMemo(
    () =>
      WORKSPACE_ACTION_DEFINITIONS.filter((action) =>
        actionMatchesKeymapQuery(action, normalizedQuery, platform, overrides)
      ),
    [normalizedQuery, overrides, platform]
  )

  useLayoutEffect(() => {
    onRecorderChange?.(recorderCapturing)
    return () => {
      if (recorderCapturing) {
        onRecorderChange?.(false)
      }
    }
  }, [onRecorderChange, recorderCapturing])

  const persistOverrides = async (next: KeymapOverrides): Promise<boolean> => {
    const confirmed = await controller.updateSettings({
      keymapOverrides: materializeKeymapOverrides(next)
    })
    return confirmed !== null
  }

  const handleRemove = async (actionId: WorkspaceActionId, binding: string): Promise<void> => {
    await persistOverrides(removeKeyBinding(overrides, actionId, binding, platform))
  }

  const handleUnbind = async (actionId: WorkspaceActionId): Promise<void> => {
    await persistOverrides(unbindAction(overrides, actionId))
  }

  const handleReset = async (actionId: WorkspaceActionId): Promise<void> => {
    await persistOverrides(resetKeymapOverride(overrides, actionId))
  }

  const handleRecorderKeyDown = (event: React.KeyboardEvent<HTMLDivElement>): void => {
    if (!recorder) {
      return
    }

    if (event.key === 'Escape') {
      event.preventDefault()
      event.stopPropagation()
      setRecorder(null)
      return
    }
    if (recorder.conflicts.length > 0) {
      return
    }

    event.preventDefault()
    event.stopPropagation()

    if (event.repeat) {
      return
    }
    if (event.nativeEvent.isComposing) {
      setRecorder((current) =>
        current ? { ...current, message: 'Finish text composition, then press one chord.' } : null
      )
      return
    }

    const candidate = keyBindingFromEvent(event, platform)
    if (!candidate) {
      setRecorder((current) =>
        current ? { ...current, message: 'Include a non-modifier key in the chord.' } : null
      )
      return
    }

    const validation = validateUserKeyBinding(candidate, platform, recorder.actionId)
    if (!validation.ok) {
      setRecorder((current) =>
        current ? { ...current, candidate: null, conflicts: [], message: validation.message } : null
      )
      return
    }

    const assignment = assignKeyBinding(overrides, recorder.actionId, validation.binding, platform)
    if (!assignment.ok) {
      setRecorder((current) =>
        current
          ? {
              ...current,
              candidate: validation.binding,
              conflicts: assignment.conflicts,
              message: assignment.message
            }
          : null
      )
      return
    }

    void persistOverrides(assignment.overrides).then((saved) => {
      if (saved) {
        setRecorder(null)
      } else {
        setRecorder((current) =>
          current
            ? { ...current, message: 'The chord was not saved. The persisted keymap is shown.' }
            : null
        )
      }
    })
  }

  const handleReplaceConflict = async (): Promise<void> => {
    if (!recorder?.candidate) {
      return
    }

    const assignment = assignKeyBinding(
      overrides,
      recorder.actionId,
      recorder.candidate,
      platform,
      { replaceConflicts: true }
    )
    if (!assignment.ok) {
      setRecorder((current) =>
        current
          ? { ...current, message: assignment.message, conflicts: assignment.conflicts }
          : null
      )
      return
    }

    if (await persistOverrides(assignment.overrides)) {
      setRecorder(null)
    } else {
      setRecorder((current) =>
        current
          ? {
              ...current,
              candidate: null,
              conflicts: [],
              message: 'The replacement was not saved. The persisted keymap is shown.'
            }
          : null
      )
    }
  }

  return (
    <SettingsPage
      eyebrow="Exact chords"
      title="Keymap"
      description={`${APP_SETTINGS_CATALOG.keymapOverrides.description} Displayed chords are the exact platform bindings the workbench resolves.`}
    >
      <div className="flex flex-wrap items-baseline justify-between gap-3 border-b-2 border-foreground pb-3">
        <div>
          <div className="font-mono text-xs font-bold uppercase tracking-[0.14em]">
            Command ledger
          </div>
          <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
            {visibleActions.length} of {WORKSPACE_ACTION_DEFINITIONS.length} actions
          </p>
        </div>
        <div className="font-mono text-xs uppercase tracking-wider text-muted-foreground">
          {platform === 'darwin' ? 'macOS' : platform === 'win32' ? 'Windows' : 'Linux'} key labels
        </div>
      </div>

      {snapshot ? (
        visibleActions.length > 0 ? (
          <ul className="divide-y divide-line border-y border-line" aria-label="Key bindings">
            {visibleActions.map((action) => (
              <KeymapRow
                key={action.id}
                action={action}
                platform={platform}
                overrides={overrides}
                disabled={controller.isPending}
                onAdd={() =>
                  setRecorder({
                    actionId: action.id,
                    candidate: null,
                    conflicts: [],
                    message: null
                  })
                }
                onRemove={(binding) => void handleRemove(action.id, binding)}
                onReset={() => void handleReset(action.id)}
                onUnbind={() => void handleUnbind(action.id)}
              />
            ))}
          </ul>
        ) : (
          <div className="border-2 border-foreground bg-card p-5">
            <div className="flex items-center gap-2 font-mono text-xs font-bold uppercase tracking-wider">
              <Keyboard className="size-4 text-muted-foreground" aria-hidden="true" />
              No matching commands
            </div>
            <p className="mt-2 max-w-prose text-xs leading-relaxed text-muted-foreground">
              Try an action name, category, description, action ID, or key such as Ctrl+P.
            </p>
          </div>
        )
      ) : (
        <div className="border-2 border-foreground bg-card p-4 font-mono text-xs text-muted-foreground">
          Loading the confirmed keymap…
        </div>
      )}

      <AlertDialog open={recorder !== null} onOpenChange={(open) => !open && setRecorder(null)}>
        <AlertDialogContent
          data-key-recorder={recorderCapturing ? 'true' : undefined}
          onKeyDownCapture={handleRecorderKeyDown}
        >
          <AlertDialogHeader>
            <div className="font-mono text-xs font-bold uppercase tracking-[0.18em] text-editorial-red">
              Key recorder
            </div>
            <AlertDialogTitle>
              {recorder?.conflicts.length ? 'Replace this binding?' : 'Press one chord'}
            </AlertDialogTitle>
            <AlertDialogDescription className="leading-relaxed">
              {recorder ? (
                <>
                  Assign a key to{' '}
                  <strong className="text-foreground">
                    {definitionFor(recorder.actionId)?.title ?? recorder.actionId}
                  </strong>
                  . Escape cancels.
                </>
              ) : null}
            </AlertDialogDescription>
          </AlertDialogHeader>

          {recorder?.conflicts.length ? (
            <div className="border-l-4 border-destructive bg-destructive/10 px-4 py-3">
              <div className="font-mono text-xs font-bold uppercase tracking-wider text-destructive">
                {displayBinding(recorder.candidate, platform)} is already assigned
              </div>
              <p className="mt-2 text-sm leading-relaxed">
                Replacing it will remove this chord from{' '}
                {recorder.conflicts.map((conflict) => conflict.title).join(', ')} and assign it to{' '}
                {definitionFor(recorder.actionId)?.title ?? recorder.actionId}.
              </p>
            </div>
          ) : (
            <div
              className="border-2 border-foreground bg-foreground px-4 py-6 text-center text-background shadow-[3px_3px_0_0_var(--editorial-red)]"
              aria-live="polite"
            >
              <Keyboard className="mx-auto size-5 text-background/70" aria-hidden="true" />
              <div className="mt-3 font-mono text-sm font-bold uppercase tracking-[0.12em]">
                Listening…
              </div>
              <div className="mt-1 font-mono text-xs uppercase tracking-wider text-background/70">
                Modifiers alone are not bindings
              </div>
            </div>
          )}

          {recorder?.message ? (
            <p
              className={cn(
                'border-l-2 px-3 py-2 font-mono text-xs leading-relaxed',
                recorder.conflicts.length
                  ? 'border-destructive text-destructive'
                  : 'border-editorial-red text-foreground'
              )}
              role="alert"
            >
              {recorder.message}
            </p>
          ) : null}

          <AlertDialogFooter>
            <AlertDialogCancel disabled={controller.isPending}>Cancel</AlertDialogCancel>
            {recorder?.conflicts.length ? (
              <Button
                type="button"
                disabled={controller.isPending}
                onClick={() => void handleReplaceConflict()}
              >
                {controller.isPending ? 'Saving…' : 'Replace binding'}
              </Button>
            ) : null}
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </SettingsPage>
  )
}

function KeymapRow({
  action,
  platform,
  overrides,
  disabled,
  onAdd,
  onRemove,
  onReset,
  onUnbind
}: {
  action: WorkspaceActionDefinition
  platform: KeybindingPlatform
  overrides: KeymapOverrides
  disabled: boolean
  onAdd: () => void
  onRemove: (binding: string) => void
  onReset: () => void
  onUnbind: () => void
}): React.JSX.Element {
  const bindings = getEffectiveBindings(action.id, platform, overrides)
  const customized = Object.hasOwn(overrides, action.id)

  return (
    <li className="group grid gap-3 bg-background py-4 sm:grid-cols-[minmax(0,1fr)_minmax(13rem,auto)] sm:items-start sm:gap-5">
      <div className="min-w-0 border-l-2 border-transparent pl-3 group-focus-within:border-editorial-red group-hover:border-foreground">
        <div className="flex flex-wrap items-baseline gap-x-2 gap-y-1">
          <h3 className="font-mono text-xs font-bold uppercase tracking-wider">{action.title}</h3>
          <span className="font-mono text-xs uppercase tracking-wider text-muted-foreground">
            {action.category} · {action.context}
          </span>
        </div>
        <p className="mt-1 max-w-prose text-xs leading-relaxed text-muted-foreground">
          {action.description}
        </p>
        <code className="mt-1 block truncate font-mono text-xs text-muted-foreground/80">
          {action.id}
        </code>
      </div>

      <div className="flex min-w-0 flex-col items-start gap-2 sm:items-end">
        <div className="flex flex-wrap gap-1.5 sm:justify-end">
          {bindings.length > 0 ? (
            bindings.map((binding) => (
              <span
                key={binding}
                className="inline-flex h-7 items-stretch border-2 border-foreground bg-card shadow-[2px_2px_0_0_var(--foreground)]"
              >
                <kbd className="inline-flex items-center px-2 font-mono text-xs font-bold whitespace-nowrap">
                  {displayBinding(binding, platform)}
                </kbd>
                <button
                  type="button"
                  className="inline-flex w-7 items-center justify-center border-l-2 border-foreground text-muted-foreground outline-none hover:bg-destructive hover:text-destructive-foreground focus-visible:bg-foreground focus-visible:text-background disabled:pointer-events-none disabled:opacity-40"
                  aria-label={`Remove ${displayBinding(binding, platform)} from ${action.title}`}
                  disabled={disabled}
                  onClick={() => onRemove(binding)}
                >
                  <X className="size-3" aria-hidden="true" />
                </button>
              </span>
            ))
          ) : (
            <span className="inline-flex h-7 items-center border-2 border-dashed border-line px-2 font-mono text-xs uppercase tracking-wider text-muted-foreground">
              Unbound
            </span>
          )}
        </div>
        <div className="flex flex-wrap gap-x-1 gap-y-1 sm:justify-end">
          <Button type="button" variant="ghost" size="xs" disabled={disabled} onClick={onAdd}>
            <Plus aria-hidden="true" /> Add binding
          </Button>
          {bindings.length > 0 ? (
            <Button type="button" variant="ghost" size="xs" disabled={disabled} onClick={onUnbind}>
              <Trash2 aria-hidden="true" /> Unbind
            </Button>
          ) : null}
          {customized ? (
            <Button type="button" variant="ghost" size="xs" disabled={disabled} onClick={onReset}>
              <RotateCcw aria-hidden="true" /> Reset
            </Button>
          ) : null}
        </div>
      </div>
    </li>
  )
}

function displayBinding(binding: string | null, platform: KeybindingPlatform): string {
  if (!binding) {
    return 'Unknown chord'
  }
  return formatKeyBinding(binding, platform) ?? binding
}

function materializeKeymapOverrides(overrides: KeymapOverrides): Record<string, string[]> {
  return Object.fromEntries(
    Object.entries(overrides).flatMap(([actionId, bindings]) =>
      bindings ? [[actionId, [...bindings]] as const] : []
    )
  )
}

function definitionFor(actionId: WorkspaceActionId): WorkspaceActionDefinition | undefined {
  return WORKSPACE_ACTION_DEFINITIONS.find((definition) => definition.id === actionId)
}
