# GOAL-09 — Polish Sprint

> File này được tạo tự động bởi create-goal skill.
> Agent thực thi: đọc toàn bộ file này trước khi làm bất kỳ thứ gì.
> Tuân thủ tuyệt đối [AGENTS.md](../AGENTS.md) + [docs/security.md](../docs/security.md).

---

## Objective

Đưa mdx-vault từ "demo works" lên "dùng được như note app thực" qua một sprint polish rộng: **(1) fix 2 regression bug user đã phàn nàn, (2) thêm vault operations cơ bản còn thiếu, (3) thêm editor polish parity với Obsidian/SiYuan**. Sprint chia 3 phase, làm theo thứ tự ưu tiên — agent CÓ THỂ dừng giữa các phase nếu context window cạn, nhưng không được skip phase trước để làm phase sau.

---

## Context

- **Lý do**: Sau GOAL-01→08 (vault core, indexing, registry, islands, sandbox, AI, export, ux shell), mdx-vault vẫn thiếu nhiều ergonomics cơ bản mà mọi mature note app (Obsidian, SiYuan, Logseq, AppFlowy) đều có. User phàn nàn cụ thể: (a) mỗi lần mở app phải chọn lại vault folder, (b) MDX không highlight. Audit cho thấy **code đã implement cả 2 nhưng không hoạt động** — đây là regression bug, không phải thiếu feature.
- **Ưu tiên**: correctness > speed. Security invariant tuyệt đối.
- **Người thực hiện**: AI Agent (báo cáo sau mỗi bước, không có human review từng bước).
- **Ngày tạo**: 2026-07-04.

### Nguồn phát hiện gap
- Audit codebase mdx-vault (45 features check, chỉ ~6 IMPLEMENTED/PARTIAL).
- Research GitHub 4 đối thủ (Obsidian, SiYuan, Logseq, AppFlowy) về polish features.
- Top 15 missing features đã xếp hạng ở báo cáo research (xem References).

---

## Current State

| Item | Giá trị |
|------|---------|
| Framework | Electron 39 + React 19 + electron-vite, TypeScript |
| Editor | CodeMirror 6 (`basicSetup`) với `@codemirror/lang-markdown` + `mdx-highlight.ts` (custom Lezer extension cho JSX + brace) |
| Preview | `@mdx-js/mdx` `evaluate()` trong renderer |
| IPC pattern | `domain:action` channels, zod validation ở main, `safeJoin()` cho mọi path |
| File I/O | `vault:read-file`, `vault:write-file`, `vault:list-files`, `vault:create-file`, `vault:open`, `vault:open-path`, `vault:last-open` — **KHÔNG có delete/rename/move** |
| Settings | `AppSettingsService` ở `app.getPath('userData')/app-settings.json` (lastVaultPath, theme). `AiSettingsService` vault-scoped encrypt. |
| FileTree | Read-only, hardcoded name sort (`FileTree.tsx:158-165`). `mtimeMs` đã có trong index nhưng unused. |
| Search | `index:search(query, limit)` — single textbox, no filters, no replace, no highlighting. |
| Fuzzy matching | `scoreNote`/`isSubsequence` ở `QuickSwitcher.tsx:114-148` — **chỉ dùng trong QuickSwitcher, chưa wire vào editor completion**. |
| Package manager | `bun` (KHÔNG npm/pnpm/yarn) |

### 2 regression bug đã xác định root cause

#### Bug A — "Mỗi lần mở app phải chọn lại vault folder"

**Code đã có full pipeline** nhưng không hoạt động runtime:
- `app-settings.ts:55` `getLastVaultPath()` đọc từ userData ✓
- `vault-ipc.ts:69,78` lưu path khi open ✓
- `vault-ipc.ts:83-86` `vault:last-open` IPC handler ✓
- `App.tsx:243-257` `useEffect` on mount gọi `lastOpenVault()` rồi `reopenVault(path)` ✓
- `index.ts:60-67` `appSettings = new AppSettingsService()` truyền vào `registerVaultIpc({appSettings})` ✓

**`[cần xác nhận]`** — Agent phải runtime-debug để tìm root cause. Hypotheses (theo thứ tự khả thi):
1. File `app-settings.json` không được ghi (atomic write fail silently, hoặc path khác `app.getPath('userData')`).
2. `directoryExists` check fail vì Windows path / encoding.
3. `lastOpenVault()` resolve trước khi IPC handler register (race).
4. `reopenVault` throw silent → rơi về empty state.

**Verification step bắt buộc**: mở `%APPDATA%/mdx-vault/app-settings.json` sau khi mở vault 1 lần, xem có `lastVaultPath` field không. Nếu không → bug ở write side. Nếu có nhưng vẫn hỏi → bug ở read/reopen side.

#### Bug B — "MDX không highlight"

**Code đã có** custom Lezer extension (~200 dòng ở `mdx-highlight.ts`) wire vào `MdxEditor.tsx:159`. Root cause đã **xác định chắc chắn**:

- `mdx-highlight.ts` define nodes `JSXTagName` (style tag `t.tagName`), `JSXAttrName` (`t.attributeName`), `JSXAttrValue` (`t.string`), `JSXPunct` (`t.angleBracket`), `MDXBraceMark` (`t.brace`).
- **NHƯNG** `MdxEditor.tsx` chỉ có `EditorView.theme(...)` (CSS cho `.cm-*` classes) — **KHÔNG có `HighlightStyle` + `syntaxHighlighting()` extension** để map Lezer tags sang CSS classes.
- Kết quả: tokens được parse đúng nhưng không có color → hiển thị như prose thường.
- **Fix**: thêm `HighlightStyle` (từ `@codemirror/language`) define colors cho các tag `t.tagName`, `t.attributeName`, `t.string`, `t.angleBracket`, `t.brace` → wrap bằng `syntaxHighlighting(highlightStyle)`. Tham khảo [CodeMirror highlight example](https://codemirror.net/examples/styling/).

---

## Target State

| Phase | Item | Mô tả |
|-------|------|-------|
| 1 | Vault reopen hoạt động | Đóng app sau khi mở vault X → mở lại → tự mở vault X không dialog |
| 1 | MDX highlight visible | JSX tag `<Foo />`, attr `bar="x"`, brace `{x}` có color khác prose trong editor |
| 2 | Delete note + trash | Right-click note in tree → Delete → move vào `<vault>/.trash/` (không xóa thẳng). Empty trash command. |
| 2 | Rename/move note | Right-click → Rename → update filename + reindex + (optional) update wikilinks/backlinks tham chiếu |
| 2 | File tree context menu | Right-click → New note / Rename / Duplicate / Delete / Copy path / Reveal in explorer |
| 2 | File tree sort | Sort dropdown: Name / Modified (desc) / Created (desc). Persist preference. |
| 3 | In-note Find & Replace | `Ctrl+F` (find) + `Ctrl+H` (replace) — hiện đang silently broken (keymap có nhưng thiếu `search()` extension) |
| 3 | Word/char count status bar | Hiển thị word/char/reading-time ở editor header hoặc status bar, update real-time |
| 3 | `[[` inline autocomplete | Gõ `[[` trong editor → fuzzy dropdown notes (reuse `scoreNote`/`isSubsequence` từ QuickSwitcher) → Enter insert `[[note]]` |
| 3 | Image paste + drag-drop | Paste ảnh từ clipboard → save vào `<vault>/assets/` → insert `![](assets/...)`. Drag-drop file ảnh vào editor cũng vậy. |
| 3 | Inline formatting toolbar | Bôi đen text → floating bar với Bold/Italic/Code/Link → wrap selection |
| — | Thứ KHÔNG thay đổi | File-first invariant, sandbox model (Level 4 iframe), security hardening, IPC validation pattern, MDX preview/render pipeline, AI services, export pipeline, registry |

---

## Constraints

> Agent PHẢI tuân theo tuyệt đối. Conflict với Execution Plan → ưu tiên Constraints.

- [ ] **Security bất biến**: `contextIsolation: true`, `sandbox: true`, `nodeIntegration: false` giữ nguyên. Mọi IPC handler mới validate input bằng zod ở main. Mọi path từ renderer phải qua `safeJoin()`. KHÔNG expose `fs`/`path`/`ipcRenderer` thô qua preload.
- [ ] **File-first**: file `.mdx` là source of truth. Delete = move vào `<vault>/.trash/` (recoverable), KHÔNG xóa thẳng. Rename = atomic rename trên filesystem + reindex. SQLite chỉ index — mọi op phải trigger reindex.
- [ ] **Trash trong vault, không ngoài**: `.trash/` nằm trong vault folder để user có thể inspect/recover bằng file manager. Cùng pattern với Obsidian.
- [ ] **KHÔNG** thay đổi trust model: editor polish là **presentation-only trong renderer** — không sinh code, không eval, không chạm sandbox/registry/AI pipeline.
- [ ] **KHÔNG** sửa behavior của goal 02–08 (indexing, registry, islands, sandbox, AI, export). Chỉ thêm layer UX/operations bên trên.
- [ ] **Image storage**: ảnh paste/drag phải lưu file thật vào `<vault>/assets/` (file-first), KHÔNG base64 inline trong .mdx. Tên file sanitize (no path traversal, no overwrite — append số nếu trùng).
- [ ] **`[[` autocomplete** chỉ insert text `[[target]]` vào buffer — không tạo note trước, không trigger IPC ngoài `indexApi.notes()` (đã có). Zero network, zero side effect.
- [ ] **KHÔNG** upgrade dependencies không liên quan. Chỉ `bun add` nếu cần: `@codemirror/search` (cho find-replace), `@codemirror/autocomplete` (đã có qua basicSetup, verify lại).
- [ ] **Commit message**: conventional commits (`feat:`, `fix:`, ...).
- [ ] Sau mỗi thay đổi có ý nghĩa: `bun run typecheck` và `bun run lint` phải pass.
- [ ] **Phase ordering**: Phase 1 (fix bug) → Phase 2 (vault ops) → Phase 3 (editor polish). KHÔNG đảo. Nếu cạn context giữa chừng, commit + báo cáo phase nào xong, phase nào pending.
- [ ] Gặp blocker hoặc thứ không có trong GOAL này → DỪNG và hỏi, không tự workaround.

---

## Success Criteria

> Mỗi tiêu chí PHẢI có authoritative evidence. Agent chỉ mark complete khi evidence PROVES completion.

### Phase 1 — Bug fixes (P0)

| # | Tiêu chí | Verification | Expected Signal |
|---|----------|--------------|-----------------|
| 1.1 | App nhớ vault: đóng app sau khi mở vault X, mở lại → tự mở vault X không dialog | `bun run dev`, mở vault, đóng window, chạy lại → app state `vault` non-null, không hiện open dialog | Manual smoke test + screenshot/log |
| 1.2 | `app-settings.json` được ghi đúng chỗ | Mở `%APPDATA%/mdx-vault/app-settings.json` sau khi open vault 1 lần | File tồn tại, có field `lastVaultPath: "..."` trỏ đúng vault |
| 1.3 | MDX highlight visible | Mở `example-vault/notes/React Interactive Demo.mdx` (có JSX) | JSX tags (`<QuizBlock />` etc.) có color khác prose — visual proof (screenshot hoặc CM inspector dump showing `cm-jsx-tag-name` class) |
| 1.4 | Highlight không break markdown hiện có | Mở note thuần markdown | Headings/bold/code fence/yaml frontmatter vẫn tô màu |
| 1.5 | `bun run typecheck` pass | `bun run typecheck` | Exit code 0 |
| 1.6 | `bun run lint` pass | `bun run lint` | Exit code 0 |

### Phase 2 — Vault operations

| # | Tiêu chí | Verification | Expected Signal |
|---|----------|--------------|-----------------|
| 2.1 | Delete note: right-click → Delete → confirm → note move vào `<vault>/.trash/` | `grep -n "vault:delete-file\|trash" src/main/ipc/vault-ipc.ts src/main/services/vault-service.ts` + smoke test | File biến khỏi FileTree, xuất hiện trong `.trash/`, không còn trong index |
| 2.2 | Empty trash command | UI button hoặc menu "Empty trash" → xóa `.trash/` content | `.trash/` empty sau khi click |
| 2.3 | Rename note: right-click → Rename → update filename + reindex | Smoke test rename `Foo.mdx` → `Bar.mdx` | File renamed trên disk, FileTree update, note re-indexed (backlinks panel refresh) |
| 2.4 | File tree context menu: New/Rename/Duplicate/Delete/Copy path | Right-click note in FileTree | Menu xuất hiện với ≥4 actions, mỗi action hoạt động |
| 2.5 | File tree sort: Name/Modified/Created, persist preference | Sort dropdown trong sidebar, đổi sort, restart app | Sort persist qua restart; `mtimeMs` từ index được dùng |
| 2.6 | `vault:delete-file`, `vault:rename-file` IPC có zod validation + `safeJoin` | `grep` IPC handlers | Schema validate, path qua `safeJoin`, không cho path traversal |
| 2.7 | typecheck + lint pass | `bun run typecheck && bun run lint` | Exit code 0 |

### Phase 3 — Editor polish

| # | Tiêu chí | Verification | Expected Signal |
|---|----------|--------------|-----------------|
| 3.1 | In-note Find & Replace (`Ctrl+F`/`Ctrl+H`) hoạt động | Mở note, Ctrl+F → search panel, Ctrl+H → replace panel | `@codemirror/search` wired vào extensions; find/replace/replaceAll hoạt động |
| 3.2 | Word/char/reading-time count ở editor header hoặc status bar | Mở note, gõ text | Counter update real-time, format "123 words · 2 min read" |
| 3.3 | `[[` inline autocomplete: gõ `[[` → fuzzy dropdown → Enter insert `[[note]]` | Trong editor, gõ `[[ Welcome` | Dropdown hiện fuzzy-matched notes (reuse `scoreNote`), arrow keys navigate, Enter insert |
| 3.4 | Image paste từ clipboard → save `assets/` → insert markdown link | Copy ảnh (screenshot), paste vào editor | File `<vault>/assets/<sanitized-name>.png` tồn tại, `![](assets/...)` insert vào buffer |
| 3.5 | Image drag-drop import | Kéo file ảnh từ explorer vào editor | Same as 3.4 |
| 3.6 | Inline formatting toolbar: bôi đen → B/I/Code/Link floating bar | Bôi đen text | Toolbar xuất hiện near selection; click B → wrap `**selection**` |
| 3.7 | typecheck + lint pass | `bun run typecheck && bun run lint` | Exit code 0 |

### Completion Condition

Agent kết thúc khi và chỉ khi:

- [ ] **Phase 1**: tất cả criteria 1.1–1.6 pass. Đây là hard gate — KHÔNG được bỏ qua để làm Phase 2/3.
- [ ] **Phase 2**: tất cả criteria 2.1–2.7 pass.
- [ ] **Phase 3**: tất cả criteria 3.1–3.7 pass.
- [ ] Không regression: `bun run dev` smoke test — open vault, edit, save, preview, AI panel, export vẫn hoạt động.
- [ ] Không file/settings bị ghi nhầm ngoài intended location (userData cho settings, vault cho content).

> **Escalation**: Nếu sau Phase 1 + 2, context window sắp cạn → commit, báo cáo, dừng. Phase 3 có thể làm session sau. KHÔNG bắt đầu Phase 3 nếu không đủ context để hoàn thành nó.

---

## Execution Plan

> Thực hiện theo thứ tự. Báo cáo sau mỗi bước trước khi tiếp tục.

### Phase 1 — Fix 2 regression bug (P0, làm đầu tiên)

#### Bước 1.1 — Debug + fix vault reopen (Bug A)

1. **Diagnostic step (bắt buộc trước khi fix)**: Chạy `bun run dev`, mở vault, đóng window. Kiểm tra file `%APPDATA%/mdx-vault/app-settings.json` (Windows: `echo %APPDATA%` để tìm path). Ghi nhận nội dung.
   - Nếu file không tồn tại hoặc không có `lastVaultPath` → bug ở write side → kiểm tra `setLastVaultPath` có được gọi không (thêm `console.log` tạm nếu cần), kiểm tra `app.getPath('userData')` trả gì.
   - Nếu file có `lastVaultPath` đúng nhưng app vẫn hỏi → bug ở read/reopen side → kiểm tra `lastOpenVault()` IPC có return đúng không, `reopenVault(path)` có throw silent không.
2. Fix root cause. **KHÔNG workaround** — phải hiểu tại sao trước.
3. Smoke test: mở vault → đóng → mở lại → tự reopen.
4. **Report**: root cause là gì, fix thế nào, evidence (file content + screenshot).

#### Bước 1.2 — Fix MDX highlight (Bug B)

1. Root cause đã xác định: thiếu `HighlightStyle` map Lezer tags → CSS.
2. Trong `MdxEditor.tsx`, thêm:
   ```ts
   import { HighlightStyle, syntaxHighlighting } from '@codemirror/language'
   import { tags as t } from '@lezer/highlight'

   const mdxHighlightStyle = HighlightStyle.define([
     { tag: t.tagName, color: 'var(--viridian)' },          // JSXTagName
     { tag: t.attributeName, color: 'var(--chart-3)' },     // JSXAttrName
     { tag: t.string, color: 'var(--chart-2)' },            // JSXAttrValue
     { tag: t.angleBracket, color: 'var(--muted-foreground)' }, // JSXPunct
     { tag: t.brace, color: 'var(--viridian)' }             // MDXBraceMark
   ])
   ```
   Verify exact token var names từ `globals.css` (`--viridian`, `--chart-1..5`, etc.).
3. Wire `syntaxHighlighting(mdxHighlightStyle)` vào `extensions` array (sau `markdown(...)`).
4. **Verify**: mở `React Interactive Demo.mdx`, JSX tags phải có color. Mở note thuần markdown, markdown highlight vẫn OK.
5. **Report**: screenshot trước/sau nếu có thể, hoặc CM inspector dump.

#### Bước 1.3 — Verify Phase 1

- `bun run typecheck && bun run lint`
- Smoke test cả 2 bug đã fix.
- Commit: `fix: vault reopen persistence + mdx editor highlight rendering`.

### Phase 2 — Vault operations

#### Bước 2.1 — Backend IPC: delete + rename

- `vault-service.ts`: thêm `deleteFile(relPath)` (move vào `.trash/`), `renameFile(oldRel, newRel)` (atomic rename, mkdir parent nếu cần). Cả hai qua `safeJoin`.
- `vault-ipc.ts`: thêm `vault:delete-file`, `vault:rename-file` handlers với zod schema. Sau op → trigger `indexFile`/`unindexFile` tương ứng.
- `index-service.ts`: kiểm tra có `unindexFile(relPath)` chưa, nếu chưa thì thêm (delete index entry khi file bị remove).
- Preload: thêm `deleteFile(relPath)`, `renameFile(oldRel, newRel)` vào `vaultApi`.

#### Bước 2.2 — File tree context menu (UI)

- `FileTree.tsx`: thêm context menu (dùng `@radix-ui/react-context-menu` hoặc shadcn `context-menu`). Actions: New note (ở folder), Rename, Duplicate, Delete (move trash), Copy relative path, Reveal in explorer (Electron `shell.showItemInFolder`).
- Rename: inline edit mode trong tree (input thay thế label, Enter confirm, Esc cancel) hoặc dialog.
- Delete: confirm dialog (alert-dialog) → move trash.

#### Bước 2.3 — File tree sort

- Sidebar header: thêm sort dropdown (3 option Name/Modified/Created).
- `App.tsx`: state `sortMode`, persist vào `AppSettingsService` (thêm field `fileTreeSort`).
- `FileTree.tsx`: nhận `sortMode` prop, sort theo đó. `mtimeMs` đã có trong `VaultFile`/index — verify field name rồi dùng.

#### Bước 2.4 — Empty trash

- Vault menu hoặc FileTree: khi `.trash/` non-empty, hiện "Empty trash (N items)" action.
- IPC `vault:empty-trash` → `fs.rm` recursive `.trash/*`.

#### Bước 2.5 — Verify Phase 2

- `bun run typecheck && bun run lint`
- Smoke test: delete/rename/duplicate/sort/empty trash.
- Commit: `feat: vault operations (delete, rename, duplicate, trash, tree sort)`.

### Phase 3 — Editor polish

#### Bước 3.1 — Find & Replace

- `bun add @codemirror/search` (nếu chưa có — verify `package.json`).
- `MdxEditor.tsx`: thêm `search({ top: true })` (hoặc config phù hợp) vào extensions. Keymap `searchKeymap` từ `basicSetup` sẽ tự hoạt động.
- Verify Ctrl+F mở find panel, Ctrl+H mở replace.

#### Bước 3.2 — Word/char count

- `MdxEditor.tsx` hoặc `App.tsx`: compute từ `value` (memoize). Format: "N words · M chars · K min read" (200 wpm).
- Render ở editor header (`App.tsx:591-597`) cạnh save label.

#### Bước 3.3 — `[[` inline autocomplete

- `MdxEditor.tsx`: thêm completion source (dùng `autocompletion` từ `@codemirror/autocomplete`, đã có qua `basicSetup` — verify).
- Trigger khi user gõ `[[` — detect qua `context.matchBefore(/\[\[[^\]]*$/)` hoặc tương tự.
- Source: `window.indexApi.notes()` (cache once per editor session, refresh on index change).
- Reuse `scoreNote`/`isSubsequence` từ `QuickSwitcher.tsx` (extract ra `lib/fuzzy-match.ts` để share).
- Apply: insert `[[${note.title}]]` (hoặc relativePath nếu trùng title).

#### Bước 3.4 — Image paste + drag-drop

- `MdxEditor.tsx`: thêm `EditorView.domEventHandlers({ paste, drop })`.
- Paste: check `clipboardData.files` hoặc `clipboardData.items` loại image → gọi IPC `vault:save-asset(arrayBuffer, suggestedName)` → main save vào `<vault>/assets/<sanitized>` (safeJoin, no overwrite — append `-1`/`-2`) → return relativePath → editor insert `![](assets/<name>)`.
- Drop: same logic với `dataTransfer.files`.
- `vault-ipc.ts`: thêm `vault:save-asset` handler. Validate image MIME type allowlist (png/jpeg/gif/webp/svg). `[cần xác nhận]` — arrayBuffer transfer qua IPC có cần structuredClone hay không, verify.

#### Bước 3.5 — Inline formatting toolbar

- Component `InlineFormatToolbar.tsx`: floating panel positioned at selection coords (dùng CM `view.coordsAtPos(selection.head)`).
- Buttons: Bold (`**`), Italic (`*`), Code (`` ` ``), Link (`[]()`). Wrap selection bằng `view.dispatch({ changes: { from, to, insert: wrap } })`.
- Show/hide: `EditorView.updateListener` track selection change → show khi non-empty selection, hide khi empty.
- Reuse pattern từ `AiSelectionActionPalette.tsx` (đã có selection-aware floating palette).

#### Bước 3.6 — Verify Phase 3

- `bun run typecheck && bun run lint`
- Smoke test: find-replace, word count, `[[` autocomplete, image paste/drop, format toolbar.
- Commit: `feat: editor polish (find-replace, word count, link autocomplete, image import, format toolbar)`.

---

## Out of Scope

Những thứ KHÔNG thuộc goal này (đừng tự làm):

- **Multi-tab / multi-note editing** — scope lớn, cần buffer management, goal riêng.
- **Hover preview on wikilinks** — cần preview component render pipeline, goal riêng.
- **Outline/TOC panel** — riêng.
- **Global find & replace** — riêng (khác in-note find-replace).
- **Templates / daily notes / bookmarks** — PKM features, goal riêng.
- **Snapshot / version history** — cần design storage, goal riêng.
- **Spellcheck, Vim mode, Mermaid live preview** — Tier 3, skip.
- **Graph view, tag panel** — đã trong "Ngoài roadmap" của docs/roadmap.md.
- **Refactor lớn App.tsx state management** — chỉ sửa vừa đủ.
- **Performance optimization ngoài scope** (FileTree virtualization, etc.).
- **Mobile, sync, collaboration** — explicit anti-goals.

---

## References

- [AGENTS.md](../AGENTS.md) — conventions, commands, security invariants
- [docs/security.md](../docs/security.md) — trust levels, Electron hardening
- [docs/mdx-conventions.md](../docs/mdx-conventions.md) — note format, frontmatter convention
- [docs/tech-stack.md](../docs/tech-stack.md) — CodeMirror gotchas
- [CodeMirror highlight example](https://codemirror.net/examples/styling/) — `HighlightStyle` + `syntaxHighlighting` pattern
- [CodeMirror search package](https://codemirror.net/docs/ref/#search) — `@codemirror/search` API
- [CodeMirror autocomplete](https://codemirror.net/docs/ref/#autocomplete) — `autocompletion` + completion source API
- Files cần đọc trước khi implement:
  - `src/renderer/src/App.tsx` (state, layout, sidebar header)
  - `src/renderer/src/editor/MdxEditor.tsx` (CM extensions, theme)
  - `src/renderer/src/editor/mdx-highlight.ts` (existing JSX parser — chỉ thêm HighlightStyle, không sửa parser)
  - `src/renderer/src/explorer/FileTree.tsx` (file tree render, sort)
  - `src/renderer/src/explorer/QuickSwitcher.tsx:114-148` (`scoreNote`/`isSubsequence` để extract + reuse)
  - `src/renderer/src/ai/panels/AiSelectionActionPalette.tsx` (pattern cho floating selection toolbar)
  - `src/main/ipc/vault-ipc.ts` (IPC pattern, zod schema)
  - `src/main/services/vault-service.ts` (file I/O, `safeJoin`)
  - `src/main/services/app-settings.ts` (persist pattern, theme field để thêm sort)
  - `src/main/index.ts` (app lifecycle, where appSettings wired)
  - `src/preload/index.ts` + `src/preload/index.d.ts` (preload API surface)
  - `src/renderer/src/globals.css` (token vars: `--viridian`, `--chart-1..5`, `--muted-foreground`)

---

## Agent Instructions

### Execution

1. Đọc toàn bộ file này + AGENTS.md + docs/security.md trước khi làm bất kỳ thứ gì.
2. Tuân theo Constraints tuyệt đối — không có ngoại lệ.
3. **Phase ordering là bắt buộc**: Phase 1 (fix bug) → Phase 2 (vault ops) → Phase 3 (editor polish). Không đảo.
4. Thực hiện từng bước trong Execution Plan, báo cáo ngắn gọn sau mỗi bước.
5. Bước 1.1 (debug vault reopen) BẮT BUỘC phải diagnostic trước khi fix — hiểu root cause rồi mới sửa.
6. Nếu phát hiện conflict giữa Constraints và Execution Plan: ưu tiên Constraints.
7. Nếu gặp thứ gì không có trong GOAL này: DỪNG và hỏi, không tự assume.
8. **Escalation policy**: nếu context sắp cạn sau Phase 1 hoặc giữa Phase 2 → commit, báo cáo rõ phase nào xong/pending, dừng. Không cố làm nốt Phase 3 nếu không đủ context.
9. Khi xong: verify toàn bộ Success Criteria theo phase, báo cáo từng item với evidence.

### Anti-bias Instructions

- **Chống Scope Shrink**: KHÔNG redefine "done" thành subset dễ hơn. Phase 1 là hard gate — cả 2 bug phải thật sự fixed (runtime verified, không phải "code có vẻ đúng"). Phase 2/3 phải đạt đủ criteria.
- **Chống Uncertainty Stop**: KHÔNG dừng vì không sure bug fixed chưa. Treat uncertain evidence = not achieved → debug tiếp. Chỉ dừng khi PROVES completion (screenshot, file content, smoke test pass).
- **Chống Memory Trust**: KHÔNG assume đã làm X chỉ vì nhớ đã làm. Inspect current worktree/file thật trước khi claim done.
- **Chống Bug Masking**: Bug A (vault reopen) có thể có multiple root causes. Fix 1 hypothesis rồi smoke test — nếu vẫn fail, debug tiếp hypothesis khác, KHÔNG mark done khi chưa runtime verify.
- **Chóng Security Drift**: Image paste/asset save phải qua `safeJoin`, MIME allowlist, sanitize filename. Re-verify constraint trước khi mark Phase 3 done.
