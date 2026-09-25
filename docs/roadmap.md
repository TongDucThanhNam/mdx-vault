# Roadmap — mdx-vault

> Mỗi phase ↔ một goal file trong [goals/](../goals/). Làm theo thứ tự — mỗi goal build trên goal trước. Chi tiết executable nằm trong goal file, file này chỉ là bản đồ.

| #   | Goal file                            | Phase            | Tóm tắt                                                                                                                                                              |
| --- | ------------------------------------ | ---------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 01  | `GOAL-01-app-shell-and-vault.md`     | Vault core       | Electron hardening, open vault, file explorer, CodeMirror editor, MDX preview (trusted), autosave. **Lát cắt dọc đầu tiên: mở folder → edit .mdx → preview → save.** |
| 02  | `GOAL-02-indexing-and-search.md`     | Knowledge layer  | Remark plugin wikilink/tags, AST indexer, SQLite + FTS5, watcher, backlinks panel, quick switcher, full-text search.                                                 |
| 03  | `GOAL-03-registry-and-safe-html.md`  | Render hardening | Component registry chính thức, safe HTML sanitize policy (Level 1), error overlay, unknown-component placeholder, frontmatter display.                               |
| 04  | `GOAL-04-interactive-islands.md`     | Islands          | Built-in template components: QuizBlock, EquationSlider, DataChart, AlgorithmVisualizer. Slash command / palette để chèn.                                            |
| 05  | `GOAL-05-sandbox-and-permissions.md` | Security layer   | iframe sandbox (Level 4), postMessage RPC, esbuild compile vault components (Level 3), manifest + permission UI.                                                     |
| 06  | `GOAL-06-ai-assistant.md`            | AI layer         | TanStack AI sau interface AssistantRuntime, side panel, selected-text actions, patch/diff approval, compile-repair loop.                                             |
| 07  | `GOAL-07-export-and-share.md`        | Distribution     | Export note → static HTML / interactive HTML bundle với fallback.                                                                                                    |

## Vì sao Sandbox (05) trước AI (06)

AI-generated component theo trust model phải chạy Level 3/4. Nếu AI assistant ra đời trước sandbox, code AI sinh ra sẽ phải chạy trong renderer chính (vi phạm docs/security.md) hoặc phải chờ. Sandbox trước → AI output có chỗ chạy an toàn ngay từ ngày đầu.

## Current workbench milestone

- **GOAL-22 — Zed-like workbench UX**: hoàn thiện single-pane workbench cho vault
  local-first/MDX-native: File Finder `Ctrl/Cmd+P`, tab lifecycle an toàn,
  visual-vs-MRU navigation, reopen closed item, explorer focus cycle, shared action
  registry/keybinding resolver, overlay focus ownership và Settings v3 có searchable
  Workbench/Keymap. Mọi route mở file (Explorer, Search, links, definition, picker)
  hội tụ vào cùng transactional coordinator; file bị xóa ngoài app được giữ như
  missing item và existing-file writes không được tạo lại path.
- Phạm vi cố ý là **single pane**. Split panes/groups, preview tabs, workspace/session
  restore đầy đủ, editable `settings.json`/`keymap.json` và clone toàn bộ Zed catalog
  vẫn là candidate sau khi baseline này được chứng minh ổn định.

## Current knowledge-utilities milestone

- **GOAL-23 — Obsidian knowledge utilities**: delivered a shared seven-destination
  context panel; static, full-note Page Preview across Reading, editor, Explorer,
  Search, Backlinks, Outgoing, Bookmarks, and property links; safe outgoing-link
  and unlinked-mention workflows; source-preserving typed properties with
  rebuildable SQLite property search; durable grouped bookmarks; and exact
  footnote source navigation.
- Deliberate limits remain product boundaries: no plugin runtime, no dynamic
  execution inside Page Preview, no nested/anchored/custom-tag YAML editing, no
  Obsidian-only bookmark types, and no claim beyond the named footnote syntax
  already supported by the Markdown pipeline.

## Current graph milestone

- **GOAL-24 — Global and Local Graph View**: substantial notes-only Obsidian
  Graph View parity over the local SQLite note/link index. Global Graph is a
  deduplicated virtual workbench item; Local Graph follows the active note in
  the right panel. Both share bounded filtering/groups, unresolved and
  ambiguous targets, orphans, depth 1–4, accessible node navigation, pointer
  interactions, lazy Cytoscape/CoSE rendering, and versioned per-vault
  `.app/graph-view.json` preferences.
- Deliberate gaps remain explicit: tag nodes, attachment nodes, excluded-file
  settings, chronological time-lapse, and graph bookmark types.

## Current interactive-authoring milestone

GOAL-25 hoàn thiện authoring journey cho vault React interactive: một command tạo
transactional scaffold + chèn note, dedicated responsive Interactive Proof surface,
offline project-aware TypeScript intelligence, structured Problems navigation,
session-scoped zero-capability proof và handoff từ AI approval vào cùng workbench.
Normal note preview vẫn giữ content-hash permission review; AI không tự chạy code.

Scope cố ý bounded ở một `interactives/<slug>/`, React/ReactDOM allowlist và fixed
TypeScript virtual project. Generic LSP, Monaco, npm install trong vault, persisted
authoring consent/props và permission expansion không thuộc milestone này.

## Current product-completion milestone

- **GOAL-26 — Knowledge Instrument Foundation** starts the product-completion
  sequence without changing the single-pane workbench contract. It replaces the
  legacy visual foundation, adds Settings v6 interface preferences and typed
  English/Vietnamese localization, prevents compact docks from collapsing the
  document track, while the named Outline panel remains the sole structural navigator.
- **GOAL-27 — Single-pane IDE Intelligence** delivers the bounded offline
  TypeScript worker with References, safe same-buffer Rename and code actions;
  raw MDX gains registry-semantic completion while Source/code remain full-width
  single-pane buffers. It explicitly adds neither a minimap, split editors nor a generic LSP.
- **GOAL-28 — Editorial Note Design System** turns the global note theme into a
  layered foundation/prose/component contract with stable authoring primitives,
  narrow-layout behavior, print rules and one shared renderer/export stylesheet.
- **GOAL-29 — Living Outline & Section Intelligence** adds live unsaved heading
  structure, Reading/caret active-section tracking, a Fumadocs-inspired hierarchy
  connector in the named Outline panel, and section-aware local search navigation.
- **GOAL-30 — Compact Zed-style Titlebar Menu** collapses the persistent
  File/Edit/View/Go/Window strip into one keyboard-accessible menu beside the
  active vault selector, while preserving canonical command routing.
- Workspace persistence, recovery, collections, Git and distribution remain
  ordered follow-up goals. Split panes are not part of the current product plan.

## Next candidates

Sau feature-gap research (2026-07, [docs/research/feature-gap-2026-07.md](research/feature-gap-2026-07.md)), top candidates cho GOAL-11+ (theo scoring rubric `Impact × VisionFit / Effort`):

- **GOAL-11 — Editor enrichment**: KaTeX math, code block syntax highlight (Shiki/lowlight), Mermaid diagrams, callouts/admonitions — quick-win score cao, fit MDX.
- **GOAL-12 — Organization & navigation shell**: outline/TOC panel, tags browser, daily notes + templates, command palette tổng quát. Đa số data đã có từ GOAL-02.
- **GOAL-13 — Learning loop**: spaced repetition (FSRS link QuizBlock) + properties/frontmatter editor UI — khuếch đại moat islands.

Xem chi tiết phân tích, feature matrix 49×8, top-10 + rejected features tại báo cáo research.

## Ngoài roadmap (chưa có goal — đừng tự làm)

- Git sync / bất kỳ sync nào (Git trước, custom sync là bẫy roadmap)
- Marketplace/library cho interactive blocks (chỉ sau khi sandbox model đã vững)
- Mobile, collaboration, publish site

## Research backlog (2026-07-15, từ user)

- **Integrated terminal** trong app (kiểu Zed/VS Code) — chạy lệnh ngay trong vault, phục vụ evidence log (chạy benchmark rồi dán kết quả vào `EvidenceItem`).
- **Components tương tác API** — registry/island component fetch dữ liệu ngoài; đụng trực tiếp security model (sandbox `permissions.network`, GOAL-05) — cần thiết kế permission UX trước khi làm.
- **Inline data trong note** — thay vì `.csv` ngoài ở `assets/datasets/`, cho phép data nằm ngay trong note (code fence ` ```data `/props JSON) cho `DataChart`/`ComparisonBars`; giữ nguyên nguyên tắc "prose đọc được như văn bản".
- Export fidelity cho interactive-note kit (GOAL-19 — đã reserved).
- Gate↔iframe postMessage wiring; port audit script sang MDX lint.
