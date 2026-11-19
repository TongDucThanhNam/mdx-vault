# mdx-vault

**Obsidian alternative with native MDX and interactive islands.**

A local-first MDX note app where Markdown remains the base layer, and React/HTML
islands make notes interactive. AI helps only when invoked.

- Note = file `.mdx` thuáº§n trÃªn filesystem â€” portable, version-control Ä‘Æ°á»£c
- Static prose + interactive islands (mental model giá»‘ng Partial Prerendering)
- AI lÃ  trá»£ lÃ½ Ä‘Æ°á»£c gá»i (diff â†’ approve), khÃ´ng pháº£i tÃ¡c giáº£ máº·c Ä‘á»‹nh
- Code do AI/user sinh cháº¡y trong sandbox vá»›i permission manifest

## Báº¯t Ä‘áº§u

```bash
bun --version # 1.4.0 or newer
bun install
bun run dev
```

Package manager and project tooling: **Bun 1.4** (khÃ´ng dÃ¹ng npm/pnpm/yarn).
`bun run check` runs the Bun runtime gate, lint, Bun-tool/app TypeScript projects,
and the test suite. The packaged desktop app still runs in Electron; see
[Bun 1.4 runtime boundary](docs/bun-1.4-runtime.md).

## Cho AI agents (Codex, Claude Code)

- Äá»c [AGENTS.md](AGENTS.md) trÆ°á»›c tiÃªn
- CÃ´ng viá»‡c chia thÃ nh goal files trong [goals/](goals/) â€” lÃ m theo thá»© tá»±, xem `goals/README.md`
- TÃ i liá»‡u thiáº¿t káº¿ trong [docs/](docs/): vision, architecture, security model, conventions, roadmap

## Cáº¥u trÃºc

```
src/main/        Electron main process (fs, SQLite index, IPC)
src/preload/     contextBridge API
src/renderer/    React UI (CodeMirror editor, MDX preview)
docs/            Design docs
example-vault/   Vault máº«u Ä‘á»ƒ dev/test
```
