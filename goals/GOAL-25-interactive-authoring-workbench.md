# GOAL-25 — Interactive Authoring Workbench + TypeScript Intelligence

> File này được tạo bởi `create-goal` skill.
> Agent thực thi: đọc toàn bộ file này trước khi làm bất kỳ thứ gì.
> Phải đọc và tuân theo `AGENTS.md`, `docs/security.md`, `DESIGN.md`,
> `goals/README.md`, và các References bắt buộc bên dưới trước khi code.

---

## Objective

Biến việc tạo và chỉnh sửa React vault interactive từ một plain-text workflow
thành một authoring journey hoàn chỉnh, offline và an toàn:

1. từ note đang edit, user tạo một interactive bằng một action duy nhất;
2. app transactionally tạo `component.tsx`, `manifest.json`, `README.md` và chèn
   `<Interactive src="..." />` đúng vị trí;
3. source mở trong một dedicated **Interactive Proof** surface có CodeMirror,
   sandbox preview, preview props và Problems ledger;
4. `.ts/.tsx` trong interactive có TypeScript semantic diagnostics,
   completion/approved auto-import, hover, signature help và local
   go-to-definition;
5. manual/AI compile paths dùng cùng structured compile + typecheck contract;
6. authoring preview không làm yếu content-hash permission model của preview
   trong note và không được cấp network/filesystem/data capability.

Mục tiêu là IDE-grade TypeScript assistance cho đúng bounded interactive
project. Việc dùng wire protocol LSP không phải mục tiêu; TypeScript Language
Service trong một offline virtual project là contract bắt buộc.

---

## Context

- **Lý do**: App đã cho mở/sửa `.tsx`, nhưng hiện tại user vẫn phải tự tạo
  folder/manifest/link, nhớ sandbox contract, và đợi preview mới thấy lỗi.
  Syntax highlight không đủ để biến “MDX native interactives” thành một product
  journey có thể dùng thường xuyên.
- **Product thesis**: Markdown vẫn là base layer; custom React code chỉ xuất hiện
  khi user chủ động tạo/sửa interactive. AI có thể hỗ trợ nhưng không được trở
  thành con đường duy nhất.
- **Ưu tiên**: security + correctness > coherent authoring UX > feature breadth
  > implementation speed.
- **Người thực hiện**: AI Agent; không có human review giữa từng bước.
- **Ngày tạo**: 2026-07-26.
- **Depends on**: GOAL-05, GOAL-06, GOAL-16, GOAL-18, GOAL-22. Giả định
  GOAL-01..24 đã hoàn tất.

### Research conclusions — không được quay lại tranh luận từ đầu

- CodeMirror `javascript({ jsx: true, typescript: true })` cung cấp parser,
  syntax highlight và local language data; nó không phải project-aware
  TypeScript service.
- Repo không có LSP client/server, `tsserver`, TypeScript worker, semantic
  diagnostics hoặc project-aware completion.
- `esbuild` hiện bundle/transpile và dependency-guard component draft, nhưng
  không thay thế TypeScript type checking.
- `@valtown/codemirror-ts` đã archived từ 2025-09-19; KHÔNG thêm package này.
- Không đổi editor sang Monaco. CodeMirror, editor state/view, workbench tabs và
  theme hiện tại phải được giữ.
- Kiến trúc mục tiêu là TypeScript Language Service trong dedicated renderer Web
  Worker, dùng bounded offline VFS. `@typescript/vfs` là helper được ưu tiên nếu
  compatible với TypeScript đang pin; nếu verification spike chứng minh không
  compatible, implement một `LanguageServiceHost` nhỏ trên public TypeScript API
  trong cùng boundary, không đổi kiến trúc.
- Không dùng CDN type libraries, Automatic Type Acquisition, npm/network lookup
  hay đọc `tsconfig.json`/TypeScript plugin từ vault.
- Language worker phân tích source như data; nó không emit/evaluate/run source.
  Executable preview vẫn chỉ chạy trong iframe sandbox hiện có.

---

## Current State

| Item | Giá trị hiện tại |
|------|------------------|
| Editor | CodeMirror 6; `MdxEditor` cho note và `TextFileEditor` cho text files |
| TSX mode | `TextFileEditor.getLanguageExtension()` dùng `javascript({ jsx: true, typescript: true })` |
| MDX assistance | custom MDX highlighter, `[[` completion, insert palette, slash commands, custom Ctrl/Cmd+Click |
| “Go to definition” | Chỉ hiểu wikilink, MDX path, `<Interactive src>`, registry tag; không hiểu TS symbol/import |
| Text lifecycle | `useTextFileEditor` load/save existing text file, autosave 1 giây, dirty/missing state |
| File creation | Normal `vault:create-file` chỉ tạo `.md/.mdx`; chưa có user-facing transaction để scaffold non-note interactive files |
| AI creation | `approveAiPatch` có transaction riêng tạo component/manifest/README, compile trước và rollback nếu fail |
| Compile | `SandboxService.compileDraft()` + `buildInteractiveBundle()` dùng esbuild và dependency guard |
| Dependency allowlist | Chỉ `react`, `react-dom`; relative imports phải ở trong interactive root |
| Typecheck | App build dùng `tsc`; vault interactive compile không có semantic TypeScript typecheck |
| Preview errors | `SandboxHost` hiện card lỗi compile/load; không có editor lint gutter, Problems ledger hay click-to-source |
| Permission model | Note preview approval gắn với content hash; source thay đổi thì permission cũ không được tái sử dụng |
| Sandbox runtime | iframe `sandbox="allow-scripts"`/custom protocol, restrictive CSP, zod postMessage schemas |
| App architecture | context isolation + renderer sandbox + narrow preload bridge; relative paths only |
| Workbench | Một canonical vault-relative path = một tab; text file tabs đã hoạt động |
| Design | Editorial paper/ink system; mono writing voice, serif reading voice, hard 2px rules, red issue / blue result |
| Baseline verification | 2026-07-26: 15 focused editor/sandbox/AI tests pass; `bun run typecheck` pass |
| Runtime packages | React 19, TypeScript 5.9.3, CodeMirror 6, Electron 39, Vite/electron-vite, esbuild |

### Current authoring gaps

1. User không thể tạo `interactives/<slug>/` từ normal app workflow.
2. Không có single transaction nối note insertion với component scaffold.
3. `.tsx` không có semantic diagnostics, JSX prop completion, React API hover,
   safe auto-import hoặc local import navigation.
4. Lỗi chỉ xuất hiện muộn ở sandbox preview, không map về source range.
5. Mỗi content hash mới đi qua normal permission review; không có session-scoped,
   zero-capability proof mode dành cho author đang sửa code.
6. AI-generated draft có compile-repair nhưng manual editing không dùng cùng
   validation contract.
7. Không có một surface gom component source, manifest, preview props, proof và
   Problems thành một journey.

---

## Target State

### 1. One-command transactional scaffold

Thêm một canonical workspace action, ví dụ `interactive.create`, được route từ:

- nút **New interactive** có discoverability trong editable note header;
- Command Palette;
- slash command `/interactive` trong MDX editor.

Ba entry point PHẢI gọi cùng một controller; không duplicate validation,
mutation hoặc focus behavior.

Action chỉ enabled khi:

- có vault mở;
- active item là editable `.md/.mdx` note không missing;
- note buffer có thể save thành công;
- editor có caret/selection snapshot hợp lệ.

Dialog “Create interactive” gồm:

- display name;
- folder slug auto-derived, user có thể sửa;
- starter: `Blank` hoặc `Stateful control`;
- read-only destination preview: `interactives/<slug>/`;
- plain-language statement: code chạy trong isolated proof, permissions mặc định
  off;
- primary action **Create interactive**; cancel restore focus về invocation.

Validation contract:

- display name: trimmed, 1..80 Unicode characters;
- slug: lowercase kebab-case, 1..64 characters;
- destination cố định dưới `interactives/<slug>/`;
- reject traversal, absolute path, reserved `.app/.trash/.git/node_modules`,
  symbolic-link ancestors, case-insensitive collision và existing partial folder;
- template ID là closed enum, không nhận arbitrary template/source từ renderer.

Trước mutation, controller save active note và lấy:

- canonical note relative path;
- CodeMirror UTF-16 insertion offset;
- expected content hash/revision sau save.

Main process dùng một narrow, zod-validated `interactive:create` transaction:

1. re-read note và verify expected hash/revision;
2. build app-owned starter source, strict manifest và human-authored README;
3. compute POSIX relative `src` từ note directory tới interactive root;
4. insert `<Interactive src="..." />` bằng shared insertion logic;
5. typecheck + esbuild starter trước khi commit;
6. atomically write three new files và updated note;
7. refresh index/tree through existing canonical lifecycle;
8. nếu bất kỳ bước nào fail, restore note, xóa file/temp/empty folder do
   transaction tạo và trả structured error.

Không expose generic “create arbitrary text file” IPC để làm shortcut.

Starter manifest bắt buộc:

- `runtime: "react"`;
- permissions `network: false`, `filesystem: false`, `dataPaths: []`;
- empty `propsSchema`;
- dependencies chỉ gồm version contract cho `react`/`react-dom`;
- không tự cấp permission decision.

Sau success:

- note buffer nhận exact persisted content, không tạo dirty divergence;
- note tab vẫn tồn tại;
- `component.tsx` mở/activate qua `openOrActivate`;
- focus vào editor;
- Interactive Proof surface biết đây là app-owned starter vừa được user tạo và
  có thể bắt đầu session proof không cần thêm content-hash approval.

### 2. Interactive project detection and file grammar

Thêm shared pure resolver cho active path:

- chỉ nhận paths dưới `interactives/<root>/`;
- root là segment ngay sau `interactives/`;
- nhận `component.tsx`, local `.ts/.tsx/.js/.jsx/.json`, `manifest.json`,
  `README.md`;
- không resolve path escape, hidden restricted directory hoặc symlink;
- invalid/missing manifest vẫn trả project root + diagnostic để user có thể sửa,
  không silently rơi về blank “No preview”.

Một physical file vẫn là canonical workbench item. KHÔNG tạo virtual duplicate
cho project và KHÔNG phá invariant một path = một tab.

Khi active file thuộc React interactive root, `MainEditor` compose một dedicated
authoring wrapper quanh editor hiện có. Chuyển giữa project files vẫn dùng
`openOrActivate` và existing save-before-activate lifecycle.

### 3. Interactive Proof surface

Desktop/wide layout:

```text
┌ INTERACTIVE PROOF · React counter ─── Proof ready / 2 problems ┐
│ component.tsx · manifest.json · README.md        Run · Stop    │
├──────────────────────────────┬─────────────────────────────────┤
│ SOURCE                       │ PROOF                           │
│ CodeMirror + lint gutter     │ isolated sandbox output         │
│                              ├─────────────────────────────────┤
│                              │ PROPS / PROBLEMS ledger          │
└──────────────────────────────┴─────────────────────────────────┘
```

Narrow layout:

- không ép source thành cột quá hẹp;
- dùng tabs/segmented surface `Source | Proof | Problems`;
- active mode, problem count và proof state vẫn có text label;
- keyboard/focus order không thay đổi tùy animation.

Visual contract:

- giữ toàn bộ tokens trong `globals.css`/`DESIGN.md`;
- source là Courier Prime writing voice; proof output giữ sandbox isolation;
- hard 2px ink rules là structure; sharp corners; không gradient/glass/blur;
- issue dùng editorial red, successful proof dùng editorial blue, nhưng luôn có
  icon/text/code — không dùng màu làm tín hiệu duy nhất;
- signature element là **proof marks** trong gutter + Problems ledger:
  `TS2345 · component.tsx:12:9`, giống marks trên bản in thử, không phải generic
  dashboard cards;
- không thêm palette/font mới và không redesign global workbench.

Header/file strip:

- project name + root path;
- links cho `component.tsx`, `manifest.json`, `README.md` nếu tồn tại;
- missing file có explicit label/action, không icon-only;
- proof state: `Not run`, `Checking`, `Ready`, `Compile issue`, `Runtime issue`,
  `Stopped`;
- **Run isolated proof**, **Stop proof**, **Refresh proof** có accessible name và
  deterministic focus behavior.

### 4. Session-scoped zero-capability authoring preview

Không auto-execute arbitrary existing vault code chỉ vì user mở file.

Rules:

- existing project bắt đầu `Not run`, trừ khi exact current hash đã được normal
  permission store allow;
- user click **Run isolated proof** là explicit consent chỉ cho active
  `(vault session, project root)` authoring session;
- app-owned starter vừa được user tạo có thể bắt đầu consented proof session;
- AI patch approval KHÔNG tự được xem là permission chạy code;
- authoring consent chỉ ở memory, không ghi permission store, mất khi switch
  vault, close project session hoặc app restart;
- sau session consent, subsequent saved edits có thể refresh proof mà không hỏi
  theo từng hash;
- user có thể Stop; stopped state không tự restart cho tới Run/Refresh.

Authoring proof always enforces:

- iframe sandbox hiện có; không `allow-same-origin`, popups, navigation hay Node;
- CSP `default-src 'none'`, `connect-src 'none'`, no external fonts/objects/forms;
- manifest `network/filesystem/dataPaths` bị ép disabled trong proof mode;
- data RPC trả explicit denial;
- không đọc/write permission store;
- không persist preview props hoặc compiled script ngoài bounded cache policy đã
  được review;
- no source code execution in TypeScript worker/main typechecker.

Normal note preview vẫn giữ exact existing behavior:

- content-hash permission decision;
- changed source invalidates old decision;
- manifest permission review;
- no authoring-session consent leak sang note preview/export.

Nếu cần shared sandbox refactor, authoring mode phải là explicit discriminant
trong typed schema; không dùng boolean soup hoặc bypass flag chung.

### 5. Structured diagnostics and truthful compile pipeline

Tạo shared diagnostic model, ví dụ:

```ts
interface InteractiveDiagnostic {
  source: 'typescript' | 'esbuild' | 'manifest' | 'runtime'
  severity: 'error' | 'warning' | 'info'
  code: string
  message: string
  relativePath: string | null
  from: number | null
  to: number | null
  line: number | null
  column: number | null
}
```

Exact names có thể đổi, semantics không được đổi.

Requirements:

- TypeScript syntax + semantic diagnostics dùng fixed project compiler options;
- esbuild errors map file/line/column về vault-relative interactive path;
- manifest zod issues map về `manifest.json` JSON path và range khi possible;
- runtime `error`/`unhandledrejection` được postMessage qua strict schema và hiện
  ở Proof/Problems;
- không leak absolute vault path, app path, user home hoặc generated temp path;
- multiline/nested TS messages flatten deterministic;
- stale result có project/version ID và bị discard;
- click problem dùng `openOrActivate` + reveal exact range trong editor;
- current file diagnostics dùng CodeMirror lint gutter/underline/tooltip;
- cross-file diagnostics vẫn ở Problems và mở đúng file;
- save luôn được phép khi code đang incomplete; diagnostics không được biến
  autosave thành “only valid source may be stored”;
- proof chỉ swap sang new document sau typecheck + bundle success; compile fail
  giữ last-known-good proof với clear “source has newer issues” state.

Main compile contract cũng phải thật:

- `SandboxService.compileDraft()` hoặc service được extract phải chạy semantic
  TypeScript typecheck trước/alongside esbuild;
- AI repair loop nhận TypeScript diagnostics, không chỉ bundler strings;
- test phải chứng minh `setState("wrong type")` bị bắt dù esbuild có thể
  transpile;
- app build typecheck và vault interactive typecheck là hai projects khác nhau;
  không import app registry/internal renderer APIs vào vault project.

### 6. Offline TypeScript Language Service

Required architecture:

- dedicated renderer Web Worker, lazily created chỉ khi authoring `.ts/.tsx`;
- TypeScript Language Service trên virtual filesystem;
- synthetic POSIX URIs/paths; worker không nhận absolute vault root;
- one active interactive project per worker session;
- terminate/reset on project switch, vault switch, editor teardown và worker
  error;
- version every file update/request/response; drop stale response;
- debounce diagnostics; completion/hover requests có cancellation/latest-wins;
- no Node integration in worker;
- no network, CDN, ATA hoặc runtime package resolution.

Project snapshot:

- root bounded ở một `interactives/<slug>/`;
- include local `.ts/.tsx/.js/.jsx/.json` source only;
- exclude `node_modules`, `.git`, `.app`, `.trash`, symlink và path escape;
- max 128 source files `[ước lượng — verify during implementation]`;
- max 5 MiB per existing text-file invariant;
- max 10 MiB total project snapshot `[ước lượng — verify during implementation]`;
- over-limit state hiện actionable diagnostic, không freeze/crash.

Fixed compiler configuration, verify exact TS 5.9 API names during implementation:

- `target: ES2022`;
- `jsx: react-jsx`;
- `strict: true`;
- `noEmit: true`;
- browser DOM + ES2022 libs;
- bundler-compatible module resolution;
- JSON only if required by sandbox bundler contract;
- no plugins, project references, paths from vault config, automatic `@types`
  discovery or script execution.

Offline types:

- package and load TypeScript standard libs required by fixed config;
- package React 19 and ReactDOM declaration graph required by allowlist;
- expose only modules allowed by the sandbox dependency policy;
- local relative modules are resolved only inside project root;
- missing/disallowed dependency returns diagnostic and never triggers download;
- normal app startup bundle must not eagerly load TypeScript worker/types.

Dependency policy:

- keep current CodeMirror stack;
- direct runtime imports must be declared in `package.json`, not rely on
  transitive hoisting;
- `@typescript/vfs` and `@codemirror/lint` may be added with Bun after
  compatibility verification;
- TypeScript becomes a deliberate runtime/build dependency if the packaged
  worker/main checker needs it; do not upgrade TypeScript major as part of this
  goal;
- no Monaco, `typescript-language-server`, archived
  `@valtown/codemirror-ts`, Comlink, remote type loader or general LSP framework.

### 7. Required TypeScript editor capabilities

For `.ts/.tsx` inside an interactive project:

1. syntax + semantic diagnostics with gutter, underline and Problems;
2. completion for local symbols, object members, React APIs and JSX props;
3. safe auto-import edits only from:
   - `react`;
   - `react-dom` / allowed subpath;
   - local relative modules inside current interactive root;
4. hover type/documentation;
5. signature help at calls/JSX where TypeScript provides it;
6. Ctrl/Cmd+Click and F12-style go-to-definition for local project source;
7. library definition stays a hover/type view; do not open fake files as vault
   tabs;
8. Escape closes tooltip/completion; keyboard operation and visible focus;
9. diagnostics update after buffer changes without requiring disk save;
10. project files on disk refresh after watcher/tree snapshot change.

Auto-import must apply all edits as one CodeMirror transaction and preserve
undo. Reject edit if it targets a file outside current active buffer or an
external/disallowed module; multi-file code actions are out of scope.

For `.js/.jsx`, parser highlighting remains; semantic behavior may be best
effort. Success Criteria are authoritative for `.ts/.tsx`.

Do not add rename symbol, find-all-references, refactors, formatter, code actions
beyond safe completion import edits, semantic tokens or generic extension host.

### 8. Preview props and runtime feedback

Proof pane có a bounded, session-only `Preview props` JSON editor:

- default `{}`;
- max 64 KiB;
- parse errors map to field + Problems and do not run new proof;
- validate keys/value primitive types bằng same manifest contract used by
  `SandboxService`;
- unknown/invalid props show structured diagnostic;
- valid props re-init/render proof deterministically;
- never write props into note or manifest implicitly;
- explicit **Insert/update note props** is out of scope.

Sandbox runner posts:

- `ready`;
- bounded `resize`;
- structured runtime error;
- existing data requests, which proof mode always denies.

Messages remain zod-validated both directions and tied to instance ID/source
window. Runtime message and stack lengths are bounded.

### 9. AI/manual convergence

Existing AI philosophy remains unchanged:

- AI never writes without Approve;
- provenance remains required for AI drafts;
- manual starter README must not fake AI provenance;
- registry-template-first prompting remains;
- repair loop cap remains bounded.

After a successful AI component approval:

- refresh tree/snapshot through existing lifecycle;
- retain note patch result;
- open/activate resulting `component.tsx` in same Interactive Proof surface;
- state starts `Not run` unless exact hash already allowed; approval is not run
  permission;
- compile/type diagnostics use same model as manual authoring.

Do not create a second AI-only editor or compiler.

### 10. Lifecycle, performance and failure behavior

- Worker and authoring controllers have explicit cleanup; no orphan workers,
  listeners, object URLs or sandbox documents.
- Switching tabs/vault during async create/load/check/preview cannot commit stale
  result into new active project.
- Closing a dirty file still follows GOAL-22 save/close semantics.
- External deletion/rename shows missing state and stops proof; it does not
  recreate files.
- Worker crash shows `Type intelligence unavailable` with retry; source editing
  and save remain usable.
- Type service failure must not be reported as component compile success.
- Proof compile/runtime error never crashes MainEditor or loses source.
- TypeScript worker/types are a lazy production chunk; ordinary MDX reading and
  editing does not load it.
- Record cold worker ready, first diagnostics and warm completion timings on the
  fixture in verification report. Thresholds are evidence, not marketing:
  - cold ready + first diagnostics target ≤ 2,500 ms `[ước lượng]`;
  - warm completion target ≤ 300 ms `[ước lượng]`;
  - if hardware misses, optimize or document measured blocker; do not delete the
    measurement criterion.

### 11. Accessibility and interaction contract

- Create dialog uses proper dialog/form semantics, focus containment, labelled
  errors and invocation focus restoration.
- Project file strip and `Source | Proof | Problems` narrow layout have correct
  tab/list semantics and roving/active focus behavior.
- Problems is keyboard navigable; Enter opens/reveals source.
- Current problem is announced without flooding `aria-live` on every keystroke.
- Proof iframe has descriptive title.
- Resize/reflow never traps keyboard focus.
- All controls have visible focus; reduced motion respected.
- Status is not color-only; screen reader gets project name, state and count.
- Editor completion/hover does not hide essential error text available in
  Problems.

### 12. Documentation and product contract

Update:

- `docs/architecture.md`: authoring service, worker/VFS, project lifecycle,
  scaffold transaction, structured diagnostics;
- `docs/security.md`: distinguish persistent content-hash permission from
  session-scoped zero-capability authoring proof; fixed offline type project;
- `docs/mdx-conventions.md`: in-app manual creation/edit flow and starter files;
- `docs/tech-stack.md`: runtime TypeScript/VFS/CodeMirror lint decision and
  rejected archived/generic LSP packages;
- `DESIGN.md`: Interactive Proof grammar only if implementation adds reusable
  design contract;
- `docs/roadmap.md` and `goals/README.md`: add GOAL-25 after preserving existing
  user modifications;
- example vault authoring guide/skill references only where behavior changed.

Write `docs/verification/goal-25-interactive-authoring-workbench.md` as the
authoritative completion ledger with:

- exact dependency/version decision;
- scaffold transaction/rollback evidence;
- language capability matrix;
- security matrix;
- keyboard/accessibility matrix;
- narrow/wide screenshots;
- offline/network observation;
- lazy-load/build artifact observation;
- performance measurements;
- known bounded exclusions.

---

## Constraints

> Đây là phần quan trọng nhất. Agent PHẢI tuân theo.

- [ ] Work only on GOAL-25. Không implement terminal, generic LSP platform,
  marketplace, plugin host, registry authoring hoặc unrelated editor polish.
- [ ] Đọc `docs/security.md` trước khi sửa main/preload/sandbox/preview.
- [ ] Dùng `frontend-design`, `vercel-react-best-practices` và
  `webapp-testing` skills cho phần UI/React/live verification theo repo rules.
- [ ] Giữ `contextIsolation: true`, `sandbox: true`,
  `nodeIntegration: false`, `webSecurity: true`.
- [ ] Không bật `nodeIntegrationInWorker`, không expose `fs/path/ipcRenderer`
  thô, không gửi absolute vault path sang renderer/worker.
- [ ] Mọi main IPC mới phải narrow, zod-validated, main-frame validated và dùng
  relative paths + `safeJoin`/symlink defenses.
- [ ] Không thêm generic arbitrary non-note file creation IPC.
- [ ] Scaffold + note insertion là một transaction có preflight, optimistic
  revision check và rollback; không chấp nhận orphan bundle như success.
- [ ] Không overwrite existing/partial interactive folder.
- [ ] Không execute vault source trong TypeScript worker/typechecker.
- [ ] Không tải compiler libs/types/dependencies từ network/CDN/ATA ở runtime.
- [ ] Không đọc hoặc chạy `tsconfig`, package script, TypeScript plugin hay
  `node_modules` từ vault.
- [ ] Không dùng Monaco, `typescript-language-server`,
  `@valtown/codemirror-ts`, Comlink hay general LSP dependency.
- [ ] Không upgrade TypeScript major, React, Electron, CodeMirror hoặc unrelated
  dependency trong goal này.
- [ ] Chỉ add dependency sau khi verify official docs, maintenance và packaged
  build; dùng `bun add`, không npm/pnpm/yarn.
- [ ] Authoring proof không ghi permission store, không được network,
  filesystem, data RPC, storage hoặc manifest capability.
- [ ] Không auto-run arbitrary existing code on file open.
- [ ] Normal note preview content-hash permission behavior và export security
  không được yếu đi.
- [ ] AI vẫn diff/approve/provenance; không có đường AI response → write/run trực
  tiếp.
- [ ] Save incomplete source vẫn được phép; diagnostics không gate filesystem
  editing.
- [ ] Không tạo generic split-pane/workbench item model; compose proof surface
  quanh physical active file.
- [ ] Giữ one canonical path = one workbench tab và mọi navigation qua
  `openOrActivate`.
- [ ] Giữ current editor history, line endings, autosave, dirty/missing state,
  paste/drop, `[[` autocomplete, slash palette, note Ctrl+Click và AI selection
  behavior.
- [ ] Giữ editorial tokens; không thêm gradient/glass/rounded-card/default IDE
  visual system.
- [ ] Preserve unrelated dirty-worktree changes; không revert/overwrite/commit
  chung.
- [ ] Sau mỗi meaningful implementation slice chạy `bun run typecheck` và
  `bun run lint`.
- [ ] Nếu gặp blocker: exhaust in-scope evidence/alternatives rồi DỪNG và mô tả
  exact blocker; không silently shrink scope.

---

## Success Criteria

### Required Evidence per Criterion

| # | Tiêu chí | Verification Command / Evidence | Expected Output / Signal |
|---|----------|---------------------------------|--------------------------|
| 1 | Canonical create action scaffold + note insertion thành một transaction | `bun test tests/interactive-scaffold.test.ts tests/interactive-create-transaction.test.ts` | Blank/stateful scaffold đúng; nested-note src đúng; Unicode offset đúng; collision/traversal/stale revision/write failure đều rollback sạch |
| 2 | IPC/preload boundary narrow và hardened | `bun test tests/interactive-authoring-ipc.test.ts` + source review | zod limits, main-frame validation, relative path only, symlink/restricted path rejection; không có generic create-text bridge |
| 3 | Existing interactive files activate one coherent Proof surface without duplicate tab identity | `bun test tests/interactive-project.test.ts tests/interactive-authoring-controller.test.ts` | Root detection/missing manifest/project switch/openOrActivate/save lifecycle deterministic |
| 4 | TypeScript semantic checker catches errors esbuild previously transpiled | `bun test tests/interactive-language-service.test.ts src/main/services/sandbox-service.goal05.test.ts` | TS type mismatch returns structured code/range; valid React/local-import fixture passes; AI compile receives same diagnostics |
| 5 | CodeMirror exposes required semantic features | `bun test tests/interactive-code-intelligence.test.ts` + live fixture | diagnostics, completion, safe React/local auto-import, hover, signature and local go-to-definition work; disallowed import gets no unsafe edit |
| 6 | Worker is offline, bounded, versioned and lazy | `bun test tests/interactive-language-worker.test.ts` + production build inspection | stale replies dropped; project/file limits handled; no network/ATA/absolute paths; worker chunk absent from ordinary startup path |
| 7 | Proof preview is session-scoped and zero-capability | `bun test tests/interactive-proof-security.test.ts tests/sandbox-messages.test.ts` | existing code does not auto-run; Run consents only in memory; network/data/filesystem denied; no permission-store mutation; consent reset on vault/restart |
| 8 | Normal sandbox permission behavior does not regress | `bun test src/main/services/sandbox-service.goal05.test.ts tests/goal04-interactive-islands.test.ts` | changed hash requires normal review; denied/allowed paths and dependency guard unchanged |
| 9 | Compile/runtime/manifest/props errors are structured and navigable | `bun test tests/interactive-diagnostics.test.ts tests/interactive-proof-runtime.test.ts` | no absolute path leak; current/cross-file source reveal works; last good proof retained; runtime/props issues recover after fix |
| 10 | Manual and AI journeys converge after approval | `bun test src/main/services/ai-approval-service.test.ts src/main/services/ai-repair-loop.test.ts tests/interactive-ai-handoff.test.ts` | AI approval remains required/provenanced, type diagnostics feed repair, resulting component opens same Proof surface but does not auto-run |
| 11 | UI is accessible, responsive and matches editorial design | component tests + `docs/verification/goal-25-interactive-authoring-workbench.md` screenshots/keyboard matrix | wide/narrow layout, focus restore, keyboard Problems navigation, visible focus, text status, reduced motion, no generic visual drift |
| 12 | Offline packaged runtime contains all required compiler/type assets | `bun run build` then `bun run build:win` and packaged smoke with network unavailable | packaged app creates/checks/previews fixture; no CDN/network request; no missing worker/type asset |
| 13 | Performance/lifecycle are measured and bounded | verification report + worker/controller tests | cold/warm timings recorded; no orphan worker/listener/object URL; switching project/vault cannot show stale diagnostics/proof |
| 14 | Full regression suite and static gates pass | `bun test && bun run typecheck && bun run lint && bun run build` | all exit 0; no new lint/type/build errors |
| 15 | Documentation states exact architecture/security/product behavior | review files in Target State §12 | docs and verification ledger agree with shipped behavior; no claim of generic/full LSP |

### Required live journey

Record each step with observed result in the verification ledger:

1. Open a disposable `.mdx` note containing Vietnamese/emoji before the caret.
2. Invoke New interactive, choose `Stateful control`, edit slug, create.
3. Confirm note tag path is correct, exactly one component tab opens and no
   orphan/duplicate files exist.
4. In `component.tsx`, request completion for `useState`; apply allowed
   auto-import in one undoable edit.
5. Introduce `setState("wrong")`; observe `TS2345`-equivalent inline + Problems,
   click it, then fix and observe clear.
6. Add a local helper `.ts`, import it, hover/signature/Ctrl+Click to definition.
7. Try importing a non-allowlisted package and `../` escape; observe diagnostic,
   no network request and no unsafe auto-import.
8. Run isolated proof; edit valid source and observe refresh without per-hash
   prompt for this authoring session.
9. Introduce syntax error, runtime throw, invalid preview props and invalid
   manifest one by one; observe last-good/error/recovery behavior.
10. Request data/network capability in manifest; authoring proof still denies it.
11. Open the note Reading preview after source hash change; normal permission
    review still appears.
12. Stop proof, switch vault/restart, reopen component; it is `Not run`.
13. Generate a component through existing AI action, Approve, confirm same
    surface opens and still requires Run/normal permission.
14. Repeat core Source/Proof/Problems flow narrow and keyboard-only.
15. Launch packaged app with network unavailable and repeat completion +
    diagnostics + proof.

### Reference Artifacts

- `goals/GOAL-25-interactive-authoring-workbench.md` — source of truth.
- `docs/verification/goal-25-interactive-authoring-workbench.md` — completion,
  security, capability, performance and live evidence ledger.
- `docs/security.md` — invariant security boundary.
- `DESIGN.md` + `src/renderer/src/globals.css` — visual source of truth.

### Completion Condition

Agent kết thúc khi và chỉ khi:

- [ ] mọi Required Evidence row có authoritative passing evidence;
- [ ] toàn bộ Required live journey được quan sát và ghi lại, không thay bằng
  “unit tests imply it works”;
- [ ] scaffold transaction failure không để orphan note edit/file/folder;
- [ ] semantic feature matrix đủ diagnostics/completion/auto-import/hover/
  signature/local-definition;
- [ ] authoring proof security matrix chứng minh no capability và no persistent
  permission mutation;
- [ ] normal note sandbox/AI approval regressions pass;
- [ ] packaged offline smoke pass;
- [ ] full test/typecheck/lint/build pass;
- [ ] docs/verification không còn `Remaining Work`, unchecked required row hay
  unresolved blocker;
- [ ] worktree review không có accidental edits ngoài GOAL-25.

---

## Execution Plan

> Thực hiện theo thứ tự. Sau mỗi bước, báo cáo ngắn gọn và chạy
> `bun run typecheck` + `bun run lint` sau mỗi meaningful change.

1. **Baseline, skills, dependency spike**
   - Read all required project/reference files.
   - Use `frontend-design`, `vercel-react-best-practices`,
     `vercel-composition-patterns` where applicable, and `webapp-testing`.
   - Record current focused/full test and typecheck baseline without altering
     unrelated dirty changes.
   - Verify installed TypeScript/CodeMirror/electron-vite versions and
     `@typescript/vfs` compatibility using official docs and a disposable spike.
   - Verify Vite worker output under renderer CSP and packaged Electron build.
   - Reject archived/generic LSP alternatives in verification ledger.

2. **Shared contracts and pure project/scaffold model**
   - Add bounded zod schemas/types for create request/result, project snapshot,
     proof mode/messages and structured diagnostics.
   - Add pure slug/path/project-root/src-relative/insertion planners.
   - Add tests first for nested notes, Unicode offsets, collision/traversal,
     missing/invalid files and limits.

3. **Transactional main service + narrow IPC**
   - Implement app-owned blank/stateful templates.
   - Implement preflight, expected revision check, semantic+bundle validation,
     atomic file/note commit and rollback.
   - Wire index/tree refresh and canonical result.
   - Expose one narrow preload API; assert main frame and preserve relative-path
     boundary.
   - Add failure injection tests proving note/files/folder rollback.

4. **Canonical create UX**
   - Add workspace action and one shared controller.
   - Add note-header, Command Palette and slash entry points.
   - Build accessible create dialog using existing editorial components.
   - Extend editor selection snapshot only as needed for a UTF-16 caret offset.
   - On success reconcile note buffer, refresh snapshot, open component and
     restore/focus deliberately.

5. **Structured typecheck/compile pipeline**
   - Build reusable fixed-config TypeScript project checker over in-memory
     sources and offline declaration map.
   - Normalize TypeScript/esbuild/manifest diagnostics without absolute paths.
   - Integrate into `compileDraft`/AI repair and keep existing dependency guard.
   - Prove semantic error detection, valid fixture, cross-file imports and
     packaged type assets.

6. **Lazy TypeScript worker and typed client**
   - Add direct typed `postMessage` protocol with project/file/request versions.
   - Load fixed lib/React declarations offline; no runtime fetch.
   - Implement bounded snapshot/update/reset/terminate and stale-response drop.
   - Keep worker/types out of normal startup.
   - Add worker lifecycle, limits, crash/retry and lazy-build tests.

7. **CodeMirror semantic extensions**
   - Add `@codemirror/lint` direct dependency if verified.
   - Add diagnostics/lint gutter, completion + safe auto-import, hover,
     signature help and local definition extension to interactive TS/TSX only.
   - Preserve base highlighting/history/line endings/autosave.
   - Extend `TextFileEditor` with reveal request and problem navigation without
     remounting/recreating state unnecessarily.
   - Test CodeMirror mapping as pure adapters plus focused component tests.

8. **Interactive Proof controller and security mode**
   - Detect active interactive project without changing canonical tab identity.
   - Add session-scoped Run/Stop/Refresh state and exact consent lifecycle.
   - Add zero-capability authoring proof discriminant through sandbox/preload/
     main contracts.
   - Force data/network/filesystem denial; never mutate permission store.
   - Preserve normal content-hash approval and add security regressions.

9. **Proof UI, props and Problems ledger**
   - Implement wide proof-desk composition and narrow Source/Proof/Problems
     modes using existing design tokens.
   - Add project file strip, state header, preview props editor and Problems.
   - Map problem activation to `openOrActivate` + exact reveal.
   - Capture runtime error/unhandled rejection via bounded validated messages.
   - Retain last-good proof and implement deterministic error/recovery states.
   - Run accessibility/component tests and visual self-critique.

10. **AI handoff and lifecycle hardening**
    - Route successful approved component files to the same project surface.
    - Preserve provenance/approval and do not auto-consent AI execution.
    - Test vault/tab/project races, external delete/rename, worker crash, proof
      stop and cleanup.

11. **Documentation, build and live QA**
    - Update all Target State §12 docs without overwriting unrelated user edits.
    - Run focused tests after each area, then full gates.
    - Build Windows package and test offline.
    - Use webapp-testing/live Electron tooling for wide, narrow, keyboard,
      error/recovery and permission journeys.
    - Capture screenshots, timings, network observation and artifact/lazy-load
      evidence in verification ledger.

12. **Final evidence audit**
    - Re-read this goal from disk.
    - Map every Target State requirement and Success Criteria row to code/test/
      live evidence.
    - Search forbidden dependencies/patterns and absolute-path leaks.
    - Inspect `git diff` for scope and unrelated dirty-file overlap.
    - Do not mark complete while any required row is inferred, flaky, unobserved
      or labeled Remaining Work.

---

## Out of Scope

- Generic multi-language LSP platform or Language Server Protocol transport.
- Monaco editor migration.
- Generic split panes, pane drag/resize system or new virtual workbench item.
- Registry component source authoring.
- HTML interactive authoring workbench beyond preserving current text editor and
  sandbox behavior.
- Arbitrary npm dependencies, package installation inside vault, ATA/CDN types.
- TypeScript plugins, vault `tsconfig`, project references or entire-vault code
  indexing.
- Rename symbol, find references UI, refactors, formatter, debugger, terminal,
  test runner or Git UI.
- Multi-file auto-import/code-action edits.
- Writing preview props back into MDX automatically.
- Persisting authoring proof props or session consent.
- Broadening sandbox network/filesystem/data permissions.
- Marketplace/library/distribution of custom interactives.
- AI autonomously writing/running components.
- Mobile-specific authoring beyond responsive/narrow desktop behavior.

---

## References

### Official external references

- CodeMirror Reference Manual — autocomplete, hover, lint, keymaps:
  <https://codemirror.net/docs/ref/>
- CodeMirror Core Extensions:
  <https://codemirror.net/docs/extensions/>
- CodeMirror Autocompletion example:
  <https://codemirror.net/examples/autocompletion/>
- TypeScript Compiler/Language Service API:
  <https://github.com/microsoft/TypeScript/wiki/Using-the-Compiler-API>
- TypeScript VFS:
  <https://www.typescriptlang.org/dev/typescript-vfs/>
- TypeScript module resolution:
  <https://www.typescriptlang.org/tsconfig/moduleResolution>
- TypeScript performance guidance:
  <https://github.com/microsoft/TypeScript/wiki/Performance>
- Vite Web Workers and raw assets:
  <https://vite.dev/guide/features.html#web-workers>
- Electron security:
  <https://www.electronjs.org/docs/latest/tutorial/security>
- Electron context isolation:
  <https://www.electronjs.org/docs/latest/tutorial/context-isolation>
- Electron process sandboxing:
  <https://www.electronjs.org/docs/latest/tutorial/sandbox>
- Archived adapter considered and rejected:
  <https://github.com/val-town/codemirror-ts>

### Repository references

- [AGENTS.md](../AGENTS.md)
- [goals/README.md](README.md)
- [docs/product-vision.md](../docs/product-vision.md)
- [docs/architecture.md](../docs/architecture.md)
- [docs/security.md](../docs/security.md)
- [docs/mdx-conventions.md](../docs/mdx-conventions.md)
- [docs/tech-stack.md](../docs/tech-stack.md)
- [DESIGN.md](../DESIGN.md)
- [GOAL-05 sandbox](GOAL-05-sandbox-and-permissions.md)
- [GOAL-06 AI](GOAL-06-ai-assistant.md)
- [GOAL-16 text editor](GOAL-16-plain-text-and-image-preview.md)
- [GOAL-18 go-to-definition](GOAL-18-editor-goto-definition.md)
- [GOAL-22 workbench](GOAL-22-zed-like-workbench-ux.md)
- [TextFileEditor.tsx](../src/renderer/src/editor/TextFileEditor.tsx)
- [MdxEditor.tsx](../src/renderer/src/editor/MdxEditor.tsx)
- [MainEditor.tsx](../src/renderer/src/components/layout/MainEditor.tsx)
- [useTextFileEditor.ts](../src/renderer/src/hooks/useTextFileEditor.ts)
- [useWorkbench.ts](../src/renderer/src/hooks/useWorkbench.ts)
- [workspace-actions.ts](../src/shared/workspace-actions.ts)
- [vault-service.ts](../src/main/services/vault-service.ts)
- [vault-ipc.ts](../src/main/ipc/vault-ipc.ts)
- [ai-approval-service.ts](../src/main/services/ai-approval-service.ts)
- [ai-repair-loop.ts](../src/main/services/ai-repair-loop.ts)
- [sandbox-service.ts](../src/main/services/sandbox-service.ts)
- [sandbox-ipc.ts](../src/main/ipc/sandbox-ipc.ts)
- [sandbox.ts](../src/shared/sandbox.ts)
- [SandboxHost.tsx](../src/renderer/src/preview/sandbox/SandboxHost.tsx)
- [package.json](../package.json)
- [electron.vite.config.ts](../electron.vite.config.ts)
- [renderer CSP](../src/renderer/index.html)

---

## Agent Instructions

### Execution

1. Đọc toàn bộ file này và required references trước khi làm.
2. Tuân theo Constraints tuyệt đối.
3. Thực hiện Execution Plan theo thứ tự; report sau từng bước.
4. Dùng `rg`, rồi `ast-grep outline` trước source file lớn/unfamiliar theo
   `AGENTS.md`.
5. Dùng official docs/current installed source, không code theo memory.
6. Sau meaningful change chạy typecheck + lint; tests theo risk.
7. Conflict giữa Target State/Execution Plan và Constraints → Constraints thắng.
8. Preserve unrelated dirty changes; nếu overlap không thể tách an toàn thì dừng
   và báo exact file/hunk.
9. Khi xong, verify từng Success Criteria và live journey; không chỉ báo tổng
   quát.

### Anti-bias Instructions

**Chống Scope Shrink**

- KHÔNG redefine done thành “đã có autocomplete” hoặc “đã có LSP”.
- KHÔNG bỏ scaffold transaction, proof security, diagnostics navigation,
  packaged offline smoke, accessibility hay AI convergence vì gọi chúng là
  polish.
- KHÔNG thay TypeScript semantic checks bằng esbuild compile success.
- KHÔNG thay live journey bằng unit-test inference.

**Chống Uncertainty Stop**

- Uncertain evidence = not achieved; tiếp tục inspect/test.
- Nếu helper package không phù hợp, dùng public TypeScript LanguageServiceHost
  trong cùng worker/VFS architecture thay vì bỏ semantic capabilities.
- Nếu target performance miss, đo/profile/optimize hoặc report genuine blocker;
  không xóa criterion.
- Nếu authoring proof cần CSP adjustment, tìm self-hosted worker/artifact route
  trước; không nới network/eval/blob tùy tiện.

**Chống Memory Trust**

- Current filesystem, package lock, test output và live behavior là
  authoritative.
- Re-open changed contracts/tests before final claims.
- Re-run normal sandbox permission + AI approval regressions after final
  refactor.
- Check packaged app, không assume dev server success nghĩa production worker
  asset tồn tại.
