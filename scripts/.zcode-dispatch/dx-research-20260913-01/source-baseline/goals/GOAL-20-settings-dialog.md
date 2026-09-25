# GOAL-20 — Settings Dialog và bề mặt cấu hình tập trung

> Executing agent: read this entire file before doing anything.
> Must also read and follow [AGENTS.md](../AGENTS.md) and [docs/security.md](../docs/security.md).

---

## Objective

App chưa có nơi tập trung để xem/đổi cấu hình — theme chỉ toggle mù qua menu, file tree sort không có UI, AI settings nằm sâu trong side panel. Goal này thêm **Settings Dialog** (mở bằng `Ctrl+,`, menubar, command palette) theo mô hình Obsidian/Zed: sidebar category bên trái + content pane bên phải, style editorial đồng bộ app.

---

## Context

- **Reason**: User hỏi "app chưa có Setting Dialog? Muốn cài đặt cấu hình các thứ thì sao?" — cần một cửa duy nhất cho mọi preference, và nền để các setting tương lai (goal sau) có chỗ cắm vào.
- **UI direction đã chốt**: mô hình Zed IDE — menubar + 2 bar + editor; dialog phải cùng ngôn ngữ editorial (border-2, hard shadow, không gradient/border-radius).
- **Executor**: AI Agent (Codex), no human review between steps.
- **Created**: 2026-07-14.
- **Depends on**: GOAL-08 (app settings), GOAL-06 (AI settings). Assumes GOAL-01..18 complete.

---

## Current State

| Item | Value |
|------|-------|
| App settings | [app-settings.ts](../src/main/services/app-settings.ts) — `PersistedAppSettings` version 1: `lastVaultPath`, `theme (light/dark/system)`, `fileTreeSort (name/modified-desc/created-desc)`. File JSON trong `userData`, read không bao giờ throw (corrupt → defaults), có normalize helpers. Tìm IPC hiện có của nó (theme.toggle đang hoạt động → có đường đi sẵn) |
| AI settings | [ai-settings.ts](../src/main/services/ai-settings.ts) — vault-scoped, CÓ SECRETS (API key). UI hiện có: [AiSettingsPanel.tsx](../src/renderer/src/ai/panels/AiSettingsPanel.tsx) render trong [AiSidePanel.tsx](../src/renderer/src/ai/panels/AiSidePanel.tsx) (~dòng 395) |
| Dialog primitives | shadcn có sẵn: `src/renderer/src/components/ui/dialog.tsx`, `alert-dialog.tsx`, `button.tsx`. Dep `radix-ui` đã có |
| Actions | [actions.ts](../src/renderer/src/commands/actions.ts) (`CommandAction`), chạy qua [CommandPalette.tsx](../src/renderer/src/commands/CommandPalette.tsx); [AppMenuBar.tsx](../src/renderer/src/components/AppMenuBar.tsx) gọi `runAction('theme.toggle')` (~dòng 184) — tìm nơi define action map (AppLayout hoặc lân cận) |
| Shortcuts | [useKeyboardShortcuts.ts](../src/renderer/src/hooks/useKeyboardShortcuts.ts) |
| Working tree | Đang có NHIỀU file modified/untracked KHÔNG thuộc goal này (GOAL-16 chưa commit): AppLayout.tsx, AppMenuBar liên quan, AppTopBar, MainEditor, MdxEditor, src/main/*, src/preload/*… — sẽ phải sửa vài file trong số này |

---

## Target State

### 1. Settings Dialog — `src/renderer/src/settings/SettingsDialog.tsx` (+ file con theo section)

- Layout: dialog lớn (~ 720×480 `[ước lượng]`), sidebar trái liệt kê section, content phải; style editorial (border-2 foreground, hard shadow, font mono cho label — theo idiom sẵn có trong app, đối chiếu ComponentInsertPalette/AiSettingsPanel).
- Sections v1:
  1. **General** — Theme: 3 lựa chọn light/dark/system (không chỉ toggle); File tree sort: 3 lựa chọn hiện có; hiển thị vault path hiện tại (read-only) + nút "Open another vault…" tái dùng flow mở vault hiện có.
  2. **Editor** — Font size cho editor (range 12–20, default hiện tại `[ước lượng: đo từ editor-theme]`): setting MỚI, persist + apply live vào CodeMirror (MdxEditor + TextFileEditor).
  3. **AI** — TÁI DÙNG `AiSettingsPanel` render bên trong section này nếu component tách được khỏi side-panel context với thay đổi tối thiểu; nếu coupling sâu → section hiện mô tả + nút "Open AI settings" mở đúng AiSidePanel settings view, và GHI RÕ quyết định trong báo cáo. KHÔNG duplicate form logic, KHÔNG log/echo API key.
  4. **About** — tên app, version (từ package.json qua đường có sẵn hoặc `app.getVersion()` nếu đã expose; không thêm IPC mới chỉ cho version nếu chưa có — hiển thị gì lấy được).
- Mọi thay đổi apply NGAY (không nút Save) và persist qua service — đúng hành vi theme.toggle hiện tại.

### 2. Persistence

- `PersistedAppSettings` version 1 → **2**: thêm `editorFontSize: number`. Migration: đọc v1 → fill default; normalize helper theo pattern sẵn có (clamp 12–20, sai kiểu → default). KHÔNG đổi cách đọc/ghi file, KHÔNG đổi vị trí file.
- Tái dùng IPC app-settings hiện có, chỉ mở rộng payload/schema (zod ở main theo convention vault-ipc). Không tạo kênh trùng chức năng.

### 3. Entry points

- `Ctrl+,` (Cmd+, trên macOS) — thêm vào useKeyboardShortcuts.
- Menubar: item "Settings…" (vị trí menu hợp lý theo cấu trúc menubar hiện tại, kèm shortcut hint).
- Command palette: action `settings.open` label "Open Settings".
- Esc / click ngoài đóng dialog (hành vi Dialog mặc định). Dialog mở KHÔNG làm mất trạng thái editor.

---

## Constraints

- [x] KHÔNG thêm dependency mới (radix-ui/shadcn dialog đã có).
- [x] KHÔNG đụng secrets: AI API key chỉ đi qua đường AiSettingsService hiện có; không đưa key vào app-settings.json, không log.
- [x] KHÔNG phá theme.toggle, file tree sort hiện hành, flow mở vault, AI side panel — regression check từng cái.
- [x] Settings file cũ (v1) của user thật phải đọc được sau upgrade — có unit test migration v1→v2 + corrupt file → defaults.
- [x] Style editorial: không gradient, không border-radius, đồng bộ idiom hiện có.
- [x] Working tree có thay đổi GOAL-16 chưa commit — KHÔNG revert, KHÔNG commit chung. Khi sửa file đang dirty (AppLayout, useKeyboardShortcuts…): giữ nguyên phần sẵn có, chỉ thêm phần của goal, stage theo hunk; không tách hunk an toàn được → commit cả file và GHI RÕ trong báo cáo.
- [x] Nếu gặp blocker: DỪNG và mô tả blocker, KHÔNG tự workaround.

---

## Success Criteria

- [x] `Ctrl+,`, menubar "Settings…", và command palette "Open Settings" đều mở dialog; Esc đóng, editor không mất state/nội dung đang gõ.
- [x] Đổi theme sang từng giá trị light/dark/system trong dialog → UI đổi ngay + persist qua restart (kiểm bằng đọc app-settings.json).
- [x] Đổi file tree sort trong dialog → tree sort lại ngay.
- [x] Đổi editor font size → MdxEditor và TextFileEditor đổi cỡ chữ ngay + persist qua restart.
- [x] Section AI dùng lại được form hiện có (hoặc nút mở AiSidePanel — kèm giải thích); không có key nào xuất hiện trong app-settings.json hay console log.
- [x] Settings v1 file (tạo fixture) đọc lên thành v2 với editorFontSize default; corrupt JSON → defaults, không crash. Unit tests cover: migration, normalize/clamp font size, round-trip write→read.
- [x] Regression: theme.toggle từ menu vẫn hoạt động và đồng bộ với giá trị trong dialog đang mở `[ước lượng: dialog phản ánh giá trị mới nếu đang mở]`.
- [x] `bun test` xanh toàn bộ; `bun run typecheck` pass; `bun run lint` không error mới.

---

## Execution Plan

1. Đọc app-settings.ts + IPC/preload đường settings hiện có, action map, AppMenuBar, useKeyboardShortcuts, AiSettingsPanel/AiSidePanel coupling, dialog.tsx.
2. Main: bump PersistedAppSettings v2 (+editorFontSize, migration, normalize) + unit tests (test đỏ trước) + mở rộng IPC.
3. Renderer: SettingsDialog + sections General/Editor/About; wire state qua preload API; apply-live cho theme/sort/font size.
4. Section AI: đánh giá coupling → embed hoặc nút mở panel (ghi quyết định).
5. Entry points: shortcut Ctrl+, / menubar / command action.
6. Regression check các flow liên quan; chạy test/typecheck/lint.
7. Verify từng Success Criteria, đánh dấu checkbox, commit (conventional commits, stage chọn lọc).

---

## Out of Scope

- Settings dạng JSON editor kiểu Zed (`settings.json` mở trong editor) — cân nhắc goal sau.
- Per-vault settings mới (ngoài AI đã có), sync settings, profiles.
- Hotkey remapping UI, plugin/extension settings.
- Language/i18n switcher.
- Thêm setting mới ngoài danh sách Target State (font family, line height, vim mode…) — nền tảng đã có chỗ cắm, goal sau thêm.
- GOAL-19 (export interactive-note fidelity) — độc lập, không đụng.

---

## Agent Instructions

1. Đọc toàn bộ file này trước khi làm bất kỳ thứ gì.
2. Tuân theo Constraints tuyệt đối — không có ngoại lệ.
3. Thực hiện Execution Plan theo thứ tự, báo cáo ngắn gọn sau mỗi bước.
4. Conflict giữa Constraints và Execution Plan → ưu tiên Constraints.
5. Gặp thứ không có trong GOAL: DỪNG và hỏi, không tự assume.
6. Khi xong: verify từng Success Criteria, đánh dấu checkbox, commit (conventional commits).
