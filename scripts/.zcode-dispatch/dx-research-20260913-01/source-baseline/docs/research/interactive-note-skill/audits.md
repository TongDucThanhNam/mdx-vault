# Audits — Format B (Phase 5)

Nguyên tắc: **generator tự đọc tự chấm luôn cho mình pass** (đã có 3 regression
thực chứng). Vì vậy audit chia 2 lớp: MECHANICAL (script fail cứng) và
SEMANTIC (checklist chạy như "con mắt mới" — đọc file như người lạ, không dựa
vào trí nhớ lúc viết).

## Lớp 1 — MECHANICAL: `python3 scripts/audit.py note.html`

Script kiểm và FAIL cứng:
- BUDGET: 1 ≤ số `.widget` ≤ 3; mỗi widget có `.widget-misconception`
- GATE: có `.gate` thì phải có `.gate-btn[data-pred]` + `.gate-verdict`
- ANCHOR: mọi `href="#x"` có `id="x"` tồn tại
- SCROLL: body không có `overflow:hidden` (đây là Format B, không phải Lab)
- SELF-TEST: đúng 3 `.q-item`, mỗi cái có `.q-answer` + nút Reveal
- THEME: đủ 3 Google Font; không `<script src=` ngoài; không localStorage;
  không gradient/border-radius trong CSS
- FRONTMATTER: có `review_interval_days`
- EVIDENCE: có section Evidence; ô trống dùng class `evidence-empty`

Và WARN (cần người/agent xử lý semantic):
- SPOILER-HEURISTIC: giá trị `data-pred` (kèm %) xuất hiện trong text
  PHÍA TRÊN gate → liệt kê vị trí để kiểm tay
- Self-test answer thiếu link ngược

## Lớp 2 — SEMANTIC (checklist, chạy sau khi mechanical sạch)

### Audit CLOSURE (taxonomy 3 loại)
Đọc từ đầu file như người CHƯA BIẾT concept:
- [ ] Gặp thuật ngữ nào chưa định nghĩa tại điểm đó và không có trong primer
      + không phải prerequisite khai báo? → Loại 3 = BUG
- [ ] Nhãn/label của MỌI visual và widget (kể cả trục, chú thích, tên bar):
      từng từ đã Loại 1 và định nghĩa Ở TRÊN chưa?
- [ ] Primer: mỗi thuật ngữ đúng 1 dòng? Có dòng đáy closure
      ("assume sẵn: ... → prerequisites")?

### Audit SPOILER (ordering)
Với MỖI gate, đọc toàn bộ nội dung phía trên nó:
- [ ] Có chỗ nào cho LITERAL đáp án (con số, kết luận thẳng)? → chuyển
      xuống sau widget thành "Recap tĩnh — cho lần đọc thứ N"
- [ ] Công-cụ-để-derive (mechanism, layout, định nghĩa) phía trên gate
      là HỢP LỆ — đừng xoá nhầm; prediction có nghĩa nhờ chúng
- [ ] Visual ở Mental Model chỉ vẽ nửa misconception, chưa lộ correction?

### Audit COVERAGE (tier 2)
- [ ] Section nào có so sánh định lượng / bố cục không gian / trình tự mà
      còn text-only? (One-liner, Links, Self-test được miễn — theo rule)
- [ ] Ngược lại: có visual nào KHÔNG map vào một cấu trúc như trên?
      (decoration → xoá)

### Audit BUDGET + spec
- [ ] Mỗi widget đọc lại spec misconception 2 dòng trong plan.md — widget
      có thật sự phơi bày đúng misconception đó không, hay đã trượt thành demo?

## Protocol lặp

```
vòng = 0
while vòng < 3:
    chạy audit.py → sửa mọi FAIL bằng edit nhỏ (str_replace từng chỗ)
    mechanical sạch → chạy checklist semantic → sửa
    cả hai sạch → DONE
    vòng += 1
vòng == 3 mà chưa sạch → DỪNG, báo cáo trung thực từng mục chưa đạt
(không im lặng ship bản lỗi, không tự hạ chuẩn)
```

Lưu ý regression: **mọi lần sửa đều có thể tạo lỗi mới** — visual mới mang
nhãn mới (closure), nội dung chèn trước gate có thể spoil. Sau mỗi edit ở
vòng audit, chạy lại audit.py trước khi kết luận.
