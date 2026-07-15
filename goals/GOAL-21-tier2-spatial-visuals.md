# GOAL-21 — Tier-2 Spatial Visual Components cho Interactive Note Kit

> Executing agent: read this entire file before doing anything.
> Must also read and follow [AGENTS.md](../AGENTS.md) and [docs/security.md](../docs/security.md).

---

## Objective

Kit interactive-note (GOAL-17) thiếu hẳn nhóm **Tier-2 static spatial visuals** của design system gốc: `.cell-grid`, `.mem-strip`, `.line-brackets`, `.mem-flex`/`.mem-arrow` (xem docs/research/interactive-note-skill/design-system.md dòng ~130–196). Hệ quả thực chứng: note có cấu trúc không gian/trình tự (DNS resolution path) chỉ diễn đạt được bằng TraceBlock (chữ monospace) → "thuần chữ". Goal này thêm 2 component tĩnh:

1. **`CellGrid`** — lưới ô trạng thái (mảng bộ nhớ, hash slots, cache lines):
   - Props (zod): `columns: number (1..32)`, `cells: { label?: string, state?: 'default'|'current'|'hit'|'miss'|'cached'|'dim' }[]`, `caption?: string`, `groupSize?: number`, `groupLabels?: string[]` (vẽ ngoặc `.line-brackets` gộp mỗi groupSize ô — dùng cho "cache line = 4 phần tử").
   - Màu theo design system: current=accent trắng chữ, hit/cached=result-tint hoặc outline result, miss=accent-tint, dim=opacity .25.
2. **`FlowSequence`** — chuỗi node có mũi tên (resolution path, handshake, pipeline):
   - Props (zod): `nodes: { label: string, sublabel?: string, accent?: boolean }[]`, `edgeLabels?: string[]` (nhãn trên mũi tên, vd "~30ms"), `caption?: string`, `direction?: 'row'|'column'` (default row, wrap được).
   - Style theo `.mem-flex`/`.mem-arrow`/`.mem-cell` gốc: box border-2 ink, mũi tên monospace, không màu ngoài palette.

Cả hai: category `interactive-note`, styled trong interactive-note-theme.css (prefix `in-`), có `insertSnippet`, render đẹp cả trong note thường lẫn theme.

---

## Ràng buộc & phạm vi

- [x] Đúng pattern registry hiện có (`defineRegistryEntry` + zod, props sai → ComponentValidationWarning). KHÔNG dep mới. KHÔNG đụng component/islands hiện có ngoài việc thêm entry.
- [x] CSS values đối chiếu design-system.md gốc — cấm gradient/border-radius/màu ngoài palette.
- [x] Cập nhật demo: thêm vào `example-vault/notes/Cache Hierarchy & Locality.mdx` một `CellGrid` (minh họa mảng 4×4 + groupSize 4 — thay hoặc bổ sung chỗ đang tả bằng chữ) để bản chuẩn thể hiện component mới. KHÔNG phá spoiler ordering: CellGrid đặt trên gate chỉ được vẽ layout (công cụ derive), không vẽ kết quả hit/miss của câu gate hỏi.
- [x] Cập nhật skill trong vault `example-vault/.agents/skills/interactive-mdx/`: (a) references/components.md thêm bảng props + ví dụ 2 component mới vào mục "Mental model & visual tĩnh"; (b) references/note-structure.md map Tier-2: "bố cục không gian → CellGrid, trình tự/path → FlowSequence"; (c) scripts/audit.py: mở rộng WARN COVERAGE-HEURISTIC — section chứa từ khóa trình tự/không gian (path, layout, hierarchy, tầng, chuỗi, bước) mà không có visual component nào → WARN kèm gợi ý CellGrid/FlowSequence. Chạy lại audit trên 2 note hiện có, không được tạo FAIL mới.
- [x] Unit tests: zod schema 2 component (hợp lệ + sai), CellGrid grouping logic nếu tách được hàm thuần. `bun test`/`typecheck`/`lint` pass.
- [x] Working tree có thay đổi GOAL-16 chưa commit — không revert, không commit chung; stage chọn lọc.
- [x] Blocker → DỪNG và hỏi.

---

## Execution Plan

1. Đọc design-system.md gốc (mục cell-grid/mem-strip/line-brackets/mem-flex) + registry + theme CSS hiện có.
2. Implement CellGrid + FlowSequence + CSS + registry entries + snippets + tests.
3. Cập nhật demo note Cache (giữ spoiler rule) + skill vault (components.md, note-structure.md, audit.py COVERAGE).
4. Verify: bun test/typecheck/lint; py -3 audit.py 2 note hiện có 0 FAIL mới; commit (conventional commits).
