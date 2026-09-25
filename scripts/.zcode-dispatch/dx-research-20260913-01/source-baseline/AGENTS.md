# AGENTS.md — mdx-vault

> Đọc file này trước khi làm bất kỳ việc gì trong repo.
> Đây là file hướng dẫn cho AI agent (Codex, Claude Code, ...) làm việc trên dự án.

## Dự án là gì

**mdx-vault** — một Obsidian alternative, local-first, với **MDX native**:

- Note là file `.mdx` thuần trên filesystem (vault = một folder). File là source of truth, SQLite chỉ là index/cache.
- Một note = **static prose (Markdown) + interactive islands (React/HTML)** — mental model giống Partial Prerendering: shell tĩnh, đảo động.
- **AI là trợ lý được gọi khi cần, KHÔNG phải tác giả mặc định.** Người dùng tự viết note; AI hỗ trợ viết thêm, refactor, sinh/sửa React component khi được yêu cầu, và luôn trả về diff để user approve.
- Code do AI/user sinh ra **không bao giờ được tin tuyệt đối** — chạy trong sandbox, có permission manifest.

Positioning một câu: _"A local-first MDX note app where Markdown remains the base layer, and React/HTML islands make notes interactive. AI helps only when invoked."_

Chi tiết: [docs/product-vision.md](docs/product-vision.md)

## Cách làm việc trong repo này

1. **Làm theo goal file.** Công việc được chia thành các goal trong [goals/](goals/), đánh số thứ tự. Mỗi session chỉ làm MỘT goal, theo đúng thứ tự. Đọc `goals/README.md` trước.
2. **Tuân theo Constraints trong goal file tuyệt đối.** Nếu conflict giữa Constraints và Execution Plan → ưu tiên Constraints. Gặp blocker → dừng và báo, không tự workaround.
3. **Security là bất biến, không phải feature.** Đọc [docs/security.md](docs/security.md) trước khi chạm vào bất kỳ code nào ở main process, preload, hoặc preview/render pipeline.
4. Sau mỗi thay đổi có ý nghĩa: chạy `bun run typecheck` và `bun run lint`.

## Commands

| Việc                  | Lệnh                                                                                 |
| --------------------- | ------------------------------------------------------------------------------------ |
| Cài dependency        | `bun add <pkg>` / `bun add -d <pkg>` (KHÔNG dùng npm/pnpm/yarn — repo dùng bun.lock) |
| Dev (Electron + HMR)  | `bun run dev`                                                                        |
| Typecheck             | `bun run typecheck`                                                                  |
| Lint                  | `bun run lint`                                                                       |
| Format                | `bun run format`                                                                     |
| Build                 | `bun run build` (Windows: `bun run build:win`)                                       |
| Full check            | `bun run check` (Bun gate + lint + parallel typechecks + 4-worker tests)             |
| Thêm shadcn component | `bunx --bun shadcn@latest add <name>`                                                |

Môi trường: Windows 11, Node 26, Bun 1.4. Bun chạy package manager, scripts và test runner; code trong `src/main/`, `src/preload/`, và `src/renderer/` vẫn chạy trong Electron/browser nên KHÔNG được gọi `Bun.*` hoặc import `bun:*`. Native module `better-sqlite3` được rebuild cho Electron qua `postinstall` (electron-builder install-app-deps) — nếu lỗi ABI, chạy lại `bun install`.

## Kiến trúc (tóm tắt)

```
src/main/       Main process: filesystem, vault watcher, SQLite index, IPC handlers.
                KHÔNG render UI. Mọi path từ renderer phải qua safeJoin() chống traversal.
src/preload/    Cầu contextBridge. Chỉ expose API hẹp, typed. KHÔNG expose fs/path/ipcRenderer thô.
src/renderer/   React UI: editor (CodeMirror 6), preview (MDX), file explorer, panels.
                Alias: '@/*' và '@renderer/*' → src/renderer/src/*
example-vault/  Vault mẫu để dev/test. Không phải code app.
```

BrowserWindow bắt buộc: `contextIsolation: true`, `sandbox: true`, `nodeIntegration: false`. Untrusted code (component do AI/user sinh) chỉ chạy trong iframe sandbox, giao tiếp qua postMessage. Chi tiết: [docs/architecture.md](docs/architecture.md), [docs/security.md](docs/security.md).

## Tech stack

React 19 + TypeScript, electron-vite, Tailwind CSS v4 (không có tailwind.config — theme trong `src/renderer/src/globals.css`), shadcn/ui (style new-york, đã cấu hình `components.json`), CodeMirror 6, `@mdx-js/mdx` + unified/remark/rehype, better-sqlite3 (FTS5), TanStack Query + TanStack AI (beta — luôn bọc sau interface riêng, xem docs/tech-stack.md), zod.

Chi tiết + gotchas từng lib: [docs/tech-stack.md](docs/tech-stack.md)

## Conventions

- **Separation of prose and behavior**: note `.mdx` chỉ chứa văn bản + JSX element gọn (`<QuizBlock ... />`, `<Interactive src="../interactives/foo" />`). KHÔNG khuyến khích viết import/export/function body dài bên trong note. Code component nằm ngoài note (registry hoặc `interactives/`). Xem [docs/mdx-conventions.md](docs/mdx-conventions.md).
- UI components dùng shadcn/ui + Tailwind; utility `cn()` từ `@/lib/utils`.
- IPC: mọi handler validate input bằng zod ở main process. Channel đặt tên `domain:action` (vd `vault:read-file`).
- Comment/code style theo Biome config sẵn trong repo.
- Commit message: conventional commits (`feat:`, `fix:`, `docs:`, ...).

## Tài liệu

| File                                               | Nội dung                                                  |
| -------------------------------------------------- | --------------------------------------------------------- |
| [docs/product-vision.md](docs/product-vision.md)   | Thesis, positioning, target users, những gì KHÔNG làm     |
| [docs/architecture.md](docs/architecture.md)       | Process model, module layout, data flow, IPC              |
| [docs/security.md](docs/security.md)               | Trust levels 0–4, Electron hardening, sandbox model       |
| [docs/mdx-conventions.md](docs/mdx-conventions.md) | Format note, frontmatter, wikilink, manifest interactives |
| [docs/tech-stack.md](docs/tech-stack.md)           | Từng lib: lý do chọn, version, gotchas                    |
| [docs/roadmap.md](docs/roadmap.md)                 | Các phase MVP ↔ goal files                                |
| [docs/mcp-setup.md](docs/mcp-setup.md)             | MCP servers cho agent (context7, shadcn)                  |
| [DESIGN.md](DESIGN.md)                             | Design system: editorial style, palette, typography       |

## Skills

Repo có skills cài sẵn ở `.agents/skills/` (Codex đọc trực tiếp; Claude Code qua symlink `.claude/skills/`): `vercel-react-best-practices`, `vercel-composition-patterns`, `web-design-guidelines`, `frontend-design`, `webapp-testing`. Dùng chúng khi viết/review React code và UI.
