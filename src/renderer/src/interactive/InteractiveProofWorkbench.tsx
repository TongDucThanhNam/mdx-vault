import {
  AlertCircle,
  Blocks,
  CheckCircle2,
  Play,
  RefreshCw,
  ShieldCheck,
  Square
} from 'lucide-react'
import { useMemo, useRef, useState } from 'react'
import { Button } from '@/components/ui/button'
import { TextFileEditor } from '@/editor/TextFileEditor'
import { useInteractiveProject } from '@/hooks/useInteractiveProject'
import { useInteractiveProof } from '@/hooks/useInteractiveProof'
import { cn } from '@/lib/utils'
import type { VaultTreeFile } from '@/vault/types'
import type { InteractiveDiagnostic } from '../../../shared/interactive-authoring'
import {
  INTERACTIVE_PROOF_STATE_LABELS,
  type InteractiveProofState
} from '../../../shared/interactive-proof'
import { InteractiveProofFrame } from './InteractiveProofFrame'

type NarrowMode = 'source' | 'proof' | 'problems'

interface InteractiveProofWorkbenchProps {
  activeRelativePath: string
  value: string
  savedContent: string
  treeFiles: readonly VaultTreeFile[]
  vaultSessionId: number
  starterConsented: boolean
  onConsumeStarterConsent: () => void
  onChange: (value: string) => void
  onSave: () => Promise<boolean>
  onOpenFile: (relativePath: string) => Promise<boolean>
  getSavedContent: () => string
  onRevealProject: (projectRoot: string) => void
}

export function InteractiveProofWorkbench({
  activeRelativePath,
  value,
  savedContent,
  treeFiles,
  vaultSessionId,
  starterConsented,
  onConsumeStarterConsent,
  onChange,
  onSave,
  onOpenFile,
  getSavedContent,
  onRevealProject
}: InteractiveProofWorkbenchProps): React.JSX.Element {
  const [narrowMode, setNarrowMode] = useState<NarrowMode>('source')
  const propsEditorRef = useRef<HTMLTextAreaElement | null>(null)
  const project = useInteractiveProject({
    activeRelativePath,
    activeContent: value,
    treeFiles,
    vaultSessionId,
    openOrActivate: onOpenFile
  })
  const proof = useInteractiveProof({
    projectRoot: project.projectRoot,
    snapshot: project.snapshot,
    savedFingerprint: `${activeRelativePath}\0${savedContent}`,
    getSavedFingerprint: () => `${activeRelativePath}\0${getSavedContent()}`,
    activeIsDirty: value !== savedContent,
    starterConsented,
    consumeStarterConsent: onConsumeStarterConsent,
    saveActiveFile: onSave
  })
  const diagnostics = useMemo(
    () => deduplicateDiagnostics([...project.diagnostics, ...proof.diagnostics]),
    [project.diagnostics, proof.diagnostics]
  )
  const problemCount = diagnostics.filter((diagnostic) => diagnostic.severity === 'error').length
  const projectFiles = useMemo(
    () => getProjectFileStrip(project.projectRoot, project.snapshot?.files ?? []),
    [project.projectRoot, project.snapshot?.files]
  )

  const openProblem = async (diagnostic: InteractiveDiagnostic): Promise<void> => {
    if (diagnostic.source === 'props') {
      setNarrowMode('proof')
      window.setTimeout(() => propsEditorRef.current?.focus(), 0)
      return
    }
    setNarrowMode('source')
    await project.openProblem(diagnostic)
  }

  return (
    <section
      aria-label={`Interactive Proof for ${project.projectName}`}
      data-language-cold-ready-ms={project.metrics.coldReadyMs ?? undefined}
      data-language-first-diagnostics-ms={project.metrics.firstDiagnosticsMs ?? undefined}
      data-language-warm-completion-ms={project.metrics.warmCompletionMs ?? undefined}
      className="flex h-full min-h-0 flex-col bg-background"
    >
      <header className="shrink-0 border-b-2 border-foreground bg-chrome">
        <div className="flex min-h-11 flex-wrap items-center justify-between gap-2 px-3 py-1.5">
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <Blocks className="size-4 shrink-0" aria-hidden="true" />
              <h2 className="truncate font-display text-sm font-black">
                Interactive Proof · {project.projectName}
              </h2>
            </div>
            <p className="truncate font-mono text-xs uppercase tracking-wider text-muted-foreground">
              {project.projectRoot}
            </p>
          </div>
          <div className="flex items-center gap-1.5">
            <ProofStateMark state={proof.state} problemCount={problemCount} />
            {proof.document ? (
              <Button
                type="button"
                variant="ghost"
                size="xs"
                disabled={proof.state === 'checking'}
                onClick={() => void proof.refresh()}
              >
                <RefreshCw aria-hidden="true" />
                Refresh proof
              </Button>
            ) : (
              <Button
                type="button"
                variant="ghost"
                size="xs"
                disabled={!project.snapshot || proof.state === 'checking'}
                onClick={() => void proof.run()}
              >
                <Play aria-hidden="true" />
                Run isolated proof
              </Button>
            )}
            <Button
              type="button"
              variant="ghost"
              size="xs"
              disabled={!proof.document && proof.state !== 'checking'}
              onClick={proof.stop}
            >
              <Square aria-hidden="true" />
              Stop proof
            </Button>
          </div>
        </div>

        <nav
          className="flex min-h-8 items-center gap-1 overflow-x-auto border-t border-border px-2"
          aria-label="Interactive project files"
        >
          {projectFiles.map((file) => (
            <button
              key={file.relativePath}
              type="button"
              aria-current={file.relativePath === activeRelativePath ? 'page' : undefined}
              aria-label={
                file.exists
                  ? `Open ${file.label}`
                  : `${file.label} is missing; reveal the interactive project folder`
              }
              className={cn(
                'h-7 shrink-0 border-b-2 px-2 font-mono text-xs font-bold uppercase tracking-wide outline-none transition-colors focus-visible:ring-[3px] focus-visible:ring-ring/50 motion-reduce:transition-none',
                file.relativePath === activeRelativePath
                  ? 'border-editorial-blue text-foreground'
                  : 'border-transparent text-muted-foreground hover:text-foreground',
                !file.exists && 'text-destructive'
              )}
              onClick={() =>
                file.exists
                  ? void onOpenFile(file.relativePath)
                  : onRevealProject(project.projectRoot)
              }
            >
              {file.label}
              {!file.exists ? ' · missing · reveal folder' : ''}
            </button>
          ))}
        </nav>

        <div
          className="grid grid-cols-3 border-t border-border lg:hidden"
          role="tablist"
          aria-label="Interactive proof panes"
        >
          {(['source', 'proof', 'problems'] as const).map((mode) => (
            <button
              key={mode}
              type="button"
              role="tab"
              aria-selected={narrowMode === mode}
              aria-controls={`interactive-${mode}-panel`}
              className={cn(
                'h-8 border-r border-border font-mono text-xs font-bold uppercase tracking-wider outline-none last:border-r-0 focus-visible:ring-[3px] focus-visible:ring-inset focus-visible:ring-ring/50',
                narrowMode === mode
                  ? 'bg-foreground text-background'
                  : 'bg-background text-muted-foreground'
              )}
              onClick={() => setNarrowMode(mode)}
            >
              {mode === 'problems' ? `Problems · ${problemCount}` : mode}
            </button>
          ))}
        </div>
      </header>

      <div className="min-h-0 flex-1 lg:grid lg:grid-cols-[minmax(0,3fr)_minmax(20rem,2fr)]">
        <section
          id="interactive-source-panel"
          role="tabpanel"
          aria-label="Source"
          className={cn(
            'h-full min-h-0 flex-col lg:flex lg:border-r-2 lg:border-foreground',
            narrowMode === 'source' ? 'flex' : 'hidden'
          )}
        >
          <PaneLabel label="Source" />
          {project.intelligenceStatus === 'unavailable' ? (
            <div className="flex items-center justify-between gap-2 border-b border-destructive bg-destructive/10 px-3 py-1.5">
              <p className="font-mono text-xs text-destructive">
                Type intelligence unavailable
                {project.intelligenceMessage ? ` · ${project.intelligenceMessage}` : ''}
              </p>
              <Button type="button" variant="outline" size="xs" onClick={project.retryIntelligence}>
                Retry
              </Button>
            </div>
          ) : null}
          <div className="min-h-0 flex-1">
            <TextFileEditor
              key={activeRelativePath}
              relativePath={activeRelativePath}
              value={value}
              onChange={onChange}
              intelligence={project.intelligence}
              diagnostics={diagnostics}
              revealRequest={project.revealRequest}
            />
          </div>
        </section>

        <aside
          className={cn(
            'h-full min-h-0 grid-rows-[minmax(0,3fr)_minmax(14rem,2fr)] lg:grid',
            narrowMode === 'source' ? 'hidden' : 'grid'
          )}
        >
          <section
            id="interactive-proof-panel"
            role="tabpanel"
            aria-label="Isolated proof"
            className={cn(
              'min-h-0 overflow-auto border-b-2 border-foreground',
              narrowMode === 'proof' ? 'block' : 'hidden lg:block'
            )}
          >
            <PaneLabel label="Proof" />
            {proof.hasLastGoodWithNewerIssues ? (
              <div className="border-b border-destructive bg-destructive/10 px-3 py-2 font-mono text-xs text-destructive">
                Source has newer issues. Showing the last known good proof.
              </div>
            ) : null}
            {proof.document ? (
              <InteractiveProofFrame
                document={proof.document}
                props={proof.renderedProps}
                projectName={project.projectName}
                onReady={proof.onFrameReady}
                onRuntimeError={proof.onRuntimeError}
              />
            ) : (
              <div className="grid min-h-44 place-items-center px-5 text-center">
                <div>
                  <ShieldCheck
                    className="mx-auto mb-2 size-5 text-editorial-blue"
                    aria-hidden="true"
                  />
                  <p className="font-display text-base font-black">
                    {INTERACTIVE_PROOF_STATE_LABELS[proof.state]}
                  </p>
                  <p className="mt-1 max-w-sm font-mono text-xs leading-relaxed text-muted-foreground">
                    Run starts a memory-only, zero-capability session. Network, filesystem, vault
                    data, navigation, and same-origin access remain unavailable.
                  </p>
                </div>
              </div>
            )}
            <div className="border-t border-border p-3">
              <label htmlFor="interactive-preview-props">
                <span className="font-mono text-xs font-bold uppercase tracking-wider text-muted-foreground">
                  Preview props · session only
                </span>
              </label>
              <textarea
                ref={propsEditorRef}
                id="interactive-preview-props"
                value={proof.propsText}
                spellCheck={false}
                className="mt-1.5 min-h-24 w-full resize-y border-2 border-foreground bg-background p-2 font-mono text-xs outline-none focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50"
                onChange={(event) => proof.setPropsText(event.target.value)}
              />
            </div>
          </section>

          <section
            id="interactive-problems-panel"
            role="tabpanel"
            aria-label="Problems"
            className={cn(
              'min-h-0 overflow-auto',
              narrowMode === 'problems' ? 'block' : 'hidden lg:block'
            )}
          >
            <PaneLabel label={`Problems · ${problemCount}`} />
            {diagnostics.length === 0 ? (
              <div className="flex items-center gap-2 px-3 py-4 font-mono text-xs text-muted-foreground">
                <CheckCircle2 className="size-4 text-editorial-blue" aria-hidden="true" />
                No project problems
              </div>
            ) : (
              <ol className="divide-y divide-border">
                {diagnostics.map((diagnostic, index) => (
                  <li key={diagnosticKey(diagnostic, index)}>
                    <button
                      type="button"
                      className="flex w-full gap-2 border-l-4 border-destructive px-3 py-2 text-left outline-none hover:bg-destructive/5 focus-visible:bg-destructive/10 focus-visible:ring-[3px] focus-visible:ring-inset focus-visible:ring-ring/50"
                      onClick={() => void openProblem(diagnostic)}
                    >
                      <AlertCircle
                        className="mt-0.5 size-3.5 shrink-0 text-destructive"
                        aria-hidden="true"
                      />
                      <span className="min-w-0">
                        <span className="block font-mono text-xs font-bold text-destructive">
                          {diagnostic.code} · {formatDiagnosticLocation(diagnostic)}
                        </span>
                        <span className="mt-0.5 block font-mono text-xs leading-relaxed text-foreground">
                          {diagnostic.message}
                        </span>
                      </span>
                    </button>
                  </li>
                ))}
              </ol>
            )}
          </section>
        </aside>
      </div>
    </section>
  )
}

function PaneLabel({ label }: { label: string }): React.JSX.Element {
  return (
    <div className="flex h-7 shrink-0 items-center border-b border-border bg-muted px-3 font-mono text-xs font-bold uppercase tracking-[0.16em] text-muted-foreground">
      {label}
    </div>
  )
}

function ProofStateMark({
  state,
  problemCount
}: {
  state: InteractiveProofState
  problemCount: number
}): React.JSX.Element {
  const issue = state === 'compile-issue' || state === 'runtime-issue'
  return (
    <span
      className={cn(
        'inline-flex h-6 items-center gap-1 border px-2 font-mono text-xs font-bold uppercase tracking-wider',
        issue
          ? 'border-destructive text-destructive'
          : state === 'ready'
            ? 'border-editorial-blue text-editorial-blue'
            : 'border-border text-muted-foreground'
      )}
      aria-live="polite"
    >
      {issue ? (
        <AlertCircle className="size-3" aria-hidden="true" />
      ) : state === 'ready' ? (
        <CheckCircle2 className="size-3" aria-hidden="true" />
      ) : null}
      {INTERACTIVE_PROOF_STATE_LABELS[state]} · {problemCount}{' '}
      {problemCount === 1 ? 'problem' : 'problems'}
    </span>
  )
}

function getProjectFileStrip(
  projectRoot: string,
  files: readonly { relativePath: string }[]
): Array<{ relativePath: string; label: string; exists: boolean }> {
  const existing = new Set(files.map((file) => file.relativePath))
  const primary = ['component.tsx', 'manifest.json', 'README.md']
  const rest = files
    .map((file) => file.relativePath)
    .filter((relativePath) => !primary.includes(relativePath))
    .sort((left, right) => left.localeCompare(right))
  return [...primary, ...rest].map((relativePath) => ({
    relativePath: `${projectRoot}/${relativePath}`,
    label: relativePath,
    exists: existing.has(relativePath)
  }))
}

function formatDiagnosticLocation(diagnostic: InteractiveDiagnostic): string {
  const path = diagnostic.relativePath?.split('/').at(-1) ?? 'preview props'
  return diagnostic.line ? `${path}:${diagnostic.line}:${diagnostic.column ?? 1}` : path
}

function diagnosticKey(diagnostic: InteractiveDiagnostic, index: number): string {
  return [diagnostic.source, diagnostic.code, diagnostic.relativePath, diagnostic.from, index].join(
    ':'
  )
}

function deduplicateDiagnostics(diagnostics: InteractiveDiagnostic[]): InteractiveDiagnostic[] {
  const seen = new Set<string>()
  return diagnostics.filter((diagnostic) => {
    const key = [
      diagnostic.source,
      diagnostic.code,
      diagnostic.relativePath,
      diagnostic.from,
      diagnostic.message
    ].join('\0')
    if (seen.has(key)) {
      return false
    }
    seen.add(key)
    return true
  })
}
