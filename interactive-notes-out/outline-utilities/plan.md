# PLAN — Outline utilities (Note 2/2)

## Scope quyết định
- Nguồn = phần outline (4 nhóm: outline-width, -color, -style, -offset) của file gốc.
- 4 nhóm này = 1 concept node duy nhất ("outline là viền ngoài không ăn layout, 4 property mô tả nó"). KHÔNG tách tiếp — không có ranh giới concept tự nhiên bên trong.
- Concept node: "Outline là đường viền vẽ *bên ngoài* border, KHÔNG thuộc box model, KHÔNG ăn layout. Bốn property (width/color/style/offset) mô tả nó. Tailwind ánh xạ từng cái qua cùng grammar `outline-*`."

## Phân loại block nguồn (chỉ phần outline)

| Block nguồn | Nhãn | Ghi chú |
|---|---|---|
| Tóm tắt outline-width | [T] | |
| 1. Lý thuyết width (outline vs border, không ăn layout) | [T] | quan trọng — đặc điểm định nghĩa |
| 2. Cú pháp width (default/number/arbitrary/CSS var) | [T] + tier-2 table | |
| Mermaid width decision tree | [T] → tier-2 visual tĩnh | |
| 3. Dùng width — focus state, arbitrary, CSS var, responsive | [T] + [E] | focus state là use case chính |
| Tóm tắt outline-color | [T] | |
| 1. Lý thuyết color | [T] | |
| 2.1 Cú pháp color cơ bản (inherit/current/transparent/black/white) | [T] | |
| 2.2 Design tokens color | [T] | |
| 2.3 Opacity modifier | [T] | |
| 2.4 Arbitrary values color | [T] | |
| 2.5 CSS custom property color | [T] | |
| 3. Dùng color — kết hợp width/offset, responsive, state | [T] + [E] | |
| Mermaid color taxonomy | [T] → bỏ, trùng text | |
| Warning: Outline vs Border | [T] + tier-2 visual | bảng so sánh |
| Specificity rule color | [T] | |
| Accessibility (WCAG, focus) | [T] + [W] | widget candidate: outline-none vs focus ring |
| Tóm tắt outline-style | [T] | |
| Lý thuyết: Outline vs Border (không ăn layout, hình chữ nhật, không theo border-radius) | [T] | quan trọng |
| Bảng box model so sánh border/outline | [T] → tier-2 (đã có ở Note 1, không lặp — link) | |
| Mermaid box model phân tích | [T] → skip, link Note 1 | |
| Bảng cú pháp style (solid/dashed/dotted/double/none/hidden) | [T] + tier-2 table | |
| Warning accessibility outline-none/hidden | [T] + [W] | widget candidate: cần focus thay thế |
| 3.1 Kiểu outline cơ bản | [T] + [E] | |
| 3.2 Focus state form input (outline-hidden) | [T] + [E] | cơ chế forced-colors |
| 3.3 Loại bỏ outline container có focus-within | [T] | |
| 3.4 Variants | [T] | |
| Tóm tắt outline-offset | [T] | |
| Lý thuyết offset (dương đẩy ra, âm kéo vào, che nội dung) | [T] + [W] | widget candidate: slider offset |
| Mermaid offset tree | [T] → tier-2 visual | |
| Bảng class reference offset | [T] + tier-2 table | |
| 3.1 Fixed values offset | [T] | |
| 3.2 Arbitrary offset | [T] | |
| 3.3 CSS custom property offset | [T] | |
| 3.4 Responsive offset | [T] | |

Tỉ lệ: [T] ~75%, [W] ~3 widget, [E] ~4 khối code, [Q] = 3 câu self-test. Trong ngưỡng 70/10/10/10.

## Widget specs (3)

### W1 — outline-offset explorer (slider PARAM, honor-system)
- **Misconception:** "outline-offset chỉ đẩy outline ra xa — không có chiều ngược lại."
- **Người học dự đoán SAI vì:** thấy chữ 'offset' = 'khoảng cách' (luôn dương), không biết giá trị âm kéo outline *vào trong* che nội dung.
- **Pattern:** PARAM slider, honor-system (không gate cứng vì là slider explorer). Caption BẮT BUỘC "tự dự đoán trước khi kéo". Đoạn tổng kết SAU widget = recap hợp lệ.
- **Derive tool phía trên:** 1 dòng "dương = đẩy ra, âm = kéo vào (che nội dung)". Không spoiler cụ thể.
- **Cấm phía trên:** literal "âm che content".

### W2 — outline-none + focus ring (GATE+STEP)
- **Misconception:** "`outline-none` là đủ cho style — xóa outline là đẹp."
- **Người học dự đoán SAI vì:** tưởng mục đích là thẩm mỹ, không biết xóa outline focus = phá accessibility (người dùng bàn phím mất visual cue).
- **Pattern:** GATE cứng commit 1 lần, 2 lựa chọn: "OK, đẹp rồi" / "Sai — cần focus thay thế". 1 demo box có outline-none rồi hiển thị focus ring thay thế sau khi commit.
- **Derive tool phía trên:** bảng accessibility (WCAG focus visible), định nghĩa forced-colors.
- **Cấm phía trên:** literal "cần focus:ring thay thế".

### W3 — outline tuân theo border-radius? (GATE)
- **Misconception:** "Outline bo theo border-radius — cùng là viền mà."
- **Người học dự đoán SAI vì:** tưởng outline = border về hình dạng, không biết outline luôn hình chữ nhật bao quanh box (mặc định).
- **Pattern:** GATE cứng commit 1 lần, 2 lựa chọn: "Bo theo radius" / "Luôn hình chữ nhật". 1 demo box có border-radius + outline.
- **Derive tool phía trên:** 1 dòng "outline = hình chữ nhật bao quanh box, không tuân theo border-radius" + định nghĩa.
- **Cấm phía trên:** literal đáp án trên gate.

## Tier-2 visuals (tĩnh)
1. **Outline vs Border** — bảng so sánh 4 thuộc tính (ảnh hưởng layout / tuân theo border-radius / vị trí / chiếm không gian). Nằm ở primer/mechanism.
2. **Outline anatomy** — sơ đồ 1 box có content → border → outline (vẽ ngoài, có offset). Cho thấy offset là *khoảng giữa border-edge và outline*.
3. **Style preview** — 6 preview box thật với solid/dashed/dotted/double/none/hidden để thấy hình dáng.
4. **Width scale** — ladder outline 1/2/4/8px để so sánh độ dày.
5. **Offset scale** — ladder offset -4/0/2/4px để so sánh (trực quan cho widget W1).

## Term taxonomy

**Loại 1 (định nghĩa trong note, vào primer + anchor):**
- outline — "viền ngoài, vẽ đè, không thuộc box model, không ăn layout"
- outline-offset — "khoảng cách giữa outline và cạnh phần tử; dương đẩy ra, âm kéo vào"
- forced-colors mode — "chế độ tương phản cao của OS (vd Windows High Contrast)"
- focus ring — "vòng hiển thị quanh phần tử khi focus, thay thế outline mặc định"
- WCAG / accessibility — "tiêu chuẩn truy cập; focus visible là yêu cầu"
- focus-visible — "pseudo-class chỉ hiện focus cho tương tác bàn phím"
- accessibility — "truy cập — đảm bảo người dùng bàn phím/đọc màn hình dùng được"

**Loại 2 (prerequisite — link, CẨM re-teach):**
- box model (content/padding/border/margin) → Note 1 border-utilities
- border vs outline cơ bản → Note 1 / bridge
- Tailwind utility grammar → Note 1
- arbitrary value / token / CSS variable → Note 1
- opacity modifier → Note 1
- cascade/specificity → Note 1
- responsive/state variant → Note 1
- border-radius → Note 1

**Loại 3 (BUG — phải xoá):** không có.

**Kiểm tra spoiler:** "âm che content", "cần focus thay thế", "luôn hình chữ nhật" đều đã Loại 1 + có mechanism phía trên gate. Pass.

## Output
`interactive-notes-out/outline-utilities/outline-utilities.html`
Bridge: `interactive-notes-out/border-vs-outline-bridge.html`
