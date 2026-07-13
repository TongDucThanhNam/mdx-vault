import { AlertTriangle } from 'lucide-react'

import { SandboxHost } from './SandboxHost'

interface InteractiveProps {
  src?: unknown
  children?: React.ReactNode
  [key: string]: unknown
}

type SerializableValue =
  | null
  | string
  | number
  | boolean
  | SerializableValue[]
  | { [key: string]: SerializableValue }

export function Interactive(props: InteractiveProps): React.JSX.Element {
  const { src } = props
  const rawProps = Object.fromEntries(
    Object.entries(props).filter(([key]) => key !== 'src' && key !== 'children')
  )

  if (typeof src !== 'string' || !src.trim()) {
    return <SandboxPropError message="Interactive requires a non-empty string src." />
  }

  const propsResult = toSerializableProps(rawProps)

  if (!propsResult.ok) {
    return <SandboxPropError message={propsResult.message} />
  }

  return <SandboxHost kind="interactive" src={src} sandboxProps={propsResult.props} />
}

function toSerializableProps(
  value: Record<string, unknown>
): { ok: true; props: Record<string, SerializableValue> } | { ok: false; message: string } {
  const props: Record<string, SerializableValue> = {}

  for (const [key, propValue] of Object.entries(value)) {
    if (propValue === undefined) {
      continue
    }

    const result = toSerializableValue(propValue)

    if (!result.ok) {
      return {
        ok: false,
        message: `Prop "${key}" must be JSON-serializable.`
      }
    }

    props[key] = result.value
  }

  return {
    ok: true,
    props
  }
}

function toSerializableValue(
  value: unknown
): { ok: true; value: SerializableValue } | { ok: false } {
  if (
    value === null ||
    typeof value === 'string' ||
    typeof value === 'boolean' ||
    (typeof value === 'number' && Number.isFinite(value))
  ) {
    return {
      ok: true,
      value
    }
  }

  if (Array.isArray(value)) {
    const items: SerializableValue[] = []

    for (const item of value) {
      const result = toSerializableValue(item)

      if (!result.ok) {
        return {
          ok: false
        }
      }

      items.push(result.value)
    }

    return {
      ok: true,
      value: items
    }
  }

  if (isPlainObject(value)) {
    const output: Record<string, SerializableValue> = {}

    for (const [key, nestedValue] of Object.entries(value)) {
      if (nestedValue === undefined) {
        continue
      }

      const result = toSerializableValue(nestedValue)

      if (!result.ok) {
        return {
          ok: false
        }
      }

      output[key] = result.value
    }

    return {
      ok: true,
      value: output
    }
  }

  return {
    ok: false
  }
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return false
  }

  const prototype = Object.getPrototypeOf(value)
  return prototype === Object.prototype || prototype === null
}

function SandboxPropError({ message }: { message: string }): React.JSX.Element {
  return (
    <div className="my-5 border-2 border-destructive bg-destructive/10 p-4 text-sm text-destructive shadow-[3px_3px_0_0_var(--destructive)]">
      <div className="flex items-center gap-2 font-mono text-[11px] font-bold uppercase tracking-wider">
        <AlertTriangle className="size-4" aria-hidden="true" />
        Sandbox props error
      </div>
      <div className="mt-2">{message}</div>
    </div>
  )
}
