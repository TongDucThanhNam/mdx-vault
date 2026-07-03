# MCP Setup — mdx-vault

MCP servers giúp agent tra cứu docs mới nhất và thao tác registry component khi implement.

## Đã cấu hình sẵn

### Codex (global, `~/.codex/config.toml`)

Đã add qua CLI (2026-07-03):

```bash
codex mcp add context7 -- cmd /c npx -y @upstash/context7-mcp
codex mcp add shadcn  -- cmd /c npx -y shadcn@latest mcp
```

Kiểm tra: `codex mcp list`. Gỡ: `codex mcp remove <name>`.

### Claude Code (project-level, `.mcp.json` ở repo root)

`context7` và `shadcn` đã khai báo trong [.mcp.json](../.mcp.json) — Claude Code tự nhận khi mở project.

## Dùng để làm gì

| Server       | Khi nào dùng                                                                                                                                                                     |
| ------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **context7** | Tra docs theo version cho: `@mdx-js/mdx` (evaluate API), Electron security, TanStack AI (beta, đổi API nhanh — LUÔN tra trước khi viết code Goal 06), CodeMirror 6, Tailwind v4. |
| **shadcn**   | Tìm/xem/add component từ shadcn registry thay vì đoán API.                                                                                                                       |

## Ghi chú

- Cả hai server chạy qua `npx` nên cần network lần đầu.
- Trên Windows phải bọc `cmd /c` khi khai báo command (như trên) — gọi `npx` trực tiếp sẽ fail vì `npx` là `.cmd` shim.
- Nếu thêm MCP server mới cho project: thêm vào cả `.mcp.json` (Claude Code) và `codex mcp add` (Codex), rồi cập nhật file này.
