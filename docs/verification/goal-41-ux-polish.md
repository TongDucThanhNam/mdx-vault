# GOAL-41 — Trust, calm chrome, graph readability and motion

## Result

**Partial; not all acceptance passes.** Renderer implementation and functional
gates pass. First-open/cold performance misses and the original QuizBlock Demo
export blocker are explicitly retained below. Passing work is committed under
brief acceptance §11, not represented as a completed performance goal.

Baseline: `fd31b37`, 528 tests, typecheck pass, 232 source Biome errors and 8,771
repository lint errors. Discovery:
`.agent-dispatch/run-1791730329569-9e9b206f/worker-report.md`.
Verification: production Electron on Windows, 2026-10-11 local time, fresh
copied vaults/profiles. No main/preload/shared/IPC/CSP/permission/dependency
changes. No repository-wide formatting or temporary-artifact cleanup.

## Acceptance ledger

| Brief check | Result | Evidence |
| --- | --- | --- |
| 1. EOL/coordinates | PASS for editor load/sync, real edits, history, formatting, selection, outline and counts | `tests/goal41-trust.test.ts`; production audit below |
| 2. DNS E2E | PASS: 36,753 bytes unchanged, unchanged mtime, zero dirty observations after cycles and ≥2.2s; edit is CRLF-only | `.tmp/goal41/audit-accepted.log`, `audit-results.json` |
| 3. Status ownership | PASS: note Ln 8, Col 3 → manifest Ln 1, Col 1 | Same audit; selection ownership regression test |
| 4. Welcome | PASS: H1 Welcome, three outline headings, real emphasis/code/lists/quote, working quiz | Same audit; `welcome-reading.png`; GOAL-34 harness completes |
| 5. Chrome | PASS: inventory migration, source guard and visual review in four theme/size combinations | `tests/goal41-chrome.test.ts`; screenshots/inventory below |
| 6. Contrast | PASS on sampled enabled chrome text/control boundaries | `.tmp/goal41/contrast-summary.json`, raw surface samples |
| 7. Graph | PASS: width/label floor, compact fit, unchanged positions and zero layouts on unrelated update | `audit-results.json`, old graph tests plus new tests |
| 8. Motion | PASS: observed palette entry/exit 150ms; reduced motion zero animations; no document animation | `audit-results.json`; source guard; retained closing surfaces |
| 9. Performance | **FAIL:** cold, first small and first DNS exceed budgets; other target medians/key p90 pass | Raw n=10 series and table below |
| 10. Gates/export | Code gates PASS; repo lint remains FAIL; **exact QuizBlock Demo export BLOCKED** | Gate/export sections below |
| 11. Records/commit | PASS with failures explicitly left open in the goal | DESIGN, goal, README dependency 40, this record; conventional GOAL-41 commit |

## Before → after / screenshot inventory

All screenshot paths below are under `.tmp/screens/goal41/`. Prefix each suffix
with `light-1440-`, `light-1100-`, `dark-1440-`, or `dark-1100-` and append `.png`.
Viewport sizes are respectively 1440×900 and 1100×720. Full images and labelled
four-up review sheets `review/00-*.jpg` through `review/45-*.jpg` were reviewed.
Main sweep: `.tmp/goal41/surfaces-accepted.log` (no failures); populated panels:
`surfaces-populated-final.log` (no failures). Menu keyboard capture:
`surfaces-menu-accepted.log`. Earlier diagnostic/harness failures remain on disk.

| Discovery surface | Before | After | Screenshot suffix |
| --- | --- | --- | --- |
| Command palette | Mono/uppercase copy, offset shadow, inverted selection | Sans copy, tinted selection, soft overlay | `palette` |
| Project search | Heavy frame and metadata | Calm input/results and visible focus | `search` |
| Finder / MRU | Heavy card and inverted rows | Shared overlay vocabulary | `finder`, `mru` |
| Settings / keymap | Serif titles, hard divisions, black cards | Atkinson, tinted categories, restrained rules; actual key chips remain mono | `settings`, `keymap`, `settings-about` |
| New note / interactive | Heavy inputs/cards | Shared dialog, calm options and retained closing form | `new-note`, `new-interactive` |
| Confirm | Inherited hard alert frame | Soft alert frame; dark destructive label contrast repaired locally | `confirm` |
| Properties / utilities | Duplicate title, heavy cards and scope tabs | One dock title, slim count/action toolbar, tinted scope | `panel-properties`, `panel-properties-populated`, `panel-footnotes-populated`, `panel-bookmarks-populated`, `panel-outgoing-links-populated` |
| Backlinks / Tags | Heavy duplicate headers, uppercase copy | Accessible labelled regions, sans copy, no second title | `panel-backlinks`, `panel-backlinks-populated`, `panel-tags`, `panel-tags-populated` |
| Context / Outline | Duplicate title under selector | Selector alone titles dock; count retained | `01-shell-outline`, `panel-outline` |
| Graph | Narrow canvas, small labels, scattered fit | Responsive navigator, zoom-aware labels, component/orphan packing | `graph`, `graph-ai`, `graph-drawer`, `graph-settings` |
| Interactive workbench | Heavy frame, serif title and inverted tabs | Calm header/tabs; code and trust semantics untouched | `interactive-proof` |
| AI dock and overlays | Mono uppercase body/control copy | Sans readable context/messages/settings; code diff stays mono | `ai-context`, `ai-review-fixture`, `ai-settings`, `ai-palette` |
| Toast | Hard offset frame and uppercase title | Soft popover with semantic accent; retained exit | `toast` |
| App / tree / sort / tab menus | Mixed heavy and calm treatments | Shared border/radius/shadow and sentence case | `menu`, `menu-file`, `tree-menu`, `sort-menu`, `tab-menu` |
| Vault selector | Input-like bordered/underlined text | Ghost folder/name/chevron button | `01-shell-outline` |
| Editor overlays | Hard frame, mono descriptions | Calm insertion/slash/definition overlays with exit presence | `component-insert`, `slash`, `component-definition` |
| Export dialog | Heavy cards/uppercase descriptions | Calm options/results; exported paper separate | `export` |
| Image / empty shell | Hard image frame, serif empty heading | Quiet image canvas and sans empty state | `image-preview`, `empty-workspace` |
| Hover wrapper | Heavy outer frame and controls | Calm outer chrome; inner editorial paper unchanged | `wikilink-preview` |

The missing-file notice is source-reviewed; no destructive missing-file scenario
was created just for a screenshot. The image fixture is intentionally 2×2px.
AI messages, tool result and proposed diff are synthetic React UI fixtures, not
a provider call or approval/write test. No API key or external AI request was used.
Populated panels use existing GOAL-23 fixtures; interactive consent was denied,
not bypassed. Drawer screenshots at wide widths correctly say not applicable
when the navigator remains inline.

The submenu pointer-capture diagnostic caught an exit frame: after screenshot,
the submenu was `data-state=closed` while fading. The final keyboard ArrowRight
and CDP capture retains focus/hover, avoids screenshot viewport adjustment,
and asserts both menus remain open; it shows opaque readable menus. CDP menu
images retain device pixels (1.25× the stated CSS viewport). No CSS override
from the diagnostic probes is part of the implementation.

## EOL boundary and offset audit

`MdxBufferSource` owns raw source and the loaded separator for a buffer lifetime.
CodeMirror retains its normal LF internal document coordinates; only external
source boundaries convert. Untouched source is never reconstructed. A real
mixed-EOL edit uses the dominant separator (CRLF wins ties); ordinary CRLF/LF
edits preserve their loaded separator. MainEditor keys the MDX editor by path.
Load/sync transactions carry `syncMdxSource`, so they do not echo as user edits.
The listener still emits any real doc-changing transaction, including when a
batch also contains synchronization. Dirty equality, save queue, transactional
navigation, missing-file handling and main write code are unchanged.

| Consumer | Coordinate contract / verification |
| --- | --- |
| Selection / active outline | `buildEditorSelectionSnapshot` converts from/to/head to raw source offsets; line/column still uses CM lines. CRLF round-trip and second-heading selection assertions pass. |
| Reveal source range | Raw knowledge ranges convert through `sourceOffsetToEditor` before dispatch in MdxEditor. No shared range-type change. |
| Outline click / reveal line | `findHeadingLine` splits `/\r?\n/`; numeric line navigation uses `doc.line`. No byte offset arithmetic. |
| Go to definition / registry hover / diagnostics | Syntax scanning and decorations consume `state.doc.toString()` and return CM-internal positions. No external CRLF offsets enter these operations. |
| Find / replace / formatting / Live decorations | CM transactions and syntax positions remain LF-internal. Formatting/paste/history serialize through the buffer boundary. Insert snippet is normalized before calculating the new anchor. |
| Saved editor view state | CM selection/view-state capture and restore remain CM-to-CM; no conversion is appropriate. |
| Reading highlight | `applyPreviewHighlight` slices raw source at compiler-provided raw positions; it inserts/removes inline `==` only and rejects multiline selections. Existing EOL is not rewritten. |
| AI selection | Line/column remains CM line-relative; selected text is sliced from exact raw source. Existing approval pipeline is unchanged; no load/sync annotation is attached to real editor commands. Live provider approval/write is not E2E-tested here. |
| Word count | Frontmatter stripping first normalizes CRLF; LF/CRLF metrics are equal in the regression test. |

Production DNS cycles cover mounted Source and Live, Reading→Live→Source→Reading,
and waiting beyond autosave debounce. Byte comparison, unchanged mtime and a
MutationObserver recording zero unsaved states corroborate no unintended write;
the pure regression tests also assert no synchronization transaction is needed.
The real edit expands 36,753 to 36,777 bytes with no lone LF. The status check
then opens `interactives/react-counter/manifest.json` and reads its own cursor.

## Contrast

Computed sRGB contrast follows the GOAL-40 approach, compositing alpha background
layers. Samples include visible enabled text and nontransparent control borders
(including Windows fractional 0.8px rendering of CSS 1px). Hidden/inert/disabled
controls, decorative aria-hidden glyphs, editor code, note/hover paper and iframe
content are excluded; they are not claimed as chrome AA measurements.

| Theme | Text minimum | Control boundary minimum |
| --- | --- | --- |
| Light | **4.6711:1** | **3.2834:1** |
| Dark | **5.4285:1** | **3.6516:1** |

No sampled enabled value falls below 4.5/3.0. Raw:
`.tmp/goal41/contrast-raw.json`, `contrast-populated-raw.json`,
`contrast-menu-raw.json`; combined `contrast-summary.json`. Native range/check
control internals are visually reviewed, not claimed as DOM border measurements.

## Graph and motion

At 1440×900, measured canvas before AI is **620×739px**, node bbox
**420.23×603.35px** (67.8% width, 81.6% height). With AI it is **550×739px**,
navigator collapsed, bbox **388.22×547.21px** (70.6%, 74.0%). Initial randomized
topology placement still varies; component packing removes the former large
central gap while preserving intra-component positions and orphan semantics.
All shown labels in this probe, including the orphan label, render at **11px**.
Toggling AI causes **zero layout starts**, and all node positions compare equal.
Resize fits the existing positions rather than randomizing them.

Regression tests cover the 760px container threshold, supported zoom label
floor, deterministic nonoverlapping packing, and identical adapter inputs not
rerunning layout. Existing topology, orphan and graph security tests pass.

The production motion probe observes `chrome-enter` / `chrome-exit` at **150ms**,
zero animations under reduced-motion emulation, and zero animations on document
content during Source/Live/Reading switches. Presence retains closing payloads
and makes them inert. Radix owns modal/menu presence; custom palettes, hover,
toasts and tree menus retain their own closing surfaces. Dock content exits
before its existing track closes; grid widths are not interpolated. Document
open/view content has no transition class or artificial delay. Runtime timing
was sampled on the palette, not every individual overlay; the common CSS/source
contract covers the rest.

## Production performance — failures retained

Runs were sequential, without competing app audits/build/test jobs. Original
GOAL-39 and GOAL-34 scripts were not edited. Disposable Welcome fixtures were
refreshed to the authorized real-MDX note; the H1 endpoint is still exactly
Welcome. Every series below has n=10. Clocks/budgets are unchanged.

| Metric | Observed ms | Budget ms | Result |
| --- | --- | --- | --- |
| Cold visible frame, process-spawn relative | **1721.1 median** | ≤1500 | FAIL |
| First small, trusted event→text + one rAF | **81.2 median**, p90 109.2 | ≤60 | FAIL |
| First DNS, same clock | **277.6 median**, p90 333.1 | ≤250 | FAIL |
| Warm small | 50.3 median | ≤60 | PASS |
| Warm DNS | 76.7 median | ≤100 | PASS |
| DNS Reading edit | 121.4 median | ≤150 | PASS |
| Source key | 12.7 p90 | ≤16 | PASS |
| Live key | 9.6 p90 | ≤16 | PASS |
| Graph shell | 65.4 median | ≤100 | PASS |
| Graph populated/interactive | 337.8 median | ≤400 | PASS |
| Graph reopen interactive | 176.6 median | ≤200 | PASS |

Commands/raw evidence:

- `python .tmp/goal39/perf-event.py goal41`:
  `.tmp/goal39/perf-event-goal41.json`, `.tmp/goal41/perf-event.log`.
  Diagnostic two-rAF first/warm small/DNS medians: 91.8/357.1/54.7/83.9ms.
  No-op one/two-rAF floor: 4.7/10.8ms. Observer cold median 2006.0ms is
  **not** substituted for the process-relative visible-frame clock.
- `python .tmp/goal34/perf.py goal41`:
  `.tmp/goal34/perf-goal41.json`, `.tmp/goal41/perf-key.log`.
  Raw observer first/warm small/DNS: 115.2/390.4/87.7/103.1ms;
  cold 2058.1ms; palette/finder 9.2/13.3ms. These are not event-clock targets.
- `$env:PHASE='goal41'; python .tmp/goal39/waterfall.py`:
  `.tmp/goal39/waterfall-goal41.json`, `.tmp/goal41/waterfall.log`,
  `cold-visible-summary.json`. Derivation is performance time origin +
  `g39:welcome-visible-frame` minus process spawn wall-clock timestamp.
- `python .tmp/goal41/graph-event.py` (GOAL-39 harness, only output base changed):
  `.tmp/goal41/graph-event.json`, `perf-graph.log`.
  Graph immediate-use maxima: shell 82.8ms, populated 443.1ms, reopen 223.5ms;
  passing medians do not imply every sample is within budget.

The misses are not excused as machine noise or relabelled as passes. This run
does not isolate their cause with a controlled HEAD A/B. Follow-up must profile
and repair renderer latency with these clocks, without relaxing the budget or
delaying document visibility. If main-process changes are needed, replan first.

## Gates and exports

| Command | Result / evidence |
| --- | --- |
| `bun run typecheck` | PASS, all three projects; `.tmp/goal41/typecheck-final.log` |
| `bun test` | **543 pass, 0 fail, 4,271 assertions, 126 files**; `.tmp/goal41/tests-final.log` |
| Security tests | Unchanged and passing in full suite; no security-test edits |
| GOAL-19/36 export tests | Passing in full suite, including CSS coverage and 60KB budget; shared export Button unchanged |
| `bun run build` | PASS; `.tmp/goal41/build-final.log` |
| `bunx biome check <67 changed/added TS/TSX/CSS files>` | Exit 0, no errors; one existing `noDescendingSpecificity` warning in locked hover-paper CSS; `.tmp/goal41/biome-final.log` |
| `bunx biome check src --max-diagnostics=none` | **223 errors**, one warning, versus 232 baseline errors; `.tmp/goal41/src-lint-final.log` |
| `bun run lint` | FAIL; final retained total below. `.tmp`/dispatch/generated evidence is still scanned; no cleanup or exclusions added |

Repository lint snapshot: **61,154 errors, 124,674 warnings, 1,334 infos**, 1,525
files (`.tmp/goal41/lint-final.log`). Artifact generation makes this count grow;
it is not a source-only regression measure. GOAL-40 ≤375 remains open. Changed
files have no new errors; source errors decreased by nine. The single CSS warning
already existed at the locked paper selectors, so they were not restyled merely
to silence it.

Real built-app exports and offline-open evidence:

- DNS: **static and interactive PASS**, H1 present offline, no page errors.
- Welcome: supplementary **static and interactive PASS**; valid unchanged quiz
  options use Lora with `text-transform: none`; interactive answer works offline.
- **Original QuizBlock Demo: BLOCKED in both modes.** Its line-21 deliberate
  invalid-props example has one option and `answerIndex={3}`. The app correctly
  rejects export: `QuizBlock.options: Too small: expected array to have >=2 items`
  plus the answer-index issue. `.tmp/goal41/quiz-blocker.json` records both modes.
  Neither the excluded note nor validation was changed. Welcome is additional
  evidence, **not** a replacement pass for the specified Demo.

Harness/evidence: `.tmp/goal41/finish-audit.py`, `audit-accepted.log`,
`audit-results.json`, `.tmp/goal41/*-static.html` / `*-interactive.html`;
offline screenshots are under the screenshot
root. Captured production `pageerror` list is empty. The export criterion remains
unchecked until a valid fixture is authorized or the intentional invalid example
is split out in a follow-up.

## Self-review repairs and remaining limits

- Fixed graph clipping after dock resize; packed disconnected components and
  preserved positions on unrelated renders.
- Removed remaining serif/mono prose leaks in panel mentions, Settings About and
  hover-wrapper errors while retaining real paths/code and locked inner paper.
- Fixed dark confirm-action text contrast without changing the shared export
  Button. Corrected definition-close and keybinding control boundaries, and
  removed highlighted menu-shortcut alpha after measuring 3.45:1 in light mode.
- Retained closing form/overlay payloads; repaired tree-menu viewport clamping
  and focus return. Reduced motion now disables animations rather than leaving
  a nominal 0.01ms animation object.
- Normalized snippet EOL before anchor arithmetic; added undo/redo and graph
  packing regression coverage. Existing menu tests only change sentence-case
  labels; routing assertions remain. Outline's former visible-title assertion
  now asserts the preserved accessible name, not removed coverage.
- Final functional gates ran after the last implementation edit. Subsequent
  changes are verification records/harness diagnostics, not production code.

No claim is made of live-provider AI approval/write or AI-generated multiline
EOL behavior. AI selection coordinates are audited/tested; its main approval
pipeline is unchanged. Cold/first-open budgets and exact Demo exports are the
remaining acceptance blockers, not silently waived limitations.
