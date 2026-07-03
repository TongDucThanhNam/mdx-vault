# Tech Stack — mdx-vault

> Trạng thái: tất cả package dưới đây ĐÃ được cài (xem package.json / bun.lock). Package manager là **bun** — không dùng npm/pnpm/yarn.

## Desktop core

| Lib               | Version | Lý do / Gotchas                                                                                                             |
| ----------------- | ------- | --------------------------------------------------------------------------------------------------------------------------- |
| electron          | ^39     | Desktop shell. Template `sandbox: false` trong main/index.ts — Goal 01 phải bật `sandbox: true` + `contextIsolation: true`. |
| electron-vite     | ^5      | Build 3 môi trường main/preload/renderer. Config: `electron.vite.config.ts`.                                                |
| electron-builder  | ^26     | Packaging + rebuild native modules (`postinstall`).                                                                         |
| react / react-dom | ^19     | Nằm trong devDependencies (electron-vite bundle chúng) — đúng chủ ý của template, đừng "sửa".                               |
| vite              | ^7      | Qua electron-vite.                                                                                                          |

## UI

| Lib                                            | Ghi chú                                                                                                                                                                                                                                                                                                                                                                      |
| ---------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| tailwindcss v4 + @tailwindcss/vite             | **Không có tailwind.config.js** — v4 config bằng CSS. Theme + design tokens trong `src/renderer/src/globals.css` (đã setup, import trong `main.tsx`). Plugin đã thêm vào `electron.vite.config.ts` (chỉ renderer).                                                                                                                                                           |
| shadcn/ui                                      | Đã init thủ công: `components.json` (style new-york, baseColor neutral), `src/renderer/src/lib/utils.ts` (cn), alias `@/*` trong tsconfig.json + tsconfig.web.json + vite. Thêm component: `bunx --bun shadcn@latest add <name>`. Đã có sẵn `button` để làm mẫu. Lưu ý: root tsconfig.json PHẢI giữ compilerOptions.paths, nếu không shadcn CLI ghi vào folder literal `@\`. |
| lucide-react                                   | Icons (shadcn mặc định).                                                                                                                                                                                                                                                                                                                                                     |
| tw-animate-css                                 | Animations cho shadcn (devDependency, import trong globals.css).                                                                                                                                                                                                                                                                                                             |
| class-variance-authority, clsx, tailwind-merge | shadcn primitives.                                                                                                                                                                                                                                                                                                                                                           |

## Editor

| Lib                                               | Ghi chú                                                   |
| ------------------------------------------------- | --------------------------------------------------------- |
| codemirror (basicSetup) + @codemirror/state, view | Editor source mode. Dùng basicSetup cho MVP.              |
| @codemirror/lang-markdown                         | Kèm codeLanguages: javascript, html, yaml cho code fence. |

## Content pipeline (MDX)

| Lib                                                               | Ghi chú                                                                                                                      |
| ----------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------- |
| @mdx-js/mdx, @mdx-js/react                                        | `evaluate()` để compile+render trong preview. **evaluate = eval JS** → chỉ dùng cho nội dung đã trust; xem docs/security.md. |
| unified, remark-parse, remark-mdx, remark-gfm, remark-frontmatter | Parse AST cho cả render lẫn index.                                                                                           |
| rehype-sanitize, rehype-slug                                      | Sanitize safe HTML (Level 1), heading anchors.                                                                               |
| unist-util-visit                                                  | Duyệt AST khi index.                                                                                                         |
| gray-matter                                                       | Frontmatter.                                                                                                                 |

## Data / index

| Lib            | Ghi chú                                                                                                                                                                                                |
| -------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| better-sqlite3 | Sync API, dùng ở **main process only**. Native module — rebuild qua postinstall; lỗi ABI ("was compiled against a different Node.js version") → chạy lại `bun install`. Bật FTS5 cho full-text search. |
| chokidar ^5    | Vault watcher (main process).                                                                                                                                                                          |
| fast-glob      | List file trong vault.                                                                                                                                                                                 |
| zod ^4         | Validate IPC payload, props schema, manifest, postMessage RPC.                                                                                                                                         |

## TanStack

| Lib                                               | Ghi chú                                                                                                                                                                                                                                                                                         |
| ------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| @tanstack/react-query                             | Server-state cho renderer (query IPC results, cache index queries).                                                                                                                                                                                                                             |
| @tanstack/ai (^0.39) + @tanstack/ai-react (^0.16) | **BETA — API thay đổi nhanh.** Bắt buộc bọc sau interface `AssistantRuntime` (xem docs/architecture.md), không import trực tiếp rải rác trong codebase. Có sẵn: streaming, typed tool calling, provider adapters, approval flow — dùng approval flow cho diff/patch UX. Chỉ đụng đến ở Goal 06. |

## Khác

| Lib                  | Ghi chú                                               |
| -------------------- | ----------------------------------------------------- |
| react-error-boundary | Bọc MDX preview để lỗi compile/runtime không sập app. |
| esbuild (dev)        | Compile vault custom components (Goal 05).            |

## Chưa cài (cài khi đến goal tương ứng)

- Chart lib cho `DataChart` (Goal 04 — cân nhắc recharts hoặc observable plot)
- Virtualization cho file tree/list dài (`@tanstack/react-virtual`) nếu cần
- Provider SDK cụ thể cho TanStack AI (Goal 06, tùy provider user chọn)
