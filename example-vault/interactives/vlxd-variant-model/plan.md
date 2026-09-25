# Plan — Interactive Note: VLXD Product-Variant Model

## 1. Note split check

Nguồn có 1 concept lớn (tách biệt danh tính vs lịch sử nhập) + 1 cảnh báo lịch sử
(SUPERSEDED). Đây là **một concept node** — không tách. Status SUPERSEDED khiến
note đặc biệt: người đọc cần hiểu *tại sao* mô hình cũ sai để không lặp lại, nhưng
KHÔNG dùng nó làm chuẩn triển khai.

Note đã dài (~230 dòng markdown). Phase 1 sẽ giữ MỌI text [T], Phase 2-3 chỉ thêm
visual + widget. KHÔNG cắt nội dung nguồn.

## 2. Block classification

| Source block                                          | Tag       |
| ----------------------------------------------------- | --------- |
| SUPERSEDED warning callout                            | [T]       |
| TL;DR (1 đoạn)                                        | [T]       |
| §1 Chẩn đoán — variant vs batch vs WAC diagram       | [T]+TIER2 |
| §1 "Variant là gì? / Batch là gì?"                    | [T]       |
| §2.1 ER diagram (PRODUCT, VARIANT, INVENTORY_BATCH…)  | [T]+TIER2 |
| §2.1 Note "tại sao avg_cost trên Variant"             | [T]       |
| §2.2 WAC formula                                      | [T]+TIER2 |
| §2.2 Bảng recalculation example                       | [T]+TIER2 |
| §2.2 Tip "tại sao không dùng FIFO"                   | [T]       |
| §3.1 Purchase flow diagram                            | [T]       |
| §3.2 POS Sale flow diagram                            | [T]       |
| §3.2 Warning "snapshot unit_cost bắt buộc"            | [T]       |
| §4.1 ASCII mockup variant management UI               | [T]+TIER2 |
| §4.1 Info callout "Staff/Manager thấy gì"             | [T]       |
| §4.2 POS search filter cascading                      | [T]       |
| §5 Multi-tenant sync diagram                          | [T]+TIER2 |
| §5 Warning multi-tenant                               | [T]       |
| §6 Phase 1/2/3 roadmap                                | [T]       |
| §6 Conclusion callout                                 | [T]       |

Tỉ lệ: 100% [T] + TIER2 visuals. 0 widgets hiện tại — chèn 2 widget ở Phase 3.

## 3. Widget specs

### WIDGET 1 — WAC Recalculator (PARAM + GATE hybrid)
- **Misconception:** "Giá nhập mới cao hơn giá cũ → tạo variant mới để giữ giá vốn cũ"
  / "avg_cost cũ = 100k, nhập 120k → variant mới sẽ có avg_cost = 120k"
- **Pattern:** GATE (dự đoán con số WAC mới) + STEP/PARAM (slider cho qty nhập
  để xem WAC thay đổi thế nào)
- **Outcome người học cần đạt:** biết công thức, không nhầm giữa "giá lô mới"
  và "WAC của cả tồn kho".
- **Trace tay (3–5 bước):** tồn 50 @ 100k; nhập 80 @ 120k → WAC mới = (50×100k +
  80×120k) / 130 = 5.000k + 9.600k / 130 = 14.600/130 = 112,308đ. Match bảng nguồn.
- **Honour-system caption:** "Dự đoán WAC mới trước khi kéo — sai số cần thiết để
  hiểu tại sao nó không bằng 120k."

### WIDGET 2 — Snapshot Decision (GATE cứng)
- **Misconception:** "Có thể tính lại COGS/order cũ bằng WAC hiện tại"
  / "OrderItem không cần unit_cost vì đã có variant.avg_cost"
- **Pattern:** GATE cứng — 3 lựa chọn commit-một-lần.
- **Câu hỏi:** "Nhập lô mới làm WAC variant thay đổi (100k → 112k). Một OrderItem
  bán ngày hôm qua có unit_cost = 100k. Khi tính lợi nhuận đơn đó hôm nay, lấy
  giá trị nào?"
- **Outcome rời rạc:** chỉ đúng = 100k (snapshot), sai = WAC hiện tại / lỗi.

### Budget: 2/3 widget — chừa 1 slot nếu phát sinh nhu cầu audit.

## 4. Tier-2 visual list

| Section                  | Visual type                  | Lý do                              |
| ------------------------ | ---------------------------- | ---------------------------------- |
| §1 Misconception tree    | ascii-flow (static)          | Trình tự tư duy sai → đúng         |
| §2.1 ER diagram          | mermaid-style ascii (static) | Bố cục không gian quan hệ thực thể |
| §2.2 WAC table           | cmp-block (static)           | So sánh định lượng qua 3 mốc       |
| §4.1 Variant UI mockup   | ascii-box (static)           | Bố cục không gian 2-pane UI        |
| §5 Multi-tenant diagram  | ascii-flow (static)          | Bố cục không gian 2 tenant + shared |

## 5. Term taxonomy (Loại 1 — note tự định nghĩa)

| Thuật ngữ              | Loại | Định nghĩa 1 dòng                                                | Anchor            |
| ---------------------- | ---- | ---------------------------------------------------------------- | ----------------- |
| Variant                | 1    | Danh tính hàng hóa (loại/cấu hình cụ thể) — KHÔNG phụ thuộc giá | §1                |
| Batch (Lô nhập)        | 1    | Một lần nhập kho: qty + unit_cost + received_at                   | §1                |
| WAC                    | 1    | Weighted Average Cost — giá vốn bình quân gia quyền              | §2.2              |
| Snapshot               | 1    | Lưu giá trị tại thời điểm phát sinh để không bị tính lại        | §3.2              |

Loại 2 (prerequisite, KHÔNG re-teach): SQL cơ bản, ER diagram, frontend UX patterns.
Loại 3 (BUG phải xoá): "FIFO" — note chỉ NHẮC đến FIFO như đối lập với WAC; không
dùng làm nhãn widget.

## 6. Primer closure

Dòng đáy primer: "Assume sẵn: SQL/ER cơ bản, vai trò Manager/Staff trong bán lẻ,
khái niệm `current_stock`. SUPERSEDED trong source → xem `[[VLXD Decision - Product-Variant Cost and Brand]]`."

## 7. Spoiler ordering

- §1, §2 (định nghĩa mechanism) → ĐẶT TRƯỚC WIDGET 1 — cần có formula WAC để
  prediction có nghĩa.
- §3.2 warning snapshot → ĐẶT TRƯỚC WIDGET 2 — đã viết warning, widget CHỈ
  HỎI cách áp dụng (không spoil).
- §4, §5, §6 → ĐẶT SAU cả 2 widget (recap nội dung áp dụng).

## 8. Frontmatter note status

`current_maturity: L1` (note cũ, superseded, giữ tham khảo); `maturity_target: L2`
(đủ để hiểu *tại sao* sai, không khuyến khích dùng làm chuẩn triển khai).
`labs: —` (không có lab Format A kèm).
