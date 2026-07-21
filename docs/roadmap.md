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

## Next candidates

Sau feature-gap research (2026-07, [docs/research/feature-gap-2026-07.md](research/feature-gap-2026-07.md)), top candidates cho GOAL-11+ (theo scoring rubric `Impact × VisionFit / Effort`):

- **GOAL-11 — Editor enrichment**: KaTeX math, code block syntax highlight (Shiki/lowlight), Mermaid diagrams, callouts/admonitions — quick-win score cao, fit MDX.
- **GOAL-12 — Organization & navigation shell**: outline/TOC panel, tags browser, daily notes + templates, command palette tổng quát. Đa số data đã có từ GOAL-02.
- **GOAL-13 — Learning loop**: spaced repetition (FSRS link QuizBlock) + properties/frontmatter editor UI — khuếch đại moat islands.

Xem chi tiết phân tích, feature matrix 49×8, top-10 + rejected features tại báo cáo research.

## Ngoài roadmap (chưa có goal — đừng tự làm)

- Graph view
- Git sync / bất kỳ sync nào (Git trước, custom sync là bẫy roadmap)
- Marketplace/library cho interactive blocks (chỉ sau khi sandbox model đã vững)
- Mobile, collaboration, publish site
