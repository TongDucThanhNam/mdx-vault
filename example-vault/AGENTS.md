# AGENTS.md — mdx-vault vault

Bạn đang đứng trong một **vault** của app mdx-vault (Obsidian-alternative, MDX-native). Nhiệm vụ điển hình của agent ở đây: tạo/sửa **notes MDX**, đặc biệt là **Interactive Notes** (dùng skill `interactive-mdx` trong `.agents/skills/`).

## Cấu trúc vault

```
notes/          # notes .mdx / .md — nơi làm việc chính
interactives/   # widget custom: mỗi folder = component.tsx|index.html + manifest.json (BẮT BUỘC)
assets/         # ảnh, datasets (csv/json)
templates/      # template tạo note — có interactive-note.mdx
exports/        # output export từ app — KHÔNG sửa tay
.agents/        # skills project-scope cho agent
```

## Convention note (app enforce khi render)

- Frontmatter: `title`, `tags[]`, `aliases[]`, `created` — key lạ không gây lỗi. Interactive note thêm `theme: interactive-note`.
- Wikilink `[[Note Name]]` / `[[Note Name|hiển thị]]` — resolve theo title/alias/filename.
- **Prose và behavior tách rời**: KHÔNG viết `import`/`export`/function trong MDX. Note phải đọc được như văn bản thuần.
- Ba loại island: (1) registry component PascalCase không cần import — danh sách đầy đủ ở `.agents/skills/interactive-mdx/references/components.md`; (2) `<Interactive src="../interactives/ten-folder" />`; (3) `<SandboxedHTML src="../interactives/x/index.html" />`.
- Widget custom trong `interactives/`: bắt buộc `manifest.json` (`runtime: "react" | "html"`, `permissions` mặc định all-false). Chạy trong iframe sandbox — không fs/network trừ khi manifest cho phép.

## Hard rules

1. KHÔNG bịa số liệu benchmark/evidence. Chưa đo → để trống cho app hiện `[CHƯA CÓ]`.
2. KHÔNG sửa `exports/`, không đổi cấu trúc folder gốc.
3. Tên component registry phải đúng danh sách trong references/components.md — tên sai sẽ render placeholder cảnh báo trong app.
4. Agent không render được preview: tự kiểm bằng cách (a) JSX tag đóng/mở cân, (b) props đúng schema trong components.md, (c) frontmatter YAML hợp lệ. Việc xem render cuối cùng là của user trong app.
5. Tiếng Việt cho prose; thuật ngữ Anh kèm mô tả Việt ở lần dùng đầu.

## Tạo Interactive Note

Đọc và làm theo `.agents/skills/interactive-mdx/SKILL.md` — quy trình 6 phase, bắt đầu từ `templates/interactive-note.mdx`.
