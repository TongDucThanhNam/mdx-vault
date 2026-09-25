# Developer editing DX — audit and evidence (2026-09-13, round 1)

Stage: research and evidence only. No product change is proposed for
implementation in this stage. Overall objective: make note input and React
interactive-component authoring feel credible to developers accustomed to
VS Code, Zed, and Word's smooth caret motion.

Dispatch: `dx-research-20260913-01`, correction round 1. Companion evidence:
[verification ledger](../verification/developer-dx-audit-2026-09-13.md).

Inputs read: `AGENTS.md`, `goals/README.md`, GOAL-27, `docs/security.md`, the
applicable local React/UI skills, and the task context at
`scripts/.zcode-dispatch/developer-dx-task.md` — the round-0 report wrongly
called this file missing; it resolves relative to the dispatch run directory
(`../developer-dx-task.md` from `scripts/.zcode-dispatch/dx-research-20260913-01/`),
not relative to the repository root. Two task-context facts shape this
revision: the user explicitly confirmed **both caret gliding and smooth
scrolling** as acceptance dimensions, and the stage must retain the five
"Remaining outcomes" in the recommended sequence with observable gates.
Prior metrics elsewhere are historical, not current proof; everything asserted
below was re-measured on 2026-09-13 unless explicitly marked otherwise.

Evidence classes used in this document:

- **Observed** — measured or reproduced locally in this audit (probe, code
  read, or upstream source inspection), with a file:line or artifact link.
- **Inferred** — a conclusion drawn from observed facts; the chain is stated.
- **Unverified** — believed or reported but not demonstrated here.
- **Proposal** — a recommendation; not a claim about current behavior.

## 1. How the current DX is built (observed)

### Shortcut resolution

- One window-level `keydown` listener dispatches workspace actions through a
  pure resolver with a context stack (`src/renderer/src/hooks/useKeyboardShortcuts.ts:69`,
  `src/renderer/src/input/keyboard-context.ts:33`,
  `src/shared/keybindings.ts:1057`). Focus ownership (`.cm-editor`, text input,
  dialog, explorer, reading surface) selects the context; `Picker`/`Settings`/
  `Dialog` block background actions; `Mod+P` and `Mod+W` are "modal hazardous"
  defaults while a modal is open (`src/shared/keybindings.ts:883`).
- Editor-owned keys (`Mod+F`, `Mod+B`, `Mod+A`, …) fall through to CodeMirror
  when focus is in an editor and no Editor-context action claims them
  (`src/shared/keybindings.ts:908`, `:1099`). Consequence (observed,
  intended): `Mod+B` is Markdown bold inside the editor
  (`src/renderer/src/editor/markdown-formatting.ts:25`) and toggles the left
  panel everywhere else (`src/shared/workspace-actions.ts:299`).
- Defaults match the two reference editors: `Mod+P` file open, `Mod+Shift+P`/`F1`
  command palette, `Mod+Shift+F` project search, `Mod+Shift+E` explorer focus
  (`src/shared/workspace-actions.ts:158`–`298`).
- User re-binding with conflict detection, reserved-key guards, and
  per-platform normalization is implemented (`src/shared/keybindings.ts:200`,
  `:597`, `:699`). Registration is treated as *not yet verified*: every
  workflow claim below was exercised live (§2).

### Ctrl+P quick open (QuickSwitcher)

- Modal dialog with an ARIA combobox: ArrowUp/ArrowDown move the selection,
  Enter opens, Escape cancels, Tab is contained, results are capped at 50, and
  an explicit "Create …" MDX-note row appears when the query matches no file
  (`src/renderer/src/explorer/QuickSwitcher.tsx:198`–`246`, `:56`–`67`).
- Matching scores title/alias/basename/path/extension/directory with
  prefix > word-start > substring > subsequence tiers
  (`src/renderer/src/workbench/file-finder.ts:239`–`308`), boosted by open/recent
  MRU ranks (`file-finder.ts:310`–`336`).
- It enumerates the full visible vault tree (`TREE_FILE_PATTERNS = ['**/*']`,
  `src/main/services/vault-service.ts:70`), so `.tsx`, `.json`, `.css` files
  are openable from Ctrl+P, not just notes.
- Surface close restores focus: cancel refocuses the invoker, completion
  focuses the active document (`src/renderer/src/hooks/useGlobalSurface.ts:47`–`74`).

### Ctrl+F current-file find

- All editable surfaces (note Source, note Live, text/TSX editors, and the
  interactive workbench's editors) share the same CodeMirror setup with
  `searchKeymap` and `search({ top: true })`
  (`src/renderer/src/editor/source-editor-setup.ts:12`, `:52`,
  `src/renderer/src/editor/MdxEditor.tsx:376`,
  `src/renderer/src/editor/TextFileEditor.tsx:74`).
- The installed `@codemirror/search@6.7.1` panel provides find, next/previous,
  select-all, match-case, regexp, whole-word, replace, and replace-all
  (`node_modules/@codemirror/search/dist/index.js:1052`–`1104`); `F3`/`Mod+G`
  find-next, `Escape` closes, `Mod+D` selects next occurrence, `Mod+Shift+L`
  selects all occurrences, `Mod+Alt+G` goes to line
  (`node_modules/@codemirror/search/dist/index.js:1043`–`1051`).

### Ctrl+Shift+F whole-vault search

- The SearchPane is a modal dialog over an FTS5 index. Query language: plain
  terms, `tag:`, `path:`, `file:`, `[property]`, and `/regex/` (flags `i`, `m`,
  `s`, `u`) (`src/renderer/src/search/SearchPane.tsx:151`,
  `src/main/services/db-service.ts:1258`–`1303`, `:1382`–`1438`). Debounced
  search-on-type at 180 ms, capped at 50 results in the UI call
  (`SearchPane.tsx:54`–`76`, `:59`).
- Content coverage is notes only: the indexer skips non-markdown paths
  (`isMarkdownPath` gate, `src/main/services/vault-index-runtime.ts:113`), and
  `.md`/`.mdx` are the only indexed patterns
  (`src/main/services/vault-service.ts:93`). `buildSearchableText` is
  title + relative path + body (`src/main/services/db-service.ts:1465`).
- Results are click/Enter targets. Enter opens the first result only
  (`SearchPane.tsx:116`–`119`); there is no arrow-key list navigation, no
  next/previous-result key, no replace, and no files-include/exclude inputs.
- Selecting a result opens the note and reveals the matched *section heading*
  when the FTS section query matched; body matches without a section match
  reveal nothing (`src/renderer/src/App.tsx:413`–`424`,
  `src/renderer/src/hooks/useEditorInteractions.ts:54`).

### React interactive authoring loop

Two distinct TSX editing experiences exist, and this audit keeps them separate
(round 0 conflated them):

- *Plain TSX text editing*: a root-level `.tsx` file opens in `TextFileEditor`
  with syntax highlighting and the shared find/multi-cursor surface, but no
  language intelligence — the intelligence extensions are attached only via the
  `intelligence` prop (`src/renderer/src/editor/TextFileEditor.tsx:45`, `:79`–`81`),
  which plain vault files do not receive.
- *Project TSX editing*: files under `interactives/<slug>/` route to
  `InteractiveProofWorkbench` (`src/renderer/src/components/layout/MainEditor.tsx:339`),
  which passes project intelligence (worker-backed completion, hover,
  signature, definition, references `Shift+F12`, rename `F2`, code actions
  `Ctrl+.`, diagnostics) into `TextFileEditor`
  (`src/renderer/src/interactive/interactive-code-intelligence.ts:40`–`77`).
  These capabilities were verified at GOAL-25/27 time; §2 records what the
  current probe could and could not reproduce today.
- Creation: `interactive.create` requires an editable note with a caret; the
  dialog derives a slug from a display name and the journey saves the note,
  creates the project, inserts the reference in one committed transaction, and
  opens the component in the workbench
  (`src/renderer/src/hooks/useInteractiveAuthoring.ts:112`–`170`;
  starter content in `src/shared/interactive-authoring.ts:152`–`200`).
- There is no formatter for MDX or TSX; GOAL-27 lists "formatter" out of scope
  (`goals/GOAL-27-single-pane-ide-intelligence.md:194`).

### Caret/cursor architecture (corrected from round 0)

Round 0 claimed the app "uses the browser's native caret" and that smooth
motion would need a new drawn overlay. That was wrong, and the generated
evidence repeated it as a constant. Measured and source-checked this round:

- The setup installs `drawSelection()`
  (`src/renderer/src/editor/source-editor-setup.ts:35`), which per the
  CodeMirror docs "hides the browser's native selection and cursor, replacing
  … the cursors with elements overlaid over the code (`cm-cursor-primary` and
  `cm-cursor-secondary`)" (`node_modules/@codemirror/view/dist/index.js:9477`–`9497`).
- Probe (observed): a `.cm-cursor.cm-cursor-primary` element exists in the
  active editor and the content element's computed `caret-color` is
  `rgba(0, 0, 0, 0)` — the native caret is hidden and the app already draws
  its own cursor (`docs/research/evidence/developer-dx-audit-2026-09-13/
  dx-audit-results.json` `motion_facts`).
- What CodeMirror gives today is cursor *drawing + blinking* (blink animation
  managed by the view package, `dist/index.js:9525`–`9547`). What does not
  exist is caret *gliding* — animated interpolation of the drawn cursor's
  position between buffer positions — or smooth scrolling (`scroll-behavior:
  auto` observed; `EditorView.scrollIntoView` jumps instantly,
  `MdxEditor.tsx:586`, `:600`).
- Inference (reassessed): caret gliding is a bounded feature on this
  architecture — animate the position of the already-drawn cursor element —
  not a rebuild of the cursor layer as round 0 claimed. The real design risks
  are integration (keeping the animated cursor from desynchronizing during
  IME composition and multi-cursor edits) and the interruptibility and
  reduced-motion requirements, not drawing.

## 2. Live reproduction (observed)

A narrow probe (`scripts/verify-dev-dx-audit.py`) ran the real Electron dev app
against a generated disposable vault with an isolated user-data directory.
The final run's launch receipt, recorded in the results JSON and the
[verification ledger](../verification/developer-dx-audit-2026-09-13.md),
verifies profile identity two ways: the probe refuses to mutate until the
declared profile's `app-settings.json` is absent (fresh profile), and after
mutating settings it confirms a non-default marker value
(`editorLineHeight: 1.7`) landed in that exact directory's `app-settings.json`.
An earlier round-1 attempt attached to a stray Electron process from a
previous run on the same CDP port (its "isolated" profile never received the
marker); the incident and the launcher fix (kill strays, confirm the port is
free before launch) are documented in the ledger.

### Shortcut × surface × focus matrix (observed, final run)

Every row below was exercised by real keypresses; full data in
`dx-audit-results.json` (`navigationMatrix`).

| Shortcut | Surface | Focus state | Outcome |
| --- | --- | --- | --- |
| Ctrl+P | note Source / note Live / plain `.tsx` / explorer tree | editor / editor / editor / tree row | opens picker — pass (4 rows) |
| Ctrl+P (repeat) | picker open | picker input | modal guard keeps the picker; no second action — pass |
| Ctrl+P (arrows+Enter) | second ranked option | picker input | opens it; focus lands in the document — pass |
| Ctrl+P (Escape) | picker | picker input | picker closes; focus returns to the editor — pass |
| Ctrl+F find | note Source | editor | panel opens; `F3` selects `sharp` — pass |
| Ctrl+F find | note Live | editor | panel opens; `F3` selects `sharp` — pass |
| Ctrl+F find | plain `.tsx` | editor | panel opens; `F3` selects `Probe` (case-insensitive default) — pass |
| Ctrl+F (Escape) | note Source | editor | panel closes; focus returns to editor — pass |
| Ctrl+F | explorer tree | tree row | no panel opens; `Mod+F` is unbound outside editors — pass (expected) |
| Ctrl+Shift+F | note Source / note Live / plain `.tsx` / explorer tree | as above | search dialog opens — pass (4 rows) |
| Ctrl+Shift+F | quick-open picker open | picker input | modal guard keeps the picker — pass |

Tooling limitation, stated instead of papered over: focus was not exercised
from the Settings dialog or the Reading surface. The context resolver treats
Settings as modal (source-audited, `keybindings.ts:1062`–`1092`), but no live
probe covers those two states yet; they belong in the next verification round.

### Dirty buffers (observed)

Typing an unsaved token shows the tab's "Unsaved changes" dot; the unsaved
buffer survives Ctrl+P→Escape, Ctrl+Shift+F→Escape, and a full tab switch away
and back (`stillDirty: true` after switching); `Mod+S` clears the indicator.
Observed values are in `dx-audit-results.json` (`dirty_buffer_*` checks).

### Search behavior (observed)

- `SHARP` matches `sharp` — the FTS default is case-insensitive (1 result).
- `/Sh(r|a)rp/` — regex filter works (1 result).
- `sharp path:notes` — path filter works (1 result, `notes/Alpha.mdx`).
- `bravo file:second` — file filter works (1 result, `notes/Second.mdx`).
- `/(unclosed` — surfaces "Invalid regex search: missing closing slash."
  instead of failing silently.
- A token existing only in `sample.tsx` returns "No matches." — the coverage
  gap (G-01) reproduced again.
- Deep-match reveal: Enter on a match at fixture line 801 of 1,602 opened
  `Large.mdx` with the caret at line 1603 — i.e. **no reveal at all this run**,
  while the round-0 run revealed to the section heading (line 799, two lines
  above the needle). The reveal is therefore not only heading-anchored and
  never selects the match — it is also nondeterministic across runs. Both
  runs' raw values are in the ledger; this strengthens G-02.

### React interactive authoring loop (observed, current)

Driven end-to-end through the real UI (command palette → New interactive →
dialog → workbench), in a fresh isolated vault, with the "Stateful control"
starter:

- **Create** — transactional create works today: the workbench region
  "Interactive Proof · counter-probe" appears with a valid snapshot and the
  starter's zero-capability proof auto-runs to `Ready · 0 problems`
  (`interactive_create_transactional`, `interactive_proof_*` checks).
- **Completion** — typing `const probe: num` opens the worker-backed TS
  completion popup (activateOnTyping); top options were `Number`,
  `PerformanceObserver`, … and Enter accepted `Number`. Finding: the ranked
  list put the `Number` *interface* above the `number` *primitive keyword* —
  a developer-credibility ranking gap versus VS Code, where the primitive
  sorts first (recorded; not historically claimed either way).
- **Diagnostics** — after completing the line to
  `const probe: Number = 'mismatch'`, the Problems ledger count updated to
  `Problems · 1` within ~10 s in a focused follow-up probe, but **no editor
  lint markers** (`.cm-lintMarker`/`.cm-diagnostic`) appeared within 20 s
  (reproduced twice). The worker computes diagnostics and the Problems/proof
  surfaces react; the editor-marker surface did not, at the inserted final
  line, in this environment. Recorded as an open current-workflow discrepancy,
  not as a pass and not as a diagnosed root cause.
- **Safe preview** — the isolated proof frame was present with
  `sandbox="allow-scripts"` and a `mdx-vault-sandbox://docu…` src protocol —
  the security contract holds in the current build (screenshot
  `interactive-proof-ready.png`).
- **Undo** — a single `Ctrl+Z` removed the last typed segment as one step
  (recorded verbatim in `interactive_undo_step`).
- **Input latency in the workbench TSX editor** — measured separately (below).

### Input latency (observed; dev build, unminified, HMR, DevTools attached)

Metric: `keydown` → next `requestAnimationFrame`, typed at 25 ms intervals, no
concurrent heavy checks. **This is a scheduling proxy.** It bounds when the
editor's input handling completes relative to frame boundaries; it does not
prove that the new text was presented in that frame, and it is not hardware
input latency. The large fixture is 1,602 lines / 24,253 characters (round 0
misdescribed it as "800 lines").

| Surface | keys | p50 | p95 | max | long tasks |
| --- | --- | --- | --- | --- | --- |
| Small note (Source) | 33 | 11.0 ms | 55.6 ms | 70.1 ms | 3 |
| Large note (1,603 CM lines) | 34 | 19.8 ms | 91.0 ms | 105.8 ms | 8 (worst ~106 ms) |
| Plain `.tsx` | 36 | 14.5 ms | 60.2 ms | 66.2 ms | 3 |
| Workbench TSX (authoring) | 35 | 18.3 ms | 65.2 ms | 67.3 ms | 7 |

Reading, carefully bounded: the large note's median (19.8 ms) already exceeds
one 60 Hz frame (16.7 ms) and its tail reaches ~106 ms, so editing cost on
large documents is a live risk, not a resolved question. These are dev-build
numbers and cannot be compared to Zed's native-renderer claims; a production
build measurement with an accepted budget is an explicit gate in §6
(outcome 5).

### Composition/IME (observed with stated limits)

The probe drove Chromium's IME pipeline directly over CDP
(`Input.imeSetComposition` then commit) on a note editor: `compositionstart`
and `compositionupdate` (data `"Tiếng"`) fired on the CodeMirror content
element and the committed buffer was exactly `"IME: Tiếng"` — composed text
entered once, with no duplication. Limits, stated plainly: `compositionend`
was not observed on the probed node in this CDP path, and a CDP-synthesized
composition is still not an OS Vietnamese Telex/IME session. OS-level IME
remains unverified and carries a concrete verification design in §6
(outcome 5).

### Motion facts (measured, final run)

`drawnCursorPresent: true` (`cm-cursor cm-cursor-primary`),
`nativeCaretColor: rgba(0, 0, 0, 0)` (native caret hidden),
`editorScrollBehavior: auto`, `prefers-reduced-motion: false` in the probe
session. The blink duration was not captured at measure time (empty inline
style on the cursor element); blinking exists as an animation the view package
restarts (`@codemirror/view/dist/index.js:9525`–`9547`), and its rate facet
defaults to 1200 ms (`dist/index.js:9470`).

## 3. Upstream research (observed from cited sources)

### Zed — docs, settings, and upstream source

Docs and settings (round-0 citations, still valid): default Windows keymap
@ `main` (`assets/keymaps/default-windows.json`: `ctrl-p file_finder::Toggle`,
`ctrl-shift-f pane::DeploySearch`, `ctrl-shift-h` with `replace_enabled`,
`ctrl-f buffer_search::Deploy`, `ctrl-h DeployReplace`, `ctrl-g go_to_line`,
`ctrl-shift-e` project panel); settings reference
(`https://zed.dev/docs/reference/all-settings`): search defaults
`case_sensitive/regex/whole_word: false`, `search_on_type: true`,
`center_on_match: false`, `seed_search_query_from_cursor: always`, scrollbar
`search_results: true`; project search results open in an editable multibuffer
(`https://zed.dev/docs/finding-navigating`, `https://zed.dev/docs/multibuffers`).

Upstream implementation source, inspected this round via the GitHub API at
identified revisions:

- **Cursor glide exists upstream, is opt-in, and respects reduced motion.**
  `crates/editor/src/cursor_animation.rs` @ `2988a5924121` (2026-09-04):
  a damped-spring animation of each drawn cursor corner with
  `ANIMATION_LENGTH_SECONDS = 0.125` (125 ms), short jumps 50 ms, snaps 20 ms,
  per-frame cap `MAX_FRAME_DURATION = 33 ms`, and hard reset beyond 75 ms.
  `crates/editor/src/element.rs` @ `002161d5ba8d` (2026-09-09),
  `paint_cursors`: animation runs only when
  `EditorSettings::get_global(cx).cursor_animation.enabled && !cx.reduce_motion()`.
  `crates/editor/src/editor_settings.rs` @ `2988a5924121` maps the
  user-facing `cursor_animation.enabled` setting, and
  `assets/settings/default.json` ships `"cursor_animation": { "enabled": false }`.
  Zed draws its own cursors in GPUI (`CursorShape::Bar/Block/Hollow` bounds in
  `element.rs:10544`–`10548`), so gliding an owned cursor — the same
  architecture CodeMirror's `drawSelection` gives this app.
- **Buffer scrolling is not smoothed upstream.**
  `crates/editor/src/scroll.rs` @ `0ad5441b5370` (2026-08-14) contains only
  scrollbar timing and a 10 ms wheel timer — no easing. GPUI's easing/spring
  infrastructure exists (`crates/gpui/src/spring.rs`,
  `crates/gpui/src/elements/animation.rs`) but is applied to UI elements, not
  to editor buffer scroll, at the inspected revisions. Inference: smooth
  *scrolling* in mdx-vault would exceed both references as-shipped; it is a
  user-confirmed acceptance dimension here, so it must be built deliberately
  (opt-in, interruptible, reduced-motion aware) rather than copied.
- **IME is a native, first-class path upstream.**
  `crates/editor/src/input.rs` @ `595d62863e8a` (2026-09-10): GPUI
  `InputHandler` with `marked_text_ranges`-aware composition replacement
  (multi-cursor IME fanning documented in-code), composition text highlights
  (`HighlightKey::InputComposition`), and `bounds_for_range` for candidate-window
  positioning. Electron gives this app Chromium's IME bridge instead; the
  measurable consequence appears in §2's composition evidence and its limits.
- Zed's engineering posts report frame times "under 4 ms" and a presentation
  pipeline tuned for stable 120 FPS (`https://zed.dev/blog/120fps`) — context
  for the latency gap, not a benchmark this Electron app can claim.
- Zed's local settings on this machine set `buffer_font_size: 15`, matching
  the app's editor default; provider/agent configuration was inspected
  read-only and is not reproduced here.

### VS Code

- Search view: `Ctrl+Shift+F`, `Ctrl+Shift+H` replace in files, `F4`/`Shift+F4`
  result navigation, case/word/regex toggles, files-include/exclude
  (`https://code.visualstudio.com/docs/editing/searching`,
  `https://code.visualstudio.com/shortcuts/keyboard-shortcuts-windows.pdf`,
  microsoft/vscode#172894).
- Find control: `Ctrl+F`, `F3`/`Shift+F3`, `Alt+C/R/W`,
  `Enter`/`Shift+Enter` (`https://code.visualstudio.com/docs/editing/codebasics`).
- Editor motion @ `main` (`src/vs/editor/common/config/editorOptions.ts`):
  `cursorSmoothCaretAnimation` defaults `'off'` (`'off' | 'explicit' | 'on'`),
  `smoothScrolling` defaults `false`, `cursorBlinking` defaults `'blink'`,
  `cursorSurroundingLines` defaults `0`. Together with Zed's
  `cursor_animation.enabled: false` default (above), **both reference editors
  ship caret gliding and smooth scrolling as opt-in** (observed from source);
  this app currently ships neither.

### Microsoft animation guidance

- WinUI standard durations: `ControlNormalAnimationDuration` 250 ms,
  `ControlFastAnimationDuration` 167 ms, `ControlFasterAnimationDuration`
  83 ms; entrance easing fast-out/slow-in `cubic-bezier(0, 0, 0, 1)`, exit
  slow-out/fast-in `cubic-bezier(1, 0, 1, 1)`
  (`https://learn.microsoft.com/en-us/windows/apps/design/motion/timing-and-easing`,
  doc revision `446db84b79ce288e9e8ed5e9abde80d45d142edf`).
- Fluent 2 motion frames duration + easing as the core of perceived
  responsiveness (`https://fluent2.microsoft.design/motion`); Office exposes a
  system-level "turn off animations" preference
  (`https://support.microsoft.com/en-us/office/turn-off-office-animations-9ee5c4d2-d144-4fd2-b670-22cef9fa025a`) —
  the product-level precedent that editor motion must be suppressible.

### CodeMirror facts (observed in installed packages)

- `@codemirror/search@6.7.1`: keymap and panel inventory as in §1; search state
  carries `caseSensitive`, `regexp`, `wholeWord`, `searchOnType`.
- `@codemirror/commands@6.10.4`: history `newGroupDelay: 500`,
  adjacency-gated joining (`dist/index.js:212`).
- `@codemirror/view`: `drawSelection` (cursor overlay + hidden native caret),
  `cursorBlinkRate` facet (1200 ms default), blink animation restart
  (`dist/index.js:9470`–`9547`); `scrollIntoView`/programmatic scroll are
  instant — no animated-scroll API exists in the installed version
  (observed by absence in `dist/index.js` exports).

## 4. Gap register (ranked)

Severity weighs how strongly a VS Code/Zed-shaped developer notices, whether a
*workflow* breaks, and fit with `docs/security.md` and GOAL-27. GOAL-27
conflicts are flagged, never worked around.

### G-01 — Whole-vault search cannot see code (P0, workflow break)

Reproduced again this run: a `.tsx`-only token returns "No matches."; the
index ingests only `.md`/`.mdx` (`vault-index-runtime.ts:113`,
`vault-service.ts:93`). Zed/VS Code search all text files. A bounded
read-only text search (main-process, `safeJoin`-rooted, size/count bounded) or
a second FTS table for text files fits the security model; it must not broaden
write paths.

### G-02 — Search results are not keyboard-navigable, and reveal is unreliable (P0, workflow break)

Reproduced: ArrowDown stays in the input; Enter opens only the first result;
the match itself is never selected or highlighted. New this round: the
heading reveal is *nondeterministic* — round 0 landed on the needle's section
heading (line 799 for 801), the round-1 run did not reveal at all (caret at
line 1603). The app already owns a range-reveal path
(`revealSourceRangeRequest`, `MdxEditor.tsx:592`); the search IPC simply does
not return match offsets today, and the open→reveal handoff races.

### G-03 — No caret gliding, no smooth scrolling, and no reduced-motion story (P1, the dispatch's core feel gap — user-confirmed acceptance dimensions)

Measured: the drawn cursor never interpolates (no glide), scrolling is
instant, reveals jump. Corrected architecture basis (§1): the app already
draws its own cursor via `drawSelection`, so gliding animates an existing
element. Upstream precedent (observed): Zed ships exactly this as opt-in
`cursor_animation` (125 ms damped spring; 20 ms snaps; 33 ms frame cap;
disabled under `reduce_motion`); VS Code ships `cursorSmoothCaretAnimation`
and `smoothScrolling`, both default-off. The task context confirms the user
wants both dimensions. Proposal constraints: interruptible by input (any
keypress/scroll cancels in-flight motion within a frame), off under
`prefers-reduced-motion` plus an app toggle, never delay text mutation
(caret position logic is correct before animation settles — matches the
damped-spring model's reset-on-jump behavior).

### G-04 — QuickSwitcher lacks match highlighting and line/symbol jumps (P1)

Observed: no highlighted matched substrings, no `:line`/`@symbol` prefixes
(VS Code quick open supports both), 50-result cap with no "n more" indicator,
no inline preview. Matching/ranking is already competitive.

### G-05 — Editor find panel misses VS Code-grade feedback (P2)

Observed: case/regex/word/replace/replace-all all present (verified across
Source/Live/TSX this run), but no match-count display, no search history.

### G-06 — Interactive completion ranking (P2, current-workflow finding)

Observed: the project TS completer ranked `Number` (interface) above `number`
(primitive) and the probe accepted the wrong-case item via Enter. Small
fix-space, high credibility signal for React authors. (New finding from the
current run; not previously claimed.)

### G-07 — Diagnostics do not surface as editor markers in the workbench (P2, current-workflow discrepancy)

Observed: a type error in the workbench TSX updated the Problems ledger
(`Problems · 1`) and gated the proof state within ~10 s, but no editor lint
markers appeared within 20 s (reproduced twice, at the document's final line).
Historic GOAL-25/27 evidence says editor diagnostics work; the current probe
could not reproduce that surface. Recorded as an open discrepancy with the
repro in the probe; needs root-cause in the implementation stage, not a
workaround here.

### G-08 — No replace-in-files (P2; GOAL-27 conflict if done naively)

No replace capability outside the current buffer; VS Code (`Ctrl+Shift+H`) and
Zed (`ctrl-shift-h`, editable multibuffer) both have it. Multi-file writes are
exactly what GOAL-27 and `docs/security.md` forbid ("Do not add a multi-file
write IPC"), and Zed's editable-multibuffer pattern contradicts the
single-pane constraint. Flag: delivering this requires an explicit goal
amendment with a scoped, reviewed, per-file write protocol.

### G-09 — No formatter for MDX/TSX (P2; GOAL-27 out of scope by decision)

No formatting command or format-on-save exists; GOAL-27 lists "formatter" out
of scope. If developer credibility demands it, that is a goal-level decision.

### G-10 — Large-document typing tail (P2, measured risk)

Large note (1,603 CM lines): p50 19.8 ms — already over one 60 Hz frame —
p95 91 ms, max ~106 ms, 8 long tasks. Dev-build numbers; the acceptance
budget and production measurement are gates in §6, not settled here.

### G-11 — IME evidence ceiling (P2, verification debt, not a known defect)

CDP composition enters Vietnamese text correctly; OS-level IME sessions remain
unverified. Concrete verification design in §6 (outcome 5).

### Non-gaps worth defending (observed)

Focus restoration on Escape vs completion is correct everywhere probed
including explorer-tree focus; shortcut context arbitration (editor-owned
keys, modal guards) held in all 17 matrix rows; quick-open covers non-note
files; dirty-buffer preservation is correct through pickers, search, and tab
switches; undo grouping matches CodeMirror/VS Code semantics; the authoring
loop's transactional create + lazy worker + sandboxed proof held in the live
run (`sandbox="allow-scripts"`, `mdx-vault-sandbox://` protocol).

## 5. Can CodeMirror be retained? (honest comparison)

Observed basis: every audited gap is implementable within the current owned
CodeMirror 6 setup using public APIs or main-process work.

- **Retain (recommended).** The cursor is already app-drawn (`drawSelection`),
  so caret gliding is an animation on an owned element (Zed does the same to
  its GPUI-drawn cursors); search/navigation gaps are IPC+UI work; latency is
  frame-competitive at median. Monaco is forbidden by GOAL-27 constraints; a
  native GPUI-style renderer is a platform rewrite, not an editor choice.
- **The hard parts are interaction-integrity, not drawing:** glide must freeze
  or snap during IME composition and multi-cursor edits (Zed resets the spring
  on jumps and caps frames at 33 ms — same document, `cursor_animation.rs`),
  and smooth scrolling must yield instantly to user scroll.
- Do not switch to Monaco or a fork: constraint non-compliance plus re-owning
  everything audited above for no measured win on this stack.

## 6. Recommended sequence (proposals, mapped to the task context's five remaining outcomes, each with observable gates)

1. **Outcome 1 — agree budgets.** Ratify this gap ranking and the acceptance
   budgets below with the main task before any implementation.
   Gate: signed-off budget table.
2. **Outcome 2 — navigation/find/search workflow gaps (G-01, G-02, G-04,
   G-05).** Code-file coverage; match offsets from search; keyboard-navigable
   results with next/previous; reveal the exact range (existing
   `revealSourceRangeRequest`) with a deterministic handoff; match
   highlighting; `:line`/`@symbol` quick-open; find-panel match count.
   Gates: probe asserts — TSX token found; ArrowDown moves the active result;
   opened note has a selection spanning the match; reveal lands within ±2
   lines of the needle in 5/5 runs; quick-open `:line` lands the caret on the
   requested line. All re-runnable via `scripts/verify-dev-dx-audit.py`.
3. **Outcome 3 — input correctness, scheduling, and opt-in motion (G-03).**
   Caret gliding on the existing drawn cursor + smooth scrolling, both opt-in,
   interruptible by any input within one frame, disabled under
   `prefers-reduced-motion`, durations from a DESIGN.md token set referencing
   the Microsoft ramps (83/167/250 ms) and Zed's 125 ms spring; text mutation
   never waits for animation.
   Gates: animation settles ≤ 150 ms for intra-paragraph caret moves;
   any keypress cancels in-flight motion within one frame;
   `prefers-reduced-motion` yields zero animation; caret/selection logic
   correct at animation start (buffer positions, undo, IME composition
   unaffected); dev-build large-note median does not regress beyond +2 ms
   while motion runs.
4. **Outcome 4 — React authoring loop and language tooling within trust
   boundaries (G-06, G-07).** Rank primitives over interfaces; root-cause the
   editor-marker surface for workbench diagnostics; keep the proof/consent
   security contract unchanged.
   Gates: probe — completion list shows `number` before `Number`; editor
   markers render for an end-of-document type error within 10 s; Problems
   count and editor markers agree; proof frame keeps `sandbox="allow-scripts"`
   with the sandbox protocol and zero-capability consent path.
5. **Outcome 5 — integrated dev/production keyboard, IME, and performance
   verification.** Run the probe against the production build
   (`bun run build`; separate user-data dir + CDP, as the existing
   `verify-editor-workers-production.py` pattern does), plus a manual
   OS-level Vietnamese IME session on Windows (Telex engine: type composed
   syllables mid-buffer, edit inside composition, cancel composition with
   Escape, verify undo grouping around commits) with the CDP composition
   probe as the automated regression baseline.
   Proposed budgets to ratify (proposal, not measurement): production
   keydown→presentation p95 ≤ 2 frames (≤ 33.4 ms) on a 1,600-line note; no
   keystroke-adjacent long task > 50 ms at p99; native-IME session commits
   byte-identical text with no duplication and correct caret.

Security/constants check: outcomes 2–4 need no new broad IPC, no renderer
write paths, no network, and no trust-level change; G-08 (replace-in-files)
and G-09 (formatter) cannot be built inside current constraints and require a
goal amendment first.

## 7. Observed vs. inferred vs. unverified — summary

- Observed: §1–§2 with file:line or artifact links (including the corrected
  cursor architecture and the explorer-tree shadow-DOM detail); Zed upstream
  source at identified revisions (§3); CodeMirror package facts.
- Inferred: caret gliding feasibility on the drawn-cursor architecture;
  smooth scrolling exceeding both references as-shipped; large-note editing
  cost as a live risk (dev build); G-01/G-02 fixes compatible with the
  security model.
- Unverified: production-build latency; OS-level IME; Settings-dialog and
  Reading-surface focus states; the root cause of G-07 (editor markers);
  VS Code/Zed behaviors cited from docs/source but not executed; anything in
  files not read.
- Proposals: §5 retention recommendation; §6 sequence, budgets, and gates.
