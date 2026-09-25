---
name: interactive-mdx
description: Tạo Interactive Note dạng MDX trong vault mdx-vault (kế thừa Format B — Explorable Reference Note). Dùng khi user muốn "interactive note", "explorable note", "chuyển note MD thành interactive". Output là file .mdx dùng registry components + island sandbox — KHÔNG sinh HTML note tự chứa. Workflow 6 phase, audit 2 lớp bằng scripts/audit.py — chống content loss, thiếu tương tác, và generator tự chấm.
---

# Interactive MDX Note — Agent Workflow

## Nhiệm vụ

Biến 1 note Markdown nguồn thành 1 file `.mdx` trong `notes/`: đọc như reference note (scroll tự do, scan 90 giây, mọi section anchor được) với điểm tương tác misconception-gated đặt đúng chỗ. App lo CSS/JS pattern/skeleton của KIT; island custom trong `interactives/` vẫn là code bạn viết. Bản chuẩn sống trong vault: `notes/Cache Hierarchy & Locality.mdx` + `interactives/hash-linear-probing/`.

## BA NGUYÊN TẮC VẬN HÀNH — vi phạm là fail toàn bộ

1. **KHÔNG one-shot.** Không sinh cả note trong một lần output. Build: skeleton từ template → chuyển hết prose → mỗi visual/widget một chu kỳ edit riêng. Island HTML cũng vậy: frame → logic → tự trace tay.
2. **State sống trong `plan.md`, không sống trong trí nhớ.** Phase 0 viết plan ra file cạnh note. Mọi phase sau đọc plan. Xóa khi nghiệm thu xong.
3. **Script là thẩm phán, không phải bạn.** Generator tự đọc tự chấm luôn cho mình pass (đã có regression thực chứng). Phase 5 bắt buộc chạy `python3 scripts/audit.py (Windows: py -3 scripts/audit.py) <note.mdx>` — FAIL là sửa, không biện luận.

| Phase | Đọc file nào |
|---|---|
| 0 — Plan | note nguồn + SKILL.md này |
| 1 — Skeleton | `references/note-structure.md` + `templates/interactive-note.mdx` (vault) |
| 2 — Static visuals | `references/components.md` |
| 3 — Widgets/Islands | `references/components.md` + `references/island-patterns.md` + `references/island-design.md` |
| 4 — Retrieval layer | `references/note-structure.md` (Self-test, Evidence) |
| 5 — Audit loop | `references/audits.md` + `scripts/audit.py` |
| Bí về "trông thế nào" | mở bản chuẩn `notes/Cache Hierarchy & Locality.mdx` |

## WORKFLOW 6 PHASE

### Phase 0 — PLAN (output: `plan.md`, chưa đụng MDX)
1. **Kiểm tra tách note:** 1 note = 1 concept node. Nguồn >1 concept lớn hoặc >8 section NỘI DUNG → TÁCH + bridge note, báo user. Đếm section nội dung theo CÙNG định nghĩa với audit.py: không tính One-liner/Labs/Links/Evidence/Self-test/footer template. Nguồn ngắn (<100 dòng) hiếm khi cần tách vì số section — chỉ tách khi thật sự >1 concept.
2. **Phân loại block:** `[T]` text / `[W]` widget candidate / `[E]` evidence thật / `[Q]` self-test. Tỉ lệ điển hình 70/10/10/10.
3. **Widget specs + BUDGET HAI CHIỀU:**
   - Trần: ≤3 widget. **Sàn: note có ≥6 section body → ≥2 điểm tương tác; ≥9 section → dùng đủ 3.** Điểm tương tác = widget gated (island nếu mechanism cần slow-motion) hoặc PARAM explorer. Không đủ sàn → hoặc tìm thêm misconception đáng test, hoặc ghi rõ trong plan VÌ SAO nội dung không có mechanism mô phỏng được (hiếm) — audit sẽ WARN, user quyết.
   - Mỗi widget bắt buộc spec 2 dòng (viết không ra → hạ xuống static): `Misconception: "..."` / `Người học dự đoán SAI vì: "..."`
   - Phân biệt [W] vs [E]: simulation chỉ hợp lệ khi mechanism cần slow-motion để NHÌN từng bước. Giá trị nằm ở CON SỐ THẬT trên máy thật → [E], cấm simulate.
4. **Tier-2 visual list:** section có so sánh định lượng / bố cục không gian / trình tự → visual tĩnh loại gì (xem components.md).
5. **Term taxonomy:** Loại 1 (định nghĩa trong note → PrimerTerm + anchor) / Loại 2 (prerequisite frontmatter → wikilink, cấm re-teach) / Loại 3 = BUG phải xoá. Thuật ngữ trong gate/controls/nhãn visual BẮT BUỘC Loại 1, định nghĩa Ở TRÊN widget.

### Phase 1 — SKELETON (fidelity trước, component sau)
Copy `templates/interactive-note.mdx` → `notes/<Tên>.mdx`. Điền frontmatter (giữ `theme: interactive-note` + `review_interval_days`), h1, primer, và **toàn bộ text [T] chuyển sang TRƯỚC** — chữ đi trước, component đi sau. Chỗ visual/widget để `{/* TIER2: ... */}` `{/* WIDGET-1: ... */}`. Thứ tự section theo `references/note-structure.md`.

### Phase 2 — STATIC VISUALS
Mỗi visual một edit, thay đúng placeholder. Visual mang nhãn = thuật ngữ mới → đối chiếu taxonomy ngay.

### Phase 3 — WIDGETS + ISLANDS
Mỗi widget một chu kỳ: `WidgetFrame` + misconception + `PredictionGate` (app lo commit-once/verdict) → island nếu cần slow-motion (build theo `references/island-patterns.md`, tự trace 3–5 bước đầu bằng tay so với kỳ vọng trong plan) → **Recap tĩnh SAU widget**. Slider/PARAM = honor-system caption, không gate cứng.

### Phase 4 — RETRIEVAL LAYER
`EvidenceLog` (lệnh thật + `EvidenceItem` KHÔNG children khi chưa đo — cấm bịa), `SelfTest` đúng 3 câu level 3/4/5 có link ngược, section Links, note-meta footer.

### Phase 5 — AUDIT LOOP (bắt buộc, tối đa 3 vòng)
```
python3 scripts/audit.py (Windows: py -3 scripts/audit.py) "notes/<Tên>.mdx"
→ FAIL nào → sửa bằng edit nhỏ → chạy lại (mọi lần sửa có thể tạo lỗi mới)
→ mechanical sạch → checklist SEMANTIC trong references/audits.md (đọc như người lạ)
→ 3 vòng chưa sạch → DỪNG, báo cáo trung thực từng mục chưa đạt
```

## HARD RULES
1. KHÔNG `import`/`export`/`<script>`/`<style>`/inline handler trong note. Prose đọc được như văn bản thuần.
2. Budget 2 chiều: 1–3 widget theo sàn/trần ở Phase 0. Mỗi widget có misconception line. Outcome rời rạc → PredictionGate.
3. Spoiler ordering: trên gate chỉ đặt CÔNG CỤ derive; LITERAL đáp án cấm. Recap tĩnh SAU widget.
4. Term closure: không Loại 3; gate/nhãn chỉ dùng Loại 1 định nghĩa phía trên.
5. Evidence không simulate. Self-test không visual. One-liner không visual.
6. Island: manifest permissions all-false trừ khi thật cần; theo design editorial (island-patterns.md); không lib ngoài/localStorage.
7. Behavior tùy implementation → prefix `[Version-dep]` `[General model]` `[Unverified]`…
8. Tiếng Việt; thuật ngữ Anh kèm mô tả Việt lần dùng đầu.



