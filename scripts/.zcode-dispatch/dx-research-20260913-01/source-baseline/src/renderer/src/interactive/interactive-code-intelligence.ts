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
  Prec,
  StateEffect,
  type StateEffectType,
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
  InteractiveCodeAction,
  InteractiveCompletion,
  InteractiveCompletionDetails,
  InteractiveDefinition,
  InteractiveHover,
  InteractiveReference,
  InteractiveReferenceResult,
  InteractiveRenameResult,
  InteractiveSignatureHelp,
  InteractiveTextEdit
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
  references: (position: number) => Promise<InteractiveReferenceResult>
  rename: (position: number, newName?: string) => Promise<InteractiveRenameResult>
  codeActions: (from: number, to: number) => Promise<InteractiveCodeAction[]>
  navigateDefinition: (definition: InteractiveDefinition) => void | Promise<void>
  navigateReference: (reference: InteractiveReference) => void | Promise<void>
}

type IdePopup =
  | { kind: 'loading'; position: number; title: string }
  | { kind: 'message'; position: number; title: string; message: string }
  | {
      kind: 'references'
      position: number
      result: InteractiveReferenceResult
      intelligence: InteractiveCodeIntelligence
    }
  | {
      kind: 'rename'
      position: number
      rename: Extract<InteractiveRenameResult, { canRename: true }>
      intelligence: InteractiveCodeIntelligence
    }
  | {
      kind: 'code-actions'
      position: number
      actions: InteractiveCodeAction[]
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
  const setIdePopup = StateEffect.define<IdePopup | null>()
  const idePopupField = StateField.define<Tooltip | null>({
    create: () => null,
    update(value, transaction) {
      for (const effect of transaction.effects) {
        if (effect.is(setIdePopup)) {
          return effect.value ? createIdePopupTooltip(effect.value, setIdePopup) : null
        }
      }
      return transaction.docChanged ? null : value
    },
    provide: (field) => showTooltip.from(field)
  })

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
      try {
        const hover = await intelligence.hover(position)
        return hover ? createHoverTooltip(hover) : null
      } catch {
        // Hover is transient and latest-wins. Navigation/project changes may
        // cancel it; CodeMirror should treat that as no tooltip, not an error.
        return null
      }
    }),
    signatureTooltip,
    signaturePlugin,
    idePopupField,
    idePopupTheme,
    Prec.highest(
      keymap.of([
        {
          key: 'F2',
          run(view) {
            return requestRename(view, getIntelligence, setIdePopup)
          }
        },
        {
          key: 'Shift-F12',
          run(view) {
            return requestReferences(view, getIntelligence, setIdePopup)
          }
        },
        {
          key: 'Mod-.',
          run(view) {
            return requestCodeActions(view, getIntelligence, setIdePopup)
          }
        },
        {
          key: 'Escape',
          run(view) {
            if (!view.state.field(idePopupField, false)) {
              return false
            }
            view.dispatch({ effects: setIdePopup.of(null) })
            view.focus()
            return true
          }
        }
      ])
    ),
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
        void requestDefinition(getIntelligence(), position).catch(() => undefined)
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

export function planInteractiveTextChanges(
  edits: readonly InteractiveTextEdit[],
  documentLength: number
): ChangeSpec[] | null {
  const changes = edits
    .map((edit) => ({ from: edit.from, to: edit.to, insert: edit.insert }))
    .sort((left, right) => left.from - right.from || left.to - right.to)
  for (let index = 0; index < changes.length; index += 1) {
    const current = changes[index]
    const previous = changes[index - 1]
    if (
      !current ||
      current.from < 0 ||
      current.to < current.from ||
      current.to > documentLength ||
      (previous !== undefined && current.from < previous.to)
    ) {
      return null
    }
  }
  return changes
}

function requestRename(
  view: EditorView,
  getIntelligence: () => InteractiveCodeIntelligence | null,
  popupEffect: StateEffectType<IdePopup | null>
): boolean {
  const intelligence = getIntelligence()
  if (!intelligence) {
    return false
  }
  const position = view.state.selection.main.head
  const document = view.state.doc.toString()
  view.dispatch({ effects: popupEffect.of({ kind: 'loading', position, title: 'Rename symbol' }) })
  void intelligence
    .rename(position)
    .then((rename) => {
      dispatchAsyncPopup(
        view,
        document,
        popupEffect,
        rename.canRename
          ? { kind: 'rename', position, rename, intelligence }
          : { kind: 'message', position, title: 'Rename unavailable', message: rename.reason }
      )
    })
    .catch((error: unknown) => {
      dispatchAsyncPopup(view, document, popupEffect, {
        kind: 'message',
        position,
        title: 'Rename unavailable',
        message: formatIntelligenceError(error)
      })
    })
  return true
}

function requestReferences(
  view: EditorView,
  getIntelligence: () => InteractiveCodeIntelligence | null,
  popupEffect: StateEffectType<IdePopup | null>
): boolean {
  const intelligence = getIntelligence()
  if (!intelligence) {
    return false
  }
  const position = view.state.selection.main.head
  const document = view.state.doc.toString()
  view.dispatch({ effects: popupEffect.of({ kind: 'loading', position, title: 'References' }) })
  void intelligence
    .references(position)
    .then((result) => {
      dispatchAsyncPopup(
        view,
        document,
        popupEffect,
        result.items.length > 0
          ? { kind: 'references', position, result, intelligence }
          : {
              kind: 'message',
              position,
              title: 'References',
              message: 'No project references found at the cursor.'
            }
      )
    })
    .catch((error: unknown) => {
      dispatchAsyncPopup(view, document, popupEffect, {
        kind: 'message',
        position,
        title: 'References unavailable',
        message: formatIntelligenceError(error)
      })
    })
  return true
}

function requestCodeActions(
  view: EditorView,
  getIntelligence: () => InteractiveCodeIntelligence | null,
  popupEffect: StateEffectType<IdePopup | null>
): boolean {
  const intelligence = getIntelligence()
  if (!intelligence) {
    return false
  }
  const selection = view.state.selection.main
  const position = selection.head
  const document = view.state.doc.toString()
  view.dispatch({ effects: popupEffect.of({ kind: 'loading', position, title: 'Code actions' }) })
  void intelligence
    .codeActions(selection.from, selection.to)
    .then((actions) => {
      dispatchAsyncPopup(
        view,
        document,
        popupEffect,
        actions.length > 0
          ? { kind: 'code-actions', position, actions }
          : {
              kind: 'message',
              position,
              title: 'Code actions',
              message: 'No safe single-file fix is available at the cursor.'
            }
      )
    })
    .catch((error: unknown) => {
      dispatchAsyncPopup(view, document, popupEffect, {
        kind: 'message',
        position,
        title: 'Code actions unavailable',
        message: formatIntelligenceError(error)
      })
    })
  return true
}

function dispatchAsyncPopup(
  view: EditorView,
  document: string,
  popupEffect: StateEffectType<IdePopup | null>,
  popup: IdePopup
): void {
  if (!view.dom.isConnected || view.state.doc.toString() !== document) {
    return
  }
  view.dispatch({ effects: popupEffect.of(popup) })
}

function createIdePopupTooltip(
  popup: IdePopup,
  popupEffect: StateEffectType<IdePopup | null>
): Tooltip {
  return {
    pos: popup.position,
    above: false,
    strictSide: false,
    create(view) {
      const dom = document.createElement('section')
      dom.className = 'cm-ide-popup'
      dom.setAttribute('role', 'dialog')
      dom.setAttribute('aria-label', popup.kind === 'loading' ? popup.title : popupTitle(popup))
      dom.addEventListener('keydown', (event) => {
        if (event.key === 'Escape') {
          event.preventDefault()
          closeIdePopup(view, popupEffect)
        }
      })

      const header = document.createElement('header')
      header.className = 'cm-ide-popup-header'
      header.textContent = popup.kind === 'loading' ? popup.title : popupTitle(popup)
      dom.append(header)

      if (popup.kind === 'loading') {
        const status = document.createElement('p')
        status.className = 'cm-ide-popup-message'
        status.setAttribute('role', 'status')
        status.textContent = 'Checking project…'
        dom.append(status)
      } else if (popup.kind === 'message') {
        appendMessagePopup(dom, popup.message, view, popupEffect)
      } else if (popup.kind === 'references') {
        appendReferencesPopup(dom, popup, view, popupEffect)
      } else if (popup.kind === 'rename') {
        appendRenamePopup(dom, popup, view, popupEffect)
      } else {
        appendCodeActionsPopup(dom, popup.actions, view, popupEffect)
      }
      return { dom }
    }
  }
}

function appendMessagePopup(
  dom: HTMLElement,
  message: string,
  view: EditorView,
  popupEffect: StateEffectType<IdePopup | null>
): void {
  const text = document.createElement('p')
  text.className = 'cm-ide-popup-message'
  text.textContent = message
  dom.append(text)
  const close = document.createElement('button')
  close.type = 'button'
  close.className = 'cm-ide-popup-command'
  close.textContent = 'Close'
  close.addEventListener('click', () => closeIdePopup(view, popupEffect))
  dom.append(close)
  queueMicrotask(() => close.focus())
}

function appendReferencesPopup(
  dom: HTMLElement,
  popup: Extract<IdePopup, { kind: 'references' }>,
  view: EditorView,
  popupEffect: StateEffectType<IdePopup | null>
): void {
  const list = document.createElement('div')
  list.className = 'cm-ide-popup-list'
  list.setAttribute('role', 'menu')
  const buttons = popup.result.items.map((reference) => {
    const button = document.createElement('button')
    button.type = 'button'
    button.className = 'cm-ide-popup-item'
    button.setAttribute('role', 'menuitem')
    button.tabIndex = -1

    const location = document.createElement('span')
    location.className = 'cm-ide-popup-location'
    const state = reference.isDefinition ? 'definition' : reference.isWriteAccess ? 'write' : 'read'
    location.textContent = `${reference.relativePath}:${reference.line}:${reference.column} · ${state}`
    const preview = document.createElement('span')
    preview.className = 'cm-ide-popup-preview'
    preview.textContent = reference.preview || '(empty line)'
    button.append(location, preview)
    button.addEventListener('click', () => {
      view.dispatch({ effects: popupEffect.of(null) })
      void popup.intelligence.navigateReference(reference)
    })
    list.append(button)
    return button
  })
  dom.append(list)
  if (popup.result.truncated) {
    const note = document.createElement('p')
    note.className = 'cm-ide-popup-footnote'
    note.textContent = `Showing ${popup.result.items.length} of ${popup.result.total} references.`
    dom.append(note)
  }
  enableRovingButtons(list, buttons)
}

function appendRenamePopup(
  dom: HTMLElement,
  popup: Extract<IdePopup, { kind: 'rename' }>,
  view: EditorView,
  popupEffect: StateEffectType<IdePopup | null>
): void {
  const form = document.createElement('form')
  form.className = 'cm-ide-rename-form'
  const label = document.createElement('label')
  label.className = 'cm-ide-popup-label'
  label.textContent = 'New symbol name'
  const input = document.createElement('input')
  input.className = 'cm-ide-rename-input'
  input.name = 'symbol-name'
  input.autocomplete = 'off'
  input.spellcheck = false
  input.maxLength = 128
  input.value = popup.rename.displayName
  label.append(input)
  const error = document.createElement('p')
  error.className = 'cm-ide-popup-error'
  error.setAttribute('aria-live', 'polite')
  const submit = document.createElement('button')
  submit.type = 'submit'
  submit.className = 'cm-ide-popup-command'
  submit.textContent = 'Rename'
  form.append(label, error, submit)
  form.addEventListener('submit', (event) => {
    event.preventDefault()
    const source = view.state.doc.toString()
    submit.disabled = true
    void popup.intelligence
      .rename(popup.position, input.value)
      .then((result) => {
        if (!view.dom.isConnected || view.state.doc.toString() !== source) {
          return
        }
        if (!result.canRename) {
          error.textContent = result.reason
          submit.disabled = false
          input.focus()
          return
        }
        const changes = planInteractiveTextChanges(result.edits, view.state.doc.length)
        if (!changes) {
          error.textContent = 'Rename locations became stale. Invoke Rename again.'
          submit.disabled = false
          return
        }
        view.dispatch({
          changes,
          effects: popupEffect.of(null),
          annotations: Transaction.userEvent.of('input.rename')
        })
        view.focus()
      })
      .catch((renameError: unknown) => {
        error.textContent = formatIntelligenceError(renameError)
        submit.disabled = false
        input.focus()
      })
  })
  dom.append(form)
  queueMicrotask(() => {
    input.focus()
    input.select()
  })
}

function appendCodeActionsPopup(
  dom: HTMLElement,
  actions: readonly InteractiveCodeAction[],
  view: EditorView,
  popupEffect: StateEffectType<IdePopup | null>
): void {
  const list = document.createElement('div')
  list.className = 'cm-ide-popup-list'
  list.setAttribute('role', 'menu')
  const buttons = actions.map((action) => {
    const button = document.createElement('button')
    button.type = 'button'
    button.className = 'cm-ide-popup-item cm-ide-popup-action'
    button.setAttribute('role', 'menuitem')
    button.tabIndex = -1
    button.textContent = action.title
    button.addEventListener('click', () => {
      const changes = planInteractiveTextChanges(action.edits, view.state.doc.length)
      if (!changes) {
        view.dispatch({
          effects: popupEffect.of({
            kind: 'message',
            position: view.state.selection.main.head,
            title: 'Code action unavailable',
            message: 'The suggested edit became stale. Invoke Code actions again.'
          })
        })
        return
      }
      view.dispatch({
        changes,
        effects: popupEffect.of(null),
        annotations: Transaction.userEvent.of('input.code-action')
      })
      view.focus()
    })
    list.append(button)
    return button
  })
  dom.append(list)
  enableRovingButtons(list, buttons)
}

function enableRovingButtons(list: HTMLElement, buttons: HTMLButtonElement[]): void {
  if (buttons.length === 0) {
    return
  }
  buttons[0]!.tabIndex = 0
  list.addEventListener('keydown', (event) => {
    const currentIndex = buttons.indexOf(document.activeElement as HTMLButtonElement)
    let nextIndex = currentIndex
    if (event.key === 'ArrowDown') {
      nextIndex = Math.min(buttons.length - 1, currentIndex + 1)
    } else if (event.key === 'ArrowUp') {
      nextIndex = Math.max(0, currentIndex - 1)
    } else if (event.key === 'Home') {
      nextIndex = 0
    } else if (event.key === 'End') {
      nextIndex = buttons.length - 1
    } else {
      return
    }
    event.preventDefault()
    for (const button of buttons) {
      button.tabIndex = -1
    }
    buttons[nextIndex]!.tabIndex = 0
    buttons[nextIndex]!.focus()
  })
  queueMicrotask(() => buttons[0]?.focus())
}

function closeIdePopup(view: EditorView, popupEffect: StateEffectType<IdePopup | null>): void {
  view.dispatch({ effects: popupEffect.of(null) })
  view.focus()
}

function popupTitle(popup: Exclude<IdePopup, { kind: 'loading' }>): string {
  if (popup.kind === 'message') {
    return popup.title
  }
  if (popup.kind === 'references') {
    return `References · ${popup.result.total}`
  }
  if (popup.kind === 'rename') {
    return `Rename · ${popup.rename.displayName}`
  }
  return `Code actions · ${popup.actions.length}`
}

function formatIntelligenceError(error: unknown): string {
  return error instanceof Error ? error.message : String(error)
}

const idePopupTheme = EditorView.baseTheme({
  '.cm-ide-popup': {
    width: 'min(32rem, calc(100vw - 2rem))',
    maxHeight: '20rem',
    overflow: 'hidden',
    border: '1px solid var(--border)',
    borderRadius: '3px',
    background: 'var(--background)',
    color: 'var(--foreground)',
    boxShadow: '0 10px 28px color-mix(in srgb, var(--foreground) 18%, transparent)',
    fontFamily: 'var(--font-mono)',
    fontSize: '12px'
  },
  '.cm-ide-popup-header': {
    display: 'block',
    padding: '0.5rem 0.625rem',
    borderBottom: '1px solid var(--border)',
    color: 'var(--muted-foreground)',
    fontFamily: 'var(--font-sans)',
    fontWeight: '600'
  },
  '.cm-ide-popup-list': { maxHeight: '15rem', overflowY: 'auto', padding: '0.25rem' },
  '.cm-ide-popup-item': {
    display: 'flex',
    width: '100%',
    flexDirection: 'column',
    gap: '0.125rem',
    border: '0',
    borderRadius: '2px',
    background: 'transparent',
    color: 'inherit',
    padding: '0.45rem 0.5rem',
    textAlign: 'left',
    cursor: 'default'
  },
  '.cm-ide-popup-item:hover, .cm-ide-popup-item:focus-visible': {
    outline: 'none',
    background: 'color-mix(in srgb, var(--instrument-blue) 10%, transparent)'
  },
  '.cm-ide-popup-item:focus-visible': {
    boxShadow: 'inset 2px 0 0 var(--instrument-blue)'
  },
  '.cm-ide-popup-location': { color: 'var(--muted-foreground)' },
  '.cm-ide-popup-preview': {
    overflow: 'hidden',
    color: 'var(--foreground)',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap'
  },
  '.cm-ide-popup-action': { minHeight: '2rem', justifyContent: 'center' },
  '.cm-ide-popup-message, .cm-ide-popup-footnote, .cm-ide-popup-error': {
    margin: '0',
    padding: '0.625rem',
    color: 'var(--muted-foreground)'
  },
  '.cm-ide-popup-error': { minHeight: '1.75rem', color: 'var(--destructive)' },
  '.cm-ide-popup-command': {
    minHeight: '2rem',
    margin: '0 0.625rem 0.625rem',
    border: '1px solid var(--border)',
    borderRadius: '2px',
    background: 'var(--background)',
    color: 'var(--foreground)',
    padding: '0.25rem 0.625rem'
  },
  '.cm-ide-popup-command:focus-visible': {
    outline: '2px solid var(--instrument-blue)',
    outlineOffset: '1px'
  },
  '.cm-ide-rename-form': { display: 'grid', gap: '0.375rem', paddingTop: '0.625rem' },
  '.cm-ide-popup-label': {
    display: 'grid',
    gap: '0.25rem',
    padding: '0 0.625rem',
    color: 'var(--muted-foreground)',
    fontFamily: 'var(--font-sans)'
  },
  '.cm-ide-rename-input': {
    height: '2rem',
    border: '1px solid var(--border)',
    borderRadius: '2px',
    background: 'var(--background)',
    color: 'var(--foreground)',
    padding: '0 0.5rem',
    fontFamily: 'var(--font-code)',
    fontSize: '12px'
  },
  '.cm-ide-rename-input:focus': {
    outline: '2px solid var(--instrument-blue)',
    outlineOffset: '1px'
  }
})

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
    let entries: InteractiveCompletion[]
    try {
      entries = await intelligence.completion(context.pos)
    } catch {
      // Completion requests are also latest-wins and can be cancelled while
      // typing, updating the project or closing the editor.
      return null
    }
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
  void requestDefinition(intelligence, view.state.selection.main.head).catch(() => undefined)
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
