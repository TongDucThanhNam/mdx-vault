# GOAL-07 — Export & Share

> Agent thực thi: đọc file này + `AGENTS.md` trước. Giả định GOAL-04, 05 đã hoàn thành. Goal này làm cho note interactive share được ra ngoài app.

## Objective

Export một note thành (a) static HTML — prose + fallback tĩnh cho islands, và (b) interactive HTML bundle — single file tự chứa, islands hoạt động trong browser thường, giữ nguyên sandbox model cho untrusted code.

## Context

- **Lý do**: "Một Seeing Theory cá nhân hóa mà chỉ nằm trong app thì kém viral." Note phải share được — đây là kênh distribution chính của sản phẩm.
- **Ưu tiên**: file export mở được ở mọi browser hiện đại, không cần server.
- **Ngày tạo**: 2026-07-03

## Current State

| Item            | Giá trị                                                                   |
| --------------- | ------------------------------------------------------------------------- |
| Render pipeline | Hoàn chỉnh trong app (Level 0–4)                                          |
| Export          | Chưa có gì                                                                |
| Fallback        | manifest có field `fallback` (ảnh) nhưng [ước lượng] chưa được dùng ở đâu |

## Target State

| Item                    | Giá trị                                                                                                                                                                                                                                                                                                                  |
| ----------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Command "Export note…"  | Trong command palette + menu; chọn mode Static / Interactive; save dialog                                                                                                                                                                                                                                                |
| Static HTML             | Prose render sẵn thành HTML + CSS inline (typography tối thiểu, tự chứa); trusted islands → render static snapshot nếu khả thi [ước lượng: render-to-string với default props] hoặc fallback image/text; sandboxed islands → fallback từ manifest, thiếu fallback → placeholder "interactive content, open in mdx-vault" |
| Interactive HTML bundle | Single .html tự chứa: prose + JS bundle của trusted islands (esbuild, tree-shaken theo components dùng thật) + sandboxed islands giữ nguyên iframe sandbox (srcdoc) trong file export. Assets (ảnh/dataset) inline base64 [ước lượng: cắt ở ~5MB tổng, quá thì cảnh báo]                                                 |
| Wikilinks trong export  | Đích có trong export → anchor; không có → plain text kèm tooltip title                                                                                                                                                                                                                                                   |
| An toàn                 | File export KHÔNG chứa: absolute paths của máy user, API keys, nội dung note khác không được chọn                                                                                                                                                                                                                        |
| Xác minh                | File export mở bằng Chrome/Edge hoạt động không cần server (file://)                                                                                                                                                                                                                                                     |

## Constraints

- [ ] Sandbox model không được nới lỏng khi export: untrusted code trong file export vẫn nằm trong iframe sandbox, không chạy trực tiếp trong document chính
- [ ] Export chạy ở main process (đọc file, bundle); renderer chỉ trigger + nhận progress
- [ ] KHÔNG thêm dependency lớn cho export; ưu tiên esbuild + template string
- [ ] KHÔNG làm: export cả vault thành site, publish/hosting, PDF — ngoài scope
- [ ] Kiểm tra leak: grep output file không chứa `C:\Users` hay vault path
- [ ] Blocker → DỪNG và hỏi

## Success Criteria

- [ ] `bun run typecheck` && `bun run lint` pass
- [ ] Export static một note demo GOAL-04 → mở bằng browser: đọc được toàn bộ prose, islands có fallback/snapshot hợp lý
- [ ] Export interactive note có QuizBlock + EquationSlider → mở file:// trong Chrome: cả hai tương tác được
- [ ] Note có sandboxed island → file export chứa iframe sandbox, island chạy, `window.parent.document` từ island vẫn throw
- [ ] Ảnh trong note hiển thị trong file export (inline)
- [ ] Grep file export: không có absolute path máy local, không có chuỗi API key
- [ ] Export một note KHÔNG kéo theo nội dung note khác (trừ khi được link và user không chọn → chỉ là text)

## Execution Plan

1. Export service skeleton (main process) + IPC + save dialog + menu/palette entry
2. Static HTML: render prose + CSS tự chứa
3. Fallback strategy cho islands trong static mode
4. Interactive bundle: esbuild bundle trusted islands theo usage, hydrate trong file export
5. Sandboxed islands trong export (srcdoc iframe)
6. Asset inlining + size guard
7. Leak check tự động (hàm scan output trước khi ghi)
8. Verify Success Criteria trên Chrome/Edge, báo cáo từng item

## Out of Scope

- Publish vault thành static site / hosting / share link
- PDF export
- Export nhiều note một lúc / cả folder
- Non-Chromium browser support chính thức [ước lượng: hoạt động nhưng không cam kết]

## References

- `docs/security.md` — sandbox model phải giữ nguyên trong export
- `docs/mdx-conventions.md` — fallback field trong manifest
- esbuild bundle API: https://esbuild.github.io/api/

## Agent Instructions

1. Đọc file này + AGENTS.md + docs/security.md trước
2. Tuân theo Constraints tuyệt đối; conflict → ưu tiên Constraints
3. Execution Plan theo thứ tự, báo cáo sau mỗi bước
4. Thứ ngoài GOAL → DỪNG và hỏi
5. Khi xong: verify từng Success Criteria
