# GOAL-36 — Registry island export fidelity

## Outcome

Static and interactive HTML exports are a light, offline printed edition of the Reading note. Every trusted registry island has its required styling; static policies identify themselves as snapshots rather than pretending to be live controls.

## Dependencies

GOAL-26, GOAL-28, GOAL-35.

## Constraints

- Keep both export CSP strings exactly unchanged; no remote URLs or `connect-src` relaxation.
- Keep custom islands in `iframe[sandbox="allow-scripts"]` only; no new IPC, preload, dependencies, or security-model change.
- Export and print stay light even if Reading follows dark theme and dark paper.
- Preserve the single pane, last-good Reading, `translateZ(0)` scroll surface, portaled fixed UI, and content-fit island height.
- Do not edit `example-vault/` or commit.

## Execution

- **E1:** Compile a bounded Tailwind v4 utility entry during the main build from only legacy registry/island sources and shared Button. No preflight or app bundle is embedded. Prefix the compiled selectors with `:where(.mdx-vault-export)` so arbitrary browsers do not require CSS `@scope`; keep `@property` registrations top-level and `@layer` ordering intact. The existing note stylesheet continues to own prose and `in-*` classes. The dedicated inline theme defines only utility tokens needed by these islands. A hand-copied ruleset was rejected because it would drift when component class names change.
- **E2:** Give DataChart its compiled height and display a legend alongside axes/tooltip. Keep QuizBlock, EquationSlider, AlgorithmVisualizer, and Counter styled. Put one quiet document-level snapshot notice above the note when static islands are present. Fit the custom sandbox frame to its validated content-height messages using Reading's reservation and oscillation guard.
- **E3:** Verify app print under dark theme with the approved sandboxed Counter and light note paper; verify a self-contained export PDF.
- **E4:** Add source-to-selector and CSP/scoping tests plus built Electron/file:// Chromium parity evidence.
- **E5:** Record results and limitations in the verification document.

## Success Criteria

- [x] E1: Export-only utility CSS is bounded, scoped to the export article, and adds no more than 60 KiB uncompressed.
- [x] E2: All 22 registry entries have a styling path; DataChart's SVG has nonzero height; QuizBlock, EquationSlider, AlgorithmVisualizer, Counter, and static snapshots are legible.
- [x] E3: App print and export PDF are light, with a styled sandboxed Counter or explicit fallback.
- [x] E4: Typecheck, 501+ Bun tests, build, changed-file Biome, lint cap, browser screenshots, file:// console/CSP, and security invariants are checked.
- [x] E5: The verification ledger records sizes, evidence, decisions, and limitations.

## Verification

See `docs/verification/goal-36-export-fidelity.md`.
