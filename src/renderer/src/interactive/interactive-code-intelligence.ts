import {
  autocompletion,
  type Completion,
  type CompletionContext,
  type CompletionResult
} from '@codemirror/autocomplete'
import { type Diagnostic, lintGutter } from '@codemirror/lint'
import {
  type ChangeSpec,
  type Extension,
  StateEffect,
  StateField,
  Transaction
} from '@codemirror/state'
import {
  EditorView,
  hoverTooltip,
  keymap,
  showTooltip,
  type Tooltip,
  ViewPlugin,
  type ViewUpdate
} from '@codemirror/view'
import type { InteractiveDiagnostic } from '../../../shared/interactive-authoring'
import type {
  InteractiveCompletion,
  InteractiveCompletionDetails,
  InteractiveDefinition,
  InteractiveHover,
  InteractiveSignatureHelp
} from '../../../shared/interactive-language'

export interface InteractiveCodeIntelligence {
  relativePath: string
  completion: (position: number) => Promise<InteractiveCompletion[]>
  completionDetails: (
    position: number,
    completion: Pick<InteractiveCompletion, 'name' | 'source' | 'data'>
  ) => Promise<InteractiveCompletionDetails | null>
  hover: (position: number) => Promise<InteractiveHover | null>
  signature: (position: number) => Promise<InteractiveSignatureHelp | null>
  definition: (position: number) => Promise<InteractiveDefinition[]>
  navigateDefinition: (definition: InteractiveDefinition) => void | Promise<void>
}

export function createInteractiveCodeIntelligenceExtensions(
  getIntelligence: () => InteractiveCodeIntelligence | null
): Extension {
  const setSignature = StateEffect.define<{
    help: InteractiveSignatureHelp
    position: number
  } | null>()
  const signatureTooltip = StateField.define<Tooltip | null>({
    create: () => null,
    update(value, transaction) {
      for (const effect of transaction.effects) {
        if (effect.is(setSignature)) {
          return effect.value
            ? createSignatureTooltip(effect.value.help, effect.value.position)
            : null
        }
      }
      return transaction.docChanged ? null : value
    },
    provide: (field) => showTooltip.from(field)
  })
  const signaturePlugin = ViewPlugin.fromClass(
    class {
      private timer: number | null = null
      private request = 0

      constructor(private readonly view: EditorView) {
        this.schedule()
      }

      update(update: ViewUpdate): void {
        if (update.docChanged || update.selectionSet) {
          this.schedule()
        }
      }

      destroy(): void {
        if (this.timer !== null) {
          window.clearTimeout(this.timer)
        }
        this.request += 1
      }

      private schedule(): void {
        if (this.timer !== null) {
          window.clearTimeout(this.timer)
        }
        const request = this.request + 1
        this.request = request
        this.timer = window.setTimeout(() => {
          this.timer = null
          const intelligence = getIntelligence()
          if (!intelligence) {
            return
          }
          const position = this.view.state.selection.main.head
          void intelligence
            .signature(position)
            .then((help) => {
              if (request !== this.request || this.view.state.selection.main.head !== position) {
                return
              }
              this.view.dispatch({
                effects: setSignature.of(help ? { help, position } : null)
              })
            })
            .catch(() => {
              if (request === this.request) {
                this.view.dispatch({ effects: setSignature.of(null) })
              }
            })
        }, 140)
      }
    }
  )

  return [
    lintGutter(),
    autocompletion({
      activateOnTyping: true,
      override: [createCompletionSource(getIntelligence)]
    }),
    hoverTooltip(async (_view, position) => {
      const intelligence = getIntelligence()
      if (!intelligence) {
        return null
      }
      const hover = await intelligence.hover(position)
      return hover ? createHoverTooltip(hover) : null
    }),
    signatureTooltip,
    signaturePlugin,
    keymap.of([
      {
        key: 'Escape',
        run(view) {
          if (!view.state.field(signatureTooltip, false)) {
            return false
          }
          view.dispatch({ effects: setSignature.of(null) })
          return true
        }
      },
      {
        key: 'F12',
        run(view) {
          return navigateToDefinition(view, getIntelligence)
        }
      }
    ]),
    EditorView.domEventHandlers({
      mousedown(event, view) {
        if (event.button !== 0 || !(event.metaKey || event.ctrlKey)) {
          return false
        }
        const position = view.posAtCoords({ x: event.clientX, y: event.clientY })
        if (position === null) {
          return false
        }
        event.preventDefault()
        void requestDefinition(getIntelligence(), position)
        return true
      }
    })
  ]
}

export function mapInteractiveDiagnosticsForEditor(
  diagnostics: readonly InteractiveDiagnostic[],
  relativePath: string,
  documentLength: number
): Diagnostic[] {
  return diagnostics
    .filter(
      (diagnostic) =>
        diagnostic.relativePath === relativePath &&
        diagnostic.from !== null &&
        diagnostic.to !== null
    )
    .map((diagnostic) => {
      const from = clamp(diagnostic.from ?? 0, 0, documentLength)
      const to = clamp(Math.max(diagnostic.to ?? from, from), from, documentLength)
      return {
        from,
        to,
        severity: diagnostic.severity,
        message: `${diagnostic.code} · ${diagnostic.message}`
      }
    })
}

export function planCompletionChanges({
  from,
  to,
  insert,
  additionalEdits
}: {
  from: number
  to: number
  insert: string
  additionalEdits: InteractiveCompletionDetails['edits']
}): ChangeSpec[] | null {
  const changes = [
    ...additionalEdits.map((edit) => ({
      from: edit.from,
      to: edit.to,
      insert: edit.insert
    })),
    { from, to, insert }
  ].sort((left, right) => left.from - right.from || left.to - right.to)

  for (let index = 1; index < changes.length; index += 1) {
    const previous = changes[index - 1]
    const current = changes[index]
    if (!previous || !current || current.from < previous.to) {
      return null
    }
  }
  return changes
}

function createCompletionSource(
  getIntelligence: () => InteractiveCodeIntelligence | null
): (context: CompletionContext) => Promise<CompletionResult | null> {
  return async (context) => {
    const intelligence = getIntelligence()
    if (!intelligence) {
      return null
    }
    const word = context.matchBefore(/[\w$]*/)
    if (!context.explicit && (!word || word.from === word.to)) {
      return null
    }
    const entries = await intelligence.completion(context.pos)
    if (entries.length === 0) {
      return null
    }

    return {
      from: word?.from ?? context.pos,
      options: entries.map(
        (entry): Completion => ({
          label: entry.name,
          type: mapCompletionKind(entry.kind),
          detail: entry.source ? `from ${entry.source}` : undefined,
          boost: entry.source === 'react' ? 20 : undefined,
          apply: entry.hasAction
            ? (view, _completion, from, to) => {
                applyCompletionWithDetails(view, intelligence, context.pos, entry, from, to)
              }
            : (entry.insertText ?? entry.name)
        })
      ),
      validFor: /^[\w$]*$/
    }
  }
}

function applyCompletionWithDetails(
  view: EditorView,
  intelligence: InteractiveCodeIntelligence,
  position: number,
  entry: InteractiveCompletion,
  from: number,
  to: number
): void {
  const document = view.state.doc.toString()
  void intelligence
    .completionDetails(position, entry)
    .then((details) => {
      if (view.state.doc.toString() !== document) {
        return
      }
      const changes = planCompletionChanges({
        from,
        to,
        insert: entry.insertText ?? entry.name,
        additionalEdits: details?.edits ?? []
      })
      if (!changes) {
        return
      }
      view.dispatch({
        changes,
        annotations: Transaction.userEvent.of('input.complete')
      })
    })
    .catch(() => undefined)
}

function createHoverTooltip(hover: InteractiveHover): Tooltip {
  return {
    pos: hover.from,
    end: hover.to,
    above: true,
    create() {
      const dom = document.createElement('div')
      dom.className =
        'max-w-md border-2 border-foreground bg-background px-3 py-2 font-mono text-xs text-foreground shadow-[2px_2px_0_0_var(--foreground)]'
      const signature = document.createElement('code')
      signature.textContent = hover.signature
      dom.append(signature)
      if (hover.documentation) {
        const documentation = document.createElement('p')
        documentation.className = 'mt-1 text-muted-foreground'
        documentation.textContent = hover.documentation
        dom.append(documentation)
      }
      return { dom }
    }
  }
}

function createSignatureTooltip(help: InteractiveSignatureHelp, position: number): Tooltip {
  return {
    pos: position,
    above: true,
    create() {
      const dom = document.createElement('div')
      dom.className =
        'max-w-lg border-2 border-editorial-blue bg-background px-3 py-2 font-mono text-xs text-foreground shadow-[2px_2px_0_0_var(--editorial-blue)]'
      const signature = help.signatures[help.activeSignature]
      if (!signature) {
        return { dom }
      }
      const activeParameter = signature.parameters[help.activeParameter]
      dom.textContent = `${signature.prefix}${signature.parameters
        .map((parameter) => parameter.label)
        .join(signature.separator)}${signature.suffix}`
      if (activeParameter?.documentation) {
        const documentation = document.createElement('p')
        documentation.className = 'mt-1 text-muted-foreground'
        documentation.textContent = activeParameter.documentation
        dom.append(documentation)
      }
      return { dom }
    }
  }
}

function navigateToDefinition(
  view: EditorView,
  getIntelligence: () => InteractiveCodeIntelligence | null
): boolean {
  const intelligence = getIntelligence()
  if (!intelligence) {
    return false
  }
  void requestDefinition(intelligence, view.state.selection.main.head)
  return true
}

async function requestDefinition(
  intelligence: InteractiveCodeIntelligence | null,
  position: number
): Promise<void> {
  if (!intelligence) {
    return
  }
  const definition = (await intelligence.definition(position)).find(
    (candidate) => candidate.kind === 'project'
  )
  if (definition) {
    await intelligence.navigateDefinition(definition)
  }
}

function mapCompletionKind(kind: string): string {
  const map: Record<string, string> = {
    class: 'class',
    const: 'constant',
    enum: 'enum',
    function: 'function',
    interface: 'interface',
    keyword: 'keyword',
    let: 'variable',
    method: 'method',
    module: 'namespace',
    property: 'property',
    type: 'type',
    var: 'variable'
  }
  return map[kind] ?? 'text'
}

function clamp(value: number, minimum: number, maximum: number): number {
  return Math.min(maximum, Math.max(minimum, value))
}
