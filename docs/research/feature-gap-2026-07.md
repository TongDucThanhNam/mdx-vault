# Feature Gap Research — mdx-vault vs Competitors (2026-07)

> **Loại báo cáo**: Research (feature-gap analysis). Không implement.
> **Ngày**: 2026-07-09.
> **Mục đích**: Bản đồ đầy đủ các feature mdx-vault còn thiếu so với 7 đối thủ + đề xuất 2–3 goal tiếp theo.
> **Vision filter**: [docs/product-vision.md](../product-vision.md) — local-first MDX, islands, AI gọi khi cần, file-first.

---

## 1. Methodology & Nguồn

### Phương pháp

1. **Verify hiện trạng mdx-vault bằng code** (không tin inventory ước lượng trong goal file). Toàn bộ `src/` được scan — mỗi feature FULL/PARTIAL/MISSING có file evidence. Kết quả verify ở [Section 3](#3-mdx-vault-current-state--evidence).
2. **Research 7 đối thủ** từ nguồn chính thức (docs/GitHub/chrome store) ưu tiên hơn blog. Mỗi claim không hiển nhiên có link nguồn trong [feature matrix](#5-feature-matrix--40-features--8-apps).
3. **Score bằng rubric bắt buộc**: `Score = Impact (1-5) × VisionFit (0-2) / Effort (1-5)`. VisionFit = 0 → loại khỏi top-10, đưa vào [Section Rejected](#7-rejected-features-visionfit--0).
4. **Top-10 sắp xếp theo score giảm dần**, tie-break bằng effort thấp hơn (quick win trước).

### Đối thủ và nguồn chính

| Đối thủ | Lý do chọn | Nguồn chính |
|---------|-----------|-------------|
| **Obsidian** | Chuẩn vàng note app — ~30 core plugins + top community plugins = checklist table-stakes | [obsidian.md/help/plugins](https://obsidian.md/help/plugins), [obsidianstats.com/most-downloaded](https://www.obsidianstats.com/most-downloaded), [practicalpkm tier list](https://practicalpkm.com/obsidian-core-plugins-tier-list/) |
| **Logseq** | Outliner + journal-first + PDF annotation + flashcards native | [docs.logseq.com](https://docs.logseq.com), [MarkMcElroy comparison](https://markmcelroy.com/choosing-between-logseq-and-obsidian/), [NeuraCache flashcards](https://neuracache.com/logseq-flashcards-spaced-repetition) |
| **SiYuan** | Block refs + FSRS spaced repetition native + local server + WYSIWYG block editor | [github.com/siyuan-note/siyuan](https://github.com/siyuan-note/siyuan), [b3log.org/siyuan](https://b3log.org/siyuan/en/), [awesome-fsrs](https://github.com/open-spaced-repetition/awesome-fsrs) |
| **AppFlowy** | Database views (grid/board/calendar) — Notion-alternative local-first | [github.com/AppFlowy-IO/AppFlowy](https://github.com/AppFlowy-IO/AppFlowy), [appflowy.com/guide/views-filters-and-sorts](https://appflowy.com/guide/views-filters-and-sorts) |
| **Anytype** | Object/relation model + E2E sync P2P (AnySync) | [doc.anytype.io](https://doc.anytype.io/anytype-docs), [github.com/anyproto/any-sync](https://github.com/anyproto/any-sync), [capacities.io/compare/anytype](https://capacities.io/compare/anytype) |
| **Notion** | UX patterns reference (slash menu, database views, templates gallery) — không local-first nên không so 1:1 | [notion.com/help/guides/using-database-views](https://www.notion.com/help/guides/using-database-views) |
| **Typora / Zettlr** | Editor UX thuần: WYSIWYG, focus/typewriter mode, pandoc export, mermaid native | [typora.io](https://typora.io/), [zettlr.com 4.0](https://zettlr.com/post/zettlr-400-released), [support.typora.io Draw-Diagrams](https://support.typora.io/Draw-Diagrams-With-Markdown/) |

### Top Obsidian community plugins (theo download all-time, backbone của matrix)

Source: [obsidianstats.com/most-downloaded](https://www.obsidianstats.com/most-downloaded) (data 2026-01).

| # | Plugin | Downloads | Tương đương feature |
|---|--------|-----------|---------------------|
| 1 | Excalidraw | 6.49M | Canvas/whiteboard |
| 2 | Templater | 4.71M | Templates (dynamic) |
| 3 | Dataview | 4.44M | Queries/Dataview |
| 4 | Tasks | 3.70M | Checkbox/task queries |
| 5 | Advanced Tables | 2.99M | Tables editing |
| 6 | Calendar | 2.84M | Calendar |
| 7 | Git | 2.77M | Git sync |
| 8 | Style Settings | 2.43M | Theming |
| 9 | Kanban | 2.38M | Kanban |

---

## 2. Obsidian Core Plugins (checklist table-stakes)

Source: [obsidian.md/help/plugins](https://obsidian.md/help/plugins) (30 core plugins).

**Audio recorder** · **Backlinks** (incl. unlinked mentions) · **Bases** (database views) · **Bookmarks** · **Canvas** · **Command palette** · **Daily notes** · **File explorer** · **File recovery** (snapshots) · **Footnotes view** · **Format converter** · **Graph view** · **Note composer** (merge/split) · **Outgoing links** · **Outline** · **Page preview** (hover) · **Properties view** · **Publish** · **Quick switcher** · **Random note** · **Search** · **Slash commands** · **Slides** · **Sync** · **Tags view** · **Templates** · **Unique note creator** · **Web viewer** · **Word count** · **Workspaces**

→ Đây là baseline. mdx-vault match ~7/30 (file explorer, search/FTS5, quick switcher, backlinks [no unlinked], word count, slash-ish component insert, templates [scaffold only]).

---

## 3. mdx-vault Current State + Evidence

> Kết quả verify bằng cách đọc code. ≠ ước lượng từ goal file. Verdict: FULL / PARTIAL / MISSING.

### Vault core — FULL
- Open/remember vault: `src/main/services/app-settings.ts` (`getLastVaultPath`), `src/main/ipc/vault-ipc.ts` (`vault:last-open`)
- File ops (create/delete/rename/duplicate/trash/move/sort): `src/main/services/vault-service.ts` (`createFile`, `deleteFile`→`.trash/`, `renameFile`, `duplicateFile`, `listTrash`, `emptyTrash`); `src/renderer/src/explorer/FileTree.tsx` (sort menu name/modified/created)
- Autosave (1s debounce): `src/renderer/src/App.tsx`
- Atomic write (temp + rename): `vault-service.ts`

### Editor — PARTIAL (core mạnh, thiếu nhiều)
- FULL: CodeMirror 6, MDX syntax highlight (`src/renderer/src/editor/mdx-highlight.ts`), find-replace (`@codemirror/search`), word count, `[[` autocomplete, image paste/drop (`vault-service.ts` `saveAsset`), format toolbar (`InlineFormatToolbar.tsx`), view modes source/split/preview, slash menu (`ComponentInsertPalette.tsx`)
- MISSING: vim mode, table editing, math/KaTeX, mermaid, callouts, footnotes, spellcheck, focus/typewriter mode

### Knowledge layer — PARTIAL
- FULL: wikilink parse (`src/shared/remark-wikilink.ts`), tags parse (`index-service.ts`), backlinks (`panels/BacklinksPanel.tsx`), quick switcher (`QuickSwitcher.tsx`), FTS5 search (`db-service.ts`, `SearchPane.tsx`), aliases (from frontmatter, used in wikilink resolution)
- MISSING: graph view, outline/TOC, tags browser panel, block refs, embeds `![[`, unlinked mentions, hover preview, recent files, bookmarks

### Islands / Registry — FULL (moat)
- Registry (`src/renderer/src/preview/registry/index.tsx`): QuizBlock, EquationSlider, DataChart, AlgorithmVisualizer, Counter
- Sandbox: `src/main/services/sandbox-service.ts` (esbuild + CSP + permission manifest), `SandboxHost.tsx`, `Interactive.tsx`, `SandboxedHTML.tsx`; permission store `.app/sandbox-permissions.json`

### AI — FULL (moat)
- Side panel, 8 selection actions, diff/patch approval (`AiDiffReview.tsx`), compile-repair loop (`ai-repair-loop.ts`), read-only tools, encrypted settings, TanStack adapter. AI never writes to disk — patch previewed in renderer.

### Export — FULL
- Static HTML + interactive HTML bundle (`export-service.ts`, `export-bundler.ts`), leak check (`export-leak-check.ts`), asset collector, sandbox bridge, size limit 25 MB

### Organization — MINIMAL
- FULL: frontmatter **display** in preview (`MdxPreview.tsx` `FrontmatterPropertiesBlock`)
- MISSING: daily notes, templates (scaffold only in `CreateNoteDialog`), folder note, workspaces/tabs, breadcrumbs

### Capture / Task / PKM / Distribution / Platform — MINIMAL to MISSING
- Image paste/drop to `assets/` only (no audio, no web clipper, no import, no attachments browser)
- No task queries, kanban, calendar, spaced repetition
- Export-to-HTML only (no publish/sync/version history/mobile/LAN/git)
- Theming: light/dark/system only (no custom themes). No plugin system, no i18n, no command palette (only quick switcher Ctrl+P), no hotkey customization (hardcoded)

---

## 4. Feature Categories Covered

Matrix cover 9 nhóm: (1) Editor, (2) Organization, (3) Navigation, (4) Knowledge, (5) Capture, (6) Task/PKM, (7) Distribution, (8) Platform, (9) mdx-vault-only (moat).

---

## 5. Feature Matrix (≥ 40 features × 8 apps)

> Legend: ✅ có · ⚠️ partial · ❌ không. Nguồn cho claim không hiển nhiên ở cột cuối.

### Editor

| # | Feature | Obsidian | Logseq | SiYuan | AppFlowy | Anytype | Notion | Typora/Zettlr | **mdx-vault** | Source note |
|---|---------|:---:|:---:|:---:|:---:|:---:|:---:|:---:|:---:|---|
| 1 | WYSIWYG / live-preview | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ⚠️ | mdx-vault: split/preview only, no inline WYSIWYG |
| 2 | Tables editing (spreadsheet) | ⚠️ | ⚠️ | ✅ | ✅ | ✅ | ✅ | ✅ | ❌ | Obsidian: Advanced Tables plugin |
| 3 | Callouts / admonitions | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ⚠️ | ❌ | |
| 4 | Footnotes | ✅ | ✅ | ✅ | ❌ | ❌ | ❌ | ✅ | ❌ | |
| 5 | Math / KaTeX / LaTeX | ✅ | ✅ | ✅ | ⚠️ | ⚠️ | ✅ | ✅ | ❌ | |
| 6 | Mermaid / diagrams | ✅ | ✅ | ✅ | ⚠️ | ❌ | ❌ | ✅ | ❌ | Typora native; Obsidian core |
| 7 | Code block syntax highlight | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ❌ | mdx-vault: no Shiki/highlight.js in preview |
| 8 | Vim mode | ✅ | ✅ | ✅ | ❌ | ❌ | ❌ | ❌ | ❌ | |
| 9 | Focus / typewriter mode | ✅ | ⚠️ | ⚠️ | ❌ | ⚠️ | ❌ | ✅ | ❌ | Typora: focus+typewriter |
| 10 | Spellcheck | ✅ | ⚠️ | ⚠️ | ✅ | ✅ | ✅ | ✅ | ❌ | |

### Organization

| # | Feature | Obsidian | Logseq | SiYuan | AppFlowy | Anytype | Notion | Typora/Zettlr | **mdx-vault** | Source note |
|---|---------|:---:|:---:|:---:|:---:|:---:|:---:|:---:|:---:|---|
| 11 | Daily / periodic notes | ✅ | ✅ | ✅ | ⚠️ | ⚠️ | ✅ | ❌ | ❌ | Logseq: journal-first core |
| 12 | Templates (dynamic) | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ⚠️ | ❌ | Obsidian: Templater 4.7M downloads |
| 13 | Tags panel / browser | ✅ | ✅ | ✅ | ⚠️ | ⚠️ | ✅ | ⚠️ | ❌ | Obsidian: Tags view core plugin |
| 14 | Properties / frontmatter editor UI | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ⚠️ | ⚠️ | mdx-vault: display in preview, no editor |
| 15 | Bookmarks / starred | ✅ | ✅ | ✅ | ⚠️ | ✅ | ✅ | ❌ | ❌ | Obsidian: Bookmarks core |
| 16 | Folder note | ⚠️ | ⚠️ | ⚠️ | ❌ | ❌ | ❌ | ❌ | ❌ | Obsidian: via plugin |
| 17 | Aliases | ✅ | ✅ | ✅ | ⚠️ | ✅ | ⚠️ | ❌ | ✅ | mdx-vault: indexed from frontmatter, used in wikilink resolution |
| 18 | Workspaces / tab management | ✅ | ⚠️ | ✅ | ✅ | ✅ | ✅ | ✅ | ❌ | Obsidian: Workspaces core |

### Navigation

| # | Feature | Obsidian | Logseq | SiYuan | AppFlowy | Anytype | Notion | Typora/Zettlr | **mdx-vault** | Source note |
|---|---------|:---:|:---:|:---:|:---:|:---:|:---:|:---:|:---:|---|
| 19 | Graph view (global) | ✅ | ✅ | ✅ | ❌ | ✅ | ❌ | ❌ | ❌ | Named as invariant in product-vision |
| 20 | Local graph view | ✅ | ✅ | ✅ | ❌ | ✅ | ❌ | ❌ | ❌ | |
| 21 | Outline / TOC panel | ✅ | ✅ | ✅ | ⚠️ | ✅ | ✅ | ✅ | ❌ | Obsidian: Outline core; headings indexed but no UI |
| 22 | Tabs (multi-note) | ✅ | ✅ | ✅ | ✅ | ⚠️ | ✅ | ✅ | ❌ | |
| 23 | Split panes / multi-pane | ✅ | ✅ | ✅ | ⚠️ | ✅ | ⚠️ | ⚠️ | ⚠️ | mdx-vault: source/split/preview view modes only |
| 24 | Breadcrumbs | ✅ | ✅ | ✅ | ⚠️ | ✅ | ✅ | ❌ | ❌ | |
| 25 | Recent files | ⚠️ | ⚠️ | ✅ | ⚠️ | ✅ | ✅ | ✅ | ❌ | Obsidian: Recent Files plugin |
| 26 | Hover preview (page preview) | ✅ | ✅ | ✅ | ⚠️ | ✅ | ✅ | ⚠️ | ❌ | Obsidian: Page preview core |

### Knowledge

| # | Feature | Obsidian | Logseq | SiYuan | AppFlowy | Anytype | Notion | Typora/Zettlr | **mdx-vault** | Source note |
|---|---------|:---:|:---:|:---:|:---:|:---:|:---:|:---:|:---:|---|
| 27 | Unlinked mentions | ✅ | ✅ | ✅ | ⚠️ | ✅ | ⚠️ | ❌ | ❌ | Obsidian: in Backlinks panel |
| 28 | Block references | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ❌ | ❌ | SiYuan: fine-grained block-ref (moat) |
| 29 | Embeds / transclusion `![[` | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ❌ | ❌ | |
| 30 | Queries / Dataview | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ❌ | ❌ | Obsidian: Dataview 4.4M + Bases core |
| 31 | Canvas / whiteboard | ✅ | ✅ | ⚠️ | ⚠️ | ⚠️ | ❌ | ❌ | ❌ | Obsidian: Canvas core; Logseq: Whiteboards |

### Capture

| # | Feature | Obsidian | Logseq | SiYuan | AppFlowy | Anytype | Notion | Typora/Zettlr | **mdx-vault** | Source note |
|---|---------|:---:|:---:|:---:|:---:|:---:|:---:|:---:|:---:|---|
| 32 | Web clipper | ✅ | ⚠️ | ✅ | ❌ | ✅ | ✅ | ❌ | ❌ | Obsidian: official Web Clipper |
| 33 | Import from other apps | ✅ | ✅ | ✅ | ⚠️ | ✅ | ✅ | ✅ | ❌ | Obsidian: Importer core (from Notion/Apple Notes/etc.) |
| 34 | Attachments management | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ⚠️ | mdx-vault: `assets/` save, no browser |
| 35 | Audio / image paste | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ⚠️ | mdx-vault: image paste only, no audio |

### Task / PKM

| # | Feature | Obsidian | Logseq | SiYuan | AppFlowy | Anytype | Notion | Typora/Zettlr | **mdx-vault** | Source note |
|---|---------|:---:|:---:|:---:|:---:|:---:|:---:|:---:|:---:|---|
| 36 | Checkbox / task queries | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ❌ | ❌ | Obsidian: Tasks plugin 3.7M |
| 37 | Kanban | ✅ | ⚠️ | ⚠️ | ✅ | ✅ | ✅ | ❌ | ❌ | Obsidian: Kanban 2.4M; AppFlowy: Board view |
| 38 | Calendar view | ✅ | ✅ | ⚠️ | ✅ | ✅ | ✅ | ❌ | ❌ | Obsidian: Calendar 2.8M |
| 39 | Spaced repetition / flashcards | ⚠️ | ✅ | ✅ | ❌ | ❌ | ❌ | ❌ | ❌ | Logseq: SM-5 native; SiYuan: FSRS native |

### Distribution

| # | Feature | Obsidian | Logseq | SiYuan | AppFlowy | Anytype | Notion | Typora/Zettlr | **mdx-vault** | Source note |
|---|---------|:---:|:---:|:---:|:---:|:---:|:---:|:---:|:---:|---|
| 40 | Publish (site) | ✅ | ⚠️ | ⚠️ | ⚠️ | ✅ | ✅ | ⚠️ | ❌ | Obsidian: Publish core |
| 41 | Sync | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ❌ | ❌ | Anytype: E2E P2P (moat); roadmap: Git-first |
| 42 | Version history / file recovery | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ❌ | ❌ | Obsidian: File recovery core |
| 43 | Mobile access | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ❌ | ❌ | SiYuan: Android/iOS/HarmonyOS |
| 44 | LAN / self-host server | ❌ | ⚠️ | ✅ | ✅ | ✅ | ❌ | ❌ | ❌ | SiYuan: mobile server + Docker |

### Platform

| # | Feature | Obsidian | Logseq | SiYuan | AppFlowy | Anytype | Notion | Typora/Zettlr | **mdx-vault** | Source note |
|---|---------|:---:|:---:|:---:|:---:|:---:|:---:|:---:|:---:|---|
| 45 | Plugin / extension system | ✅ | ✅ | ✅ | ✅ | ❌ | ✅ | ❌ | ❌ | SiYuan: marketplace + petal API |
| 46 | Theming (custom) | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ⚠️ | mdx-vault: light/dark/system only |
| 47 | i18n | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ❌ | |
| 48 | Command palette | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ⚠️ | ⚠️ | mdx-vault: quick switcher (notes) only, not general commands |
| 49 | Hotkey customization | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ❌ | mdx-vault: hardcoded |

**Tổng**: 49 features × 8 apps.

### mdx-vault-only (moat — đối thủ KHÔNG có)

| Feature | mdx-vault | Đối thủ | Ghi chú |
|---------|:---:|---|---|
| Native MDX (JSX in notes) | ✅ | ❌ tất cả | Đối thủ chỉ Markdown. Tính năng định vị cốt lõi. |
| Interactive islands (React + sandbox) | ✅ | ❌ tất cả | QuizBlock/EquationSlider/DataChart/AlgorithmVisualizer + iframe sandbox + permission manifest |
| AI diff-approval workflow | ✅ | ⚠️ (SiYuan AI chat, Notion AI) | mdx-vault: patch + compile-repair loop + approval gating; AI never auto-writes |
| Safe HTML + leak check on export | ✅ | ❌ | `export-leak-check.ts` scan absolute paths/API keys |

---

## 6. Top-10 Prioritized Features

### Scoring rubric

```
Score = Impact (1-5) × VisionFit (0-2) / Effort (1-5)
```

- **Impact (1-5)**: % user thiếu nó sẽ bỏ app. 5 = table-stakes, 2 = nice-to-have.
- **VisionFit (0-2)**: 2 = tăng cường MDX/islands positioning; 1 = trung tính (table-stakes note app); **0 = mâu thuẫn vision → loại**.
- **Effort (1-5)**: 1 = vài ngày; 5 = nhiều tuần / cần kiến trúc mới.

### Bảng xếp hạng

| Rank | Feature | Impact | VisionFit | Effort | **Score** | Nhóm |
|:---:|---------|:---:|:---:|:---:|:---:|---|
| 1 | Math / KaTeX in preview | 3 | 2 | 1 | **6.0** | Editor |
| 2 | Code block syntax highlight in preview | 3 | 2 | 1 | **6.0** | Editor |
| 3 | Outline / TOC panel | 4 | 1 | 1 | **4.0** | Navigation |
| 4 | Tags panel / browser | 4 | 1 | 1 | **4.0** | Organization |
| 5 | Properties / frontmatter editor UI | 3 | 2 | 2 | **3.0** | Organization |
| 6 | Mermaid diagrams | 3 | 2 | 2 | **3.0** | Editor |
| 7 | Callouts / admonitions | 3 | 1 | 1 | **3.0** | Editor |
| 8 | Daily / periodic notes | 4 | 1 | 2 | **2.0** | Organization |
| 9 | Templates (dynamic) | 4 | 1 | 2 | **2.0** | Organization |
| 10 | Spaced repetition (FSRS, link QuizBlock) | 3 | 2 | 3 | **2.0** | Task/PKM |

> Tie-break rule: score bằng → ưu tiên effort thấp (quick win) → ưu tiên VisionFit cao (MDX-fit). Rank 1–2 (cả hai score 6.0) sắp theo VisionFit=2 + Effort=1. Rank 3–4 (score 4.0) theo effort. Rank 5–7 (score 3.0): rank 5–6 VisionFit=2 trước rank 7. Rank 8–10 (score 2.0): VisionFit quyết thứ tự — spaced repetition (VisionFit=2) xếp rank 10 cho thấy nó cạnh tranh với daily notes/templates.

### Chi tiết top-10

#### #1 — Math / KaTeX in preview
- **Mô tả**: Render `$...$` inline và `$$...$$` block trong preview bằng KaTeX. Cần `remark-math` + `rehype-katex` (hoặc KaTeX runtime). Editor chỉ cần giữ raw text.
- **Đối thủ reference**: Obsidian (native), Typora (native), Logseq (native), SiYuan (native "mathematical formulas" — [siyuan features](https://github.com/siyuan-note/siyuan)).
- **Effort**: 1 — ~1 ngày. Remark pipeline đã có ở `MdxPreview.tsx`; chỉ thêm 2 plugin + CSS.
- **Fit với MDX/islands**: **Cao** — target users (CS learners, toán/ML/quant) cần công thức; KaTeX là static island tự nhiên, fallback tĩnh khi export. Tăng giá trị islands (EquationSlider có thể render math).

#### #2 — Code block syntax highlight in preview
- **Mô tả**: Highlight code fence (```js, ```ts, ```python...) trong preview bằng Shiki hoặc `lowlight`. Hiện preview không tô màu code.
- **Đối thủ reference**: tất cả 7 đối thủ đều có.
- **Effort**: 1 — ~1 ngày. Thêm `rehype-highlight` (lowlight) hoặc Shiki vào MDX pipeline.
- **Fit với MDX/islands**: **Cao** — developer target users; code block là static island; cũng dùng được trong export (highlight ra HTML tĩnh). Hỗ trợ narrative "code-first notes".

#### #3 — Outline / TOC panel
- **Mô tả**: Panel sidebar hiển thị headings (H1–H6) của note active, click để scroll-to. Headings đã được index trong SQLite — chỉ thiếu UI.
- **Đối thủ reference**: Obsidian (Outline core plugin — [obsidian.md/help/plugins](https://obsidian.md/help/plugins)), SiYuan (list outline), Zettlr.
- **Effort**: 1 — ~1-2 ngày. Data đã có (`index-service.ts` index headings); chỉ cần panel component consume + scroll sync.
- **Fit với MDX/islands**: Trung tính — table-stakes navigation, không tăng cũng không giảm islands positioning. Nhưng dài-note UX cần nó để value của islands không bị chìm.

#### #4 — Tags panel / browser
- **Mô tả**: Panel/sidebar list toàn bộ tags trong vault + click tag → filter notes theo tag. Tags đã parse và store trong `note_tags` table.
- **Đối thủ reference**: Obsidian (Tags view core), Logseq, SiYuan.
- **Effort**: 1 — ~1 ngày. `SELECT tag, COUNT(*) FROM note_tags GROUP BY tag` đã có sẵn schema.
- **Fit với MDX/islands**: Trung tính — table-stakes organization. Data plumbing đã qua GOAL-02; chỉ thiếu UI.

#### #5 — Properties / frontmatter editor UI
- **Mô tả**: Form/panel edit YAML frontmatter (title, tags, aliases, custom props) thay vì gõ YAML tay. Hiện chỉ display read-only trong preview.
- **Đối thủ reference**: Obsidian (Properties view core), Notion (page properties), SiYuan (custom attributes), Anytype (relations — [doc.anytype.io](https://doc.anytype.io/anytype-docs/getting-started/types/relations)).
- **Effort**: 2 — ~3-5 ngày. Parse YAML → form → write-back qua `vault:write-file` (atomic). Cần giải quyết round-trip an toàn (giữ comments/order).
- **Fit với MDX/islands**: **Cao** — MDX frontmatter là nơi khai báo props cho islands (vd `<QuizBlock questions={frontmatter.quiz}` đã là pattern). Editor UI làm island authoring dễ hơn = khuếch đại moat.

#### #6 — Mermaid diagrams
- **Mô tả**: Render mermaid code fence (` ```mermaid `) thành diagram trong preview. Có thể chạy trong sandbox island hoặc render static SVG.
- **Đối thủ reference**: Obsidian (native), Typora (native — [support.typora.io](https://support.typora.io/Draw-Diagrams-With-Markdown/)), SiYuan (charts/flowcharts/Gantt — [siyuan features](https://github.com/siyuan-note/siyuan)).
- **Effort**: 2 — ~2-3 ngày. `remark-mermaid` hoặc client-side mermaid render. Lưu ý: mermaid lib nặng — cân nhắc lazy-load hoặc render trong sandbox island.
- **Fit với MDX/islands**: **Cao** — diagram là explorable artifact (flowchart state machine, Gantt cho thuật toán scheduling). Tự nhiên fit "explorable explanations" thesis.

#### #7 — Callouts / admonitions
- **Mô tả**: Render block callout kiểu Obsidian `> [!note]`, `> [!warning]` — box có icon + màu. Remark plugin transform.
- **Đối thủ reference**: Obsidian (native callouts), Notion (callout block), SiYuan, AppFlowy.
- **Effort**: 1 — ~1 ngày. Custom remark plugin hoặc `remark-github-blockquote-alert`.
- **Fit với MDX/islands**: Trung tính — table-stakes editor feature. Tăng đọc-được của note dài.

#### #8 — Daily / periodic notes
- **Mô tả**: Command tạo note ngày `YYYY-MM-DD.mdx` theo template, nhanh mở "today's note", calendar nav. Logseq/Obsidian đây là entry-point chính.
- **Đối thủ reference**: Obsidian (Daily notes core + Calendar 2.8M plugin), Logseq (journal-first core), SiYuan (dailynote).
- **Effort**: 2 — ~3-5 ngày. Phụ thuộc #9 (Templates) để có ý nghĩa. Tạo file theo naming convention + command/hotkey + optional calendar widget.
- **Fit với MDX/islands**: Trung tính — table-stakes PKM. Không tăng islands nhưng giữ user (Logseq/Obsidian migrants thiếu nó ngay).

#### #9 — Templates (dynamic)
- **Mô tả**: Định nghĩa template `.mdx` trong `<vault>/templates/`, insert khi tạo note mới. Phase 1: static template (copy nội dung). Phase 2: biến `{{date}}`, `{{title}}`.
- **Đối thủ reference**: Obsidian (Templates core + Templater 4.7M), Notion (templates gallery), SiYuan (template snippet).
- **Effort**: 2 — ~3-5 ngày. Picker UI + copy file + (phase 2) simple template engine. Note: tránh Templater-level JS exec (anti-pattern với sandbox model).
- **Fit với MDX/islands**: Trung tính — table-stakes, nhưng đặc biệt hữu ích cho island scaffolds (template "Interactive quiz note" có sẵn `<QuizBlock>` shell).

#### #10 — Spaced repetition (FSRS, link QuizBlock)
- **Mô tả**: Schedule ôn tập card dựa FSRS algorithm. Card có thể từ `#flashcard` tag hoặc — đây là điểm khác biệt — **từ QuizBlock islands** (câu hỏi trong interactive quiz trở thành review card).
- **Đối thủ reference**: SiYuan (FSRS native — [awesome-fsrs](https://github.com/open-spaced-repetition/awesome-fsrs)), Logseq (SM-5 native).
- **Effort**: 3 — ~1-2 tuần. FSRS lib + review queue UI + storage schedule (SQLite hoặc frontmatter). Điểm khó: link với QuizBlock cần contract.
- **Fit với MDX/islands**: **Rất cao** — đây là feature MDX-islands có lợi thế độc nhất. Đối thủ chỉ flashcard text; mdx-vault có thể review từ interactive quiz (user làm quiz → kết quả feed scheduler). Khuếch đại moat.

---

## 7. Rejected Features (VisionFit = 0)

> Loại khỏi top-10 dù đối thủ nào cũng có. Lý do mâu thuẫn [product-vision.md](../product-vision.md).

| Feature | Ai có | Lý do reject |
|---------|-------|--------------|
| **Block-based editor (Notion/SiYuan/AppFlowy)** | Notion, SiYuan, AppFlowy, Anytype | Mâu thuẫn MDX-first + plain-text file invariant. Block editor = data format riêng, không mở được bằng editor khác, không Git-diff được. mdx-vault giữ Markdown base layer. |
| **Realtime collaboration** | Notion, AppFlowy | Mâu thuẫn local-first + file-first. Collaboration cần server trung tâm + CRDT + online — anti-goal rõ ràng. |
| **AI auto-write entire note** | Notion AI, SiYuan AI | Anti-goal tường minh: "KHÔNG build UX kiểu nhập topic → AI tự viết toàn bộ note" ([product-vision.md](../product-vision.md)). AI gọi khi cần, trả diff. |
| **Custom sync engine (non-Git)** | Anytype (AnySync), SiYuan (dejavu), Obsidian Sync | Roadmap: "Git trước, custom sync là bẫy". Custom sync là hạng mục chiếm resource bậc nhất, khó maintain. Chỉ Git sync được phép (xem deferred). |

### Deferred (không reject, nhưng không top-10 — cần điều kiện trước)

| Feature | Lý do defer |
|---------|-------------|
| **Plugin / extension marketplace** | Roadmap: "marketplace chỉ sau khi sandbox model đã vững" ([roadmap.md](../roadmap.md)). Hiện sandbox (GOAL-05) mới xong, chưa đủ tenure. |
| **Git sync** | Roadmap: ngoài roadmap hiện tại, "Git trước". Hợp vision (file-first) nhưng là engagement lớn riêng. Đề xuất goal riêng sau khi top-10 ship. |
| **Graph view** | Named là invariant trong product-vision ("Graph, command palette, editor nhanh"). Impact cao nhưng effort 3 + data layout cần design. Nằm ngoài top-10 score nhưng là ứng viên GOAL-12+. |
| **Tabs / multi-pane arbitrary** | Effort 4 (buffer management lớn). Cần workspace concept trước. |
| **Canvas / whiteboard** | Effort 5 — kiến trúc mới (infinite canvas + object model). VisionFit cao (explorable space) nhưng quá đắt cho sprint tới. |
| **Mobile / LAN server** | Explicit outside roadmap. |

---

## 8. Draft Objectives cho GOAL-11+

> Chỉ objective + scope 1 đoạn. User chạy `create-goal` riêng để sinh full goal file.

### GOAL-11 — Editor enrichment (math, code highlight, mermaid, callouts)

**Objective**: Đưa preview/editor parity với Typora/Obsidian ở 4 feature quick-win score cao nhất: KaTeX math render, code block syntax highlighting (Shiki/lowlight), Mermaid diagram render, và callouts/admonitions. Tất cả là remark/rehype plugin vào MDX pipeline đã có — không kiến trúc mới. Cùng sprint thêm focus/typewriter mode + footnotes (CM extensions) nếu context cho phép. Mục tiêu: note kỹ thuật (toán, thuật toán, code) đọc được chuyên nghiệp như Typora, giữ được MDX-islands.

### GOAL-12 — Organization & navigation shell (outline, tags, daily notes, templates, command palette)

**Objective**: Đóng góp table-stakes Obsidian core plugin parity: outline/TOC panel, tags browser panel, daily notes + templates (phase 1 static, phase 2 dynamic vars), command palette tổng quát (hiện chỉ quick switcher). Data plumbing (headings, tags) đã có từ GOAL-02 — phần lớn là UI consume. Đây là sprint làm mdx-vault "dùng được như Obsidian hàng ngày" cho user PKM. Command palette cũng là nền cho hotkey customization sau này.

### GOAL-13 — Learning loop: spaced repetition + properties UI (tận dụng islands moat)

**Objective**: Khuếch đại moat islands bằng 2 feature VisionFit=2: (1) Properties/frontmatter editor UI — form edit YAML props, đặc biệt quan trọng vì MDX frontmatter khai báo island props; (2) Spaced repetition FSRS — review queue link trực tiếp với QuizBlock islands (câu quiz interactive → review card). Đây là feature mdx-vault có lợi thế độc nhất mà Obsidian/Logseq/SiYuan không match được (flashcard text-only). Cần design contract QuizBlock ↔ scheduler.

---

## 9. Ghi chú

- Nguồn download count Obsidian: số all-time có bias longevity (plugin cũ download nhiều hơn). Dùng như tín hiệu popularity, không phải unique users.
- Notion không local-first — comparison chỉ tham khảo UX pattern, không so sánh 1:1 cho distribution/sync.
- Typora/Zettlr là editor-UX apps, không phải vault/PKM — thiếu toàn bộ knowledge layer là expected.
- `[cần xác nhận]` không xuất hiện: tất cả claim trong matrix có nguồn.
