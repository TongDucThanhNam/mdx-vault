# GOAL-32 verification — Zed-grade single-pane Reading UX

Visual checks used Electron via Playwright CDP against a disposable copy of `example-vault`, not the tracked example notes. The generated copy was moved out of the repository after capture so it would not affect repo-wide lint. Screenshot pairs are interaction states in the implemented build, not pre-change baseline captures.

| Criterion | Evidence |
| --- | --- |
| R1 | `tests/reading-ux.test.tsx` covers pending/failure retention, note reset and active/queued supersession; `tests/mdx-preview-performance.test.ts` keeps cache deduplication. `.tmp/screens/goal32-compile-before.png` → `goal32-compile-after-error.png` shows DNS prose retained under a line-linked error bar. |
| R2 | `tests/reading-ux.test.tsx` maps heading, paragraph, list, code and island positions. `.tmp/screens/goal32-dns-edit-at-position.png` shows Alt+click on the DNS heading placed the Live cursor at line 136; link clicks remain separate. |
| R3 | `tests/reading-ux.test.tsx` tests source/viewport anchor selection. `.tmp/screens/goal32-dns-after-return.png` shows return to the same section (`scrollTop ≈ 4782`); a Reading→Source check matched expected line 22, and a cold tab switch restored `scrollTop` 4000→4000. |
| R4 | `tests/preview-images.test.ts` checks remembered intrinsic ratio; `tests/sandbox-height.test.ts` covers the 260px pending slot, 120px intrinsic probe, and post-resize height. `.tmp/screens/goal32-image-ready.png`, `goal32-interactive-after.png` and `goal32-mermaid-ready.png` show image, sandbox and diagram slots. In Electron the interactive iframe and its slot settled to 120px after the first resize. CSS scroll anchoring and motion-safe height transitions remain in the renderer. |
| R5 | `tests/reading-ux.test.tsx` verifies registry entries use an island boundary and its named inline fallback renders between sibling prose with a reveal action. `.tmp/screens/goal32-island-error-inline.png` captures an actual trusted `Counter` render throw: both sibling paragraphs remained visible. The throw was a temporary local visual-test patch and was reverted before final checks; the existing whole-note boundary remains. |
| R6 | `tests/reading-ux.test.tsx` enforces the 12px CSS floor and preserved GFM footnote landmarks/fragment back-links. `.tmp/screens/goal32-footnotes-before.png` → `goal32-footnotes-after.png` shows the final ruled paper treatment; print rules use ink. |
| R7 | `tests/action-registry.test.ts` checks all default chords and collision/reserved policy. In Electron, Alt+Down, PageDown, Alt+PageUp and Ctrl+Alt+V navigated/toggled Reading; status showed mode and Updating/Compile issue/Ready. `.tmp/screens/goal32-chrome-light.png` → `goal32-chrome-dark.png` confirms paper/chrome separation. |

`bun install --frozen-lockfile` and the existing Electron installer restored the missing executable without changing `bun.lock` or `package.json`. `bun run dev --remoteDebuggingPort 9223` then launched. The disposable vault allowed a compile-error injection without touching tracked notes.

## Follow-up visual review

- `.tmp/screens/goal32-compile-after-error.png` was recaptured with a wrapping message and a 28×28px dismiss action beside the 75×28px line action. Both share the same compact styling.
- `.tmp/screens/goal32-interactive-after.png` was recaptured after the sandbox height fix; the iframe and wrapper each measured 120px after a validated resize, rather than retaining the 260px pending reservation.
- The diagonal dashed marks in the earlier footnote capture also appeared under an unrelated short island note, with no covering DOM element or CSS graphic. Disabling `overflow-anchor` did not change them; a temporary compositor-layer refresh cleared them. This points to a stale Electron raster, not the GOAL-32 footnote styles. No persistent CSS transform was added because it would alter fixed-position preview controls. The recaptured `.tmp/screens/goal32-footnotes-after.png` is clean; the layer refresh was capture-only.
- `.tmp/screens/goal32-island-error-inline.png` provides the previously missing live R5 evidence. No throw hook remains in shipped code.

Final checks: `bun run typecheck` passed; `bun test --parallel=4` passed (481 tests across 109 files); security-focused tests passed (24 across five files); `bunx biome check` passed on all 37 created or modified files; `git diff --check` passed. Repository-wide `bun run lint` remains failing but improved from the known pre-existing baseline of 456 errors (`.tmp/lint-baseline.log`) to 430 (`.tmp/lint-followup.log`). No `src/main`, `src/preload`, `package.json`, or `bun.lock` changes were made.
