# GOAL-28 Verification — Editorial Note Design System

Date: 2026-08-11

## Result

GOAL-28 passes. The note theme now exposes a layered token and authoring
contract while Reading, hover preview and export continue to consume the same
authoritative CSS source.

## Static evidence

- `tests/note-editorial-theme.test.ts` verifies palette, zero-radius/hard-shadow
  invariants, foundation tokens, public primitives, focus, narrow layout,
  reduced motion and print rules.
- `tests/goal17-interactive-note.test.ts` compiles the updated template and every
  trusted component insert snippet.
- `tests/goal19-export-fidelity.test.ts` verifies both export modes receive the
  canonical `--note-*` stylesheet and embedded note fonts.
- `src/main/services/export-template.ts` still scopes the exact renderer source
  from `.mdx-preview` to `.mdx-vault-export`; no second theme was introduced.

Focused gate:

```text
20 pass
0 fail
272 expect() calls
```

Full gates:

```text
bun test          PASS
bun run typecheck PASS
bun run lint      PASS — 426 files checked
bun run build     PASS
```

The production build retains the repository's existing Vite notices about
modules that are both statically and dynamically imported; no new build error
or note-theme warning was introduced.

## Visual evidence

`python scripts/verify-editorial-note-theme.py` loads the real renderer CSS and
self-hosted fonts, records console/page errors, exercises the pressed and
focus-visible button states, and captures desktop and 620px views.

Computed contract:

```text
Paper                 rgb(249, 249, 247)
Ink                   rgb(17, 17, 17)
Result                rgb(43, 87, 151)
Title                  Playfair Display; 6px red rail (5px narrow)
Deck                   Lora
Kicker/code/button     Courier Prime
Button                 2px border; 0px radius; 2px hard shadow
Focus                  3px solid outline
Narrow table           block/scroll surface
Print framed content   break-inside: avoid-page
```

The visual review confirmed that the title signature remains the single bold
gesture, public panels match trusted callouts, computed results use blue only,
and the narrow surface keeps readable type and controls without introducing a
second mobile aesthetic.
