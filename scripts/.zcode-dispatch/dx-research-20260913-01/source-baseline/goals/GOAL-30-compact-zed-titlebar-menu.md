# GOAL-30 — Compact Zed-style Titlebar Menu

## Objective

Reduce the persistent titlebar chrome to a single application-menu trigger and
the active vault selector. Move File, Edit, View, Go and Window into a
keyboard-accessible nested menu without changing their action routing.

## Target State

1. The left side of the resting titlebar contains only a compact menu button and
   the current vault selector.
2. Activating the menu exposes File, Edit, View, Go and Window as nested groups.
3. Existing shortcuts, disabled state, checks, radio selection and command
   dispatch remain canonical.
4. Activating the vault selector runs the existing transactional vault switch.
5. Window controls and the optional AI control remain on the right.

## Constraints

- Preserve all invariants in `docs/security.md`.
- Reuse the existing command registry and vault-open action. Do not add IPC or a
  second action path.
- Preserve keyboard navigation, focus visibility, accessible names, checked
  state and disabled state.
- Keep the titlebar drag region and native window controls functional.
- Do not add a dependency or imitate Zed's colors; use Knowledge Instrument
  tokens and the existing hard-shadow menu surface.
- The resting titlebar must not expose the old `mdx vault` wordmark or five
  persistent menu labels.
- Reduced motion must not alter access to any action.

## Success Criteria

- [x] Resting titlebar shows one main-menu trigger and one always-visible vault
      selector on the left.
- [x] File/Edit/View/Go/Window appear only after opening the main menu.
- [x] Every existing menu action retains its routing, shortcut and state.
- [x] The vault selector opens/switches vault through `vault.open` and reports an
      explicit accessible label in empty, loading and selected states.
- [x] Mouse and keyboard can open nested groups, choose an item and dismiss the
      menu; focus styling remains visible.
- [x] Focused tests, full typecheck, lint and live Electron verification pass.

## Execution Plan

1. Record the ordered goal and audit the current titlebar/menu contracts.
2. Convert the five-trigger menubar into one dropdown with nested action groups.
3. Replace the wordmark/static vault badge with the active vault selector.
4. Add routing/structure/a11y tests and verify the production Electron surface.
5. Update design/roadmap documentation and close the goal criteria.

## Out of Scope

- Redesigning command names, keybindings, WindowControls or the command palette.
- Adding recent-vault history or a vault switcher data model.
- Changing native macOS menu policy.
- Restyling note content or editor surfaces.
