# GOAL-12 — Editor Highlighter Pack + Organization & Navigation Shell

> File này được tạo tự động bởi create-goal skill.
> Agent thực thi: đọc toàn bộ file này trước khi làm bất kỳ thứ gì.
> Tuân thủ tuyệt đối [AGENTS.md](../AGENTS.md) + [docs/security.md](../docs/security.md).
> Nguồn ưu tiên: #3, #4, #8, #9 trong [docs/research/feature-gap-2026-07.md](../docs/research/feature-gap-2026-07.md) + gap editor-highlight user báo.

---

## Objective

Sprint lớn 4 phase, làm theo thứ tự, được phép dừng giữa các phase (phase đã bắt đầu phải hoàn chỉnh):

- **Phase A — Editor Highlighter Pack**: editor highlight các syntax mà GOAL-11 mới thêm vào preview nhưng editor chưa biết: `$math$`/`$$math$$`, ` ```mermaid ` fence, callout `> [!type]`; thêm syntax `==highlight==` (mark) mới ở CẢ editor + preview + export; style wikilink `[[...]]` và tag `#tag` trong editor.
- **Phase B — Navigation panels**: Outline/TOC panel (click scroll-to) + Tags browser panel (click filter notes) — data đã có sẵn trong SQLite, chủ yếu là UI.
- **Phase C — Command palette + Templates + Daily notes**: command palette tổng quát (actions, không chỉ note), templates từ `<vault>/templates/` (static + biến `{{date}}`/`{{title}}`), daily note command.
- **Phase D (optional) — Carryover GOAL-11**: F5 footnotes fix, F6 focus/typewriter mode.

---

## Context

- **Lý do**: (1) User báo editor highlight chưa "giải quyết triệt để" — đúng: GOAL-09 chỉ cover JSX/brace, GOAL-11 thêm 4 syntax vào preview mà editor hiển thị như text thường → mismatch editor↔preview ngày càng lớn. (2) Feature-gap research xếp outline (#3), tags panel (#4), daily notes (#8), templates (#9) vào top-10; command palette là nền cho hotkey customization sau này. Gom một sprint vì Phase B/C đa số là UI consume data sẵn có.
- **Ưu tiên**: correctness > speed. Editor highlight là presentation-only — sai màu chấp nhận được, ăn nhầm text (parser ăn quá đà làm mất prose) là KHÔNG chấp nhận được.
- **Người thực hiện**: AI Agent (báo cáo sau mỗi phase).
- **Ngày tạo**: 2026-07-09.

---

## Current State

| Item | Giá trị |
|------|---------|
| Editor highlight | `src/renderer/src/editor/mdx-highlight.ts` — Lezer inline parsers cho JSX tag + `{expr}` (comment ghi rõ presentation-only). `MdxEditor.tsx` có `HighlightStyle` + `syntaxHighlighting` (GOAL-09) |
| Editor chưa highlight | `$...$`/`$$...$$`, ` ```mermaid ` fence (không có trong codeLanguages), `> [!type]` line, `==mark==`, `[[wikilink]]`, `#tag` `[ước lượng — verify bằng cách mở editor với note test GOAL-11]` |
| Preview chưa có | `==highlight==` → `<mark>` (schema preview `safe-html.ts` KHÔNG có tagName `mark`; schema export CÓ) |
| Preview đã có (GOAL-11) | KaTeX, rehype-highlight, callouts (`src/shared/remark-callouts.ts`), mermaid (`src/shared/mermaid-config.ts`, `MermaidDiagram.tsx`) |
| Outline data | SQLite `note_headings(note_id, depth, text, slug, position)` — indexed sẵn, CHƯA có UI |
| Tags data | SQLite `note_tags(note_id, tag)` — indexed sẵn, CHƯA có UI ngoài parse |
| Panels hiện có | `BacklinksPanel.tsx`, `SearchPane.tsx`, AI side panel — xem cách mount trong `App.tsx` để thêm panel theo cùng pattern |
| Quick switcher | `QuickSwitcher.tsx` (Ctrl+P `[ước lượng]`) — chỉ mở note, không chạy action; fuzzy `scoreNote`/`isSubsequence` tái sử dụng được |
| Templates / daily notes | Chưa có gì. `CreateNoteDialog` chỉ scaffold tên file |
| IPC pattern | `domain:action` + zod ở main + `safeJoin()` — mọi IPC mới theo đúng pattern |
| Package manager | `bun` (KHÔNG npm/pnpm/yarn) |

---

## Target State

| Phase | Item | Mô tả |
|-------|------|-------|
| A | Math trong editor | `$...$` inline + `$$...$$` block được đánh dấu vùng (style riêng, vd monospace + màu), KHÔNG render công thức trong editor |
| A | Mermaid fence trong editor | ` ```mermaid ` fence có màu keyword tối thiểu hoặc ít nhất vùng fence được style phân biệt `[ước lượng — mermaid không có CodeMirror lang chính thức, chấp nhận style vùng]` |
| A | Callout trong editor | Dòng `> [!note]` có marker được tô màu theo loại callout |
| A | `==highlight==` | Editor: vùng mark được tô nền. Preview: render `<mark>` (thêm `mark` vào tagNames schema preview — element tĩnh, an toàn). Export: render `<mark>` (schema export đã cho) |
| A | Wikilink + tag trong editor | `[[...]]` và `#tag` có màu riêng (hiện là prose thường) |
| B | Outline panel | Panel list headings note active (indent theo depth), click → scroll editor + preview tới heading. Cập nhật khi đổi note/edit |
| B | Tags panel | Panel list toàn bộ tag trong vault + count, click tag → list notes có tag đó, click note → mở |
| C | Command palette | Ctrl+Shift+P `[ước lượng — chọn hotkey không đụng Ctrl+P]`: fuzzy list actions — new note, new daily note, insert template, toggle theme, đổi view mode, open vault, export note, empty trash... Kiến trúc: registry action tập trung để goal sau thêm dễ |
| C | Templates | Folder `<vault>/templates/*.mdx`; khi tạo note hoặc qua palette: chọn template → thay `{{date}}` (YYYY-MM-DD), `{{time}}`, `{{title}}` → tạo note. KHÔNG có JS execution trong template (anti-pattern với sandbox model) |
| C | Daily notes | Command "Open today's note": tạo/mở `journal/YYYY-MM-DD.mdx` (folder + format có thể config sau — hardcode convention này trước), dùng template `templates/daily.mdx` nếu có |
| D | Footnotes | `[^1]` hoạt động trong preview (fix sanitize: allowlist href `#user-content-fn-*`, giữ clobber) |
| D | Focus/typewriter | Toggle trong editor, tắt được, không ảnh hưởng autosave |
| — | KHÔNG thay đổi | Trust model, sandbox, IPC validation pattern, preview pipeline GOAL-11, indexing schema (chỉ ĐỌC, trừ khi thiếu query — được thêm query, không đổi schema) |

---

## Constraints

> Agent PHẢI tuân theo tuyệt đối. Conflict với Execution Plan → ưu tiên Constraints.

- [ ] **Security bất biến**: `contextIsolation/sandbox/nodeIntegration` giữ nguyên; IPC mới validate zod + `safeJoin()`; KHÔNG expose fs/path thô. Template engine CHỈ string replacement (`{{date}}`, `{{time}}`, `{{title}}`) — KHÔNG eval, KHÔNG Templater-style JS.
- [ ] **Editor highlight là presentation-only**: Lezer extension chỉ tô màu, KHÔNG validate, KHÔNG render công thức/diagram trong editor, KHÔNG chạm preview pipeline. Parser mới phải conservative — khi không chắc (unbalanced delimiter) thì bail (return -1) như các parser hiện có trong `mdx-highlight.ts`.
- [ ] **`==highlight==` phải hoạt động cross-app**: syntax tương thích Obsidian. Preview: nới schema `safe-html.ts` ĐÚNG MỘT tagName `mark` (element tĩnh không attribute) — KHÔNG nới thêm gì khác.
- [ ] **Phase B chỉ ĐỌC index**: outline/tags panel query SQLite qua IPC mới (`index:headings`, `index:tags`... theo pattern `domain:action`) — KHÔNG đổi schema, KHÔNG đổi indexer. Nếu query cần thiếu → thêm method đọc trong `db-service.ts`.
- [ ] **Command palette không phá Quick Switcher**: Ctrl+P giữ nguyên behavior mở note. Palette actions là surface mới.
- [ ] **File-first**: template = file `.mdx` thật trong vault; daily note = file thật; không config ẩn ngoài vault trừ app-settings đã có.
- [ ] KHÔNG sửa behavior GOAL-01→11 (đặc biệt: preview pipeline, sanitize cho user HTML ngoài đúng 1 dòng `mark`, mermaid config, export placeholder).
- [ ] KHÔNG thêm dependency mới cho Phase A/B/C trừ khi thực sự bắt buộc `[ước lượng — Phase A/B/C khả năng 0 dependency mới; nếu cần, hỏi trước]`.
- [ ] Sau mỗi phase: `bun run typecheck` + `bun run lint` pass. Commit theo conventional commits, MỖI PHASE ít nhất 1 commit riêng — nếu worktree bẩn từ trước, chỉ stage file thuộc phase này (git add từng file), KHÔNG `git add -A`.
- [ ] Gặp blocker → DỪNG và báo, không tự workaround.

---

## Success Criteria

> Verify trong app thật (`bun run dev`) + mở rộng `example-vault/notes/editor-enrichment-test.mdx` (hoặc note test mới) đủ case. Báo cáo kèm evidence từng item.

### Phase A
- [ ] Trong EDITOR: `$E=mc^2$`, `$$\sum$$`, ` ```mermaid ` fence, `> [!warning]`, `==text==`, `[[Welcome]]`, `#project` đều có style phân biệt với prose; prose xung quanh KHÔNG bị ăn nhầm (gõ `$5 và $10`, `a == b`, `{` đơn lẻ → không vỡ highlight dòng)
- [ ] `==text==` render `<mark>` trong preview VÀ trong file export tĩnh; `<script>` etc. vẫn bị strip (regression check sanitize)
- [ ] Editor với note dài (>1000 dòng) gõ không lag rõ rệt `[ước lượng — cảm quan]`

### Phase B
- [ ] Outline panel: hiện đúng heading của note active theo depth, click heading → editor scroll đúng dòng + preview scroll đúng section; đổi note → outline cập nhật; edit thêm heading → cập nhật sau khi index (autosave→reindex flow hiện có)
- [ ] Tags panel: list đủ tag + count đúng; click tag → đúng danh sách note; click note → mở note; vault không tag → empty state tử tế
- [ ] 2 panel mount theo pattern panel hiện có, toggle được, không phá layout grid các view mode

### Phase C
- [ ] Command palette mở bằng hotkey riêng, fuzzy search action, chạy được tối thiểu 8 actions (new note, daily note, insert template, toggle theme, 3 view modes, open vault); Ctrl+P quick switcher giữ nguyên
- [ ] Tạo `templates/meeting.mdx` có `{{date}}`/`{{title}}` → new note from template → biến được thay đúng, file nằm đúng chỗ, mở ngay trong editor
- [ ] Daily note command: lần đầu tạo `journal/YYYY-MM-DD.mdx` (đúng ngày local), lần hai CÙNG ngày → mở file cũ không ghi đè; có `templates/daily.mdx` → dùng nội dung template
- [ ] Mọi IPC mới có zod validation + path qua `safeJoin()` (agent tự audit và liệt kê channel mới trong report)

### Phase D (optional)
- [ ] Footnote `[^1]` click qua lại hoạt động trong preview, sanitize clobber vẫn bật
- [ ] Focus/typewriter toggle hoạt động, tắt sạch, autosave + highlight không hỏng

### Toàn cục
- [ ] `bun run typecheck` + `bun run lint` pass toàn repo
- [ ] Không regression: mở vault cũ, preview note GOAL-11 test (math/code/callout/mermaid) vẫn render đúng

---

## Execution Plan

> Theo thứ tự A → B → C → D. Báo cáo sau mỗi phase. Được dừng giữa các phase khi context cạn.

1. **A1**: Đọc `mdx-highlight.ts` + `MdxEditor.tsx` + note test GOAL-11 trong app để chốt danh sách syntax editor thực sự chưa highlight (verify bảng Current State).
2. **A2**: Mở rộng Lezer extension: inline parsers cho `$...$`, `==...==`, `[[...]]`, `#tag`; block-level cho `$$...$$` và callout marker; style vùng mermaid fence. Map tags mới vào `HighlightStyle` hiện có. Test các case "ăn nhầm" (Success Criteria A).
3. **A3**: `==highlight==` end-to-end: remark plugin (shared, đặt cạnh `remark-callouts.ts`) transform `==x==` → `mark` cho CẢ preview pipeline và export pipeline; thêm `mark` vào tagNames schema preview. Verify + commit Phase A.
4. **B1**: IPC đọc headings/tags (`index:headings-of-note`, `index:all-tags`, `index:notes-by-tag` `[ước lượng tên]`) — zod + preload typed.
5. **B2**: OutlinePanel + TagsPanel components theo pattern BacklinksPanel; wire scroll-to (editor có sẵn reveal-line từ error panel — tái sử dụng). Verify + commit Phase B.
6. **C1**: Action registry + CommandPalette component (tái sử dụng fuzzy logic từ QuickSwitcher — cân nhắc extract shared helper thay vì copy).
7. **C2**: Template service (main process: list `templates/*.mdx`, read, string-replace biến) + IPC + UI chọn template trong CreateNoteDialog + palette action. 
8. **C3**: Daily note command dùng template service. Verify + commit Phase C.
9. **D (nếu còn context)**: footnotes fix rồi focus/typewriter, mỗi cái verify + commit riêng.
10. **Chốt**: chạy toàn bộ Success Criteria, báo cáo từng item kèm evidence. Cập nhật bảng danh sách trong `goals/README.md` bổ sung dòng cho GOAL-08→12 (đang dừng ở 07).

---

## Out of Scope

- KHÔNG render math/mermaid/công thức TRONG editor (chỉ tô màu vùng) — WYSIWYG là sprint khác
- KHÔNG làm graph view, bookmarks, recent files, hover preview, tabs (ứng viên GOAL sau)
- KHÔNG làm spaced repetition, properties editor UI (GOAL-13 theo draft research)
- KHÔNG làm hotkey customization UI (palette chỉ là nền) và KHÔNG config UI cho daily-note folder/format (hardcode convention `journal/YYYY-MM-DD.mdx`)
- KHÔNG Templater-style scripting trong template
- KHÔNG i18n

---

## References

- [docs/research/feature-gap-2026-07.md](../docs/research/feature-gap-2026-07.md) — #3 outline, #4 tags, #8 daily notes, #9 templates
- Files phải đọc trước: `src/renderer/src/editor/mdx-highlight.ts`, `src/renderer/src/editor/MdxEditor.tsx`, `src/renderer/src/panels/BacklinksPanel.tsx`, `src/renderer/src/QuickSwitcher.tsx` `[ước lượng path — tìm bằng glob]`, `src/main/services/db-service.ts`, `src/main/ipc/vault-ipc.ts`, `src/shared/remark-callouts.ts`
- [@lezer/markdown MarkdownExtension API](https://github.com/lezer-parser/markdown) — pattern InlineParser đã dùng trong repo
- [Obsidian highlight syntax `==mark==`](https://help.obsidian.md/syntax) — chuẩn tương thích
- [Obsidian Daily notes / Templates core plugins](https://obsidian.md/help/plugins) — behavior reference
- GOAL-11 report — vị trí các file shared plugin (`src/shared/remark-callouts.ts`, `mermaid-config.ts`) làm mẫu cho remark plugin mới

---

## Agent Instructions

1. Đọc toàn bộ file này + AGENTS.md + docs/security.md + files trong References trước khi code
2. Tuân theo Constraints tuyệt đối; conflict với Execution Plan → ưu tiên Constraints
3. Làm theo phase A → B → C → D, mỗi phase verify + commit xong mới sang phase sau; chỉ stage file thuộc phase (worktree có thể bẩn từ trước)
4. Context cạn → dừng sau phase đang dở đã hoàn chỉnh, báo phase nào xong/chưa
5. Gặp thứ không có trong GOAL → DỪNG và hỏi, không tự assume
6. Khi xong: verify toàn bộ Success Criteria, báo cáo từng item kèm evidence
