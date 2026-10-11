# GOAL-40 — Live readability and render craft

**Status: IMPLEMENTED; acceptance blocked by the repository lint ceiling.**

## Outcome

Live reads like Source with syntax quietly folded away. Fix the leaked chart
legend marker and the excessive closed static-export disclosure spacing.

## Dependencies

GOAL-38 and GOAL-39; preserve GOAL-32–39 behavior and latency.

## Constraints

- Single pane. Reading follows the theme with a light option; export and print
  remain light. Untrusted sandbox islands retain their light card.
- No IPC, preload, security, CSP or sandbox changes, dependencies, commit or
  edits to `example-vault/`. Disposable fixtures and exports live under `.tmp/`.
- Styling only: preserve heading sizes, fonts, line metrics, hidden/revealed
  syntax behavior, atomic ranges, navigation, history and scroll restoration.
- Main/export implementation changes are authorized only for disclosure spacing;
  this implementation needs no main-process changes.

## Success Criteria

- [x] **T1, treatment:** Source owns Live's base plane and token highlighting.
  Decorations contain no literal colors. Bold is foreground/600; inline code is
  a quiet chip; links are blue, unresolved links are muted/dashed; quote marks
  and revealed delimiters are muted. Typed callout markers keep AA colors.
- [x] **T1, geometry and layers:** headings retain their existing metrics while
  sharing Source's wrap edge and ruler; translucent callout, math and Mermaid
  treatments leave selection/search visible. A separate transparent active-line
  overlay survives callout tints.
- [x] **T2, isolation:** zero-specificity prose guards exclude trusted base
  registry boundaries and the owned `in-*` kit namespace. The legend pseudo
  marker disappears; PrimerTerm's existing underline is explicitly kit-owned.
  Reading, safe hover summaries and both built exports are investigated.
- [x] **T3, disclosure:** closed native/static disclosures hug a centered 44px
  summary; open disclosures retain body spacing. Both papers and both real
  production export modes are checked, without running ExportService under Bun.
- [ ] **Acceptance gate:** complete the required visual/contrast/latency evidence,
  typecheck, full tests, unchanged security tests, build, changed-file Biome and
  repository lint **≤375 errors**. Implementation checks are recorded separately;
  the repository gate cannot be marked passed while lint exceeds the ceiling.
- [x] **T4, records:** DESIGN, this goal, the dependency row and verification
  record describe the implementation and explicitly retain the unresolved gate.

## Execution Plan

1. Capture HEAD theme precedence and light/dark baselines in a disposable vault.
2. Replace Live-only styling with shared tokens; correct wrap geometry and layering.
3. Scope prose selectors and balance disclosure states in the shared note stylesheet.
4. Add regression contracts, build and capture production evidence, self-review
   the final diff, fix findings and rerun affected checks.
5. Record exact results and blockers; do not commit or suppress diagnostics.

## Verification and limitations

See `docs/verification/goal-40-live-readability-and-render-craft.md` and
`.tmp/screens/goal40/`. The discovery packet's 375-error lint baseline does not
reproduce in this workspace: unchanged generated HTML in older `.tmp` vaults
alone exceeds the permitted total. Those prior artifacts and the ignore/test
configuration are not modified to manufacture a passing count.
