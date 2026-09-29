import {
  closeSearchPanel,
  findNext,
  findPrevious,
  getSearchQuery,
  openSearchPanel,
  replaceAll,
  replaceNext,
  SearchQuery,
  search,
  setSearchQuery
} from '@codemirror/search'
import { Prec } from '@codemirror/state'
import { type EditorView, keymap, type Panel, type ViewUpdate } from '@codemirror/view'

const panels = new WeakMap<EditorView, FindReplacePanel>()

export function openFindOnly(view: EditorView): boolean {
  panels.get(view)?.setExpanded(false)
  return openSearchPanel(view)
}

export function openReplace(view: EditorView): boolean {
  openSearchPanel(view)
  panels.get(view)?.setExpanded(true)
  panels.get(view)?.focusReplace()
  return true
}

export const findReplaceExtension = [
  search({ top: true, createPanel: (view) => new FindReplacePanel(view) }),
  Prec.highest(
    keymap.of([
      { key: 'Mod-f', run: openFindOnly },
      { key: 'Ctrl-h', run: openReplace }
    ])
  )
]

class FindReplacePanel implements Panel {
  readonly dom: HTMLElement
  readonly top = true
  private readonly findField: HTMLInputElement
  private readonly replaceField: HTMLInputElement
  private readonly caseField: HTMLInputElement
  private readonly regexField: HTMLInputElement
  private readonly wordField: HTMLInputElement
  private readonly replaceRow: HTMLElement
  private readonly toggle: HTMLButtonElement
  private query: SearchQuery
  private expanded = false

  constructor(private readonly view: EditorView) {
    this.query = getSearchQuery(view.state)
    this.dom = document.createElement('div')
    this.dom.className = 'cm-search cm-find-replace-panel'
    this.dom.setAttribute('aria-label', 'Find in note')
    this.dom.addEventListener('keydown', (event) => {
      if (event.key === 'Escape') {
        event.preventDefault()
        closeSearchPanel(view)
      } else if (event.key === 'Enter' && event.target === this.findField) {
        event.preventDefault()
        ;(event.shiftKey ? findPrevious : findNext)(view)
      } else if (event.key === 'Enter' && event.target === this.replaceField) {
        event.preventDefault()
        replaceNext(view)
      }
    })

    this.findField = this.input('Find', 'find', this.query.search)
    this.findField.setAttribute('main-field', 'true')
    this.replaceField = this.input('Replace', 'replace', this.query.replace)
    this.caseField = this.checkbox('Match case', this.query.caseSensitive)
    this.regexField = this.checkbox('Regular expression', this.query.regexp)
    this.wordField = this.checkbox('Whole word', this.query.wholeWord)
    this.toggle = this.button('Show replace', () => this.setExpanded(!this.expanded))
    this.toggle.setAttribute('aria-expanded', 'false')
    this.toggle.setAttribute('aria-controls', 'cm-replace-row')
    const findRow = document.createElement('div')
    findRow.className = 'cm-find-row'
    findRow.append(
      this.toggle,
      this.findField,
      this.button('Next match', () => findNext(view)),
      this.button('Previous match', () => findPrevious(view)),
      this.label('Case', this.caseField),
      this.label('Regex', this.regexField),
      this.label('Word', this.wordField),
      this.button('Close find', () => closeSearchPanel(view))
    )
    this.replaceRow = document.createElement('div')
    this.replaceRow.id = 'cm-replace-row'
    this.replaceRow.className = 'cm-replace-row'
    this.replaceRow.hidden = true
    this.replaceRow.append(
      this.replaceField,
      this.button('Replace', () => replaceNext(view)),
      this.button('Replace all', () => replaceAll(view))
    )
    this.dom.append(findRow, this.replaceRow)
    panels.set(view, this)
  }

  mount(): void {
    this.findField.select()
  }

  destroy(): void {
    panels.delete(this.view)
  }

  update(_update: ViewUpdate): void {
    const query = getSearchQuery(this.view.state)
    if (query.eq(this.query)) return
    this.query = query
    this.findField.value = query.search
    this.replaceField.value = query.replace
    this.caseField.checked = query.caseSensitive
    this.regexField.checked = query.regexp
    this.wordField.checked = query.wholeWord
  }

  setExpanded(expanded: boolean): void {
    this.expanded = expanded && !this.view.state.readOnly
    this.replaceRow.hidden = !this.expanded
    this.toggle.setAttribute('aria-expanded', String(this.expanded))
    this.toggle.textContent = this.expanded ? 'Hide replace' : 'Show replace'
    if (!this.expanded && this.replaceField === document.activeElement) this.findField.focus()
  }

  focusReplace(): void {
    this.replaceField.focus()
    this.replaceField.select()
  }

  private commit = (): void => {
    const query = new SearchQuery({
      search: this.findField.value,
      replace: this.replaceField.value,
      caseSensitive: this.caseField.checked,
      regexp: this.regexField.checked,
      wholeWord: this.wordField.checked
    })
    if (!query.eq(this.query)) {
      this.query = query
      this.view.dispatch({ effects: setSearchQuery.of(query) })
    }
  }

  private input(label: string, name: string, value: string): HTMLInputElement {
    const input = document.createElement('input')
    input.className = 'cm-textfield'
    input.name = name
    input.value = value
    input.placeholder = label
    input.setAttribute('aria-label', label)
    input.addEventListener('input', this.commit)
    return input
  }

  private checkbox(label: string, checked: boolean): HTMLInputElement {
    const input = document.createElement('input')
    input.type = 'checkbox'
    input.checked = checked
    input.setAttribute('aria-label', label)
    input.addEventListener('change', this.commit)
    return input
  }

  private label(text: string, input: HTMLInputElement): HTMLLabelElement {
    const label = document.createElement('label')
    label.append(input, text)
    return label
  }

  private button(text: string, action: () => void): HTMLButtonElement {
    const button = document.createElement('button')
    button.type = 'button'
    button.textContent = text
    button.setAttribute('aria-label', text)
    button.addEventListener('click', action)
    return button
  }
}
