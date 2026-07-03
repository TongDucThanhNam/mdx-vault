# GOAL-03 — Component registry + Safe HTML policy

> Agent thực thi: đọc file này + `AGENTS.md` + `docs/security.md` (Trust levels) trước. Giả định GOAL-01, 02 đã hoàn thành.

## Objective

Chính thức hóa tầng render theo trust model: component registry có cấu trúc (Level 2) với props validation, safe HTML sanitize policy (Level 1), và error handling hoàn chỉnh — unknown component placeholder, error overlay chỉ rõ dòng lỗi, frontmatter hiển thị đẹp.

## Context

- **Lý do**: GOAL-01 render MDX "tin tất cả". Trước khi thêm nhiều island (GOAL-04) và code AI-generated (GOAL-05/06), tầng render phải phân biệt được trusted/untrusted và fail gracefully.
- **Ưu tiên**: correctness > speed.
- **Ngày tạo**: 2026-07-03

## Current State

| Item              | Giá trị                                                            |
| ----------------- | ------------------------------------------------------------------ |
| Preview           | `evaluate()` + `components` map ad-hoc (`mdx-components.tsx` demo) |
| Sanitize          | rehype-sanitize đã cài nhưng [ước lượng] chưa wire vào pipeline    |
| Lỗi compile       | Hiện text lỗi thô trong preview pane                               |
| Unknown component | [ước lượng] crash hoặc lỗi khó hiểu từ MDX runtime                 |

## Target State

| Item                | Giá trị                                                                                                                                                                                                                     |
| ------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Registry            | `src/renderer/src/preview/registry/`: mỗi entry = { name, component, propsSchema (zod), description, category, defaultProps }. Registry là nguồn duy nhất cho `components` map.                                             |
| Props validation    | Props từ MDX được validate bằng zod trước khi render; fail → render inline warning card (tên component + lỗi field), không crash                                                                                            |
| Safe HTML (Level 1) | rehype-sanitize với schema tùy chỉnh: cho phép details/summary, table, svg subset an toàn; strip script/iframe/inline event handler/`javascript:` URL. Áp dụng cho vùng HTML thuần trong MDX.                               |
| Unknown component   | `<ThửNghiệm />` không có trong registry → placeholder card "Unknown component: ThửNghiệm" thay vì crash                                                                                                                     |
| Error overlay       | Lỗi MDX compile → hiện panel lỗi có message + line/column (từ VFileMessage), editor nhảy đến dòng lỗi khi click [ước lượng — nếu CodeMirror API cho phép không quá phức tạp]                                                |
| Frontmatter         | Không render như text; hiện thành properties block trên đầu preview (giống Obsidian)                                                                                                                                        |
| Import statements   | `import` trong note → cảnh báo trong preview ("code trong note không được khuyến khích — dùng registry hoặc interactives/") theo docs/mdx-conventions.md [cần xác nhận: chặn hẳn hay chỉ cảnh báo — mặc định: chỉ cảnh báo] |

## Constraints

- [x] KHÔNG phá API `components` map — MDX element viết hoa vẫn resolve qua registry
- [x] Sanitize schema phải là allowlist (mở rộng dần), không phải blocklist
- [x] SVG: cho phép hình khối cơ bản; strip `<script>`, `<foreignObject>`, event handlers
- [x] KHÔNG implement sandbox iframe/`<Interactive src>` — GOAL-05
- [x] KHÔNG thêm built-in component mới ngoài demo hiện có — GOAL-04
- [x] KHÔNG thêm dependency mới
- [x] Blocker → DỪNG và hỏi

## Success Criteria

- [x] `bun run typecheck` && `bun run lint` pass
- [x] Note chứa `<script>alert(1)</script>` và `<div onclick="...">` → render bị strip, không execute
- [x] Note chứa `<details>/<summary>`, table, SVG circle → render đúng
- [x] `<Counter initial="abc" />` (sai type) → warning card, app sống
- [x] `<KhongTonTai />` → placeholder card, app sống
- [x] MDX syntax lỗi → error panel có line number; sửa xong preview tự phục hồi
- [x] Frontmatter hiện thành properties block, không lộ YAML thô
- [x] Registry entry mới chỉ cần thêm 1 file + 1 dòng đăng ký (kiểm bằng đọc code — chuẩn bị cho GOAL-04)

## Execution Plan

1. Thiết kế registry type + refactor `mdx-components.tsx` demo vào registry structure
2. Wrapper HOC validate props bằng zod → warning card khi fail
3. Unknown component fallback (proxy trong components map)
4. Sanitize policy: custom schema cho rehype-sanitize, wire vào pipeline render (chỉ vùng HTML, không đụng JSX component đã trust)
5. Error overlay + frontmatter properties block
6. Cảnh báo import-in-note
7. Cập nhật example-vault: thêm note minh họa các case (safe HTML, sai props, unknown component)
8. Verify Success Criteria, báo cáo từng item

## Out of Scope

- Sandbox iframe, manifest, vault components (GOAL-05)
- Bộ template components (GOAL-04)
- Theme/dark mode cho preview

## References

- `docs/security.md` — Trust levels 0–2 là phạm vi goal này
- `docs/mdx-conventions.md` — separation of prose and behavior
- rehype-sanitize schema: https://github.com/rehypejs/rehype-sanitize

## Agent Instructions

1. Đọc toàn bộ file này + AGENTS.md + docs/security.md trước khi làm
2. Tuân theo Constraints tuyệt đối
3. Execution Plan theo thứ tự, báo cáo sau mỗi bước
4. Conflict → ưu tiên Constraints
5. Thứ ngoài GOAL → DỪNG và hỏi
6. Khi xong: verify từng Success Criteria
