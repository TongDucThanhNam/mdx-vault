# GOAL-11 — Editor Enrichment (Math, Code Highlight, Mermaid, Callouts)

> File này được tạo tự động bởi create-goal skill.
> Agent thực thi: đọc toàn bộ file này trước khi làm bất kỳ thứ gì.
> Tuân thủ tuyệt đối [AGENTS.md](../AGENTS.md) + [docs/security.md](../docs/security.md).
> Nguồn ưu tiên: top-2 quick wins + #6, #7 trong [docs/research/feature-gap-2026-07.md](../docs/research/feature-gap-2026-07.md).

---

## Objective

Đưa **preview** của mdx-vault đạt parity với Typora/Obsidian ở 4 feature: **(F1) KaTeX math render, (F2) code block syntax highlight, (F3) callouts/admonitions, (F4) Mermaid diagrams** — tất cả là plugin vào MDX pipeline sẵn có, không kiến trúc mới. Export pipeline phải render được F1–F3 (F4 cho phép fallback). Nếu context còn: **(F5) footnotes fix, (F6) focus/typewriter mode** — optional, được phép bỏ.

Thứ tự bắt buộc: F1 → F2 → F3 → F4 → (F5 → F6). Agent CÓ THỂ dừng sau bất kỳ feature nào nếu context cạn, nhưng feature đã bắt đầu phải hoàn chỉnh (render + export + verify).

---

## Context

- **Lý do**: Feature-gap research 2026-07 xếp math + code highlight là top-2 (score 6.0, effort 1, VisionFit 2 — target users là CS learners/dev cần công thức và code đọc được). Mermaid (#6) và callouts (#7) cùng nhóm editor-enrichment, cùng chạm một pipeline → gom một sprint.
- **Ưu tiên**: correctness > speed. Security invariant tuyệt đối — đặc biệt F4 (xem Constraints).
- **Người thực hiện**: AI Agent (báo cáo sau mỗi feature).
- **Ngày tạo**: 2026-07-09.

---

## Current State

| Item | Giá trị |
|------|---------|
| Preview pipeline | `src/renderer/src/preview/MdxPreview.tsx:138-145` — `evaluate()` từ `@mdx-js/mdx` với `remarkPlugins: [remarkGfm, remarkFrontmatter, remarkWikilink]`, `rehypePlugins: [rehypeSafeHtml]` |
| Sanitize (preview) | `src/renderer/src/preview/safe-html.ts` — schema KHÔNG cho `className` trên `*` (chỉ `code` với `/^language-[\w-]+$/`), KHÔNG cho `style` attribute, strip `script/style/iframe`. Component viết hoa được bảo toàn qua placeholder mechanism |
| Export pipeline | `src/main/services/export-renderer.ts` — pipeline unified RIÊNG (không dùng `evaluate()`), sanitize schema riêng (schema này CÓ cho `className` trên `*`), JSX → `<mdx-vault-component>` placeholder |
| Editor | CodeMirror 6, `src/renderer/src/editor/MdxEditor.tsx` + `mdx-highlight.ts` — code fence đã highlight TRONG EDITOR; goal này chỉ lo PREVIEW |
| Preview CSS | class `mdx-preview` trong `MdxPreview.tsx:99`; theme tokens trong `src/renderer/src/globals.css` (light + `.dark`) |
| Footnotes | `remark-gfm` (đã có) hỗ trợ `[^1]` syntax — `[cần xác nhận]` vì sao không render: khả năng cao sanitize strip `id` (clobber) và strip fragment href `#...` (protocols chỉ cho http/https/mailto) |
| Dependencies liên quan | Đã có: `remark-gfm`, `rehype-sanitize`, `unified`. CHƯA có: katex, remark-math, rehype-katex, highlight lib, mermaid |
| Package manager | `bun` (KHÔNG npm/pnpm/yarn) |
| Sandbox | `SandboxedHTML`/`Interactive` iframe + permission manifest (GOAL-05) — ứng viên chạy mermaid |

---

## Target State

| Feature | Preview | Export |
|---------|---------|--------|
| F1 Math | `$...$` inline + `$$...$$` block render KaTeX. CSS/fonts bundle local (KHÔNG CDN) | HTML tĩnh có KaTeX markup + CSS inline/bundled, xem offline được |
| F2 Code highlight | Code fence ` ```ts ` etc. tô màu trong preview, theme khớp light/dark | HTML tĩnh có highlight markup + CSS |
| F3 Callouts | `> [!note]`, `> [!tip]`, `> [!warning]`, `> [!danger]`, `> [!info]` → box icon + màu theo DESIGN.md editorial style | Render tĩnh giữ nguyên style |
| F4 Mermaid | ` ```mermaid ` fence → diagram. `securityLevel: 'strict'` + khóa config (xem Constraints) | Fallback được phép: static SVG `[ước lượng]` hoặc code block + ghi chú |
| F5 Footnotes (optional) | `[^1]` render đúng, click qua lại hoạt động | Render đúng |
| F6 Focus/typewriter (optional) | Toggle trong editor: typewriter scroll (dòng active giữa màn hình) + focus mode (dim đoạn không active) | N/A (editor-only) |
| Thứ KHÔNG thay đổi | Trust model, sanitize policy cho user HTML, sandbox model, editor highlight hiện có, mọi IPC hiện có | Placeholder mechanism, leak check |

---

## Constraints

> Agent PHẢI tuân theo tuyệt đối. Conflict với Execution Plan → ưu tiên Constraints.

### Security (quan trọng nhất)

- [ ] **Thứ tự rehype plugin trong preview**: `rehypeSafeHtml` chạy TRƯỚC, plugin render (katex/highlight) chạy SAU — theo khuyến cáo chính thức của rehype-sanitize ("trust KaTeX, not user content"). Nếu cần allowlist thêm class cho node math (vd `math-inline`, `math-display` trên `code`), chỉ mở đúng các class đó bằng regex hẹp — KHÔNG mở `className` wildcard trên `*` trong schema preview.
- [ ] **F4 Mermaid là vùng nguy hiểm** — mermaid có chuỗi CVE XSS 2025 (CVE-2025-54881, DeepChat GHSA-f7q5-vc93-wp6j: XSS → RCE trong Electron). Bắt buộc: (a) `securityLevel: 'strict'`, (b) dùng option `secure` khóa `securityLevel` không cho directive/frontmatter trong diagram override, (c) init mermaid tập trung một chỗ trong app code, (d) SVG output phải đi qua sanitize trước khi chèn DOM **HOẶC** render toàn bộ trong sandbox iframe sẵn có (ưu tiên — xem Execution Plan bước 4). KHÔNG BAO GIỜ `securityLevel: 'loose'`.
- [ ] Electron hardening giữ nguyên: `contextIsolation: true`, `sandbox: true`, `nodeIntegration: false`. KHÔNG nới CSP.
- [ ] **KHÔNG tải asset từ CDN/network lúc runtime** (local-first): KaTeX CSS + fonts, highlight theme CSS, mermaid đều bundle local qua bun.
- [ ] KHÔNG suy yếu sanitize schema hiện có cho user HTML: `script/style/iframe` vẫn strip, protocols vẫn hẹp. Mọi nới schema phải là allowlist hẹp có comment giải thích phục vụ feature nào.

### Scope

- [ ] KHÔNG thay đổi behavior GOAL-01→10 (indexing, registry, islands, sandbox, AI, export placeholder mechanism, editor highlight).
- [ ] KHÔNG refactor pipeline preview/export ngoài mức cần thiết để chèn plugin.
- [ ] KHÔNG upgrade dependency không liên quan. Chỉ `bun add` những gì feature cần. Chọn lib nhẹ trước: rehype-highlight (lowlight) thay vì Shiki nếu đạt yêu cầu `[ước lượng — agent quyết sau khi thử]`; mermaid PHẢI lazy-load (chỉ load khi note có mermaid fence).
- [ ] F3 callouts: syntax phải tương thích Obsidian (`> [!note]`) để note import từ Obsidian render đúng. Style theo DESIGN.md (editorial, border-2, shadow offset — nhìn FrontmatterPropertiesBlock trong `MdxPreview.tsx:188` làm mẫu).
- [ ] Export parity là BẮT BUỘC cho F1–F3 (hai pipeline riêng — sửa cả `export-renderer.ts`/`export-template.ts`). F4 được phép fallback. Leak check (`export-leak-check.ts`) phải vẫn pass.
- [ ] Sau mỗi feature: `bun run typecheck` + `bun run lint` pass, commit riêng (`feat: ...` conventional).
- [ ] Gặp blocker → DỪNG và báo, không tự workaround.

---

## Success Criteria

> Verify bằng note test trong `example-vault/` (tạo `notes/editor-enrichment-test.mdx` chứa đủ case). Chạy app thật (`bun run dev`) để verify visual, không chỉ typecheck.

- [ ] **F1**: `$E = mc^2$` inline và `$$\int_0^\infty e^{-x^2} dx = \frac{\sqrt{\pi}}{2}$$` block render KaTeX đúng trong preview; KHÔNG có network request ra ngoài (fonts local); dark mode đọc được
- [ ] **F2**: fence ```` ```ts ````, ```` ```python ````, ```` ```json ```` tô màu trong preview; fence không rõ ngôn ngữ không vỡ; light/dark theme khớp app theme
- [ ] **F3**: 5 loại callout render box + icon + màu phân biệt; blockquote thường (không có `[!...]`) KHÔNG bị ảnh hưởng; nested content (list, code) trong callout render đúng
- [ ] **F4**: mermaid flowchart + sequence diagram render; diagram chứa `click` directive / `javascript:` label KHÔNG thực thi được gì (test case bắt buộc); mermaid chỉ được load khi note có mermaid fence (verify qua devtools network/module load)
- [ ] **Sanitize không thủng**: note chứa `<script>alert(1)</script>`, `<img src=x onerror=alert(1)>`, `javascript:` href vẫn bị strip như trước (regression test thủ công)
- [ ] **Export**: export note test → mở HTML offline (không mạng) → math + code highlight + callouts hiển thị đúng; mermaid hiển thị diagram hoặc fallback rõ ràng; leak check pass
- [ ] **Perf**: note KHÔNG có math/mermaid không chậm đi rõ rệt (mermaid/katex không load khi không dùng — lazy hoặc tree-shake) `[ước lượng — đo bằng cảm quan devtools, không cần benchmark]`
- [ ] `bun run typecheck` + `bun run lint` pass toàn repo
- [ ] (Nếu làm F5) footnote `[^1]` click xuống/lên hoạt động trong preview
- [ ] (Nếu làm F6) toggle focus/typewriter trong editor hoạt động, tắt được, không ảnh hưởng autosave/highlight

---

## Execution Plan

> Thực hiện theo thứ tự. Báo cáo sau mỗi bước. Mỗi feature = 1 commit.

1. **F1 Math**: `bun add remark-math rehype-katex katex`. Chèn `remarkMath` vào remarkPlugins + `rehypeKatex` SAU `rehypeSafeHtml` trong `MdxPreview.tsx`. Verify sanitize không strip node math trước khi rehype-katex chạy — nếu strip, allowlist hẹp class `math-inline`/`math-display` trên `code` trong `safe-html.ts`. Import KaTeX CSS local vào renderer. Làm tương tự cho export pipeline (`export-renderer.ts` + nhúng CSS vào `export-template.ts`). Verify + commit.
2. **F2 Code highlight**: chọn lib (`rehype-highlight`/lowlight ưu tiên vì sync + nhẹ; Shiki nếu chất lượng lowlight không đạt). Chèn SAU `rehypeSafeHtml`. Theme CSS light/dark map vào token `globals.css` (tránh hardcode màu lệch DESIGN.md). Export parity. Verify + commit.
3. **F3 Callouts**: viết remark plugin (hoặc dùng plugin có sẵn nếu tương thích Obsidian syntax — research nhanh `remark-callout` / `remark-obsidian-callout` trước khi tự viết). **Quyết định design**: (a) transform thành element + allowlist hẹp `data-callout` attr trong cả 2 sanitize schema, hoặc (b) transform thành registry component `Callout` viết hoa để đi qua placeholder mechanism sẵn có — cân nhắc: (b) tự động được export placeholder xử lý nhưng cần đăng ký registry + export snapshot; (a) đơn giản hơn cho export. `[ước lượng — agent chọn sau khi đọc registry, ghi lý do trong report]`. Verify 5 loại + nested content + commit.
4. **F4 Mermaid**: `bun add mermaid` (lazy import). **Quyết định design** `[cần xác nhận nếu chọn khác khuyến nghị]`: khuyến nghị render qua **sandbox iframe sẵn có** (mermaid chạy trong iframe, postMessage trả SVG hoặc render tại chỗ trong iframe) — cô lập hoàn toàn CVE surface; phương án B là render trong renderer với `securityLevel: 'strict'` + `secure` lock + sanitize SVG output. Test case XSS bắt buộc (click directive, `javascript:` label). Export: fallback static SVG nếu render được lúc export, ngược lại code block + note. Verify + commit.
5. **(Optional) F5 Footnotes**: debug vì sao `remark-gfm` footnotes không render — kiểm tra sanitize: `clobber` đổi `id` thành `user-content-*` và `protocols.href` không cho fragment `#...`. Fix bằng allowlist hẹp (cho phép href `#user-content-fn-*` pattern), KHÔNG tắt clobber. Verify + commit.
6. **(Optional) F6 Focus/typewriter**: CodeMirror extensions trong `MdxEditor.tsx` (typewriter: scroll margin; focus: decoration dim các paragraph không chứa cursor). Toggle UI đặt cạnh view-mode control hiện có. Verify + commit.
7. **Chốt**: tạo/hoàn thiện `example-vault/notes/editor-enrichment-test.mdx` đủ mọi case, chạy toàn bộ Success Criteria, báo cáo từng item.

---

## Out of Scope

- KHÔNG làm WYSIWYG/live-preview inline trong editor (feature #1 matrix — khác sprint, effort lớn)
- KHÔNG làm outline/TOC, tags panel, daily notes, templates (GOAL-12)
- KHÔNG làm spaced repetition, properties UI (GOAL-13)
- KHÔNG thêm math/mermaid highlight TRONG EDITOR (CodeMirror) — chỉ preview; editor highlight hiện có giữ nguyên
- KHÔNG làm table editing, vim mode, spellcheck
- KHÔNG viết unit test framework mới (repo chưa có test setup — verify thủ công qua app + note test)

---

## References

- [docs/research/feature-gap-2026-07.md](../docs/research/feature-gap-2026-07.md) — chi tiết #1, #2, #6, #7 top-10
- Files phải đọc trước khi code: `src/renderer/src/preview/MdxPreview.tsx`, `src/renderer/src/preview/safe-html.ts`, `src/main/services/export-renderer.ts`, `src/main/services/export-template.ts`, `docs/security.md`, `DESIGN.md`
- [remark-math / rehype-katex](https://github.com/remarkjs/remark-math) — README có section chính thức về thứ tự với rehype-sanitize + allowlist class
- [rehype-sanitize](https://github.com/rehypejs/rehype-sanitize) — schema reference
- [Mermaid security advisories](https://security.snyk.io/vuln/SNYK-JS-MERMAID-12027649) (CVE-2025-54881), [DeepChat RCE case study](https://github.com/ThinkInAIXYZ/deepchat/security/advisories/GHSA-f7q5-vc93-wp6j) — vì sao Electron + mermaid phải strict/sandbox
- [Snyk Labs: exploiting diagram renderers](https://labs.snyk.io/resources/exploiting-diagram-renderers/)
- [Obsidian callout syntax](https://help.obsidian.md/callouts) — chuẩn tương thích cho F3

---

## Agent Instructions

1. Đọc toàn bộ file này + AGENTS.md + docs/security.md + các file trong References trước khi code
2. Tuân theo Constraints tuyệt đối — đặc biệt security block cho F4
3. Thực hiện Execution Plan theo thứ tự F1→F6, mỗi feature verify + commit xong mới sang feature sau
4. Context cạn → dừng sau feature đang dở đã hoàn chỉnh, báo lại feature nào xong/chưa
5. Conflict giữa Constraints và Execution Plan → ưu tiên Constraints
6. Gặp thứ không có trong GOAL → DỪNG và hỏi, không tự assume
7. Khi xong: verify toàn bộ Success Criteria và báo cáo từng item kèm evidence
