# Tech Stack — mdx-vault

> Trạng thái: tất cả package dưới đây ĐÃ được cài (xem package.json / bun.lock). Package manager, script runtime và test runner là **Bun 1.4** — không dùng npm/pnpm/yarn.

Bun-only APIs (`Bun.*`, `bun:*`) chỉ dùng trong `scripts/` và test chạy trực tiếp bằng
Bun. App đã package vẫn chạy trong Electron/Chromium, vì vậy main/preload/renderer phải
giữ API tương thích với runtime tương ứng. Xem [Bun 1.4 runtime boundary](bun-1.4-runtime.md).

## Desktop core

| Lib               | Version | Lý do / Gotchas                                                                                                             |
| ----------------- | ------- | --------------------------------------------------------------------------------------------------------------------------- |
| electron          | ^39     | Desktop shell. Template `sandbox: false` trong main/index.ts — Goal 01 phải bật `sandbox: true` + `contextIsolation: true`. |
| electron-vite     | ^5      | Build 3 môi trường main/preload/renderer. Config: `electron.vite.config.ts`.                                                |
| electron-builder  | ^26     | Packaging + rebuild native modules (`postinstall`).                                                                         |
| Bun / @types/bun  | 1.4     | Package/scripts/tests + typed Bun-native tooling only; never imported by packaged Electron source.                          |
| react / react-dom | ^19     | Nằm trong devDependencies (electron-vite bundle chúng) — đúng chủ ý của template, đừng "sửa".                               |
| vite              | ^7      | Qua electron-vite.                                                                                                          |

## UI

The editor readability follow-up adds self-hosted `@fontsource/jetbrains-mono`
5.3.0, including Vietnamese subsets, as the new Source/Live default (15px/1.6).
Existing Maple/IBM/System selections remain valid. Appearance uses the existing
Radix popover, settings IPC and CodeMirror compartments; no new UI framework or
editor engine is introduced. MDX syntax checking uses `createProcessor().parse`,
not compilation/evaluation, in a lazy bounded module worker. See the
[research and performance evidence](research/editor-readability-and-typing-2026-09.md).

| Lib                                            | Ghi chú                                                                                                                                                                                                                                                                                                                                                                      |
| ---------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| tailwindcss v4 + @tailwindcss/vite             | **Không có tailwind.config.js** — v4 config bằng CSS. Theme + design tokens trong `src/renderer/src/globals.css` (đã setup, import trong `main.tsx`). Plugin đã thêm vào `electron.vite.config.ts` (chỉ renderer).                                                                                                                                                           |
| shadcn/ui                                      | Đã init thủ công: `components.json` (style new-york, baseColor neutral), `src/renderer/src/lib/utils.ts` (cn), alias `@/*` trong tsconfig.json + tsconfig.web.json + vite. Thêm component: `bunx --bun shadcn@latest add <name>`. Đã có sẵn `button` để làm mẫu. Lưu ý: root tsconfig.json PHẢI giữ compilerOptions.paths, nếu không shadcn CLI ghi vào folder literal `@\`. |
| lucide-react                                   | Icons (shadcn mặc định).                                                                                                                                                                                                                                                                                                                                                     |
| tw-animate-css                                 | Animations cho shadcn (devDependency, import trong globals.css).                                                                                                                                                                                                                                                                                                             |
| class-variance-authority, clsx, tailwind-merge | shadcn primitives.                                                                                                                                                                                                                                                                                                                                                           |
| @fontsource/atkinson-hyperlegible-next, literata, maple-mono, ibm-plex-mono | Self-hosted Knowledge Instrument font roles: UI, prose, Source editor và data. Không dùng font CDN hoặc nới CSP. |

## Editor

| Lib                                               | Ghi chú                                                                                                                                                |
| ------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------ |
| codemirror + @codemirror/state, view, language    | Owned IDE-style Source setup: history/keymaps/folding/search/completion, live preference compartments, raw MDX/code no-wrap, bounded Live-note wrap, ruler, whitespace, indent guides and shared cursor telemetry. |
| @codemirror/lang-markdown                         | Kèm codeLanguages: javascript, html, yaml cho code fence.                                                                                              |
| @codemirror/lint                                  | Lint gutter/underline/tooltip cho structured interactive diagnostics.                                                                                  |
| @mdx-js/mdx                                       | Preview toolchain và compile-only Source diagnostics. Editing diagnostics parse MDX như data, lazy-load compiler và không evaluate generated code.       |
| TypeScript 5.9.3 + @typescript/vfs 1.6.4          | Runtime dependencies có chủ đích cho fixed offline ES2022/DOM/React virtual project trong lazy worker và main semantic checker.                        |

Interactive `.ts/.tsx` giữ CodeMirror và thêm project-aware diagnostics, completion +
single-file safe auto-import, hover, signature help, local go-to-definition, read-only
References, same-buffer Rename và bounded same-buffer code actions. Standard libs,
React 19 và ReactDOM declarations được đóng gói local; worker dùng versioned
project/file/request protocol và không ATA, CDN, vault `tsconfig` hay TypeScript plugin.
Raw MDX Source derives trusted JSX tag/prop completion and hover from the app registry's
Zod metadata; it does not claim a TypeScript MDX virtual project. Đây không phải
generic/full LSP.

`@valtown/codemirror-ts` đã archived và không được dùng; Monaco, LSP server và remote
type loader cũng nằm ngoài kiến trúc. `@mdx-js/language-service` is not installed:
its official package is a Volar integration layer, while GOAL-27 needs a small
editor-owned registry metadata path and the already-bounded TypeScript worker.

## Content pipeline (MDX)

| Lib                                                               | Ghi chú                                                                                                                      |
| ----------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------- |
| @mdx-js/mdx, @mdx-js/react                                        | `evaluate()` để compile+render trong preview. **evaluate = eval JS** → chỉ dùng cho nội dung đã trust; xem docs/security.md. |
| unified, remark-parse, remark-mdx, remark-gfm, remark-frontmatter | Parse AST cho cả render lẫn index.                                                                                           |
| rehype-sanitize, rehype-slug                                      | Sanitize safe HTML (Level 1), heading anchors.                                                                               |
| unist-util-visit                                                  | Duyệt AST khi index.                                                                                                         |
| gray-matter                                                       | Frontmatter.                                                                                                                 |

GOAL-29 reuses the same inert unified tree for deterministic heading IDs, UTF-16
source ranges and bounded section records. This analysis path never calls MDX
`compile()` or `evaluate()`. Reading adds app-generated anchor attributes only after
safe HTML sanitization.

## Data / index

| Lib            | Ghi chú                                                                                                                                                                                                |
| -------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| better-sqlite3 | Sync API, dùng ở **main process only**. Native module — rebuild qua postinstall; lỗi ABI ("was compiled against a different Node.js version") → chạy lại `bun install`. FTS5 keeps note membership/filter search and a bounded section index for exact-heading results. |
| chokidar ^5    | Vault watcher (main process).                                                                                                                                                                          |
| fast-glob      | List file trong vault.                                                                                                                                                                                 |
| zod ^4         | Validate IPC payload, props schema, manifest, postMessage RPC.                                                                                                                                         |

## TanStack

| Lib                                               | Ghi chú                                                                                                                                                                                                                                                                                         |
| ------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| @tanstack/react-query                             | Server-state cho renderer (query IPC results, cache index queries).                                                                                                                                                                                                                             |
| @tanstack/ai (^0.39) + @tanstack/ai-react (^0.16) | **BETA — API thay đổi nhanh.** Bắt buộc bọc sau interface `AssistantRuntime` (xem docs/architecture.md), không import trực tiếp rải rác trong codebase. Có sẵn: streaming, typed tool calling, provider adapters, approval flow — dùng approval flow cho diff/patch UX. Chỉ đụng đến ở Goal 06. |

## Khác

| Lib                  | Ghi chú                                                                                                                                                                                                                     |
| -------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| react-error-boundary | Bọc MDX preview để lỗi compile/runtime không sập app.                                                                                                                                                                       |
| esbuild (runtime)    | Bundle vault custom components sau fixed-project TypeScript semantic check. Windows package ship platform binary và React runtime closure ngoài ASAR để native child process resolve được hoàn toàn offline (Goal 05/25). |
| recharts ^3.9        | Chart lib cho DataChart + đồ thị mini EquationSlider (Goal 04). User đã chốt thay vì tự vẽ SVG. Tương thích React 19.                                                                                                     |

## Chưa cài (cài khi đến goal tương ứng)

- Virtualization cho file tree/list dài (`@tanstack/react-virtual`) nếu cần
- Provider SDK cụ thể cho TanStack AI (Goal 06, tùy provider user chọn)
