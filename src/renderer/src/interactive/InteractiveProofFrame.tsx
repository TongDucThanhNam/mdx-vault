import { useCallback, useEffect, useRef, useState } from 'react'
import {
  hostToSandboxMessageSchema,
  type SandboxDocument,
  sandboxToHostMessageSchema
} from '../../../shared/sandbox'

interface InteractiveProofFrameProps {
  document: SandboxDocument
  props: Record<string, unknown>
  projectName: string
  onReady: () => void
  onRuntimeError: (error: {
    kind: 'error' | 'unhandledrejection'
    message: string
    stack: string | null
  }) => void
}

export function InteractiveProofFrame({
  document,
  props,
  projectName,
  onReady,
  onRuntimeError
}: InteractiveProofFrameProps): React.JSX.Element {
  const iframeRef = useRef<HTMLIFrameElement | null>(null)
  const [height, setHeight] = useState(220)

  useEffect(() => {
    setHeight(220)
  }, [document.instanceId])

  const postInit = useCallback((): void => {
    const target = iframeRef.current?.contentWindow
    if (!target) {
      return
    }
    target.postMessage(
      hostToSandboxMessageSchema.parse({
        channel: 'mdx-vault',
        instanceId: document.instanceId,
        type: 'init',
        props
      }),
      '*'
    )
  }, [document.instanceId, props])

  useEffect(() => {
    const handleMessage = (event: MessageEvent<unknown>): void => {
      const target = iframeRef.current?.contentWindow
      if (!target || event.source !== target || event.origin !== 'null') {
        return
      }
      const parsed = sandboxToHostMessageSchema.safeParse(event.data)
      if (!parsed.success || parsed.data.instanceId !== document.instanceId) {
        return
      }
      const message = parsed.data
      if (message.type === 'ready') {
        postInit()
        onReady()
        return
      }
      if (message.type === 'resize') {
        setHeight(Math.max(120, Math.min(100_000, Math.ceil(message.height))))
        return
      }
      if (message.type === 'runtimeError') {
        onRuntimeError(message)
        return
      }

      target.postMessage(
        hostToSandboxMessageSchema.parse({
          channel: 'mdx-vault',
          instanceId: document.instanceId,
          type: 'dataResponse',
          requestId: message.requestId,
          ok: false,
          error: 'Authoring proof cannot access vault data.'
        }),
        '*'
      )
    }

    window.addEventListener('message', handleMessage)
    return () => window.removeEventListener('message', handleMessage)
  }, [document.instanceId, onReady, onRuntimeError, postInit])

  return (
    <iframe
      key={document.instanceId}
      ref={iframeRef}
      title={`${projectName} isolated authoring proof`}
      sandbox="allow-scripts"
      referrerPolicy="no-referrer"
      src={document.documentUrl}
      className="block w-full border-0 bg-background"
      style={{ height }}
      onLoad={postInit}
    />
  )
}
