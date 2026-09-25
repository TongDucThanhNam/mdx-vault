# GOAL-10 — Feature Gap Research (Competitor Analysis)

> File này được tạo tự động bởi create-goal skill.
> Agent thực thi: đọc toàn bộ file này trước khi làm bất kỳ thứ gì.
> Tuân thủ tuyệt đối [AGENTS.md](../AGENTS.md) + [docs/product-vision.md](../docs/product-vision.md).

---

## Objective

Research có hệ thống các tính năng mà mdx-vault **còn thiếu so với đối thủ** (Obsidian, Logseq, SiYuan, AppFlowy, Anytype, Notion, Typora/Zettlr), đối chiếu với hiện trạng codebase, và output **một báo cáo feature-gap có ưu tiên** tại `docs/research/feature-gap-2026-07.md` + đề xuất 2–3 goal file tiếp theo (GOAL-11+).

**Đây là RESEARCH goal — KHÔNG implement bất kỳ feature nào.** Deliverable là tài liệu, không phải code.

---

## Context

- **Lý do**: App đã qua prototype (GOAL-01→09: vault core, indexing/search, registry, islands, sandbox, AI assistant, export, UX shell, polish sprint) nhưng còn thiếu nhiều feature so với các note app trưởng thành. Cần một bản đồ gap đầy đủ trước khi quyết định làm gì tiếp, thay vì thêm feature theo cảm tính.
- **Phân biệt với research cũ**: GOAL-09 đã research 4 đối thủ nhưng chỉ ở mức **polish/ergonomics** (find-replace, tree sort, rename...). Goal này research ở mức **feature lớn** (graph view, daily notes, templates, tags panel, canvas, plugin system, sync, publish...).
- **Ưu tiên**: chất lượng phân tích > tốc độ. Mọi claim về đối thủ phải có link nguồn.
- **Người thực hiện**: AI Agent (báo cáo sau mỗi bước).
- **Ngày tạo**: 2026-07-09.

---

## Current State (feature inventory của mdx-vault)

> Agent PHẢI verify lại inventory này bằng cách đọc code trước khi so sánh — đây là `[ước lượng]` từ goal files, có thể lệch so với code thực tế.

| Nhóm | Đã có |
|------|-------|
| Vault core | Open/remember vault, file tree (create/delete/rename/duplicate/trash/sort), autosave, atomic write |
| Editor | CodeMirror 6, MDX syntax highlight, find-replace, word count, link autocomplete, image import, format toolbar, view modes (source/split/preview) |
| Knowledge layer | Wikilink `[[...]]`, tags (parse), backlinks panel, quick switcher, full-text search (FTS5) |
| Islands | Registry components (QuizBlock, EquationSlider, DataChart, AlgorithmVisualizer), sandboxed interactives (iframe + manifest permissions) |
| AI | Side panel, selected-text actions, diff/patch approval, compile-repair loop |
| Export | Static HTML + interactive HTML bundle, leak check |
| Khác | Dark mode, app settings persist |

### Chưa có (đã biết trước — vẫn phải đưa vào matrix để xếp hạng)

Graph view, daily notes/periodic notes, templates, tags panel/browser, note properties UI (frontmatter editor), outline/TOC panel, canvas/whiteboard, bookmarks/starred, workspaces/tab management, multi-pane, PDF annotation, web clipper, publish, sync (mọi loại), plugin system, spaced repetition, task/query engine (kiểu Dataview), i18n, mobile.

---

## Target State (deliverables)

| Deliverable | Nội dung |
|-------------|----------|
| `docs/research/feature-gap-2026-07.md` | Báo cáo chính: feature matrix + top-10 ưu tiên + phân tích |
| Feature matrix | ≥ 40 features × 7 đối thủ × mdx-vault, mỗi ô: có/không/partial, kèm link nguồn cho claim không hiển nhiên |
| Top-10 prioritized list | Mỗi feature: mô tả, đối thủ nào có, score (xem rubric), effort ước lượng, và **"fit với vision"** |
| Đề xuất goal | 2–3 draft objective cho GOAL-11+ (chỉ objective + scope 1 đoạn, KHÔNG viết full goal file) |
| Cập nhật `docs/roadmap.md` | Thêm section "Next candidates" trỏ tới báo cáo (chỉ thêm, không sửa nội dung cũ) |

### Scoring rubric (bắt buộc dùng)

`Score = Impact (1-5) × VisionFit (0-2) / Effort (1-5)`

- **Impact**: bao nhiêu % user thiếu nó sẽ bỏ app (table-stakes như graph view = 5; nice-to-have = 2)
- **VisionFit**: 2 = tăng cường MDX/islands positioning; 1 = trung tính (table-stakes note app); **0 = mâu thuẫn vision → loại khỏi top-10 dù đối thủ nào cũng có** (vd: block-based editor, realtime collab, AI auto-write toàn note)
- **Effort**: 1 = vài ngày; 5 = nhiều tuần / cần kiến trúc mới

---

## Research Plan (nguồn cụ thể)

### Đối thủ và lý do chọn

| Đối thủ | Research gì | Nguồn chính |
|---------|-------------|-------------|
| **Obsidian** | Chuẩn vàng — toàn bộ ~30 core plugins là checklist table-stakes | [obsidian.md/help/plugins](https://obsidian.md/help/plugins), [tier list 30 core plugins](https://practicalpkm.com/obsidian-core-plugins-tier-list/) |
| **Obsidian community plugins** | Top plugins phổ biến nhất = feature user thực sự cần (Dataview, Templater, Calendar, Kanban, Excalidraw, Periodic Notes) | [obsidian-releases GitHub](https://github.com/obsidianmd/obsidian-releases) — sort theo download count |
| **Logseq** | Outliner, journal/daily notes, task management native, PDF annotation, flashcards | Docs + GitHub |
| **SiYuan** | Block refs, spaced repetition built-in, local server/LAN access | GitHub README (feature list rất chi tiết) |
| **AppFlowy** | Database/board/calendar views, workspace model | GitHub |
| **Anytype** | Object model, E2E sync — tham khảo cho hướng sync sau này | Docs |
| **Notion** | Chỉ lấy UX patterns (slash menu, database views, templates gallery) — không phải local-first nên không so 1:1 | Web |
| **Typora / Zettlr / Bear** | Editor UX thuần: WYSIWYG-ish editing, focus mode, typewriter mode, export đa dạng | Web |

### Feature categories phải cover trong matrix

1. **Editor**: WYSIWYG/live-preview mode, tables editing, callouts, footnotes, math/KaTeX, mermaid, code block features, vim mode, focus/typewriter mode, spellcheck
2. **Organization**: daily/periodic notes, templates, tags panel, properties/frontmatter UI, bookmarks, folder note, aliases
3. **Navigation**: graph view (global + local), outline/TOC, tabs, split panes, breadcrumbs, recent files, hover preview
4. **Knowledge**: unlinked mentions, block references, embeds/transclusion `![[...]]`, queries/Dataview, canvas
5. **Capture**: web clipper, import từ app khác (Obsidian/Notion/Markdown), attachments management, audio/image paste
6. **Task/PKM**: checkbox/task queries, kanban, calendar, spaced repetition
7. **Distribution**: publish, sync (Git-based ưu tiên theo roadmap), version history, mobile/LAN access
8. **Platform**: plugin/extension system, theming, i18n, command palette đầy đủ, hotkey customization
9. **Riêng mdx-vault**: những gì đối thủ KHÔNG có mà ta có (islands, sandbox, MDX, AI diff-approval) — để biết moat và feature nào nên khuếch đại

---

## Constraints

> Agent PHẢI tuân theo tuyệt đối. Conflict với Execution Plan → ưu tiên Constraints.

- [ ] **KHÔNG implement bất kỳ feature nào.** Không viết code app, không thêm dependency, không sửa `src/`. Chỉ tạo/sửa file trong `docs/` và `goals/` (nếu được yêu cầu viết draft goal).
- [ ] **KHÔNG sửa nội dung goal file cũ** (GOAL-01→09) — chúng là lịch sử.
- [ ] Mọi claim "đối thủ X có feature Y" không hiển nhiên phải kèm link nguồn (docs chính thức hoặc GitHub ưu tiên hơn blog).
- [ ] Tôn trọng **anti-goals** trong [docs/product-vision.md](../docs/product-vision.md): KHÔNG đề xuất "AI tự viết toàn bộ note", KHÔNG đề xuất bỏ file-first/plain-text. Feature mâu thuẫn vision → ghi vào section "Rejected" kèm lý do, không đưa vào top-10.
- [ ] Tôn trọng ghi chú roadmap hiện tại: sync thì **Git trước, custom sync là bẫy**; marketplace chỉ sau khi sandbox vững.
- [ ] Top-10 phải dùng đúng scoring rubric ở trên — không xếp hạng theo cảm tính.
- [ ] Nếu không truy cập được nguồn nào → ghi `[cần xác nhận]` thay vì bịa.

---

## Success Criteria

Agent chỉ kết thúc task khi TẤT CẢ các tiêu chí sau đều pass:

- [ ] `docs/research/feature-gap-2026-07.md` tồn tại, có đủ 4 section: (1) methodology + nguồn, (2) feature matrix ≥ 40 features × 8 cột (7 đối thủ + mdx-vault), (3) top-10 prioritized với score tính rõ ràng theo rubric, (4) rejected features kèm lý do
- [ ] Current-state inventory đã được verify bằng cách đọc code thực tế (ghi rõ file evidence cho ít nhất các feature PARTIAL)
- [ ] Mỗi feature trong top-10 có: mô tả 2-3 câu, đối thủ reference, effort ước lượng, và ghi chú fit-với-MDX/islands
- [ ] Có 2–3 draft objective cho GOAL-11+ ở cuối báo cáo
- [ ] `docs/roadmap.md` có section "Next candidates" trỏ tới báo cáo (không sửa nội dung cũ)
- [ ] KHÔNG có thay đổi nào trong `src/`, `package.json`, `bun.lock`
- [ ] `bun run lint` vẫn pass (vì chỉ thêm markdown, criterion này gần như free — nhưng phải chạy để chắc chắn không phá gì)

---

## Execution Plan

> Thực hiện theo thứ tự. Báo cáo sau mỗi bước trước khi tiếp tục.

1. **Verify current state**: đọc `goals/GOAL-01→09` (phần Success Criteria đã tick) + grep nhanh `src/` để xác nhận feature inventory ở trên. Sửa inventory nếu lệch.
2. **Research Obsidian**: lấy full danh sách core plugins + top ~20 community plugins theo download. Đây là backbone của feature matrix.
3. **Research 4 đối thủ local-first** (Logseq, SiYuan, AppFlowy, Anytype): đọc feature list từ GitHub README/docs, bổ sung feature vào matrix.
4. **Research editor-UX apps** (Typora, Zettlr, Bear) + Notion UX patterns: bổ sung nhóm Editor/Capture.
5. **Build matrix**: tổng hợp thành bảng ≥ 40 features, đánh dấu có/không/partial cho từng app và cho mdx-vault (kèm evidence file path cho mdx-vault).
6. **Score & prioritize**: áp rubric, tính score, xếp top-10. Viết section Rejected cho feature bị loại vì VisionFit = 0.
7. **Viết báo cáo** `docs/research/feature-gap-2026-07.md` + draft 2–3 objective GOAL-11+.
8. **Cập nhật roadmap** + verify toàn bộ Success Criteria, báo cáo từng item.

---

## Out of Scope

- KHÔNG implement feature nào (kể cả "quick win 5 phút")
- KHÔNG viết full goal file cho GOAL-11+ (chỉ draft objective — user sẽ chạy create-goal riêng cho từng cái)
- KHÔNG research pricing/business model của đối thủ
- KHÔNG research mobile/collaboration sâu (đã nằm ngoài roadmap, chỉ ghi nhận sự tồn tại trong matrix)
- KHÔNG benchmark performance

---

## References

- [docs/product-vision.md](../docs/product-vision.md) — vision filter cho mọi đề xuất
- [docs/roadmap.md](../docs/roadmap.md) — section "Ngoài roadmap" là danh sách cần justify nếu muốn đưa vào top-10
- [goals/GOAL-09-polish-sprint.md](GOAL-09-polish-sprint.md) — research polish-level trước đó, tránh trùng lặp
- [Obsidian core plugins](https://obsidian.md/help/plugins)
- [obsidian-releases (community plugins + download stats)](https://github.com/obsidianmd/obsidian-releases)
- [Tier list 30 Obsidian core plugins](https://practicalpkm.com/obsidian-core-plugins-tier-list/)
- [Obsidian alternatives 2026 comparison](https://openalternative.co/alternatives/obsidian)
- Seed research (2026-07-09): 7 plugin "essential" của Obsidian user = Tasks, Dataview, Templater, Calendar, Kanban, Periodic Notes, QuickAdd; SiYuan nổi bật với block-refs + spaced repetition built-in; Logseq mạnh về journal/outliner/PDF annotation; Anytype mạnh về E2E sync.

---

## Agent Instructions

1. Đọc toàn bộ file này + AGENTS.md + docs/product-vision.md trước khi làm bất kỳ thứ gì
2. Tuân theo Constraints tuyệt đối — đặc biệt: ĐÂY LÀ RESEARCH GOAL, KHÔNG CODE
3. Thực hiện Execution Plan theo thứ tự, báo cáo sau mỗi bước
4. Nếu conflict giữa Constraints và Execution Plan: ưu tiên Constraints
5. Nguồn không truy cập được → `[cần xác nhận]`, không bịa
6. Khi xong: verify toàn bộ Success Criteria và báo cáo từng item
