# Obsidian Interaction-Behavior Deep Audit — Windows desktop, July 2026

Status: complete research audit for GOAL-14. This document records observed contracts; it does not prescribe product implementation details and no product code was changed.

## Methodology and Versions

### Baseline

| Item | Audited value |
|---|---|
| Audit date and platform | 2026-07-10, Windows 11 |
| Installed Obsidian | 1.12.7.0 (`C:\\Program Files\\Obsidian\\Obsidian.exe`) |
| Official help source | `obsidianmd/obsidian-help` commit `f9b17275eade57af64d545bb057a791548dc91e9` |
| Help commit date | 2026-06-16T10:32:13-07:00 |
| Help refresh | Existing scratchpad clone reused; `git fetch --prune origin` then `git merge --ff-only origin/master`; already current and clean |
| mdx-vault baseline | repository commit `ff979524`; Electron dependency 39.2.6, React 19, CodeMirror 6, Node 26.3.0, Bun 1.3.14 |
| Live fixtures | `%TEMP%\\obsidian-goal14-audit` and `%TEMP%\\mdx-vault-goal14-audit` only |
| Original unrelated worktree state | untracked `goals/GOAL-14-interaction-behavior-research.md`; preserved |

The official-help candidate set was produced from the pinned checkout with this exact PowerShell command:

```powershell
$pattern='right-click|context menu|drag|drop|paste|clipboard|double-click|middle-click|hover|hold (Ctrl|Alt|Shift)|modifier|click|focus|select|selection|scroll|mouse|pointer|keyboard|shortcut|hotkey|Escape|Enter|Tab'
$files = rg -il --glob '*.md' $pattern en | Sort-Object -Unique
```

It returned **152 unique Markdown files**. Every candidate is classified below: included 44, feature-dependent 47, mobile-only 3, commercial-service-only 36, duplicate/covered elsewhere 22, unaccounted 0. Canonical interaction documents and all 44 included candidates were read in full; grep snippets were used only to locate passages.

The live work used disposable fixtures and direct observation in both installed applications. The Obsidian right-click pass covered 14 distinct surface/state combinations. High-risk cases used before/action/after checks against the fixture files. Settings were changed only inside the disposable vault: original `.obsidian/app.json` was `{}`, and it was restored byte-for-byte to `{}` after testing. No hotkey was changed. macOS equivalents below come only from official help; there was no live macOS test.

### Evidence index

Pinned official-help references:

- `O-ES`: [Editing shortcuts](https://github.com/obsidianmd/obsidian-help/blob/f9b17275eade57af64d545bb057a791548dc91e9/en/Editing%20and%20formatting/Editing%20shortcuts.md#L17-L67)
- `O-DND`: [Drag and drop](https://github.com/obsidianmd/obsidian-help/blob/f9b17275eade57af64d545bb057a791548dc91e9/en/User%20interface/Drag%20and%20drop.md#L8-L31)
- `O-ATT`: [Attachments](https://github.com/obsidianmd/obsidian-help/blob/f9b17275eade57af64d545bb057a791548dc91e9/en/Editing%20and%20formatting/Attachments.md#L12-L30)
- `O-HK`: [Hotkeys](https://github.com/obsidianmd/obsidian-help/blob/f9b17275eade57af64d545bb057a791548dc91e9/en/User%20interface/Hotkeys.md#L9-L45)
- `O-TAB`: [Tabs](https://github.com/obsidianmd/obsidian-help/blob/f9b17275eade57af64d545bb057a791548dc91e9/en/User%20interface/Tabs.md#L24-L99)
- `O-LINK`: [Internal links](https://github.com/obsidianmd/obsidian-help/blob/f9b17275eade57af64d545bb057a791548dc91e9/en/Linking%20notes%20and%20files/Internal%20links.md#L15-L55)
- `O-FE`: [File explorer](https://github.com/obsidianmd/obsidian-help/blob/f9b17275eade57af64d545bb057a791548dc91e9/en/Plugins/File%20explorer.md#L13-L99)
- `O-MC`: [Multiple cursors](https://github.com/obsidianmd/obsidian-help/blob/f9b17275eade57af64d545bb057a791548dc91e9/en/Editing%20and%20formatting/Multiple%20cursors.md#L8-L13)
- `O-QS`: [Quick switcher](https://github.com/obsidianmd/obsidian-help/blob/f9b17275eade57af64d545bb057a791548dc91e9/en/Plugins/Quick%20switcher.md#L10-L30)
- `O-PV`: [Page preview](https://github.com/obsidianmd/obsidian-help/blob/f9b17275eade57af64d545bb057a791548dc91e9/en/Plugins/Page%20preview.md#L4-L8)
- `O-SET`: [Settings](https://github.com/obsidianmd/obsidian-help/blob/f9b17275eade57af64d545bb057a791548dc91e9/en/User%20interface/Settings.md#L149-L230)
- `O-RIB`: [Ribbon](https://github.com/obsidianmd/obsidian-help/blob/f9b17275eade57af64d545bb057a791548dc91e9/en/User%20interface/Ribbon.md#L34-L41)
- `O-SIDE`: [Sidebar](https://github.com/obsidianmd/obsidian-help/blob/f9b17275eade57af64d545bb057a791548dc91e9/en/User%20interface/Sidebar.md#L34-L81)

Current mdx-vault code references:

- `M-APP`: [`App.tsx:759`](../../src/renderer/src/App.tsx#L759) — executable global hotkeys; `Ctrl+Shift+V` cycles view at lines 781–785.
- `M-ED`: [`MdxEditor.tsx:438`](../../src/renderer/src/editor/MdxEditor.tsx#L438) — `basicSetup`, explicit editor keymap and paste/drop handlers; [`MdxEditor.tsx:624`](../../src/renderer/src/editor/MdxEditor.tsx#L624) — image MIME allowlist.
- `M-TREE`: [`FileTree.tsx:112`](../../src/renderer/src/explorer/FileTree.tsx#L112) — static always-expanded directories; [`FileTree.tsx:181`](../../src/renderer/src/explorer/FileTree.tsx#L181) — file-only menu and five actions.
- `M-RENAME`: [`vault-service.ts:176`](../../src/main/services/vault-service.ts#L176) and [`vault-ipc.ts:175`](../../src/main/ipc/vault-ipc.ts#L175) — filesystem rename and reindex only.
- `M-ASSET`: [`vault-service.ts:326`](../../src/main/services/vault-service.ts#L326) and [`vault-ipc.ts:252`](../../src/main/ipc/vault-ipc.ts#L252) — image-only persistence under fixed `assets/`.
- `M-PREV`: [`mdx-components.tsx:25`](../../src/renderer/src/preview/mdx-components.tsx#L25) — internal links are ordinary buttons with a single current-note click path; [`MdxPreview.tsx:124`](../../src/renderer/src/preview/MdxPreview.tsx#L124) — selection toolbar capture.
- `M-QS`: [`QuickSwitcher.tsx:40`](../../src/renderer/src/explorer/QuickSwitcher.tsx#L40) — focus, Escape, arrows, Enter; no modifier-open variants.
- `M-SEARCH`: [`SearchPane.tsx:25`](../../src/renderer/src/search/SearchPane.tsx#L25) — focus, Escape and Enter-first-result only.
- `M-SLASH`: [`SlashCommandPalette.tsx:55`](../../src/renderer/src/editor/SlashCommandPalette.tsx#L55) — focus, Escape, arrows and Enter.
- `M-PANELS`: [`BacklinksPanel.tsx:116`](../../src/renderer/src/panels/BacklinksPanel.tsx#L116), [`OutlinePanel.tsx:40`](../../src/renderer/src/panels/OutlinePanel.tsx#L40), [`TagsPanel.tsx:45`](../../src/renderer/src/panels/TagsPanel.tsx#L45) — single-click buttons without alternate actions or drag contracts.

`LIVE-O` and `LIVE-M` in the matrix refer to the reproduction logs in the two live-evidence sections. Screenshot references are narrow crops from disposable content only.

## Interaction Taxonomy

| Family | Scope |
|---|---|
| `CTX` | Context menus and alternate actions by exact surface/state |
| `PTR` | Click, double-click, middle-click, modifier-click and pointer activation |
| `DND` | Drag source, modifier, destination and resulting move/link/import contract |
| `CLP` | Clipboard formats, copy/cut/paste conversion and attachment placement |
| `KEY` | Non-customizable editor/OS shortcuts, followed separately by application/customizable hotkeys |
| `SEL` | Text, cursor and multi-item selection |
| `FOC` | Entry, restoration, Escape and modal/palette focus transitions |
| `HOV` | Hover preview, tooltip and progressive disclosure |
| `NAV` | List/tree/palette/dialog navigation |
| `OSE` | Explorer/browser/app ingress and egress |

Verdicts are `FULL` (same observable contract), `PARTIAL` (useful subset), `MISSING` (applicable current surface lacks it), `CONFLICT` (current result blocks or contradicts the contract), `PREREQUISITE` (the containing product surface does not exist), or `NOT_APPLICABLE` (explicitly outside product vision). Risks are `DATA_INTEGRITY`, `DESTRUCTIVE`, `CORRECTNESS`, `ACCESSIBILITY`, `WORKFLOW`, or `POLISH`.

The audit separates two keyboard layers: `O-ES` non-customizable OS/framework editing shortcuts and `O-HK` application commands configurable through Settings. A displayed label is not treated as executable evidence.

## Source Coverage Ledger

The ledger uses paths relative to `obsidian-help/en/`. Counts sum to 152 and the difference from the grep candidate set is zero.

<details>
<summary><strong>Included — 44 files</strong></summary>

`Bases/Introduction to Bases.md`; `Bases/Views.md`; `Bases/Layouts/Table view.md`; `Editing and formatting/Advanced formatting syntax.md`; `Editing and formatting/Attachments.md`; `Editing and formatting/Basic formatting syntax.md`; `Editing and formatting/Editing shortcuts.md`; `Editing and formatting/Folding.md`; `Editing and formatting/Multiple cursors.md`; `Editing and formatting/Properties.md`; `Editing and formatting/Tags.md`; `Editing and formatting/Views and editing mode.md`; `Extending Obsidian/Obsidian URI.md`; `Files and folders/Accepted file formats.md`; `Files and folders/Manage notes.md`; `Files and folders/Manage vaults.md`; `Linking notes and files/Aliases.md`; `Linking notes and files/Embed files.md`; `Linking notes and files/Internal links.md`; `Plugins/Backlinks.md`; `Plugins/Bookmarks.md`; `Plugins/Canvas.md`; `Plugins/Command palette.md`; `Plugins/File explorer.md`; `Plugins/Graph view.md`; `Plugins/Note composer.md`; `Plugins/Outline.md`; `Plugins/Page preview.md`; `Plugins/Properties view.md`; `Plugins/Quick switcher.md`; `Plugins/Search.md`; `Plugins/Slash commands.md`; `Plugins/Tags view.md`; `Plugins/Workspaces.md`; `User interface/Appearance.md`; `User interface/Drag and drop.md`; `User interface/Hotkeys.md`; `User interface/Pop-out windows.md`; `User interface/Ribbon.md`; `User interface/Settings.md`; `User interface/Sidebar.md`; `User interface/Status bar.md`; `User interface/Tabs.md`; `User interface/Workspace.md`.

</details>

<details>
<summary><strong>Feature-dependent — 47 files</strong></summary>

These matches describe behavior inside a feature not currently present, or a specialized importer/clipper. Their cross-cutting contracts are preserved as `PREREQUISITE`; this goal does not deep-audit the feature.

`Bases/Bases syntax.md`; `Bases/Create a base.md`; `Bases/Formulas.md`; `Bases/Functions.md`; `Bases/Layouts/Cards view.md`; `Bases/Layouts/List view.md`; `Bases/Layouts/Map view.md`; `Extending Obsidian/Community plugins.md`; `Extending Obsidian/CSS snippets.md`; `Extending Obsidian/Plugin security.md`; `Extending Obsidian/Themes.md`; `Import notes/Import CSV files.md`; `Import notes/Import from Apple Journal.md`; `Import notes/Import from Apple Notes.md`; `Import notes/Import from Bear.md`; `Import notes/Import from Craft.md`; `Import notes/Import from Evernote.md`; `Import notes/Import from Google Keep.md`; `Import notes/Import from Microsoft OneNote.md`; `Import notes/Import from Notion.md`; `Import notes/Import from Roam Research.md`; `Import notes/Import HTML files.md`; `Import notes/Import Markdown files.md`; `Import notes/Import Textbundle files.md`; `Import notes/Import Zettelkasten notes.md`; `Obsidian Web Clipper/Clip web pages.md`; `Obsidian Web Clipper/Filters.md`; `Obsidian Web Clipper/Highlighter.md`; `Obsidian Web Clipper/Interpreter.md`; `Obsidian Web Clipper/Introduction to Obsidian Web Clipper.md`; `Obsidian Web Clipper/Logic.md`; `Obsidian Web Clipper/Reader.md`; `Obsidian Web Clipper/Templates.md`; `Obsidian Web Clipper/Troubleshoot Web Clipper.md`; `Obsidian Web Clipper/Variables.md`; `Plugins/Audio recorder.md`; `Plugins/Core plugins.md`; `Plugins/Daily notes.md`; `Plugins/File recovery.md`; `Plugins/Footnotes view.md`; `Plugins/Format converter.md`; `Plugins/Outgoing links.md`; `Plugins/Random note.md`; `Plugins/Slides.md`; `Plugins/Templates.md`; `Plugins/Unique note creator.md`; `Plugins/Web viewer.md`.

</details>

<details>
<summary><strong>Mobile-only — 3 files</strong></summary>

`Getting started/Mobile app.md`; `Obsidian/Obsidian for Android.md`; `Obsidian/Obsidian for iOS and iPadOS.md`. Touch gestures and mobile navigation are outside the Windows desktop platform scope.

</details>

<details>
<summary><strong>Commercial-service-only — 36 files</strong></summary>

`Licenses and payment/Catalyst license.md`; `Licenses and payment/Education and non-profit discount.md`; `Licenses and payment/Introduction to licenses and payment.md`; `Licenses and payment/Obsidian Credit.md`; `Licenses and payment/Refund policy.md`; `Licenses and payment/Sales tax.md`; `Obsidian Publish/Analytics.md`; `Obsidian Publish/Collaborate on a Publish site.md`; `Obsidian Publish/Custom domains.md`; `Obsidian Publish/Customize your site.md`; `Obsidian Publish/Headless Publish.md`; `Obsidian Publish/Introduction to Obsidian Publish.md`; `Obsidian Publish/Manage sites.md`; `Obsidian Publish/Publish limitations.md`; `Obsidian Publish/Publish your content.md`; `Obsidian Publish/Security and privacy.md`; `Obsidian Publish/SEO.md`; `Obsidian Publish/Set up Obsidian Publish.md`; `Obsidian Publish/Troubleshoot Obsidian Publish.md`; `Obsidian Sync/Collaborate on a shared vault.md`; `Obsidian Sync/Frequently asked questions.md`; `Obsidian Sync/Headless Sync.md`; `Obsidian Sync/Introduction to Obsidian Sync.md`; `Obsidian Sync/Local and remote vaults.md`; `Obsidian Sync/Plans and storage limits.md`; `Obsidian Sync/Security and privacy.md`; `Obsidian Sync/Set up Obsidian Sync.md`; `Obsidian Sync/Status icon and messages.md`; `Obsidian Sync/Switch to Obsidian Sync.md`; `Obsidian Sync/Sync settings and selective syncing.md`; `Obsidian Sync/Troubleshoot Obsidian Sync.md`; `Obsidian Sync/Upgrade Sync encryption.md`; `Obsidian Sync/Version history.md`; `Teams/Commercial license.md`; `Teams/Security considerations for teams.md`; `Teams/Syncing for teams.md`.

</details>

<details>
<summary><strong>Duplicate or covered elsewhere — 22 files</strong></summary>

`Contributing to Obsidian/Style guide.md`; `Editing and formatting/Callouts.md`; `Editing and formatting/HTML content.md`; `Editing and formatting/Obsidian Flavored Markdown.md`; `Extending Obsidian/Obsidian CLI.md`; `Files and folders/How Obsidian stores data.md`; `Files and folders/Symbolic links and junctions.md`; `Getting started/Back up your Obsidian files.md`; `Getting started/Create a vault.md`; `Getting started/Create your first note.md`; `Getting started/Download and install Obsidian.md`; `Getting started/Glossary.md`; `Getting started/Link notes.md`; `Getting started/Sandbox vault.md`; `Getting started/Sync your notes across devices.md`; `Getting started/Update Obsidian.md`; `Help and support.md`; `Obsidian/2-factor authentication.md`; `Obsidian/About Obsidian.md`; `Obsidian/Community code of conduct.md`; `Obsidian/Credits.md`; `Obsidian/Early access versions.md`. Matches were prose/editorial duplicates, setup material, or contracts already represented by a canonical source row.

</details>

### Canonical document disposition

| Canonical source | Exhaustive disposition |
|---|---|
| Editing shortcuts | Clipboard rows map to `CLP-001`–`CLP-004`; remaining Windows/Linux rows map to `KEY-001`–`KEY-028` plus page-navigation rows `KEY-042`–`KEY-045`. Left/right variants are intentionally split into independent triggers. macOS equivalents are recorded in preconditions, not claimed live. |
| Drag and drop | Every listed source, destination and modifier maps to `DND-001`–`DND-012`; Outline and Bookmarks ordering use `DND-013`–`DND-014`. |
| Attachments | Paste/drag insertion and all four destination policies map to `CLP-006`–`CLP-011`. |
| Hotkeys | Customization, multiple bindings, removal/filtering and layout warning map to `KEY-038`–`KEY-041`, separate from editing shortcuts. |
| Tabs | New tab, link-open modifiers, tab movement/split/resize/navigation map to `PTR-003`–`PTR-005`, `DND-001`, `CTX-008`, `NAV-005` and prerequisite rows. |
| Internal links | Rename rewrite, auto-generation, link formats, hover and modifier activation map to `PTR-002`–`PTR-005`, `HOV-001`, `CLP-008`–`CLP-011`, and the data-integrity finding. |

## Master Behavior Matrix

Each row is one independently testable trigger/result contract. Bundle codes are expanded under Prioritized Bundles.

### Context menus and pointer activation

| ID | Family | Surface and state | Trigger | Input / destination | Obsidian result | Platform / setting preconditions | Obsidian evidence | mdx-vault result | mdx-vault evidence | Verdict | Risk | Bundle |
|---|---|---|---|---|---|---|---|---|---|---|---|---|
| CTX-001 | CTX | Editor prose, no selection | Right-click | Caret location | Add link/external link, Format, Paragraph, Insert; Cut/Copy disabled; Paste, Paste as plain text, Select all | Windows, Editing view | `LIVE-O-01`; [editor crop](evidence/obsidian-interactions-2026-07/obsidian-editor-context-menu.png) | Browser/CodeMirror native menu; no note-aware actions | `M-ED` has no context-menu handler; `LIVE-M` | MISSING | WORKFLOW | B2 |
| CTX-002 | CTX | Editor prose, text selected | Right-click | Selection | Same editor menu with Cut/Copy enabled and formatting actions applying to selection | Windows, non-empty selection | `LIVE-O-02` | Browser/CodeMirror selection menu only; formatting palette is separate | `M-ED`; no context-menu implementation | PARTIAL | WORKFLOW | B2 |
| CTX-003 | CTX | Editor heading | Right-click | Heading block | Base editor actions plus Rename this heading, Bookmark this heading, Extract this heading | Note composer and Bookmarks enabled | `LIVE-O-06` | No heading-specific alternate action | `M-ED`; no heading context handler | MISSING | WORKFLOW | B2 |
| CTX-004 | CTX | Editor internal link | Right-click | Resolved link | Open new tab/right/window plus link, note, path, reveal and file actions | Resolved link in editing view | `LIVE-O-07`; `O-TAB` L29–40 | No internal-link context menu | `M-ED`, `M-PREV` | MISSING | WORKFLOW | B1 |
| CTX-005 | CTX | File explorer, file row | Right-click | Selected or unselected file | Open variants, duplicate, move, bookmark, merge, copy path, history, OS actions, rename, delete | File explorer core plugin | `LIVE-O-03`; [file crop](evidence/obsidian-interactions-2026-07/obsidian-file-context-menu.png) | Duplicate, Rename, Bookmark file, Copy path, Reveal in explorer, Delete | `M-TREE`; GOAL-23 Electron verification | PARTIAL | WORKFLOW | B3 |
| CTX-006 | CTX | File explorer, folder row | Right-click | Folder | New note/folder/canvas/base, duplicate, move, scoped search, bookmark, path/reveal, rename, delete | File explorer; feature entries depend on enabled plugins | `LIVE-O-04`; [folder crop](evidence/obsidian-interactions-2026-07/obsidian-folder-context-menu.png) | Bookmark folder, Copy path, Reveal in explorer; creation/move/rename/delete remain absent | `M-TREE`; GOAL-23 Electron verification | PARTIAL | WORKFLOW | B3 |
| CTX-007 | CTX | File explorer, tree background | Right-click | Empty tree area | New note, folder, canvas and base | File explorer; enabled feature commands vary | `LIVE-O-05` | No tree-background menu | `M-TREE` | MISSING | WORKFLOW | B3 |
| CTX-008 | CTX | Tab header | Right-click | Open note tab | Close, pin/link, view mode, window/split, note actions, find/replace, path/history/reveal/delete | Tab/workspace surface | `LIVE-O-08`; `O-TAB` L44–62 | No tabs surface | Current shell exposes one selected note only | PREREQUISITE | WORKFLOW | B4 |
| CTX-009 | CTX | Search result header | Right-click | Result note | Open variants, rename, move, bookmark, OS/reveal, delete, copy path | Search core plugin | `LIVE-O-09` | Search result is click-only; no menu | `M-SEARCH` | MISSING | WORKFLOW | B3 |
| CTX-010 | CTX | Backlink source result | Right-click | Source note | Same file-oriented alternate actions as a search result | Backlinks core plugin | `LIVE-O-10` | Backlink result is click-only | `M-PANELS` L116–130 | MISSING | WORKFLOW | B3 |
| CTX-011 | CTX | Outline heading | Right-click | Heading result | Selects/highlights the row; no context menu | Outline core plugin | `LIVE-O-11` | Click-only; right-click browser default/no note action | `M-PANELS` Outline L40–56 | FULL | POLISH | Defer: matches observed no-menu contract |
| CTX-012 | CTX | Tags pane, tag row | Right-click | Tag | Selects/highlights; no context menu | Tags core plugin | `LIVE-O-12` | Click-only; no context menu | `M-PANELS` Tags L45–58 | FULL | POLISH | Defer: matches observed no-menu contract |
| CTX-013 | CTX | Property value | Right-click | Property token | Edit, Copy, Remove from list | Properties enabled and value present | `LIVE-O-13` | GOAL-23 provides typed active-file controls, add/delete, source reveal for unsupported YAML, and internal-link navigation; it does not copy/remove through a context menu | `KnowledgePanels.tsx`; source-preservation tests | PARTIAL | WORKFLOW | B4 |
| CTX-014 | CTX | Ribbon background | Right-click | Ribbon | Checklist of ribbon commands plus Hide ribbon | Ribbon visible | `LIVE-O-14`; `O-RIB` L34–41 | No ribbon surface | Current shell toolbar is fixed | PREREQUISITE | WORKFLOW | B4 |
| CTX-015 | CTX | File explorer rename input | Right-click | Selected filename text | Native text edit menu while rename editor retains cancel/confirm contract | Rename active | `LIVE-O`; `O-FE` L76–83 | Native input menu; Enter commits and Escape cancels | `M-TREE` L277–328; `LIVE-M` | FULL | ACCESSIBILITY | B3 |
| CTX-016 | CTX | File explorer file rename | Commit new filename | Incoming internal links | Prompts or automatically rewrites link targets according to Automatically update internal links; preserves display aliases | Setting off means prompt, on means automatic | `O-LINK` L15; `O-SET` L204–216; `LIVE-O` five-link rewrite | Renames/reindexes file but leaves all incoming targets stale | `M-RENAME`; `LIVE-M` | CONFLICT | DATA_INTEGRITY | B1 |
| PTR-001 | PTR | File explorer file row | Primary click | File | Opens/selects file in current tab | File explorer | `O-FE` L13; `LIVE-O` | Opens/selects file in current shell | `M-TREE` L195–210; `LIVE-M` | FULL | WORKFLOW | B3 |
| PTR-002 | PTR | Rendered internal link | Primary click | Resolved note | Opens link in current tab | Link resolves | `O-TAB` L29; `O-LINK` L49–55 | Opens resolved note in current shell | `M-PREV` L40–57; `LIVE-M` | FULL | WORKFLOW | B1 |
| PTR-003 | PTR | Internal link | Ctrl+click | Resolved note | Opens in a new tab | Windows/Linux; macOS uses Command | `O-TAB` L37–40 | Opens current note instead; modifier ignored | `M-PREV` onClick reads no modifier | MISSING | WORKFLOW | B4 |
| PTR-004 | PTR | Internal link | Ctrl+Alt+click | Resolved note | Opens in a new tab group | Windows/Linux; macOS Command+Option | `O-TAB` L37–40; live quick-switcher labels this destination “to the right” | Modifier ignored | `M-PREV` | MISSING | WORKFLOW | B4 |
| PTR-005 | PTR | Internal link | Ctrl+Alt+Shift+click | Resolved note | Opens in a new window | Windows/Linux; macOS Command+Option+Shift | `O-TAB` L37–40 | Modifier ignored | `M-PREV` | MISSING | WORKFLOW | B4 |
| PTR-006 | PTR | Outline heading | Primary click | Heading | Navigates to heading | Outline enabled | Included `Plugins/Outline.md`; `LIVE-O-11` | Navigates/reveals heading | `M-PANELS` Outline L40–56; `LIVE-M` | FULL | WORKFLOW | B2 |
| PTR-007 | PTR | Tags pane tag | Primary click | Tag | Starts/searches tag query | Tags enabled | Included `Plugins/Tags view.md` L8 | Filters tagged notes | `M-PANELS` Tags L45–86 | PARTIAL | WORKFLOW | B3 |
| PTR-008 | PTR | Tags pane tag | Ctrl+click | Tag | Toggles tag in current search without replacing query | Windows/Linux; macOS Command | Included `Plugins/Tags view.md` L10 | Same as plain click; modifier ignored | `M-PANELS` | MISSING | WORKFLOW | B3 |
| PTR-009 | PTR | Internal link in Source mode | Ctrl+Shift+click | Resolved note | Opens in a new tab; Shift is required in Source mode | Windows/Linux; macOS Command+Shift | `O-TAB` link-modifier table | Modifier ignored; source-mode wikilink is editor text | `M-ED`, `M-PREV` | MISSING | WORKFLOW | B4 |

### Drag and drop

| ID | Family | Surface and state | Trigger | Input / destination | Obsidian result | Platform / setting preconditions | Obsidian evidence | mdx-vault result | mdx-vault evidence | Verdict | Risk | Bundle |
|---|---|---|---|---|---|---|---|---|---|---|---|---|
| DND-001 | DND | Tab header | Drag tab | New position in same tab group | Reorders the tab | Tabs present | `O-DND` L8; `O-TAB` L44–52 | No tabs/draggable header | Shell has no tab collection | PREREQUISITE | WORKFLOW | B4 |
| DND-002 | DND | File explorer file | Drag | Tab header | Opens file in that tab | Tabs present | `O-DND` L12, L19 | No tab header or file drag | `M-TREE`; no draggable handler | PREREQUISITE | WORKFLOW | B4 |
| DND-003 | DND | Search result | Drag | Tab header/editor/folder as applicable | Treats result as its backing note for supported destinations | Search result | `O-DND` L13 | Result is not draggable | `M-SEARCH`; no drag handler | MISSING | WORKFLOW | B3 |
| DND-004 | DND | Backlink result | Drag | Tab header/editor/folder as applicable | Treats source note as drag payload | Backlinks enabled | `O-DND` L14 | Result is not draggable | `M-PANELS` | MISSING | WORKFLOW | B3 |
| DND-005 | DND | Preview internal link | Drag | Supported note destination | Drags the linked note | Resolved link | `O-DND` L15 | Native button drag only; no note payload | `M-PREV` | MISSING | WORKFLOW | B3 |
| DND-006 | DND | Note/file payload | Drop | File explorer folder | Moves the note/file into folder | Destination accepts file; overwrite safeguards apply | `O-DND` L20; `O-FE` L95–99 | Folder is not a drop target | `M-TREE` L112–139 | MISSING | DATA_INTEGRITY | B3 |
| DND-007 | DND | Note/link payload | Drop | Editor caret | Inserts internal link using current link-format policy | Editing view; link setting applies | `O-DND` L21; live setting pass | No note/file drag payload; manual completion inserts title-only wikilink | `M-ED` L420–432 | MISSING | CORRECTNESS | B1 |
| DND-008 | DND | Note/link payload | Drop | Bookmarks pane | Creates bookmark | Bookmarks enabled | `O-DND` L22 | Bookmarks exists with explicit active-note, Explorer, Search, and Outline add actions, but external note/link drop-to-create is not implemented | `KnowledgePanels.tsx`; GOAL-23 Electron verification | MISSING | WORKFLOW | B4 |
| DND-009 | DND | Browser selection/content | Drag | Editor | Converts supported HTML to Markdown when conversion enabled | Editor setting Convert pasted HTML on | `O-DND` L26; `O-SET` L149 | No HTML-conversion pipeline; browser text fallback only | `M-ED` handles image files and otherwise returns false | MISSING | CORRECTNESS | B2 |
| DND-010 | DND | Windows Explorer native file | Drag | Editor | Copies/imports file into configured attachment location and inserts attachment link | Accepted type; attachment setting applies | `O-DND` L27; `O-ATT` L15–30 | Only allowlisted image types are copied to fixed `assets/` | `M-ED` L481–493, L624–671; `M-ASSET` | PARTIAL | DATA_INTEGRITY | B2 |
| DND-011 | DND | Windows Explorer native file | Ctrl+drag | Editor | Inserts a `file:///` link rather than importing | Windows/Linux Ctrl modifier | `O-DND` L27 | Image is still imported; other files fall through | `M-ED` does not inspect modifiers | CONFLICT | CORRECTNESS | B2 |
| DND-012 | DND | Obsidian note | Drag out of app | External destination | Exposes an `obsidian://` URI | Desktop app and accepting destination | `O-DND` L31 | No app-to-external note drag | No drag source in tree/preview | MISSING | WORKFLOW | B3 |
| DND-013 | DND | Outline heading | Drag heading | New outline position | Rearranges note sections | Outline enabled; writable note | Included `Plugins/Outline.md` L8 | Outline rows are not draggable | `M-PANELS` Outline | MISSING | DATA_INTEGRITY | B2 |
| DND-014 | DND | Bookmarks list/group | Drag item | New position/group | Reorders or moves bookmark into group | Bookmarks enabled | Included `Plugins/Bookmarks.md` L20, L109 | Reorders at one level and moves into/out of groups; keyboard up/down controls provide a non-pointer path | `KnowledgePanels.tsx`; `bookmarks.test.ts`; GOAL-23 Electron verification | FULL | WORKFLOW | B4 |
| DND-015 | DND | File explorer file | Alt+drag and drop | Anywhere in tab | Opens file at the free drop position rather than requiring tab header | Windows/Linux; Shift+drag on macOS; tabs present | `O-DND` L19 | No tabs or modifier-aware file drag | `M-TREE`; no drag handler | PREREQUISITE | WORKFLOW | B4 |
| DND-016 | DND | File explorer multi-selection | Drag | Supported destination | Drags multiple selected files as one payload | Multi-selection active | `O-DND` L12 | No multi-selection or drag payload | `M-TREE` single `selectedPath` | MISSING | WORKFLOW | B3 |
| DND-017 | DND | Unlinked reference result | Drag | Supported note destination | Drags the referenced source file | Backlinks/unlinked mentions enabled | `O-DND` L14 | Unlinked result is click-only | `M-PANELS` Backlinks | MISSING | WORKFLOW | B3 |
| DND-018 | DND | Tab header | Drag tab | Existing different tab group | Moves tab to that group | Multiple tab groups | `O-TAB` organize section | No tabs/groups | Missing surface | PREREQUISITE | WORKFLOW | B4 |
| DND-019 | DND | Tab header | Drag tab | Highlighted drop zone at group edge/bottom | Creates a new tab group/split at indicated zone | Workspace tabs | `O-TAB` arrange/split sections | No tab drop zones | Missing surface | PREREQUISITE | WORKFLOW | B4 |
| DND-020 | DND | Tab header | Drag tab | Outside application window | Opens tab in a new pop-out window | Desktop tabs | `O-TAB` Move tab to a new window | No tabs/pop-out window routing | Missing surface | PREREQUISITE | WORKFLOW | B4 |
| DND-021 | DND | Tab header | Drag tab | Another existing Obsidian window | Moves tab into that window | Two Obsidian windows | `O-TAB` Move tab to a different window | No tabs/multiwindow routing | Missing surface | PREREQUISITE | WORKFLOW | B4 |

### Clipboard and attachment placement

| ID | Family | Surface and state | Trigger | Input / destination | Obsidian result | Platform / setting preconditions | Obsidian evidence | mdx-vault result | mdx-vault evidence | Verdict | Risk | Bundle |
|---|---|---|---|---|---|---|---|---|---|---|---|---|
| CLP-001 | CLP | Editor selection | Ctrl+C | Plain/Markdown selection | Copies selection; with no selection Obsidian also supports current-paragraph copy via Ctrl+C | Windows/Linux; Command+C macOS | `O-ES` L17, L23 | Standard selection copy; current-paragraph behavior comes from CodeMirror basic setup | `M-ED` L438–464 | FULL | WORKFLOW | B2 |
| CLP-002 | CLP | Editor selection | Ctrl+X | Plain/Markdown selection | Cuts selection; with no selection cuts current paragraph | Windows/Linux; Command+X macOS | `O-ES` L18, L24 | Standard selection cut; CodeMirror line behavior available | `M-ED` basicSetup | FULL | DESTRUCTIVE | B2 |
| CLP-003 | CLP | Editor caret/selection | Ctrl+V | Plain text | Replaces selection or inserts plain text at caret | Windows/Linux; Command+V macOS | `O-ES` L19; `LIVE-O` | Inserts clipboard text unless intercepted as image | `M-ED` L465–480; live plain paste | FULL | CORRECTNESS | B2 |
| CLP-004 | CLP | Editor caret | Ctrl+Shift+V | Rich HTML with plain fallback | Pastes plain representation without HTML-to-Markdown conversion | Windows/Linux; Command+Shift+V macOS | `O-ES` L20; `O-SET` L149; `LIVE-O` produced `Rich bold and italic one two` | Globally changes source/split/preview view and does not paste | `M-APP` L781–785; `LIVE-M` split→preview | CONFLICT | CORRECTNESS | B2 |
| CLP-005 | CLP | Editor caret | Ctrl+V | Rich HTML | Converts semantics to Markdown: bold/italic and list markers preserved | Convert pasted HTML on; live Windows clipboard carried HTML and Unicode text | `O-SET` L149; `LIVE-O` produced bold, italic and two list items | Falls through to Chromium/CodeMirror plain representation; no conversion policy | `M-ED` L465–480 | MISSING | CORRECTNESS | B2 |
| CLP-006 | CLP | Editor caret | Ctrl+V | PNG file from Explorer clipboard | Copies image to configured attachment location and inserts embed | Accepted type; attachment setting; Wikilinks setting | `O-ATT` L12–13, L23–30; `LIVE-O` inserted root `pixel.png` | Copies to fixed `assets/pixel.png` and inserts Markdown image syntax | `M-ED`, `M-ASSET`; `LIVE-M` | PARTIAL | DATA_INTEGRITY | B2 |
| CLP-007 | CLP | Editor caret | Ctrl+V | PDF file from Explorer clipboard | Copies PDF and inserts `![[sample.pdf]]` under defaults | Accepted type; attachment setting; Wikilinks on | `O-ATT` L12–13; `LIVE-O` | No insertion and no copied PDF | `M-ED` MIME allowlist; `LIVE-M` before/after length unchanged and only fixture PDF remained | MISSING | DATA_INTEGRITY | B2 |
| CLP-008 | CLP | Editor attachment insertion | Paste/drop | Destination policy: vault folder | Saves at vault root and generates link matching link/Wikilink settings | Attachment location Vault folder | `O-ATT` L23–25; `LIVE-O` | Always saves under `assets/` | `M-ASSET` L326–340 | CONFLICT | DATA_INTEGRITY | B1 |
| CLP-009 | CLP | Editor attachment insertion | Paste/drop | Destination policy: same folder as note | Saves beside current note; live nested note produced `Nested/pixel.png` | Same folder as current file | `O-ATT` L26; `LIVE-O` | No configurable same-folder route | `M-ASSET` | MISSING | DATA_INTEGRITY | B1 |
| CLP-010 | CLP | Editor attachment insertion | Paste/drop | Destination policy: subfolder | Saves under configured subfolder beneath current note folder | In subfolder under current folder; subfolder configured | `O-ATT` L27–28 | No configurable subfolder route | `M-ASSET` | MISSING | DATA_INTEGRITY | B1 |
| CLP-011 | CLP | Editor attachment insertion | Paste/drop | Destination policy: specified folder | Saves in configured vault-relative folder | In folder specified below; path configured | `O-ATT` L29–30 | Only hard-coded `assets/`, not a user policy | `M-ASSET` | PARTIAL | DATA_INTEGRITY | B1 |
| CLP-012 | CLP | Editor link generation | Choose completion | Internal note | Generates URL-encoded Markdown link when Use Wikilinks is off, even when completion began with opening brackets | Files & Links: Use Wikilinks off | `O-LINK` L23–38 | No link-style setting; completion always emits wikilink target text | `M-ED` L420–432 | MISSING | CORRECTNESS | B1 |

### Editing shortcuts and application hotkeys

Rows `KEY-001`–`KEY-028` and `KEY-042`–`KEY-045` are the non-customizable Windows/Linux editor layer from `O-ES`. Clipboard rows in that table are represented separately by `CLP-001`–`CLP-004`. Rows `KEY-029`–`KEY-041` are application/customization contracts.

| ID | Family | Surface and state | Trigger | Input / destination | Obsidian result | Platform / setting preconditions | Obsidian evidence | mdx-vault result | mdx-vault evidence | Verdict | Risk | Bundle |
|---|---|---|---|---|---|---|---|---|---|---|---|---|
| KEY-001 | KEY | Editor | Ctrl+Z | Edit history | Undo previous change | Windows/Linux; Command+Z macOS | `O-ES` L21 | Undoes previous CodeMirror transaction | `M-ED` basicSetup/history keymap | FULL | CORRECTNESS | B2 |
| KEY-002 | KEY | Editor | Ctrl+Shift+Z or Ctrl+Y | Edit history | Redo undone change | Windows/Linux; Command+Shift+Z macOS | `O-ES` L22 | Redoes CodeMirror history | `M-ED` basicSetup/history keymap | FULL | CORRECTNESS | B2 |
| KEY-003 | KEY | Editor caret | Enter | Current line | Inserts a new line | Desktop editors | `O-ES` L30 | Inserts new line | `M-ED` basicSetup | FULL | WORKFLOW | B2 |
| KEY-004 | KEY | Editor caret | Backspace | Character before caret | Deletes previous character | Desktop editors | `O-ES` L31 | Deletes previous character | `M-ED` basicSetup | FULL | CORRECTNESS | B2 |
| KEY-005 | KEY | Editor caret | Delete | Character after caret | Deletes next character | Desktop editors | `O-ES` L32 | Deletes next character | `M-ED` basicSetup | FULL | CORRECTNESS | B2 |
| KEY-006 | KEY | Editor caret | Ctrl+Backspace | Word before caret | Deletes previous word | Windows/Linux; Option+Backspace macOS | `O-ES` L33 | Deletes previous word | `M-ED` standard keymap | FULL | CORRECTNESS | B2 |
| KEY-007 | KEY | Editor caret | Ctrl+Delete | Word after caret | Deletes next word | Windows/Linux; Option+Delete macOS | `O-ES` L34 | Deletes next word | `M-ED` standard keymap | FULL | CORRECTNESS | B2 |
| KEY-008 | KEY | Editor caret | Ctrl+Shift+K | Current line | Deletes current line | Windows/Linux; Command+Shift+K macOS | `O-ES` L35 | Deletes current CodeMirror line | `M-ED` default keymap | FULL | DESTRUCTIVE | B2 |
| KEY-009 | KEY | Editor caret | Left Arrow | Character position | Moves one character left | Desktop editors | `O-ES` L41 | Same | `M-ED` basicSetup | FULL | ACCESSIBILITY | B2 |
| KEY-010 | KEY | Editor caret | Right Arrow | Character position | Moves one character right | Desktop editors | `O-ES` L42 | Same | `M-ED` basicSetup | FULL | ACCESSIBILITY | B2 |
| KEY-011 | KEY | Editor caret | Ctrl+Left | Word boundary | Moves to beginning of previous word | Windows/Linux; Option+Left macOS | `O-ES` L43 | Same platform-native CodeMirror motion | `M-ED` basicSetup | FULL | ACCESSIBILITY | B2 |
| KEY-012 | KEY | Editor caret | Ctrl+Right | Word boundary | Moves to end of next word | Windows/Linux; Option+Right macOS | `O-ES` L44 | Same platform-native CodeMirror motion | `M-ED` basicSetup | FULL | ACCESSIBILITY | B2 |
| KEY-013 | KEY | Editor caret | Home | Current line | Moves to beginning of line | Windows/Linux; Command+Left macOS equivalent documented | `O-ES` L45 | Same | `M-ED` basicSetup | FULL | ACCESSIBILITY | B2 |
| KEY-014 | KEY | Editor caret | End | Current line | Moves to end of line | Windows/Linux; Command+Right macOS equivalent documented | `O-ES` L46 | Same | `M-ED` basicSetup | FULL | ACCESSIBILITY | B2 |
| KEY-015 | KEY | Editor caret | Up Arrow | Visual/document line | Moves to previous line | Desktop editors | `O-ES` L47 | Same | `M-ED` basicSetup, line wrapping | FULL | ACCESSIBILITY | B2 |
| KEY-016 | KEY | Editor caret | Down Arrow | Visual/document line | Moves to next line | Desktop editors | `O-ES` L48 | Same | `M-ED` basicSetup, line wrapping | FULL | ACCESSIBILITY | B2 |
| KEY-017 | KEY | Editor caret | Ctrl+Home | Note | Moves to beginning of note | Windows/Linux; Command+Up macOS | `O-ES` L49 | Same | `M-ED` standard keymap | FULL | ACCESSIBILITY | B2 |
| KEY-018 | KEY | Editor caret | Ctrl+End | Note | Moves to end of note | Windows/Linux; Command+Down macOS | `O-ES` L50–51 | Same; used live in attachment tests | `M-ED`; `LIVE-M` | FULL | ACCESSIBILITY | B2 |
| KEY-019 | KEY | Editor caret | Shift+Left | Character | Extends selection one character left | Desktop editors | `O-ES` L59 | Same | `M-ED` basicSetup | FULL | ACCESSIBILITY | B2 |
| KEY-020 | KEY | Editor caret | Shift+Right | Character | Extends selection one character right | Desktop editors | `O-ES` L59 | Same | `M-ED` basicSetup | FULL | ACCESSIBILITY | B2 |
| KEY-021 | KEY | Editor caret | Ctrl+Shift+Left | Word boundary | Selects to beginning of previous word | Windows/Linux; Option+Shift+Left macOS | `O-ES` L60 | Same | `M-ED` standard keymap | FULL | ACCESSIBILITY | B2 |
| KEY-022 | KEY | Editor caret | Ctrl+Shift+Right | Word boundary | Selects to end of next word | Windows/Linux; Option+Shift+Right macOS | `O-ES` L61 | Same | `M-ED` standard keymap | FULL | ACCESSIBILITY | B2 |
| KEY-023 | KEY | Editor caret | Shift+Home | Current line | Selects to beginning of line | Windows/Linux; Command+Shift+Left macOS | `O-ES` L62 | Same | `M-ED` basicSetup | FULL | ACCESSIBILITY | B2 |
| KEY-024 | KEY | Editor caret | Shift+End | Current line | Selects to end of line | Windows/Linux; Command+Shift+Right macOS | `O-ES` L63 | Same | `M-ED` basicSetup | FULL | ACCESSIBILITY | B2 |
| KEY-025 | KEY | Editor with selection | Escape | Current selection | Simplifies/collapses the active selection | Desktop editors | `O-ES` L57 | Collapses/simplifies CodeMirror selection | `M-ED` basicSetup | FULL | ACCESSIBILITY | B2 |
| KEY-026 | KEY | Editor | Ctrl+A | Note contents | Selects all note text | Windows/Linux; Command+A macOS | `O-ES` L58 | Selects all editor text | `M-ED` basicSetup | FULL | ACCESSIBILITY | B2 |
| KEY-027 | KEY | Editor caret | Ctrl+Shift+Home | Note | Selects to beginning of note | Windows/Linux; Command+Shift+Up macOS | `O-ES` L64 | Same | `M-ED` standard keymap | FULL | ACCESSIBILITY | B2 |
| KEY-028 | KEY | Editor caret | Ctrl+Shift+End | Note | Selects to end of note | Windows/Linux; Command+Shift+Down macOS | `O-ES` L65 | Same | `M-ED` standard keymap | FULL | ACCESSIBILITY | B2 |
| KEY-029 | KEY | Application shell | Ctrl+P | Command palette | Opens command palette | Obsidian Windows default | Included `Plugins/Command palette.md`; live | Opens Quick Switcher instead | `M-APP` L775–778 | CONFLICT | WORKFLOW | B4 |
| KEY-030 | KEY | Application shell | Ctrl+O | Quick switcher | Opens Quick Switcher | Obsidian Windows default | `O-QS` L10 | No global handler | `M-APP`; Quick Switcher exists but is bound to Ctrl+P | MISSING | WORKFLOW | B4 |
| KEY-031 | KEY | Application shell | Ctrl+N | New note | Opens/creates new note flow | Default command available | Included command/help sources | Opens create-note dialog | `M-APP` L788–791 | FULL | WORKFLOW | B4 |
| KEY-032 | KEY | Application shell | Ctrl+Shift+F | Search | Opens Search | Search core plugin enabled | Included `Plugins/Search.md` L11 | Opens Search pane | `M-APP` L793–796 | FULL | WORKFLOW | B4 |
| KEY-033 | KEY | Application shell | Ctrl+S | Current note | Obsidian is continuously persisted; Ctrl+S is not required as a save contract | Obsidian autosave model | Included manage/editing sources | Explicitly saves current note | `M-APP` L763–766 | NOT_APPLICABLE | CORRECTNESS | Vision-fit: explicit local file save is acceptable |
| KEY-034 | KEY | Application shell | Ctrl+Shift+A | AI panel | No Obsidian core parity requirement | mdx-vault product-specific invoked AI | Product vision | Toggles AI assistant | `M-APP` L798–801 | NOT_APPLICABLE | WORKFLOW | Vision-fit: product-specific |
| KEY-035 | KEY | Application shell | Ctrl+Shift+E | Export dialog | No stable Obsidian core default contract audited | mdx-vault product-specific export | Hotkeys are customizable | Opens export when a note is selected | `M-APP` L803–808 | NOT_APPLICABLE | WORKFLOW | Vision-fit: product-specific |
| KEY-036 | KEY | Application shell | Ctrl+Shift+P | Command palette | Can be assigned by user, but default Windows command-palette key is Ctrl+P | Custom mapping possible | `O-HK` L13–29 | Hard-coded command palette shortcut | `M-APP` L769–772 | PARTIAL | WORKFLOW | B4 |
| KEY-037 | KEY | Settings, Hotkeys | Click plus-button then press chord | Command | Adds a customizable hotkey and detects conflicts | Hotkeys settings surface | `O-HK` L13–29 | No settings/hotkey editor; handlers hard-coded | `M-APP` global listener | PREREQUISITE | ACCESSIBILITY | B4 |
| KEY-038 | KEY | Settings, Hotkeys | Add another chord | Same command | Stores multiple key combinations for one command | Hotkeys settings surface | `O-HK` L29 | No customization infrastructure | `M-APP` | PREREQUISITE | WORKFLOW | B4 |
| KEY-039 | KEY | Settings, Hotkeys | Click remove icon | Existing binding | Removes binding | Hotkeys settings surface | `O-HK` L31–37 | No customization infrastructure | `M-APP` | PREREQUISITE | WORKFLOW | B4 |
| KEY-040 | KEY | Settings, Hotkeys | Type filter or chord filter | Command list | Filters by command name or assigned shortcut | Hotkeys settings surface | `O-HK` L39–41 | No hotkey settings/search | `M-APP` | PREREQUISITE | ACCESSIBILITY | B4 |
| KEY-041 | KEY | Settings, Hotkeys | Record non-US-layout chord | Keyboard event | Obsidian warns documented hotkey notation assumes US layout | Non-US keyboard layouts | `O-HK` L43–45 | No recording UI or layout guidance | `M-APP` | PREREQUISITE | ACCESSIBILITY | B4 |
| KEY-042 | KEY | Editor caret | Page Up | Visible page | Moves cursor up one page | Windows/Linux; Fn+Up macOS | `O-ES` L51 | CodeMirror/browser page motion | `M-ED` basicSetup | FULL | ACCESSIBILITY | B2 |
| KEY-043 | KEY | Editor caret | Page Down | Visible page | Moves cursor down one page | Windows/Linux; Fn+Down macOS | `O-ES` L52 | CodeMirror/browser page motion | `M-ED` basicSetup | FULL | ACCESSIBILITY | B2 |
| KEY-044 | KEY | Editor caret | Shift+Page Up | Visible page | Extends selection one page up | Windows/Linux; Ctrl+Shift+Up macOS | `O-ES` L66 | CodeMirror/browser page selection | `M-ED` basicSetup | FULL | ACCESSIBILITY | B2 |
| KEY-045 | KEY | Editor caret | Shift+Page Down | Visible page | Extends selection one page down | Windows/Linux; Ctrl+Shift+Down macOS | `O-ES` L67 | CodeMirror/browser page selection | `M-ED` basicSetup | FULL | ACCESSIBILITY | B2 |
| KEY-046 | KEY | Application shell | Ctrl+T | Tab collection | Opens a new tab | Windows/Linux; Command+T macOS | `O-TAB` Open a new tab | No tab surface | Missing surface | PREREQUISITE | WORKFLOW | B4 |
| KEY-047 | KEY | Editor with selected text | Type opening double brackets | Selected text | Wraps/turns selection into an internal link | Editing view | `O-LINK` L47–51 | Ordinary typing replaces selection; no wrap-selection handler | `M-ED` keymap has no bracket-wrap command | MISSING | WORKFLOW | B1 |

### Selection, focus, hover, navigation and OS boundaries

| ID | Family | Surface and state | Trigger | Input / destination | Obsidian result | Platform / setting preconditions | Obsidian evidence | mdx-vault result | mdx-vault evidence | Verdict | Risk | Bundle |
|---|---|---|---|---|---|---|---|---|---|---|---|---|
| SEL-001 | SEL | Editor | Shift+Alt+drag | Rectangular text region | Creates/extends multiple cursors or rectangular selections | Windows/Linux; Shift+Option macOS | `O-MC` L12 | CodeMirror rectangular selection is available through basic setup | `M-ED` basicSetup | FULL | ACCESSIBILITY | B2 |
| SEL-002 | SEL | Editor | Middle-button drag | Text region | Creates multiple cursors | Mouse with middle button | `O-MC` L12 | CodeMirror rectangular/multiple selection is available | `M-ED` basicSetup | FULL | ACCESSIBILITY | B2 |
| SEL-003 | SEL | File explorer | Alt+click | Non-contiguous file rows | Adds/removes file from multi-selection | Windows/Linux; Command on macOS per help | `O-FE` L95 | Single selected path only | `M-TREE` `selectedPath` and one `aria-current` | MISSING | WORKFLOW | B3 |
| SEL-004 | SEL | File explorer | Shift+click | Range between anchor and row | Selects contiguous range | File explorer | `O-FE` L95 | Single selected path only | `M-TREE` | MISSING | WORKFLOW | B3 |
| SEL-005 | SEL | Rendered preview prose | Pointer drag then mouseup | Text selection | Native text selection remains available | Reading/editing view | Live preview observation | Shows a selection action toolbar while preserving selection | `M-PREV` selection capture L124–164; `LIVE-M` | NOT_APPLICABLE | POLISH | Vision-fit: invoked assistance is a product-specific enhancement |
| FOC-001 | FOC | Quick switcher opened | Command/hotkey | Query input | Focus moves to query immediately | Quick switcher enabled | `O-QS` L10–18; `LIVE-O` | Focus moves to query | `M-QS` L40–46; live | FULL | ACCESSIBILITY | B4 |
| FOC-002 | FOC | Command palette opened | Command/hotkey | Query input | Focus moves to query immediately | Command palette enabled | Included `Plugins/Command palette.md`; live | Focus moves to palette query | App palette implementation and global handler | FULL | ACCESSIBILITY | B4 |
| FOC-003 | FOC | Slash/component palette opened | Type slash or Mod+K | Palette query/list | Focus moves into palette while editor selection is retained | Editor active | Included `Plugins/Slash commands.md` L9–11 | Slash palette focuses input; component insert palette is explicitly opened from editor | `M-SLASH`; `M-ED` L452–461 | FULL | ACCESSIBILITY | B2 |
| FOC-004 | FOC | Quick switcher/palette open | Escape | Owning editor/shell | Dismisses overlay and returns to prior work context | Overlay open | `O-QS` L18–19; `LIVE-O` | Dismisses; editor focus is explicitly restored by editor insertion flows | `M-QS` L76–80; `M-SLASH` L90–94; `M-ED` focus calls | FULL | ACCESSIBILITY | B2 |
| FOC-005 | FOC | File rename begins | Rename command | Filename input | Focuses and selects filename for replacement; Enter commit, Escape cancel | File/folder rename available | `O-FE` L76–83; `LIVE-O` | Focuses/selects basename; Enter commit, Escape cancel | `M-TREE` L277–328; `LIVE-M` | FULL | ACCESSIBILITY | B3 |
| FOC-006 | FOC | Modal/dialog loading or error state | Async failure/success | Dialog controls | Keeps focus within actionable dialog and preserves Escape/close route | Dialog open | Live Obsidian modal behavior | Individual React dialogs expose controls, but no audited common focus-trap/restoration contract | `M-QS`, `M-SEARCH`, `M-SLASH` implement separate focus paths; no shared overlay primitive | PARTIAL | ACCESSIBILITY | B4 |
| HOV-001 | HOV | Internal link in Reading/preview mode | Hover | Resolved note/heading | Opens page preview without navigation | Page preview enabled | `O-PV` L4–8; `O-LINK` L177–182 | Opens a bounded, full-note, independently scrollable static preview and resolves nested heading ancestry without running MDX islands | `PagePreviewProvider.tsx`; `hover-preview-document.test.tsx`; GOAL-23 Electron verification | FULL | WORKFLOW | B4 |
| HOV-002 | HOV | Tab/pane resize boundary | Hover then drag | Pane edge | Reveals resize affordance and changes pane size | Workspace with panes | `O-TAB` L62; `O-SIDE` | Split layout boundary is visually fixed; no audited resizer interaction | App layout has no pane-resize handler | PREREQUISITE | WORKFLOW | B4 |
| HOV-003 | HOV | Toolbar/ribbon action | Hover | Command | Shows command tooltip and, where assigned, hotkey | Desktop pointer | `O-RIB`; live | Native `title`/accessible descriptions provide concise tooltips | `M-APP` header actions expose descriptions but have no centralized hotkey registry | PARTIAL | ACCESSIBILITY | B4 |
| HOV-004 | HOV | File/folder row with truncated path | Hover | Row | Reveals path/name affordance | File explorer | Live; included File explorer | `title` exposes relative path on files and folders | `M-TREE` L118, L204 | FULL | ACCESSIBILITY | B3 |
| HOV-005 | HOV | Sidebar tab icon | Hover | Icon-only tab | Shows tooltip with tab title | Sidebar tab | `O-TAB` organize section | No sidebar-tab collection | Missing surface | PREREQUISITE | ACCESSIBILITY | B4 |
| HOV-006 | HOV | Internal link in Editing mode | Ctrl+hover | Resolved note/heading | Opens page preview while keeping caret/edit context | Page preview enabled; Command+hover macOS | `O-LINK` L177–182 | Ctrl/Cmd hover resolves source/live-editor wikilinks and Markdown note links; plain hover remains inert | `MdxEditor.tsx`; `editor-page-preview.test.ts`; GOAL-23 Electron verification | FULL | WORKFLOW | B4 |
| NAV-001 | NAV | Quick switcher results | Arrow Up/Down then Enter | Selected result | Moves active row and opens it | Overlay open | `O-QS` L18–19; `LIVE-O` | Same core navigation | `M-QS` L76–107 | FULL | ACCESSIBILITY | B4 |
| NAV-002 | NAV | Quick switcher result | Ctrl+Enter | Selected note | Opens in new tab | Windows/Linux; Command+Enter macOS | `O-QS` L27; `LIVE-O` | Modifier ignored; opens current shell | `M-QS` Enter handler reads no modifiers | MISSING | WORKFLOW | B4 |
| NAV-003 | NAV | Quick switcher query with no result | Shift+Enter | Query text | Creates note from query | Quick switcher enabled | `O-QS` L25; `LIVE-O` | Plain Enter creates if no result; Shift is not a distinct contract | `M-QS` L95–106 | PARTIAL | WORKFLOW | B4 |
| NAV-004 | NAV | Search results | Arrow Up/Down | Result list | Moves active result before Enter | Search enabled | Included `Plugins/Search.md`; live | No active-result navigation; Enter always opens first result | `M-SEARCH` L84–94 | MISSING | ACCESSIBILITY | B4 |
| NAV-005 | NAV | Tabs | Ctrl+PageUp/PageDown and related tab navigation | Tab list | Selects previous/next tab and supports history navigation | Tabs present | `O-TAB` L94–99 | No tabs | Missing surface | PREREQUISITE | ACCESSIBILITY | B4 |
| NAV-006 | NAV | File explorer folder | Disclosure click or keyboard | Folder children | Collapses/expands hierarchy | File explorer | `O-FE`; live | Always expanded static directory; no disclosure activation | `M-TREE` L112–139 | MISSING | ACCESSIBILITY | B3 |
| NAV-007 | NAV | Tab collection | Ctrl+Tab | Tabs | Switches to next tab | Windows/Linux; Control+Tab macOS | `O-TAB` switch table | No tabs | Missing surface | PREREQUISITE | ACCESSIBILITY | B4 |
| NAV-008 | NAV | Tab collection | Ctrl+Shift+Tab | Tabs | Switches to previous tab | Windows/Linux; Control+Shift+Tab macOS | `O-TAB` switch table | No tabs | Missing surface | PREREQUISITE | ACCESSIBILITY | B4 |
| NAV-009 | NAV | Tab collection | Ctrl+1 | Tabs | Switches to first tab | Windows/Linux; Command+1 macOS | `O-TAB` switch table | No tabs | Missing surface | PREREQUISITE | ACCESSIBILITY | B4 |
| NAV-010 | NAV | Tab collection | Ctrl+2 through Ctrl+8 | Tabs | Switches to the numbered tab | Windows/Linux; Command+2 through Command+8 macOS | `O-TAB` switch table | No tabs | Missing surface | PREREQUISITE | ACCESSIBILITY | B4 |
| NAV-011 | NAV | Tab collection | Ctrl+9 | Tabs | Switches to last tab | Windows/Linux; Command+9 macOS | `O-TAB` switch table | No tabs | Missing surface | PREREQUISITE | ACCESSIBILITY | B4 |
| NAV-012 | NAV | Closed-tab history | Ctrl+Shift+T | Recently closed tab | Reopens most recently closed tab | Windows/Linux; Command+Shift+T macOS | `O-TAB` switch table | No tabs/history | Missing surface | PREREQUISITE | WORKFLOW | B4 |
| NAV-013 | NAV | Editor wikilink completion | Type opening brackets then query, choose suggestion | Indexed note or alias | Inserts target according to current link format and Wikilinks/Markdown preference | Link settings apply | `O-LINK` L23–55; live nested-link setting pass | Suggests titles/aliases but always inserts title-only wikilink text | `M-ED` L420–432 | PARTIAL | CORRECTNESS | B1 |
| NAV-014 | NAV | Editor link completion | Type opening brackets plus heading marker | Heading in current/other note | Lists headings and inserts heading anchor | Editing view | `O-LINK` L62–70 | Note-only completion; no heading suggestions | `M-ED` L420–432 | MISSING | WORKFLOW | B1 |
| NAV-015 | NAV | Editor link completion | Type opening brackets plus block marker | Block in current/other note | Searches blocks and inserts block reference | Editing view | `O-LINK` heading/block sections | No block suggestions | `M-ED` L420–432 | MISSING | WORKFLOW | B1 |
| NAV-016 | NAV | Command palette | Choose Add internal link | Editor caret/selection | Opens internal-link insertion flow | Editing view; command palette | `O-LINK` L47–53 | Current command registry has no Add internal link command | App command list; `M-ED` only Mod+K component palette | MISSING | WORKFLOW | B1 |
| NAV-017 | NAV | Internal-link completion | Query attachment/file | Non-Markdown accepted file | Suggests and inserts target including file extension | File indexed/accepted | `O-LINK` L55 | Completion source is indexed note summaries, not attachments | `M-ED` L420–432 | MISSING | WORKFLOW | B1 |
| OSE-001 | OSE | Rendered external link | Primary click | HTTPS URL | Opens external web destination under desktop link policy | Desktop app | Live Obsidian; included URI/link sources | Renders an ordinary anchor; only new-window requests are sent to `shell.openExternal` | `M-PREV` L32–37; [`main/index.ts:36`](../../src/main/index.ts#L36) | PARTIAL | CORRECTNESS | B4 |
| OSE-002 | OSE | File explorer file menu | Reveal in system explorer | Backing file | Opens Explorer and selects/reveals the file | Windows | `LIVE-O-03` | Reveals backing file through validated IPC | `M-TREE` L233–236; [`vault-ipc.ts:235`](../../src/main/ipc/vault-ipc.ts#L235); `LIVE-M` menu | FULL | WORKFLOW | B3 |
| OSE-003 | OSE | File explorer file menu | Copy path submenu/action | Backing file | Offers path variants including file/relative/URI according to surface | File exists | `LIVE-O-03` | Copies absolute filesystem path only | [`App.tsx:380`](../../src/renderer/src/App.tsx#L380); `M-TREE` | PARTIAL | CORRECTNESS | B1 |
| OSE-004 | OSE | Explorer ingress | Paste/drop accepted file | PNG, PDF, text, HTML | Imports supported files and generates configured links/embeds | Accepted file formats; Show all file types affects discovery | `O-ATT`; included Accepted file formats | Imports only PNG/JPEG/GIF/WebP/SVG as attachments | `M-ED` L624–671 | PARTIAL | DATA_INTEGRITY | B2 |
| OSE-005 | OSE | Explorer/Quick switcher discovery | Select unsupported binary | `.bin` | Hidden/not openable by default; Show all file types can expose for linking | Show all file types setting | `O-SET` L220–230; live setting off | Tree/index enumerate MDX notes only; binary fixtures are not exposed | Vault/index extension guards | PARTIAL | CORRECTNESS | B1 |
| OSE-006 | OSE | Note drag to external app | Drag out | Note URI | Emits Obsidian URI usable by accepting app | Obsidian URI scheme | `O-DND` L31; included Obsidian URI | No exported note URI drag; copy path is filesystem-only | `M-TREE`; `M-PREV` | MISSING | WORKFLOW | B3 |

Matrix totals: **145 unique rows** — CTX 16, PTR 9, DND 21, CLP 12, KEY 47, SEL 5, FOC 6, HOV 6, NAV 17, OSE 6. After the GOAL-23 row updates above: FULL 56, PARTIAL 17, MISSING 39, CONFLICT 5, PREREQUISITE 24, NOT_APPLICABLE 4. `PREREQUISITE` is intentionally excluded from ordinary missing-feature counts.

## Live Obsidian Evidence

All observations below used only `obsidian-goal14-audit`, a disposable vault registered in Obsidian 1.12.7. Menu entries can vary with enabled core plugins; the fixture used the installed default/core-plugin state and no community plugin.

### Right-click pass

| Live ID | Surface/state | Observed result |
|---|---|---|
| LIVE-O-01 | Editor prose, no selection | Add link, Add external link, Format, Paragraph, Insert; Cut/Copy disabled; Paste, Paste as plain text, Select all. |
| LIVE-O-02 | Editor prose, selected text | Same base editor menu with Cut/Copy enabled; action applicability followed selection state. |
| LIVE-O-03 | File row, selected and unselected | Open in new tab/right/window, Make a copy, Move file to, Bookmark, Merge, Copy path, version history, OS open/reveal, Rename, Delete. |
| LIVE-O-04 | Folder row | New note/folder/canvas/base, duplicate, move, search in folder, bookmark, copy path, OS reveal, rename, delete. |
| LIVE-O-05 | File-tree background | New note/folder/canvas/base only. |
| LIVE-O-06 | Heading block | Base editor menu plus Rename this heading, Bookmark this heading, Extract this heading. |
| LIVE-O-07 | Internal link in editor | Open in new tab/right/window plus link, path, file, bookmark and reveal actions. |
| LIVE-O-08 | Tab header | Close/pin/link, editing/reading mode, window/split actions, note operations, find/replace, path/history/reveal/delete. |
| LIVE-O-09 | Search result file heading | File open variants, rename/move/bookmark, OS/reveal/delete, copy path. |
| LIVE-O-10 | Backlink source heading | Same file-oriented alternate-action set as search result. |
| LIVE-O-11 | Outline heading | Right-click selected/highlighted the row; no context menu. Primary click navigated; official help documents drag-to-reorder. |
| LIVE-O-12 | Tag row | Right-click highlighted the row; no context menu. Official help documents click search and Ctrl-click toggle. |
| LIVE-O-13 | Property value | Edit, Copy, Remove from list. |
| LIVE-O-14 | Ribbon background | Checkable ribbon command list and Hide ribbon. |

Cropped evidence for the incompletely documented menus:

- [Editor context menu](evidence/obsidian-interactions-2026-07/obsidian-editor-context-menu.png)
- [File context menu](evidence/obsidian-interactions-2026-07/obsidian-file-context-menu.png)
- [Folder context menu](evidence/obsidian-interactions-2026-07/obsidian-folder-context-menu.png)

### Setting-dependent observations

| Contract | Before | Action | After | Restoration |
|---|---|---|---|---|
| Rename link integrity | `00 Dashboard.md` and `Incoming Link.md` contained five links targeting `Target Note`; Automatically update internal links was off, meaning prompt mode | Rename to `Renamed Target`, then choose **Just once** in the Update links prompt | All five wikilinks in two files were rewritten; alias display text stayed intact; plain mentions stayed unchanged | Setting remained prompt mode; no setting change |
| Link generation | New link format `Shortest path when possible` | Temporarily choose `Path from vault folder`, use Add link and select nested `Alpha` | Generated `[[Nested/Alpha\|Alpha]]`; this demonstrates path plus display-text policy rather than title-only insertion | Restored `Shortest path when possible` |
| Attachment location | `Vault folder` | Temporarily choose `Same folder as current file`; in `Nested/Beta.md`, paste `pixel.png` copied from Explorer | Copied to `Nested/pixel.png` and inserted `![[Nested/pixel.png]]` | Restored `Vault folder` |
| Rich HTML conversion | Convert pasted HTML to Markdown on | Paste a Windows clipboard carrying both CF_HTML and Unicode text | Produced `Rich **bold** and _italic_` plus Markdown list items `- one`, `- two` | Setting was not changed |
| Paste without conversion | Same clipboard and setting | `Ctrl+Shift+V` | Inserted the plain representation `Rich bold and italic one two` | No setting change |
| Attachment type | Vault-folder location, Wikilinks on | Paste Explorer-copied PNG, then PDF | Both were copied at the vault root and embedded as wikilinks | No setting change |

The disposable `.obsidian/app.json` was exactly `{}` before the pass and exactly `{}` after cleanup. The audit did not change global hotkeys or touch the separately open user vault.

## mdx-vault Evidence

### Running-app surface pass

The app was launched against `%TEMP%\\mdx-vault-goal14-audit`. The live tree exposed seven MDX notes, one always-expanded nested folder, source/split/preview modes, Outline/Tags/Backlinks tabs and the current command/search/quick-switcher overlays.

| Case | Before | Action | After | Verdict link |
|---|---|---|---|---|
| File context menu | `Target Note.mdx` row | Right-click | Exactly Duplicate, Rename, Copy path, Reveal in explorer, Delete | CTX-005 |
| Folder context menu | `Nested` row | Right-click | No menu; folder remained always expanded | CTX-006, NAV-006 |
| Rename integrity | Dashboard and Incoming Link contained five `Target Note` wikilinks | Rename row to `Renamed Target` and commit | File became `Renamed Target.mdx`; all five incoming links remained `Target Note` | Data finding F-01 |
| Paste-without-formatting | Split view, editor focused | `Ctrl+Shift+V` | Split view changed to Preview; clipboard was not inserted | CLP-004 |
| Image paste | No `assets/` directory | Copy fixture `pixel.png` in Explorer, paste at editor end | Created `assets/pixel.png`, inserted `![](assets/pixel.png)` | CLP-006, CLP-008 |
| PDF paste | Dashboard length 645 in accessibility snapshot; only fixture PDF under `Attachments/` | Copy `sample.pdf`, paste at same caret | Document payload length unchanged; no copied PDF outside fixture directory | CLP-007 |

The mdx file-menu crop is [here](evidence/obsidian-interactions-2026-07/mdx-vault-file-context-menu.png). Other high-risk results are stronger as filesystem/code evidence than as screenshots: the report records exact before/action/after text and the relevant handler paths.

### Code-to-contract findings

- Rename is atomic and path-safe, but terminates after filesystem rename and index replacement. Neither [`vault-service.ts:176`](../../src/main/services/vault-service.ts#L176) nor [`vault-ipc.ts:175`](../../src/main/ipc/vault-ipc.ts#L175) enumerates or rewrites references.
- `Ctrl+Shift+V` is consumed at the window level before CodeMirror can handle it, with an explicit `preventDefault()` and view cycle at [`App.tsx:781`](../../src/renderer/src/App.tsx#L781).
- Paste/drop recognizes only five image MIME types. A supported image is persisted and inserted asynchronously; every non-image file returns `false`, leaving Chromium/CodeMirror fallback with no attachment import at [`MdxEditor.tsx:465`](../../src/renderer/src/editor/MdxEditor.tsx#L465) and [`MdxEditor.tsx:624`](../../src/renderer/src/editor/MdxEditor.tsx#L624).
- Attachment persistence has a secure filename allowlist and uniqueness behavior, but location and syntax are fixed to `assets/` plus Markdown image syntax at [`vault-service.ts:326`](../../src/main/services/vault-service.ts#L326).
- File rows have one Radix context menu; folder rows, search/backlinks/outline/tags and preview links have no alternate-action menus. This is an interaction-infrastructure gap, not evidence that right-click should be globally suppressed.
- `basicSetup` supplies the normal editor history, movement, selection and deletion keymaps. Application shortcuts are a separate global listener; hotkey labels elsewhere were not counted without that handler.

## Prioritized Bundles

Priority uses the existing rubric `Impact × VisionFit / Effort`, with 1–5 inputs and effort marked `[estimate]`. Proven data-integrity failures override numeric ordering.

| Priority | Bundle | Shared contract and scope | Impact | Vision fit | Effort | Score | Prerequisites | Risk override |
|---|---|---|---:|---:|---:|---:|---|---|
| P0 | B1 — Link and asset policy integrity | Transactional rename/reference rewrite; canonical link generation policy; Wikilink/Markdown choice; shortest/relative/vault paths; attachment destination; copy-path variants | 5 | 5 | 3 `[estimate]` | 8.3 | Shared parser/index API and explicit settings model | **DATA_INTEGRITY**: broken incoming links proven live |
| P0/P1 | B2 — Editor ingress and keyboard baseline | Release `Ctrl+Shift+V`; rich-HTML conversion/plain bypass; accepted non-image attachments; image/non-image drop parity; editor/heading actions; drag section reorder safeguards | 5 | 5 | 4 `[estimate]` | 6.25 | B1 policy for generated destinations and syntax | **CORRECTNESS/DATA_INTEGRITY**: destructive clipboard collision and silent PDF loss |
| P1 | B3 — Explorer and result interactions | Folder disclosure/context menu; tree background actions; multi-select; move/drag payloads; result/backlink actions; copy/reveal/URI variants | 4 | 5 | 4 `[estimate]` | 5.0 | Move transaction API and selection model | File moves/deletes require transactional guardrails |
| P2 | B4 — Workspace, hotkey and focus infrastructure | Tabs/panes, modifier-open routes, hotkey registry/editor, command defaults, hover previews, resizers, shared overlay focus restoration | 4 | 4 | 5 `[estimate]` | Workspace/tab model before UI parity | `PREREQUISITE` rows stay separate until surfaces exist |

The bundles are dependency-shaped: B1 owns generated references and paths; B2 and B3 consume that policy; B4 owns shell-level routing and customizable commands. Implementing isolated menu items before these contracts would leave integrity and modifier behavior inconsistent.

## Data-Integrity Findings

### F-01 — Rename breaks incoming wikilinks in mdx-vault (highest priority)

- **Obsidian before/action/after:** five links in two notes targeted `Target Note`; F2 rename to `Renamed Target`; because auto-update was in prompt mode, Obsidian asked once; choosing Just once rewrote all five targets while preserving alias display text and leaving plain mentions untouched.
- **mdx-vault before/action/after:** the equivalent five links existed; rename committed and reindexed `Renamed Target.mdx`; both source notes still contained `[[Target Note]]` targets.
- **Why this outranks convenience gaps:** the user action succeeds visually while silently leaving navigational references stale. Atomic filesystem rename alone is insufficient; the reference rewrite and rollback boundary must be designed together.

### F-02 — Attachment ingress silently drops non-image files

Obsidian accepted both the PNG and PDF clipboard fixtures and generated embeds under the current settings. mdx-vault persisted only the PNG. Pasting the PDF changed neither the note payload nor the vault outside the original fixture. A silent no-op for a user-provided file is a correctness/data-loss perception risk even though the source file itself remains safe in Explorer.

### F-03 — Destination and generated syntax are hard-coded

Live Obsidian results changed with link/attachment settings: vault-relative link generation yielded `[[Nested/Alpha\|Alpha]]`, and same-folder attachment routing yielded `Nested/pixel.png`. mdx-vault always uses `assets/<unique-image-name>` and `![](assets/...)`. Until there is one shared policy, explorer moves, autocomplete, paste/drop, export and rename cannot agree on references.

### F-04 — `Ctrl+Shift+V` is a global correctness conflict

Obsidian and the live Editor setting describe this chord as paste without HTML conversion; live output used the plain clipboard representation. mdx-vault calls `preventDefault()` globally and changes view mode. This should be resolved before adding more hard-coded shell shortcuts because focus context must decide whether the editor or shell owns a chord.

## Unresolved Questions

These are product decisions, not unverified evidence:

1. Should mdx-vault preserve Obsidian's three link formats verbatim, or expose a smaller policy with an explicit migration path? Whatever choice is made must be shared by autocomplete, paste/drop, explorer move and rename rewrite.
2. Which non-image attachment types should be copied into a vault versus linked externally? The security model argues for an allowlist and sandbox-safe rendering, while the note model needs predictable filesystem behavior.
3. Should the first workspace implementation support true tabs/windows, or introduce a routing abstraction now and defer visual tabs? Modifier-click and Quick Switcher variants need a destination model either way.
4. Which Obsidian context-menu actions fit the product vision? Merge/extract/bookmark are useful contracts, but full menu cloning would overfit features that do not yet exist.
5. macOS modifier behavior is documented but not live-verified by this Windows-only goal. It should be covered when the project has a macOS execution target, not inferred from Windows handlers.

## Reproduction Appendix

### Initial fixture manifest

Both disposable vaults used the same logical content, with `.md` for Obsidian and `.mdx` for mdx-vault.

- `00 Dashboard`: frontmatter `aliases: [Audit Home]`, tag `audit/interaction`, `status: fixture`; H1 `Interaction Audit Dashboard`; direct and display-alias links to `Target Note`; plain mentions of title and alias; a note callout; a two-row Markdown table; H2 `Editing surface`; bold, italic and inline-code text; TypeScript fenced block; external `https://example.com` link; image reference to `Attachments/pixel.png`.
- `Target Note`: frontmatter aliases `Target Alias` and `TAlias`, tag `audit/target`; H1 `Target Note`; H2 `Target heading`; block ID `target-block`.
- `Incoming Link`: direct link, display-alias link and alias-targeting link to `Target Note`.
- `Plain Mention`: unlinked occurrences of `Target Note` and `Target Alias`.
- `Nested/Alpha`, `Nested/Beta`, `Nested/Gamma`: one heading and one short sentence each, providing selection, move, relative-link and same-folder attachment targets.
- `Attachments/pixel.png`, `sample.pdf`, `sample.txt`, `sample.html`, `unsupported.bin`: small local fixtures; none came from user content.
- Rich clipboard HTML: `<p>Rich <strong>bold</strong> and <em>italic</em></p><ul><li>one</li><li>two</li></ul>` with Unicode fallback `Rich bold and italic one two`.

### High-risk reproduction steps

1. **Rename:** open Dashboard and Incoming Link, record link targets, rename Target Note from the file tree, answer the Obsidian update prompt, then read both files from disk. Repeat in mdx-vault and compare targets.
2. **Paste chord:** put the rich/plain dual-format fixture on the clipboard, focus the editor, record current view, press `Ctrl+Shift+V`, then record inserted text and view.
3. **Menus:** right-click file, folder and tree background independently; do not infer folder behavior from a file row.
4. **Attachment types:** copy PNG then PDF from Explorer and paste each at a known caret. Compare note bytes and a recursive file listing before/after.
5. **Generated destinations:** in Obsidian change only the disposable vault's New link format and attachment location, generate one nested link and paste one image into a nested note, then restore settings. In mdx-vault inspect both renderer insertion and main-process persistence.

### Audit-state cleanup

The two fixture vaults remain under `%TEMP%` for reproduction. Obsidian's settings file was restored to its original `{}`. The Obsidian test window was closed; a separately running user-vault window was neither clicked nor read. The mdx-vault fixture may contain the intentionally renamed note and `assets/pixel.png`; it is disposable and outside the repository.

## Draft Objectives

1. **Draft: transactional rename and reference policy.** Implement a single tested service that plans, previews and atomically applies a note rename plus all affected MDX wikilink/Markdown-link rewrites, preserving display aliases and leaving plain mentions unchanged; measurable acceptance is the F-01 five-link fixture completing with zero stale targets or partial writes.
2. **Draft: editor clipboard and attachment ingress.** Restore context-sensitive paste-without-formatting, convert dual-format HTML predictably, accept an explicit safe attachment allowlist including PDF/text where chosen, and route every generated asset through the shared destination/link policy; measurable acceptance covers PNG, PDF, HTML, plain text and unsupported binary before/action/after cases.
3. **Draft: explorer interaction transaction layer.** Add folder disclosure and scoped context menus, multi-selection, move/drop planning and alternate actions for file/search/backlink results on top of validated main-process operations; measurable acceptance includes keyboard access, conflict handling and no partial multi-file move/delete.
4. **Draft: command routing and workspace destinations.** Introduce a context-aware hotkey registry plus destination abstraction for current/new/right tab before adding a full workspace UI; measurable acceptance makes Ctrl+P/Ctrl+O, modifier-open variants, Escape focus restoration and editable hotkey conflicts deterministic.
