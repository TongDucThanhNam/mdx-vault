---
name: interactive-note
description: Chuyển ghi chú Markdown thành Interactive Note (Format B — Explorable Reference Note, single-file HTML, editorial theme, prediction gates). Dùng khi user muốn "interactive note", "explorable note", "chuyển note MD thành interactive", hoặc nhắc Format B. KHÔNG dùng cho Interactive Lab dual-panel step-through (đó là Format A — skill interactive-lab). Workflow 6 phase, build từng phần bằng edit, audit loop bằng script — chống max-output, content loss, và thiếu verification.
---

# Interactive Note — Format B (Agent Workflow)

## Nhiệm vụ

Biến 1 note Markdown thành 1 file HTML tự chứa: đọc như reference note (scroll tự do, scan 90 giây, mọi section anchor được) nhưng có điểm neo tương tác đặt đúng chỗ. Đây KHÔNG phải Format A (Lab dual-panel, học 1 lần) — bảng phân biệt trong `references/note-structure.md`.

## BA NGUYÊN TẮC VẬN HÀNH — vi phạm là fail toàn bộ

1. **KHÔNG BAO GIỜ one-shot.** Không sinh cả file HTML trong một lần output. Build bằng: tạo skeleton → edit từng section (`str_replace`/append) → mỗi widget một chu kỳ edit riêng. Lý do: max output token, attention dilution (phần sinh sau của output dài luôn kém), content loss.
2. **State sống trong `plan.md`, không sống trong trí nhớ.** Phase 0 viết plan ra file. Mọi phase sau đọc plan, không tự nhớ lại.
3. **Progressive disclosure.** Chỉ đọc reference file của phase đang chạy (bảng dưới). Context ưu tiên cho NỘI DUNG NOTE NGUỒN.

| Phase | Đọc file nào |
|---|---|
| 0 — Plan | note nguồn + SKILL.md này |
| 1 — Skeleton | `references/note-structure.md` + `templates/note-template.html` |
| 2 — Static visuals | `references/design-system.md` |
| 3 — Widgets | `references/js-patterns.md` + `references/design-system.md` |
| 4 — Retrieval layer | `references/note-structure.md` (mục Self-test, Evidence) |
| 5 — Audit loop | `references/audits.md` + `scripts/audit.py` |
| Khi bí về "trông thế nào" | `examples/note-cache-hierarchy-locality.html` — bản chuẩn thực tế |

## WORKFLOW 6 PHASE

### Phase 0 — PLAN (output: `plan.md`, KHÔNG viết HTML)
Đọc trọn note nguồn. Viết `plan.md` gồm:
1. **Kiểm tra tách note:** một note = MỘT concept node. Nguồn chứa >1 concept lớn hoặc ước lượng >8 section → TÁCH thành nhiều note + bridge note, báo user, xử lý từng note một. Đây là fix gốc cho "note quá dài mất nội dung".
2. **Phân loại block:** gắn nhãn từng block nguồn `[T]` text / `[W]` widget candidate / `[E]` evidence thật / `[Q]` self-test. Tỉ lệ điển hình 70/10/10/10. `[W]` quá nửa = đang lặp lỗi "convert toàn bộ".
3. **Widget specs** (≤3, mỗi cái bắt buộc 2 dòng — viết không ra thì hạ xuống static):
   ```
   Misconception: "..."  /  Người học dự đoán SAI vì: "..."
   Pattern: GATE+STEP | PARAM | TOGGLE   (xem js-patterns.md)
   ```
4. **Tier-2 visual list:** section nào có so sánh định lượng / bố cục không gian / trình tự → visual tĩnh loại gì.
5. **Term taxonomy:** Loại 1 (định nghĩa trong note → vào primer + anchor) / Loại 2 (prerequisite frontmatter → link, cấm re-teach) / Loại 3 = BUG phải xoá bằng cách chuyển về 1 hoặc 2. Thuật ngữ trong gate/controls/nhãn visual BẮT BUỘC Loại 1, định nghĩa Ở TRÊN widget.

### Phase 1 — SKELETON (fidelity trước, code sau)
Copy `templates/note-template.html` → điền frontmatter, h1, primer, và **toàn bộ text [T] chuyển từ nguồn sang TRƯỚC** — đây là chốt chống mất nội dung: chữ đi trước, code đi sau. Chỗ visual/widget để placeholder comment: `<!-- TIER2: ... -->`, `<!-- WIDGET-1: ... -->`.

### Phase 2 — STATIC VISUALS
Mỗi visual một edit, thay đúng placeholder của nó. Nhớ: **visual mang nhãn = thuật ngữ mới** → mỗi visual thêm xong, đối chiếu ngay taxonomy trong plan.

### Phase 3 — WIDGETS
Mỗi widget một chu kỳ: HTML frame (head + misconception line + gate + viz + controls `disabled`) → JS theo pattern → **tự trace state logic bằng tay** (đi 3–5 bước đầu của simulation trên giấy, so với con số kỳ vọng trong plan). Widget có outcome rời rạc = gate cứng (commit 1 lần). Slider = honor-system caption. Sau widget gated: thêm **Recap tĩnh** cho lần đọc thứ N.

### Phase 4 — RETRIEVAL LAYER
Evidence Log (lệnh chạy thật + ô `[CHƯA CÓ]` đỏ — KHÔNG BAO GIỜ simulate số liệu benchmark), Self-test đúng 3 câu mức 3/4/5 với reveal + link ngược, Links, note-meta footer.

### Phase 5 — AUDIT LOOP (bắt buộc, tối đa 3 vòng)
```
python3 scripts/audit.py note.html
→ FAIL nào → sửa bằng edit nhỏ → chạy lại
→ WARN spoiler → kiểm semantic theo references/audits.md
→ 3 vòng chưa sạch → DỪNG, báo cáo trung thực phần chưa đạt cho user
```
Script là thẩm phán, không phải agent tự đọc tự chấm — generator tự review luôn cho mình pass.

## HARD RULES (bản đầy đủ + lý do trong references/)
1. Body scroll tự do; cấm dual-panel, cấm step ẩn/hiện, cấm `overflow:hidden` trên body. Mọi h2 có `id`.
2. Widget ≤3; mỗi widget có dòng misconception trên frame; widget outcome rời rạc phải có prediction gate commit-một-lần.
3. **Spoiler ordering:** phía trên gate được đặt CÔNG CỤ để derive (mechanism, layout); cấm đặt LITERAL đáp án. Đáp án tĩnh = recap SAU widget.
4. Term closure: không thuật ngữ Loại 3; gate/nhãn chỉ dùng Loại 1 đã định nghĩa phía trên.
5. Evidence không simulate. Self-test không visual (lộ đáp án). One-liner không visual (job = scan 5 giây).
6. Theme: đúng design-system.md — 3 font cố định, palette ink/accent/result + 2 tint, cấm gradient/border-radius/lib ngoài/framework/localStorage.
7. Behavior tùy implementation → prefix `[PG-specific]` `[InnoDB-specific]` `[Version-dep]` `[General model]` `[Unverified]`.
8. Tiếng Việt; thuật ngữ Anh kèm mô tả Việt ở lần dùng đầu ("duyệt hàng (row-major)").
