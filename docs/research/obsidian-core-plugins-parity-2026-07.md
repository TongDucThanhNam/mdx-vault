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

## 4. Interaction-level micro-behaviors — Lớp 5

> Nguồn: grep `obsidian-help/en` (right-click / drag / drop / paste / hold) + đối chiếu code. Đây là lớp làm nên cảm giác "app hoàn chỉnh" mà bảng plugin không thể hiện được.

### 4.1 Context menu theo surface (Obsidian: mỗi nơi một menu khác nhau)

| Surface | Obsidian có | mdx-vault |
|---|---|:---:|
| **Editor (text/selection)** | Add link, Add external link, Format ▸, Paragraph ▸, Insert ▸, Cut/Copy/Paste, Paste as plain text, Select all | ❌ **không có menu nào** — Electron không tự sinh context menu, hiện right-click trong editor không ra gì |
| **File (File explorer)** | New note here, Open in new tab/window, Rename, Delete, Duplicate, **Bookmark**, **Merge với note khác** (Note composer), Copy path, Reveal | ⚠️ 5 items: Duplicate/Rename/Copy path/Reveal/Delete ([FileTree.tsx:221-242](../../src/renderer/src/explorer/FileTree.tsx)) |
| **Folder (File explorer)** | New note, New folder, New canvas, Rename, Delete, Bookmark | ⚠️ [cần xác nhận] — kiểm tra folder có menu riêng chưa |
| **Multi-select files** (`Alt`/`Shift` chọn nhiều) | Bookmark all, thao tác hàng loạt | ❌ chưa có multi-select |
| **Internal link trong editor** | Open in new tab / new window / split, follow | ❌ |
| **Tab header** | Split right/down, **Pin/Unpin**, Close others, Move/Open in new window, Bookmark tab | ❌ chưa có tabs |
| **Heading trong editor** | Bookmark this heading | ❌ |
| **Property** (All properties view) | Rename globally | ❌ |
| **Sidebar tab / Ribbon** | Close tab, hide actions, hide ribbon | ❌ |

### 4.2 Drag & drop matrix (từ `User interface/Drag and drop.md`)

| Thao tác | Obsidian | mdx-vault |
|---|---|:---:|
| Kéo file trong explorer → thả vào folder = move | ✅ | ❌ FileTree không có `draggable` |
| Kéo file từ Search result / Backlinks / link trong preview | ✅ | ❌ |
| Thả file vào tab header = mở; `Alt` = thả tự do | ✅ | ❌ (chưa có tabs) |
| Thả file vào editor = chèn link (theo setting link format) | ✅ | ⚠️ chỉ **ảnh** → `assets/` ([MdxEditor.tsx:398](../../src/renderer/src/editor/MdxEditor.tsx)) |
| Kéo tab để sắp xếp / split pane | ✅ | ❌ |
| Kéo **HTML từ browser** vào → tự convert Markdown | ✅ | ❌ |
| Kéo file từ OS vào → copy vào attachment folder + embed; giữ `Ctrl` = link `file:///` không copy | ✅ | ⚠️ chỉ ảnh |
| Kéo note **ra ngoài app** → sinh `obsidian://` URL | ✅ | ❌ (chưa có URI scheme) |

### 4.3 Paste & attachment behaviors (từ `Attachments.md` + Settings → Files & links)

| Behavior | Obsidian | mdx-vault |
|---|---|:---:|
| Paste ảnh/file → tạo file trong **attachment location cấu hình được** (4 chế độ: vault root / folder chỉ định / cùng folder với note / subfolder cạnh note) | ✅ | ⚠️ hardcode `assets/` ([MdxEditor.tsx:54-56](../../src/renderer/src/editor/MdxEditor.tsx)) |
| Paste HTML → tự convert Markdown (toggle Editor setting) | ✅ | ❌ |
| Paste without formatting `Ctrl+Shift+V` | ✅ | ❌ [cần xác nhận] |
| Paste attachment ngoài ảnh (PDF, audio…) → embed | ✅ | ❌ chặn theo MIME, chỉ ảnh |
| Link format khi auto-generate (shortest/relative/absolute, wikilink vs markdown) — setting áp cho mọi chỗ sinh link | ✅ | ❌ không có setting, format cứng |
| Auto-update links khi rename file (+ prompt mode) | ✅ | ❌ **verified**: [vault-service.ts:176-196](../../src/main/services/vault-service.ts) chỉ `rename()` file, không rewrite wikilink ở note khác → **rename hiện làm gãy link toàn vault** |

### 4.4 Hotkeys — hai tầng riêng biệt (từ `Hotkeys.md` + `Editing shortcuts.md`)

- **Tầng 1 — Hotkeys (customizable)**: mọi command gán được phím trong Settings → Hotkeys; một command nhiều tổ hợp; search + filter "đã gán"; hiển thị theo US layout. mdx-vault: ❌ toàn bộ hardcode, chưa có UI.
- **Tầng 2 — Editing shortcuts (OS-level, không customize)**: bảng ~40 shortcut mặc định trong `Editing shortcuts.md` — delete word/line (`Ctrl+Shift+K`), copy/cut **cả paragraph khi không select gì**, navigation từng cấp. mdx-vault dùng CM6 nên có sẵn phần lớn navigation, nhưng cần audit từng dòng của bảng đó — đặc biệt: copy-paragraph-khi-không-select, `Ctrl+Shift+K`, multiple cursors (`Alt+Click` — CM6 cần bật extension) [cần xác nhận].

### 4.5 Editor niceties còn lại (mỗi cái một trang help riêng)

`Folding.md` (fold heading/indent + lệnh fold all), `Multiple cursors.md` (`Alt+Click`), auto-pair brackets/markdown, smart lists (Enter tự thêm bullet, Tab indent), readable line length, strict line breaks, RTL, spellcheck — tất cả là **Editor settings toggle** (Section 3) đi kèm behavior. mdx-vault chưa có cái nào trong nhóm này trừ những gì CM6 mặc định cho không.

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
