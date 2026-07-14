import { AlertTriangle, LockKeyhole, ShieldCheck } from 'lucide-react'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'

import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle
} from '@/components/ui/alert-dialog'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import {
  hostToSandboxMessageSchema,
  type SandboxDescriptor,
  type SandboxDocument,
  type SandboxKind,
  type SandboxManifest,
  type SandboxToHostMessage,
  sandboxToHostMessageSchema
} from '../../../../shared/sandbox'
import { usePreviewRuntime } from '../runtime'

const emptySandboxProps: Record<string, unknown> = {}

interface SandboxHostProps {
  kind: SandboxKind
  src: string
  sandboxProps?: Record<string, unknown>
  className?: string
}

type SandboxState =
  | {
      status: 'loading'
    }
  | {
      status: 'blocked'
      descriptor: SandboxDescriptor
      message: string
    }
  | {
      status: 'ready'
      descriptor: SandboxDescriptor
      document: SandboxDocument
    }
  | {
      status: 'error'
      title: string
      message: string
    }

export function SandboxHost({
  kind,
  src,
  sandboxProps,
  className
}: SandboxHostProps): React.JSX.Element {
  const { selectedPath } = usePreviewRuntime()
  const resolvedSandboxProps = sandboxProps ?? emptySandboxProps
  const iframeRef = useRef<HTMLIFrameElement | null>(null)
  const [state, setState] = useState<SandboxState>({ status: 'loading' })
  const [dialogDescriptor, setDialogDescriptor] = useState<SandboxDescriptor | null>(null)
  const [height, setHeight] = useState(220)
  const propsFingerprint = useMemo(
    () => stableStringify(resolvedSandboxProps),
    [resolvedSandboxProps]
  )

  const loadDocument = useCallback(
    async (descriptor: SandboxDescriptor): Promise<void> => {
      const instanceId = window.crypto.randomUUID()
      const document =
        kind === 'html'
          ? await window.sandboxApi.loadHtml(src, selectedPath, descriptor.contentHash, instanceId)
          : await window.sandboxApi.loadInteractive(
              src,
              selectedPath,
              descriptor.contentHash,
              instanceId,
              resolvedSandboxProps
            )

      setHeight(220)
      setState({
        status: 'ready',
        descriptor,
        document
      })
    },
    [kind, resolvedSandboxProps, selectedPath, src]
  )

  useEffect(() => {
    let cancelled = false

    async function prepareSandbox(): Promise<void> {
      setState({ status: 'loading' })

      try {
        const descriptor =
          kind === 'html'
            ? await window.sandboxApi.describeHtml(src, selectedPath)
            : await window.sandboxApi.describeInteractive(src, selectedPath)

        if (cancelled) {
          return
        }

        if (descriptor.permissionStatus === 'allowed') {
          await loadDocument(descriptor)
          return
        }

        const message =
          descriptor.permissionStatus === 'denied'
            ? 'Permission was denied for this content hash.'
            : 'Permission review is required before running this sandbox.'

        setState({
          status: 'blocked',
          descriptor,
          message
        })

        if (descriptor.permissionStatus === 'prompt') {
          setDialogDescriptor(descriptor)
        }
      } catch (error) {
        if (!cancelled) {
          setState({
            status: 'error',
            title: 'Sandbox unavailable',
            message: formatError(error)
          })
        }
      }
    }

    void prepareSandbox()

    return () => {
      cancelled = true
    }
  }, [kind, loadDocument, propsFingerprint, selectedPath, src])

  const postInit = useCallback(() => {
    if (state.status !== 'ready') {
      return
    }

    const target = iframeRef.current?.contentWindow

    if (!target) {
      return
    }

    const message = hostToSandboxMessageSchema.parse({
      channel: 'mdx-vault',
      instanceId: state.document.instanceId,
      type: 'init',
      props: resolvedSandboxProps
    })

    // Sandboxed srcdoc without allow-same-origin has an opaque origin, so targetOrigin must be "*".
    target.postMessage(message, '*')
  }, [resolvedSandboxProps, state])

  useEffect(() => {
    if (state.status !== 'ready') {
      return
    }

    const handleMessage = (event: MessageEvent<unknown>): void => {
      const frameWindow = iframeRef.current?.contentWindow

      if (!frameWindow || event.source !== frameWindow) {
        return
      }

      if (event.origin !== 'null') {
        console.warn('Dropped sandbox message from unexpected origin', event.origin)
        return
      }

      const parsed = sandboxToHostMessageSchema.safeParse(event.data)

      if (!parsed.success) {
        console.warn('Dropped invalid sandbox message', parsed.error.issues)
        return
      }

      const message = parsed.data

      if (message.instanceId !== state.document.instanceId) {
        console.warn('Dropped sandbox message for stale instance')
        return
      }

      if (message.type === 'ready') {
        postInit()
        return
      }

      if (message.type === 'resize') {
        setHeight(Math.max(120, Math.ceil(message.height)))
        return
      }

      void handleRequestData({
        descriptor: state.descriptor,
        document: state.document,
        message,
        target: frameWindow,
        notePath: selectedPath
      })
    }

    window.addEventListener('message', handleMessage)

    return () => {
      window.removeEventListener('message', handleMessage)
    }
  }, [postInit, selectedPath, state])

  const handlePermission = useCallback(
    async (descriptor: SandboxDescriptor, decision: 'allow' | 'deny'): Promise<void> => {
      try {
        const nextDescriptor = await window.sandboxApi.setPermission(
          descriptor.kind,
          descriptor.src,
          selectedPath,
          descriptor.contentHash,
          decision
        )
        setDialogDescriptor(null)

        if (decision === 'deny') {
          setState({
            status: 'blocked',
            descriptor: nextDescriptor,
            message: 'Permission was denied for this content hash.'
          })
          return
        }

        await loadDocument(nextDescriptor)
      } catch (error) {
        setDialogDescriptor(null)
        setState({
          status: 'error',
          title: 'Permission update failed',
          message: formatError(error)
        })
      }
    },
    [loadDocument, selectedPath]
  )

  return (
    <section
      className={cn(
        'my-5 overflow-hidden border-2 border-foreground bg-background shadow-[3px_3px_0_0_var(--foreground)]',
        className
      )}
    >
      {state.status === 'loading' ? (
        <div className="flex min-h-40 items-center justify-center px-4 font-mono text-[12px] uppercase tracking-wider text-muted-foreground">
          Preparing sandbox.
        </div>
      ) : state.status === 'ready' ? (
        <iframe
          key={state.document.instanceId}
          ref={iframeRef}
          title={`${state.descriptor.manifest.name} sandbox`}
          sandbox="allow-scripts"
          referrerPolicy="no-referrer"
          src={state.document.documentUrl}
          className="block w-full border-0 bg-transparent"
          style={{ height }}
          onLoad={postInit}
        />
      ) : state.status === 'blocked' ? (
        <SandboxBlockedCard
          descriptor={state.descriptor}
          message={state.message}
          onReview={() => setDialogDescriptor(state.descriptor)}
        />
      ) : (
        <SandboxErrorCard title={state.title} message={state.message} />
      )}

      <PermissionDialog
        descriptor={dialogDescriptor}
        onOpenChange={(open) => {
          if (!open) {
            setDialogDescriptor(null)
          }
        }}
        onAllow={(descriptor) => void handlePermission(descriptor, 'allow')}
        onDeny={(descriptor) => void handlePermission(descriptor, 'deny')}
      />
    </section>
  )
}

function SandboxBlockedCard({
  descriptor,
  message,
  onReview
}: {
  descriptor: SandboxDescriptor
  message: string
  onReview: () => void
}): React.JSX.Element {
  return (
    <div className="flex min-h-44 items-center justify-between gap-4 px-4 py-5">
      <div className="min-w-0">
        <div className="flex items-center gap-2 text-sm font-medium">
          <LockKeyhole className="size-4 text-muted-foreground" aria-hidden="true" />
          {descriptor.manifest.name}
        </div>
        <div className="mt-1 text-sm text-muted-foreground">{message}</div>
        <div className="mt-2 truncate font-mono text-xs text-muted-foreground">
          {descriptor.resolvedPath}
        </div>
      </div>
      <Button type="button" size="sm" variant="outline" onClick={onReview}>
        <ShieldCheck className="size-4" aria-hidden="true" />
        Review
      </Button>
    </div>
  )
}

function SandboxErrorCard({
  title,
  message
}: {
  title: string
  message: string
}): React.JSX.Element {
  return (
    <div className="min-h-44 px-4 py-5 text-sm">
      <div className="flex items-center gap-2 font-medium text-destructive">
        <AlertTriangle className="size-4" aria-hidden="true" />
        {title}
      </div>
      <pre className="mt-3 max-h-48 overflow-auto whitespace-pre-wrap border-2 border-foreground bg-muted p-3 font-mono text-xs text-foreground">
        {message}
      </pre>
    </div>
  )
}

function PermissionDialog({
  descriptor,
  onOpenChange,
  onAllow,
  onDeny
}: {
  descriptor: SandboxDescriptor | null
  onOpenChange: (open: boolean) => void
  onAllow: (descriptor: SandboxDescriptor) => void
  onDeny: (descriptor: SandboxDescriptor) => void
}): React.JSX.Element {
  return (
    <AlertDialog open={Boolean(descriptor)} onOpenChange={onOpenChange}>
      {descriptor ? (
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Run sandbox content?</AlertDialogTitle>
            <AlertDialogDescription>
              {descriptor.manifest.name} changed or has not been approved for this vault.
            </AlertDialogDescription>
          </AlertDialogHeader>

          <PermissionSummary
            manifest={descriptor.manifest}
            resolvedPath={descriptor.resolvedPath}
          />

          <AlertDialogFooter>
            <AlertDialogCancel type="button" onClick={() => onDeny(descriptor)}>
              Deny
            </AlertDialogCancel>
            <AlertDialogAction type="button" onClick={() => onAllow(descriptor)}>
              Allow
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      ) : null}
    </AlertDialog>
  )
}

function PermissionSummary({
  manifest,
  resolvedPath
}: {
  manifest: SandboxManifest
  resolvedPath: string
}): React.JSX.Element {
  return (
    <div className="border-2 border-foreground bg-muted/30 p-3 text-sm">
      <dl className="grid gap-x-3 gap-y-2 font-mono text-xs sm:grid-cols-[7rem_minmax(0,1fr)]">
        <dt className="font-bold uppercase tracking-wider text-[var(--editorial-red)]">Source</dt>
        <dd className="min-w-0 truncate text-[var(--editorial-blue)]">{resolvedPath}</dd>
        <dt className="font-bold uppercase tracking-wider text-[var(--editorial-red)]">Runtime</dt>
        <dd className="text-[var(--editorial-blue)]">{manifest.runtime}</dd>
        <dt className="font-bold uppercase tracking-wider text-[var(--editorial-red)]">Network</dt>
        <dd className="text-[var(--editorial-blue)]">
          {manifest.permissions.network ? 'Requested, blocked by CSP' : 'No access'}
        </dd>
        <dt className="font-bold uppercase tracking-wider text-[var(--editorial-red)]">Dataset</dt>
        <dd className="text-[var(--editorial-blue)]">
          {manifest.permissions.filesystem
            ? manifest.permissions.dataPaths.join(', ') || 'No paths listed'
            : 'No access'}
        </dd>
      </dl>
    </div>
  )
}

async function handleRequestData({
  descriptor,
  document,
  message,
  target,
  notePath
}: {
  descriptor: SandboxDescriptor
  document: SandboxDocument
  message: Extract<SandboxToHostMessage, { type: 'requestData' }>
  target: WindowProxy
  notePath: string | null
}): Promise<void> {
  try {
    const data = await window.sandboxApi.requestData(
      descriptor.kind,
      descriptor.src,
      notePath,
      document.contentHash,
      message.path
    )
    target.postMessage(
      hostToSandboxMessageSchema.parse({
        channel: 'mdx-vault',
        instanceId: document.instanceId,
        type: 'dataResponse',
        requestId: message.requestId,
        ok: true,
        data
      }),
      '*'
    )
  } catch (error) {
    target.postMessage(
      hostToSandboxMessageSchema.parse({
        channel: 'mdx-vault',
        instanceId: document.instanceId,
        type: 'dataResponse',
        requestId: message.requestId,
        ok: false,
        error: formatError(error)
      }),
      '*'
    )
  }
}

function stableStringify(value: unknown): string {
  return JSON.stringify(value, (_, nestedValue: unknown) => {
    if (!nestedValue || typeof nestedValue !== 'object' || Array.isArray(nestedValue)) {
      return nestedValue
    }

    return Object.fromEntries(
      Object.entries(nestedValue as Record<string, unknown>).sort(([left], [right]) =>
        left.localeCompare(right)
      )
    )
  })
}

function formatError(error: unknown): string {
  if (error instanceof Error) {
    return error.message
  }

  return String(error)
}
