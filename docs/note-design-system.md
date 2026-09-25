# Editorial Note Design System

The note layer is a paper document inside an IDE workbench. It always uses the
Editorial / Print Neo-Brutalism language in Reading, Live prose, page preview,
static export, and interactive export. App chrome and Source editing keep their
own workbench typography and geometry.

## Identity

Four visual tells are mandatory:

1. framed surfaces use a `2px` Ink rule;
2. elevation uses an offset shadow with zero blur;
3. every note shape has zero radius;
4. red is the only decorative/action accent.

Result blue is reserved for computed or observed values. Paper, Paper Muted,
Ink, Accent, Line, and Result are the complete color vocabulary. The red rail
on the note title is the system signature: it marks the document thesis rather
than decorating every section.

## Architecture

The stylesheet has three layers:

| Layer | Contract | Consumers |
| --- | --- | --- |
| Foundation | `--note-*` color, type, space, rule, shadow, focus, measure, and motion tokens | Every note surface |
| Prose | Native Markdown/HTML elements plus public `note-*` classes | Authors and templates |
| Components | Internal `in-*` classes | Trusted registry components only |

`src/renderer/src/preview/interactive-note-theme.css` is authoritative. Export
scopes that same source from `.mdx-preview` to `.mdx-vault-export`; it must not
grow a second visual implementation.

## Foundation tokens

### Color

| Token | Value | Use |
| --- | --- | --- |
| `--note-paper` | `#f9f9f7` | document and primary surfaces |
| `--note-paper-muted` | `#efefea` | secondary panels and code blocks |
| `--note-ink` | `#111111` | text, borders, hard shadows |
| `--note-accent` | `#d32f2f` | actions, active state, links, emphasis |
| `--note-line` | `#cccccc` | secondary dividers and scrollbars |
| `--note-result` | `#2b5797` | computed or observed results only |

### Type

- `--note-font-display`: Playfair Display 700/900 for headings.
- `--note-font-body`: Lora 400 for reading content.
- `--note-font-ui`: Courier Prime 400/700 for code, controls, labels, and data.
- Body and heading sizes, leading, and readable measure are tokenized; mobile
  density changes the scale without changing font roles.

### Geometry and interaction

- `--note-rule` and `--note-rule-subtle` express structural boundaries.
- `--note-shadow-sm` and `--note-shadow` are the only elevations; both have zero blur.
- `--note-focus` is a visible red outline with offset.
- `--note-control-height` keeps authored controls keyboard and touch usable.
- Active controls translate `2px 2px` and lose their shadow.

## Native prose contract

Prefer ordinary Markdown for headings, paragraphs, lists, links, quotes,
tables, code, images, details, and horizontal rules. The system also styles
definition lists, captions, keyboard input, samples, variables, form controls,
task controls, callouts, footnotes, highlighted code, and Mermaid frames.

Heading hierarchy carries document structure: the title owns the red thesis
rail, section headings own newspaper rules, and small headings switch to the
Courier utility voice. Avoid using headings merely to obtain a size.

## Public authoring primitives

Public classes are stable and safe in MDX:

| Class | Role |
| --- | --- |
| `note-kicker` | short red classification above the title |
| `note-deck` | thesis/standfirst below the title |
| `note-label` | Ink classification label |
| `note-label-accent` | red label modifier |
| `note-label-result` | result-only blue label modifier |
| `note-status` | short machine state |
| `note-panel` | framed, elevated paper surface |
| `note-panel-accent` | red pull-quote/caveat modifier |
| `note-explanation` | neutral centered explanation |
| `note-result` | computed/observed result surface |
| `note-step` | dashed current-position indicator |
| `note-folio` | closing document metadata |

Example:

```mdx
<span className="note-label note-label-accent">Invariant</span>

<div className="note-panel note-panel-accent">
  This boundary must remain true across every implementation.
</div>

<output className="note-result">p95 = 18.4 ms</output>
```

Do not author internal `in-*` classes. Use `NotePrimer`, `HighlightBox`,
`FormulaLine`, `MentalModel`, `TraceBlock`, `WidgetFrame`, `PredictionGate`,
`Recap`, `ComparisonBars`, `CellGrid`, `FlowSequence`, `SelfTest`, and
`EvidenceLog` through the trusted registry instead.

## Responsive, accessibility, and print

- At narrow widths, title/body scale tightens, mental-model grids stack, tables
  scroll, and quantitative rows preserve readable labels.
- Every interactive native element receives the same visible `:focus-visible`
  outline. State is never color-only in trusted components.
- Reduced-motion mode removes transitions without changing state or layout.
- Print keeps exact paper/ink/accent colors, avoids breaks inside evidence and
  framed content, and preserves heading/content grouping.
- Hover preview uses the same tokens at compact density; Source mode never
  inherits the note system.

## Contribution checklist

- Derive every new value from a `--note-*` token or add one at the foundation.
- Prefer native prose, then a public primitive, then a trusted component.
- Keep result blue tied to a computed/observed value.
- Use no gradient, blurred shadow, rounded corner, pastel, or extra font.
- Add keyboard focus, narrow-width, reduced-motion, and print behavior with the component.
- Verify renderer and export because both consume the same stylesheet.
