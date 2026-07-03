# mdx-vault

**Obsidian alternative with native MDX and interactive islands.**

A local-first MDX note app where Markdown remains the base layer, and React/HTML
islands make notes interactive. AI helps only when invoked.

- Note = file `.mdx` thuần trên filesystem — portable, version-control được
- Static prose + interactive islands (mental model giống Partial Prerendering)
- AI là trợ lý được gọi (diff → approve), không phải tác giả mặc định
- Code do AI/user sinh chạy trong sandbox với permission manifest

## Bắt đầu

```bash
bun install
bun run dev
```

Package manager: **bun** (không dùng npm/pnpm/yarn).

## Cho AI agents (Codex, Claude Code)

- Đọc [AGENTS.md](AGENTS.md) trước tiên
- Công việc chia thành goal files trong [goals/](goals/) — làm theo thứ tự, xem `goals/README.md`
- Tài liệu thiết kế trong [docs/](docs/): vision, architecture, security model, conventions, roadmap

## Cấu trúc

```
src/main/        Electron main process (fs, SQLite index, IPC)
src/preload/     contextBridge API
src/renderer/    React UI (CodeMirror editor, MDX preview)
docs/            Design docs
goals/           Executable goals cho AI agents
example-vault/   Vault mẫu để dev/test
```
