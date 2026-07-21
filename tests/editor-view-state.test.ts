import { clampEditorViewSnapshot } from '../src/renderer/src/editor/editor-view-state'

declare function test(name: string, run: () => void): void
declare function expect<T>(actual: T): {
  toEqual(expected: T): void
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
