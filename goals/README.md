# goals/ — Cách dùng với Codex

Thư mục này chứa các goal file được viết theo format chuẩn để giao cho AI agent thực thi (Codex `/goal`, hoặc paste trực tiếp làm prompt).

## Quy tắc

1. **Mỗi session một goal.** Làm theo đúng thứ tự dependency trong bảng. Không nhảy cóc — mỗi goal giả định goal trước đã xong.
2. Cách giao cho Codex: mở session mới trong repo và ra lệnh, ví dụ:
   ```
   Đọc AGENTS.md, sau đó thực thi goals/GOAL-01-app-shell-and-vault.md.
   Tuân theo Constraints tuyệt đối. Báo cáo sau mỗi bước của Execution Plan.
   ```
3. Agent phải đọc `AGENTS.md` + `docs/security.md` trước khi implement bất kỳ goal nào.
4. Khi goal xong: verify từng Success Criteria, đánh dấu checkbox, commit. Nếu một criterion không đạt được → ghi rõ lý do, không im lặng bỏ qua.
5. Gặp blocker hoặc thứ không có trong goal → DỪNG và hỏi, không tự assume.

## Danh sách

| File                               | Phase                                            | Phụ thuộc |
| ---------------------------------- | ------------------------------------------------ | --------- |
| GOAL-01-app-shell-and-vault.md     | Vault core: hardening, editor, preview, file I/O | —         |
| GOAL-02-indexing-and-search.md     | SQLite index, wikilinks, backlinks, search       | 01        |
| GOAL-03-registry-and-safe-html.md  | Component registry, sanitize, error handling     | 01, 02    |
| GOAL-04-interactive-islands.md     | Built-in template components                     | 03        |
| GOAL-05-sandbox-and-permissions.md | iframe sandbox, manifest, permissions            | 03        |
| GOAL-06-ai-assistant.md            | TanStack AI, diff approval, repair loop          | 04, 05    |
| GOAL-07-export-and-share.md        | Export static/interactive HTML                   | 04, 05    |
| GOAL-08-ux-productization.md       | Create note, remember vault, view/theme UX       | 07        |
| GOAL-09-polish-sprint.md           | Reopen/highlight fixes, vault ops, editor polish | 08        |
| GOAL-10-feature-gap-research.md    | Competitor feature-gap research                  | 09        |
| GOAL-11-editor-enrichment.md       | Math, code highlight, Mermaid, callouts          | 09, 10    |
| GOAL-12-organization-and-navigation.md | Editor highlighter, navigation panels, commands | 11        |
| GOAL-13-obsidian-parity-microfeatures.md | Close Obsidian Group A parity microfeatures | 12        |
| GOAL-14-interaction-behavior-research.md | Interaction-behavior deep audit (research-only) | 13        |
| GOAL-15-transactional-rename.md    | Transactional rename + wikilink rewrite (fix F-01) | 12, 14    |
| GOAL-16-plain-text-and-image-preview.md | Plain-text view/edit + vault-wide image preview | 01, 05, 15 |
| GOAL-17-interactive-note-mdx-kit.md | Interactive Note MDX component kit + editorial theme | 03, 04, 16 |
| GOAL-18-editor-goto-definition.md  | Ctrl+Click go-to-definition trong editor         | 16, 17    |
| GOAL-19 (reserved)                 | Export fidelity cho interactive-note kit         | 17        |
| GOAL-20-settings-dialog.md         | Settings Dialog + config tập trung               | 06, 08    |
| GOAL-21-tier2-spatial-visuals.md   | CellGrid + FlowSequence cho interactive-note kit | 17        |
| GOAL-22-zed-like-workbench-ux.md   | Zed-like transactional workbench UX + native MDX vault behavior | 08, 14, 16, 20 |
| GOAL-23-obsidian-knowledge-utilities.md | Page Preview, Outgoing Links, Properties, Bookmarks, Footnotes | 02, 13, 15, 18, 20, 22 |
| GOAL-24-graph-view.md             | Global + Local Graph, virtual graph item, bounded topology | 02, 13, 15, 18, 20, 22, 23 |
| GOAL-25-interactive-authoring-workbench.md | Transactional React interactive authoring + offline TypeScript proof desk | 05, 06, 16, 18, 22 |
| GOAL-26-knowledge-instrument-foundation.md | Knowledge Instrument design system, responsive shell, Settings v6 + i18n foundation | 20, 22, 23, 24, 25 |
| GOAL-27-single-pane-ide-intelligence.md | Offline references/rename/code actions + MDX semantic completion; full-width Source, no minimap/split editor | 25, 26 |
| GOAL-28-editorial-note-design-system.md | Layered Editorial note tokens, prose primitives, responsive/print/export parity | 17, 19, 26, 27 |
| GOAL-29-living-outline-section-intelligence.md | Live active outline, stable heading identity, section-aware search/navigation | 02, 12, 23, 26, 27, 28 |
| GOAL-30-compact-zed-titlebar-menu.md | One-trigger titlebar menu + active vault selector | 20, 22, 26, 29 |
| GOAL-31-reactive-vault.md | Shared cell bus: prose binding `{n}`, island publish/subscribe qua manifest cells, cross-note cells + permission, adaptive prose, dataflow view, export replay | 04, 05, 06, 17, 19, 22, 25, 28 |
| GOAL-32-zed-grade-reading-ux.md | Stable, keyboard-first single-pane Reading and source-position navigation | 22, 26, 27, 28, 29 |
| GOAL-33-navigation-focus-accessibility.md | JSX headings, focus, states, file clarity, graph labels and accessibility floor | 23, 26, 29, 32 |
| GOAL-34-speed-and-raster-integrity.md | Production note speed, Reading raster integrity and graph template filtering | 29, 32, 33 |

## Trạng thái ký hiệu trong goal

- `[ước lượng]` — con số/quyết định agent cần verify khi làm
- `[cần xác nhận]` — cần hỏi user trước khi làm phần đó
