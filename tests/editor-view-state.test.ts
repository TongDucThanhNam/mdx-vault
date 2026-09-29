import { EditorState, type TransactionSpec } from '@codemirror/state'
import type { EditorView, MeasureRequest } from '@codemirror/view'
import { registerActiveEditorView } from '../src/renderer/src/editor/active-editor-view'
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

test('late restore measurement cannot scroll over a newer edit or cursor move', () => {
  let state = EditorState.create({ doc: 'example' })
  let measure: MeasureRequest<unknown> | undefined
  const scrollDOM = { scrollTop: 0, scrollLeft: 0 }
  const view = {
    get state() {
      return state
    },
    scrollDOM,
    dispatch(spec: TransactionSpec) {
      state = state.update(spec).state
    },
    requestMeasure(request: MeasureRequest<unknown>) {
      measure = request
    }
  } as unknown as EditorView
  withActiveEditorView(view, () => {
    restoreActiveEditorView({ anchor: 3, head: 3, scrollTop: 240, scrollLeft: 18 })
    view.dispatch({ changes: { from: 3, insert: 'typed' }, selection: { anchor: 8 } })
    measure?.write?.(null, view)
    expect(scrollDOM).toEqual({ scrollTop: 0, scrollLeft: 0 })
    expect(state.selection.main.head).toBe(8)
  })
})

function withActiveEditorView(view: EditorView | null, run: () => void): void {
  if (view) Object.defineProperty(view, 'dom', { value: { isConnected: true } })
  const release = view ? registerActiveEditorView(view) : () => undefined

  try {
    run()
  } finally {
    release()
  }
}
