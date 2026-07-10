# PLAN — Border utilities (Note 1/2)

## Scope quyết định
- Nguồn = 8 concept gộp (border-radius, -width, -color, -style, outline-width, -color, -style, -offset).
- Quyết định user: **Tách 2 note + bridge**.
- Session này: **Note 1 = Border utilities** (radius, width, color, style). Note 2 (Outline utilities) + bridge note = session sau.
- Lý do ranh giới: border **ảnh hưởng box model/layout**, outline **không** — đây là ranh giới concept tự nhiên, mỗi nhóm là 1 concept node.

## Concept node của note này
"Mental model thống nhất cho 4 nhóm utility `border-*` trong Tailwind: mỗi utility phân rã theo 3 trục = (property CSS) × (scope: tất cả cạnh / cạnh / góc / logical) × (kiểu giá trị: token | số | arbitrary | CSS var). Cùng một grammar lặp lại cho radius/width/color/style."

## Phân loại block nguồn (chỉ phần border, bỏ phần outline)

| Block nguồn | Nhãn | Ghi chú |
|---|---|---|
| Tóm tắt border-radius | [T] | rút gọn vào primer |
| 1. Lý thuyết radius | [T] | định nghĩa border-radius |
| 2. Cú pháp radius — all sides, side, corner, logical | [T] + [W] | logical property = widget candidate (LTR↔RTL toggle) |
| Mermaid logical property flowchart | [T] → thay bằng widget sống | |
| 3. Cách dùng radius — buttons, RTL, responsive, custom var | [T] + [E] | ví dụ code = evidence |
| Lưu ý `rounded-full` vs `rounded-[50%]` | [T] + [W] | widget candidate (so sánh hai element cùng size) |
| Tổng quan border-width | [T] | |
| Mermaid border-width tree | [T] → tier-2 visual (tree tĩnh) | |
| 1. Lý thuyết width | [T] | |
| 2. Bảng cú pháp width (all/physical/logical/divide) | [T] + tier-2 table | |
| Rule-Based Debugging width | [T] | quan trọng — divide only children, logical phụ thuộc dir |
| 3. Cách dùng width — basic, directional, divide, responsive | [T] + [E] | |
| Warning divide utilities | [T] | |
| Tổng quan border-color | [T] | |
| 1. Lý thuyết color + cascade/specificity | [T] | quan trọng: class sau thắng, override từng cạnh |
| 2. Cú pháp color — basic, opacity, arbitrary, CSS var | [T] | |
| 3. Sử dụng color — theme, từng cạnh, logical, variants, custom, divide | [T] + [E] | |
| Mermaid color taxonomy | [T] → bỏ, trùng nội dung text | |
| border-style — lý thuyết, cú pháp, bảng, dùng thực tế | [T] + tier-2 table | |
| `border-none` vs `border-hidden`? | [T] | note: nguồn không có border-hidden, chỉ có trong outline — cẩn thận không re-teach outline |

Tỉ lệ ước lượng: [T] ~75%, [W] ~2/3 widget, [E] ~4 khối code, [Q] = 3 câu self-test ở Phase 4. Trong ngưỡng 70/10/10/10.

## Widget specs (3)

### W1 — Logical Property Explorer (border-radius)
- **Misconception:** "`rounded-s-lg` luôn bo góc bên trái — vì 's' = 'start' = trái."
- **Người học dự đoán SAI vì:** dịch "start" sang "trái" theo thói quen LTR, không biết 'start' là logical, phụ thuộc `dir`.
- **Pattern:** TOGGLE (LTR / RTL), 2 preview box, class name động hiển thị trên box.
- **Derive tool phía trên gate:** diagram mechanism "logical = ánh xạ theo dir"; bảng logical side (s/e) → physical.
- **Cấm phía trên gate:** đáp án literal "LTR→trái, RTL→phải".

### W2 — `rounded-full` vs `rounded-[50%]` (border-radius)
- **Misconception:** "Hai class này giống nhau — đều ra hình tròn."
- **Người học dự đoán SAI vì:** thấy '50%' nghĩ là 'nửa kích thước' = tròn, không biết `full` dùng `calc(infinity)`.
- **Pattern:** TOGGLE (width = height / width ≠ height), 2 preview cạnh nhau.
- **Derive tool phía trên gate:** 1 dòng mechanism "`rounded-full` = `calc(infinity * 1px)`".
- **Cấm phía trên gate:** literal "full luôn tròn, 50% méo khi w≠h".

### W3 — Divide vs Border (border-width)
- **Misconception:** "`divide-y-2` cũng thêm viền cho chính container."
- **Người học dự đoán SAI vì:** thấy chữ 'border' trong tên kiểu, tưởng divide = viết tắt border.
- **Pattern:** GATE+STEP (commit 1 lần, 2 lựa chọn: "container có viền" / "chỉ giữa các con"), 1 preview box.
- **Derive tool phía trên gate:** selector CSS `& > :not(:last-child)` đặt công khai phía trên.
- **Cấm phía trên gate:** literal "divide không chạm container".

## Tier-2 visuals (tĩnh)
1. **Border utilities grammar** — sơ đồ 3 trục (property × scope × value-type) cho 4 nhóm. Nằm ở primer/section đầu.
2. **Scope axis** — 4 cấp (all / side / corner / logical) cho radius, vs (all / side / logical / divide) cho width/color. Bảng so sánh.
3. **border-width tree** — phiên bản tĩnh của mermaid nguồn (all sides / directional / divide).
4. **border-color specificity** — sơ đồ nhỏ thể hiện override từng cạnh lên all-side.

## Term taxonomy

**Loại 1 (định nghĩa trong note, vào primer + anchor):**
- box model — "mô hình hộp: nội dung → padding → border → margin"
- border (vs outline) — "viền trong box model, ảnh hưởng kích thước"
- border-radius — "độ bo cong góc"
- border-width — "độ dày viền"
- border-color — "màu viền"
- border-style — "kiểu nét viền (solid, dashed, ...)"
- logical property — "thuộc tính logic, phụ thuộc hướng văn bản"
- physical property — "thuộc tính vật lý cố định (top/right/bottom/left)"
- LTR / RTL — "hướng viết trái→phải / phải→trái"
- `dir` attribute — "thuộc tính HTML đặt hướng văn bản"
- arbitrary value — "giá trị tùy chỉnh trong ngoặc vuông `[...]`"
- token (theme value) — "giá trị định nghĩa sẵn trong theme, vd `rounded-lg`"
- opacity modifier — "bộ điều chỉnh độ mờ `/50`"
- cascade / specificity — "quy tắc CSS: cùng specificity thì class khai báo sau thắng"
- divide utility — "thêm viền giữa các phần tử con, không phải viền container"
- start / end (logical side) — "đầu / cuối theo hướng văn bản"

**Loại 2 (prerequisite frontmatter → link, CẢM re-teach):**
- Tailwind utility class — link tới note Tailwind cơ bản
- JIT engine — link
- CSS Custom Property / CSS variable — link
- responsive breakpoint (`md:`, `lg:`) — link
- state variant (`hover:`, `focus:`) — link
- box model chi tiết (margin/padding/content) — link

**Loại 3 (BUG — phải xoá):**
- Không có. Mọi thuật ngữ trong widget/visual đều đã Loại 1.

**Kiểm tra spoiler:** "start", "full = infinity", "divide selector" đều đã Loại 1 + có mechanism phía trên gate. Pass.

## Output file
`interactive-notes-out/border-utilities/border-utilities.html`
