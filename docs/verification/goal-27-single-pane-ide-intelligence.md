# GOAL-27 verification — Single-pane IDE Intelligence

Date: 2026-08-10  
Environment: Windows 11, Electron development renderer, Bun 1.3.14, TypeScript 5.9

## Delivered capability matrix

| Capability | Raw `.md/.mdx` Source | Interactive `.ts/.tsx` | Other editable code |
| --- | --- | --- | --- |
| Semantic completion | Trusted registry JSX tags/unused props plus existing wikilinks | Existing TypeScript completion and safe auto-import | Existing language parser completion |
| Hover | Trusted registry component/prop documentation | Existing TypeScript quick info | Existing behavior |
| Rename | Not claimed | `F2`; only when every location is in the active buffer | Not claimed |
| References | Not claimed | `Shift+F12`; bounded project-wide read-only list | Not claimed |
| Code actions | MDX parse diagnostics remain compile-only | `Ctrl+.`; safe active-buffer TypeScript fixes only | Not claimed |
| Minimap | Source mode only | Yes | Yes |

This is one canonical workbench item and one editor. GOAL-27 adds no split/peek
editor, full MDX TypeScript virtual project, generic LSP, multi-file write or
background rename.

## Implementation evidence

- `src/shared/interactive-language.ts` owns bounded TypeScript References,
  same-buffer Rename and safe same-buffer code-action plans.
- `src/shared/interactive-language-protocol.ts` and the renderer worker runtime/client
  carry the three operations through the existing project/version/request boundary.
- `src/renderer/src/interactive/interactive-code-intelligence.ts` owns labelled,
  keyboard-navigable editor overlays and applies edit plans as one CodeMirror
  transaction. Expected latest-wins hover/completion cancellation resolves silently.
- `src/renderer/src/editor/mdx-registry-intelligence.ts` derives Source completion and
  hover from app registry metadata without compiling or evaluating note source.
- `src/renderer/src/editor/source-minimap.ts` owns the shared canvas, capped at 1,200
  sampled rows with animation-frame coalescing, capped high-DPI rendering and
  click/drag scroll navigation.
- `src/renderer/src/editor/source-editor-extensions.ts` installs the minimap for raw
  MDX Source and editable code, not Live mode.

## Automated gates

All commands ran from the repository root after the final source changes.

| Gate | Result |
| --- | --- |
| Focused GOAL-25/27 editor/language suite | 34 passed, 0 failed, 115 expectations across 9 files |
| `bun test` | 442 passed, 0 failed, 2,863 expectations across 99 files |
| `bun run typecheck` | Passed for node and web projects |
| `bun run lint` | Passed; 427 files checked |
| `bun run build` | Passed; main, preload and renderer production bundles built |

Focused coverage includes worker routing/version rejection, project-bounded
references, same/cross-file rename policy, safe code actions, single-transaction edit
planning, trusted MDX tag/prop completion and hover, bounded minimap sampling and
Source-vs-Live installation.

Static boundary audit:

- no `@mdx-js/language-service`, Volar, Monaco, language server, `LanguageClient`,
  `fetch`, `XMLHttpRequest` or `WebSocket` symbol exists in the GOAL-27 implementation;
- no `ipcRenderer`, `contextBridge`, `ipcMain` or new app/vault bridge access exists in
  the GOAL-27 implementation;
- no dependency was added for this goal.

## Live Electron evidence

Command:

```powershell
python scripts/verify-goal27-live.py `
  --cdp http://127.0.0.1:9333 `
  --vault <disposable-temp-vault> `
  --output docs/verification/assets/goal-27-dev
```

The script drove the visible Electron UI through the existing CDP test boundary and
recorded [the machine-readable result](assets/goal-27-dev/goal-27-live-results.json).

| Journey | Observed result |
| --- | --- |
| Raw MDX Source | `QuizBlock` registry completion appeared and applied `<QuizBlock />` |
| Source minimap | One `aria-hidden` 72px overview rendered; click moved `scrollTop` from 0 to 692 |
| Live mode | Minimap preference `off`; zero minimap nodes |
| References | `Shift+F12` opened a labelled two-result, keyboard menu in the editor |
| Rename | `F2` renamed `count` to `total`; one `Ctrl+Z` restored the exact source |
| Code action | `Ctrl+.` offered and applied `Update import from "react"`; Undo restored source |
| Dark/narrow | Dark theme retained the minimap; at 680px it adapted from 72px to 52px |
| Runtime audit | 0 console errors, 0 page errors, 0 external requests |

Visual captures:

- [MDX registry completion, light](assets/goal-27-dev/goal-27-mdx-completion-light.png)
- [References overlay, light](assets/goal-27-dev/goal-27-references-light.png)
- [Code action result, light](assets/goal-27-dev/goal-27-code-action-light.png)
- [Minimap, dark](assets/goal-27-dev/goal-27-minimap-dark.png)
- [Single-pane narrow Source, dark](assets/goal-27-dev/goal-27-narrow-dark.png)

## Deliberate limits

- MDX assistance describes only trusted in-app registry components/props; it does not
  provide full TypeScript semantics across MDX expressions.
- References may reveal another project file, but Rename and code actions never mutate
  it. Cross-file Rename returns an explicit refusal and the user can open References.
- The minimap is redundant pointer navigation. Search, Outline, Problems, Go to
  Definition and References remain the named keyboard/assistive routes.
- Split editors, multi-file refactors, formatter, semantic tokens, inlay hints, generic
  LSP/plugin hosts, terminal/debugger/test/Git surfaces remain out of scope.
