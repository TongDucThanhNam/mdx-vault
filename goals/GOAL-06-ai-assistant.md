# GOAL-06 — AI assistant (invoked, not default)

> Agent thực thi: đọc file này + `AGENTS.md` + `docs/product-vision.md` (Vai trò của AI) + `docs/architecture.md` (AI layer) trước. Giả định GOAL-04 và GOAL-05 đã hoàn thành. TanStack AI là beta — TRA DOCS QUA MCP context7 TRƯỚC KHI VIẾT CODE.

## Objective

Tích hợp AI assistant theo đúng triết lý sản phẩm: user bôi đen text / gọi command → AI đề xuất **patch (diff)** → compile/validate → user approve → mới ghi vào vault. AI dùng TanStack AI, bọc sau interface `AssistantRuntime`, ưu tiên chọn template registry (GOAL-04) và sinh vault component vào sandbox (GOAL-05) khi cần custom.

## Context

- **Lý do**: Đây là điểm khác biệt của sản phẩm — nhưng AI là trợ lý được gọi, KHÔNG phải tác giả mặc định. Mọi thiết kế UX phải giữ user là người quyết định cuối.
- **Ưu tiên**: đúng triết lý (diff-approval, không tự ghi) > số lượng action.
- **Ngày tạo**: 2026-07-03

## Current State

| Item                     | Giá trị                                                                                                          |
| ------------------------ | ---------------------------------------------------------------------------------------------------------------- |
| Deps                     | `@tanstack/ai@0.39`, `@tanstack/ai-react@0.16` đã cài — CHƯA có code nào dùng                                    |
| Provider                 | Chưa chọn. [cần xác nhận với user: Anthropic / OpenAI / local — thiết kế provider-agnostic, đọc key từ settings] |
| Nền tảng sẵn có          | Registry + props schema (GOAL-04), sandbox + manifest + compile pipeline (GOAL-05), index (GOAL-02)              |
| Settings/API key storage | Chưa có — goal này tạo (lưu bằng `safeStorage` của Electron, KHÔNG plaintext)                                    |

## Target State

| Item                         | Giá trị                                                                                                                                                                                                        |
| ---------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `AssistantRuntime` interface | `src/renderer/src/ai/runtime.ts` (hoặc shared): streamChat, runToolCall, generatePatch — TanStack AI chỉ được import trong MỘT module adapter                                                                  |
| AI side panel                | Panel phải: chat streaming, hiển thị context đang dùng (note/selection hiện tại)                                                                                                                               |
| Selected-text actions        | Context menu / palette trên selection: Make interactive, Generate figure, Create quiz, Refactor this MDX, Fix this component, Explain                                                                          |
| Patch flow                   | Mọi action sửa nội dung trả về diff (unified hoặc before/after per-hunk) → diff view (thêm/xóa highlight) → Approve/Reject → approve mới ghi file qua IPC hiện có                                              |
| Template-first               | "Make interactive"/"Create quiz" → prompt hướng AI chọn component registry + điền props (kèm props schema trong system prompt); chỉ sinh vault component (interactives/ + manifest) khi template không đáp ứng |
| Compile-repair loop          | Patch chứa component mới → chạy compile pipeline GOAL-05 → lỗi → gửi diagnostics lại cho AI tự repair, tối đa [ước lượng] 3 vòng → vẫn lỗi thì báo user                                                        |
| AI tool boundary             | Tools chạy ở main process qua permission manager: read_note (note hiện tại + note được link), search_index, compile_component. KHÔNG có tool write_file — ghi chỉ xảy ra qua approve flow                      |
| Settings UI                  | Chọn provider, nhập API key (safeStorage), chọn model                                                                                                                                                          |

## Constraints

- [ ] AI KHÔNG BAO GIỜ ghi file trực tiếp — không tồn tại code path nào từ AI response → write mà không qua user approve
- [ ] TanStack AI import duy nhất trong adapter module; phần còn lại của app chỉ biết `AssistantRuntime`
- [ ] API key: Electron `safeStorage`, không log, không đưa vào renderer dạng plaintext ngoài lúc nhập
- [ ] Component AI sinh ra: LUÔN là vault component có manifest chạy sandbox (Level 3/4) — không bao giờ inject vào registry trusted
- [ ] System prompt cho generation phải nhúng: tiêu chuẩn interactive của docs/product-vision.md + convention docs/mdx-conventions.md + dependency allowlist
- [ ] Lưu provenance khi sinh component (prompt/context) vào README.md của interactive đó
- [ ] KHÔNG build UX "nhập topic → AI viết cả note" — kể cả như option
- [ ] Không có API key → app hoạt động bình thường, AI panel hiện hướng dẫn setup (AI là optional)
- [ ] Blocker (đặc biệt API TanStack AI đổi so với goal này) → DỪNG, tra context7, báo cáo khác biệt

## Success Criteria

- [ ] `bun run typecheck` && `bun run lint` pass
- [ ] Không có API key: app chạy bình thường, không lỗi console spam
- [ ] Có API key: chat streaming trong side panel hoạt động
- [ ] Bôi đen đoạn văn về xác suất → "Create quiz" → AI đề xuất diff chèn `<QuizBlock>` props hợp lệ → diff view → Approve → file thay đổi đúng vị trí, preview render quiz; Reject → file không đổi
- [ ] "Make interactive" trên đoạn text mà template không đủ → AI sinh `interactives/<name>/` (component.tsx + manifest.json + README có provenance) → compile pass hoặc repair loop chạy → sau approve, note có `<Interactive src>` render trong sandbox với permission dialog GOAL-05
- [ ] Cố tình làm AI sinh code lỗi (hoặc mock lỗi compile) → repair loop tối đa N vòng rồi báo user, không treo
- [ ] grep codebase: không có call path ghi file từ AI mà thiếu approve (review thủ công, nêu bằng chứng)

## Execution Plan

1. Tra docs TanStack AI hiện hành qua MCP context7 — báo cáo API surface thật so với giả định trong goal
2. `AssistantRuntime` interface + TanStack AI adapter + provider config
3. Settings UI + safeStorage cho API key
4. AI side panel: chat streaming (chưa có actions)
5. Context builder: note hiện tại, selection, backlinks (qua index IPC)
6. Patch format + diff view UI + approve/reject flow
7. Selected-text actions với template-first prompting
8. Component generation path: sinh interactives/ + manifest + provenance → compile-repair loop (tích hợp pipeline GOAL-05)
9. Verify Success Criteria, báo cáo từng item

## Out of Scope

- Multi-provider switching UI phức tạp (một provider hoạt động là đủ, kiến trúc mở)
- Agentic multi-step edits toàn vault, "AI viết cả note"
- Embedding/semantic search, RAG
- Component inspector (chỉnh props bằng form)

## References

- `docs/product-vision.md` — Vai trò của AI, anti-goals
- `docs/architecture.md` — AssistantRuntime, AI tool boundary
- `docs/security.md` — AI-generated code rules
- TanStack AI: https://tanstack.com/ai/latest (beta — verify bằng context7)
- Electron safeStorage: https://www.electronjs.org/docs/latest/api/safe-storage

## Agent Instructions

1. Đọc file này + AGENTS.md + docs/product-vision.md + docs/security.md trước
2. Bước 1 của Execution Plan là BẮT BUỘC — TanStack AI beta, đừng code theo trí nhớ
3. Tuân theo Constraints tuyệt đối; conflict → ưu tiên Constraints
4. Báo cáo sau mỗi bước
5. Thứ ngoài GOAL → DỪNG và hỏi
6. Khi xong: verify từng Success Criteria
