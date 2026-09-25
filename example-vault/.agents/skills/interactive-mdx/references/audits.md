# Audits — Interactive MDX (Phase 5)

Nguyên tắc: **generator tự đọc tự chấm luôn cho mình pass** (regression thực chứng
từ skill HTML gốc VÀ từ chính vault này: note Hash Table v1 tự chấm 5/5 pass trong
khi chỉ có 1 điểm tương tác cho 9 section). Vì vậy audit 2 lớp: MECHANICAL
(script fail cứng) + SEMANTIC (checklist "con mắt mới").

## Lớp 1 — MECHANICAL: `python3 scripts/audit.py (Windows: py -3 scripts/audit.py) <note.mdx>`

Script kiểm và FAIL cứng:
- FORBIDDEN: không `import`/`export`/`<script`/`<style`/`style=`/`onClick=` trong note
- COMPONENTS: mọi tag PascalCase nằm trong whitelist kit + Interactive/SandboxedHTML
- BUDGET-TRẦN: số WidgetFrame ≤ 3
- BUDGET-SÀN: section body ≥6 → điểm tương tác ≥2; ≥9 → ≥3
  (điểm tương tác = WidgetFrame | island có PARAM ghi chú honor-system)
- WIDGET: mỗi WidgetFrame có prop misconception; có PredictionGate với
  question + options + (answer hoặc island theo sau); island đứng SAU gate
- RECAP: sau mỗi WidgetFrame phải có Recap trước h2 kế tiếp
- SELF-TEST: đúng 3 SelfTestItem, level đúng bộ {3,4,5}
- EVIDENCE: có EvidenceLog; EvidenceItem có children → WARN kiểm nguồn thật
- ISLAND: mọi src trỏ tới file/folder tồn tại; manifest.json permissions
  network=false, filesystem=false (trừ khi plan ghi ngoại lệ)
- ANCHOR: mọi href="#x" có heading id="x" tồn tại
- FRONTMATTER: theme: interactive-note, title, review_interval_days
- JSX: tag đóng/mở cân bằng
- ONE-LINER: section one-liner không chứa component visual

Và WARN (bắt buộc xử lý semantic, không được lờ):
- SPOILER-HEURISTIC: chuỗi answer của gate xuất hiện trong text PHÍA TRÊN gate
- COVERAGE-HEURISTIC: section chứa ≥2 con số so sánh (vs / hơn / gấp) mà
  không có ComparisonBars/TraceBlock/bảng trong section
- Self-test answer thiếu link ngược (anchor hoặc wikilink)
- EvidenceItem CÓ kết quả → liệt kê để kiểm "số này đo thật hay bịa?"

## Lớp 2 — SEMANTIC (đọc như người CHƯA BIẾT concept, chạy sau khi mechanical sạch)

### CLOSURE
- [ ] Thuật ngữ nào chưa định nghĩa tại điểm gặp + không trong primer + không prerequisite → Loại 3 = BUG
- [ ] Nhãn MỌI visual/widget (trục, bar, chú thích): từng từ đã Loại 1 và định nghĩa Ở TRÊN?
- [ ] Primer: mỗi term 1 dòng? Có dòng đáy closure?

### SPOILER
- [ ] Trên mỗi gate: có LITERAL đáp án không? → chuyển xuống Recap
- [ ] Công-cụ-derive phía trên gate là HỢP LỆ — đừng xóa nhầm
- [ ] Visual Mental Model chỉ vẽ nửa misconception, chưa lộ correction?

### COVERAGE + BUDGET
- [ ] Section so sánh định lượng / bố cục không gian / trình tự nào còn text-only?
- [ ] Visual nào KHÔNG map vào cấu trúc trên? (decoration → xóa)
- [ ] Mỗi widget đối chiếu spec misconception 2 dòng trong plan.md — có thật sự
      phơi bày misconception đó, hay đã trượt thành demo?
- [ ] Sàn tương tác đạt bằng widget CÓ NGHĨA, không phải gate chế cho đủ số

### ISLAND
- [ ] Kịch bản island tái hiện đúng câu hỏi gate?
- [ ] Tự trace 3–5 bước đầu khớp render thật?

## Protocol lặp

```
vòng = 0
while vòng < 3:
    chạy audit.py → sửa mọi FAIL bằng edit nhỏ → chạy lại
    mechanical sạch → checklist semantic → sửa
    cả hai sạch → DONE
    vòng += 1
vòng == 3 chưa sạch → DỪNG, báo cáo trung thực (không im lặng ship, không tự hạ chuẩn)
```

Lưu ý regression: mọi lần sửa có thể tạo lỗi mới (visual mới mang nhãn mới,
nội dung chèn trước gate có thể spoil). Sau mỗi edit, chạy lại audit.py.

