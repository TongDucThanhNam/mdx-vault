# GOAL-04 — Built-in interactive islands

> Agent thực thi: đọc file này + `AGENTS.md` + `docs/product-vision.md` (mục tiêu chuẩn chất lượng interactive) trước. Giả định GOAL-03 đã hoàn thành (registry + props validation).

## Objective

Xây bộ template components đầu tiên trong registry (Level 2 trusted) — QuizBlock, EquationSlider, DataChart, AlgorithmVisualizer — cùng cơ chế chèn nhanh từ editor (slash command hoặc command palette). Đây là bộ mặt "interactive islands" của sản phẩm.

## Context

- **Lý do**: Template chuẩn chất lượng cao > AI generate từ số 0. AI (GOAL-06) sẽ chọn template + điền props thay vì viết arbitrary code.
- **Ưu tiên**: chất lượng sư phạm/UX của từng component > số lượng component.
- **Ngày tạo**: 2026-07-03

## Current State

| Item             | Giá trị                                                                               |
| ---------------- | ------------------------------------------------------------------------------------- |
| Registry         | Có structure + props validation (GOAL-03), chỉ chứa demo components                   |
| Chart lib        | **recharts@3.9.1 đã cài** (quyết định của user) — dùng nó cho DataChart + đồ thị mini |
| Editor insertion | Chưa có — user phải gõ JSX bằng tay                                                   |

## Target State

Bốn components trong registry, mỗi cái có propsSchema (zod), defaultProps, description:

| Component                 | Props chính                                                                                                                                                                            | Hành vi                                                                                       |
| ------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------- |
| `<QuizBlock />`           | `question`, `options[]`, `answerIndex`, `explanation?`                                                                                                                                 | Chọn đáp án → phản hồi ngay + giải thích. Multi-question: nhiều QuizBlock.                    |
| `<EquationSlider />`      | `formula` (chuỗi hiển thị), `variables{name: {min,max,default,step}}`, `compute?` [cần xác nhận: expression string được eval an toàn bằng parser đơn giản tự viết — KHÔNG dùng eval()] | Slider cho từng biến → giá trị kết quả + đồ thị mini cập nhật real-time                       |
| `<DataChart />`           | `type` (line/bar/scatter), `data` (inline array) hoặc `src` (path tới csv/json trong assets), `x`, `y`, `title?`                                                                       | Render chart; `src` đọc qua IPC (main process đọc file, island không tự đọc fs)               |
| `<AlgorithmVisualizer />` | `algorithm` ("binary-search" \| "bubble-sort" [ước lượng — tối thiểu 2]), `data[]`, `target?`, `speed?`                                                                                | Step-by-step animation với play/pause/step, highlight pointers, mô tả bước hiện tại bằng text |

Chèn từ editor: command palette (Ctrl+K) hoặc `/` đầu dòng → chọn component → insert JSX snippet với defaultProps vào vị trí cursor.

Mỗi component tuân tiêu chuẩn docs/product-vision.md: thao tác biến quan trọng, phản hồi tức thì, guidance, trạng thái ban đầu hợp lý.

## Constraints

- [x] Mọi component đăng ký qua registry của GOAL-03 — không hardcode vào components map
- [x] KHÔNG dùng `eval()`/`new Function()` cho expression của EquationSlider — viết parser số học nhỏ (+-*/^, ngoặc, biến) hoặc bảng công thức có sẵn
- [x] `DataChart src` chỉ đọc trong vault qua safeJoin IPC; file ngoài vault → lỗi rõ ràng
- [x] Chart lib: dùng **recharts** (đã cài sẵn, user đã chốt) cho DataChart và đồ thị mini của EquationSlider — KHÔNG tự vẽ SVG, KHÔNG cài thêm chart lib khác
- [x] Component phải render tốt trong khổ preview ~800px, responsive khi pane hẹp
- [x] KHÔNG đụng sandbox/manifest/AI
- [x] Blocker → DỪNG và hỏi

## Success Criteria

- [x] `bun run typecheck` && `bun run lint` pass
- [x] example-vault có note demo cho TỪNG component, render và tương tác được
- [x] QuizBlock: chọn sai → feedback + explanation; chọn đúng → xác nhận
- [x] EquationSlider: kéo slider → kết quả + đồ thị cập nhật không giật (không re-compile MDX khi kéo)
- [x] DataChart đọc được `example-vault/assets/datasets/*.csv` và render; file không tồn tại → error card thân thiện
- [x] AlgorithmVisualizer binary-search: play/pause/step hoạt động, pointer low/mid/high hiển thị đúng từng bước
- [x] Ctrl+K → chọn QuizBlock → JSX snippet hợp lệ chèn tại cursor, preview render ngay
- [x] Props sai → warning card của GOAL-03 (regression check)

## Execution Plan

1. Quyết định + setup chart approach (SVG tự vẽ vs lib) — báo cáo quyết định trước khi code tiếp
2. QuizBlock (đơn giản nhất, khẳng định registry pattern)
3. EquationSlider + expression parser nhỏ (có test thuần cho parser)
4. DataChart + IPC đọc dataset
5. AlgorithmVisualizer (binary-search trước, bubble-sort sau)
6. Insertion UX (command palette + slash)
7. Notes demo trong example-vault cho từng component
8. Verify Success Criteria, báo cáo từng item

## Out of Scope

- DistributionPlayground, TimelineSimulator, ConceptMap, SocraticTutor, CanvasSimulation (đợt sau)
- Component inspector UI (chỉnh props qua form) — goal tương lai
- Sandbox cho custom components (GOAL-05)

## References

- `docs/product-vision.md` — tiêu chuẩn chất lượng interactive block
- `docs/mdx-conventions.md` — cách component xuất hiện trong note
- Tham khảo UX: seeing-theory.brown.edu, visualgo.net

## Agent Instructions

1. Đọc toàn bộ file này + AGENTS.md trước khi làm
2. Tuân theo Constraints tuyệt đối
3. Execution Plan theo thứ tự, báo cáo sau mỗi bước (đặc biệt bước 1 — chờ không cần, nhưng ghi rõ quyết định + lý do)
4. Conflict → ưu tiên Constraints
5. Thứ ngoài GOAL → DỪNG và hỏi
6. Khi xong: verify từng Success Criteria
