# Developer editing DX audit — verification (2026-09-13, round 1)

Stage: research/evidence only for dispatch `dx-research-20260913-01`,
correction round 1. Companion analysis:
[research notes](../research/developer-dx-audit-2026-09-13.md).

No user vault, personal Electron profile, OS setting, or editor setting was
used or modified. The probe ran against a generated disposable vault and an
isolated `MDX_VAULT_TEST_USER_DATA` directory. No app, config, test, or goal
file was edited. The only worktree additions are `scripts/verify-dev-dx-audit.py`,
this document, the research document, and
`docs/research/evidence/developer-dx-audit-2026-09-13/`. The pre-existing
dirty worktree is untouched. Nothing was committed; no dependency was
installed; no reviewer or sub-agent was invoked.

Writes performed by the probe, stated exactly: files inside its generated
fixture vault, the output directory, and the isolated profile's
`app-settings.json` written by the app under test when the probe called
`updateSettings`. The round-0 ledger claimed "only the fixture and output
directory" — that was incomplete, because the probe's settings mutation
persists into the isolated profile by design.

## Profile isolation (demonstrated, not asserted)

Round 0 recorded only a placeholder launch command; the review correctly
flagged that the helper attaches to any CDP endpoint and that profile identity
was never demonstrated. The final run demonstrates it:

1. Pre-mutation: the probe refuses to run if the declared profile already
   contains `app-settings.json` (`profileFreshBeforeMutation: true`).
2. Mutation: the probe writes a non-default marker (`editorLineHeight: 1.7`)
   and then polls for that exact value inside the *declared* profile's
   `app-settings.json` (`settingsMarkerFoundInDeclaredProfile: true`).
   A stray process would fail this check — and did: one round-1 attempt
   attached to a leftover Electron process from a previous launch on CDP port
   9333 and never received the marker; the probe refused, the launcher now
   kills stray `electron.exe` processes and confirms the port is free before
   starting the app, and only a marker-verified run is recorded.

Launch receipt (from `dx-audit-results.json`):

```json
{
  "launchCommand": "MDX_VAULT_TEST_USER_DATA=C:/Users/terasumi/AppData/Local/Temp/mdx-vault-dx-profile-r9 bun run dev -- --remoteDebuggingPort 9333",
  "cdpEndpoint": "http://127.0.0.1:9333",
  "profileDir": "C:\\Users\\terasumi\\AppData\\Local\\Temp\\mdx-vault-dx-profile-r9",
  "profileFreshBeforeMutation": true,
  "settingsMarkerFoundInDeclaredProfile": true,
  "settingsPersistedInIsolatedProfile": true
}
```

## Static gates

| Check | Command | Exit | Result |
| --- | --- | --- | --- |
| Typecheck | `bun run typecheck` | 0 | tools/node/web all pass |
| Lint (Biome) | `bun run lint` | 0 | no issues |
| Tests | `bun test` | 0 | 472 pass, 0 fail, 107 files, 3016 expect calls |

`bun run build` was not run in this stage: no product code was added; the
production-build verification is an explicit gate of the recommended outcome 5.

## Live probe

Script: `scripts/verify-dev-dx-audit.py` (Playwright over CDP; conventions
follow `scripts/verify-typing-ux-live.py`). It generates its own vault — notes
with Vietnamese text, a 1,602-line / 24,253-character large note with a
known needle at line 801, and a root `sample.tsx` with a unique token — then
exercises the shortcut matrix, dirty-buffer behavior, search filters, the
interactive authoring loop, IME composition, latency, and cursor/motion facts.

Run (launcher responsibilities in steps 1–2, probe in step 3):

```bash
# 1. No stray instance may hold the CDP port.
taskkill //F //IM electron.exe   # then confirm 9333 does not respond

# 2. Launch with a fresh absolute temp path.
MDX_VAULT_TEST_USER_DATA=<fresh-temp-dir> bun run dev -- --remoteDebuggingPort 9333

# 3. Run the probe, declaring the same profile.
PYTHONIOENCODING=utf-8 python scripts/verify-dev-dx-audit.py \
  --output docs/research/evidence/developer-dx-audit-2026-09-13 \
  --profile-dir <fresh-temp-dir> \
  --launch-command "MDX_VAULT_TEST_USER_DATA=<fresh-temp-dir> bun run dev -- --remoteDebuggingPort 9333"
```

Final run: exit 0, zero captured page errors.

### Shortcut × surface × focus matrix (`navigationMatrix`, 17/17 pass)

| Shortcut | Surface | Focus state | Outcome / note |
| --- | --- | --- | --- |
| Ctrl+P | note Source | editor | picker opens |
| Ctrl+P Escape | note Source | editor | closes; focus returns to editor |
| Ctrl+P | note Live | editor | picker opens |
| Ctrl+P | plain `.tsx` | editor | picker opens |
| Ctrl+P | explorer | tree row (shadow-piercing focus verified) | picker opens |
| Ctrl+P repeat | picker open | picker input | modal guard keeps the picker |
| Ctrl+P arrows+Enter | second ranked option | picker input | opens it; focus in document |
| Ctrl+F find | note Source | editor | `F3` selects `sharp` |
| Ctrl+F Escape | note Source | editor | closes; focus returns to editor |
| Ctrl+F find | note Live | editor | `F3` selects `sharp` |
| Ctrl+F find | plain `.tsx` | editor | `F3` selects `Probe` (case-insensitive) |
| Ctrl+F | explorer | tree row | no panel opens (unbound outside editors) |
| Ctrl+Shift+F | project search | note Source / Live / `.tsx` / explorer tree (4 rows) | dialog opens |
| Ctrl+Shift+F | quick-open picker open | picker input | modal guard keeps the picker |

Verification limitations, recorded rather than papered over: the Settings
dialog and Reading-surface focus states were not probed live (resolver
behavior for them is source-audited only); Reading has no editor surface for
Ctrl+F by design.

### Other workflow checks (observed)

| Check | Result |
| --- | --- |
| Dirty indicator while typing | true (tab dot `title="Unsaved changes"`) |
| Dirty buffer survives Ctrl+P→Escape / Ctrl+Shift+F→Escape / tab switch | token intact; `stillDirty` after switch |
| `Mod+S` clears the dirty indicator | true |
| Search `SHARP` (case default) | 1 result (case-insensitive) |
| Search `/Sh(r|a)rp/` (regex) | 1 result |
| Search `sharp path:notes` / `bravo file:second` | path/file filters work |
| Search `/(unclosed` | alert "Invalid regex search: missing closing slash." |
| Search `QTX-COMPONENT-TOKEN` (lives only in `.tsx`) | "No matches." — coverage gap reproduced |
| Deep-match reveal (needle line 801 / 1,602) | caret line 1603 — no reveal this run (round 0 revealed to line 799); reveal is nondeterministic, never selects the match |
| Interactive create (palette → dialog → workbench) | transactional create; starter `stateful-control`; zero-capability proof auto-ran to `Ready · 0 problems` |
| Interactive TSX completion | popup via typing; accepted `Number` (interface ranked above `number` primitive — recorded gap) |
| Interactive TSX diagnostics | Problems ledger updated (`Problems · 1`; proof state gated) but no editor lint markers within 20 s — open discrepancy, reproduced twice |
| Interactive undo | one `Ctrl+Z` removed the last typed segment (recorded verbatim) |
| Interactive safe proof frame | `sandbox="allow-scripts"`, src `mdx-vault-sandbox://docu…` |
| IME (CDP composition) | `compositionstart` + `compositionupdate("Tiếng")`; committed text exactly `IME: Tiếng`; `compositionend` not captured on the probed node; CDP ≠ OS IME |
| Motion facts | `.cm-cursor.cm-cursor-primary` present; content `caret-color: rgba(0,0,0,0)` (native caret hidden by `drawSelection`); scroller `scroll-behavior: auto`; `prefers-reduced-motion: false` in session |

### Input latency (keydown → next rAF; scheduling proxy, not presentation or hardware latency; 25 ms keystroke interval; no concurrent heavy checks)

| Surface | keys | CM lines | p50 | p95 | max | long tasks |
| --- | --- | --- | --- | --- | --- | --- |
| note_small (Source) | 33 | 1 | 11.0 ms | 55.6 ms | 70.1 ms | 3 |
| note_large | 34 | 1,603 | 19.8 ms | 91.0 ms | 105.8 ms | 8 |
| plain_tsx | 36 | 5 | 14.5 ms | 60.2 ms | 66.2 ms | 3 |
| interactive_tsx (workbench) | 35 | 17 | 18.3 ms | 65.2 ms | 67.3 ms | 7 |

Dev build (unminified, HMR, DevTools attached). The large-note median already
exceeds one 60 Hz frame; production-build measurement against a ratified
budget is gate content for outcome 5 — this stage does not declare the
responsiveness question resolved.

### Artifacts

- `dx-audit-results.json` — raw results (Biome-formatted LF)
- Screenshots from the final run: `quickopen.png`,
  `interactive-create-dialog.png`, `interactive-workbench.png`,
  `interactive-completion.png`, `interactive-diagnostics.png`,
  `interactive-proof-ready.png`, `project-search-deep-reveal.png`,
  `ime-composition.png`, `motion-facts.png`
- Round-0 screenshots that no longer correspond to the final run were deleted
  so the directory contains only final-run evidence.

## Probe iteration history (harness defects found and fixed before the recorded run)

None of these were app defects; all were fixed and the recorded run is the
source of truth. (1) The view accessor grabbed the first `.cm-content` in the
DOM instead of the focused editor — reads now resolve through
`document.activeElement` first. (2) Key presses sent immediately after a
picker opened raced its `setTimeout(0)` input focus, so Escape landed on the
element underneath — every dialog interaction now waits for input focus.
(3) `fill()` on the find panel input fires no `change`/`keyup`, so the query
never committed — the probe types real keystrokes; the panel also persists its
query across mode switches, so it is cleared before typing. (4) The file tree
renders rows inside an open shadow root with per-character spans, so text
locators cannot match — explorer focus uses a shadow-piercing row focus.
(5) The workbench's role=tab switcher is `lg:hidden`; at 1440 px all panes are
mounted and no tab switch is needed. (6) A forced radio `.check()` on the
starter card did not reach React's onChange (Blank stayed selected) — the
visible card label is clicked instead, and the selected value is recorded.
(7) The starter's proof can auto-run, replacing the "Run isolated proof"
button with "Refresh proof" — the consent step is now state-machine driven.
(8) A Python escape bug put a real newline inside a generated JS string.
(9) An early round-1 run attached to a stray Electron process from a previous
launch (same CDP port); the launcher now kills strays, confirms the port is
free, and the probe verifies profile identity via the settings marker.

## Reproduce

Steps 1–3 in "Live probe" above, with a fresh temp dir each time. Static
gates: `bun run typecheck`, `bun run lint`, `bun test`.

## Claims not verified here

- Production-build input latency and the latency budgets (outcome 5).
- OS-level Vietnamese IME sessions (outcome 5 contains the design).
- Settings-dialog and Reading-surface shortcut focus states.
- Root cause of G-07 (editor markers not rendering for workbench diagnostics).
- Zed/VS Code behaviors cited from their docs/source were read, not executed.
- Round-0's deep-match reveal (caret to line 799) could not be re-observed in
  the round-1 run (no reveal at all); both raw values are recorded and the
  discrepancy is treated as a finding, not averaged away.
