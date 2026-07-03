# GOAL-01 — App shell + Vault core

> Agent thực thi: đọc toàn bộ file này + `AGENTS.md` + `docs/security.md` + `docs/architecture.md` trước khi làm bất kỳ thứ gì.

## Objective

Biến template electron-vite hiện tại thành lát cắt dọc đầu tiên của mdx-vault: mở một vault folder, duyệt file `.md`/`.mdx`, edit bằng CodeMirror 6, preview MDX render live (trusted content), autosave về file. Kèm Electron security hardening bắt buộc.

## Context

- **Lý do**: Đây là foundation — mọi goal sau build trên vòng lặp open → edit → preview → save.
- **Ưu tiên**: correctness > speed. Security config là non-negotiable.
- **Người thực hiện**: AI Agent.
- **Ngày tạo**: 2026-07-03

## Current State

| Item            | Giá trị                                                                                                                   |
| --------------- | ------------------------------------------------------------------------------------------------------------------------- |
| Framework       | Electron 39 + electron-vite 5 + React 19 + TS, template mặc định chưa sửa                                                 |
| Package manager | bun (bun.lock)                                                                                                            |
| Entry points    | `src/main/index.ts`, `src/preload/index.ts`, `src/renderer/src/main.tsx`                                                  |
| UI hiện tại     | `App.tsx` + `Versions.tsx` demo của template — sẽ thay thế                                                                |
| Styling         | Tailwind v4 + shadcn đã cấu hình (`globals.css`, `components.json`, alias `@/*`); có sẵn `components/ui/button.tsx`       |
| Deps đã cài     | codemirror + lang packs, @mdx-js/mdx, remark/rehype, gray-matter, fast-glob, zod, react-error-boundary (xem package.json) |
| Security config | `sandbox: false` trong BrowserWindow (mặc định template) — PHẢI sửa                                                       |
| Test setup      | Chưa có                                                                                                                   |

## Target State

| Item               | Giá trị                                                                                                                                                                                                   |
| ------------------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| BrowserWindow      | `contextIsolation: true`, `sandbox: true`, `nodeIntegration: false`, `webSecurity: true`                                                                                                                  |
| Main process       | `services/safe-path.ts` (safeJoin), `services/vault-service.ts`, `ipc/vault-ipc.ts` với channels: `vault:open`, `vault:list-files`, `vault:read-file`, `vault:write-file` — mọi payload validate bằng zod |
| Preload            | `window.vaultApi` typed (openVault/listFiles/readFile/writeFile), khai báo type trong `src/preload/index.d.ts`                                                                                            |
| Renderer           | Layout 3 vùng bằng shadcn + Tailwind: file tree (trái) / CodeMirror editor (giữa) / MDX preview (phải). Toggle preview được.                                                                              |
| Editor             | CodeMirror 6 `basicSetup` + `lang-markdown` (codeLanguages: js, html, yaml), line wrapping                                                                                                                |
| Preview            | `@mdx-js/mdx` `evaluate()` + remark-gfm, debounce ~300ms, bọc react-error-boundary, lỗi compile hiện trong preview pane (không sập app)                                                                   |
| Demo components    | `mdx-components.tsx` với 1–2 component đơn giản (vd `<Counter />`) chứng minh island hoạt động                                                                                                            |
| Persistence        | Autosave debounce ~1s sau khi ngừng gõ + Ctrl/Cmd+S; ghi atomic (write temp → rename)                                                                                                                     |
| Example vault      | `example-vault/` mở được và hoạt động end-to-end                                                                                                                                                          |
| Thứ KHÔNG thay đổi | package.json scripts, electron-builder.yml, cấu hình Tailwind/shadcn đã có                                                                                                                                |

## Constraints

- [ ] KHÔNG expose `fs`, `path`, `ipcRenderer` thô qua contextBridge — chỉ API hẹp đã typed
- [ ] Mọi file access ở main process qua `safeJoin()` chống path traversal; renderer chỉ gửi relative path
- [ ] KHÔNG thêm dependency mới nếu package.json đã có thứ tương đương; nếu thật sự cần → dùng `bun add` và ghi rõ lý do trong báo cáo
- [ ] KHÔNG upgrade dependencies
- [ ] KHÔNG implement: index/SQLite, wikilink resolution, sandbox iframe, AI — thuộc goal sau
- [ ] `evaluate()` của MDX chỉ chạy trên nội dung vault user tự mở (trusted trong phạm vi goal này) — ghi comment đánh dấu chỗ này sẽ được siết ở GOAL-03/05
- [ ] Giữ nguyên hành vi `setWindowOpenHandler` deny + openExternal của template
- [ ] Nếu gặp blocker: DỪNG và mô tả blocker, KHÔNG tự workaround

## Success Criteria

- [ ] `bun run typecheck` và `bun run lint` pass
- [ ] `bun run dev` mở app; chọn `example-vault/` qua dialog → file tree hiện các file `.md`/`.mdx` (ignore `node_modules`, `.git`, `.app`)
- [ ] Mở `example-vault/notes/Welcome.mdx` → editor hiện source, preview render heading, list, `<details>` HTML, và `<Counter />` island click được
- [ ] Gõ nội dung mới → preview cập nhật ≤ 1s; gõ MDX syntax lỗi → preview hiện error, app không crash, sửa lại thì preview phục hồi
- [ ] Sửa nội dung → autosave: đóng mở lại app, nội dung còn nguyên trên disk
- [ ] Thử đọc file bằng relative path `../../ngoài-vault` qua devtools → bị từ chối (safeJoin throw)
- [ ] BrowserWindow webPreferences đúng như Target State (kiểm bằng đọc code)

## Execution Plan

1. Hardening `src/main/index.ts` (webPreferences) — verify app vẫn boot
2. `services/safe-path.ts` + unit-testable thuần (không cần framework test, viết hàm pure)
3. `services/vault-service.ts` + `ipc/vault-ipc.ts` (zod validate) + đăng ký trong main
4. Preload API + type declarations
5. Renderer: vault state (React state/context đơn giản), file tree component (shadcn), open vault button
6. `editor/MdxEditor.tsx` (CodeMirror 6, controlled từ ngoài)
7. `preview/MdxPreview.tsx` + `mdx-components.tsx` + error boundary + debounce
8. App shell layout + autosave + Ctrl/Cmd+S
9. Hoàn thiện `example-vault/` nếu thiếu nội dung minh họa
10. Verify toàn bộ Success Criteria, báo cáo từng item

## Out of Scope

- SQLite/index/search/backlinks (GOAL-02)
- Sanitize policy chính thức, registry chính thức (GOAL-03)
- Interactive templates, sandbox, AI, export (GOAL-04+)
- Multi-tab, split view, theme switcher, settings UI

## References

- `docs/architecture.md` — vị trí file, IPC conventions
- `docs/security.md` — hardening checklist (mục Electron hardening + Filesystem)
- `docs/mdx-conventions.md` — anatomy của note
- Electron security docs: https://www.electronjs.org/docs/latest/tutorial/security
- MDX evaluate: https://mdxjs.com/packages/mdx/
- CodeMirror basicSetup: https://codemirror.net/docs/ref/
- Dùng MCP `context7` để tra API mới nhất khi cần

## Agent Instructions

1. Đọc toàn bộ file này + AGENTS.md + docs/security.md trước khi làm
2. Tuân theo Constraints tuyệt đối — không có ngoại lệ
3. Thực hiện Execution Plan theo thứ tự, báo cáo ngắn sau mỗi bước
4. Conflict giữa Constraints và Execution Plan → ưu tiên Constraints
5. Gặp thứ không có trong GOAL → DỪNG và hỏi
6. Khi xong: verify toàn bộ Success Criteria và báo cáo từng item
