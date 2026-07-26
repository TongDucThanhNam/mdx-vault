# GOAL-25 Interactive Authoring Workbench verification

- Date: 2026-07-26
- Platform: Windows 11 (`10.0.26200`), Electron `39.8.10`, Bun `1.3.14`
- Result: pass
- Goal source: [`goals/GOAL-25-interactive-authoring-workbench.md`](../../goals/GOAL-25-interactive-authoring-workbench.md)
- Dev evidence: [`goal-25-live-results.json`](assets/goal-25-dev-full/goal-25-live-results.json)
- Packaged offline evidence:
  [`goal-25-live-results.json`](assets/goal-25-packaged-full/goal-25-live-results.json)

## Result

GOAL-25 is complete. A user can create an app-owned interactive transactionally
from a note, edit its physical project files in one Interactive Proof surface,
receive offline TypeScript diagnostics and language features, test in a
session-scoped zero-capability iframe, navigate structured Problems, and hand an
approved AI component into the same surface without granting run permission.

The final Windows executable repeated the complete journey with the renderer
network emulated offline. The run made no external renderer request and emitted
no console error. One page error, `goal25 runtime proof`, is intentionally
present: the journey throws it to prove runtime capture, last-good retention, and
recovery.

All mutations used randomized `%TEMP%/mdx-vault-goal25-*` vault and `userData`
directories copied from `example-vault`. The repository example vault and the
normal application profile were not used as writable fixtures.

## Success criteria

| # | Result | Verification |
|---|---|---|
| 1 | Pass | Scaffold and create-transaction tests cover blank/stateful files, nested POSIX `src`, Unicode UTF-16 insertion, collision/traversal/stale-revision rejection, and rollback at every commit stage. Live header creation inserted the note link and opened the new component. |
| 2 | Pass | `interactive:create` is the only create bridge. Zod bounds, main-frame checks, relative paths, restricted paths, symlink escapes, and safe error mapping passed. No generic renderer-controlled text creation API was added. |
| 3 | Pass | Component, manifest, and direct project README resolve to one canonical project root and one physical workbench tab per path. Missing/invalid files remain repairable and expose explicit actions. |
| 4 | Pass | The fixed TypeScript project catches semantic state mismatches that esbuild transpiles. Valid React/local-import projects pass. Manual compile, proof, and AI repair use the same structured semantic contract. |
| 5 | Pass | Live CodeMirror diagnostics, completion, one-transaction React auto-import/undo, hover, signature help, and local F12 definition worked. Package imports and root escapes were rejected without unsafe edits. |
| 6 | Pass | The direct typed worker protocol rejects stale versions and bounds project/files. Its 14,937,193-byte production chunk is separate from the 6,655,694-byte renderer entry and loads only for an interactive project. There is no ATA, CDN, Monaco, or LSP process. |
| 7 | Pass | Existing code opened `Not run`; Run consent stayed in memory. Requested network/filesystem/data capabilities remained unavailable, CSP retained `connect-src 'none'`, the data RPC returned an explicit authoring denial, and permission-store bytes did not change. |
| 8 | Pass | Normal Reading preview still required explicit review. An exact allowed clean hash could seed authoring consent, and a later source change returned normal preview status to `prompt`. |
| 9 | Pass | TypeScript, esbuild, manifest, preview-props, and runtime issues entered one structured Problems model, navigated to exact UTF-16 ranges, retained the last good proof, and recovered after repair. No absolute path reached diagnostics. |
| 10 | Pass | The existing AI UI made one real TanStack/OpenAI-adapter request to a deterministic loopback fixture, presented the three-file diff, required **Approve & write**, opened `component.tsx` in the same surface, and remained `Not run`. Provenance and bounded repair tests passed. |
| 11 | Pass | Wide source/proof/props/problems composition and narrow Source/Proof/Problems tabs were visually reviewed. Status is textual, controls are named, focus order starts at Source, Problems are keyboard activatable, and visible focus does not depend on motion or color alone. |
| 12 | Pass | `build:win` contains the worker, 100 TypeScript lib declarations, React/ReactDOM declarations, `csstype`, unpacked esbuild, and the unpacked React runtime closure. The final executable completed create/check/compile/proof while renderer networking was offline. |
| 13 | Pass | Dev cold Ready was 907.5 ms and packaged final cold Ready was 855.4 ms, both below 2,500 ms. Warm completion was 63.3 ms dev and 64.7 ms packaged, both below 500 ms. Worker/controller cleanup and stale-result tests passed. |
| 14 | Pass | Final full suite: 411 pass, 0 fail across 90 files. Typecheck, lint, production build, Windows package, and final packaged live smoke exited 0. |
| 15 | Pass | Architecture, security, MDX conventions, tech stack, roadmap, goal index, design system, and this ledger describe the shipped bounded TypeScript service and zero-capability authoring model without claiming a generic IDE or LSP. |

## Live journey record

The same automation drove both production Electron and
`dist/win-unpacked/mdx-vault.exe`; the packaged pass additionally enabled
renderer offline network emulation.

| # | Result | Observed signal |
|---|---|---|
| 1 | Pass | Reopened a disposable vault through the normal startup path and retained normal note/editor behavior. |
| 2 | Pass | Used the header create action on `notes/Welcome.mdx`; the app created `component.tsx`, `manifest.json`, and `README.md`, inserted `<Interactive src="../interactives/live-proof-counter" />`, and opened the component. The Command Palette and slash entry share this controller/dialog contract in focused tests. |
| 3 | Pass | The new app-owned zero-capability starter reached Ready automatically. An arbitrary existing denied component opened `Not run` until **Run isolated proof** was activated. |
| 4 | Pass | Introduced `setValue("string")`; TS2345 appeared from the unsaved buffer. Saving retained the last good proof while the saved compile issue remained visible. |
| 5 | Pass | Invoked completion on `useSt`; `useState` inserted with a React import as one edit. One Undo removed both changes. The packaged run performed this with networking offline. |
| 6 | Pass | Hovered local `add`, opened signature help inside `add(`, and pressed F12 to activate `helper.ts`. A non-allowlisted package and `../../outside` both produced bounded policy diagnostics. |
| 7 | Pass | Activated the current-file TS2345 Problem from the keyboard and landed on its exact source range; F12 exercised cross-file activation through `openOrActivate`. |
| 8 | Pass | Filled session-only preview props, observed invalid JSON as `PROPS_JSON_INVALID`, repaired it, and returned to Ready without writing props into MDX. |
| 9 | Pass | Exercised TypeScript, saved compile, runtime throw, invalid manifest, and invalid props failures one at a time; every state retained or cleared the last-good proof deterministically and recovered after repair. |
| 10 | Pass | Requested network, filesystem, and `assets/secret.csv` in the manifest. The authoring frame still had `connect-src 'none'`, denied `requestData`, and left permission-store bytes unchanged. |
| 11 | Pass | Opened normal Reading preview, reviewed and stored an explicit Allow, then changed the source hash and observed normal preview return to **Review** / `prompt`. |
| 12 | Pass | Stopped proof, reloaded the renderer, reopened the component, and observed `Not run`, proving authoring consent was session memory only. |
| 13 | Pass | Sent “Create a small React counter interactive.” through the existing AI assistant, received a three-file proposal, clicked **Approve & write**, and observed `ai-live-proof/component.tsx` in the same Proof surface at `Not run`. |
| 14 | Pass | Repeated Source/Proof/Problems at 980×760. Keyboard Enter activated the Problems tab, the Problem row revealed source, and tab order kept Source before Proof and Problems. |
| 15 | Pass | Repeated the full journey in `win-unpacked` with renderer networking offline, including completion, semantic diagnostics, esbuild compile, iframe proof, permission behavior, AI approval, and restart reset. |

## Semantic feature matrix

| Feature | Live result | Boundary |
|---|---|---|
| Diagnostics | TS2345 appeared from the unsaved component and recovered after repair. | Fixed ES2022 + DOM + React virtual project; no workspace `tsconfig`. |
| Completion | `useSt` offered `useState`; warm response was 63.3 ms dev / 64.7 ms packaged. | Current project snapshot only; no network or ATA. |
| Auto-import | React import and symbol completion applied in one undoable transaction. | Only allowlisted React/local sources; overlapping/unsafe edits rejected. |
| Hover | Local helper showed `add(left: number, right: number): number`. | Bounded plain text; no HTML from the language service. |
| Signature help | Call-site caret after `add(` showed two parameters. | Current unsaved project version. |
| Definition | F12 opened the physical `helper.ts` tab. | Local project files only, through canonical `openOrActivate`. |
| Dependency policy | Unknown package and project-root escape produced structured diagnostics. | `react` and `react-dom` only; local imports must remain in project. |

## Security evidence

| Invariant | Evidence |
|---|---|
| No arbitrary auto-run | Existing denied project opened `Not run`; AI approval also opened `Not run`. |
| No persistent authoring grant | Permission bytes were identical before/after authoring proof; reload cleared consent. |
| No network capability | Authoring HTML retained `connect-src 'none'`; packaged renderer external request list was empty. |
| No vault data capability | `window.mdxVault.requestData("assets/secret.csv")` rejected with `Authoring proof cannot access vault data.` |
| No filesystem capability | Manifest request did not change proof capability or expose a filesystem bridge. |
| No same-origin/storage promotion | iframe remains `sandbox="allow-scripts"` without `allow-same-origin`; document is published through the existing opaque sandbox protocol. |
| Normal permission model preserved | Explicit normal Allow persisted for the exact hash; a later hash returned to prompt. |
| Bounded messages | Zod validates instance IDs, runtime events, props, and data outcomes; runtime text/stack limits passed. |
| No path leak | structured compile tests assert vault-relative or null paths; main errors map to safe public messages. |
| AI remains assistive | Model output stayed a proposal until explicit approval; provenance remained required; approval did not run code. |

## Performance and package evidence

| Measurement | Dev | Packaged offline | Budget |
|---|---:|---:|---:|
| Create → surface | 1,166.86 ms | 1,022.01 ms | Recorded |
| Create → Ready | 1,390.73 ms | 1,132.03 ms | ≤ 2,500 ms |
| Cold language/proof Ready | 907.5 ms | 855.4 ms | ≤ 2,500 ms |
| First diagnostics | 113.4 ms | 109.0 ms | Recorded |
| Warm completion | 63.3 ms | 64.7 ms | ≤ 500 ms |

Production artifact inventory:

- main startup entry: 931,293 bytes;
- lazy export service chunk: 235,548 bytes;
- renderer startup entry: 6,655,694 bytes;
- lazy TypeScript worker: 14,937,193 bytes;
- preload: 11,873 bytes;
- packaged type resources: 100 TypeScript lib files, 7 React declaration
  files, 13 ReactDOM declaration files, and `csstype/index.d.ts`;
- compiler runtime: unpacked esbuild JS/binary plus unpacked
  `react`/`react-dom`/`scheduler` sources for the native esbuild child process;
- NSIS installer: 173,022,625 bytes (165.01 MiB).

The export service is loaded only when export IPC is invoked. This prevents
renderer registry/UI dependencies from blocking packaged main startup. The
TypeScript worker stays outside the ordinary renderer entry and is created only
when an interactive source project is active.

The build retains known non-blocking Vite warnings: modules imported both
statically and dynamically cannot move to another chunk; `gray-matter` contains
an upstream `eval`; CodeMirror JSON/Python languages are shared by static and
dynamic paths. The package also reports absent esbuild binaries for other
platform/architecture optional dependencies while correctly including and
signing `@esbuild/win32-x64`.

## UI evidence

Dev:

- [existing project at Not run](assets/goal-25-dev-full/goal-25-existing-not-run.png)
- [wide Ready workbench](assets/goal-25-dev-full/goal-25-wide-ready.png)
- [wide compile issue with last-good proof](assets/goal-25-dev-full/goal-25-wide-compile-issue.png)
- [narrow keyboard Problems surface](assets/goal-25-dev-full/goal-25-narrow-problems.png)

Packaged offline:

- [existing project at Not run](assets/goal-25-packaged-full/goal-25-existing-not-run.png)
- [wide Ready workbench](assets/goal-25-packaged-full/goal-25-wide-ready.png)
- [wide compile issue with last-good proof](assets/goal-25-packaged-full/goal-25-wide-compile-issue.png)
- [narrow keyboard Problems surface](assets/goal-25-packaged-full/goal-25-narrow-problems.png)

Visual review found the surface consistent with the editorial paper/ink system:
hard rules, mono operational labels, serif title, red issue state, blue success
state, square controls, no gradient/glass treatment, and no generic dark IDE
chrome.

## Automated evidence

| Command | Result |
|---|---|
| `bun test tests/interactive-scaffold.test.ts tests/interactive-create-transaction.test.ts` | 9 pass, 0 fail |
| `bun test tests/interactive-authoring-ipc.test.ts` | 4 pass, 0 fail |
| `bun test tests/interactive-project.test.ts tests/interactive-authoring-controller.test.ts` | 8 pass, 0 fail |
| `bun test tests/interactive-language-service.test.ts src/main/services/sandbox-service.goal05.test.ts` | 10 pass, 0 fail |
| `bun test tests/interactive-code-intelligence.test.ts tests/interactive-language-worker.test.ts` | 7 pass, 0 fail |
| `bun test tests/interactive-proof-security.test.ts tests/interactive-authoring-proof-ipc.test.ts tests/sandbox-messages.test.ts` | 10 pass, 0 fail |
| `bun test tests/interactive-diagnostics.test.ts tests/interactive-proof-runtime.test.ts` | 6 pass, 0 fail |
| `bun test src/main/services/ai-approval-service.test.ts src/main/services/ai-repair-loop.test.ts tests/interactive-ai-handoff.test.ts` | 7 pass, 0 fail |
| `bun test tests/interactive-proof-workbench.test.tsx` | 2 pass, 0 fail |
| `bun test` | 411 pass, 0 fail across 90 files; 2,697 assertions |
| `bun run typecheck` | Exit 0 |
| `bun run lint` | Exit 0; 400 files checked |
| `bun run build` | Exit 0 |
| `bun run build:win` | Exit 0; signed `win-unpacked`, NSIS installer, and block map created |
| `python -m py_compile scripts/verify-goal25-live.py` | Exit 0 |
| Dev live script with `--mock-ai` | Exit 0; 16 events |
| Packaged live script with `--offline --mock-ai` | Exit 0; 16 events |

The AI fixture is deliberately deterministic and local. It uses the existing
persisted `baseUrl` setting to route the real main-process
`@tanstack/ai-openai` request to a loopback OpenAI Responses SSE server. The
renderer, IPC, adapter, proposal parser, compile-repair path, diff/approval UI,
transactional write, and handoff are real. No external model or external
network service is claimed.
