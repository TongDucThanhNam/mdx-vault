# GOAL-17 — Interactive Note MDX Component Kit (Format B -> MDX)

> Executing agent: read this entire file before doing anything.
> Must also read and follow [AGENTS.md](../AGENTS.md) and [docs/security.md](../docs/security.md).
> Source material: [docs/research/interactive-note-skill/](../docs/research/interactive-note-skill/) — bản copy của skill `interactive-note` (Format B, single-file HTML) mà goal này port sang MDX.

---

## Objective

Biến quy trình "Interactive Note Format B" (hiện là single-file HTML tự chứa, xem `docs/research/interactive-note-skill/SKILL.md`) thành **first-class citizen của mdx-vault**: một bộ registry component + theme editorial được style sẵn, để một interactive note viết bằng MDX thuần (prose + component tags), không cần gen lại CSS/JS boilerplate mỗi lần. Đây là tính năng CORE của sản phẩm.

Sau goal này, một interactive note trông như sau:

```mdx
---
title: Cache Hierarchy & Locality
tags: [systems, performance]
theme: interactive-note
---

# Cache Hierarchy & Locality

<NotePrimer>
  <PrimerTerm term="cache line">Đơn vị vận chuyển giữa RAM và cache — 64 byte liên tiếp.</PrimerTerm>
</NotePrimer>

## Row-major vs Column-major

Đoạn prose bình thường, có [[wikilink]], **bold**, `code`…

<WidgetFrame title="Stride Explorer" misconception="Duyệt kiểu nào cũng chậm như nhau vì tổng số phần tử bằng nhau.">
  <PredictionGate question="Duyệt cột (column-major) trên mảng 4x4, cache line = 4 phần tử — bao nhiêu % miss?" options={["25%", "50%", "100%"]} answer="100%" explain="Mỗi bước nhảy 1 hàng = 1 cache line mới → không tận dụng được line đã nạp." />
  <Interactive src="../interactives/cache-stride" />
</WidgetFrame>

<Recap>Row-major: miss chỉ ở đầu mỗi line (25%). Column-major: miss mọi bước (100%).</Recap>

<SelfTest>
  <SelfTestItem level={3} question="Cache line là gì và vì sao nó tồn tại?">Đơn vị vận chuyển 64B — amortize chi phí truy cập RAM.</SelfTestItem>
</SelfTest>

<EvidenceLog>
  <EvidenceItem cmd="perf stat -e cache-misses ./bench_row" />
</EvidenceLog>
```

---

## Context

- **Reason**: User hiện tạo interactive note bằng skill agent bên ngoài, output là HTML một file — mỗi note phải gen lại toàn bộ CSS (~200 dòng) + JS pattern (gate/step/param) + skeleton. Không index được wikilink, không search được, không sửa được từng phần trong app. Port sang MDX + component kit: agent (hoặc user) chỉ viết prose + tags, mọi style/behavior có sẵn trong app.
- **Priority**: đây là core value proposition của mdx-vault (xem docs/product-vision.md). Fidelity với design system gốc (docs/research/interactive-note-skill/design-system.md) quan trọng — không "sáng tạo" theme mới.
- **Executor**: AI Agent (Codex), no human review between steps.
- **Created**: 2026-07-14.
- **Depends on**: GOAL-03 (registry), GOAL-04 (islands), GOAL-16. Assumes GOAL-01..16 complete.

---

## Current State

| Item | Value |
|------|-------|
| Registry | [src/renderer/src/preview/registry/index.tsx](../src/renderer/src/preview/registry/index.tsx): mảng `registryEntries`, mỗi entry = `{name, component, propsSchema (zod), description, category, defaultProps?, insertSnippet?}` qua `defineRegistryEntry`. Props validate bằng zod → sai thì render `ComponentValidationWarning`, không crash |
| Category | `RegistryCategory` trong [types.ts](../src/renderer/src/preview/registry/types.ts) hiện là `demo / content / data / layout` — cần thêm `interactive-note` |
| Islands hiện có | `src/renderer/src/preview/islands/`: QuizBlock, DataChart, EquationSlider, AlgorithmVisualizer |
| Insert palette | `getRegistryInsertTemplates()` → [ComponentInsertPalette.tsx](../src/renderer/src/editor/ComponentInsertPalette.tsx) — entry mới có `insertSnippet` tự xuất hiện |
| Fonts | ĐÃ CÓ SẴN: `@fontsource/playfair-display` 700/900, `@fontsource/lora` 400/400-italic, `@fontsource/courier-prime` import trong [main.tsx](../src/renderer/src/main.tsx) — đúng 3 font của design system gốc. KHÔNG cần dep mới |
| Frontmatter | Parse trong [preview-metadata.ts](../src/renderer/src/preview/preview-metadata.ts) → `frontmatter: Record<string, unknown>` |
| Preview root | [MdxPreview.tsx](../src/renderer/src/preview/MdxPreview.tsx) — container `.mdx-preview`, max-width 820px (trùng `.page` của design gốc) |
| App styling | Tailwind v4 + globals.css; app UI đã dùng editorial idiom (border-2, hard shadow `3px_3px_0`) — theme kit phải cùng ngôn ngữ |
| Vault islands | `<Interactive src="…"/>` render trong iframe sandbox (GOAL-05) — React context KHÔNG xuyên qua được iframe boundary |
| Design system gốc | [docs/research/interactive-note-skill/design-system.md](../docs/research/interactive-note-skill/design-system.md) — palette paper #f9f9f7, ink #111, accent #d32f2f, result #2b5797, 2 tint #dce6f5 / #f5d5d5; cấm gradient/border-radius. Bản HTML chuẩn: `note-cache-hierarchy-locality.html` cùng thư mục |
| Interactives sẵn | `example-vault/interactives/cache-stride`, `cache-row-col` — dùng được cho demo note |

---

## Target State

### 1. Component kit — `src/renderer/src/preview/islands/interactive-note/`

Mỗi component một file + một registry entry (pattern hiện có), category mới `interactive-note`. Style bám sát design-system.md (class prefix `in-` để không đụng style app, CSS đặt trong file theme — xem mục 2):

| Component | Props (zod) | Hành vi |
|---|---|---|
| `NotePrimer` | children | Khung dashed "TỪ CẦN BIẾT TRƯỚC" đầu note (`.primer` gốc) |
| `PrimerTerm` | `term: string`, `href?: string`; children = định nghĩa | Một dòng primer; `href` → link tới note khác hoặc anchor |
| `HighlightBox` | `title?: string`; children | `.highlight-box` gốc — border đỏ trái 5px |
| `FormulaLine` | children | `.formula-line` gốc — monospace, hard shadow |
| `MentalModel` | children | Grid 2 cột `.mm-grid` gốc |
| `MentalModelRow` | `label: string`, `conflict?: boolean`; children | Một hàng key/value; `conflict` → label đỏ |
| `TraceBlock` | children | `.trace` gốc — pre monospace, giữ whitespace |
| `WidgetFrame` | `title: string`, `misconception?: string`; children | Khung widget `.widget` gốc: head + status badge (LOCKED→READY→DONE) + dòng misconception. Cung cấp React context `{locked, prediction, commit, complete}` cho PredictionGate + children CÙNG cây React |
| `PredictionGate` | `question: string`, `options: string[]`, `answer?: string`, `explain?: string` | `.gate` gốc: commit MỘT LẦN (chọn xong không đổi được); khi có `answer` → verdict hiện ngay sau commit (đúng/sai + explain); commit cũng chuyển WidgetFrame status → READY. Không nằm trong WidgetFrame vẫn hoạt động standalone |
| `Recap` | children | Khối recap tĩnh đặt SAU widget |
| `SelfTest` | children | Section container |
| `SelfTestItem` | `level: number (3/4/5)`, `question: string`; children = đáp án | `.q-item` gốc: badge level, nút "Hiện đáp án" reveal |
| `EvidenceLog` | children | Section container |
| `EvidenceItem` | `cmd: string`; children = kết quả (optional) | `.cmd` block; children RỖNG → ô đỏ `[CHƯA CÓ]` (`.evidence-empty` gốc) — không bao giờ tự bịa số liệu |
| `ComparisonBars` | `items: {label, value, display?, bad?}[]`, `caption?: string` | Bar chart tĩnh ngang (`.cmp-block`/`.lat-ladder` gốc), bar scale theo max value, `bad` → đỏ |

Ghi chú thiết kế:
- Mọi state là React `useState` cục bộ — KHÔNG localStorage (rule gốc), KHÔNG state global.
- `WidgetFrame` context chỉ áp dụng cho children cùng cây React. `<Interactive>` trong iframe KHÔNG nhận context — chấp nhận, wiring gate↔iframe qua postMessage là Out of Scope.
- Mỗi entry có `insertSnippet` đầy đủ (như QuizBlock hiện có) để hiện trong ComponentInsertPalette.
- Con số/tên class ở trên là mapping từ design-system.md — copy giá trị CSS từ đó, không tự chế.

### 2. Theme `interactive-note`

- File CSS mới (đề xuất `src/renderer/src/preview/interactive-note-theme.css`, import từ globals hoặc MdxPreview):
  - Phần A — **component styles** (prefix `in-`): luôn load, để component đẹp cả trong note thường.
  - Phần B — **prose theme**, scope dưới `.mdx-preview.theme-interactive-note`: typography editorial cho h1 (Playfair 900 2.5rem), h2 (Playfair 700 + border-top 2px ink + scroll-margin), p (Lora line-height 1.85), code/table/blockquote… theo design-system.md.
- `MdxPreview` đọc `frontmatter.theme === 'interactive-note'` → thêm class `theme-interactive-note` vào container `.mdx-preview`. Frontmatter khác/không có → không đổi gì.
- Palette: giữ paper-light đúng bản gốc kể cả khi app dark mode [ước lượng — nếu contrast với app dark quá gắt, map qua CSS variables nhưng giữ nguyên hue].
- KHÔNG gradient, KHÔNG border-radius trong toàn bộ kit (hard rule của design system).

### 3. Template + demo + docs

- `example-vault/templates/interactive-note.mdx` — skeleton đầy đủ theo note-structure.md: frontmatter (title/tags/theme/prerequisites), primer, các section mẫu có comment `{/* TIER2: … */}` `{/* WIDGET-1: … */}`, self-test 3 câu level 3/4/5, evidence log, links, note-meta.
- `example-vault/notes/Cache Hierarchy & Locality.mdx` — port NỘI DUNG THẬT từ `docs/research/interactive-note-skill/note-cache-hierarchy-locality.html` sang MDX dùng kit + `<Interactive src="../interactives/cache-stride" />` / `cache-row-col` (nếu props/manifest tương thích; không tương thích thì dùng widget nào chạy được và ghi chú). Đây là acceptance test bằng nội dung thật — mọi text [T] của bản HTML phải sang đủ, không rút gọn.
- `docs/interactive-note-authoring.md` — quy trình 6-phase của SKILL.md viết lại cho MDX: những gì kit đã lo (CSS, JS pattern, skeleton HTML → thay bằng template + components), những gì author/agent vẫn phải làm (plan, term taxonomy, widget spec, misconception line, spoiler ordering, evidence thật). Kèm bảng "HTML cũ → component mới".

---

## Constraints

- [x] KHÔNG thêm dependency mới — fonts, zod, mọi thứ cần đều đã có.
- [x] KHÔNG sửa sandbox (`sandbox-*.ts`), KHÔNG sửa islands/registry entries hiện có (QuizBlock, DataChart, EquationSlider, AlgorithmVisualizer, Counter) ngoài việc thêm entries mới vào mảng.
- [x] Mọi component mới đi qua đúng pattern registry hiện có (`defineRegistryEntry` + zod). Props sai → `ComponentValidationWarning` như hành vi hiện tại, không crash preview.
- [x] Theme chỉ kích hoạt theo frontmatter opt-in. Note không có `theme: interactive-note` → render pixel-giống hiện tại (không regression style).
- [x] Fidelity design system: đối chiếu từng giá trị (màu, font, border, shadow) với design-system.md. Cấm gradient/border-radius/màu ngoài palette trong kit.
- [x] `PredictionGate` commit-một-lần và `EvidenceItem` không-bịa-số-liệu là hard rules — có unit test cho logic commit-once (tách logic ra hàm thuần để test được nếu chưa có hạ tầng test React).
- [x] KHÔNG đụng index-service/FTS, export-service ngoài verify (mục Success Criteria).
- [x] Repo đang có vài file modified sẵn (DESIGN.md, example-vault/interactives/…) KHÔNG thuộc goal này — không revert, không commit chúng chung với công việc của goal.
- [x] Nếu gặp blocker: DỪNG và mô tả blocker, KHÔNG tự workaround.

---

## Success Criteria

- [x] Mở `example-vault/notes/Cache Hierarchy & Locality.mdx` trong app → render theme editorial (Playfair/Lora/Courier, palette ink/accent/result), primer, >=1 WidgetFrame + PredictionGate hoạt động: chọn option → không đổi được nữa → verdict hiện đúng/sai + explain → status badge đổi LOCKED→READY.
- [x] SelfTestItem: đáp án ẩn mặc định, bấm reveal mới hiện. EvidenceItem không có children → ô đỏ `[CHƯA CÓ]`.
- [x] Toàn bộ text nội dung của bản HTML gốc có mặt trong note MDX (đối chiếu theo section — không mất section nào).
- [x] Note thường (không có `theme:` frontmatter) render như trước goal — không regression.
- [x] ComponentInsertPalette hiện đủ các component mới với snippet chèn được và render hợp lệ ngay sau chèn.
- [x] Template `interactive-note.mdx` tạo note mới từ template được và render không lỗi.
- [x] Export note demo (chức năng export hiện có) không crash; ghi nhận trung thực mức fidelity của theme trong file export [ước lượng: CSS theme có thể chưa vào export — nếu thiếu, ghi rõ trong báo cáo, KHÔNG âm thầm bỏ qua].
- [x] Unit tests: commit-once logic của gate; zod schema của >=3 component (props hợp lệ pass, props sai fail). `bun test` xanh toàn bộ.
- [x] `bun run typecheck` pass; `bun run lint` không error mới.

---

## Execution Plan

1. Đọc source material: `docs/research/interactive-note-skill/` (SKILL.md, design-system.md, note-structure.md, js-patterns.md, note-cache-hierarchy-locality.html) + registry hiện có.
2. Thêm category `interactive-note` vào types; dựng CSS theme file (phần A component styles + phần B prose theme) từ design-system.md.
3. Implement components tĩnh trước: NotePrimer/PrimerTerm, HighlightBox, FormulaLine, MentalModel(+Row), TraceBlock, Recap, ComparisonBars + registry entries + snippets.
4. Implement components có state: WidgetFrame (context + status), PredictionGate (commit-once + verdict), SelfTest(+Item), EvidenceLog(+Item) + unit tests logic.
5. Wire frontmatter theme trong MdxPreview.
6. Viết template `interactive-note.mdx` + port demo note từ HTML gốc (fidelity từng section, chữ đi trước).
7. Viết `docs/interactive-note-authoring.md`.
8. Verify toàn bộ Success Criteria + Constraints, chạy test/typecheck/lint, báo cáo từng item, commit (conventional commits, có thể nhiều commit theo bước).

---

## Out of Scope

- Wiring PredictionGate ↔ `<Interactive>` iframe qua postMessage (gate unlock controls của island trong sandbox) — goal sau.
- Audit script (audits.md/audit.py) port sang MDX lint — goal sau.
- AI assistant tự sinh interactive note (prompt templates cho GOAL-06 flow) — goal sau.
- Ctrl+Click go-to-definition trong editor — GOAL-18.
- Sửa/đồng bộ skill bên ngoài (`~/.agents/skills/interactive-note`) — ngoài repo, user tự làm.
- Dark-mode variant đầy đủ cho theme editorial.

---

## References

- Source material: `docs/research/interactive-note-skill/*` (đặc biệt design-system.md — copy CSS values từ đây).
- Code đọc trước: `src/renderer/src/preview/registry/*`, `src/renderer/src/preview/islands/QuizBlock.tsx` (pattern island có state + registry entry + snippet), `src/renderer/src/preview/MdxPreview.tsx`, `src/renderer/src/preview/preview-metadata.ts`, `src/renderer/src/editor/ComponentInsertPalette.tsx`, `src/renderer/src/globals.css`, `example-vault/interactives/cache-stride/*`.
- [docs/mdx-conventions.md](../docs/mdx-conventions.md) — ba loại island; kit này là "Trusted component (registry)".

---

## Agent Instructions

1. Đọc toàn bộ file này trước khi làm bất kỳ thứ gì.
2. Tuân theo Constraints tuyệt đối — không có ngoại lệ.
3. Thực hiện Execution Plan theo thứ tự, báo cáo ngắn gọn sau mỗi bước.
4. Conflict giữa Constraints và Execution Plan → ưu tiên Constraints.
5. Gặp thứ không có trong GOAL: DỪNG và hỏi, không tự assume.
6. Khi xong: verify từng Success Criteria, đánh dấu checkbox, commit (conventional commits).
