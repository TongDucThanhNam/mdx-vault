# Editor readability and typing — research and decisions

Date: 2026-09-05. Scope: GOAL-27 follow-up, one existing editor pane.
User priority: “Font, khoảng cách và bố cục khó đọc.”

## Outcome

Source and Live now use self-hosted JetBrains Mono at 15px with 24px line height
for new defaults. Existing saved choices remain intact; the appearance control
beside Source/Live applies the Comfortable preset in one action. Reading keeps
its editorial typography. Typography was the user's first priority, but actual
typing traces also exposed parsing and React work that needed fixing.

This is a measured improvement to mdx-vault, not a claim of VS Code feature
parity or Zed rendering performance.

## Primary-source findings and application

| Evidence | Decision in this app |
| --- | --- |
| VS Code documents predictable selection, indentation and multiple-cursor editing. [Basic editing](https://code.visualstudio.com/docs/editing/codebasics) | Tab at a caret inserts to the next indentation stop; a selection indents lines; multiple carets remain independent. Existing undo, navigation and formatting commands stay intact. |
| VS Code documents explicit suggestion invocation and Tab/Enter acceptance. [IntelliSense](https://code.visualstudio.com/docs/editing/intellisense) | Tab must accept an already visible registry suggestion, not indent `<Qui`. Retain CodeMirror's highest-precedence snippet-field navigation. |
| CodeMirror distinguishes displayed tab width from indentation unit; its completion keymap does not itself bind Tab. [Reference manual](https://codemirror.net/docs/ref/) | Install `indentUnit` alongside `EditorState.tabSize`, and an owned high-precedence Tab binding. Keep the completion interaction guard instead of disabling it globally. |
| Zed separates interface and buffer fonts and exposes font size/line height/ligature choices. [Appearance](https://zed.dev/docs/appearance), [settings reference](https://zed.dev/docs/reference/all-settings) | Keep readable interface labels distinct from the code face. Expose the frequently adjusted typography controls beside the editor, with a live sample, rather than only inside Settings. Values here are our choices, not copied Zed defaults. |
| JetBrains describes increased lowercase height, differentiated ambiguous glyphs and language coverage. [JetBrains Mono](https://www.jetbrains.com/lp/mono/) | Use it as a readability-oriented starting point, bundle its Vietnamese subset locally, and show `0O 1lI` plus Vietnamese in the sample. Keep alternative fonts; there is no universal best font. |
| Zed distinguishes code completion from AI edit prediction. [Completions](https://zed.dev/docs/completions) | Improve explicit, deterministic completion without introducing ghost text, network suggestions or unsolicited AI writing. |
| Zed's engineering discussion emphasizes measuring time between input and display and avoiding unnecessary work. [120 FPS](https://zed.dev/blog/120fps) | Profile the actual Electron renderer. Do not infer speed from a redesigned screenshot or claim that an Electron dev trace matches Zed's native renderer. |
| MDX exposes a unified processor; evaluation APIs execute JavaScript. [MDX API](https://mdxjs.com/packages/mdx/) | Syntax diagnostics only call `createProcessor({ remarkPlugins: [remarkFrontmatter] }).parse(source)` in a lazy worker. Do not emit, import or execute the analyzed note. |
| Vite defaults worker bundles to IIFE and supports ES module output. [Worker options](https://vite.dev/config/worker-options.html) | The production build exposed IIFE/code-splitting incompatibility; configure ES worker output and smoke-test the new analysis worker plus existing preview/TypeScript workers from Electron's actual `file://` renderer. |

The UI design skill informed the hierarchy: one calm document plane, less noisy
chrome, readable labels and separate Reading/authoring roles. The React performance
skill informed stable callback dependencies, memoizing the expensive Outline,
and keeping parsing off the input path. The webapp-testing skill informed real
Electron interaction checks rather than screenshot-only acceptance.

## Local problems confirmed before editing

1. Source default was 14px/1.45, with smaller gutter numbers. Live used different
   body/display fonts and large headings, making editing metrics inconsistent.
2. Tabs/breadcrumbs contained 9–11px labels despite the design contract's 12px
   minimum. Some Outline labels also violated that minimum.
3. `.cm-content { min-width: 100% }` lived beside the gutter in a flex scroller:
   the content demanded the entire width *plus* the gutter, producing horizontal
   overflow even for short text.
4. A configured tab width of four still produced two-space Enter indentation.
   Tab indented the whole line instead of inserting at the caret, and Tab over
   an open completion list inserted indentation instead of accepting the item.
5. Outline parsing used a deferred React value but still ran full MDX analysis
   on the main thread. MDX diagnostics compiled the source on that thread too.
6. Ordinary typing and scrolling rebuilt the whole-document MDX block highlight
   collection. Most edits only needed to map existing ranges.
7. After moving parsing, CPU sampling still showed React JSX creation, DOM prop
   validation and icon construction dominating. The 700-section Outline was
   rebuilding on every keypress because its parent and bookmark callbacks changed.
8. Workbench restoration repeated selection after two animation frames and
   again after 120ms, allowing a late restore to pull the caret backwards.

## Implementation choices

- New default: JetBrains Mono, 15px, line-height 1.6. Comfortable also disables
  ligatures and ruler for a quieter starting point. Compact retains Maple Mono,
  14px/1.45 with ligatures/ruler. Saved user preferences are never silently reset.
- Appearance offers font, size, line spacing, wrapping, ruler, ligatures and
  indentation guides; shared settings persist choices. It has English/Vietnamese
  names, labelled native controls, bounded values and Radix focus handling.
  The spacing slider previews locally during dragging and persists on gesture
  completion. Settings writes do not disable the focused slider; repeated arrow
  keys remain usable and are verified against persisted settings.
- Source and Live share font metrics. Live can still hide syntax and use bounded
  wrapping; Reading remains editorial. Gutter font matches the text, content
  begins with 16px vertical padding, tabs use 13px labels, small chrome uses 12px.
- Fix flex geometry to fill only the width left after the gutter. Keep a real
  horizontal scrollbar for genuinely long unwrapped source lines.
- Preserve snippets, accept visible completion before indentation, insert soft
  tabs at each caret, and configure Enter with the same indentation unit.
- Outline parsing: lazy worker, 120ms debounce, session/file publication guards.
  Diagnostics: separate lazy worker, 650ms debounce, document-identity guard and
  composition check. Each queue has at most one running and one replacement job.
- Workers accept at most 2,097,152 UTF-16 code units; no filesystem, note module
  resolution, execution or new IPC permissions. Worker failure never disables
  the editable buffer. Destruction/session changes terminate owned workers.
- Memoize Outline with stable bookmark/select callbacks. Merely typing inside
  the same section no longer creates hundreds of unchanged React rows.
- Map block decorations for ordinary edits. Conservatively rebuild for changed
  lines containing block delimiters or for line-structure changes. Scrolling
  does not trigger a full-document block scan.
- Apply successful CodeMirror view restoration once. A delayed scroll measure
  also checks that the editor state is still the one it restored.

## Measured before/after

Windows, actual Electron dev app, disposable profile and vault, 1440×960 window,
same 700-section source fixture: 5,603 lines / 67,904 UTF-16 code units after the
96-character input sequence. Playwright requested a 35ms interval between keys.
No build/typecheck/profiler was running during the reported comparison.

| Metric | Before | After |
| --- | ---: | ---: |
| Keydown → next animation frame, median | 100.6ms | 20.3ms |
| Keydown → next animation frame, p95 | 309.1ms | 45.9ms |
| Maximum sampled keydown → frame | 353.7ms | 110.8ms |
| Long tasks during input and 1.5s settling window | 200 | 8 |

Median decreased about 80%; p95 about 85% in this run. This is a renderer proxy,
not physical keyboard-to-photon latency or a statistically controlled benchmark.
Long-task counts cover different elapsed durations because a blocked renderer
slows Playwright's delivered input. Both builds use development React; do not
generalize these numbers to all vaults, production builds or hardware.

Raw evidence: [before](../verification/assets/editor-typing-ux/before-results.json),
[after](../verification/assets/editor-typing-ux/after-results.json),
[final interaction regression](../verification/assets/editor-typing-ux/after-interactions.json).
The final interaction run follows the later caret-restoration fix without
overwriting the performance sample.

## Verification and remaining limits

Electron checks cover Source/Live metrics (15px/24px), zero spurious horizontal
overflow, light/dark and 800px/1440px windows, appearance changes preserving the
editor instance/document/selection, Tab completion plus one-step undo, Enter's
four spaces, typing after a tab switch, Vietnamese committed text saved to disk,
and block highlights after text/delimiter edits. Unit tests cover worker queue
replacement/failure/disposal, read-only behavior, multi-cursor insertion, outdent,
parser offsets and non-execution, and stale scroll restoration.

Not claimed: exhaustive Windows Telex/VNI IME composition testing, screen-reader
certification, every mixed MDX construct, production input latency, full MDX
TypeScript semantics, or VS Code/Zed feature parity. Automated Vietnamese input
uses committed text (`insert_text`), not a native input-method session. Outline
and diagnostics intentionally trail typing; pathological documents over the
analysis bound skip live analysis. Structural block edits can still trigger a
full scan. Background main-process indexing on save is unchanged.

See the [verification ledger](../verification/editor-readability-and-typing-2026-09.md)
for commands, screenshots and final gate results.
