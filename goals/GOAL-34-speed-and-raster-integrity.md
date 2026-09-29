# GOAL-34 — Zed-grade speed and raster integrity

## Outcome

Opening and editing notes feel immediate, Source and Live typing stay within a frame, Reading paper has no diagonal raster marks, and template files do not clutter the graph.

## Dependencies

GOAL-29, GOAL-32, GOAL-33.

## Constraints

- Preserve the single-pane workbench; no split, following preview, or preview tabs.
- Preserve `docs/security.md`: worker MDX compilation, validated registry props, sanitized HTML, sandboxed `allow-scripts` frames without same-origin, bounded IPC, and no new renderer trust.
- Preserve GOAL-32 last-good Reading behavior and source-position navigation.
- Files remain the source of truth; no new dependencies, preload or IPC contract changes, and no changes to `example-vault/`.
- Profile production before changing performance paths. Do not weaken checks or call an unmet target complete.

## Success Criteria

- [x] S0: A repeatable production harness records at least ten samples per specified latency metric, CPU profiles and long tasks before and after.
- [ ] S1: Warm small-note open is ≤60 ms median / ≤100 ms p90; warm DNS open is ≤100 / ≤150 ms; first DNS open is ≤250 ms median.
- [x] S2: Reading edit-to-visible is ≤100 ms median for a typical note and ≤150 ms for DNS, retaining last-good render and worker compilation.
- [x] S3: DNS Source and Live keydown-to-next-frame p90 is ≤16 ms; status count settles within about 300 ms after typing stops.
- [x] S4: Cold process-to-first-Reading-ready improves measurably, aiming for ≤1.5 s, without changing window security.
- [x] S5: Interactive-note navigation and scroll show no diagonal marks in 20 production attempts; sticky status and fixed preview controls remain correct.
- [x] S6: Template-folder files and title-placeholder notes are hidden from graph nodes by default, with a toggle to show them.

## Verification

See `docs/verification/goal-34-speed-and-raster-integrity.md`.
