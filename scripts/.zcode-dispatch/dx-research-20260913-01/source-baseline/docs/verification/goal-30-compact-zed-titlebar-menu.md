# GOAL-30 Verification — Compact Zed-style Titlebar Menu

Date: 2026-08-12  
Environment: Windows 11, Electron production renderer, Bun 1.3.14, TypeScript 5.9

## Result

GOAL-30 passes. The resting titlebar now shows one hamburger menu and the active
vault selector on the left. The old wordmark and persistent
File/Edit/View/Go/Window strip are gone; the five groups live in a nested menu
while retaining the existing command registry, shortcuts and state.

## Implementation evidence

- `AppMenuBar.tsx` uses one Radix DropdownMenu trigger with keyboard-accessible
  File, Edit, View, Go and Window submenus.
- Existing item helpers still own disabled, shortcut, checkbox and radio state;
  action handlers still dispatch canonical workspace action IDs.
- `AppTopBar.tsx` renders the current vault as an always-visible selector. Its
  action routes only through `vault.open`; selected, empty and loading labels are
  localized and accessible.
- The native drag region, right-side AI control and WindowControls are unchanged.
  No IPC, dependency, native-menu policy or security boundary changed.

## Automated gates

| Gate | Result |
| --- | --- |
| Focused titlebar/menu/i18n tests | 7 passed, 0 failed, 23 expectations |
| `bun test` | 454 passed, 0 failed, 2,944 expectations across 103 files |
| `bun run typecheck` | Passed for node and web projects |
| `bun run lint` | Passed; 435 files checked |
| `bun run build` | Passed; main, preload and renderer production bundles built |

## Live Electron evidence

The verification used a disposable vault/userData and deleted both afterward.
The machine-readable result is
[goal-30-live-results.json](assets/goal-30-dev/goal-30-live-results.json).

| Journey | Observed result |
| --- | --- |
| Resting titlebar | Only `example-vault` contributed visible left-side text |
| Main menu | File/Edit/View/Go/Window appeared after hamburger activation |
| Pointer submenu | Hovering File exposed Open Vault and Settings actions |
| Keyboard submenu | Enter + Arrow Right opened File; Escape dismissed both layers |
| Narrow titlebar | 680px window retained the complete 98px vault selector |
| Runtime audit | 0 console errors, 0 page errors, 0 external requests |

Visual captures:

- [Compact main menu](assets/goal-30-dev/goal-30-compact-menu.png)
- [File submenu](assets/goal-30-dev/goal-30-file-submenu.png)
- [Narrow resting titlebar](assets/goal-30-dev/goal-30-narrow-titlebar.png)
