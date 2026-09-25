# GOAL-16 — Plain-Text File Viewing/Editing and Vault-Wide Image Preview

> File created by the create-goal skill.
> Executing agent: read this entire file before doing anything.
> Must also read and follow [AGENTS.md](../AGENTS.md) and [docs/security.md](../docs/security.md) — this goal touches main-process file I/O and IPC.

---

## Objective

Cho phép mở (view) và chỉnh sửa (edit + save) mọi file **text thuần** ở bất kỳ vị trí nào trong vault (`.csv`, `.json`, `.ts`, `.tsx`, `.js`, `.jsx`, `.yaml`, `.yml`, `.toml`, `.txt`, `.html`, `.css`, ...) bằng một CodeMirror editor có syntax highlight; đồng thời bỏ ràng buộc "ảnh phải nằm trong `assets/`" để ảnh ở bất kỳ đâu trong vault đều preview được. File binary không nhận diện được vẫn hiện "No preview available" như cũ.

---

## Context

- **Reason**: User xác nhận trong app: chọn `assets/datasets/sample.csv` hoặc `interactives/react-counter/component.tsx`/`manifest.json` → "No preview available". File tree đã list mọi file (`TREE_FILE_PATTERNS = ['**/*']`) nhưng chỉ `.md`/`.mdx` và ảnh trong `assets/` mở được. Đặc biệt bất tiện vì `interactives/` chứa source code (`.tsx`, `manifest.json`) là một phần chính của sản phẩm (islands) mà user không xem/sửa được ngay trong app. User yêu cầu rõ: "phải cho phép view thì mới edit được" — tức mục tiêu cuối là edit, không chỉ view.
- **Priority**: correctness > speed. Đây là đường mở rộng bề mặt đọc/ghi filesystem ở main process — path safety và không-widen-sandbox là bắt buộc.
- **Executor**: AI Agent (Codex), no human review between steps.
- **Created**: 2026-07-14.
- **Depends on**: GOAL-01 (vault I/O), GOAL-05 (sandbox — để hiểu ranh giới KHÔNG được nới). Assumes GOAL-01..15 complete.

---

## Current State

| Item | Value |
|------|-------|
| Runtime | Electron 39 + React 19 + TypeScript, main/preload/renderer split, package manager **bun** |
| Phân loại file (renderer) | [src/renderer/src/vault/file-kind.ts](../src/renderer/src/vault/file-kind.ts): `isNotePath` (`.md`/`.mdx`) và `isPreviewableVaultImagePath` (ảnh **và** `startsWith('assets/')`). Mọi thứ khác → `NoVaultFilePreview` trong [MainEditor.tsx](../src/renderer/src/components/layout/MainEditor.tsx) (dòng ~160) |
| Đọc note | `vault:read-file` → `VaultService.readFile()` → `resolveMarkdownPath()` ([vault-service.ts:540](../src/main/services/vault-service.ts)) — throw nếu extension không phải `.md`/`.mdx` |
| Đọc asset | `vault:read-asset-file` → `VaultService.readAssetFile()` ([vault-service.ts:131](../src/main/services/vault-service.ts)) — whitelist `.csv`/`.json` (utf8) + ảnh (base64), **bắt buộc dưới `assets/`**. ⚠️ Method này cũng được **sandbox** dùng ([sandbox-service.ts:293](../src/main/services/sandbox-service.ts)) làm quyền đọc asset của islands |
| Ghi file | `vault:write-file` → `writeFile()` cũng qua `resolveMarkdownPath` — chỉ ghi được `.md`/`.mdx`; đã có sẵn atomic write (temp + rename) |
| Editor hiện có | CodeMirror 6 trong [MdxEditor.tsx](../src/renderer/src/editor/MdxEditor.tsx); deps đã có sẵn `@codemirror/lang-javascript` (hỗ trợ TS/JSX), `lang-json`, `lang-yaml`, `lang-html`, `lang-python`, `lang-markdown` — **không cần dep mới** cho highlight |
| Load/save flow | [useNoteEditor.ts](../src/renderer/src/hooks/useNoteEditor.ts): load qua `window.vaultApi.readFile`, autosave debounce 1 s, `isDirty` = content ≠ savedContent |
| Ảnh preview | `VaultImagePreview` ([VaultFilePreview.tsx](../src/renderer/src/components/layout/VaultFilePreview.tsx)) + `PreviewImageCache` (base64 → object URL) — hoạt động tốt, chỉ bị chặn bởi điều kiện path `assets/` |
| Header/status | `EditorHeader` đã có chỗ hiện "Read only" / kích thước ảnh cho file không phải note |
| IPC conventions | Channel `domain:action`, mọi payload validate bằng zod ở main ([vault-ipc.ts](../src/main/ipc/vault-ipc.ts)), path qua `safeJoin()` chống traversal |
| Tests | `bun test` với `*.test.ts` cạnh service (vd `vault-service.listing.test.ts`) |

---

## Target State

1. **Main process — API đọc/ghi text mới, tách khỏi sandbox:**
   - `VaultService.readTextFile(relativePath)`: đọc utf8 file text ở **bất kỳ đâu** trong vault. Điều kiện:
     - Path qua `normalizeVaultPath` + `safeJoin` như mọi method khác; từ chối `.trash/`, `.app/`, `node_modules/`, `.git/` (tái dùng logic ignore hiện có).
     - Extension nằm trong `TEXT_EXTENSIONS` whitelist mới (đề xuất: `.txt .csv .tsv .json .jsonc .yaml .yml .toml .xml .html .css .js .jsx .ts .tsx .mjs .cjs .py .sh .sql .log .ini` `[ước lượng — chốt danh sách khi implement]`). KHÔNG dùng blacklist.
     - Guard binary: reject nếu file chứa NUL byte trong 8 KB đầu; guard size: reject file > 5 MB `[ước lượng]` với error message rõ ràng.
   - `VaultService.writeTextFile(relativePath, content)`: cùng điều kiện path/extension, dùng lại atomic write hiện có. `.md`/`.mdx` vẫn đi đường `readFile`/`writeFile` cũ — không gộp.
   - `VaultService.readImageFile(relativePath)`: như phần ảnh của `readAssetFile` (base64) nhưng bỏ điều kiện `assets/` (vẫn safeJoin + whitelist `IMAGE_EXTENSIONS` + assert file).
   - IPC mới: `vault:read-text-file`, `vault:write-text-file`, `vault:read-image-file` — zod validate, expose qua preload typed API (`readTextFile`, `writeTextFile`, `readImageFile`).
2. **Renderer — phân loại và UI:**
   - `file-kind.ts`: thêm `isEditableTextPath()` (mirror whitelist extension với main — nếu lệch nhau thì main là source of truth, renderer chỉ để routing UI); `isPreviewableVaultImagePath()` bỏ điều kiện `startsWith('assets/')`.
   - Component mới `TextFileEditor` (đề xuất `src/renderer/src/editor/TextFileEditor.tsx`): CodeMirror 6 với `basicSetup`, language chọn theo extension (javascript typescript+jsx cho ts/tsx/js/jsx; json, yaml, html, python, markdown; csv/txt/khác → plain), theme đồng bộ với `MdxEditor` (tái dùng theme/highlight nếu tách ra được, không copy-paste khối lớn).
   - Load/save: hook mới `useTextFileEditor` mirror pattern `useNoteEditor` (load khi select, autosave debounce 1 s, dirty tracking) — KHÔNG nhét thêm state vào `useNoteEditor`.
   - `MainEditor.tsx`: thêm nhánh `textSelected` giữa image và fallback; header hiện tên/extension thay vì "Read only" (file text giờ edit được). `PreviewImageCache`/`VaultImagePreview` chuyển sang gọi `readImageFile`.
   - File không phân loại được (binary, extension lạ) → giữ nguyên `NoVaultFilePreview`.
3. **Hành vi phụ:**
   - Sửa file `.tsx`/`manifest.json` trong `interactives/` rồi save → island trong note đang preview nhận thay đổi theo cơ chế watcher/reload hiện có (không cần xây mới; chỉ verify không crash) `[cần xác nhận: mức reload mong đợi]`.
   - Text file KHÔNG được index vào SQLite, KHÔNG xuất hiện trong search/quick-open notes, KHÔNG tham gia wikilink resolution.

---

## Constraints

- [x] **KHÔNG nới `readAssetFile()`** — sandbox islands đang dùng nó làm permission boundary ([sandbox-service.ts:293](../src/main/services/sandbox-service.ts)). Mọi khả năng đọc mới nằm ở method/IPC mới mà sandbox KHÔNG gọi tới. Diff của goal này không được thay đổi bất kỳ dòng nào trong `sandbox-service.ts`.
- [x] KHÔNG đổi hành vi đọc/ghi/tạo/xóa/rename của `.md`/`.mdx` (kể cả `resolveMarkdownPath`) — note flow giữ nguyên 100%.
- [x] Mọi path mới qua `normalizeVaultPath` + `safeJoin`; có test path traversal (`../`, absolute path, `.trash/`) cho từng IPC mới.
- [x] Extension whitelist, không blacklist. File không match whitelist hoặc dính binary/size guard → error, renderer fallback về "No preview available".
- [x] KHÔNG thêm dependency mới (mọi lang package CodeMirror cần thiết đã có trong package.json).
- [x] KHÔNG index text file vào SQLite, không đụng `index-service`/FTS.
- [x] KHÔNG refactor `MdxEditor` ngoài việc export/tách theme+highlight dùng chung (nếu cần).
- [x] Nếu gặp blocker: DỪNG và mô tả blocker, KHÔNG tự workaround.

---

## Success Criteria

- [x] Mở `assets/datasets/sample.csv`, `interactives/react-counter/component.tsx`, `interactives/react-counter/manifest.json` trong example-vault → nội dung hiện trong CodeMirror, `.tsx` và `.json` có syntax highlight.
- [x] Sửa `manifest.json` trong app, save (autosave hoặc Ctrl+S) → nội dung mới nằm trên disk; reopen thấy đúng nội dung.
- [x] Ảnh nằm NGOÀI `assets/` (tạo `notes/pic.png` trong example-vault để test) → preview được như ảnh trong `assets/`.
- [x] File binary đội lốt (file `.csv` chứa NUL bytes) và file > size cap → "No preview available"/error message, không crash, không treo.
- [x] Test `bun test`: path traversal bị chặn cho cả 3 IPC mới; NUL-byte guard; extension ngoài whitelist bị reject; round-trip read→write→read giữ nguyên content (kể cả CRLF `[ước lượng: giữ nguyên EOL gốc]`).
- [x] Sandbox regression: island demo trong example-vault vẫn chạy, và island KHÔNG thể đọc file ngoài `assets/` như trước (chạy lại test sandbox hiện có).
- [x] `.md`/`.mdx` flow không đổi: mở/sửa/save note, wikilink, backlinks hoạt động như trước.
- [x] `bun run typecheck` pass; `bun run lint` không thêm error mới.

---

## Execution Plan

1. Main process: thêm `TEXT_EXTENSIONS`, `readTextFile`/`writeTextFile`/`readImageFile` vào `VaultService` + unit tests (traversal, whitelist, NUL guard, size cap, round-trip) — test đỏ trước, xanh sau.
2. IPC + preload: 3 channel mới với zod schema, typed API trong `preload/index.ts` + `index.d.ts`.
3. Renderer phân loại: cập nhật `file-kind.ts` (thêm text, bỏ ràng buộc `assets/` cho ảnh) + đổi `PreviewImageCache` sang `readImageFile`.
4. Renderer UI: `useTextFileEditor` + `TextFileEditor` (CodeMirror, language theo extension, theme dùng chung), wire vào `MainEditor.tsx` + `EditorHeader`.
5. Verify hành vi phụ: island reload sau khi sửa `interactives/`, sandbox regression tests.
6. Verify toàn bộ Success Criteria, chạy `bun test` + typecheck + lint, báo cáo từng item.

---

## Out of Scope

- Viewer chuyên dụng cho CSV (table view), JSON tree view, hex viewer cho binary — text thuần trong CodeMirror là đủ cho goal này.
- Preview PDF, video, audio, docx và mọi format binary khác.
- Tạo mới / rename / delete file text từ file tree (context menu hiện chỉ phục vụ note) — goal sau.
- Cho islands/sandbox đọc rộng hơn — tuyệt đối không.
- Search/index nội dung text file.
- Sửa lint warnings có sẵn.

---

## References

- Code đọc trước: `src/renderer/src/vault/file-kind.ts`, `src/renderer/src/components/layout/MainEditor.tsx`, `src/renderer/src/components/layout/VaultFilePreview.tsx`, `src/renderer/src/preview/preview-image.ts`, `src/renderer/src/hooks/useNoteEditor.ts`, `src/renderer/src/editor/MdxEditor.tsx` (phần setup CodeMirror + theme), `src/main/services/vault-service.ts`, `src/main/ipc/vault-ipc.ts`, `src/main/services/safe-path.ts`, `src/main/services/sandbox-service.ts` (chỉ để hiểu boundary — không sửa), `src/preload/index.ts`.
- [docs/security.md](../docs/security.md) — trust levels; goal này chỉ mở rộng cho renderer (trusted UI), không cho sandbox.
- CodeMirror language packages đã có: xem `package.json` dependencies `@codemirror/lang-*`.

---

## Agent Instructions

1. Đọc toàn bộ file này trước khi làm bất kỳ thứ gì.
2. Tuân theo Constraints tuyệt đối — không có ngoại lệ; đặc biệt là ranh giới sandbox.
3. Thực hiện Execution Plan theo thứ tự, báo cáo ngắn gọn sau mỗi bước.
4. Conflict giữa Constraints và Execution Plan → ưu tiên Constraints.
5. Gặp thứ không có trong GOAL: DỪNG và hỏi, không tự assume.
6. Khi xong: verify từng Success Criteria, đánh dấu checkbox, commit (conventional commits).
