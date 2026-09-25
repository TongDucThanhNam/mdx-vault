# Bun 1.4 Runtime Boundary

mdx-vault uses Bun 1.4 as its package manager, script runtime, and test runner. The
desktop application remains an Electron application, so Bun-only APIs are intentionally
limited to files executed directly by Bun.

## What migrated

- `package.json` pins `bun@1.4.0`; `bun.lock` is the only dependency lockfile.
- Package scripts no longer recurse through `npm run`.
- Bun tooling, Node, and renderer typechecks run concurrently with `bun run --parallel`.
- Test files run across four isolated Bun worker processes with `bun test --parallel=4`.
- `bun run check` sequences the runtime gate, lint, typecheck, and tests with Bun's
  script orchestrator to avoid CPU oversubscription. The three TypeScript projects and
  the test files still run in parallel internally.
- Bun-owned utilities use native APIs such as `Bun.Glob`, `Bun.file`, and `Bun.write`.
- Bun-owned utilities are typechecked against the matching `@types/bun` 1.4 API surface.
- `bun run verify:bun` rejects an old Bun runtime, foreign lockfiles, or Bun-only APIs
  accidentally added to packaged Electron source.

## What must stay Electron-compatible

| Area | Runtime | Allowed APIs |
| --- | --- | --- |
| `scripts/`, `bun test` | Bun 1.4 | `Bun.*`, `bun:*`, and Node-compatible APIs |
| `src/main/` | Electron main process | Electron and Node APIs |
| `src/preload/` | Electron sandboxed preload | Narrow Electron/contextBridge APIs |
| `src/renderer/` | Chromium renderer | Browser APIs only |

`Bun.WebView` is a headless browser-automation API, not a desktop application window,
so it cannot replace `BrowserWindow`. Likewise, `bun:sqlite` and `Bun.file` are not
available in Electron's main process. The production index therefore continues to use
`better-sqlite3`, rebuilt for Electron's ABI, and vault I/O continues to use Node file
APIs behind the existing validated IPC boundary.

`Bun.markdown` is also not a substitute for the preview pipeline. mdx-vault needs MDX,
custom remark/rehype transforms, source mapping, trusted component islands, and explicit
sanitization. Bun's raw Markdown HTML output is unsanitized and would violate the trust
model in `docs/security.md`.

If Bun later ships a supported desktop window host, moving the application runtime is a
separate architecture migration. It must preserve context isolation, sandboxed islands,
path validation, atomic writes, native packaging, and the current IPC permission model.
