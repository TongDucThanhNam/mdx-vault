# GOAL-38 verification — night paper, AA contrast and export parity

## Method and scope

Production Electron, 1920×1080 CDP viewport and a disposable copy of `example-vault/` under `.tmp/goal38/vault/` (moved outside the repo after capture). The all-DOM computed-style sweep in `.tmp/goal38/probe.json.gz` (summary: `.tmp/goal38/probe-summary.json`) composites text color and ancestor opacity over computed backgrounds, then applies WCAG relative luminance. It checks every rendered text node in light/dark theme × follow/light paper; selected QuizBlock, visible chart tooltip, hover preview, code, tables, footnotes, callouts and KaTeX are separate states. A non-text boundary is compared to its *adjacent* surface (not its own solid selected fill). The bright-fill sweep reports elements whose own background exceeds paper luminance by **0.04**. The DNS note covers 16 interactive-note registry entries; disposable GOAL-38 Registry covers the other six, so all 22 trusted entries are present. Live CodeMirror decorations do not reference note tokens (`live-note-token-references` is empty); no Reading CSS is imposed on Live.

## Contrast table

Ratios below are composited rendered values where an element is named, or computed directly from literal palette tokens for base ink/fill pairs. “Before” is HEAD CSS or the first pre-repair composited Electron probe; the discovery sweep's uncomposited **3.37:1 dark tab/outline** estimate was not reproduced. Large text uses 3:1; other text uses 4.5:1. Focus and control boundaries use 3:1.

| Element / pair | Theme · paper | Before | After | Result |
| --- | --- | ---: | ---: | --- |
| Primary chrome text on Bench | light · follow/light | 16.71 | 16.71 | AA |
| Primary chrome text on Bench | dark · follow/light | 16.42 | 16.42 | AA |
| Inactive tab / muted label on Chrome | light · follow/light | 5.39 | 5.39 | AA |
| Inactive tab / muted label on Chrome | dark · follow/light | 8.43 | 8.43 | AA; discovery estimate was non-composited |
| Source/Live mode label | light / dark chrome | 6.11 / 8.00 | 6.11 / 8.00 | AA |
| Outline H2 depth marker (70% opacity removed) | light · follow/light | **2.94** | **5.39** | AA |
| Outline H2 depth marker | dark · follow/light | 4.76 | 8.43 | AA |
| Status Saved/Ready | light / dark chrome | 4.96 / 9.09 | 4.96 / 9.09 | AA |
| Paper ink / paper | light · follow/light | 17.91 | 17.91 | AA |
| Paper ink / paper | dark · follow | 13.35 | 13.35 | AA |
| Accent link / paper | light / dark paper | 5.62 / 7.65 | 5.62 / 7.65 | AA |
| Inline code / table-head neutral chip | dark · follow | 13.35 on glaring inverse slab | **11.05** on muted paper | AA, no pale slab |
| FlowSequence accent sublabel | light paper | **3.91** | **5.92** | AA; state-specific opacity removed |
| EquationSlider Result text | dark · follow | **1.75** white on blue | **9.33** dark ink on blue | AA |
| Selected quiz/result badge text | dark · follow | 9.33 | 9.33 | AA |
| Chart tooltip data label | light / dark paper | 6.84 / 9.33 | 6.84 / 9.33 | AA |
| Titlebar control edge vs adjacent masthead | light chrome | **1.43** | **3.05** | non-text AA |
| Titlebar control edge vs Bench | dark chrome | **1.89** | **4.02** | non-text AA |
| Context selector edge | light / dark chrome | transparent / transparent | **3.31 / 3.85** | non-text AA |
| Note focus outline / paper | light / dark paper | **2.35 / 2.91** at 50% opacity | **5.62 / 7.65** | non-text AA |
| Dark note line / paper | dark · follow | 3.45 | 3.45 | non-text AA |

`DESIGN.md` records the token-pair ratios. The `--input` token is `#798593` light and `#667789` dark; against the ordinary Bench these are 3.53:1 and 4.02:1. Focus outlines compute as opaque `#2457FF` / `#8AA3FF` in chrome and `#C02626` / `#FF9489` on note paper. Light note structural `--note-line` remains 1.52:1 because it is a decorative rule rather than the sole state cue; changing it would break light-paper raster parity.

## Luminance and accessibility sweep

The final all-DOM sweep found **zero below-AA text** and **zero below-3:1 interactive boundaries** in all four theme/paper combinations on the covered note states. Dark paper exceeded the 0.04 luminance delta threshold only where the fill carries meaning:

| Dark state | Elements above threshold | Treatment / reason |
| --- | ---: | --- |
| DNS full note | 9 | 5 neutral comparison bars at `#667583` (Δ0.157, 3.45:1 track affordance); 3 accent bad-data bars and 1 accent flow node (Δ0.428, explicit data/state) |
| 22-entry registry, initial | 7 | 3 range tracks at `#667583` (Δ0.157, 3.45:1); Result and Counter blue badges, CellGrid current/hit (explicit state/data) |
| Registry, selected quiz | 8 | The above plus selected-answer/result fill (explicit state); text passes AA |
| Registry, chart tooltip visible | 9 | Selected quiz and tooltip keep explicit state/data fills; tooltip adds no pale neutral surface |
| Prose table/footnote/callout/code/KaTeX; hover preview | **0** | Inline code, table heads, highlight and target heading are muted-paper chips; no light slabs |

The 12px UI-label floor holds in the sweep; chart axes were raised from 11px to 12px and footnote superscripts to 12px. **Exception:** KaTeX's mathematical superscript “2” is 9.68–9.76px and its non-rendering `vlist-s` carrier computes at 1px; these are equation notation, not UI labels, and the visible exponent has 13.35:1 (dark) / 17.91:1 (light) contrast. `prefers-reduced-motion: reduce` yields no computed transition/animation over 0.01ms in the registry including tabs; the global rule also covers panel separators and tab fades. Among 46 rendered registry/chrome controls, none lacked an accessible name. Keyboard focus was visible on tab, quiz button, slider and context selector in both papers; note/chrome outlines were opaque. No screen-reader session was performed.

## Raster, width and export evidence

- `.tmp/screens/goal38/{dark,light}-follow-theme-{dns-top,dns-mid,registry,registry-mid,prose,katex,hover}.png`; `dark-follow-theme-{dns-bars,registry-selected,chart-tooltip}.png`; dark and light chrome are visible with tabs, outline, tree and status bar in the DNS/registry captures. The sandbox demo remained unapproved in the disposable profile; the sandbox trust contract was not changed.
- `.tmp/screens/goal38/{light,dark}-follow-theme-1000-ai-dns.png`: the 420px document's 33.6px H1 is **two lines** (77.3px height), instead of the wide 51.2px display size; body remains 16px. The same token path is inherited only by Reading headings; Live is editable CodeMirror, not rendered headings. Export keeps its light 51.2px path.
- `.tmp/goal38/pixel-diff.json`: at 1920×1080, injecting the HEAD note stylesheet over the built app then removing it changed **0 / 716,875** pixels in the central light DNS and registry note crops; at 1366, DNS changed **0 / 781,625**. Images `*-head-css.png`, `*-after-css.png` and `light-*-pixel-diff.png` are under `.tmp/screens/goal38/`. This proves sampled note-region parity, not whole-window identity.
- `.tmp/screens/goal38/export-{static,interactive}-top.png`: both HTML files have **0** `.mdx-vault-frontmatter` boxes and retain the document H1/header. Static and interactive export runs had 0 warnings and 0 fallbacks; `.tmp/goal38/probe-summary.json` records the page checks. No new properties setting was needed because Reading already hides raw frontmatter.
- `.tmp/goal38/print-probe.json`: Chromium `print` media computed styles for dark Reading and light Reading match exactly on paper, inline code, `mark` and table headers; screen dark code remains a muted chip. This caught and fixed a print-only border regression during self-review.

## Automated checks and security

| Check | Result |
| --- | --- |
| `bun run typecheck` | Pass |
| `bun test --parallel=4` | 517 pass, 0 fail (HEAD 514; discovery baseline 501); includes three new token/frontmatter/palette tests |
| `bun run build` | Pass; pre-existing Vite import and dependency `eval` warnings; log `.tmp/goal38/build-final.txt` |
| `bunx biome check <changed source/test files>` | Pass, 0 errors |
| `bun run lint` | Exit 1: **378 pre-existing errors, 7 warnings**, below HEAD's 380 errors; log `.tmp/goal38/lint-final.txt`. Changed source/test files have 0 Biome errors |
| Security subset | 33 pass, 0 fail across 9 files |
| `git diff --check`; protected-path diff | Pass; no diff in `package.json`, `bun.lock`, `example-vault/` or preload |

The export's metadata map still determines title and interactive-note theme but no longer renders a raw properties box. Export CSP, iframe sandbox attributes, IPC, preload and dependencies were not changed. `package.json`, `bun.lock`, `example-vault/`, and preload have no diff; no new `allow-same-origin` or `dangerouslySetInnerHTML` was introduced.
