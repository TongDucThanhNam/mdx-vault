# GOAL-15 — Transactional Rename and Reference Rewrite

> File created by the create-goal skill.
> Executing agent: read this entire file before doing anything.
> Must also read and follow [AGENTS.md](../AGENTS.md), [docs/security.md](../docs/security.md), and the F-01 finding in [docs/research/obsidian-interaction-behaviors-2026-07.md](../docs/research/obsidian-interaction-behaviors-2026-07.md).

---

## Objective

Make renaming (or moving) a note a single transactional operation that also rewrites every wikilink and Markdown link in the vault that resolves to that note — preserving display aliases (`[[target|alias]]` keeps `alias`), leaving plain-text mentions and code blocks untouched, and guaranteeing zero stale targets and zero partial writes. Acceptance is the F-01 five-link fixture passing as an automated test.

---

## Context

- **Reason**: Verified data-integrity defect F-01 (CONFLICT, bundle B1, priority P0 in the interaction audit): `VaultService.renameFile()` ([vault-service.ts:176-196](../src/main/services/vault-service.ts)) renames the file and the IPC handler reindexes it ([vault-ipc.ts:175-185](../src/main/ipc/vault-ipc.ts)), but no incoming reference is ever rewritten. The rename succeeds visually while silently breaking navigation across the vault. Obsidian's behavior (verified live in GOAL-14): prompt or auto-rewrite all targets, preserve alias display text, leave plain mentions unchanged.
- **Priority**: correctness > speed. This is the rollback/atomicity boundary for all future reference-producing features (explorer move, paste/drop link generation — Draft Objectives 2 and 3).
- **Executor**: AI Agent (Codex), no human review between steps.
- **Created**: 2026-07-10.
- **Depends on**: GOAL-12 (index/backlinks plumbing). Assumes GOAL-01..12 complete.

---

## Current State

| Item | Value |
|------|-------|
| Runtime | Electron 39 + React 19 + TypeScript, main/preload/renderer split, package manager **bun** |
| Rename flow | `FileTree.tsx` inline rename input → `vault:rename-file` IPC → `VaultService.renameFile()` (path-safe, atomic `rename()`, rejects overwrite) → `index.deleteFile(old)` + `index.indexFile(new)` |
| Link data | SQLite `note_links(source_note_id, target, target_normalized, display, position)` with index `idx_note_links_target_normalized` ([db-service.ts:448-475](../src/main/services/db-service.ts)) — enumerating candidate source notes is a single indexed query |
| Link resolution | [src/shared/wikilinks.ts](../src/shared/wikilinks.ts): a link target resolves by `normalizeLinkKey` (case-insensitive, NFKC, extension-stripped) matching any of: note title, filename stem, full relative path, frontmatter aliases. `resolveWikilinkTarget` returns the **first** matching note |
| Wikilink parsing | `src/shared/remark-wikilink.ts` remark plugin — the same parser the indexer uses; it already skips code fences/inline code by construction (mdast) |
| Atomic write pattern | temp-file + `rename()` already used by `VaultService` for note writes |
| Autosave | Renderer autosaves the open note with a 1 s debounce (`App.tsx`) — a rewrite can race an open dirty buffer |
| Tests | No test runner configured (`package.json` has only lint/typecheck/build). `bun test` works out of the box for `*.test.ts` — no new dependency needed |

---

## Target State

1. **A pure, unit-testable planner** (new module, suggested `src/main/services/rename-plan.ts` with pure logic importable without Electron):
   - Input: old relative path, new relative path, and the parsed link inventory of the vault (from index + re-parse of candidate files at plan time — the index is a candidate filter, **not** the source of truth).
   - Output: a `RenamePlan` — per affected file: list of edits `{offset/position, oldTarget, newTarget}` + summary counts. Empty plan when nothing resolves to the note.
   - Rewrite rules:
     - Only rewrite links whose target currently **resolves to the renamed note** via `resolveWikilinkTarget` semantics against the full note list (a link matching another note with the same stem must NOT be rewritten).
     - Preserve link form: a stem-form link (`[[Target Note]]`) gets the new stem; a path-form link (`[[folder/Target Note]]`) gets the new path; a Markdown link (`[text](Target%20Note.mdx)` / relative path) gets the rewritten path with the same encoding style `[cần xác nhận: encoding round-trip]`.
     - `[[target|alias]]` → only the target segment changes; display alias byte-identical.
     - Plain-text mentions, code fences, inline code: untouched (guaranteed by operating on the remark AST positions, never string-replace).
     - Move to another folder with unchanged stem: stem-form links need **no** rewrite; path-form links do.
     - Self-links inside the renamed note are rewritten too.
2. **Transactional apply** in `VaultService` (main process):
   - Order: snapshot original contents of all affected files → apply all rewrites via the existing temp+rename atomic write → rename the note file last → reindex all touched files.
   - On any failure mid-sequence: restore every already-written file from its snapshot and abort the rename; the vault must end byte-identical to the pre-call state. No partial state may survive.
3. **IPC + UI**:
   - New `vault:plan-rename` (read-only preview) and extend `vault:rename-file` to accept `{ updateLinks: boolean }`.
   - `FileTree` rename commit: if the plan is non-empty, show the existing `ConfirmDialog` pattern — "Update N links in M notes?" with **Update links** / **Don't update** / cancel (mirrors Obsidian's prompt mode; no settings toggle yet — that belongs to the future link-policy goal).
   - If the active note in the editor is among the rewritten files, the renderer must reload it (and must not let the 1 s autosave of a stale buffer clobber the rewrite — flush or cancel pending autosave before applying `[cần xác nhận: cleanest hook in App.tsx]`).

---

## Constraints

- [x] KHÔNG thay đổi link-resolution semantics trong `src/shared/wikilinks.ts` (planner consumes, không sửa) — mọi thay đổi resolution là scope creep.
- [x] KHÔNG string-replace trên raw content — mọi edit phải đến từ vị trí AST của cùng parser mà indexer dùng (`remark-wikilink`).
- [x] KHÔNG đụng file không nằm trong plan; file được rewrite chỉ thay đổi đúng các byte của link target (không reformat, không đổi EOL, không trim).
- [x] KHÔNG thêm dependency mới (bun test là built-in; nếu thật sự cần dev-dep, DỪNG và hỏi).
- [x] KHÔNG thay đổi behavior của delete/duplicate/create, export, AI, sandbox.
- [x] Mọi path qua `safeJoin`/normalize như hiện tại; không nới lỏng kiểm tra path traversal.
- [x] Rollback là bắt buộc: nếu không thể đảm bảo khôi phục nguyên trạng khi lỗi giữa chừng, DỪNG và mô tả blocker.
- [x] Nếu gặp blocker hoặc thứ không có trong goal: DỪNG và hỏi, không tự assume.

---

## Success Criteria

- [x] **F-01 fixture test pass** (bun test, checked in): vault fixture với `Target Note.mdx` + 2 note nguồn chứa đủ 5 link dạng khác nhau — `[[Target Note]]`, `[[Target Note|Custom Alias]]`, `[[folder path form]]`, Markdown link tới `.mdx`, và 1 link nằm trong code fence (control — KHÔNG được rewrite) — cộng 1 plain-text mention (control). Sau rename: zero stale targets, alias giữ nguyên, 2 controls không đổi.
- [x] Test: rename khi có note khác trùng stem → link của note kia không bị rewrite.
- [x] Test: move sang folder khác (stem giữ nguyên) → stem-links không đổi, path-links được rewrite.
- [x] Test: apply fail giữa chừng (inject lỗi write ở file thứ 2) → mọi file khôi phục byte-identical, file chưa bị rename.
- [x] E2E thủ công trong `bun run dev`: rename từ FileTree hiện prompt "Update N links…", chọn Update → mở note nguồn thấy link mới, backlinks panel đúng; chọn Don't update → behavior cũ.
- [x] `bun run typecheck` pass; `bun run lint` không thêm error mới (6.659 warning CRLF/Prettier có sẵn — không cần sửa).
- [x] Note đang mở trong editor nếu bị rewrite thì buffer được reload, không mất chữ user đang gõ ở note khác.

---

## Execution Plan

1. Thêm script `"test": "bun test"` vào package.json; tạo fixture F-01 dưới dạng test tạm để lock hành vi hiện tại (fail đỏ trước khi implement).
2. Implement planner thuần (`rename-plan.ts`): enumerate candidates bằng query `note_links.target_normalized IN (old link keys)`, re-parse từng candidate bằng remark-wikilink, áp rewrite rules → `RenamePlan`. Unit tests xanh cho mọi rule ở Target State 1.
3. Implement transactional apply trong `VaultService` (snapshot → rewrite → rename → reindex; rollback path có test riêng với injected failure).
4. Wire IPC `vault:plan-rename` + `vault:rename-file {updateLinks}`; update preload types.
5. UI: ConfirmDialog trong flow rename của FileTree + reload/autosave-guard cho note đang mở.
6. Verify toàn bộ Success Criteria, chạy typecheck + lint + test, báo cáo từng item.

---

## Out of Scope

- Settings toggle "Automatically update internal links" (auto vs prompt) — goal link-policy sau; hiện tại luôn prompt.
- Link format policy (shortest/relative/absolute, wikilink vs Markdown khi **sinh** link mới) — Draft Objective B1 phần còn lại.
- Embeds `![[...]]` (app chưa hỗ trợ), unlinked mentions, rename folder (folder chưa có context menu — Draft 3), rename heading/block.
- Sửa 6.659 lint warnings có sẵn.

---

## References

- [docs/research/obsidian-interaction-behaviors-2026-07.md](../docs/research/obsidian-interaction-behaviors-2026-07.md) — F-01 (dòng ~396), CTX-016, M-RENAME, Draft Objective 1.
- [docs/research/obsidian-core-plugins-parity-2026-07.md](../docs/research/obsidian-core-plugins-parity-2026-07.md) — Section 4.3.
- Code đọc trước: `src/shared/wikilinks.ts`, `src/shared/remark-wikilink.ts`, `src/main/services/vault-service.ts`, `src/main/services/db-service.ts` (note_links), `src/main/ipc/vault-ipc.ts`, `src/renderer/src/explorer/FileTree.tsx` (rename input), `src/renderer/src/App.tsx` (autosave debounce).
- Obsidian reference behavior: help page `Linking notes and files/Internal links` + GOAL-14 live observation "Rename link integrity".

---

## Agent Instructions

1. Đọc toàn bộ file này trước khi làm bất kỳ thứ gì.
2. Tuân theo Constraints tuyệt đối — không có ngoại lệ.
3. Thực hiện Execution Plan theo thứ tự, báo cáo ngắn gọn sau mỗi bước.
4. Conflict giữa Constraints và Execution Plan → ưu tiên Constraints.
5. Gặp thứ không có trong GOAL: DỪNG và hỏi, không tự assume.
6. Khi xong: verify từng Success Criteria, đánh dấu checkbox, commit.
