# GOAL-36 verification — registry export fidelity

## Outcome and scope

Built Electron exports now render a light, offline edition with scoped utility styles for the five legacy registry components: Counter, QuizBlock, EquationSlider, DataChart and AlgorithmVisualizer. The remaining 17 entries—NotePrimer, PrimerTerm, HighlightBox, FormulaLine, MentalModel, MentalModelRow, TraceBlock, WidgetFrame, PredictionGate, Recap, SelfTest, SelfTestItem, EvidenceLog, EvidenceItem, ComparisonBars, CellGrid and FlowSequence—retain their shared `in-*` note stylesheet. The 22-entry registry and the `in-*` source-to-selector coverage are asserted in `tests/goal36-export-registry.test.ts`. Export-IR assembly fixes keep inline trusted JSX after a Markdown table from being absorbed into generic HTML, and unwrap JSX-only paragraphs with whitespace between block islands; these restored FormulaLine's identity and valid PrimerTerm hydration markup in the kit fixture.

The export-only Tailwind v4 entry scans `islands/`, `Counter.tsx` and the shared Button source, with no preflight or app-wide CSS. It is compiled by the main build, inlined, and its selectors are prefixed with `:where(.mdx-vault-export)`. Tailwind's `@layer` order stays intact; `@property` registrations stay top-level; even the custom-property initialization selectors in `@layer properties` are prefixed. This avoids browser dependence on CSS `@scope` without hand-copying component rules. The limited theme tokens are compiled inline, so main does not run Tailwind when a user exports a note.

The [CSS Cascade 6 draft](https://drafts.csswg.org/css-cascade-6/#scoped-styles) notes that global name-defining at-rules inside `@scope` are valid but not themselves scoped; the [CSS Cascade 5 layer rules](https://drafts.csswg.org/css-cascade-5/#layering) define ordering by first declaration. Keeping the compiled layer order and top-level registrations while prefixing only qualified selectors avoids relying on nested at-rule behavior.

| Embedded export stylesheet | Bytes (UTF-8) |
| --- | ---: |
| Before GOAL-36 (`.tmp/goal35/registry-export.html`) | 1,816,512 |
| After prefixed utility entry and follow-up polish | 1,833,758 |
| Increase | **17,246** (under 60 KiB budget) |

Both values measure the HTML `<style>` content and include the existing inlined note fonts and KaTeX. The additional bytes include prefixed Tailwind selectors, the single document notice, and sandbox card styling.

## Browser and print evidence

`python scripts/verify-goal36-export.py` passed against built Electron with a disposable vault copied from `example-vault/`. The copy was moved out of the repository after the run so repository lint still measures source, not generated vault contents. Evidence: `.tmp/goal36/browser-evidence.json`; exports: `.tmp/goal36/{static,interactive,dark-paper-interactive,kit-static,kit-interactive}.html`; screenshots: `.tmp/screens/goal36/`.

At 1920×1080, the screenshot set includes `reading-{quiz,chart,equation,algorithm,counter,sandbox}.png`, `interactive-export-{quiz,chart,equation,algorithm,counter,sandbox}.png`, `static-export-{quiz,chart,equation,algorithm,counter}.png`, matching full-page captures, and `dark-paper-export-*.png`. The close-ups were corrected during self-review to center each component, rather than accidentally repeating adjacent viewport screenshots. `app-print.png` and `app-print-sandbox.png` capture Electron print media with a real approved `iframe[sandbox="allow-scripts"]`; `export-print.pdf` is the Chromium print of the static HTML.

The second fixture is a disposable copy of the canonical Cache Hierarchy note, with its two custom sandbox examples replaced by prose and one FlowSequence added. Its original PrimerTerm markup is unchanged. It exercises all **17** interactive-note registry entries. `reading-kit-<Component>.png`, `static-kit-<Component>.png` and `interactive-kit-<Component>.png` provide per-component 1920×1080 captures; both kit exports opened via `file://` with zero console errors/CSP violations. There are **82 PNG screenshots and one PDF** in total.

| Assertion | Observed |
| --- | --- |
| DataChart export | SVGs present; responsive box **664×260px**; four Cartesian axes; visible legend and hovered tooltip |
| QuizBlock export | 2px card border, 16px padding; clicking option changes `aria-checked` to `true` |
| EquationSlider export | Range inputs visible and result/mini chart legible |
| Static export | Five legacy policy cards and **one** quiet document-level snapshot notice; chart data and equation values in ruled tables |
| Sandboxed Counter | Validated resize message gives an **80px** content-fit iframe; 2px frame border and 3px hard offset shadow |
| CSS scope | A test element with `h-72` outside the exported article remains **0px** high |
| Dark-theme export and print | Screen Reading paper `rgb(23, 33, 42)`; export body and printed Reading paper both `rgb(249, 249, 247)` |
| Offline / CSP | All three `file://` exports recorded **zero console messages, page errors and CSP violations**; approved custom Counter remained in `allow-scripts`-only iframe |

The custom Counter manifest has no image fallback, so static export reports one explicit warning and renders a descriptive offline card. Interactive export runs the approved sandbox without a skip or fallback. Electron's CDP endpoint does not implement `Page.printToPDF`; app print was verified with `emulateMedia('print')` plus screenshot, while the static export was printed to PDF in headless Chromium. Playwright Firefox and WebKit executables are not installed: **NOT CHECKED**. Their absence is recorded in `browser-evidence.json`; the non-`@scope` selector-prefix output and nesting tests provide a compatibility fallback, but are not a substitute for browser runs.

Self-review fixes: supplied minimal spacing/type/breakpoint tokens; bounded the Tailwind scanner to `islands/`, Counter and Button; added a DataChart legend; repaired export-IR inline JSX and JSX-only paragraph handling; then replaced repeated static notices with one document notice, made the sandbox content-fit using the Reading height policy, replaced `@scope` with explicit prefixed selectors, and waited for iframe content before the full-page capture. The initial lint run included disposable vault/profile copies; only generated copies were removed from the workspace before the repository lint command.

## Checks and invariants

| Command | Result |
| --- | --- |
| `bun run typecheck` | Passed |
| `bun test --parallel=4` | **510 passed, 0 failed**, 117 files; nine GOAL-36 tests |
| `bun run build` | Passed; existing Vite import/eval warnings only |
| `bunx biome check <changed TS/TSX/CSS files>` | 0 errors |
| `bun run lint` | Exit 1 at **384 pre-existing errors, 7 generated-export size warnings**; under the ≤387 cap; changed files clean |
| `python scripts/verify-goal36-export.py` | Passed; recaptured full pages and sandbox; `file://`, print, layout, interaction, scope and console evidence |
| `git diff --check` | Passed |

Both CSP strings are asserted by exact equality in tests and unchanged in the source diff. No remote URL, `connect-src` relaxation, new `allow-same-origin`, or new `dangerouslySetInnerHTML` was introduced. `package.json`, `bun.lock`, preload, `docs/security.md` and `example-vault/` are unchanged. Security tests run as part of the complete 510-test suite.

The changed `src/main` files are `services/export-template.ts` (inline prefixed registry CSS, single static notice, sandbox card), `services/export-registry-style.ts` (prefix compiled selectors while preserving at-rules), `services/export-static-snapshot.ts` (remove repeated card notices), `services/export-bundler.ts` (reuse Reading's height policy in the existing validated sandbox message path), and `services/export-ir.ts` (keep inline trusted JSX separate and unwrap JSX-only paragraphs). No permissions, IPC, or sandbox bridge code changed. `DataChart.tsx` adds the missing legend without changing its height contract; its existing `h-72` class resolves in export.
