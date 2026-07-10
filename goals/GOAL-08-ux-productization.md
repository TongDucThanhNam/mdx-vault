# GOAL-08 — UX Productization

> File này được tạo tự động bởi create-goal skill.
> Agent thực thi: đọc toàn bộ file này trước khi làm bất kỳ thứ gì.
> Tuân thủ tuyệt đối [AGENTS.md](../AGENTS.md) + [docs/security.md](../docs/security.md).

---

## Objective

Làm mdx-vault dùng được như một sản phẩm thực (không chỉ demo): người dùng có thể **tạo note mới, đóng app rồi mở lại đúng vault cũ, nhìn thấy MDX syntax highlight khi viết, và chuyển giữa source-only / split / preview-only**. Bốn khoảng trống mà user đã nêu đều phải được đóng, giữ nguyên mọi invariant (file-first, sandbox, security hardening).

---

## Context

- **Lý do**: Mục tiêu 01–07 đã hoàn thành phần lớn (vault core, indexing, registry, islands, sandbox, AI, export). Nhưng UX còn thô: không tạo note được, không nhớ vault, editor không highlight MDX, không có view-mode toggle. Đây là những gap cơ bản của một note app — không phải feature roadmap mới.
- **Ưu tiên**: correctness > speed. Security invariant tuyệt đối.
- **Người thực hiện**: AI Agent (báo cáo sau mỗi bước, không có human review từng bước).
- **Ngày tạo**: 2026-07-04.

---

## Current State

| Item                | Giá trị                                                                                                                                                                                 |
| ------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Framework / Runtime | Electron 39 + React 19 + electron-vite, TypeScript                                                                                                                                      |
| Editor              | CodeMirror 6 (`basicSetup`) với `@codemirror/lang-markdown` + code languages (js/ts/jsx, html, yaml)                                                                                    |
| Preview             | `@mdx-js/mdx` `evaluate()` trong renderer (trusted vault)                                                                                                                               |
| Layout hiện tại     | FileTree (280px) \| Editor (1fr) \| Preview (0.9fr) \| [AI panel 360px] — preview chỉ ẩn/hiện qua `showPreview: boolean`                                                                |
| State UI            | `App.tsx` giữ toàn bộ state, `gridTemplateColumns(showPreview, aiPanelOpen)` tính grid string                                                                                           |
| File I/O            | `vault:read-file`, `vault:write-file`, `vault:list-files`, `vault:open` — không có `vault:create-file` hay `vault:delete-file`                                                          |
| Persist settings    | `AiSettingsService` persist vào `.app/ai-settings.bin` **trong vault** (encrypt qua `safeStorage`). Không có app-level settings nào persist **ngoài** vault → vault path không được nhớ |
| Entry points        | Main: `src/main/index.ts`; IPC: `src/main/ipc/*`; Preload: `src/preload/index.ts`; Renderer: `src/renderer/src/App.tsx`                                                                 |
| Theme               | Tailwind v4, `:root` light + `.dark` dark tokens đã định nghĩa sẵn trong `globals.css` — nhưng **không có toggle dark mode**                                                            |
| Package manager     | `bun` (bun.lock, KHÔNG dùng npm/pnpm/yarn)                                                                                                                                              |

### Quan sát cụ thể về 4 gap

1. **Create file**: `VaultService.writeFile(relPath, content)` ở `src/main/services/vault-service.ts:81` đã `mkdir(dirname, {recursive:true})` rồi rename `.tmp` → **tạo file mới kỹ thuật đã hoạt động**, chỉ thiếu: một IPC channel tường minh (`vault:create-file`), preload method, và UI (nút "+ New note" trong FileTree header + dialog nhập tên).
2. **Remember vault**: `openVault()` ở `App.tsx:155` luôn gọi `window.vaultApi.openVault()` → dialog chọn folder. Cần persist **path string** (không phải content, không nhạy cảm) vào `app.getPath('userData')` — tách bạch khỏi `AiSettingsService` (vault-scoped). Trên startup, nếu có last-vault path và path vẫn tồn tại → mở thẳng không hỏi.
3. **MDX highlight**: Không có `@codemirror/lang-mdx` chính thức (verified via CodeMirror forum). Hiện `markdown({ codeLanguages })` chỉ highlight code fences, không highlight JSX/JS trong prose. Cần hoặc (a) gói cộng đồng `codemirror-lang-mdx`, hoặc (b) custom Lezer grammar extension. `[cần xác nhận]` — xem Execution Plan bước 1.
4. **View toggle**: `showPreview: boolean` ở `App.tsx:45` + `gridTemplateColumns()` ở `App.tsx:621` chỉ cover 2 mode (preview on/off). Editor luôn visible. Cần `viewMode: 'source' | 'split' | 'preview'`, segmented control trong header, và logic grid tương ứng (khi `'preview'` → ẩn editor, ẩn khi không cần).

---

## Target State

| Item               | Giá trị                                                                                                                  |
| ------------------ | ------------------------------------------------------------------------------------------------------------------------ |
| Create file        | Nút "New note" trong FileTree header → dialog → tạo `Untitled.mdx` (hoặc tên user nhập) → mở ngay                        |
| Remember vault     | App nhớ last-opened vault path trong userData; reopen on startup nếu path còn tồn tại; "Open vault" vẫn available để đổi |
| MDX highlight      | Editor highlight JSX tags (`<Component />`), attributes, `{expressions}` trong MDX — không chỉ code fences               |
| View modes         | Segmented control: **Source / Split / Preview**. State persisted per-session (optional)                                  |
| Dark mode          | Toggle dark/light (theme tokens đã có sẵn)                                                                               |
| Thứ KHÔNG thay đổi | File-first invariant, sandbox model, security hardening, IPC validation pattern, semua API hiện có                       |

---

## Constraints

> Agent PHẢI tuân theo tuyệt đối. Conflict với Execution Plan → ưu tiên Constraints.

- [ ] **Security bất biến**: `contextIsolation: true`, `sandbox: true`, `nodeIntegration: false` giữ nguyên. Mọi IPC handler mới validate input bằng zod ở main. Mọi path từ renderer phải qua `safeJoin()`. KHÔNG expose `fs`/`path`/`ipcRenderer` thô qua preload.
- [ ] **File-first**: file `.mdx` là source of truth. Create file = ghi file thật lên filesystem, không phải in-memory entry. SQLite chỉ index — sau create phải trigger reindex (xem cách `vault:write-file` đã gọi `indexFile`).
- [ ] **KHÔNG** thay đổi trust model: MDX highlight là **presentation-only trong editor (renderer)** — không sinh code, không eval, không chạm vào sandbox/registry pipeline.
- [ ] **KHÔNG** sửa behavior của goal 02–07 (indexing, registry, islands, sandbox, AI, export). Chỉ thêm layer UX bên trên.
- [ ] **KHÔNG** persist nội dung note hay bất kỳ thứ nhạy cảm ngoài vault. Remember-vault chỉ lưu **đường dẫn folder** (path string) — không lưu API key, không lưu note content.
- [ ] **KHÔNG** upgrade dependencies không liên quan. Chỉ thêm dependency mới qua `bun add` nếu thực sự cần cho MDX highlight (verify trước — xem Execution Plan bước 1).
- [ ] Commit message: conventional commits (`feat:`, `fix:`, ...).
- [ ] Sau mỗi thay đổi có ý nghĩa: `bun run typecheck` và `bun run lint` phải pass.
- [ ] Gặp blocker hoặc thứ không có trong GOAL này → DỪNG và hỏi, không tự workaround.

---

## Success Criteria

> Mỗi tiêu chí PHẢI có authoritative evidence. Agent chỉ mark complete khi evidence PROVES completion.

### Required Evidence per Criterion

| #   | Tiêu chí                                                                                                           | Verification Command                                                                                                                                        | Expected Output / Signal                                                                                                           |
| --- | ------------------------------------------------------------------------------------------------------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------- |
| 1   | Tạo được note mới từ UI và file thật xuất hiện trên disk                                                           | Khởi chạy `bun run dev`, bấm "New note", nhập tên, confirm → kiểm tra file `<vault>/<name>.mdx` tồn tại và xuất hiện trong FileTree; MdxPreview render được | File exists; FileTree list có entry mới; editor mở file mới                                                                        |
| 2   | `vault:create-file` IPC handler có zod validation & đi qua `safeJoin`                                              | `grep -n "vault:create-file" src/main/ipc/vault-ipc.ts`                                                                                                     | Handler tồn tại, parse schema, gọi `getCurrentVault()` + `indexFile`                                                               |
| 3   | App nhớ vault: đóng app sau khi mở vault X, mở lại → tự mở vault X không cần dialog                                | Đóng app (`before-quit`), khởi chạy lại → App state `vault` non-null, không hiện open dialog                                                                | `grep -n "lastVaultPath\|userData" src/main/services/app-settings.ts` (hoặc tương đương) trả về kết quả; startup flow reopen vault |
| 4   | Persist last-vault lưu ở `app.getPath('userData')`, KHÔNG trong vault folder                                       | Kiểm tra service ghi/đọc từ `path.join(app.getPath('userData'), 'app-settings.json')` (hoặc tương đương)                                                    | Không có file `.app/app-settings*` trong vault; có file trong userData dir                                                         |
| 5   | MDX syntax highlight: JSX tag `<Foo />`, attribute `bar="x"`, expression `{value}` được tô màu khác markdown prose | Mở note chứa MDX với JSX (vd `example-vault/notes/React Interactive Demo.mdx`), inspect editor → token JSX có highlight style (cm-* class khác token prose) | Visual proof (screenshot hoặc CM inspector dump) — JSX tokens được highlight                                                       |
| 6   | View-mode toggle có 3 trạng thái Source / Split / Preview, layout thay đổi đúng                                    | Bấm 3 nút trong segmented control → grid columns thay đổi; Source = chỉ editor; Preview = chỉ preview; Split = cả hai                                       | `grep -n "viewMode" src/renderer/src/App.tsx`; grid template đổi theo mode                                                         |
| 7   | `bun run typecheck` pass                                                                                           | `bun run typecheck`                                                                                                                                         | Exit code 0                                                                                                                        |
| 8   | `bun run lint` pass                                                                                                | `bun run lint`                                                                                                                                              | Exit code 0                                                                                                                        |

### Completion Condition

Agent kết thúc khi và chỉ khi:

- [x] Tất cả 8 verification trên pass với expected output.
- [x] Không regression: `bun run dev` khởi chạy được, mở vault, edit, save, preview vẫn hoạt động (smoke test manual).
- [x] Không có file/settings bị ghi nhầm vào vault folder ngoài intent của user.

> **Pre-existing blockers fixed during GOAL-08 smoke test** (all goal-02/06/07
> packaging bugs, not GOAL-08 logic):
>
> 1. `electron.vite.config.ts`: main config had no `@/` alias → Rollup failed
>    on `export-static-snapshot.ts` importing `preview/Counter.tsx`. Added
>    shared aliases to `main`.
> 2. `electron.vite.config.ts`: `@tanstack/ai`/`@tanstack/ai-openai` are
>    ESM-only; electron-vite externalized them → `ERR_PACKAGE_PATH_NOT_EXPORTED`
>    at runtime. Excluded them from `externalizeDeps`.
> 3. `export-renderer.ts`: `remarkRehype`/`rehypeSanitize`/`rehypeStringify`
>    used without `resolvePluginDefault()` wrapper (unlike the remark-* plugins)
>    → "empty preset" under CJS interop. Wrapped all three.
>
> All three are out-of-scope fixes required to make the app runnable for the
> smoke test. Typecheck + lint + build + dev all pass clean after.

---

## Execution Plan

> Thực hiện theo thứ tự. Báo cáo sau mỗi bước trước khi tiếp tục.

### Bước 1 — Research MDX highlight (DEcide approach, KHÔNG code)

- Verify: có package cộng đồng `codemirror-lang-mdx` (hoặc tương đương) trên npm không? Maintained? Compatible CM6?
- Nếu có và OK → dùng. Nếu không → plan B: tự viết Lezer markdown extension nhận diện JSX regions, hoặc dùng StreamLanguage.
- **Output**: comment trong PR/goal report nêu approach đã chọn + lý do. `[cần xác nhận]` resolve ở bước này.
- **Chỉ sau khi decide** mới `bun add` đúng package (nếu cần).

### Bước 2 — Create note (backend)

- Thêm `vault:create-file` IPC handler trong `src/main/ipc/vault-ipc.ts`: payload `{ relativePath: string, content?: string }`, zod validate, gọi `VaultService.writeFile` (đã support tạo mới) + `getCurrentIndex().indexFile(relativePath)`.
- Bổ sung method vào preload `vaultApi` (`src/preload/index.ts` + `src/preload/index.d.ts` nếu có).
- Default content cho note mới: minimal MDX frontmatter + heading (xem convention `docs/mdx-conventions.md`).
- **Report**: typecheck + lint pass.

### Bước 3 — Create note (UI)

- Thêm nút "+ New note" (icon `FilePlus` từ lucide) vào FileTree header (`App.tsx:460`) cạnh count.
- Dialog nhập tên note (dùng `@/components/ui/dialog` hoặc `alert-dialog`). Validate tên (no path traversal, append `.mdx` nếu thiếu, escape tên file).
- On confirm → gọi `vaultApi.createFile(...)` → `loadFile(newPath)` → refresh FileTree (`refreshVaultSnapshot`).
- Empty-vault CTA: nếu vault mở nhưng `files.length === 0`, FileTree show "Create your first note".

### Bước 4 — Remember vault (backend)

- Tạo service mới `src/main/services/app-settings.ts`: `getLastVaultPath()`, `setLastVaultPath(path)`, lưu JSON tại `path.join(app.getPath('userData'), 'app-settings.json')`. Atomic write (temp + rename như `AiSettingsService`). KHÔNG lưu gì khác ngoài path string + optional UI prefs.
- Thêm IPC: `app:get-last-vault` (no payload), tự handle trong main (không cần vault open).
- Trên `app.whenReady()` (`src/main/index.ts:52`): sau `registerVaultIpc`, đọc last-vault path; nếu tồn tại trên disk (`fs.existsSync`) → `openCurrentVault(path)` proactively. Expose signal cho renderer (vd trả last-vault qua IPC, renderer tự decide open).
- **Cẩn thận**: không block window creation. Nếu reopen fail (folder moved/deleted) → clear last-vault, show normal empty state. Báo lỗi thân thiện, không crash.

### Bước 5 — Remember vault (renderer)

- Trên `App.tsx` mount: hỏi main last-vault path; nếu có → `openVault` silent (không dialog). Nếu không → giữ behavior hiện tại (Open vault button).
- `openVault()` (manual, qua dialog) và silent-open đều ghi lại last-vault path sau khi thành công.
- "Open vault" button vẫn available để đổi vault bất cứ lúc nào.

### Bước 6 — View-mode toggle

- Đổi state `showPreview: boolean` → `viewMode: 'source' | 'split' | 'preview'` (default `'split'`).
- Đổi `gridTemplateColumns(showPreview, aiPanelOpen)` → `gridTemplateColumns(viewMode, aiPanelOpen)`:
  - `source` + no ai → `grid-cols-[280px_minmax(0,1fr)]`
  - `split` + no ai → `grid-cols-[280px_minmax(0,1fr)_minmax(340px,0.9fr)]`
  - `preview` + no ai → `grid-cols-[280px_minmax(0,1fr)]` (editor ẩn, preview chiếm slot editor)
  - - variants với ai panel (thêm 360px cột cuối).
- Render logic: editor section visible khi `viewMode !== 'preview'`; preview section visible khi `viewMode !== 'source'`.
- UI: thay nút Eye/EyeOff bằng segmented control (3 nút: `SquareCode`/`Columns`/`Eye`, hoặc dùng `@radix-ui` toggle group). Keyboard shortcut (vd `Ctrl+Shift+V` cycle).
- Backlinks panel: vẫn thuộc preview pane (giữ nguyên).

### Bước 7 — MDX highlight (editor)

- Implement approach đã decide ở bước 1.
- Wire vào `MdxEditor.tsx` `extensions` array (thay hoặc bổ sung cho `markdown({ codeLanguages })`).
- Đảm bảo không break markdown highlight hiện có (headings, bold, code fence, yaml frontmatter vẫn tô màu).
- Test với `example-vault/notes/React Interactive Demo.mdx` (có JSX) + note thuần markdown.

### Bước 8 — Dark mode toggle (bonus, nhỏ)

- `document.documentElement.classList.toggle('dark')`. Persist preference vào app-settings (cùng file last-vault) hoặc localStorage.
- Toggle button trong header (icon `Sun`/`Moon`).
- Detect system pref via `window.matchMedia('(prefers-color-scheme: dark)')` lần đầu chạy (optional).

### Bước 9 — Verify toàn bộ

- Chạy `bun run typecheck` và `bun run lint`.
- Smoke test `bun run dev`: tạo note → edit → save → preview → đổi view mode → restart app (verify reopen vault + last note) → toggle dark mode.
- Verify từng row trong Success Criteria. Báo cáo.

---

## Out of Scope

Những thứ KHÔNG thuộc goal này (đừng tự làm):

- Delete note / rename note (scope riêng, cần confirm dialog + index cleanup — goal khác).
- Multi-tab / multi-note editing.
- Graph view, tag panel (đã trong "Ngoài roadmap" của docs/roadmap.md).
- Git sync, mobile, collaboration, publish.
- Thay đổi sandbox model, registry, AI pipeline.
- Refactor lớn `App.tsx` state management (vd tách ra store/context) — chỉ sửa vừa đủ cho features này.
- Custom keyboard shortcut editor / settings panel đầy đủ.
- Performance optimization ngoài scope (vd virtualization FileTree).

---

## References

- [AGENTS.md](../AGENTS.md) — conventions, commands, security invariants
- [docs/security.md](../docs/security.md) — trust levels, Electron hardening
- [docs/mdx-conventions.md](../docs/mdx-conventions.md) — note format, frontmatter convention
- [docs/tech-stack.md](../docs/tech-stack.md) — CodeMirror gotchas
- CodeMirror MDX discussion: https://discuss.codemirror.net/t/how-to-syntax-highlight-mdx-in-codemirror-v6/8849
- MDX highlighting guide: https://mdxjs.com/guides/syntax-highlighting/
- Files cần đọc trước:
  - `src/renderer/src/App.tsx` (state + layout)
  - `src/renderer/src/editor/MdxEditor.tsx` (CM extensions)
  - `src/main/ipc/vault-ipc.ts` (IPC pattern)
  - `src/main/services/vault-service.ts` (file I/O)
  - `src/main/services/ai-settings.ts` (persist pattern để bắt chước cho app-settings)
  - `src/main/index.ts` (app lifecycle)
  - `src/preload/index.ts` (expose API)

---

## Agent Instructions

### Execution

1. Đọc toàn bộ file này + AGENTS.md + docs/security.md trước khi làm bất kỳ thứ gì.
2. Tuân theo Constraints tuyệt đối — không ngoại lệ.
3. Thực hiện Execution Plan theo thứ tự, từng bước một. Báo cáo ngắn gọn sau mỗi bước.
4. Bước 1 (research MDX highlight) phải resolve `[cần xác nhận]` trước khi code bước 7.
5. Nếu phát hiện conflict giữa Constraints và Execution Plan: ưu tiên Constraints.
6. Nếu gặp thứ gì không có trong GOAL này: DỪNG và hỏi, không tự assume.
7. Khi xong: verify toàn bộ Success Criteria, báo cáo từng item với evidence.

### Anti-bias Instructions

- **Chống Scope Shrink**: KHÔNG redefine "done" thành subset dễ hơn. Cả 4 gap (create file, remember vault, MDX highlight, view toggle) phải đạt đủ. Bước 8 (dark mode) là bonus — nếu đạt tốt, nếu blocker thì báo và skip được, KHÔNG skip 4 gap chính.
- **Chống Uncertainty Stop**: KHÔNG dừng vì không chắc một requirement đạt chưa. Treat uncertain evidence = not achieved → làm tiếp. Chỉ dừng khi evidence PROVES completion.
- **Chống Memory Trust**: KHÔNG assume đã làm X chỉ vì nhớ đã làm. Inspect current worktree/file thật trước khi claim done. Current state là authoritative.
- **Chóng Security Drift**: Remember-vault lưu path string thuần, KHÔNG vô tình persist content/key. Re-verify constraint "không ghi ngoài userData" trước khi mark criterion 4 done.
