# Architecture — mdx-vault

## Toolchain/runtime boundary

```
Bun 1.4 (development and CI)
├── package install + bun.lock
├── package scripts and Bun-native utilities
├── script orchestration + parallel TypeScript projects
└── parallel isolated test workers

Electron application (development and packaged production)
├── main: Electron + Node-compatible APIs
├── preload: sandboxed contextBridge
└── renderer: Chromium browser APIs
```

`Bun.*` and `bun:*` are not available inside Electron. `bun run verify:bun` enforces
that boundary while allowing Bun-native APIs in project tooling. Detailed rationale:
[Bun 1.4 runtime boundary](bun-1.4-runtime.md).

## Process model (Electron)

```
Electron
├── Main process (src/main/)
│   ├── ipc/                 IPC handlers (validate input bằng zod)
│   │   ├── vault-ipc.ts         vault:open / list-files / read-file / write-file
│   │   ├── index-ipc.ts         index:query / search / backlinks
│   │   ├── graph-ipc.ts         graph:get-snapshot / get-config / save-config
│   │   ├── interactive-authoring-ipc.ts  bounded create + zero-capability proof
│   │   └── app-settings-ipc.ts  app-settings:get / update (main-frame only)
│   ├── services/
│   │   ├── vault-service.ts     đọc/ghi file, watcher (chokidar)
│   │   ├── index-service.ts     parse MDX AST → metadata
│   │   ├── db-service.ts        SQLite (better-sqlite3, FTS5)
│   │   ├── graph-query-service.ts bounded note topology from SQLite
│   │   ├── graph-config-service.ts versioned per-vault graph preferences
│   │   ├── interactive-authoring-service.ts transactional scaffold/rollback
│   │   ├── interactive-typecheck-service.ts fixed offline semantic checker
│   │   ├── app-settings.ts      settings v6, normalize + atomic persistence
│   │   └── safe-path.ts         safeJoin() chống path traversal
│   └── index.ts             BrowserWindow, app lifecycle
│
├── Preload (src/preload/)
│   └── contextBridge: expose window.vaultApi / window.indexApi / window.graphApi / window.appApi
│       — API hẹp, typed
│
├── Renderer (src/renderer/src/)
│   ├── app/                 App shell, layout, routing giữa các panel
│   ├── editor/              CodeMirror 6, MDX registry intelligence, editor setup
│   ├── interactive/         Proof desk, language worker/client, IDE command adapters
│   ├── preview/             MDX compile + render, component registry, error boundary
│   ├── workbench/           item state machine, transactions, focus adapters
│   ├── graph/               shared React surface + imperative lazy Cytoscape adapter
│   ├── commands/            action registry + command palette
│   ├── settings/            searchable General/Editor/Workbench/Keymap UI
│   ├── i18n/                typed English/Vietnamese catalogs + locale provider
│   ├── explorer/            file tree, File Finder
│   ├── components/ui/       shadcn/ui components
│   └── lib/                 utils (cn, ...)
│
├── Shared (src/shared/)
│   ├── app-settings.ts      typed definition catalog + normalization
│   ├── graph.ts             zod graph/config/IPC contracts
│   ├── graph-model.ts       pure collapse, ambiguity, BFS, filters, truncation
│   ├── interactive-*.ts     project/create/proof/language protocols
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
  → (structure path) inert AST → stable headings + bounded sections
  → (index path) headings/sections/links/tags/components → SQLite + FTS5
  → (render path) @mdx-js/mdx evaluate → React component
      + rehype-sanitize cho vùng safe HTML
      + components map từ registry (trusted islands)
      + <Interactive src>/<SandboxedHTML src> → sandbox iframe (Goal 05)
```

Quy tắc: **index từ AST của source, không bao giờ index từ rendered HTML.**

GOAL-32 Reading remains a single document surface. Its worker-backed compiler
keeps one active request and coalesces newer requests to the latest source;
renderer-local cache deduplication and trusted evaluation remain unchanged.
The last successful React document stays mounted during a pending or failed
compile, scoped to the active note. After safe HTML sanitization, the renderer
adds source offsets to generated block elements and neutral wrappers around
trusted MDX flow islands. These offsets drive Reading↔Source/Live position
transfer; tab pixel scroll is replayed after Reading's first layout.

GOAL-35 Reading paper is a renderer-scoped edition selected from the resolved
app theme and the additive `readingPaper` preference. Trusted registry islands
inherit note tokens, while untrusted custom islands keep a neutral light frame
without changing postMessage, CSP, or iframe sandbox attributes. Hover previews
share the paper edition. Print and the independent export template force the
light edition. The single document grid uses persisted, bounded panel widths;
separators change CSS tracks without persisting tabs or pane layout.

GOAL-36 export compiles a separate Tailwind utility entry during the main build.
Its sources are limited to the legacy registry island components and shared
Button, with no preflight or app-wide stylesheet. The generated CSS is inlined
with selectors prefixed by `:where(.mdx-vault-export)` after the common note CSS;
`@property` registrations remain top-level, and native `in-*`
islands continue to use the same note stylesheet as Reading. Main builds do not
run Tailwind at export time. Static policies render ruled cards with a visible
document-level snapshot notice, while interactive registry roots hydrate against
the same scoped light tokens. The export CSP and custom iframe sandbox remain
unchanged; validated sandbox resize messages use the Reading height policy.
The export IR assembler keeps paragraphs containing inline trusted JSX separate
from ordinary Markdown batches, so a registry component after a table retains
its component identity and styling in static and hydrated output. Paragraphs
containing only trusted JSX and inter-island whitespace are unwrapped to avoid
invalid `<p>` wrappers around block-rendering islands.

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
CREATE TABLE note_headings (
  note_id TEXT NOT NULL, id TEXT NOT NULL, depth INTEGER NOT NULL,
  source_from INTEGER NOT NULL, source_to INTEGER NOT NULL
);
CREATE TABLE note_sections (
  note_id TEXT NOT NULL, position INTEGER NOT NULL, heading_id TEXT,
  source_from INTEGER NOT NULL, source_to INTEGER NOT NULL, body TEXT NOT NULL
);
CREATE VIRTUAL TABLE notes_fts USING fts5(note_id, title, body);
CREATE VIRTUAL TABLE note_sections_fts USING fts5(note_id, section_position, heading, body);
```

SQLite index và component cache là cache: mất/corrupt → rebuild từ files. Versioned
metadata such as `graph-view.json` and bookmarks is durable app state and is not
silently replaced when corrupt.

`analyzeMdxStructure()` is the single heading/section projection for index and
renderer. It parses source as inert syntax only: no compile, import, JSX execution or
preview component evaluation. Heading IDs handle duplicates deterministically and
carry UTF-16 ranges. Section text is bounded before persistence. Search first keeps
the existing note-level membership/filter query, then attaches the best matching
section for exact heading navigation.

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

### App settings v6

Non-secret settings dùng definition catalog chung trong `src/shared/app-settings.ts`
(key, category, label, description, control, default, normalize/reset). Snapshot
`version: 6` gồm theme, resolved-locale preference, interface density/UI scale,
file-tree sort, Source typography/wrap/structure preferences, Workbench close policy,
Page Preview behavior, và keymap overrides. Main process là authority:
IPC validate payload bằng zod, chỉ nhận
main frame, normalize lần nữa rồi ghi atomically vào `app-settings.json` dưới Electron
`userData`. Renderer chỉ optimistic-update qua `window.appApi`; write bị reject thì
reconcile về persisted snapshot và hiển thị lỗi. AI settings/secrets vẫn ở service
riêng và không đi qua catalog này.

Renderer áp dụng density/UI scale từ confirmed snapshot vào document root; locale
`system | en | vi` được resolve trong typed i18n provider và cập nhật thuộc tính
`lang`. Catalog en/vi bắt buộc có cùng key ở compile time. Migrate từ v1–v5 chỉ bổ
sung default, không rewrite vault content.

Source editor preferences được resolve từ confirmed snapshot rồi truyền qua React
context. CSS variables sở hữu typography; CodeMirror `Compartment` reconfigure tab
size, note/code wrapping, ruler, indent guides và whitespace mà không recreate
buffer/history. Raw MDX Source được route qua code-buffer contract (full-width,
no-wrap mặc định); Live mode mới dùng note-buffer contract với prose wrapping.
Selection telemetry (`Ln`, `Col`) dùng cùng adapter cho MDX và editable text buffers.
MDX diagnostics gọi `@mdx-js/mdx.compile()` sau debounce để parse source như data;
generated JavaScript không bao giờ được evaluate và preview trust pipeline không
tham gia đường này.

### Responsive single-pane shell (Goal 26)

`workspace-layout.ts` chia viewport thành `wide` (>=1360px), `compact`
(800–1359px) và `overlay` (<800px CSS width, bao gồm physical zoom). Wide dùng dock
tracks riêng. Compact chỉ giữ left track; Context/AI chuyển vào một supplementary
dock có tab. Overlay lấy toàn bộ grid track cho document và layer side docks lên trên.
Đây vẫn là single-pane workbench. GOAL-27 intentionally keeps this ownership
model and uses anchored editor overlays instead of a split/peek tree.

The named Outline panel receives a deferred structure projection of the active unsaved
buffer, with indexed headings only as a load/error fallback. Source/Live resolve the
active item from the CodeMirror caret; Reading observes headings against its nested
scroll root. Outline owns the hierarchy connector and auto-scroll, then calls canonical
`editorInteractions.revealHeading`. `MainEditor` does not reserve an inline
rail/minimap track between document and supplementary dock.

### Single-pane IDE intelligence (Goal 27)

Raw MDX Source lấy component/prop completion và hover metadata từ trusted in-app
registry. Zod object shapes are inspected as app-owned metadata; note source is not
compiled, emitted or evaluated on this path. The existing wikilink and slash-command
paths remain independent.

Interactive `.ts/.tsx` reuses the GOAL-25 lazy offline TypeScript worker. Its typed,
versioned protocol now exposes project-bounded References, Rename planning and code
actions in addition to diagnostics/completion/hover/signature/definition. References
are read-only and navigate through the canonical workbench coordinator. Rename is
returned only when every edit belongs to the active buffer; code actions reject
commands, new files, cross-file changes, overlapping edits and imports outside the
existing dependency policy. Accepted edits become one CodeMirror transaction and one
Undo unit. No new IPC or background file writer is involved.

### Native menu boundary

Trên Windows/Linux, native application menu được bỏ để Electron không chiếm các
workbench chords như `Ctrl+W`; compact `AppMenuBar` trong renderer dùng một trigger,
đặt File/Edit/View/Go/Window trong các submenu và dispatch cùng action registry.
Vault selector cạnh trigger cũng dispatch canonical `vault.open`, nên vẫn đi qua
transactional switch hiện có. Trên macOS, native menu vẫn giữ các standard Edit
roles/OS behavior và chỉ route những application actions được hỗ trợ. Clipboard,
undo/redo và text navigation tiếp tục thuộc editor/input đang focus.

## Interactive authoring domain (Goal 25)

Một interactive React là project vật lý dưới `interactives/<slug>/`; mỗi file vẫn là
một canonical workbench item, không có project tab ảo. Note header, Command Palette và
slash command cùng dispatch `interactive.create` vào một controller. Controller save
note và gửi UTF-16 insertion offset + expected content hash qua narrow
`interactive:create`; main process re-read, validate path/symlink/collision, semantic
typecheck + bundle app-owned starter, rồi commit `component.tsx`, `manifest.json`,
`README.md` và note như một transaction có rollback.

`InteractiveProofWorkbench` compose editor hiện có với Proof, session props và Problems.
Project snapshots chỉ chứa bounded vault-relative source. TypeScript intelligence chạy
trong renderer Web Worker được lazy-create cho active `.ts/.tsx`; worker dùng fixed
ES2022/DOM/React virtual project, packaged declaration assets, project/file/request
versions và không đọc vault, config, plugin hay network. Main compile path dùng cùng
`InteractiveLanguageProject` semantic contract trước esbuild, nên manual scaffold,
authoring proof và AI repair cùng một diagnostic model.
Windows package copy fixed TypeScript/React declaration assets vào `resources` và
unpack esbuild platform binary cùng React runtime closure, nên checker và bundler hoạt
động offline mà không phụ thuộc cây `node_modules` của máy dev.

Authoring proof là explicit mode riêng của sandbox contract. Compile/document creation
vẫn ở main; code chỉ execute trong iframe `sandbox="allow-scripts"` qua custom readonly
protocol. Consent cho `(vault session, project root)` chỉ ở renderer memory. Existing
code bắt đầu `Not run`, trừ exact current hash đã được normal permission store allow;
app-owned starter có thể bắt đầu proof sau transaction. Authoring mode không ghi
permission decision, luôn ép network/filesystem/data off, và giữ last-known-good
document khi source mới có compile issue. Note Reading preview tiếp tục dùng normal
content-hash permission flow.

Export services được dynamic-import khi `export:scan`/`export:run` thực sự được gọi.
Việc này giữ React registry/export dependencies ngoài main startup chunk; packaged app
không phải eagerly evaluate UI modules trước khi tạo BrowserWindow.

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

## Editor analysis and typing (Goal 27 follow-up)

Source/Live retain one CodeMirror buffer. Tab size configures both the displayed
tab width and `indentUnit`; the owned Tab binding preserves snippet precedence,
then completion acceptance, then caret-local soft-tab insertion. Appearance
changes reconfigure existing compartments and CSS metrics without remounting
the buffer. Successful tab-view restoration is applied once, not replayed over
subsequent user input by delayed layout retries.

`EditorAnalysisClient` owns lazy module workers for Outline (120ms debounce)
and MDX syntax diagnostics (650ms). Each client keeps one running request and
at most one replacement, resolves superseded work to null and ignores obsolete
request IDs. Outline publication is also scoped to vault session/file; lint
publication checks CodeMirror document identity. Workers terminate on session
change/editor destruction. Source is bounded to 2,097,152 UTF-16 code units.
Renderer workers build as ES modules (`worker.format: 'es'`) so the analysis
worker can load parser chunks lazily in both dev and the built file renderer.
Analysis only parses source as data: no vault module resolution, code emission,
evaluation, filesystem or IPC capability. Failure leaves editing/save available.

Outline is memoized with stable selection/bookmark callbacks so normal cursor
and buffer updates do not rebuild every heading row. MDX block decorations map
ordinary text edits, rebuilding only when delimiter-bearing lines or line
structure change; scrolling alone does not rescan the whole document.

See [research and measurements](research/editor-readability-and-typing-2026-09.md).

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
