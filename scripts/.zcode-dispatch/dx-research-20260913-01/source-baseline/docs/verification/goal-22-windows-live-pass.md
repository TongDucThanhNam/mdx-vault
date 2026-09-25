# GOAL-22 Windows live verification

- Date: 2026-07-21
- Implementation build: `9975384` (`fix: harden goal 22 workbench behaviors`), on top of
  `d982363` (`feat: add zed-like workbench navigation`)
- Platform: Windows 11 (`10.0.26200`), Electron `39.8.10`, Bun `1.3.14`
- Fixture boundary: a randomized `%TEMP%/mdx-vault-goal22-live-*` directory containing
  `vault-a`, `vault-b`, and an isolated Electron `userData` directory. All mutations
  and persistence checks used those disposable fixtures and never the real application
  profile. During the final native-picker run, its remembered folder was inadvertently
  selected once, so repository `example-vault` opened briefly without editor input or
  an explicit save; the dirty-path inventory was unchanged and the run immediately
  returned to the disposable pair.
- Final disposable settings: system theme, name sort, `13.5px` editor font,
  history-based close activation, `keep_window_open`, and an empty keymap override map.

## Result

The Windows single-pane workbench path is operational. File Finder, transactional
open/close behavior, visual and MRU tab navigation, per-tab view restoration, focus
ownership, settings/keymap updates, native no-tab window policy, direct disposable-vault
switching, protected-input editing, and the existing MDX/sandbox surfaces passed in the
disposable app. The table keeps unobserved cases visible: live macOS and IME were
unavailable, and the destructive in-app delete click still needs action-time
confirmation. Deterministic component/lifecycle/state tests supplement those
observations without being labelled as live.

## Live scenario record

| # | Result | Evidence |
|---|--------|----------|
| 1 | Pass | `Ctrl+P` found MDX by title/alias and opened CSV, JSON, TSX, PNG, unsupported binary, and duplicate basenames distinguished by path. Image decode and unsupported fallback were visible. |
| 2 | Pass with deterministic supplement | Reopening an already-open path from Finder and Explorer kept exactly one tab, and Search returned the active disposable note. The Reading surface rendered the resolved disposable wikilink, but Windows UI Automation did not expose its inline button reliably enough to claim the click as live. The real preview component test proves accessible button activation resolves the canonical path; definition targeting and the shared `openOrActivate` dedupe route remain deterministic coverage. |
| 3 | Pass | File Finder, Command Palette, and Settings were each cancelled with Escape and reopened for backdrop dismissal. Every path closed only the owned surface and restored the exact prior CodeMirror selection; successful Finder opens focused the destination document. |
| 4 | Pass | Immediate edits followed by `Ctrl+W` persisted the exact disposable CSV and MDX buffers before their tabs disappeared. Injected note-item save/load failures remain deterministic controller evidence. |
| 5 | Pass | Close button, middle-click, keyboard, and palette close paths were exercised for inactive, active, and last tabs. History/right/left policies applied live. `keep_window_open` left a stable empty workbench; `close_window` closed the native window only on the next close command with no tabs. |
| 6 | Pass | Visual `Ctrl+PageUp/PageDown`, tab roving focus with arrow/Home/End, Enter, Space, and Delete, forward/reverse MRU, Escape cancellation, and reopen were exercised. Repeated `Ctrl+Tab` kept the original document active while moving the transient choice, then committed exactly once on modifier release. Switching between the two notes also restored independent Source/Reading modes, a backward selection, and the prior scroll position. |
| 7 | Partial, safety-gated | Rename updated tab, breadcrumb, and Explorer in place. Clean external deletion retained a missing tab without recreation; dirty external deletion paused autosave and supported Cancel/Discard without path recreation. A direct `vault-b` → `vault-a` switch with two B tabs open reset the workbench, reopened the identical `notes/Renamed Welcome.mdx` path with A content, updated Settings to A, and leaked no B tab or buffer. In-app delete still awaits explicit destructive-action confirmation; its lifecycle has deterministic transaction coverage. |
| 8 | Pass | `Ctrl+Shift+E` showed/focused/returned from Explorer; `Ctrl+B` toggled the left panel without changing the active item. Export remained reachable. |
| 9 | Pass | Settings, confirmation, and key-recorder ownership prevented `Ctrl+W`, `Ctrl+P`, and other workspace chords from mutating background tabs or stacking pickers. The unbound `Ctrl+P` case was rechecked while Settings remained open. |
| 10 | Pass with component supplement | A second File Finder binding updated execution and visible Settings/Palette labels, survived a real Electron restart, was explicitly unbound, and then reset. The persisted override map ended as `{}` and default `Ctrl+P`, `Ctrl+Shift+P`, and `F1` execution returned. The AppMenuBar integration test additionally proves a custom effective binding updates its hint and an explicit unbind removes it. |
| 11 | Pass | Conflict cancellation preserved both actions; explicit replacement moved the chord once and left only one dispatcher owner. The displaced command's visible bindings updated, then both rows were reset. |
| 12 | Pass with deterministic platform supplement | CodeMirror copy, plain paste, undo, live Windows redo with `Ctrl+Y`, and ordinary navigation preserved exact text; the redo marker was then undone and confirmed absent on disk. `Ctrl+Shift+V` is no longer a global view-mode chord. A non-sensitive Settings-search value was copied, pasted into the protected AI key field, then removed with undo; Save was never invoked and no credential-like value was persisted. IME composition and platform routing retain deterministic resolver coverage; live macOS observation remains unclaimed. |

## Existing-surface smoke record

- General settings changed theme and FileTree sort live, then returned to system/name.
- Editor font changed from `13.5px` to `14px` in the active CodeMirror surface and
  returned to `13.5px`.
- AI settings loaded through the protected service without returning a stored key.
- Project Search returned the expected disposable note and closed back to document
  focus; New Note opened and cancelled without creating a file.
- Source/Live/Reading modes, native MDX callouts, image preview, editable text, the
  rendered wikilink, and a reviewed `allow-scripts` sandbox island remained visible.
  Reading-button navigation and component-definition target resolution retain direct
  deterministic suites because their exact gestures were not claimed as live UIA input.

## Automated evidence

| Command | Result |
|---------|--------|
| `bun test` | 245 passed, 0 failed across 47 files (1,721 assertions) |
| `bun run typecheck` | Exit 0 |
| `bun run lint` | Exit 0; 291 files checked, no fixes |
| `bun run build` | Exit 0; Electron main/preload and renderer production bundles completed |
| `git diff --check` | Exit 0; only Git's existing LF-to-CRLF working-copy warnings |

Focused suites cover workbench state/controller/resource and vault-switch transactions,
real CodeMirror undo/redo, direct cursor/selection/scroll restoration, action registry,
keybinding resolution/context/recorder behavior, File Finder ranking, legacy Palette
pin/recent migration, effective AppMenuBar hints, Reading wikilink activation, Settings
v3 persistence/reconciliation/catalog/IPC, native menu policy, test-userData isolation,
image staging/object-URL cleanup, and safe vault file probes.

## Explicit platform and safety limits

- macOS native-menu behavior is source- and unit-tested but was not live-tested.
- A real in-app delete click is intentionally not claimed. It may be added to this
  report only after the user grants action-time confirmation for deleting a named
  disposable fixture.
- Live IME composition was not separately exercised; its routing remains covered by
  the deterministic keyboard resolver tests.
- Windows UI Automation did not expose the inline Reading wikilink button reliably;
  the report therefore does not claim its activation or the modifier-based definition
  gesture as live. Both routes retain direct component/target and shared transaction
  coverage.
- The final native-picker run briefly opened repository `example-vault` as described
  in the fixture boundary. No editor input or explicit save occurred, and the same
  dirty-path inventory remained after the run.
- No screenshot is retained because the successful states were unambiguous and the
  live pass must not capture unrelated desktop surfaces or private paths.
