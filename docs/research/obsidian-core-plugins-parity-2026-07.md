# Obsidian Core Plugins Parity — Micro-feature Audit (2026-07-10)

> **Loại báo cáo**: Research (parity audit, mức micro-feature). Không implement.
> **Bổ sung cho**: [feature-gap-2026-07.md](feature-gap-2026-07.md) — bản đó so 7 đối thủ ở mức "feature có/không" và đã **stale một phần** (viết trước khi GOAL-11/12 ship: outline, tags panel, command palette, mermaid, callouts, KaTeX, code highlight, templates, daily note giờ ĐÃ có).
> **Câu hỏi trả lời**: mdx-vault đang thiếu chính xác những micro-feature nào so với 30 Core Plugins của Obsidian?

---

## 1. Methodology — cách research micro-feature một cách hệ thống

Obsidian không có một trang nào liệt kê hết micro-features. Phải khai thác 4 lớp nguồn, từ thô đến mịn:

### Lớp 1 — Danh sách 30 core plugins (checklist khung)
[obsidian.md/help/plugins](https://obsidian.md/help/plugins) — mỗi plugin 1 dòng mô tả. Đây là khung xương, chưa phải micro-features.

### Lớp 2 — Trang help riêng của TỪNG plugin (nguồn micro-feature chính) ⭐
Mỗi core plugin có trang `obsidian.md/help/plugins/<slug>` liệt kê đầy đủ sub-features, settings, commands, modifier keys, edge behaviors. Ví dụ trang Backlinks documente cả "unlinked mentions", "show more context", "search filter", "toggle backlinks in document" — 4 micro-features mà nhìn từ lớp 1 chỉ thấy chữ "Backlinks".

**Cách khai thác hiệu quả nhất**: toàn bộ help site là repo Markdown open-source —
```
git clone https://github.com/obsidianmd/obsidian-help
# → en/Plugins/*.md — grep/đọc offline toàn bộ, không cần crawl
```

### Lớp 3 — Settings pages (micro-features dạng toggle/option)
[obsidian.md/help/settings](https://obsidian.md/help/settings) → 5 tab Options (General, Editor, Files & links, Appearance, Hotkeys). Rất nhiều "micro-feature" của Obsidian thực chất là settings toggle: readable line length, strict line breaks, auto-pair brackets, smart lists, spellcheck, vim mode, new link format, deleted-files destination, accent color, CSS snippets, font per-purpose, hotkey editor…

### Lớp 4 — Command inventory (mịn nhất, ít ai làm)
Mỗi command trong Obsidian là một micro-feature có tên. Cách dump toàn bộ (~200+ commands):
- Mở Obsidian → Settings → **Hotkeys** → danh sách này chính là inventory đầy đủ mọi command của core plugins đang bật; hoặc
- DevTools console: `app.commands.listCommands().map(c => c.name)` → paste ra file.

So sánh: mdx-vault hiện có **13 commands** ([App.tsx:857-963](../../src/renderer/src/App.tsx)). Đây là con số nói lên khoảng cách "micro-feature" rõ nhất.

### Lớp 5 — Interaction behaviors (nhỏ hơn cả command: chuột phải, kéo-thả, paste, phím) ⭐⭐
Những behavior này KHÔNG có trang riêng — chúng rải rác trong help vault. Cách duy nhất quét hết là **grep repo help theo động từ tương tác**:

```bash
git clone --depth 1 --filter=blob:none --sparse https://github.com/obsidianmd/obsidian-help
cd obsidian-help && git sparse-checkout set en
grep -rin "right-click\|context menu" en/   # → ma trận context menu theo surface
grep -rin "drag\|drop" en/                  # → ma trận drag & drop
grep -rin "paste\|hold .*Ctrl\|press and hold" en/  # → paste + modifier behaviors
```

Các trang đặc biệt đáng đọc trọn: `User interface/Drag and drop.md`, `User interface/Hotkeys.md`, `Editing and formatting/Editing shortcuts.md` (bảng đầy đủ shortcut mặc định), `Editing and formatting/Attachments.md`, `User interface/Tabs.md`. Kết quả grep này là nguồn cho [Section 4](#4-interaction-level-micro-behaviors--l%E1%BB%9Bp-5). Lớp cuối cùng không doc hoá được: mở app thật, right-click **từng surface một** và chụp lại — mỗi surface trong Obsidian có menu khác nhau.

### Quy tắc verify
Mỗi mục phải đối chiếu bằng code với file evidence, verdict FULL / PARTIAL / MISSING. Không tin doc cũ (bản 2026-07-09 đã lệch thực tế sau GOAL-11/12).

---

## 2. Scorecard tổng — 30 core plugins

| # | Core plugin | mdx-vault | Evidence / thiếu gì |
|---|-------------|:---:|---|
| 1 | File explorer | ✅ | `FileTree.tsx` — create/rename/duplicate/trash/move/sort |
| 2 | Search | ⚠️ | `SearchPane.tsx` + `DbService.search()` now support free text with `tag:`, `path:`, `file:`, and bounded `/regex/` operators plus visible invalid-regex errors. Still missing broader Obsidian operators (`line:` `section:` `block:` `task:` `[property:value]`), copy/history/embed-query polish |
| 3 | Quick switcher | ⚠️ | `QuickSwitcher.tsx` now shows recent notes for empty query, visible alias matches, and create-from-switcher without overwrite. Still missing tab/new-pane behavior (`Ctrl+Enter`) because mdx-vault has no tabs yet |
| 4 | Command palette | ⚠️ | `CommandPalette.tsx` now supports persistent pinned commands, recent-on-top empty-query ordering, and hotkey labels. Still far fewer commands than Obsidian and no hotkey editor/settings UI |
| 5 | Backlinks | ⚠️ | `BacklinksPanel.tsx` now separates linked/unlinked mentions, shows context snippets, and supports filter/sort. Still missing backlinks-in-document and one-click linkification |
| 6 | Outgoing links | ❌ | Chưa có panel. Gồm: links của note active + unlinked mentions chiều đi + nút "link hoá" 1-click |
| 7 | Outline | ✅ | `OutlinePanel.tsx` (GOAL-12) |
| 8 | Tags view | ✅ | `TagsPanel.tsx` (GOAL-12) |
| 9 | Templates | ⚠️ | `vault-service.ts` supports `{{title}}`, `{{date}}`, `{{time}}`, plus allowlisted `{{date:FORMAT}}` / `{{time:FORMAT}}`; templates can be inserted at the editor cursor through command/slash surfaces. Still missing configurable template folder |
| 10 | Daily notes | ⚠️ | Command `note.daily` + template `templates/daily.mdx` (hardcode). Thiếu: setting date format / folder (vd `YYYY/MMMM/…`), auto-link date, prev/next day nav |
| 11 | Word count | ✅ | `App.tsx:849` words/chars/reading time. (Obsidian thêm: count theo selection) |
| 12 | Page preview (hover) | ❌ | Hover `[[link]]` → popup render note. Áp dụng cả trong FileTree/Search/Backlinks. Modifier `Ctrl` khi hover trong editor |
| 13 | Bookmarks | ❌ | Bookmark file/folder/search/heading/block, groups, drag reorder, panel riêng |
| 14 | Properties view | ⚠️ | Chỉ **display** frontmatter trong preview (`MdxPreview.tsx`). Thiếu: form edit properties của note active, panel "All properties" toàn vault (sort theo tần suất, click → search, rename global) |
| 15 | File recovery | ❌ | Đã có autosave + atomic write nhưng **không có snapshot history**: snapshot mỗi ≥5', giữ 7 ngày, diff view, restore/copy. (Điểm khác Obsidian: lưu ngoài vault) |
| 16 | Note composer | ❌ | Merge 2 notes (update mọi backlink), extract selection → note mới (để lại link/embed/không gì), template `{{content}}/{{fromTitle}}/{{newTitle}}` |
| 17 | Random note | ✅ | Command palette action opens a random indexed note from the current vault |
| 18 | Slash commands | ✅ | Typing `/` at the start of an editor line opens a slash palette that can run commands and insert components/templates/date/time snippets |
| 19 | Footnotes view | ❌ | Panel list footnotes của note active (footnote **render** trong preview thì đã có qua GFM pipeline) |
| 20 | Graph view | ❌ | Global + local graph. Được nêu là invariant trong [product-vision.md](../product-vision.md) — deferred có chủ đích |
| 21 | Canvas | ❌ | Deferred (effort 5) — xem bản research trước |
| 22 | Bases | ❌ | Database views trên properties (bảng, filter, sort). Tương đương Dataview-lite. Ứng viên dài hạn |
| 23 | Workspaces | ❌ | Save/load/delete layout theo tên (tabs + sidebar state). mdx-vault chưa có tabs nên chưa làm được |
| 24 | Unique note creator | ✅ | Command palette action creates and opens a timestamp-prefixed `.mdx` note without overwriting |
| 25 | Audio recorder | ❌ | Ghi âm → attachment. Thấp ưu tiên với vision |
| 26 | Format converter | ❌ | Import từ app khác. Thấp ưu tiên giai đoạn này |
| 27 | Slides | ❌ | Presentation từ note. Note: MDX + islands có thể làm hay hơn Obsidian về lâu dài |
| 28 | Web viewer | ❌ | Mở external link trong app. Cẩn trọng: mở rộng attack surface, xem [security.md](../security.md) |
| 29 | Sync | ❌ | Rejected/deferred có chủ đích — Git-first ([roadmap.md](../roadmap.md)) |
| 30 | Publish | ⚠️ | Export static/interactive HTML (`export-service.ts`) nhưng không hosting — chấp nhận được với vision local-first |

**Đếm**: ✅ 7 · ⚠️ 8 · ❌ 15. So bản 2026-07-09 (~7/30 ở mức có/không): GOAL-11/12 đã đóng outline, tags, command palette, templates/daily cơ bản; GOAL-13 đóng random note, slash commands, unique note creator, và nâng nhiều mục ⚠️ — nhưng **hầu hết mục ⚠️ còn lại là thiếu chính các micro-features làm nên cảm giác "hoàn chỉnh" của Obsidian**.

---

## 3. Options settings gap (ngoài core plugins)

Từ [obsidian.md/help/settings](https://obsidian.md/help/settings) — mdx-vault chưa có Settings UI tổng quát (chỉ có `AiSettingsPanel` + theme toggle):

- **Editor**: readable line length, strict line breaks, fold heading/indent, line numbers, indentation guides, auto-pair brackets/markdown, smart lists, spellcheck (+languages), vim mode, RTL, paste-HTML-to-Markdown
- **Files & links**: default new-note/attachment location, new link format (shortest/relative/absolute), auto-update links on rename, confirm delete, trash destination, excluded files
- **Appearance**: accent color, interface/text/monospace font, font size, inline title, CSS snippets, zoom
- **Hotkeys**: toàn bộ hotkey đang hardcode — chưa có hotkey editor + search + conflict indicator

---

## 4. Interaction-level micro-behaviors — Layer 5

The first-pass tables have been superseded by the dedicated [Obsidian interaction-behavior deep audit](obsidian-interaction-behaviors-2026-07.md). That audit pins official help commit `f9b17275eade57af64d545bb057a791548dc91e9`, accounts for all 152 lexicon-matching help files with zero unaccounted sources, and records 145 independently testable behavior rows.

| Current deep-audit result | Count |
|---|---:|
| `FULL` | 53 |
| `PARTIAL` | 15 |
| `MISSING` | 41 |
| `CONFLICT` | 5 |
| `PREREQUISITE` — missing containing surface, kept separate from ordinary gaps | 27 |
| `NOT_APPLICABLE` — explicit product-vision reason | 4 |

Highest-risk verified findings:

1. **Rename data integrity:** Obsidian rewrote five incoming wikilinks in two fixture notes after a prompt-mode rename; mdx-vault renamed and reindexed the file but left every incoming target stale.
2. **Clipboard conflict:** `Ctrl+Shift+V` pasted the plain representation in Obsidian; mdx-vault consumes the chord globally and cycles source/split/preview instead.
3. **Attachment loss of intent:** Obsidian imported both PNG and PDF fixtures and honored destination settings; mdx-vault imported only allowlisted images, silently ignored the PDF, and hard-coded `assets/` plus Markdown image syntax.
4. **Explorer interaction gap:** the mdx-vault file row has five useful actions, but folder rows have no context menu/disclosure behavior, result panels have no alternate actions, and there is no multi-select or move/drop transaction model.

The deep audit keeps non-customizable CodeMirror/OS editing shortcuts separate from application hotkeys, includes a 14-surface live Obsidian right-click pass, and groups later work into link/asset integrity, editor ingress, explorer transactions, and workspace/hotkey infrastructure.

---

## 5. Nhóm ưu tiên đề xuất (input cho create-goal)

> Score theo rubric cũ `Impact × VisionFit / Effort`. Chi tiết effort là [ước lượng].

### Nhóm A — "Đóng ⚠️ thành ✅" (effort thấp, cảm giác hoàn chỉnh tăng vọt)
1. **Search operators** (`tag:` `path:` `file:` + regex) — GOAL-13 đã implement subset này; các operator nâng cao hơn vẫn để goal riêng
2. **Quick switcher: aliases + recent + create-from-switcher** — GOAL-13 đã implement; `Ctrl+Enter` tab/new-pane deferred vì mdx-vault chưa có tabs
3. **Backlinks: context snippet + unlinked mentions** — GOAL-13 đã implement thêm filter/sort cơ bản
4. **Templates: insert-at-cursor vào note đang mở + `{{date:FORMAT}}`/`{{time:FORMAT}}`** — GOAL-13 đã implement
5. **Slash commands: trigger `/` trong editor** → GOAL-13 đã implement palette chạy command + insert component/template/date/time
6. **Random note + Unique note creator** — GOAL-13 đã implement
7. **Command palette: pinned + recent + hiện hotkey** — GOAL-13 đã implement
8. **Editor context menu** (right-click: cut/copy/paste, add link, format) — hiện right-click không ra gì, cảm giác "app chưa xong" rõ nhất
9. **Auto-update wikilinks khi rename** — verified MISSING, rename đang làm gãy link toàn vault. **Data-integrity, ưu tiên cao nhất nhóm A**

### Nhóm B — Panel/feature mới độc lập (effort trung bình)
8. **Page preview (hover)** — reuse MdxPreview render trong popover; tăng cảm giác "knowledge app" nhiều nhất trên mỗi effort
9. **Properties editor UI** (form edit frontmatter) — VisionFit 2 vì frontmatter khai props cho islands
10. **Outgoing links panel** — data đã có trong index
11. **File recovery snapshots** — SQLite table + interval; an toàn dữ liệu là trust-feature
12. **Bookmarks panel**
13. **Note composer** (merge/extract + update backlinks)
14. **Drag & drop pack**: kéo file trong FileTree để move + thả file bất kỳ vào editor thành link/embed + attachment location cấu hình được (thay hardcode `assets/`)
15. **Paste pack**: paste HTML→Markdown, paste file ngoài ảnh, `Ctrl+Shift+V`

### Nhóm C — Cần nền tảng trước (đừng làm lẻ)
- **Workspaces** ← cần **tabs** trước
- **Hotkey customization + Settings UI tổng quát** ← nên làm sau khi command số lượng tăng (nhóm A-7)
- **Graph view** — invariant của vision, goal riêng
- **Bases / query blocks** — sau properties editor

---

## 6. Cách giữ report này khỏi stale

- Mỗi lần một goal ship xong → cập nhật cột status của bảng Section 2 trong cùng PR.
- 3 tháng/lần re-crawl `obsidianmd/obsidian-help` (git pull + diff `en/Plugins/`) để bắt core plugin mới (vd Bases, Footnotes view, Web viewer đều là plugin mới 2024-2025).
- Nguồn phải là trang help chính thức; blog/tier-list chỉ dùng để ưu tiên hoá, không dùng làm checklist.
