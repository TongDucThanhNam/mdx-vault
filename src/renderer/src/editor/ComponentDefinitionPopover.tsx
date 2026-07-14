import { Braces, CircleAlert, X } from 'lucide-react'
import { useEffect, useRef } from 'react'

import { componentRegistry } from '@/preview/registry'
import type { ComponentRegistryEntry } from '@/preview/registry/types'

interface ComponentDefinitionPopoverProps {
  componentName: string
  position: { left: number; top: number }
  onClose: () => void
}

interface RegistryPropDetail {
  name: string
  type: string
  optional: boolean
}

interface ZodSchemaLike {
  type?: string
  shape?: Record<string, ZodSchemaLike>
  def?: ZodDefinitionLike
  _def?: ZodDefinitionLike
  isOptional?: () => boolean
}

interface ZodDefinitionLike {
  type?: string
  innerType?: ZodSchemaLike
  element?: ZodSchemaLike
  options?: ZodSchemaLike[]
  entries?: Record<string, unknown>
  values?: unknown[]
}

const registryByName = new Map(componentRegistry.map((entry) => [entry.name, entry]))

export function ComponentDefinitionPopover({
  componentName,
  position,
  onClose
}: ComponentDefinitionPopoverProps): React.JSX.Element {
  const popoverRef = useRef<HTMLDivElement | null>(null)
  const entry = registryByName.get(componentName)

  useEffect(() => {
    const handlePointerDown = (event: PointerEvent): void => {
      const popover = popoverRef.current
      if (popover && event.target instanceof Node && !popover.contains(event.target)) {
        onClose()
      }
    }
    const handleKeyDown = (event: KeyboardEvent): void => {
      if (event.key === 'Escape') {
        event.preventDefault()
        onClose()
      }
    }

    document.addEventListener('pointerdown', handlePointerDown)
    document.addEventListener('keydown', handleKeyDown)

    return () => {
      document.removeEventListener('pointerdown', handlePointerDown)
      document.removeEventListener('keydown', handleKeyDown)
    }
  }, [onClose])

  return (
    <div
      ref={popoverRef}
      role="dialog"
      aria-label={`${componentName} component definition`}
      className="absolute z-50 max-h-[min(28rem,calc(100%-1rem))] w-[min(22rem,calc(100%-1rem))] overflow-auto border-2 border-foreground bg-popover text-popover-foreground shadow-[4px_4px_0_0_var(--foreground)]"
      style={position}
    >
      {entry ? (
        <RegistryDefinition entry={entry} onClose={onClose} />
      ) : (
        <MissingRegistryDefinition componentName={componentName} onClose={onClose} />
      )}
    </div>
  )
}

function RegistryDefinition({
  entry,
  onClose
}: {
  entry: ComponentRegistryEntry
  onClose: () => void
}): React.JSX.Element {
  const props = getRegistryPropDetails(entry)

  return (
    <>
      <PopoverHeader eyebrow="Registry component" name={entry.name} onClose={onClose} />
      <div className="space-y-4 p-3">
        <div>
          <span className="inline-block border border-foreground bg-muted px-1.5 py-0.5 font-mono text-[9px] font-bold uppercase tracking-[0.14em]">
            {entry.category}
          </span>
          <p className="mt-2 text-sm leading-relaxed">{entry.description}</p>
        </div>

        <section aria-labelledby="component-props-heading">
          <h3
            id="component-props-heading"
            className="border-b-2 border-foreground pb-1 font-mono text-[10px] font-bold uppercase tracking-[0.16em]"
          >
            Props
          </h3>
          {props.length > 0 ? (
            <dl className="divide-y divide-[var(--line)] border-b border-[var(--line)]">
              {props.map((prop) => (
                <div key={prop.name} className="grid grid-cols-[minmax(0,1fr)_auto] gap-3 py-1.5">
                  <dt className="min-w-0 font-mono text-xs font-bold">{prop.name}</dt>
                  <dd className="text-right font-mono text-[10px] text-muted-foreground">
                    <span className="text-editorial-blue">{prop.type}</span>
                    <span className="ml-1.5 uppercase tracking-wider">
                      {prop.optional ? 'optional' : 'required'}
                    </span>
                  </dd>
                </div>
              ))}
            </dl>
          ) : (
            <p className="mt-2 text-xs text-muted-foreground">No declared props.</p>
          )}
        </section>

        {entry.insertSnippet ? (
          <section aria-labelledby="component-snippet-heading">
            <h3
              id="component-snippet-heading"
              className="font-mono text-[10px] font-bold uppercase tracking-[0.16em]"
            >
              Insert snippet
            </h3>
            <code className="mt-1.5 block overflow-x-auto border-2 border-foreground bg-foreground p-2 font-mono text-[11px] leading-relaxed whitespace-pre text-background">
              {entry.insertSnippet}
            </code>
          </section>
        ) : null}
      </div>
    </>
  )
}

function MissingRegistryDefinition({
  componentName,
  onClose
}: {
  componentName: string
  onClose: () => void
}): React.JSX.Element {
  return (
    <>
      <PopoverHeader eyebrow="Registry warning" name={componentName} onClose={onClose} warning />
      <div className="flex gap-3 p-3">
        <CircleAlert className="mt-0.5 size-5 shrink-0 text-destructive" aria-hidden="true" />
        <div>
          <p className="font-mono text-xs font-bold uppercase tracking-wider text-destructive">
            Not in registry
          </p>
          <p className="mt-1 text-sm leading-relaxed text-muted-foreground">
            Preview will show a placeholder warning until this component is registered.
          </p>
        </div>
      </div>
    </>
  )
}

function PopoverHeader({
  eyebrow,
  name,
  onClose,
  warning = false
}: {
  eyebrow: string
  name: string
  onClose: () => void
  warning?: boolean
}): React.JSX.Element {
  return (
    <div className="flex items-start gap-3 border-b-2 border-foreground bg-muted px-3 py-2">
      <Braces
        className={`mt-0.5 size-4 shrink-0 ${warning ? 'text-destructive' : 'text-editorial-blue'}`}
        aria-hidden="true"
      />
      <div className="min-w-0 flex-1">
        <p className="font-mono text-[9px] font-bold uppercase tracking-[0.18em] text-muted-foreground">
          {eyebrow}
        </p>
        <h2 className="truncate font-mono text-sm font-bold">{name}</h2>
      </div>
      <button
        type="button"
        aria-label="Close component definition"
        className="flex size-7 shrink-0 items-center justify-center border-2 border-foreground bg-background hover:bg-foreground hover:text-background focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--ring)]"
        onClick={onClose}
      >
        <X className="size-3.5" aria-hidden="true" />
      </button>
    </div>
  )
}

function getRegistryPropDetails(entry: ComponentRegistryEntry): RegistryPropDetail[] {
  const schema = entry.propsSchema as unknown as ZodSchemaLike
  const shape = schema.shape

  if (!shape) {
    return []
  }

  return Object.entries(shape).map(([name, propSchema]) => ({
    name,
    type: formatZodType(propSchema),
    optional: propSchema.isOptional?.() ?? false
  }))
}

function formatZodType(schema: ZodSchemaLike, seen = new Set<ZodSchemaLike>()): string {
  if (seen.has(schema)) {
    return 'unknown'
  }
  seen.add(schema)

  const definition = schema.def ?? schema._def
  const type = schema.type ?? definition?.type

  if (definition?.innerType) {
    return formatZodType(definition.innerType, seen)
  }
  if (type === 'array' && definition?.element) {
    return `${formatZodType(definition.element, seen)}[]`
  }
  if (type === 'union' && definition?.options) {
    return definition.options.map((option) => formatZodType(option, seen)).join(' | ')
  }
  if (type === 'enum' && definition?.entries) {
    return Object.values(definition.entries)
      .map((value) => JSON.stringify(value))
      .join(' | ')
  }
  if (type === 'literal' && definition?.values) {
    return definition.values.map((value) => JSON.stringify(value)).join(' | ')
  }

  return type ?? 'unknown'
}
