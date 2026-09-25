# Editor readability and typing verification

Date: 2026-09-05. Goal: GOAL-27 follow-up. No user vault used for destructive
fixtures; all typing/save tests ran in generated temporary vaults with a separate
Electron user-data directory. Existing unrelated worktree changes were preserved.

## Checks

- Typecheck and lint passed after each implementation tranche.
- Full `bun run check`: passed; 472 tests across 107 files, 0 failures.
- `bun run build`: passed for main/preload/renderer. The first build exposed
  the worker IIFE/code-splitting mismatch; ES worker output corrected it.
  Existing dependency warnings remain (mixed static/dynamic imports and
  gray-matter's bundled eval-capable engine); this change does not enable that
  engine for editor analysis or relax the security policy.
- Real Electron interaction check: passed, no captured page errors.
- The complete interaction harness also passed against the built production
  app on CDP 9334, not only the dev server.
- Source and Live: JetBrains Mono, 15px text/gutter, 24px line height, 0px
  horizontal overflow for the short source fixture.
- Appearance: same editor instance, unchanged source and selection after
  applying Comfortable; labelled popover accessible at 800px and 1440px widths.
- Repeated arrow keys in the spacing slider keep focus, persist 1.70, and can
  return to Comfortable's 1.60 without replacing the buffer.
- Tab at column 5 inserts three spaces to column 8 without moving the whole line.
- Enter between braces uses four spaces when four is selected; CRLF is retained.
- `<Qui` → Ctrl+Space → Tab yields `<QuizBlock />`; one undo restores `<Qui`.
- Multi-cursor soft tabs, selected-line indent/outdent and read-only behavior:
  unit tests passed.
- Vietnamese committed text, Ctrl+S/autosave and disk content equality: passed.
- Typing after returning to a tab retains its new caret after the delayed
  restoration window. Deferred scroll restoration also has a unit regression.
- Math block ranges survive ordinary insertion and disappear when the opening
  delimiter becomes plain text: passed in Electron.
- Worker tests: lazy startup, bounded latest-wins queue, out-of-order IDs,
  termination, failure/recovery and oversized input all pass.
- Syntax parser reports an invalid brace offset without evaluating expressions
  or resolving the test's missing local module.
- Built `file://` renderer worker smoke check: Outline returns a heading, MDX
  diagnostics return a malformed-brace offset, the existing preview compiler
  returns code, and the TypeScript worker initializes and reports TS2322.

## Reproduce

Start an isolated dev app with `MDX_VAULT_TEST_USER_DATA` set to a disposable
directory and `bun run dev --watch --remoteDebuggingPort 9333`. Do not connect
these mutation tests to a personal profile. The harness generates its own vault.

```powershell
$env:PYTHONIOENCODING='utf-8'
python scripts/verify-typing-ux-live.py --phase after --output docs/verification/assets/editor-typing-ux
python scripts/verify-typing-ux-live.py --phase after --checks-only --output docs/verification/assets/editor-typing-ux
bun run check
bun run build
```

Python Playwright must be available. The CDP port is optional via `--cdp`.
The retained before trace was captured before implementation; running `--phase
before` against updated code does not recreate the old implementation.

The harness uses the observed CodeMirror internal view handle only for precise
state inspection and fixture setup, never in production application code.
`scripts/profile-editor-typing.py` provides optional CDP CPU sampling; run it
only on the isolated fixture and separately from timing measurements.

For the production worker smoke test, start the built app using the repository's
Electron executable with `.` and `--remote-debugging-port=9334`, again with a
fresh disposable `MDX_VAULT_TEST_USER_DATA` directory, then run:

```powershell
python scripts/verify-editor-workers-production.py --output docs/verification/assets/editor-typing-ux/production-workers.json
```

## Evidence

- [Research, decisions and measurement limits](../research/editor-readability-and-typing-2026-09.md)
- [Before raw result](assets/editor-typing-ux/before-results.json)
- [After raw result](assets/editor-typing-ux/after-results.json)
- [Final interaction regression](assets/editor-typing-ux/after-interactions.json)
- [Production worker regression](assets/editor-typing-ux/production-workers.json)
- [Production interaction regression](assets/editor-typing-ux/production/after-interactions.json)
- [Source before](assets/editor-typing-ux/before-source.png)
- [Source after](assets/editor-typing-ux/after-source.png)
- [Appearance controls](assets/editor-typing-ux/after-appearance.png)
- [Live mode](assets/editor-typing-ux/after-live.png)
- [Dark theme](assets/editor-typing-ux/after-dark.png)
- [800px width](assets/editor-typing-ux/after-narrow.png)
- [Completion](assets/editor-typing-ux/after-completion.png)
- [Vietnamese text](assets/editor-typing-ux/after-vietnamese.png)

Recorded renderer median: 100.6ms → 20.3ms; p95: 309.1ms → 45.9ms on the
5,603-line fixture. This is keydown-to-next-animation-frame in the dev app,
not native IME/physical display latency or a comparison benchmark against Zed.

## User-facing adoption

Open the appearance control (Type icon plus current size) beside Source/Live,
then select Comfortable (Vietnamese: Thoáng). Previously saved font/spacing
choices remain unchanged until the user selects a preset or edits a control.
Reading's typography and interactive-code security policy are unchanged.
