# GOAL-22 Windows live verification

- Date: 2026-07-21
- Build identity: `adb7c0a` plus the reviewed GOAL-22 working-tree diff
- Platform: Windows 11 (`10.0.26200`), Electron `39.8.10`, Bun `1.3.14`
- Fixture boundary: a randomized `%TEMP%/mdx-vault-goal22-live-*` directory containing
  `vault-a`, `vault-b`, and an isolated Electron `userData` directory. No repository
  vault or real application profile was used.
- Final disposable settings: system theme, name sort, `13.5px` editor font,
  history-based close activation, `keep_window_open`, and an empty keymap override map.

## Result

The Windows single-pane workbench path is operational. File Finder, transactional
open/close behavior, visual and MRU tab navigation, focus ownership, settings/keymap
updates, native no-tab window policy, and the existing MDX/sandbox surfaces passed in
the disposable app. The table deliberately keeps unobserved cases visible: live macOS
was unavailable; the destructive in-app delete click needs action-time confirmation;
the second-vault picker was cancelled rather than committed; and the live edit/close
used the text fixture rather than manufacturing another note mutation. Deterministic
lifecycle/state tests supplement those observations without being labelled as live.

## Live scenario record

| # | Result | Evidence |
|---|--------|----------|
| 1 | Pass | `Ctrl+P` found MDX by title/alias and opened CSV, JSON, TSX, PNG, unsupported binary, and duplicate basenames distinguished by path. Image decode and unsupported fallback were visible. |
| 2 | Pass with deterministic supplement | Reopening an already-open path from Finder and Explorer kept exactly one tab, and Search returned the active disposable note. Wikilink/definition routes use the same coordinator and have deterministic target/registry coverage; definition-route dedupe was not claimed as a separate live observation. |
| 3 | Pass | Escape cancellation and Settings backdrop dismissal closed only the owned surface. Backdrop dismissal restored focus to the originating CodeMirror document; successful opens focused the destination document. |
| 4 | Pass with deterministic note supplement | An immediate edit then `Ctrl+W` persisted the exact disposable CSV buffer before the tab disappeared. The equivalent immediate note edit and injected note-item save/load failures are deterministic controller evidence; an additional live note mutation was not manufactured solely to duplicate that path. |
| 5 | Pass | Close button, middle-click, keyboard, and palette close paths were exercised for inactive, active, and last tabs. History/right/left policies applied live. `keep_window_open` left a stable empty workbench; `close_window` closed the native window only on the next close command with no tabs. |
| 6 | Pass | Visual `Ctrl+PageUp/PageDown`, tab roving focus with arrow/Home/End and Enter, forward/reverse MRU, Escape cancellation, and reopen were exercised. Repeated `Ctrl+Tab` kept the original document active while moving the transient choice, then committed exactly once on modifier release. |
| 7 | Partial, safety-gated | Rename updated tab, breadcrumb, and Explorer in place. Clean external deletion retained a missing tab without recreation; dirty external deletion paused autosave and supported Cancel/Discard without path recreation. The native vault picker was surfaced and cancelled safely. In-app delete awaits explicit destructive-action confirmation; delete lifecycle and vault-reset state transitions use deterministic evidence, and a successful same-session switch is not claimed as live. |
| 8 | Pass | `Ctrl+Shift+E` showed/focused/returned from Explorer; `Ctrl+B` toggled the left panel without changing the active item. Export remained reachable. |
| 9 | Pass | Settings, confirmation, and key-recorder ownership prevented `Ctrl+W`, `Ctrl+P`, and other workspace chords from mutating background tabs or stacking pickers. The unbound `Ctrl+P` case was rechecked while Settings remained open. |
| 10 | Pass with registry supplement | A second File Finder binding updated execution and visible settings/palette labels, survived a real Electron restart, was explicitly unbound, and then reset. The persisted override map ended as `{}` and default `Ctrl+P`, `Ctrl+Shift+P`, and `F1` execution returned. AppMenuBar label derivation from the same effective registry is covered by the action/menu tests rather than claimed as a separate screenshot observation. |
| 11 | Pass | Conflict cancellation preserved both actions; explicit replacement moved the chord once and left only one dispatcher owner. The displaced command's visible bindings updated, then both rows were reset. |
| 12 | Partial, deterministic supplement | CodeMirror copy, plain paste, undo, and ordinary navigation preserved exact text. `Ctrl+Shift+V` is no longer a global view-mode chord. Settings/key-recorder inputs retained input ownership, but clipboard/undo was not repeated inside the protected empty AI key field and no credential-like value was persisted. IME, input ownership, composition, and platform routing are covered by resolver tests; live IME/macOS observation remains unclaimed. |

## Existing-surface smoke record

- General settings changed theme and FileTree sort live, then returned to system/name.
- Editor font changed from `13.5px` to `14px` in the active CodeMirror surface and
  returned to `13.5px`.
- AI settings loaded through the protected service without returning a stored key.
- Project Search returned the expected disposable note and closed back to document
  focus; New Note opened and cancelled without creating a file.
- Source/Live/Reading modes, native MDX callouts, image preview, editable text,
  wikilinks, and a reviewed `allow-scripts` sandbox island remained operational.
  Component-definition target resolution retained its deterministic suite.

## Automated evidence

| Command | Result |
|---------|--------|
| `bun test` | 226 passed, 0 failed across 43 files (1,490 assertions) |
| `bun run typecheck` | Exit 0 |
| `bun run lint` | Exit 0; 285 files checked, no fixes |
| `bun run build` | Exit 0; Electron main/preload and renderer production bundles completed |
| `git diff --check` | Exit 0; only Git's existing LF-to-CRLF working-copy warnings |

Focused suites cover workbench state/controller/resource transactions, editor adapters
and view state, action registry, keybinding resolution/context/recorder behavior, File
Finder ranking, Settings v3 persistence/reconciliation/catalog/IPC, native menu policy,
test-userData isolation, image staging/object-URL cleanup, and safe vault file probes.

## Explicit platform and safety limits

- macOS native-menu behavior is source- and unit-tested but was not live-tested.
- A real in-app delete click is intentionally not claimed. It may be added to this
  report only after the user grants action-time confirmation for deleting a named
  disposable fixture.
- A successful same-session native picker switch, immediate dirty MDX close, and
  clipboard/undo repetition inside the protected AI field remain explicit partial
  observations in the scenario table.
- No screenshot is retained because the successful states were unambiguous and the
  live pass must not capture unrelated desktop surfaces or private paths.
