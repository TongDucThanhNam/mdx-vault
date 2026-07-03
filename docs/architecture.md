# Architecture — mdx-vault

## Process model (Electron)

```
Electron
├── Main process (src/main/)
│   ├── ipc/                 IPC handlers (validate input bằng zod)
│   │   ├── vault-ipc.ts     vault:open / list-files / read-file / write-file
│   │   └── index-ipc.ts     index:query / search / backlinks
│   ├── services/
│   │   ├── vault-service.ts     đọc/ghi file, watcher (chokidar)
│   │   ├── index-service.ts     parse MDX AST → metadata
│   │   ├── db-service.ts        SQLite (better-sqlite3, FTS5)
│   │   └── safe-path.ts         safeJoin() chống path traversal
│   └── index.ts             BrowserWindow, app lifecycle
│
├── Preload (src/preload/)
│   └── contextBridge: expose window.vaultApi / window.indexApi — API hẹp, typed
│
├── Renderer (src/renderer/src/)
│   ├── app/                 App shell, layout, routing giữa các panel
│   ├── editor/              CodeMirror 6 (source mode)
│   ├── preview/             MDX compile + render, component registry, error boundary
│   ├── vault/               client wrapper cho vaultApi, state file hiện tại
│   ├── explorer/            file tree, quick switcher
│   ├── components/ui/       shadcn/ui components
│   └── lib/                 utils (cn, ...)
│
└── Sandbox (iframe trong preview — Goal 05)
    ├── chạy untrusted component (AI-generated / arbitrary HTML/JS)
    ├── không Node.js, không filesystem, không network mặc định
    └── giao tiếp DUY NHẤT qua postMessage RPC
```

Ranh giới trách nhiệm:

- **Main**: mọi thứ chạm filesystem/SQLite/OS. Không render UI.
- **Preload**: cầu nối duy nhất. Không expose `fs`, `path`, `ipcRenderer` thô.
- **Renderer**: UI + compile/render MDX cho nội dung **đã trust**.
- **Sandbox iframe**: nội dung **không trust**. Xem [security.md](security.md).

## Vault layout (folder của người dùng)

```
/my-vault
  /notes                notes .md/.mdx — source of truth
  /assets               ảnh, datasets (csv/json)
  /interactives         custom components (mỗi cái một folder)
    /bayes-simulator
      component.tsx
      manifest.json     tên, props schema, permissions, dependencies
      README.md
      tests.ts
  /.app                 app-managed, có thể xóa & rebuild
    index.sqlite
    component-cache/
```

## Content pipeline

```
.mdx source
  → gray-matter (frontmatter)
  → unified: remark-parse + remark-mdx + remark-gfm + remark-frontmatter
      + custom remark plugin: wikilinks [[...]], tags
  → (index path)  visit AST → headings/links/tags/components → SQLite
  → (render path) @mdx-js/mdx evaluate → React component
      + rehype-sanitize cho vùng safe HTML
      + components map từ registry (trusted islands)
      + <Interactive src>/<SandboxedHTML src> → sandbox iframe (Goal 05)
```

Quy tắc: **index từ AST của source, không bao giờ index từ rendered HTML.**

## SQLite schema (khởi điểm)

```sql
CREATE TABLE notes (
  id TEXT PRIMARY KEY,           -- hash của relative_path
  vault_path TEXT NOT NULL,
  relative_path TEXT NOT NULL,
  title TEXT,
  mtime_ms INTEGER NOT NULL,
  content_hash TEXT NOT NULL
);
CREATE TABLE note_links (source_note_id TEXT NOT NULL, target TEXT NOT NULL);
CREATE TABLE note_tags (note_id TEXT NOT NULL, tag TEXT NOT NULL);
CREATE TABLE note_components (note_id TEXT NOT NULL, component_name TEXT NOT NULL);
CREATE VIRTUAL TABLE notes_fts USING fts5(note_id, title, body);
```

Index là cache: mất/corrupt → rebuild từ files, không mất dữ liệu người dùng.

## IPC conventions

- Channel: `domain:action` (`vault:read-file`, `index:search`, `ai:generate-patch`)
- Mọi handler: validate payload bằng zod, resolve path qua `safeJoin(vaultRoot, relativePath)`
- Renderer không bao giờ gửi absolute path; chỉ gửi path tương đối so với vault root
- Response lỗi: trả về structured error `{ code, message }`, không throw raw

## AI layer (Goal 06)

TanStack AI (`@tanstack/ai`, `@tanstack/ai-react`) — beta, nên bọc sau interface riêng để thay được SDK:

```ts
interface AssistantRuntime {
  streamChat(input: ChatInput): AsyncIterable<AssistantEvent>
  runToolCall(call: ToolCall): Promise<ToolResult>
  generatePatch(input: PatchRequest): Promise<Patch>
}
```

Luồng: selected text → AI proposes patch → compiler validate → (repair nếu lỗi) → user approve → write vault. AI tool execution boundary nằm ở **main process** (permission manager quyết định tool nào được chạy).
