# Architecture — mdx-vault

## Process model (Electron)

```
Electron
├── Main process (src/main/)
│   ├── ipc/                 IPC handlers (validate input bằng zod)
│   │   ├── vault-ipc.ts         vault:open / list-files / read-file / write-file
│   │   ├── index-ipc.ts         index:query / search / backlinks
│   │   ├── graph-ipc.ts         graph:get-snapshot / get-config / save-config
│   │   └── app-settings-ipc.ts  app-settings:get / update (main-frame only)
│   ├── services/
│   │   ├── vault-service.ts     đọc/ghi file, watcher (chokidar)
│   │   ├── index-service.ts     parse MDX AST → metadata
│   │   ├── db-service.ts        SQLite (better-sqlite3, FTS5)
│   │   ├── graph-query-service.ts bounded note topology from SQLite
│   │   ├── graph-config-service.ts versioned per-vault graph preferences
│   │   ├── app-settings.ts      settings v3, normalize + atomic persistence
│   │   └── safe-path.ts         safeJoin() chống path traversal
│   └── index.ts             BrowserWindow, app lifecycle
│
├── Preload (src/preload/)
│   └── contextBridge: expose window.vaultApi / window.indexApi / window.graphApi / window.appApi
│       — API hẹp, typed
│
├── Renderer (src/renderer/src/)
│   ├── app/                 App shell, layout, routing giữa các panel
│   ├── editor/              CodeMirror 6 (source mode)
│   ├── preview/             MDX compile + render, component registry, error boundary
│   ├── workbench/           item state machine, transactions, focus adapters
│   ├── graph/               shared React surface + imperative lazy Cytoscape adapter
│   ├── commands/            action registry + command palette
│   ├── settings/            searchable General/Editor/Workbench/Keymap UI
│   ├── explorer/            file tree, File Finder
│   ├── components/ui/       shadcn/ui components
│   └── lib/                 utils (cn, ...)
│
├── Shared (src/shared/)
│   ├── app-settings.ts      typed definition catalog + normalization
│   ├── graph.ts             zod graph/config/IPC contracts
│   ├── graph-model.ts       pure collapse, ambiguity, BFS, filters, truncation
│   └── keybindings.ts       chord parser/resolver, conflict + reserved policy
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
    graph-view.json      durable graph preferences; preserve if corrupt/unsupported
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

SQLite index và component cache là cache: mất/corrupt → rebuild từ files. Versioned
metadata such as `graph-view.json` and bookmarks is durable app state and is not
silently replaced when corrupt.

## IPC conventions

- Channel: `domain:action` (`vault:read-file`, `index:search`, `ai:generate-patch`)
- Mọi handler: validate payload bằng zod, resolve path qua `safeJoin(vaultRoot, relativePath)`
- Renderer không bao giờ gửi absolute path; chỉ gửi path tương đối so với vault root
- Response lỗi: trả về structured error `{ code, message }`, không throw raw

### Existing-file write boundary

`vault:write-file` là API **cập nhật file đã tồn tại**, không phải API tạo file. Main
process resolve lại file thật bên trong vault, mở handle hiện hữu và kiểm tra identity
trước/sau khi ghi. Nếu watcher hoặc chương trình ngoài đã xóa/thay file, write bị từ
chối thay vì âm thầm tạo lại path. Việc tạo mới chỉ đi qua các API explicit như
`vault:create-file`; mọi kiểm tra `safeJoin`, restricted directory và symlink vẫn nằm
ở main process.

## Workbench domain (Goal 22)

Renderer có một workbench domain làm source of truth cho vòng đời document. Một
`WorkbenchState` chứa `items` theo thứ tự hiển thị, `activeId`, MRU order, bounded
closed stack, transient MRU switch và `sessionId` của vault. File items giữ canonical
vault-relative path, kind, dirty/missing/autosave state và view state (cursor,
selection, scroll, view mode). Virtual items are explicit discriminated variants;
the Global Graph uses stable ID `virtual:graph:global` and has no path or file
capability. Cùng một file path trong một vault chỉ có một item.

`useWorkbench` là coordinator mỏng giữa pure state transitions và I/O adapters:

1. capture buffer/view state của item hiện tại;
2. save item dirty nếu transition yêu cầu;
3. prepare/load đích mà chưa mutate UI;
4. commit state + editor adapter chỉ khi request mới nhất vẫn sở hữu transaction;
5. restore document focus/view state sau commit.

Save/load fail, request cũ thua race, hoặc destination không tồn tại đều không được
commit tab/MRU/content nửa chừng. Rename note map identity tại chỗ; app delete chỉ
close sau filesystem success; vault switch tăng `sessionId` và xóa toàn bộ item cũ.
Watcher-driven disappearance giữ buffer/tab, đánh dấu `missing`, pause autosave và
yêu cầu Discard rõ ràng nếu buffer còn dirty.

Resource preparation cũng nằm trước commit. Image bytes phải đọc và browser-decode
thành công trước khi workbench thay active item; object URL thuộc item đã prepare và
được revoke khi request thua race, item đóng, vault reset hoặc component unmount.
File không có preview chỉ đi qua `vault:probe-file`: main process kiểm tra safe path,
restricted directory, symlink, tồn tại và readability nhưng không trả nội dung binary
cho renderer. Create-note flows dùng save → create → refresh → open; nếu bước open thất
bại, file vừa tạo được rollback vào trash thay vì để lại state nửa commit.

### Actions, keybindings, and focus ownership

- `commands/actions.ts` định nghĩa stable action IDs, metadata, context và default
  bindings. Command Palette, File Finder, AppMenuBar, toolbar, explorer và tab controls
  cùng dispatch registry này; không có shortcut executable list thứ hai.
- `shared/keybindings.ts` normalize `Mod`, resolve theo platform/context, bảo vệ
  editor/browser-owned editing chords, reject reserved chords và xử lý
  override/unbind/reset/conflict. Context ưu tiên là key recorder/dialog/settings/
  picker trước workspace, nên shortcut phía sau modal không mutate workbench.
- `useGlobalSurface` chỉ cho một global surface (File Finder, Command Palette,
  Search, Settings, Create, Export) sở hữu input tại một thời điểm. Cancel trả focus
  về invoker còn hợp lệ; action hoàn tất trả focus về document hoặc surface kế tiếp.
  Confirmation dialog có thể nằm trên surface bị suspend nhưng tự sở hữu context.
- Tab order hiển thị và MRU order là hai khái niệm riêng: arrow/Home/End điều hướng
  visual tabs; `Ctrl/Cmd+Tab` chỉ cycle transient MRU candidate và commit đúng một
  open/activate transaction.

### App settings v3

Non-secret settings dùng definition catalog chung trong `src/shared/app-settings.ts`
(key, category, label, description, control, default, normalize/reset). Snapshot
`version: 3` gồm theme, file-tree sort, editor font size, Workbench close policy và
keymap overrides. Main process là authority: IPC validate payload bằng zod, chỉ nhận
main frame, normalize lần nữa rồi ghi atomically vào `app-settings.json` dưới Electron
`userData`. Renderer chỉ optimistic-update qua `window.appApi`; write bị reject thì
reconcile về persisted snapshot và hiển thị lỗi. AI settings/secrets vẫn ở service
riêng và không đi qua catalog này.

### Native menu boundary

Trên Windows/Linux, native application menu được bỏ để Electron không chiếm các
workbench chords như `Ctrl+W`; `AppMenuBar` trong renderer dispatch cùng action
registry. Trên macOS, native menu vẫn giữ các standard Edit roles/OS behavior và chỉ
route những application actions được hỗ trợ. Clipboard, undo/redo và text navigation
tiếp tục thuộc editor/input đang focus.

## Graph domain (Goal 24)

Graph View is a notes-only projection of the current vault's rebuildable SQLite index.
`GraphQueryService` performs one bounded bulk read, reuses the Search grammar for file
membership and ordered groups, then delegates duplicate collapse, unresolved/ambiguous
ghosts, visible degree, local incoming/outgoing BFS, orphan filtering, and deterministic
truncation to pure shared functions. Initial hard caps are 2,500 returned nodes, 10,000
edges, 300 query characters, eight groups, and local depth four.

The bridge exposes only JSON/zod graph contracts and vault-relative paths. Every graph
handler requires the main frame, validates request and response, and rejects a result
when the vault session changes during the request. The renderer never reads note files
for topology and never receives the absolute vault root.

Global Graph is a deduplicated virtual workbench item. Local Graph is the eighth
controlled Right Panel destination and clears whenever the active item is not a present
editable note. Both compose the same lazy `GraphSurface`; React owns filters, semantic
states, settings, navigator/details, and existing note-action ports, while the isolated
Cytoscape adapter owns only its canvas, built-in CoSE layout, viewport/events,
`ResizeObserver`, theme synchronization, layout stop, and destruction.

Vault-scoped preferences live in `.app/graph-view.json` rather than global device
settings or SQLite. Main process reads/writes version 1 through an atomic serialized
queue with optimistic revisions. Missing files produce defaults; corrupt or unsupported
bytes remain untouched and the renderer reports the relative recovery path.

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
