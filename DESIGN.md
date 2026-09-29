# Design — mdx-vault

> **Knowledge Instrument.** mdx-vault is a calm technical workbench for reading,
> writing and proving ideas. Chrome behaves like calibrated equipment: quiet
> layers, exact rails and clear state. The note remains the largest, calmest
> surface. Interactive evidence is visible when it matters, never decorative.

This document is the design contract. Runtime tokens live in
`src/renderer/src/globals.css`; when implementation and this contract diverge,
update both in the same change.

## Subject and job

- **Subject:** a local-first MDX knowledge instrument for developers, technical
  learners and writers.
- **Primary job:** move from prose to evidence without losing the plain-file
  source or the user's place in the document.
- **Design promise:** reading is quiet, authoring is precise, interactive proof
  is explicit and every state can be understood without relying on color alone.

## Foundation

### Palette

| Role | Light | Dark | Meaning |
| --- | --- | --- | --- |
| Bench | `#F6F8FA` | `#0F141A` | Primary document/workspace surface |
| Carbon | `#14181F` | `#EDF2F7` | Primary text and strong controls |
| Instrument Blue | `#2457FF` | `#8AA3FF` | Focus, navigation, active selection |
| Signal | `#A34700` | `#FF9A57` | Attention, pending state, prediction |
| Evidence Teal | `#0F6F5C` | `#42C7A5` | Verified result, resolved relation |
| Alloy | `#CBD2DA` | `#384554` | Structural rules and boundaries |
| Muted text | `#59636F` | `#AAB4C0` | Secondary labels on chrome, at least 4.5:1 |

Destructive state has its own semantic token (`#B42318` light, `#FF8A80`
dark). Color is never the only signal: icon, label, stroke or pattern must also
express the state.

#### Note paper — Editorial / Print Neo-Brutalism

The workbench palette above belongs to app chrome and editable buffers. Reading, hover
previews, trusted note components and exported note content form a separate,
always-light paper context:

| Token | Value | Role |
| --- | --- | --- |
| Paper | `#F9F9F7` | Note canvas and primary component surface |
| Paper Dark | `#EFEFEA` | Secondary panels, code blocks and neutral state |
| Ink | `#111111` | Text, 2px borders and zero-blur offset shadows |
| Accent | `#C02626` | Action, active state, link and emphasis |
| Line | `#CCCCCC` | Secondary dividers and scrollbars |
| Result | `#2B5797` | Computed or dynamic results only |

The four mandatory tells are hard offset shadows, 2px ink borders, zero radius
and one red accent. The Result blue is never decorative. Note content uses no
gradient, blurred shadow, pastel tint or framework semantic color. A pressed
note control translates `2px 2px` and loses its shadow so it sinks into the
paper.

### Typography

| Role | Family | Default treatment |
| --- | --- | --- |
| Interface | Atkinson Hyperlegible Next | 12–16px, 400–600, sentence case |
| Note display | Playfair Display | 700/900 headings and editorial titles |
| Note reading | Lora | 16–17px body with an open reading rhythm |
| Note UI and code | Courier Prime | Uppercase labels, controls, data and code |
| Source and Live editor | JetBrains Mono | 15px / 1.6 default; Vietnamese subset included |
| App data chrome | IBM Plex Mono | 12–14px, tabular figures where useful |

Fonts are self-hosted. UI labels never drop below 12px. Uppercase and wide
tracking are reserved for short machine states, not ordinary navigation or
paragraphs.

### Shape, line and elevation

- Structural boundaries use 1px Alloy rules.
- Focus, selection and critical state use 2px strokes.
- Controls use 2–4px radii. Shape communicates grouping without turning every
  surface into a card.
- Shadow belongs only to overlays, drag previews and modal ownership. Inline
  widgets sit on the document plane.
- Comfortable density is the default. Compact density reduces padding/control
  height, never text size.
- Inside a note, the paper contract overrides app geometry: framed surfaces use
  2px Ink rules, zero radius and a `4px 4px 0` hard shadow where elevation is
  meaningful. Ordinary paragraphs remain unboxed.

## Signature: document thesis rail

The only rail on the document plane is the red title rail inside an Editorial
note. Structural navigation belongs to the named Outline panel. The workbench
never reserves an inline evidence/minimap gutter between the document and the
supplementary dock.

## Layout grammar

```
┌─ app bar ─────────────────────────────────────────────────────┐
│ menu / active vault                      state / window tools │
├────────────┬──────────────────────────────────┬───────────────┤
│ vault dock │ tabs + document                 │ context dock  │
│            │                                 │ / AI dock    │
├────────────┴──────────────────────────────────┴───────────────┤
│ status: save state              document metrics / dock tools │
└───────────────────────────────────────────────────────────────┘
```

- The document is the load-bearing surface. A dock must become an overlay before
  it can collapse the document below a useful width.
- The resting app bar exposes one application-menu trigger and the active vault
  selector. File/Edit/View/Go/Window live in nested keyboard-accessible menu
  groups; they do not remain as five persistent titlebar labels.
- Outline owns structural navigation; the document track never reserves an
  Evidence Rail or minimap gutter. Its semantic heading list remains primary;
  an Alloy hierarchy connector and Instrument Blue active segment visualize
  depth/current location without becoming a second interaction target.
- **Wide:** left, document, Context and AI may use separate tracks.
- **Compact:** left remains a bounded track when possible; Context and AI share a
  keyboard-accessible supplementary dock.
- **Overlay:** every side dock is layered over a full-width document. Open state
  remains truthful and reachable.
- The workbench remains deliberately single-pane through GOAL-27. IDE-grade
  intelligence uses anchored, keyboard-accessible overlays instead of split or
  peek editors.

## Interaction grammar

- Visual tab order and MRU history remain separate. Existing transactional
  workbench behavior is preserved.
- One global overlay owns shortcuts and focus at a time. Closing restores the
  invoking control where possible.
- Pointer and keyboard actions are equivalent. Roving tab stops are used for
  tablists and compact dock selectors.
- Buttons use active verbs and stable names. Empty and error states explain the
  next action; they do not use mood copy.
- Controls have visible `:focus-visible` treatment using Instrument Blue.
- Motion is limited to state transitions that help preserve orientation.

## Surface contracts

### Reading and editing

- Reading uses the always-light Editorial paper context: Lora body,
  Playfair Display headings, Courier Prime code/labels, newspaper rules and a
  bounded readable line length. Live is an editing surface: it shares Source's
  font metrics and theme, with restrained heading emphasis and hidden syntax
  away from the caret. It does not inherit Reading's large display headings.
- The note design system is layered as `--note-*` foundations, native prose plus
  public `note-*` authoring primitives, then trusted `in-*` component styles.
  Reading, hover preview and export consume the same authoritative stylesheet;
  `docs/note-design-system.md` defines the authoring contract.
- Source and Live use JetBrains Mono with IBM Plex Mono as the fallback face.
  Font family, size, weight, line height and ligatures are explicit persisted
  preferences. Code styling is quiet: most tokens remain weight 400, structural
  color carries hierarchy. The inverted ink code treatment belongs only to
  Reading note content, not editable buffers.
- The appearance control beside Source/Live provides font selection, size,
  spacing, wrapping, ruler, ligatures and indentation guides. Comfortable uses
  JetBrains Mono 15px/1.6 with ruler/ligatures off; Compact retains the prior
  Maple Mono 14px/1.45 treatment. Existing saved preferences are not overwritten.
  This editor typography preset is independent of interface density.
- Raw MDX Source and editable code use the same full-width, no-wrap IDE buffer.
  Live mode retains the optional bounded prose measure. The shared preferred
  column drives an optional ruler; tab size, indentation guides and whitespace
  visibility remain independently configurable.
- Gutter and buffer share one uninterrupted document plane with no divider or
  card boundary. Active line state uses only a low-opacity tint; the active line
  number and cursor carry focus without a decorative inset rail.
- Gutter numbers share the buffer's font size. Content fills the space remaining
  after the gutter, never `100%` plus gutter width. Tabs use 13px labels;
  breadcrumbs, completion details and Outline labels are at least 12px.
- Tab accepts visible completion, advances snippet fields or inserts spaces at
  the caret to the next configured indentation stop. Selected lines indent
  together; Shift+Tab outdents. Enter uses that same indentation unit.
- Source formatting is keyboard-first and does not open a pointer toolbar over
  selected text. In the MDX editor, `Mod+B`, `Mod+I`, `Mod+E` and `Ctrl+H`
  format bold, italic, inline code and highlight respectively.
- Reading zoom and interface scale are separate settings.
- Reading retains the last good document while compiling, marks a stale or failed
  compile in a compact rail, and never replaces readable prose with a spinner.
  Alt+click on a non-link block or the “Edit at this position” command reveals
  its source line; links keep their normal navigation. Source/Live↔Reading
  transfers the nearest semantic block, while tab restore retains pixel scroll.
  Resizable evidence reserves its document space and respects scroll anchoring.
  Each trusted island contains its own runtime error on the paper.
- Note labels, captions and status text are at least 12px. Footnote references
  use the red paper accent, a ruled notes section, explicit back-links and
  ink-only print styling.
- Source, Live Preview and Reading remain views of the same file/buffer.
- Outline reflects the active unsaved buffer. Source/Live follow the caret;
  Reading follows the heading nearest the top of its nested viewport. Active
  items use `aria-current="location"` and auto-scroll with a reduced-motion-safe
  fallback.
- Outline parsing runs in a lazy data-only worker after a 120ms typing pause;
  the memoized Outline stays out of unrelated UI updates. Syntax diagnostics use
  a separate lazy worker after 650ms. Neither parser emits or runs note code.

### Interactive Proof

- Proof is an evidence surface, not a generic IDE dashboard.
- Source, Proof and Problems retain explicit labels and keyboard order.
- `Not run`, `Checking`, `Ready`, compile issue and runtime issue always have
  text, not color-only state.
- The iframe does not inherit app CSS and retains the security contract in
  `docs/security.md`; outer chrome follows Knowledge Instrument.

### Graph

- Graph pixels are not the accessibility tree. The DOM navigator mirrors
  selection, degree, path, group and ambiguity information.
- Instrument Blue marks active navigation; Evidence Teal marks resolved
  relations; Signal and destructive semantics remain text/shape backed.
- Reduced motion disables layout animation without changing topology.

### Dialogs and settings

- Dialogs use one overlay shadow to express ownership, a 1px boundary and a
  visible title/description relationship.
- Settings use searchable categories, sentence-case labels and controls aligned
  to a stable baseline.
- Locale, density and interface scale apply immediately after a confirmed
  Settings v6 snapshot.

## Localization and accessibility

- New UI strings enter the typed English/Vietnamese catalog; hard-coded visible
  strings are migration debt for GOAL-36.
- `system` locale resolves to Vietnamese only for a Vietnamese OS locale,
  otherwise English. The document root `lang` always reflects the resolution.
- Target WCAG 2.2 AA contrast, complete keyboard workflows, Windows High
  Contrast, reduced motion and usable layout at 200% zoom.
- Canvas/iframe visuals always have a DOM/status equivalent for essential state.

## Compatibility during migration

Legacy token names such as `--editorial-red`, `--editorial-blue` and
`--paper-dark` temporarily alias the new semantic palette so GOAL-26 can replace
the foundation without mixing unrelated feature refactors. GOAL-36 removes the
remaining aliases and legacy per-surface styling after every surface is migrated.

## References

| File | Role |
| --- | --- |
| `src/renderer/src/globals.css` | Runtime color/type/radius tokens and prose base |
| `src/renderer/src/main.tsx` | Self-hosted font imports |
| `src/shared/app-settings.ts` | Versioned interface and Source-editor preferences |
| `src/renderer/src/editor/editor-theme.ts` | Source buffer, gutter and CodeMirror state treatment |
| `src/renderer/src/preview/interactive-note-theme.css` | Authoritative note design-system tokens, prose and component styles |
| `docs/note-design-system.md` | Public note authoring and contribution contract |
| `docs/security.md` | Trust, sandbox and Electron invariants |
| `components.json` | shadcn/ui component foundation |
