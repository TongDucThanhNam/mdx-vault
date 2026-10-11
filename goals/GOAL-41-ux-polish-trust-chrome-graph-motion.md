# GOAL-41 — UX polish: trust, chrome, graph and motion

**Status: PARTIAL — implementation committed; performance and exact-fixture export acceptance remain open.**

## Outcome

Preserve note bytes and cursor ownership; unify calm workbench chrome while
retaining editorial paper; improve graph readability and restrained motion.

## Dependencies

GOAL-40. Preserve GOAL-19/36 export fidelity, GOAL-37 independent dock tracks,
GOAL-39 latency budgets and all security contracts.

## Constraints

- Renderer code/CSS, DESIGN, tests and verification records only, plus the
  explicitly authorized rewrite of `example-vault/notes/Welcome.mdx`.
- No main, IPC, preload, shared schema, CSP, sandbox, permission or dependency
  changes. If required, stop with BLOCKED (REPLAN), including evidence.
- Preserve exact `content !== savedContent` dirty semantics, transactional
  navigation, save queue, missing-file protection and the main write path.
- Keep per-buffer EOL (dominant separator for mixed input; CRLF wins ties).
  Untouched mixed input also remains byte-identical until an actual edit.
- Preserve source/CodeMirror coordinate contracts, history and legitimate edits.
- Note tokens, prose/hover paper, trust frames and export output remain locked
  except the specifically authorized note-content typography improvements.
- Chrome uses Atkinson, sentence case, 1px rules, 4–6px surface radii, 2–4px
  controls, soft overlay-only shadows and tinted selection. AA text/boundaries.
- Only the Context selector titles the dock; preserve panel accessible names,
  counts and actions. Preserve titlebar vault routing/accessibility contracts.
- Graph topology, filters, schema, orphan/unresolved/ambiguous semantics and DOM
  navigation stay intact. Adapt navigator to container width, not viewport.
- Motion is 120–200ms ease-out, reduced-motion-safe, never on document content
  or document grid widths. Never delay focus or first readable content.
- No repository-wide formatting or temporary-artifact cleanup to improve lint.
  Never stage `.agent-dispatch/` or `.zcode-dispatch/`.

## Success Criteria

- [x] **Trust:** mounted Source/Live and Reading cycles preserve untouched CRLF
  bytes, dirty state and no-save behavior; edits preserve EOL; LF unchanged;
  correct selection/outline offsets and EOL-independent word count.
- [x] **Status:** cursor belongs to active document, including authoring editors;
  unit and real-app note-line-8 → manifest regression checks.
- [x] **Welcome:** real MDX headings/emphasis/code/list/quote, H1 exactly Welcome,
  unchanged QuizBlock and other island intents; outline and quiz verified.
- [x] **Chrome:** every discovery inventory surface migrated and self-reviewed
  in light/dark at 1440×900 and 1100×720; screenshots and anti-regression test.
- [x] **Contrast:** measured ≥4.5:1 text and ≥3:1 controls in both themes.
- [ ] **Note type/export:** sentence-case readable options/feedback/captions and
  loading/error prose; GOAL-19/36 tests and real offline DNS/Quiz exports in both modes.
- [x] **Graph:** responsive navigator; canvas ≥480px or navigator collapsed with
  AI open; shown labels ≥11px screen size; compact fit with bbox evidence;
  unrelated rerenders do not relayout; old and new tests pass.
- [x] **Motion:** overlays enter/exit ≤200ms, dock/selection feedback; reduced
  motion disables animation and document content is never animated.
- [ ] **Performance:** GOAL-39 event harness n=10 meets all medians; GOAL-34
  Source/Live key p90 ≤16ms; raw values retained.
- [x] **Gates:** typecheck, all tests (528 baseline + regressions), unchanged
  security tests, build, changed-file Biome pass; lint totals reported honestly
  and src errors ≤232. GOAL-40 repository ceiling remains open.
- [x] **Records:** DESIGN, README dependency row and verification before/after
  evidence complete; reviewed changes committed conventionally with GOAL-41.

## Execution Plan

1. EOL/offset and cursor fixes with regression tests.
2. Welcome rewrite, shared primitives/tokens, then all chrome surfaces.
3. Single context header and vault selector; scoped note typography.
4. Responsive/readable/stable graph, then motion without document transitions.
5. DESIGN and verification records; production screenshots, contrast, export,
   performance and gates. Review final diff, fix findings, rerun affected checks.
6. Commit passing work only with any remaining failure explicitly recorded.

## Verification and limitations

See `docs/verification/goal-41-ux-polish.md` and
`.tmp/screens/goal41/`. Baseline: 528 tests pass, typecheck passes, repository
lint 8,771 errors including 232 source formatting errors. Discovery packet:
`.agent-dispatch/run-1791730329569-9e9b206f/worker-report.md`.

### Explicitly open acceptance (passing work committed under brief §11)

- **Performance FAIL:** production n=10 first-small median 81.2ms (≤60),
  first-DNS 277.6ms (≤250). Separate instrumented cold visible-frame median
  1721.1ms (≤1500). Budgets are unchanged. Warm opens, DNS edit, Source/Live
  key p90 and graph medians pass. See the verification table and raw samples.
  Full completion needs a renderer performance investigation/repair with the
  same clocks; any required main-process work needs an explicit replan.
- **Exact QuizBlock Demo export BLOCKED:** both static and interactive export
  reject its deliberate invalid example (`options` has one entry and
  `answerIndex={3}`, line 21). The excluded fixture and validation are unchanged.
  DNS exports pass both modes; supplementary Welcome exports demonstrate the
  unchanged valid quiz offline in both modes. These do not replace the required
  fixture. Smallest resolution: authorize a valid export fixture or splitting
  the deliberate-invalid example in a follow-up.
- Changed-file Biome exits zero with no errors; the pre-existing warning in
  locked hover-paper CSS remains. Source errors are 223 versus baseline 232;
  repository lint remains failing. No temporary artifacts were removed.
- No live AI provider request was made. AI screenshot content is a synthetic
  UI fixture; provider approval/write and provider-generated newline behavior
  are not claimed as end-to-end verified.
