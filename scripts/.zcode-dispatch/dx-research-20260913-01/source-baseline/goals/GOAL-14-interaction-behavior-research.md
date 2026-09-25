# GOAL-14 — Obsidian Interaction-Behavior Deep Audit

> File created by the create-goal skill.
> Executing agent: read this entire file before doing anything.
> Must also read and follow [AGENTS.md](../AGENTS.md), [docs/product-vision.md](../docs/product-vision.md), and [docs/research/obsidian-core-plugins-parity-2026-07.md](../docs/research/obsidian-core-plugins-parity-2026-07.md).

---

## Objective

Research Obsidian's Windows desktop interaction-level behaviors systematically—context menus, click and modifier-click behavior, drag-and-drop routes, clipboard/paste handling, editing shortcuts, focus and selection transitions, hover/disclosure behavior, and operating-system ingress/egress—and compare them with the current mdx-vault code and running app.

Produce an evidence-backed audit at `docs/research/obsidian-interaction-behaviors-2026-07.md`, synchronize the summary in the existing Obsidian parity report, and propose implementation bundles for later goals.

**This is a research goal. Do not implement or fix any product behavior.**

---

## Context

- **Reason**: Section 4 of the existing parity report established a first-pass interaction matrix, but these behaviors are dispersed across the Obsidian help vault and many are undocumented. They need a dedicated, reproducible audit before implementation work is scoped.
- **Why this layer matters**: Interaction behavior determines whether existing features feel complete. It also contains correctness and data-integrity contracts that feature inventories miss—for example, generated link format and rewriting internal links when a note is renamed.
- **Priority**: evidence and completeness > speed. A behavior is not considered verified merely because no matching event handler was found.
- **Executor**: AI Agent, with live desktop-app access where available.
- **Created**: 2026-07-10.
- **Primary platform**: Windows 11. Document macOS modifier differences from official help, but do not claim live macOS verification.
- **Relationship to GOAL-13**: GOAL-13 implemented several command-level microfeatures. This goal starts below that level and must audit the interactions around those features without changing them.

### Research baseline found while creating this goal

| Item | Baseline to verify at execution time |
|------|--------------------------------------|
| Obsidian desktop | `C:\Program Files\Obsidian\Obsidian.exe`, product version `1.12.7.0` |
| Official help clone | Existing scratchpad clone under `%LOCALAPPDATA%\Temp\claude\...\scratchpad\obsidian-help`; locate it rather than assuming the session-specific UUID |
| Help commit | `f9b17275eade57af64d545bb057a791548dc91e9` dated 2026-06-16; refresh with a fast-forward fetch if safe, then pin the commit actually audited |
| Existing interaction audit | Section 4 of `docs/research/obsidian-core-plugins-parity-2026-07.md` |
| mdx-vault context menus | `FileTree.tsx` gives file rows five actions: Duplicate, Rename, Copy path, Reveal in explorer, Delete. Folder rows are static and have no context menu |
| mdx-vault paste/drop | `MdxEditor.tsx` intercepts allowlisted image MIME types only and persists them through `onSaveImage`; other transfers fall through |
| Hotkey collision to verify | `App.tsx` handles `Ctrl+Shift+V` globally as view-mode cycling while Obsidian/OS editing conventions use it for paste without formatting |
| Rename integrity to verify | `VaultService.renameFile()` renames the filesystem entry but does not rewrite wikilinks in other notes |

Treat every baseline above as a hypothesis until it is rechecked against the worktree and running applications.

---

## Current State

| Item | Current value |
|------|---------------|
| Runtime / UI | Electron 39, React 19, TypeScript, CodeMirror 6, Radix UI primitives |
| Package manager | bun; use `bun run ...` for project commands |
| Test setup | Typecheck and ESLint scripts exist; there is no dedicated checked-in end-to-end Electron interaction suite |
| Existing mdx-vault surfaces | Source editor, rendered preview, file/folder tree, search, quick switcher, command palette, slash/component palettes, backlinks, outline, tags, dialogs, AI panel, export dialog, side panels |
| Existing app-wide shortcuts | A small hardcoded `window.keydown` handler in `App.tsx`; command hotkey labels are metadata and are not proof that the shortcut is executable |
| File-tree pointer behavior | File rows support click plus one context menu; directories render as always-expanded labels with no click, collapse, rename, context menu, or drag contract |
| Clipboard / external files | Editor paste/drop explicitly recognizes PNG, JPEG, GIF, WebP, and SVG images. Attachment location and generated Markdown syntax are fixed by the current implementation |
| Link generation policy | No shared user-configurable policy for shortest/relative/absolute links, wikilinks versus Markdown links, or attachment destination |
| Parity documentation | The existing report has preliminary matrices for 9 context-menu surfaces, 8 drag/drop flows, 6 paste/attachment behaviors, and two hotkey layers, but it is not an exhaustive source or live-app audit |

---

## Target State

### Required deliverables

| Deliverable | Required content |
|-------------|------------------|
| `docs/research/obsidian-interaction-behaviors-2026-07.md` | Versioned methodology, source-coverage ledger, surface inventory, master behavior matrix, live observations, mdx-vault evidence, prioritized bundles, reproduction appendix, and unresolved questions |
| `docs/research/evidence/obsidian-interactions-2026-07/` | Cropped screenshots only for undocumented or ambiguous live-app behavior; avoid redundant screenshots and large video/GIF files |
| Existing parity report | Replace or extend Section 4 with a concise summary, current counts, highest-risk findings, and a link to the deep audit. Do not duplicate the full matrix |
| Future work | Two to four draft objectives for later implementation goals. Draft objectives only—not full goal files and no product code |

### Master behavior row schema

Every independently testable behavior must have one row and a stable ID. Use these prefixes:

- `CTX` — context menus and alternate actions
- `PTR` — click, double-click, modifier-click, pointer selection
- `DND` — drag-and-drop
- `CLP` — clipboard, copy, cut, paste, paste conversion
- `KEY` — editing shortcuts and application hotkeys
- `SEL` — selection and multi-selection
- `FOC` — focus entry, restoration, escape, and modal/palette transitions
- `HOV` — hover, tooltip, preview, and progressive disclosure
- `NAV` — keyboard/pointer navigation within lists, trees, panes, and dialogs
- `OSE` — operating-system ingress/egress such as Explorer drops, browser HTML, external URLs, and reveal/copy-path behavior

Each row must contain:

| Field | Meaning |
|-------|---------|
| ID | Stable identifier such as `DND-004` |
| Family | One of the prefixes above |
| Surface and state | Exact source surface plus relevant state, such as editor selection, unselected file, folder, search result, or open modal |
| Trigger | Pointer/keyboard action and all relevant modifiers |
| Input / destination | Data type or drop target when applicable |
| Obsidian result | Observable outcome, including insertion syntax or focus result |
| Platform / setting preconditions | Windows/macOS differences, editing mode, enabled core plugin, link/attachment setting, or selection state |
| Obsidian evidence | Pinned official-help link and line, or live-app reproduction plus screenshot reference |
| mdx-vault result | Observable current result, not intended behavior |
| mdx-vault evidence | Exact code path/line and live reproduction where feasible |
| Verdict | `FULL`, `PARTIAL`, `MISSING`, `CONFLICT`, `PREREQUISITE`, or `NOT_APPLICABLE` |
| Risk | `DATA_INTEGRITY`, `DESTRUCTIVE`, `CORRECTNESS`, `ACCESSIBILITY`, `WORKFLOW`, or `POLISH` |
| Bundle | Recommended future implementation bundle or explicit defer reason |

### Surface coverage

Audit all currently available mdx-vault surfaces in depth:

1. Editor text with no selection, text selection, line start, internal link, heading, table/callout markup, and attachment insertion.
2. Rendered preview prose, internal/external links, headings, code blocks, media, and interactive islands where relevant.
3. File explorer file row, folder row, selected/unselected row, nested path, tree background, rename input, and empty state.
4. Search results, backlinks/unlinked mentions, outline headings, and tags.
5. Quick switcher, Command Palette, slash palette, component palette, and create-note dialog.
6. Main app shell, side panels, resize boundaries, toolbar actions, dialogs, and disabled/loading/error states.
7. Operating-system boundaries: Windows Explorer, browser HTML/text, clipboard formats, external file types, reveal/copy path, and app-to-external drag where supported.

Account for documented behavior on missing platform surfaces—tabs/panes, ribbon, Settings/Hotkeys, Properties, Bookmarks, Graph, Canvas, and Bases—but mark it `PREREQUISITE` and summarize it by interaction contract. Do not perform a deep Canvas/Bases feature audit inside this goal.

### Required source families

The audit must cover, at minimum:

- Every Windows/Linux row in `Editing and formatting/Editing shortcuts.md`.
- Every route and modifier in `User interface/Drag and drop.md`.
- Every attachment insertion/location behavior in `Editing and formatting/Attachments.md`.
- Customizable hotkey behavior in `User interface/Hotkeys.md`, kept separate from non-customizable editing shortcuts.
- Link modifier behavior, tab behavior, and pane/drop-zone behavior in `User interface/Tabs.md` and `Linking notes and files/Internal links.md`.
- All relevant official-help matches for the interaction lexicon in the methodology below.
- A live right-click pass across every applicable surface/state combination, because context-menu contents are incompletely documented.

---

## Constraints

> These constraints are mandatory. If they conflict with the execution plan, follow the constraints.

- [ ] **Research only. Do not implement fixes or features.** Do not edit `src/`, `tests/`, `scripts/`, `package.json`, `bun.lock`, build configuration, or dependencies.
- [ ] Allowed repository changes are limited to `docs/research/`, the evidence folder named above, and a documentation-only synchronization of the existing parity report.
- [ ] Do not create GOAL-15+ files. Add only two to four draft objectives inside the research report.
- [ ] Use official Obsidian help/GitHub content as the primary documented source. Use the installed Obsidian app for undocumented behavior. Community posts may identify a lead but may not be the sole evidence for a matrix row.
- [ ] Reuse the existing `obsidian-help` scratchpad clone. Do not crawl the help website page by page and do not create another clone. Record the audited commit SHA and date.
- [ ] If the clone can be safely refreshed, use a fast-forward-only update. If it cannot, continue from the existing pinned commit and label the source date explicitly; do not silently claim it is current.
- [ ] Never open, edit, rename, or reconfigure a user's real Obsidian vault. Create a disposable audit vault under `%TEMP%` with fixture notes/files. Delete it only if the absolute resolved path is verified to be that disposable directory.
- [ ] Do not leave persistent Obsidian settings or hotkey changes behind. Record original values before changing any setting, restore them afterward, and report any state that could not be restored.
- [ ] Windows 11 is the live verification platform. Document official macOS modifier equivalents where the source provides them. Mobile/touch-only behavior is out of scope and must be listed as such in the source-coverage ledger rather than silently omitted.
- [ ] Keep command hotkeys and OS/framework editing shortcuts as two separate inventories. A displayed hotkey label is not evidence that mdx-vault handles it.
- [ ] A missing grep result is not proof of missing behavior. Verify mdx-vault with code inspection and live interaction when feasible. If live verification is blocked, use `[needs confirmation]`; do not upgrade an inference to a fact.
- [ ] One row must describe one trigger/result contract. Do not compress multiple modifier variants, surfaces, or data types into a single vague row.
- [ ] Missing surfaces must be classified as `PREREQUISITE`, not mixed into ordinary `MISSING` counts. `NOT_APPLICABLE` requires an explicit product-vision reason.
- [ ] Treat rename/link rewriting, destructive actions, clipboard conversion, external-file import, and attachment placement as correctness/security-sensitive. Rank proven data-integrity failures above convenience polish regardless of numeric score.
- [ ] Do not include secrets, personal vault paths, note content, account details, or unrelated desktop content in screenshots. Crop evidence to the application surface under test.
- [ ] Do not add browser automation, Electron drivers, or test dependencies for this audit. Use existing tooling and available desktop control only.
- [ ] Preserve unrelated worktree changes and do not stage or commit them accidentally.
- [ ] If a required source or application is unavailable, continue all other research and mark only the affected rows `[needs confirmation]`; do not shrink the objective to the easy subset.

---

## Success Criteria

> Completion requires authoritative evidence. Uncertainty means not yet verified.

### Required Evidence per Criterion

| # | Criterion | Verification command / action | Expected output or signal |
|---|-----------|-------------------------------|---------------------------|
| 1 | The dedicated audit exists with all required sections | `Test-Path docs/research/obsidian-interaction-behaviors-2026-07.md`; then `rg -n "^## (Methodology and Versions|Interaction Taxonomy|Source Coverage Ledger|Master Behavior Matrix|Live Obsidian Evidence|mdx-vault Evidence|Prioritized Bundles|Data-Integrity Findings|Unresolved Questions|Reproduction Appendix|Draft Objectives)" docs/research/obsidian-interaction-behaviors-2026-07.md` | File exists and all 11 headings are present |
| 2 | The matrix is granular rather than a small illustrative sample | Count IDs with PowerShell/`rg`: `CTX|PTR|DND|CLP|KEY|SEL|FOC|HOV|NAV|OSE` row prefixes | At least 75 unique IDs, no duplicate IDs, and every row has all schema fields |
| 3 | Official-help search coverage is accounted for | Run the recorded lexicon grep against the pinned `obsidian-help/en` tree and compare its unique Markdown files with the Source Coverage Ledger | Zero unaccounted matching source files. Each excluded source has a concrete reason such as mobile-only, Sync/Publish-only, duplicate, or feature-dependent |
| 4 | Canonical interaction documents are exhaustively represented | Cross-check `Editing shortcuts.md`, `Drag and drop.md`, `Attachments.md`, `Hotkeys.md`, `Tabs.md`, and `Internal links.md` against matrix IDs | Every Windows editing-shortcut row and every documented route/modifier has either a behavior row or an explicit justified ledger disposition |
| 5 | Undocumented context menus are inspected in the real Obsidian app | Use Obsidian's disposable vault and right-click each applicable surface/state listed under Surface Coverage | A live-observation table covers at least 12 distinct surface/state combinations; undocumented/ambiguous menu contents have cropped evidence or a precise reproduction log |
| 6 | Setting-dependent behavior is not flattened into one result | Test representative link-format, attachment-location, paste-conversion, and relevant editor-setting states in the disposable Obsidian vault | Matrix rows record the setting precondition and changed observable result; original app settings are restored |
| 7 | mdx-vault is verified through both source and the running app | Inspect the current files, launch mdx-vault against a disposable fixture vault, and execute the applicable matrix cases | Every `FULL`, `PARTIAL`, `MISSING`, or `CONFLICT` verdict has code evidence; high-risk and ambiguous cases also have live reproduction evidence or `[needs confirmation]` |
| 8 | Known high-risk hypotheses receive explicit tests | Verify rename-with-incoming-wikilinks, `Ctrl+Shift+V`, file versus folder context menus, image versus non-image paste/drop, and generated attachment/link destination | Each case has before/action/after evidence and a verdict. Any data-integrity failure appears in the dedicated findings section and top priority bundle |
| 9 | Prioritization produces executable future scope | Review the Prioritized Bundles and Draft Objectives sections | Gaps are grouped by shared interaction contract/dependency, each bundle has impact, effort `[estimate]`, prerequisites, risk override, and a measurable draft objective; two to four draft objectives exist |
| 10 | Existing parity documentation is synchronized | `rg -n "obsidian-interaction-behaviors-2026-07|Interaction-level" docs/research/obsidian-core-plugins-parity-2026-07.md` | Section 4 links to the deep audit and its counts/findings do not contradict the new report |
| 11 | The goal made no product changes | `git diff --name-only -- src tests scripts package.json bun.lock electron.vite.config.ts` | No output |
| 12 | Repository checks still pass | `bun run typecheck` and `bun run lint` | Both commands exit 0. If pre-existing unrelated failures occur, preserve exact output and prove they are not caused by documentation-only changes |

### Required report methodology

The report must include the exact command, pinned help commit, and unique-file counts for a case-insensitive interaction lexicon at least as broad as:

```text
right-click | context menu | drag | drop | paste | clipboard |
double-click | middle-click | hover | hold Ctrl/Alt/Shift | modifier |
click | focus | select/selection | scroll | mouse/pointer |
keyboard | shortcut | hotkey | Escape | Enter | Tab
```

Do not treat all raw matches as requirements. The Source Coverage Ledger must classify each matching official-help file as included, duplicate/covered elsewhere, mobile-only, commercial-service-only, or feature-dependent. The completion signal is zero unaccounted files, not a particular raw match count.

### Required live fixtures

The disposable Obsidian and mdx-vault audit vaults must contain, at minimum:

- A note linking to another note by title and alias.
- A note with incoming links so rename rewriting can be observed.
- Plain unlinked mentions.
- Headings, a callout, a Markdown table, an internal link, an external link, a code block, and frontmatter properties.
- Nested folders and at least three files for selection/move tests.
- PNG/image, PDF, plain-text, HTML, and unsupported binary fixtures small enough for safe local testing.
- Rich HTML and plain-text clipboard samples with known expected Markdown/plain output.

Record fixture names and initial content in the report so another agent can reproduce the tests without relying on memory.

### Reference Artifacts

- [docs/research/obsidian-core-plugins-parity-2026-07.md](../docs/research/obsidian-core-plugins-parity-2026-07.md) — first-pass Section 4 and current parity summary.
- [docs/research/feature-gap-2026-07.md](../docs/research/feature-gap-2026-07.md) — broader feature-level audit; do not duplicate it.
- [docs/product-vision.md](../docs/product-vision.md) — determines `NOT_APPLICABLE` and vision-fit decisions.
- [docs/security.md](../docs/security.md) — relevant to external files, clipboard input, generated links, and renderer/main boundaries.
- Current code evidence to inspect: `src/renderer/src/App.tsx`, `src/renderer/src/editor/MdxEditor.tsx`, `src/renderer/src/explorer/FileTree.tsx`, `src/renderer/src/explorer/QuickSwitcher.tsx`, `src/renderer/src/commands/CommandPalette.tsx`, `src/renderer/src/editor/SlashCommandPalette.tsx`, `src/renderer/src/search/SearchPane.tsx`, `src/renderer/src/panels/BacklinksPanel.tsx`, `src/renderer/src/panels/OutlinePanel.tsx`, `src/renderer/src/panels/TagsPanel.tsx`, `src/renderer/src/preview/MdxPreview.tsx`, `src/main/services/vault-service.ts`, preload types, and relevant IPC handlers.
- Official help repository: https://github.com/obsidianmd/obsidian-help

### Completion Condition

The goal is complete only when:

- [ ] All twelve criteria above have evidence.
- [ ] The source ledger reports zero unaccounted candidate documents.
- [ ] The master matrix contains at least 75 unique behavior rows and all canonical document rows/routes are represented.
- [ ] All applicable current mdx-vault surfaces and at least 12 live Obsidian surface/state combinations were audited.
- [ ] High-risk hypotheses were tested rather than copied from the previous report.
- [ ] The existing parity report links to and agrees with the dedicated audit.
- [ ] No product code, dependency, test, or build configuration changed.

---

## Execution Plan

> Execute in order. Report briefly after each phase before continuing.

1. **Baseline and source pinning**
   - Read AGENTS, product vision, security, GOAL-13, and both research reports.
   - Confirm the worktree state and record unrelated changes.
   - Locate the existing `obsidian-help` scratchpad clone, refresh fast-forward-only if safe, and record commit/date.
   - Record installed Obsidian and mdx-vault/Electron versions.

2. **Build the candidate-source ledger**
   - Run the interaction lexicon across `obsidian-help/en`.
   - Normalize and deduplicate matched Markdown paths.
   - Classify every candidate file before extracting behavior rows.
   - Read every canonical document and every included candidate file in full; do not rely on grep snippets alone.

3. **Define surfaces, states, and fixtures**
   - Create the audit report skeleton and stable ID namespaces.
   - Enumerate surface/state combinations for both apps.
   - Create disposable Obsidian and mdx-vault fixtures under verified `%TEMP%` paths. Do not touch user vaults or `example-vault` unless the user explicitly authorizes it.

4. **Extract documented behavior contracts**
   - Convert official help behavior into one-row-per-contract entries.
   - Preserve modifiers, selection state, editing mode, plugin enablement, link format, attachment location, and platform differences.
   - Pin source links to the audited help commit where possible.

5. **Live Obsidian audit**
   - Inspect context menus surface by surface and state by state.
   - Exercise representative drag/drop, clipboard, modifier-click, focus, keyboard navigation, hover, and OS-boundary cases.
   - Vary relevant settings deliberately, restore them, and capture only ambiguous/undocumented evidence.

6. **mdx-vault code audit**
   - Map each applicable behavior to event handlers, CodeMirror extensions/keymaps, React primitives, preload/IPC calls, and main-process filesystem behavior.
   - Separate explicit behavior from browser/CodeMirror defaults and from hotkey labels that have no actual handler.
   - Record exact file/line evidence.

7. **Live mdx-vault audit**
   - Launch against the disposable fixture vault.
   - Execute applicable matrix rows, prioritizing code/default ambiguity and correctness-sensitive flows.
   - Explicitly test rename link integrity, `Ctrl+Shift+V`, file/folder context menus, paste/drop MIME classes, link generation, and focus restoration.

8. **Classify and prioritize**
   - Assign verdict and risk to every row.
   - Group gaps into coherent implementation bundles such as rename/link policy, editor clipboard/context menu, explorer interactions, drag/drop/attachments, keyboard/focus baseline, and settings/hotkey infrastructure.
   - Use the existing `Impact × VisionFit / Effort` rubric for comparability, but apply a hard priority override for proven data-integrity/destructive failures.

9. **Write and synchronize documentation**
   - Complete the dedicated report, source ledger, evidence references, counts, uncertainties, and two to four draft objectives.
   - Update Section 4 of the existing parity report to a summary and link. Do not copy the whole matrix into both files.

10. **Verify completion**
    - Run every Success Criteria command/action.
    - Confirm no product files changed.
    - Run typecheck and lint.
    - Report each criterion with its evidence and any remaining `[needs confirmation]` rows.

---

## Out of Scope

- Implementing any context menu, drag/drop route, paste handler, setting, hotkey editor, link rewrite, or other product behavior.
- Adding automated UI test infrastructure or dependencies.
- Deep feature audits for Canvas, Bases, Graph, Tabs/Workspaces, Sync, Publish, mobile, or touch gestures. Their interaction prerequisites must be recorded, but their internal feature behavior belongs to separate goals.
- Community-plugin interaction parity.
- macOS or mobile live testing.
- Visual redesign, accessibility remediation, performance optimization, or security fixes.
- Creating full implementation goals beyond GOAL-14.

---

## References

- Official Obsidian help repository: https://github.com/obsidianmd/obsidian-help
- Obsidian help — drag and drop: https://obsidian.md/help/drag-and-drop
- Obsidian help — editing shortcuts: https://obsidian.md/help/editing-shortcuts
- Obsidian help — hotkeys: https://obsidian.md/help/hotkeys
- Obsidian help — attachments: https://obsidian.md/help/attachments
- Obsidian help — tabs: https://obsidian.md/help/tabs
- Obsidian help — internal links: https://obsidian.md/help/links
- Existing audit: [docs/research/obsidian-core-plugins-parity-2026-07.md](../docs/research/obsidian-core-plugins-parity-2026-07.md)
- Product vision: [docs/product-vision.md](../docs/product-vision.md)
- Security model: [docs/security.md](../docs/security.md)

---

## Agent Instructions

### Execution

1. Read this file and all required references before starting.
2. Follow Constraints absolutely. This goal produces research documentation only.
3. Execute the plan in order and report briefly after each phase.
4. If Constraints and Execution Plan conflict, Constraints win.
5. Treat previous reports and conversation memory as leads, not evidence. Reinspect the current worktree and running applications.
6. Use `[estimate]` for effort and `[needs confirmation]` for evidence that could not be observed.
7. Do not redefine completion as a small sample of interactions. Coverage is source-led and surface-led.
8. When finished, report every Success Criterion with the exact evidence used.

### Anti-bias instructions

**Against scope shrink**

- Do not omit a behavior because its surface is missing. Classify it as `PREREQUISITE` and preserve the contract.
- Do not combine many variants into one row merely to reduce matrix size.
- Do not stop after the obvious context-menu and drag/drop examples; complete the source ledger and canonical documents.

**Against uncertainty stop**

- Continue other rows when one application surface is blocked.
- An uncertain verdict is not completion evidence. Mark `[needs confirmation]` and keep working through independent cases.
- Use the real apps for cases where CodeMirror, Chromium, Electron, or OS defaults make source-only inference unreliable.

**Against memory trust**

- Recheck the help commit, installed Obsidian version, current source lines, and live result before claiming parity.
- Do not copy counts or verdicts from Section 4 without rerunning their reproduction cases.
- Preserve exact before/action/after evidence for high-risk findings.
