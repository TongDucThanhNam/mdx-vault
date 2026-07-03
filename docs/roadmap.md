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

## Ngoài roadmap (chưa có goal — đừng tự làm)

- Graph view
- Git sync / bất kỳ sync nào (Git trước, custom sync là bẫy roadmap)
- Marketplace/library cho interactive blocks (chỉ sau khi sandbox model đã vững)
- Mobile, collaboration, publish site
