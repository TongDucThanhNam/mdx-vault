# GOAL-31 — Reactive Vault: Shared Cell Bus cho Interactive Islands

> File này được tạo bởi `create-goal` skill.
> Agent thực thi: đọc toàn bộ file này trước khi làm bất kỳ thứ gì.
> Phải đọc và tuân theo `AGENTS.md`, `docs/security.md`, `DESIGN.md`,
> `goals/README.md`, và các References bắt buộc bên dưới trước khi code.

---

## Objective

Biến interactivity của vault từ mô hình "mỗi island là một vòng lặp khép kín
quản lý state của chính nó" thành **"cả note là một chương trình reactive"**,
bằng một cell bus do host sở hữu, không mở rộng attack surface:

1. các trusted param widgets (Level 2) publish **named cells** (giá trị reactive
   có tên) mà prose có thể bind trực tiếp: `{n}`, `{n * log2(n)}` — văn bản
   quanh island cập nhật live khi người đọc kéo slider;
2. các sandboxed custom islands (Level 3/4) tham gia cùng bus qua manifest
   `cells` + zod-validated postMessage — một island lọc dữ liệu, island khác
   và đoạn prose bên dưới cùng phản ứng;
3. cells có thể được chia sẻ **cross-note** với permission riêng, prose có thể
   **adaptive** theo state của người đọc;
4. wiring (ai nối vào ai) hiển thị được qua Dataflow view và Interactive Proof
   Cells inspector;
5. export giữ nguyên reactivity trong note và hỗ trợ **record/replay session**
   dưới dạng data thuần;
6. AI chỉnh wiring uniquement qua patch/approve flow hiện có — wiring nằm trong
   MDX source + manifest nên mọi chỉnh sửa của AI đều diffable.

Bốn phase A→D phải hoàn thành đủ trong goal này. Không phải goal của: generic
reactive notebook, scripting runtime, hay marketplace widget.

---

## Context

- **Lý do**: Islands model hiện tại (giống Astro) có hạn chế được dokument hóa:
  các island không nói chuyện được với nhau. Trong mdx-vault hôm nay, state của
  `QuizBlock`, `EquationSlider`, `<Interactive>` hoàn toàn cục bộ theo component
  instance; prose không thể hiển thị giá trị live; hai island trong cùng note
  không chia sẻ được gì. Đây là khoảng trống lớn nhất so với thesis "static
  prose + dynamic islands" — prose vẫn chết dù islands sống.
- **Product thesis**: Markdown vẫn là base layer; islands là đảo động. Reactive
  Vault giữ nguyên ranh giới đó: prose đọc được như văn bản (cell refs là một
  identifier + số học đơn giản), behavior nằm trong widgets/islands có manifest.
- **Ưu tiên**: security + correctness > coherent UX > feature breadth >
  implementation speed.
- **Người thực hiện**: AI Agent; không có human review giữa từng bước.
- **Ngày tạo**: 2026-08-16.
- **Depends on**: GOAL-04, GOAL-05, GOAL-06, GOAL-17, GOAL-19, GOAL-22,
  GOAL-25, GOAL-28. Giả định GOAL-01..30 đã hoàn tất.

### Research conclusions — không được quay lại tranh luận từ đầu

- Astro islands documented limitation: islands không giao tiếp nhau; nanostores
  là workaround bên ngoài framework. Observable Framework/Quarto có reactive
  prose nhưng single-runtime, không sandbox, không capability model, không
  vault. Không sản phẩm nào có "reactive prose + sandboxed islands + cross-note
  state + diffable wiring" — đó là khoảng trống goal này chiếm.
- **Prose expressions hôm nay bị strip**: `rehypeSafeHtml`
  (`src/renderer/src/preview/safe-html.ts:174-176`) xóa mọi
  `mdxTextExpression`/`mdxFlowExpression` — đây là trust boundary từ GOAL-01.
  Quyết định kiến trúc: prose binding được transform **tại remark stage** thành
  JSX element của trusted registry component TRƯỚC khi `rehypeSafeHtml` chạy;
  sanitizer KHÔNG được nới lỏng một dòng nào. Expression nào không resolves
  thành cell ref giữ nguyên hành vi strip hiện tại.
- Host renderer **không bao giờ evaluate user JS**. Expression trong prose được
  tính bởi một expression evaluator tự viết, bounded grammar (identifier +
  literal + số học + so sánh), không `eval`, không `new Function`, không
  `Function()` constructor. Đây là app code (Level 2 trusted), không phải
  user code.
- Sandbox protocol hiện có (`src/shared/sandbox.ts`): mọi message có
  `channel: 'mdx-vault'` + `instanceId`, zod-validated hai chiều,
  `SandboxHost.tsx:177-199` lọc theo `event.source` + origin `null`. Cell bus
  MỞ RỘNG schema này (thêm message types), không thay thế.
- Manifest hôm nay không có trường cells; thêm `cells` vào manifest làm đổi
  content hash (sha256 toàn bộ folder — `sandbox-service.ts:502-528`) →
  permission decision cũ tự invalidates. Được bảo mật lại miễn phí; KHÔNG thêm
  cơ chế riêng.
- `WidgetFrameContext` (`preview/islands/interactive-note/widget-frame-context.ts`)
  là tiền lệ in-kit shared state (locked/prediction/commit/complete) — cell
  runtime là bản tổng quát hoá của pattern này ở mức preview document.
- Export pipeline **reimplement host protocol** (`export-bundler.ts:235-304`):
  cell bus phải có export story song song, không chỉ in-app.
- Tiền lệ IPC/prefs: `.app/*.json` revision-based atomic save (bookmarks,
  graph-view, sandbox-permissions). Cell persistence + cross-note permission
  theo đúng pattern này.
- **Naming collision**: registry đã có `CellGrid` (GOAL-21). KHÔNG đặt tên
  registry component là `Cell`. Runtime type nội bộ: `ReactiveCell`; component
  user-facing cho prose verbose/cross-note: `LiveValue`; param widgets:
  `Slider`, `Toggle`, `Select`; conditional prose: `When`.
- Không thêm dependency state-management (nanostores/zustand/…). Store tự viết
  bounded (~100 dòng) là đủ và tránh surface mới; mọi candidate dependency khác
  phải qua verification bước 1.

---

## Current State

| Item | Giá trị hiện tại |
|------|------------------|
| Preview compile | `compileMdx` browser-side `evaluate()`; remark: Gfm, Math, Frontmatter, Wikilink, Marks, Callouts; rehype: source-map, SafeHtml, HeadingIdentity, Katex, Highlight (`MdxPreview.tsx:388-420`) |
| Prose expressions | `rehypeSafeHtml` strip toàn bộ `mdxTextExpression`/`mdxFlowExpression` + non-string JSX attribute values (`safe-html.ts:174-176, 209-228`) |
| Registry | 22 entries trong `preview/registry/index.tsx:37-60` (Counter, QuizBlock, EquationSlider, DataChart, AlgorithmVisualizer + InteractiveNote kit + CellGrid, FlowSequence); zod props validation, insertSnippet, exportPolicy |
| Sandbox host | `SandboxHost.tsx` — iframe `sandbox="allow-scripts"`, custom protocol `mdx-vault-sandbox://document/<uuid>`, permission prompt theo content hash, resize/ready/runtimeError/requestData |
| Sandbox protocol | `src/shared/sandbox.ts:123-189` — sandbox→host: `ready/resize/requestData/runtimeError`; host→sandbox: `init/dataResponse`; bootstrap script `sandbox-service.ts:689-787` expose `window.mdxVault.requestData` |
| Compile vault components | `SandboxService.buildInteractiveBundle` — typecheck → esbuild IIFE, dependency guard chỉ `react`/`react-dom`, cache theo content hash `.app/component-cache/` |
| Manifest | `name, version, runtime, permissions {network, filesystem, dataPaths}, propsSchema, dependencies, fallback`; KHÔNG có cells |
| Cross-island state | Không tồn tại; duy nhất `WidgetFrameContext` trong InteractiveNote kit |
| Renderer state | Plain React hooks + prop drilling; không store, không event bus chung |
| SQLite | `.app/index.sqlite`, SCHEMA_VERSION 4; tables: notes, aliases, headings, sections, links, tags, note_components, properties + FTS5 |
| Indexer | `index-service.ts` extract headings/wikilinks/tags/components/properties — CHƯA extract cell declarations |
| Export | `export-service.ts`: static (CSP `script-src 'none'`, mọi island fallback) và interactive (hydrate trusted roots + embed sandbox srcdoc khi allowed + no-network; host stub trong `export-bundler.ts` reimplement protocol) |
| AI | patch operations: `textPatch/interactiveInsert/componentDraft` (`src/shared/ai.ts:135-202`); diff review `AiDiffReview.tsx`; approval `ai-approval-service.ts` compile-then-write + rollback; repair loop 3 rounds |
| Authoring | GOAL-25 Interactive Proof surface; proof mode zero-capability, session-scoped consent |
| Tests | `bun test`; `tests/*.test.ts(x)` (~90 files) + co-located `src/main/services/*.test.ts`; suffix `.goalNN` cho goal-scoped suites |
| Design | Editorial paper/ink; Courier Prime writing voice; hard 2px rules; sharp corners; red issue / blue result |

### Current gaps

1. Không có kênh nào cho hai island trong cùng note giao tiếp.
2. Widget state cục bộ: hai `EquationSlider` không share, prose không đọc được.
3. Prose không thể hiển thị giá trị live — expression bị strip.
4. Không có state nào đọc được từ note khác.
5. Không có visibility: không biết note đang có những cells nào, ai produce,
   ai consume.
6. Export interactive hydrate từng component độc lập — không wiring.
7. AI không có contract để đọc/sửa wiring một cách structured.

---

## Target State

### 1. Cell Runtime core (Phase A)

Một `CellRuntime` gắn với lifecycle của mỗi preview document (reading preview
và hover preview là hai instance riêng):

- scope: **per-note**; cell là flat identifier `[a-zA-Z_][a-zA-Z0-9_]*`,
  tối đa 64 chars;
- value: JSON-serializable, ≤ 16 KiB per cell `[ước lượng — verify]`, type là
  một trong `string | number | boolean | array | object` (giữ union của
  `propsSchema`);
- API (nội bộ renderer, không expose preload): `declare(name, type, initial)`,
  `get`, `set(name, value)` (validate type/size), `subscribe(name, cb)`,
  `dispose()`;
- bounds: tối đa 64 cells/note và 128 subscribers/cell `[ước lượng — verify]`;
  vượt limit → structured warning hiển thị ở preview, không crash;
- mặc định **không persist** — cells sống trong renderer memory, mất khi đóng
  note/restart (persistence là §7);
- `dispose()` khi unmount/switch note; không listener leak.

KHÔNG thêm dependency ngoài; tự viết store. Runtime là module thuần, test được
bằng unit tests.

### 2. Trusted param widgets (Phase A)

Ba registry entries mới (Level 2, chạy trong preview renderer như các registry
component khác — không iframe):

- `Slider` — props zod: `name` (cell identifier, bắt buộc), `label?`,
  `min/max/step/value` (number), `persist?` (boolean, mặc định false);
- `Toggle` — `name`, `label?`, `value` (boolean), `persist?`;
- `Select` — `name`, `options` (string[]), `value`, `label?`, `persist?`.

Widget có `name` thì `declare` cell khi mount và `set` khi user tương tác.
Editor intelligence (completion/hover/insert snippet qua registry mechanism hiện
có) tự có sau khi thêm entries — không viết extension riêng.

`EquationSlider` và các component hiện tồn tại KHÔNG được đổi behavior.

### 3. Prose cell binding qua remark transform (Phase A)

Plugin mới `remark-reactive-cells` (đặt cạnh `src/shared/remark-*.ts`), chạy
trước rehype stage:

- duyệt `mdxTextExpression` trong prose positions;
- expression parse được bằng **bounded grammar** — chỉ gồm: cell identifier,
  numeric/string literal, `+ - * / %`, parentheses, so sánh
  `== != < <= > >=`, `&& || !`, ternary `?:` — VÀ mọi identifier trong
  expression phải là cell đã declared trong note (theo thứ tự xuất hiện:
  widget/island declaration đứng trước usage) thì transform node thành
  `mdxJsxTextElement` của trusted component nội bộ `ReactiveText`;
- expression không thoả (identifier chưa declare, grammar ngoài allowlist,
  flow expression, expression trong attribute) → **giữ nguyên node** để
  `rehypeSafeHtml` strip như hôm nay. Không có path nào làm prose expression
  chạy được JS của user.

`ReactiveText` (component nội bộ, không phải registry entry user-facing):

- nhận AST/serialized form của expression đã validate + danh sách cell refs;
- subscribe các refs, tính lại bằng expression evaluator tự viết (cùng grammar
  trên, evaluator là app code — không `eval`/`new Function`);
- render kết quả như text; chỉ re-render đúng span đó ( KHÔNG recompile MDX,
  KHÔNG re-render cả preview khi cell đổi);
- number display mặc định `String(value)`; prop nội bộ `precision` (không user
  API ở Phase A — `{n}` đủ).

Regression bắt buộc: mọi test strip-expression hiện có của safe-html vẫn pass
nguyên vẹn; thêm test chứng minh `{undeclared}`, `{window.location}`,
`{require('../x')}`, `{a.b.c}` (member access — ngoài grammar) đều vẫn bị strip.

### 4. Sandbox cells bridge (Phase B)

**Manifest** mở rộng (optional, backward compatible):

```json
{
  "cells": {
    "publishes": [{ "name": "filteredRows", "type": "array" }],
    "subscribes": ["n", "speed"]
  }
}
```

Manifest không khai báo `cells` → island hành động y như hôm nay.

**Protocol** (`src/shared/sandbox.ts` mở rộng):

- sandbox→host: `cellPublish {instanceId, name, value}` — zod validate, value
  bounded như §1;
- host→sandbox: `cellValue {instanceId, name, value}` — gửi trong `init`
  (snapshot các cells subscribed) và mỗi lần cell đổi;
- host relay trong `SandboxHost.tsx`: kết nối instance vào CellRuntime của
  preview document hiện tại.

**Bootstrap API** (`sandbox-service.ts` bootstrap script, cạnh
`window.mdxVault.requestData`):

```ts
window.mdxVault.cells.publish(name, value): void
window.mdxVault.cells.subscribe(name, cb): () => void
```

**Enforcement (bắt buộc, test từng case)**:

- publish/subcribe tên nào ngoài manifest declaration → host từ chối, trả
  structured warning vào runtime-error channel hiện có (không im lặng drop);
- type/size validate khi publish; sai → deny + warning;
- rate limit: coalesce theo name, tối đa ~30 updates/s/island `[ước lượng —
  verify]`; vượt → drop + warning một lần;
- stale instance (note switch, iframe unmount) bị drop như message types hiện
  tại;
- host là relay duy nhất — hai iframe không bao giờ message trực tiếp.

**Proof mode (GOAL-25)**: cells KHÔNG phải capability (không network/fs/data);
Interactive Proof surface thêm một section **CELLS** cạnh PROPS/PROBLEMS: hiện
live bảng cells published/subscribed của proof session (giá trị + timestamp).
Proof vẫn zero-capability; không đụng permission store.

### 5. Dataflow view (Phase B)

Một panel/layers trips trong preview surface (không phải workbench item mới,
không split pane):

- liệt kê từng cell của note đang mở: name, type, producer (widget哪种 /
  island src / chỉ prose-consumed), consumers (prose refs, widget names,
  island srcs), current value;
- click vào row → scroll đến producer/consumer position trong preview (và
  editor khi ở source view) qua existing reveal mechanism;
- update theo subscription (giá trị live), bounded updates như §1;
- đây là **list-first UI**, không vẽ force-graph; dùng editorial tokens hiện
  có, không visual system mới.

### 6. Cross-note cells (Phase C)

- Producing side: widget thêm prop `shared?: boolean` (mặc định false);
  sandbox island manifest `publishes` thêm `shared: true` cho từng cell;
- Consuming: registry component user-facing mới **`LiveValue`** — props:
  `note` (wikilink-style note name/path, resolve qua index như wikilink
  resolution hiện có), `name`, `format?` — render giá trị live, static được ở
  export (§8);
- resolution: indexer (`index-service.ts`) extract cell declarations (widget
  `name`/`shared` props + island manifest `publishes`) vào table mới
  `note_cells(note_path, cell_name, cell_type, shared)` — bump
  SCHEMA_VERSION lên 5, giữ migration drop/recreate pattern hiện có;
- **Permission**: đọc cell cross-note cần explicit grant cho cặp
  (consuming note path, producing note path) — lưu `.app/cell-access.json`
  revision-based atomic (giống bookmarks/graph config pattern); prompt UI dùng
  cùng AlertDialog pattern của sandbox permission prompt; denied → LiveValue
  render locked placeholder với text label (không icon-only);
- KHÔNG có implicit vault-wide state access; trong cùng note không cần
  permission.

### 7. Adaptive prose + persistence (Phase C)

- Registry component **`When`**: props `cell` (name), `gte?/lte?/eq?/gt?/lt?`
  (number/string), hoặc không có operator (truthiness); children là prose;
  render children khi điều kiện thoả — dùng cùng expression evaluator, không
  mở grammar;
- persistence: chỉ cells có `persist`/`shared-persist` flag được ghi vào
  `.app/cells.json` (vault-scoped, atomic + revision + recovery khi corrupt —
  reset với notice, giống graph config recovery); giá trị persist SEED initial
  value khi mount, không bao giờ ghi đè prose/manifest/props file; tổng file
  size cap 1 MiB `[ước lượng — verify]`, quá → oldest-updated cells bị bỏ với
  warning.

### 8. Export & replay (Phase D)

- **Interactive export**: host stub trong `export-bundler.ts` được thêm cell
  bus shim cùng protocol; trusted hydration roots chia sẻ bus module-level
  trong exported page → wiring giữa widgets/prose sống lại trong exported HTML;
  embedded sandbox islands (đã allowed + no-network theo rule hiện có) cũng
  relay qua shim — mọi message vẫn zod-validated trong stub;
- `LiveValue` cross-note trong export: render **static snapshot** giá trị tại
  thời điểm export + label "snapshot", không live cross-note trong export;
- **Record/replay**: opt-in "Record session" trong preview (in-app only):
  ghi timeline `(timestamp, cellName, value)` các cell changes của note hiện
  tại, bounded 2 MiB `[ước lượng — verify]`; export option "embed session
  replay" nhúng timeline vào `mdx-vault-export-data` và exported page có
  playback controls (play/pause/seek) drive bus — replay là pure data, không
  capability mới, không code mới chạy;
- static export giữ nguyên mọi rule hiện có (fallback, CSP `script-src
  'none'`, leak check); replay không xuất hiện trong static mode.

### 9. AI wiring convergence (Phase D)

- KHÔNG write path AI mới. Wiring edits đi qua: `textPatch` (note MDX),
  `componentDraft` (manifest có `cells`) — schema `ai.ts` chấp nhận manifest
  `cells` hợp lệ; approval flow + repair loop + provenance giữ nguyên;
- `ai-system-prompt.ts` thêm cells contract (grammar, widgets, manifest shape)
  + ví dụ wiring edit; compile pipeline validate manifest cells như thường;
- thêm MỘT read-only tool `list_note_cells(notePath)` (qua SQLite index, cùng
  pattern `ai-tools.ts`) để assistant đọc wiring hiện có `[ước lượng — nếu
  prompt + read_note đủ trong spike thì bỏ tool này, ghi lý do trong ledger]`.

### 10. Performance bounds

- cell change → subscribed span/`ReactiveText` re-render: target ≤ 50 ms trên
  fixture demo `[ước lượng]`; đo và ghi ledger;
- MDX KHÔNG recompile khi cell đổi (verify: không gọi `compileMdx` trên cell
  update);
- bus coalescing theo §4; Dataflow view không re-render cả panel mỗi message
  (throttle 200 ms `[ước lượng]`);
- record timeline ghi qua batching, không block UI.

### 11. Security contract (tổng hợp — test từng mục)

1. `rehypeSafeHtml` không đổi; expression ngoài grammar/undeclared vẫn strip.
2. Không `eval`/`new Function`/`Function()` ở bất kỳ đâu trong cell path.
3. Mọi bus message zod-validated hai chiều, `channel` + `instanceId` scoped,
  origin/source checked, stale dropped.
4. Island chỉ publish/subscribe đúng manifest declarations; violation deny +
   structured warning.
5. Manifest cells đổi → content hash đổi → permission review lại (không
   mechanism riêng, verify bằng test).
6. Cross-note read cần explicit grant trong `.app/cell-access.json`; không có
   default allow.
7. Cell values JSON-only, size/type validated ở mọi entrance (widget set,
   sandbox publish, persistence load, replay apply).
8. Persistence/permission files chỉ trong `.app/`, atomic write, không đụng
   note files; không absolute path rời main process.
9. Export: CSP/no-network rules giữ nguyên; replay là data-only; leak check
   (`export-leak-check.ts`) pass.
10. Proof mode: cells hoạt động nhưng zero-capability matrix của GOAL-25 vẫn
    pass nguyên (network/fs/data denial, no permission-store mutation).

### 12. Documentation và product contract

Update (không overwrite unrelated user edits):

- `docs/architecture.md`: cell runtime, bus protocol, indexer cells, export
  shim, replay;
- `docs/security.md`: mục "Reactive cell bus (Goal 31)" — trust mapping
  (widget=Level 2, island=Level 3/4 qua manifest cells, prose=trusted
  transform, evaluator=app code), permission model cross-note, persistence
  bounds;
- `docs/mdx-conventions.md`: cách viết reactive note (grammar `{n}`, widgets,
  `When`, `LiveValue`, manifest `cells`), quy tắc "prose vẫn đọc được như văn
  bản";
- `docs/tech-stack.md`: quyết định no-external-store, rejected candidates;
- `docs/roadmap.md` + `goals/README.md`: thêm GOAL-31;
- `DESIGN.md`: chỉ nếu phát sinh design token/grammar mới dùng lại được;
- `example-vault/`: thêm một demo note "Reactive Sorting Demo" (sliders +
  prose refs + island subscribe + `When`) dùng làm fixture cho live journey.

Viết `docs/verification/goal-31-reactive-vault.md` làm completion ledger:
security matrix, protocol schema evidence, performance measurements, export
parity + replay evidence, screenshots wide/narrow, known bounded exclusions.

---

## Constraints

> Đây là phần quan trọng nhất. Agent PHẢI tuân theo.

- [ ] Chỉ làm GOAL-31. Không làm terminal, plugin host, marketplace, generic
  notebook, data fences (backlog riêng), hay unrelated polish.
- [ ] Đọc `docs/security.md` trước khi chạm main/preload/sandbox/preview.
- [ ] Dùng skills `frontend-design`, `vercel-react-best-practices`,
  `webapp-testing` cho UI/React/live verification theo repo rules.
- [ ] KHÔNG nới lỏng `rehypeSafeHtml` — prose binding chỉ qua remark transform
  thành trusted component trước sanitize; mọi strip-behavior test phải pass.
- [ ] KHÔNG evaluate user JS trong renderer/main: không `eval`, không
  `new Function`, không dynamic import user code; chỉ bounded evaluator tự
  viết.
- [ ] Giữ `contextIsolation: true`, `sandbox: true`, `nodeIntegration: false`,
  `webSecurity: true`; không absolute vault path sang renderer.
- [ ] Mọi schema message mới trong `src/shared/sandbox.ts` zod hai chiều;
  host filter theo source/instanceId như hiện tại.
- [ ] Manifest `cells` là optional; island không khai báo giữ đúng behavior
  hiện tại (regression tests phải chứng minh).
- [ ] Cell values JSON-serializable, typed, size-bounded ở mọi entrance.
- [ ] Cross-note reads: explicit permission only, `.app/` only, không default
  allow, không vault-wide state.
- [ ] Persistence không bao giờ ghi note/manifest/props; chỉ `.app/`.
- [ ] Export giữ CSP/no-network/size-limit/leak-check rules; replay data-only.
- [ ] Proof mode (GOAL-25) vẫn zero-capability; cells không cấp network/fs/
  data; không đụng permission store.
- [ ] AI: không write path mới; mọi edit qua patch/approve/provenance hiện có.
- [ ] Không thêm dependency ngoài (state lib, scheduler, …) trừ khi verified ở
  bước 1 và ghi ledger; dùng `bun add`, không npm/pnpm/yarn.
- [ ] Không upgrade React/Electron/CodeMirror/TypeScript/esbuild trong goal này.
- [ ] Giữ registry components hiện tại behavior-y nguyên (EquationSlider,
  CellGrid, InteractiveNote kit, WidgetFrameContext).
- [ ] Giữ one path = one workbench tab; Dataflow view là panel trong preview
  surface, không phải workbench item/split pane.
- [ ] Giữ editorial tokens; không gradient/glass/visual system mới.
- [ ] Preserve unrelated dirty-worktree changes; không revert/commit chung.
- [ ] Sau mỗi meaningful slice: `bun run typecheck` + `bun run lint`.
- [ ] Blocker → exhaust in-scope evidence rồi DỪNG và mô tả exact blocker;
  không silently shrink scope.

---

## Success Criteria

### Required Evidence per Criterion

| # | Tiêu chí | Verification Command / Evidence | Expected Output / Signal |
|---|----------|---------------------------------|--------------------------|
| 1 | Cell runtime bounded và đúng lifecycle | `bun test tests/goal31-cell-runtime.test.ts` | declare/set/get/subscribe đúng type+size; dispose không leak listener; over-limit warning không crash |
| 2 | Prose binding chỉ qua remark transform; sanitizer không yếu đi | `bun test tests/goal31-prose-binding.test.ts` + existing safe-html suites | declared `{n}`/arithmetics render live; undeclared/dangerous/member-access vẫn strip y như cũ |
| 3 | Evaluator bounded, không host JS eval | `bun test tests/goal31-expression-evaluator.test.ts` + `rg "new Function\|eval(" src` trong cell path | grammar allowlist pass; `require/fetch/constructor/assignment/template-literal` reject; không eval/new Function trong cell code path |
| 4 | Widgets publish cells + editor intelligence | `bun test tests/goal31-param-widgets.test.ts` | Slider/Toggle/Select declare+set; registry completion/hover/snippet có entries mới; EquationSlider/CellGrid không đổi |
| 5 | Sandbox bridge enforce manifest cells | `bun test tests/goal31-sandbox-cells.test.ts src/main/services/sandbox-service.goal05.test.ts` | undeclared publish/subscribe bị deny + warning; type/size/rate limit; stale drop; manifest không cells giữ behavior cũ; cells đổi → hash đổi → review lại |
| 6 | Proof CELLS inspector không破 zero-capability | `bun test tests/goal31-proof-cells.test.ts tests/interactive-proof-security.test.ts` | inspector hiện live values; network/fs/data vẫn denied; permission store không mutate |
| 7 | Dataflow view đúng và bounded | `bun test tests/goal31-dataflow-view.test.ts` | cells/producers/consumers đúng; click reveal đúng position; throttle không flood |
| 8 | Cross-note cells có permission thật | `bun test tests/goal31-cross-note-cells.test.ts` | không grant → locked placeholder; grant → live value; `.app/cell-access.json` revision/atomic; indexer note_cells đúng |
| 9 | Adaptive prose + persistence an toàn | `bun test tests/goal31-when-persistence.test.ts` | When render theo operator; persist seed-only, không ghi note; corrupt file → reset + notice |
| 10 | Export giữ reactivity + replay là data-only | `bun test tests/goal19-export-hardening.test.ts tests/goal31-export-replay.test.ts` | interactive export: wiring sống giữa widgets/prose; LiveValue là snapshot; static export fallback/CSP giữ nguyên; replay playback hoạt động; leak check pass |
| 11 | AI wiring qua patch/approve duy nhất | `bun test src/main/services/ai-approval-service.test.ts tests/goal31-ai-wiring.test.ts` | manifest cells hợp lệ trong componentDraft; textPatch wiring apply được; không write path mới; provenance giữ |
| 12 | Performance đo được | verification ledger | cell→span update ≤ 50 ms fixture; MDX không recompile trên cell change (có evidence); timings ghi cụ thể |
| 13 | Full regression gates | `bun test && bun run typecheck && bun run lint && bun run build` | tất cả exit 0 |
| 14 | Docs + example fixture đúng hành vi thật | review `docs/*` + ledger `docs/verification/goal-31-reactive-vault.md` | docs khớp shipped behavior; demo note dùng được làm fixture; không còn Remaining Work |

### Required live journey

Ghi từng bước với kết quả quan sát vào verification ledger:

1. Mở demo note "Reactive Sorting Demo" ở Reading view; kéo `Slider n`; xác
   nhận prose `{n}` và `{n * log2(n)}` cập nhật live, không flicker cả preview.
2. Thêm `{undeclaredName}` vào note; preview vẫn strip, không lỗi mới.
3. Mở demo island (subscribe `n`, publish `filteredRows`); kéo slider; island
   và Dataflow view cùng cập nhật.
4. Sửa manifest thêm publish tên chưa khai báo trong code; host deny +
   warning hiện đúng chỗ.
5. Trong Interactive Proof, chạy proof của island có cells; CELLS inspector
   hiện live values; proof vẫn từ chối network/data.
6. Đổi `cells` trong manifest; lưu; note preview yêu cầu permission review lại
   (content hash mới).
7. Tạo note B chứa `<LiveValue note="..." name="..." />`; deny → locked
   placeholder; allow → live; `.app/cell-access.json` xuất hiện đúng shape.
8. `<When cell="n" gte={100}>…</When>` chuyển trạng thái đúng khi kéo slider.
9. Bật `persist` cho một slider; restart app; value được seed lại; note file
   không đổi (git status sạch với note).
10. Export interactive của demo note; mở exported HTML offline; kéo slider;
    wiring sống; playback replay hoạt động nếu record.
11. Export static của cùng note; mọi island fallback đúng; không script.
12. Yêu cầu AI (nếu API key có) sửa wiring — ví dụ đổi expression; approve qua
    diff review; kết quả chạy đúng; từ chối (Reject) không ghi gì.
13. Lặp các bước chính ở narrow layout + keyboard-only.
14. Đóng/mở note, switch vault, restart: không stale cells, không listener
    leak (DevTools + tests).

### Reference Artifacts

- `goals/GOAL-31-reactive-vault.md` — source of truth.
- `docs/verification/goal-31-reactive-vault.md` — completion ledger.
- `docs/security.md` — invariant security boundary.
- `DESIGN.md` + `src/renderer/src/globals.css` — visual source of truth.

### Completion Condition

Agent kết thúc khi và chỉ khi:

- [ ] mọi Required Evidence row có authoritative passing evidence;
- [ ] toàn bộ live journey được quan sát và ghi lại;
- [ ] security contract §11 đủ 10/10 mục có test/evidence tương ứng;
- [ ] các regression suites hiện có (safe-html, sandbox goal05, export goal19,
      proof security, AI approval) pass không suy giảm;
- [ ] demo note example-vault hoạt động end-to-end;
- [ ] full test/typecheck/lint/build pass;
- [ ] docs/roadmap.md + goals/README.md có GOAL-31, docs khớp behavior;
- [ ] ledger không còn `Remaining Work`, unchecked row hay unresolved blocker;
- [ ] worktree review không có edits ngoài GOAL-31.

---

## Execution Plan

> Thực hiện theo thứ tự. Sau mỗi bước: report ngắn + `bun run typecheck` +
> `bun run lint` sau meaningful change.

1. **Baseline, spike, threat model**
   - Đọc toàn bộ required references; record baseline test/typecheck.
   - Spike: chốt exact bounded grammar + evaluator design; verify remark
     transform hoạt động với pipeline hiện có (draft plugin + fixture).
   - Spike: cell message schemas + rate/size limits; quyết định dependency
     (mặc định: không thêm gì).
   - Viết threat model ngắn vào ledger draft (11 mục §11 → test map).

2. **Phase A — runtime, widgets, prose binding**
   - CellRuntime module + unit tests (bounds, lifecycle).
   - Slider/Toggle/Select registry entries + tests; check editor intelligence
     tự nhận.
   - `remark-reactive-cells` + `ReactiveText` + evaluator + tests (kể cả
     regression strip cases).
   - Demo note draft trong example-vault; đo初步 perf.

3. **Phase B — sandbox bridge, proof inspector, dataflow**
   - Manifest schema `cells` + compile/validation + hash regression test.
   - Bootstrap API + zod messages + SandboxHost relay + enforcement tests.
   - Proof CELLS inspector; chạy lại proof security matrix.
   - Dataflow view panel + reveal + throttle tests.

4. **Phase C — cross-note, adaptive prose, persistence**
   - Indexer `note_cells` + SCHEMA_VERSION 5 + resolution qua wikilink path.
   - `LiveValue` + `.app/cell-access.json` permission flow + prompt UI + tests.
   - `When` + `.app/cells.json` persistence + recovery tests.
   - Demo note mở rộng cross-note + `When`.

5. **Phase D — export, replay, AI**
   - Export bus shim trong export-bundler + trusted roots wiring + tests.
   - Record timeline + playback controls + export embed + leak/size checks.
   - AI: manifest cells trong componentDraft + system prompt + (nếu spike
     xác nhận cần) `list_note_cells` tool; wiring tests.
   - Perf measurements hoàn chỉnh vào ledger.

6. **Docs, live QA, final audit**
   - Update docs theo §12; screenshots wide/narrow; keyboard pass.
   - Chạy full gates + regression suites; packaged offline smoke cho export
     replay.
   - Re-read goal từ disk; map mọi Target State + Success Criteria row tới
     evidence; `git diff` scope check; không mark complete khi còn row inferred.

---

## Out of Scope

- Reactive code fences (`js`/`data` fenced blocks như Observable) — backlog
  riêng; goal này chỉ grammar prose + widgets + islands.
- Scripting runtime (Lua/Space Lua), user-defined functions trong prose.
- Cross-vault cells, network sync của cells, collaboration/presence.
- Cell history/undo UI, time-travel debugger trong app (replay chỉ ở export).
- Marketplace/library chia sẻ widgets.
- Force-graph dataflow visualization (list-first đủ scope này).
- Ghost-text AI suggestions hay bất kỳ ambient AI nào.
- Generic plugin host / extension API.
- Đổi behavior của bất kỳ registry component hiện có.

---

## References

### Official external references

- Astro Islands (isolation limitation documented):
  <https://docs.astro.build/en/concepts/islands/>
- Observable Framework reactivity:
  <https://observablehq.com/framework/reactivity/>
- Quarto Observable JS:
  <https://quarto.org/docs/interactive/ojs/>
- MDX expressions:
  <https://mdxjs.com/docs/what-is-mdx/#expressions>
- MDX security guidance ("MDX is a programming language"):
  <https://mdxjs.com/docs/getting-started/#security>
- remark plugin fundamentals:
  <https://github.com/unifiedjs/unified#plugin>
- Electron security:
  <https://www.electronjs.org/docs/latest/tutorial/security>

### Repository references

- [AGENTS.md](../AGENTS.md)
- [goals/README.md](README.md)
- [docs/product-vision.md](../docs/product-vision.md)
- [docs/architecture.md](../docs/architecture.md)
- [docs/security.md](../docs/security.md)
- [docs/mdx-conventions.md](../docs/mdx-conventions.md)
- [docs/tech-stack.md](../docs/tech-stack.md)
- [DESIGN.md](../DESIGN.md)
- [GOAL-04 islands](GOAL-04-interactive-islands.md)
- [GOAL-05 sandbox](GOAL-05-sandbox-and-permissions.md)
- [GOAL-06 AI](GOAL-06-ai-assistant.md)
- [GOAL-17 kit](GOAL-17-interactive-note-mdx-kit.md)
- [GOAL-19 export fidelity](GOAL-19-interactive-note-export-fidelity.md)
- [GOAL-25 authoring](GOAL-25-interactive-authoring-workbench.md)
- [src/shared/sandbox.ts](../src/shared/sandbox.ts)
- [src/main/services/sandbox-service.ts](../src/main/services/sandbox-service.ts)
- [src/renderer/src/preview/sandbox/SandboxHost.tsx](../src/renderer/src/preview/sandbox/SandboxHost.tsx)
- [src/renderer/src/preview/safe-html.ts](../src/renderer/src/preview/safe-html.ts)
- [src/renderer/src/preview/registry/index.tsx](../src/renderer/src/preview/registry/index.tsx)
- [src/renderer/src/preview/MdxPreview.tsx](../src/renderer/src/preview/MdxPreview.tsx)
- [src/main/services/export-bundler.ts](../src/main/services/export-bundler.ts)
- [src/main/services/export-service.ts](../src/main/services/export-service.ts)
- [src/main/services/index-service.ts](../src/main/services/index-service.ts)
- [src/main/services/db-service.ts](../src/main/services/db-service.ts)
- [src/shared/ai.ts](../src/shared/ai.ts)
- [src/main/services/ai-system-prompt.ts](../src/main/services/ai-system-prompt.ts)

---

## Agent Instructions

### Execution

1. Đọc toàn bộ file này và required references trước khi làm.
2. Tuân theo Constraints tuyệt đối.
3. Thực hiện Execution Plan theo thứ tự (Phase A→D); report sau từng bước.
4. Dùng `rg` rồi `ast-grep outline` cho source lớn/unfamiliar theo `AGENTS.md`.
5. Dùng official docs/installed source, không code theo memory.
6. Sau meaningful change chạy typecheck + lint; tests theo risk.
7. Conflict giữa Target State/Execution Plan và Constraints → Constraints thắng.
8. Preserve unrelated dirty changes; overlap không tách được → dừng và báo
   exact file/hunk.
9. Khi xong, verify từng Success Criteria + live journey; không báo tổng quát.

### Anti-bias Instructions

**Chống Scope Shrink**

- KHÔNG redefine done thành "widgets share state" — prose binding, sandbox
  bridge, cross-note permission, export parity, replay và AI wiring đều bắt
  buộc.
- KHÔNG bỏ phase nào vì "phase sau là polish" — A→D là objective.
- KHÔNG thay prose binding bằng "component hiển thị giá trị" — `{n}` trong
  prose là tính năng cốt lõi.
- KHÔNG thay live journey bằng unit-test inference.

**Chống Uncertainty Stop**

- Uncertain evidence = not achieved; tiếp tục inspect/test.
- Nếu remark transform xung đột pipeline, giải quyết bằng plugin ordering/
  node copy — KHÔNG bằng cách nới safe-html.
- Nếu perf miss target, đo/profile/optimize hoặc ghi genuine blocker; không
  xóa criterion.
- Nếu grammar cần thu hẹp để an toàn, thu hẹp và ghi ledger — không mở rộng
  bằng cách thêm eval-type mechanism.

**Chống Memory Trust**

- Current filesystem, package lock, test output, live behavior là
  authoritative; re-open contracts/tests trước final claims.
- Re-run regression suites (safe-html, sandbox goal05, export goal19, proof
  security, AI approval) sau refactor cuối.
- Check packaged app cho export replay; không assume dev success.
