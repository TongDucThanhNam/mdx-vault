# GOAL-26 Knowledge Instrument Foundation verification

- Date: 2026-08-10
- Platform: Windows 11 Home Single Language (`10.0.26200`), Electron `39.8.10`,
  Bun `1.3.14`, Node `26.3.0`
- Result: pass
- Goal source:
  [`goals/GOAL-26-knowledge-instrument-foundation.md`](../../goals/GOAL-26-knowledge-instrument-foundation.md)
- Live evidence:
  [`goal-26-live-results.json`](assets/goal-26-dev/goal-26-live-results.json)

## Result

GOAL-26 is complete. The renderer now has a Knowledge Instrument visual
foundation, locally bundled Atkinson Hyperlegible Next/Literata/IBM Plex Mono/Maple Mono
fonts, settings v6 interface preferences, typed English/Vietnamese shell
localization, responsive wide/compact/overlay composition, and an accessible
Evidence Rail for the active note. Source view now owns its CodeMirror setup,
precision-buffer theme, note/code wrapping policy, persisted typography and
structure preferences, plus compile-only MDX diagnostics.

The live run used randomized `%TEMP%/mdx-vault-goal26-*` vault and `userData`
directories. It did not write to the repository example vault or the normal app
profile. The scope remains one active document pane; GOAL-27+ pane grids,
recovery, collections, Git and release gates are not claimed here.

## Automated evidence

| Check | Result | Evidence |
|---|---|---|
| TypeScript | Pass | `bun run typecheck` exited 0 for node and web projects. |
| Biome | Pass | `bun run lint` checked 422 files with no fixes. |
| Full suite | Pass | `bun test`: 431 pass, 0 fail, 2,828 expectations across 97 files. |
| Production build | Pass | The production build emitted main, preload and renderer assets, including the self-hosted Maple Mono Source-editor faces. Existing Vite mixed-import and third-party `gray-matter` eval warnings remain non-blocking. |
| Targeted layout/i18n/settings/editor | Pass | Breakpoint selection, compact grid ownership, dock arbitration, catalog compatibility, locale resolution, Evidence Rail semantics, v1–v5 migration, v6 normalization, strict IPC, Source preference facets, keyboard-first Markdown formatting, MDX diagnostics and round-trip persistence passed. |
| Chrome source audit | Pass | Top/status/empty/button/new dock/rail files contain no 9–11px text class and no `outline-none` without a `focus-visible` replacement. |

## Success criteria

| # | Result | Verification |
|---|---|---|
| 1 | Pass | Settings service tests migrate v1–v5 and normalize missing, corrupt, unknown and invalid input to a bounded v6 snapshot. Locale defaults to `system`, density to `comfortable`, and UI scale to 100. |
| 2 | Pass | Live Settings changes set Vietnamese, compact density and 110% UI scale without reload; the root reported `lang=vi`, `data-density=compact` and `font-size:17.6px`. Source font size also changed 14→15→14px live without rebuilding the CodeMirror document. |
| 3 | Pass | `VI_MESSAGES` is statically constrained to every English message key and the runtime catalog-key test passed. Explicit/system locale resolution and root `lang` updates passed. |
| 4 | Pass | At 1440×900, the document retained 568px with left/Context/AI tracked. At 1024×760, it retained 800px while the 352px supplementary dock overlaid it. At 640px and the 490 CSS-pixel 200%-equivalent viewport, the document retained the full viewport with zero root overflow and all docks remained togglable. |
| 5 | Pass | The rail rendered named heading buttons, exposed Vietnamese/English accessible labels, and live activation used the existing `revealHeading` controller without error. |
| 6 | Pass | Knowledge Instrument tokens and the new font roles drive the shared shell surfaces. Raw MDX Source and editable code use the same full-width/no-wrap IDE buffer: Maple Mono by default, divider-free gutter, restrained active line, editor scrollbars, `Ln/Col` telemetry and optional ruler/indent/whitespace guides. Live mode alone retains the bounded note measure. IBM Plex Mono remains the data/chrome fallback. |
| 7 | Pass | Light/dark applied live; reduced motion produced `transition-property:none`; compact Context/AI tabs supported Arrow keys and focus transfer; no console or page error occurred. |
| 8 | Pass | Typecheck, lint, all 431 tests and the production build exited 0. |
| 9 | Pass | This ledger and architecture/roadmap/tech-stack/design updates describe only GOAL-26 behavior. |

## Live measurements

| Surface | CSS viewport | Layout | Document width | Supplementary dock | Root overflow |
|---|---:|---|---:|---|---:|
| Wide light | 1440×900 | `wide` | 568px | tracked Context + AI | 0px |
| Compact light | 1024×760 | `compact` | 800px | 352px overlay | 0px |
| Overlay dark/VI | 640×720 | `overlay` | 640px | 387.2px overlay | 0px |
| 200%-equivalent dark/VI | 490×700 | `overlay` | 490.4px | closed after reachable toggle | 0px |
| Compact light/VI | 1024×760 | `compact` | 1024px | closed after reachable toggle | 0px |

Live screenshots:

- [`goal-26-wide-light.png`](assets/goal-26-dev/goal-26-wide-light.png)
- [`goal-26-compact-light-initial.png`](assets/goal-26-dev/goal-26-compact-light-initial.png)
- [`goal-26-settings.png`](assets/goal-26-dev/goal-26-settings.png)
- [`goal-26-overlay-dark-vi.png`](assets/goal-26-dev/goal-26-overlay-dark-vi.png)
- [`goal-26-compact-light.png`](assets/goal-26-dev/goal-26-compact-light.png)

### Source editor live inspection

The Source-specific Playwright run used a disposable copy of the example vault
and a disposable Electron `userData` directory. The reproducible harness is
[`scripts/verify-source-editor-live.py`](../../scripts/verify-source-editor-live.py).

| Buffer | Wrap | Computed typography | Canvas | Structure | Runtime |
|---|---|---|---|---|---|
| MDX Source | off | Maple Mono, 14px, 400, 20.3px line box | 860.8px full-width content in an 861px client area | 0px gutter divider, 12px line inset, no active-line rail, ruler at 88 | 0 console errors, 0 page errors |
| MDX Live | bounded | Maple Mono, 14px, 400, 20.3px line box | full-width canvas with bounded individual lines | same engine/history, prose-oriented wrapping | 0 console errors, 0 page errors |
| HTML code | off | Maple Mono, 14px, 400, 20.3px line box | 990px content in an 893px client area | horizontal capacity retained, 0px gutter divider, ruler at 88 | 0 console errors, 0 page errors |

Selecting source text rendered no formatting toolbar. With editor focus,
`Ctrl+B` produced `**format_target**` and `Ctrl+H` produced
`==format_target==`; the workspace sidebar remained open, proving that the
MDX-owned chord won only in editor context.

The status bar reported `Ln 9, Col 1 · MDX` for the note and
`Ln 9, Col 7 · HTML` for the editable code file, using the shared primary-cursor
snapshot rather than a second editor-local state store.

## Security and scope

- App settings remain outside the vault, strict-zod validated, allowlisted and
  secret-free. New values are finite/bounded and main-frame-only.
- Fonts are emitted from local packages; CSP and renderer networking were not
  widened.
- Source diagnostics call `@mdx-js/mdx` in compile-only mode and never evaluate
  the generated function body. The preview compile/render pipeline, iframe
  sandbox, permission manifest, workbench item identity and AI approval model
  were not changed.
- `contextIsolation:true`, `sandbox:true` and `nodeIntegration:false` remain
  unchanged.

## Known boundary

GOAL-26 deliberately migrates shared chrome and new surfaces, not every legacy
feature panel. GOAL-36 owns the exhaustive removal of historical Editorial
Newspaper classes and strings. Wide mode also remains a single document track;
arbitrary split panes and workspace persistence begin at GOAL-27.
