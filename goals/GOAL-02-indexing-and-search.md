# GOAL-02 — Indexing, wikilinks, backlinks, search

> Agent thực thi: đọc file này + `AGENTS.md` + `docs/architecture.md` (mục Content pipeline, SQLite schema) trước. Giả định GOAL-01 đã hoàn thành.

## Objective

Xây knowledge layer: parse AST của note để trích metadata (frontmatter, headings, wikilinks, tags, component usage), index vào SQLite (FTS5), cập nhật incremental qua file watcher, và expose lên UI: wikilink render + navigate, backlinks panel, quick switcher, full-text search.

## Context

- **Lý do**: Backlinks/search là lý do người ta dùng Obsidian. Không có layer này thì app chỉ là editor MDX.
- **Ưu tiên**: correctness > speed. Index sai → mất niềm tin; index là cache, phải rebuild được từ files bất cứ lúc nào.
- **Ngày tạo**: 2026-07-03

## Current State

| Item            | Giá trị                                                                                                                                               |
| --------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------- |
| Đã có (GOAL-01) | Vault open/read/write, editor, preview, example-vault                                                                                                 |
| Deps sẵn        | better-sqlite3 (đã rebuild cho Electron), chokidar, unified/remark-parse/remark-mdx/remark-gfm/remark-frontmatter, unist-util-visit, gray-matter, zod |
| SQLite          | Chưa có code nào đụng đến                                                                                                                             |
| Wikilink        | Chưa parse — `[[...]]` hiện render như text thường                                                                                                    |

## Target State

| Item                | Giá trị                                                                                                                                                                                                           |
| ------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Remark plugin       | `remark-wikilink` tự viết: `[[Target]]` / `[[Target\|display]]` → node link custom, hoạt động cho cả index lẫn render                                                                                             |
| Index service       | `src/main/services/index-service.ts`: source → NoteIndex {title, headings, wikilinks, tags, components}; parse từ AST, KHÔNG regex trên HTML                                                                      |
| DB service          | `src/main/services/db-service.ts`: schema theo docs/architecture.md; db file tại `<vault>/.app/index.sqlite`; migration đơn giản bằng `PRAGMA user_version`                                                       |
| Full scan + watcher | Scan toàn vault khi mở (skip file chưa đổi qua mtime + content_hash); chokidar watch add/change/unlink → re-index incremental                                                                                     |
| IPC                 | `index:search` (FTS5), `index:backlinks`, `index:notes` (danh sách cho quick switcher), `index:rebuild`                                                                                                           |
| UI                  | Wikilink trong preview click → mở note đích (resolve theo title/aliases/filename, case-insensitive); backlinks panel cho note hiện tại; quick switcher (Ctrl+P) fuzzy theo title/path; search pane (Ctrl+Shift+F) |
| Link chưa resolve   | Render style khác (muted) — không crash, không tự tạo file                                                                                                                                                        |
| Thứ KHÔNG thay đổi  | IPC/preload API của GOAL-01 (chỉ mở rộng), format file note                                                                                                                                                       |

## Constraints

- [x] better-sqlite3 CHỈ ở main process
- [x] Index từ AST của source `.mdx` — KHÔNG index từ rendered HTML
- [x] `.app/` phải nằm trong ignore list của watcher/scanner và file tree
- [x] Xóa `.app/index.sqlite` rồi mở lại vault → app tự rebuild index, không lỗi
- [x] KHÔNG thay đổi nội dung file note khi index (read-only pipeline)
- [x] KHÔNG thêm graph view, tag pane, inline `#tag` parsing (nice-to-have, chỉ làm nếu không tốn thêm effort đáng kể)
- [x] KHÔNG thêm dependency mới ngoài package.json hiện tại (fuzzy match tự viết đơn giản hoặc dùng FTS5 prefix)
- [x] Nếu gặp blocker: DỪNG và mô tả, KHÔNG tự workaround

## Success Criteria

- [x] `bun run typecheck` && `bun run lint` pass
- [x] Mở example-vault → `.app/index.sqlite` được tạo, bảng notes/note_links/note_tags/note_components/notes_fts có dữ liệu đúng
- [x] Note A chứa `[[Note B]]` → mở Note B thấy A trong backlinks panel; click wikilink trong preview A → chuyển sang B
- [x] Sửa file bằng editor NGOÀI app (vd Notepad) khi app đang mở → index tự cập nhật ≤ vài giây
- [x] Ctrl+P gõ một phần title → tìm thấy và mở được note
- [x] Search full-text tìm được từ nằm trong body của note bất kỳ
- [x] Xóa index.sqlite → mở lại vault → mọi thứ trên vẫn hoạt động (rebuild)
- [x] `[[Không Tồn Tại]]` render kiểu unresolved, click không crash

## Execution Plan

1. `remark-wikilink` plugin + unit test thuần (hàm pure, input string → AST assertions đơn giản)
2. `index-service.ts` (extract NoteIndex từ source)
3. `db-service.ts` (schema, upsert, delete, FTS sync, rebuild)
4. Full scan khi mở vault + chokidar watcher (debounce, ignore `.app`, node_modules, .git)
5. IPC + preload mở rộng (`window.indexApi`)
6. Renderer: wikilink render trong preview + navigation
7. Backlinks panel, quick switcher, search pane (shadcn Dialog/Command)
8. Verify Success Criteria, báo cáo từng item

## Out of Scope

- Graph view, tag browser UI
- Rename/refactor link tự động khi đổi tên file [cần xác nhận thiết kế — để goal riêng sau nếu cần]
- Semantic/embedding search

## References

- `docs/architecture.md` — SQLite schema khởi điểm, content pipeline
- `docs/mdx-conventions.md` — wikilink/tag/frontmatter rules
- SQLite FTS5: https://sqlite.org/fts5.html
- unified/remark plugin guide: https://unifiedjs.com/learn/guide/create-a-remark-plugin/

## Agent Instructions

1. Đọc toàn bộ file này + AGENTS.md trước khi làm
2. Tuân theo Constraints tuyệt đối
3. Thực hiện Execution Plan theo thứ tự, báo cáo sau mỗi bước
4. Conflict Constraints vs Plan → ưu tiên Constraints
5. Thứ không có trong GOAL → DỪNG và hỏi
6. Khi xong: verify toàn bộ Success Criteria, báo cáo từng item
