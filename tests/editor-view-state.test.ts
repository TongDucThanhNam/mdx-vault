import { EditorState, type TransactionSpec } from '@codemirror/state'
import { EditorView, type MeasureRequest } from '@codemirror/view'
import {
  clampEditorViewSnapshot,
  restoreActiveEditorView
} from '../src/renderer/src/editor/editor-view-state'

declare function test(name: string, run: () => void): void
declare function expect<T>(actual: T): {
  toEqual(expected: T): void
  toBe(expected: T): void
}

test('editor view snapshots clamp stale positions and invalid scroll offsets', () => {
  expect(
    clampEditorViewSnapshot(
      {
        anchor: 40,
        head: -3,
        scrollTop: -20,
        scrollLeft: 12
      },
      10
    )
  ).toEqual({
    anchor: 10,
    head: 0,
    scrollTop: 0,
    scrollLeft: 12
  })
})

test('restore dispatches a CodeMirror selection and restores both scroll axes', () => {
  let state = EditorState.create({
    doc: '0123456789abcdef',
    selection: { anchor: 0 }
  })
  const scrollDOM = { scrollTop: 0, scrollLeft: 0 }
  let requestedMeasure = false
  const view = {
    get state() {
      return state
    },
    scrollDOM,
    dispatch(spec: TransactionSpec) {
      state = state.update(spec).state
    },
    requestMeasure<T>(request?: MeasureRequest<T>) {
      requestedMeasure = true
      if (!request) {
        return
      }
      const measured = request.read(view as unknown as EditorView)
      request.write?.(measured, view as unknown as EditorView)
    }
  } as unknown as EditorView

  withActiveEditorView(view, () => {
    expect(
      restoreActiveEditorView({
        anchor: 11,
        head: 4,
        scrollTop: 240,
        scrollLeft: 18
      })
    ).toBe(true)
  })

  expect({
    anchor: state.selection.main.anchor,
    head: state.selection.main.head
  }).toEqual({ anchor: 11, head: 4 })
  expect(requestedMeasure).toBe(true)
  expect(scrollDOM).toEqual({ scrollTop: 240, scrollLeft: 18 })
})

test('restore returns false without an active editor or snapshot', () => {
  const view = {
    state: EditorState.create({ doc: 'document' })
  } as unknown as EditorView

  withActiveEditorView(null, () => {
    expect(restoreActiveEditorView({ anchor: 1, head: 1, scrollTop: 10, scrollLeft: 2 })).toBe(
      false
    )
  })
  withActiveEditorView(view, () => {
    expect(restoreActiveEditorView(null)).toBe(false)
  })
})

function withActiveEditorView(view: EditorView | null, run: () => void): void {
  const originalDocument = Object.getOwnPropertyDescriptor(globalThis, 'document')
  const originalFindFromDOM = Object.getOwnPropertyDescriptor(EditorView, 'findFromDOM')
  const editorElement = {} as HTMLElement

  Object.defineProperty(globalThis, 'document', {
    configurable: true,
    value: {
      querySelector: () => (view ? editorElement : null)
    }
  })
  Object.defineProperty(EditorView, 'findFromDOM', {
    configurable: true,
    value: () => view
  })

  try {
    run()
  } finally {
    if (originalDocument) {
      Object.defineProperty(globalThis, 'document', originalDocument)
    } else {
      Reflect.deleteProperty(globalThis, 'document')
    }
    if (originalFindFromDOM) {
      Object.defineProperty(EditorView, 'findFromDOM', originalFindFromDOM)
    }
  }
}
