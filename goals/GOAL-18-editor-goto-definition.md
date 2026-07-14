# GOAL-18 — Editor Go-to-Definition (Ctrl+Click) cho MDX

> Executing agent: read this entire file before doing anything.
> Must also read and follow [AGENTS.md](../AGENTS.md) and [docs/security.md](../docs/security.md).

---

## Objective

Trong CodeMirror editor (MdxEditor), Ctrl+Click (Cmd+Click trên macOS) hoạt động như "go to definition" trong IDE:

1. Ctrl+Click vào `[[wikilink]]` → mở note đích trong app (resolve đúng như preview/index đang resolve).
2. Ctrl+Click vào giá trị `src="…"` của `<Interactive …/>` / `<SandboxedHTML …/>`, hoặc path trong markdown link/image `](../assets/x.png)` → mở file đó trong app (GOAL-16 đã cho phép view/edit text + image toàn vault). Riêng `<Interactive src>` trỏ tới FOLDER → mở `component.tsx` trong folder đó.
3. Ctrl+Click vào tên component PascalCase (`<QuizBlock`, `<WidgetFrame>`…) → popover nhỏ tại vị trí click hiện thông tin từ registry: description, category, props (tên + type từ zod schema nếu lấy được, tối thiểu là insertSnippet). Tên không có trong registry → popover cảnh báo "không có trong registry" (đúng tinh thần placeholder cảnh báo của preview).
4. Affordance: khi GIỮ Ctrl/Cmd và hover lên target hợp lệ → underline + cursor pointer (như VS Code). Nhả phím → trở lại bình thường.

---

## Context

- **Reason**: User muốn navigate trong vault như trong IDE — "Ctrl+Click vào một hàm → nhảy đến file của hàm đó". Với MDX note, "definition" = note đích của wikilink, file nguồn của island (`component.tsx`), asset, hoặc doc của registry component. GOAL-16 vừa mở khóa view/edit mọi text file nên giờ mở `component.tsx` trong app là khả thi.
- **Executor**: AI Agent (Codex), no human review between steps.
- **Created**: 2026-07-14.
- **Depends on**: GOAL-16 (text file editor), GOAL-17 (kit — chỉ để popover có nhiều component hơn, không phụ thuộc code). Assumes GOAL-01..17 complete.

---

## Current State

| Item | Value |
|------|-------|
| Editor | [MdxEditor.tsx](../src/renderer/src/editor/MdxEditor.tsx) — CodeMirror 6; đã có `EditorView.domEventHandlers` cho paste/drop (dòng ~346) — thêm handler mới vào cùng chỗ, KHÔNG phá 2 handler này |
| Wikilink infra | `src/shared/wikilinks.ts` (`getNoteLinkKeys`); autocomplete `[[` đã có trong MdxEditor (dòng ~268); resolution title/alias/filename qua index — xem cách preview resolve wikilink click để tái dùng đúng một đường resolve |
| Mở note/file từ renderer | App đã có pathway select file trong tree → mở editor (xem `MainEditor.tsx`, hook selection). Tìm action/handler mà file tree + quick open dùng, tái dùng — KHÔNG tự viết IPC mới |
| MDX syntax | [mdx-highlight.ts](../src/renderer/src/editor/mdx-highlight.ts) — đã parse/decorate cú pháp MDX trong editor; tái dùng cách nhận diện token ở đây nếu phù hợp |
| Registry | `componentRegistry` ([registry/index.tsx](../src/renderer/src/preview/registry/index.tsx)) — có `name`, `description`, `category`, `propsSchema` (zod), `insertSnippet` |
| Popover idiom | App có popover/palette editorial-style sẵn (ComponentInsertPalette, InlineFormatToolbar) — theo cùng idiom |

---

## Target State

- Extension CodeMirror mới (đề xuất `src/renderer/src/editor/goto-definition.ts`):
  - `mousedown` với `ctrlKey || metaKey` → xác định target tại pos: wikilink / path / component tag (regex hoặc syntax-aware quanh pos — ưu tiên tái dùng logic của mdx-highlight); `preventDefault` để không đặt caret khi click trúng target hợp lệ; không trúng gì → hành vi mặc định.
  - `keydown`/`keyup` Ctrl/Cmd + `mousemove` → decoration underline cho target dưới con trỏ (một decoration duy nhất, clear khi nhả phím/rời target).
  - Callback `onNavigate(target)` truyền từ ngoài vào (MdxEditor prop) — extension KHÔNG tự gọi IPC.
- Wire trong MdxEditor + component cha: wikilink → resolve qua index rồi mở note (wikilink không resolve được → toast/status thông báo, không crash, không tạo note mới); path → normalize theo vị trí note hiện tại (path tương đối tính từ file đang mở) rồi mở file; folder Interactive → `component.tsx`; file không tồn tại → thông báo, không crash.
- Popover registry: component nhỏ mới, đóng bằng Escape/click ra ngoài; hiện name, category, description, danh sách props (đọc từ zod schema shape: tên + `optional` hay không `[ước lượng: lấy type text đơn giản, không cần pretty-print đầy đủ]`), và insertSnippet trong khối `code`.

---

## Constraints

- [x] KHÔNG thêm dependency mới.
- [x] KHÔNG viết IPC mới — tái dùng pathway mở note/file + resolve wikilink hiện có. Nếu KHÔNG tồn tại pathway tái dùng được → DỪNG, báo cáo, không tự chế.
- [x] KHÔNG phá paste/drop handler, autocomplete `[[`, slash palette, selection toolbar hiện có — regression thủ công từng cái sau khi wire.
- [x] Click thường (không Ctrl) hành vi y như cũ, kể cả trên wikilink.
- [x] Path resolve phải qua cùng normalize/safety mà app đang dùng cho path vault — không mở được file ngoài vault.
- [x] Repo có thể có file modified sẵn không thuộc goal — không revert, không commit chung.
- [x] Nếu gặp blocker: DỪNG và mô tả blocker, KHÔNG tự workaround.

---

## Success Criteria

- [x] Ctrl+Click `[[Bayes Theorem]]` (note tồn tại trong example-vault) → note mở trong editor. Wikilink mồ côi → thông báo, không crash.
- [x] Ctrl+Click `src` của `<Interactive src="../interactives/react-counter" />` trong note demo → `component.tsx` của folder đó mở trong TextFileEditor.
- [x] Ctrl+Click path ảnh markdown → image preview mở.
- [x] Ctrl+Click `<QuizBlock` → popover hiện description + props; Ctrl+Click `<KhongTonTai` → popover cảnh báo not-in-registry. Escape đóng popover.
- [x] Giữ Ctrl hover wikilink/path/tag → underline + pointer; nhả Ctrl → hết. Click thường không navigate.
- [x] Paste ảnh, drop ảnh, autocomplete `[[`, slash command vẫn hoạt động (regression check).
- [x] Unit tests cho hàm nhận diện target tại pos (wikilink giữa/biên, src path, tag name, vị trí không phải target) — `bun test` xanh.
- [x] `bun run typecheck` pass; `bun run lint` không error mới.

---

## Execution Plan

1. Đọc MdxEditor.tsx, mdx-highlight.ts, shared/wikilinks.ts, cách file tree/quick-open mở file, cách preview resolve wikilink click.
2. Viết hàm thuần `resolveGotoTarget(doc, pos)` → `{type: 'wikilink'|'path'|'component', value, from, to} | null` + unit tests (test đỏ trước).
3. Extension CM: mousedown Ctrl/Cmd + hover underline decoration, nhận `onNavigate` callback.
4. Wire navigation: wikilink→note, path→file (folder→component.tsx), component→popover registry.
5. Regression check các editor feature hiện có; chạy test/typecheck/lint.
6. Verify từng Success Criteria, đánh dấu checkbox, commit (conventional commits).

---

## Out of Scope

- Go-to-definition từ PREVIEW pane (preview đã có click wikilink; không đổi).
- Peek definition / hover documentation khi không giữ Ctrl.
- Rename symbol, find references.
- Navigate tới định nghĩa registry component trong SOURCE CODE app (ngoài vault) — popover info là đủ.

---

## Agent Instructions

1. Đọc toàn bộ file này trước khi làm bất kỳ thứ gì.
2. Tuân theo Constraints tuyệt đối — không có ngoại lệ.
3. Thực hiện Execution Plan theo thứ tự, báo cáo ngắn gọn sau mỗi bước.
4. Conflict giữa Constraints và Execution Plan → ưu tiên Constraints.
5. Gặp thứ không có trong GOAL: DỪNG và hỏi, không tự assume.
6. Khi xong: verify từng Success Criteria, đánh dấu checkbox, commit (conventional commits).
