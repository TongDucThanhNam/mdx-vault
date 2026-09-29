import { ArrowDown, ArrowUp, Plus, Trash2 } from 'lucide-react'
import type { RefObject } from 'react'

import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle
} from '@/components/ui/dialog'
import type {
  GraphConfigRecovery,
  GraphGroup,
  GraphViewSettings,
  GraphVisualToken,
  LocalGraphViewSettings
} from '../../../shared/graph'
import { MAX_GRAPH_GROUPS } from '../../../shared/graph'

interface GraphSettingsDialogProps {
  open: boolean
  mode: 'global' | 'local'
  settings: GraphViewSettings | LocalGraphViewSettings
  groups: GraphGroup[]
  recovery: GraphConfigRecovery | null
  isSaving: boolean
  error: string | null
  returnFocusRef: RefObject<HTMLElement | null>
  onOpenChange: (open: boolean) => void
  onSettingsChange: (patch: Partial<LocalGraphViewSettings>) => void
  onGroupsChange: (groups: GraphGroup[]) => void
  onReset: () => void
}

const VISUAL_TOKENS: readonly GraphVisualToken[] = [
  'slate',
  'blue',
  'red',
  'green',
  'gold',
  'violet',
  'cyan',
  'orange'
]

export function GraphSettingsDialog({
  open,
  mode,
  settings,
  groups,
  recovery,
  isSaving,
  error,
  returnFocusRef,
  onOpenChange,
  onSettingsChange,
  onGroupsChange,
  onReset
}: GraphSettingsDialogProps): React.JSX.Element {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        aria-describedby="graph-settings-description"
        className="max-h-[min(760px,calc(100vh-2rem))] max-w-2xl overflow-y-auto"
        onCloseAutoFocus={(event) => {
          event.preventDefault()
          window.setTimeout(() => returnFocusRef.current?.focus(), 0)
        }}
      >
        <DialogHeader>
          <DialogTitle>Graph settings</DialogTitle>
          <DialogDescription id="graph-settings-description">
            Vault-scoped filters, display, groups, and bounded CoSE layout forces.
          </DialogDescription>
        </DialogHeader>

        {recovery ? (
          <div className="border-2 border-editorial-gold bg-background p-3 font-mono text-xs">
            The existing <strong>{recovery.relativePath}</strong> is{' '}
            {recovery.kind === 'corrupt' ? 'corrupt' : 'from an unsupported version'} and was
            preserved. Defaults are active; settings cannot be persisted until the file is
            recovered.
          </div>
        ) : null}
        {error ? (
          <p role="alert" className="border-l-4 border-destructive pl-3 text-sm text-destructive">
            {error}
          </p>
        ) : null}

        <div className="grid gap-5 md:grid-cols-2">
          <fieldset className="space-y-3 border-2 border-foreground p-3">
            <legend className="px-1 font-mono text-xs font-bold uppercase tracking-wider">
              Topology
            </legend>
            <CheckSetting
              label="Existing files only"
              checked={settings.existingOnly}
              onChange={(existingOnly) => onSettingsChange({ existingOnly })}
            />
            <CheckSetting
              label="Show orphans"
              checked={settings.showOrphans}
              onChange={(showOrphans) => onSettingsChange({ showOrphans })}
            />
            {mode === 'local' && 'depth' in settings ? (
              <label className="grid gap-1 font-mono text-xs">
                <span className="font-bold">Depth</span>
                <select
                  value={settings.depth}
                  className="h-9 border-2 border-foreground bg-background px-2 outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50"
                  onChange={(event) =>
                    onSettingsChange({
                      depth: Number(event.currentTarget.value) as LocalGraphViewSettings['depth']
                    })
                  }
                >
                  {[1, 2, 3, 4].map((depth) => (
                    <option key={depth} value={depth}>
                      {depth} hop{depth === 1 ? '' : 's'}
                    </option>
                  ))}
                </select>
              </label>
            ) : null}
          </fieldset>

          <fieldset className="space-y-3 border-2 border-foreground p-3">
            <legend className="px-1 font-mono text-xs font-bold uppercase tracking-wider">
              Display
            </legend>
            <CheckSetting
              label="Directed arrows"
              checked={settings.arrows}
              onChange={(arrows) => onSettingsChange({ arrows })}
            />
            <RangeSetting
              label="Label fade"
              value={settings.labelFadeThreshold}
              min={0}
              max={1}
              step={0.05}
              onChange={(labelFadeThreshold) => onSettingsChange({ labelFadeThreshold })}
            />
            <RangeSetting
              label="Node size"
              value={settings.nodeSize}
              min={4}
              max={40}
              step={1}
              onChange={(nodeSize) => onSettingsChange({ nodeSize })}
            />
            <RangeSetting
              label="Link thickness"
              value={settings.linkThickness}
              min={0.5}
              max={6}
              step={0.25}
              onChange={(linkThickness) => onSettingsChange({ linkThickness })}
            />
          </fieldset>

          <fieldset className="space-y-3 border-2 border-foreground p-3 md:col-span-2">
            <legend className="px-1 font-mono text-xs font-bold uppercase tracking-wider">
              Layout forces
            </legend>
            <div className="grid gap-3 md:grid-cols-2">
              <RangeSetting
                label="Center"
                value={settings.centerForce}
                min={0}
                max={5}
                step={0.1}
                onChange={(centerForce) => onSettingsChange({ centerForce })}
              />
              <RangeSetting
                label="Repel"
                value={settings.repelForce}
                min={128}
                max={16_384}
                step={128}
                onChange={(repelForce) => onSettingsChange({ repelForce })}
              />
              <RangeSetting
                label="Link force"
                value={settings.linkForce}
                min={1}
                max={256}
                step={1}
                onChange={(linkForce) => onSettingsChange({ linkForce })}
              />
              <RangeSetting
                label="Link distance"
                value={settings.linkDistance}
                min={16}
                max={256}
                step={4}
                onChange={(linkDistance) => onSettingsChange({ linkDistance })}
              />
            </div>
          </fieldset>
        </div>

        <section aria-labelledby="graph-groups-title" className="space-y-3">
          <div className="flex items-end justify-between gap-3">
            <div>
              <h3 id="graph-groups-title" className="font-display text-lg font-black">
                Query groups
              </h3>
              <p className="font-mono text-xs uppercase tracking-wider text-muted-foreground">
                First match owns shape/color; every match remains in details.
              </p>
            </div>
            <Button
              type="button"
              variant="outline"
              size="sm"
              disabled={groups.length >= MAX_GRAPH_GROUPS}
              onClick={() => onGroupsChange([...groups, createGroup(groups.length)])}
            >
              <Plus aria-hidden="true" />
              Add group
            </Button>
          </div>

          {groups.length === 0 ? (
            <p className="border border-dashed border-foreground/50 p-3 font-mono text-xs text-muted-foreground">
              No groups. Nodes use status and orphan encodings.
            </p>
          ) : (
            <div className="space-y-2">
              {groups.map((group, index) => (
                <div
                  key={group.id}
                  className="grid gap-2 border-2 border-foreground p-3 sm:grid-cols-[minmax(0,1fr)_minmax(0,1.4fr)_7rem_auto]"
                >
                  <label className="grid gap-1 font-mono text-xs font-bold uppercase tracking-wider">
                    Label
                    <input
                      value={group.label}
                      maxLength={80}
                      className="h-9 min-w-0 border-2 border-foreground bg-background px-2 font-sans text-sm normal-case tracking-normal outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50"
                      onChange={(event) =>
                        onGroupsChange(
                          replaceGroup(groups, index, {
                            ...group,
                            label: event.currentTarget.value || `Group ${index + 1}`
                          })
                        )
                      }
                    />
                  </label>
                  <label className="grid gap-1 font-mono text-xs font-bold uppercase tracking-wider">
                    Search query
                    <input
                      value={group.query}
                      maxLength={300}
                      placeholder="tag:project"
                      className="h-9 min-w-0 border-2 border-foreground bg-background px-2 font-mono text-xs normal-case tracking-normal outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50"
                      onChange={(event) =>
                        onGroupsChange(
                          replaceGroup(groups, index, {
                            ...group,
                            query: event.currentTarget.value
                          })
                        )
                      }
                    />
                  </label>
                  <label className="grid gap-1 font-mono text-xs font-bold uppercase tracking-wider">
                    Token
                    <select
                      value={group.visualToken}
                      className="h-9 border-2 border-foreground bg-background px-2 text-xs normal-case tracking-normal outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50"
                      onChange={(event) =>
                        onGroupsChange(
                          replaceGroup(groups, index, {
                            ...group,
                            visualToken: event.currentTarget.value as GraphVisualToken
                          })
                        )
                      }
                    >
                      {VISUAL_TOKENS.map((token) => (
                        <option key={token} value={token}>
                          {token}
                        </option>
                      ))}
                    </select>
                  </label>
                  <div className="flex items-end gap-1">
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon-sm"
                      aria-label={`Move ${group.label} up`}
                      disabled={index === 0}
                      onClick={() => onGroupsChange(moveGroup(groups, index, index - 1))}
                    >
                      <ArrowUp aria-hidden="true" />
                    </Button>
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon-sm"
                      aria-label={`Move ${group.label} down`}
                      disabled={index === groups.length - 1}
                      onClick={() => onGroupsChange(moveGroup(groups, index, index + 1))}
                    >
                      <ArrowDown aria-hidden="true" />
                    </Button>
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon-sm"
                      aria-label={`Remove ${group.label}`}
                      onClick={() =>
                        onGroupsChange(groups.filter((candidate) => candidate.id !== group.id))
                      }
                    >
                      <Trash2 aria-hidden="true" />
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>

        <DialogFooter className="items-center justify-between sm:justify-between">
          <span className="font-mono text-xs uppercase tracking-wider text-muted-foreground">
            {isSaving ? 'Saving…' : recovery ? 'Defaults active' : 'Vault settings'}
          </span>
          <Button type="button" variant="outline" onClick={onReset}>
            Reset {mode} settings
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

function CheckSetting({
  label,
  checked,
  onChange
}: {
  label: string
  checked: boolean
  onChange: (checked: boolean) => void
}): React.JSX.Element {
  return (
    <label className="flex items-center justify-between gap-3 font-mono text-xs">
      <span>{label}</span>
      <input
        type="checkbox"
        checked={checked}
        className="size-4 accent-foreground"
        onChange={(event) => onChange(event.currentTarget.checked)}
      />
    </label>
  )
}

function RangeSetting({
  label,
  value,
  min,
  max,
  step,
  onChange
}: {
  label: string
  value: number
  min: number
  max: number
  step: number
  onChange: (value: number) => void
}): React.JSX.Element {
  return (
    <label className="grid gap-1 font-mono text-xs">
      <span className="flex justify-between gap-3">
        <span className="font-bold">{label}</span>
        <output>{value}</output>
      </span>
      <input
        type="range"
        value={value}
        min={min}
        max={max}
        step={step}
        onChange={(event) => onChange(Number(event.currentTarget.value))}
      />
    </label>
  )
}

function createGroup(index: number): GraphGroup {
  return {
    id: `group-${crypto.randomUUID()}`,
    label: `Group ${index + 1}`,
    query: '',
    visualToken: VISUAL_TOKENS[index % VISUAL_TOKENS.length]
  }
}

function replaceGroup(groups: GraphGroup[], index: number, group: GraphGroup): GraphGroup[] {
  return groups.map((candidate, candidateIndex) => (candidateIndex === index ? group : candidate))
}

function moveGroup(groups: GraphGroup[], from: number, to: number): GraphGroup[] {
  if (to < 0 || to >= groups.length) return groups
  const next = [...groups]
  const [group] = next.splice(from, 1)
  if (!group) return groups
  next.splice(to, 0, group)
  return next
}
