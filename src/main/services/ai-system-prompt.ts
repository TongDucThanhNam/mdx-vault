import { AI_PROTOCOL_VERSION, type AssistantContext, type SelectionRange } from '../../shared/ai'

/**
 * Per-action system prompt. The model is told to:
 *
 *   - **Prefer template components** (QuizBlock, EquationSlider, DataChart,
 *     AlgorithmVisualizer) whenever one fits, emitting either a
 *     `textPatch` that inserts a JSX element with props OR an
 *     `interactiveInsert` targeting `<Interactive src>` for sandbox ones.
 *
 *   - Otherwise propose a `componentDraft` with `component.tsx`,
 *     `manifest.json`, and `README.md` (provenance). Every draft goes
 *     through esbuild + the dependency allowlist `react`, `react-dom`,
 *     `recharts` (see SandboxService.allowlist); packages outside that
 *     list will fail to compile and the repair loop will hand the
 *     diagnostics back to the model.
 *
 *   - Return ONLY the JSON `PatchProposal` object. No prose before/after.
 */

export interface ActionDescriptor {
  id: string
  label: string
  /** "template" (use existing components) | "draft" (scaffold vault component) | "chat" (freeform). */
  mode: 'template' | 'draft' | 'chat'
}

export const SELECTED_ACTIONS: readonly ActionDescriptor[] = [
  { id: 'create-quiz', label: 'Create quiz', mode: 'template' },
  { id: 'generate-figure', label: 'Generate figure', mode: 'template' },
  { id: 'equation-slider', label: 'Equation slider', mode: 'template' },
  { id: 'algorithm-visualizer', label: 'Algorithm visualizer', mode: 'template' },
  { id: 'make-interactive', label: 'Make interactive', mode: 'draft' },
  { id: 'refactor-this-mdx', label: 'Refactor this MDX', mode: 'template' },
  { id: 'fix-this-component', label: 'Fix this component', mode: 'draft' },
  { id: 'explain', label: 'Explain', mode: 'chat' }
] as const

export function findAction(id: string): ActionDescriptor | null {
  return SELECTED_ACTIONS.find((candidate) => candidate.id === id) ?? null
}

/* -------------------------------------------------------------------------- */
/*                                Public API                                  */
/* -------------------------------------------------------------------------- */

export interface SystemPromptInput {
  action: ActionDescriptor
  context: AssistantContext
  userMessage: string
  modelName: string
}

export function buildSystemPrompt(input: SystemPromptInput): string {
  const { action, context, modelName } = input
  const actionBlock = actionIntro(action)
  const invariantBlock = invariants()
  const contextBlock = contextSummary(context)
  const hintsBlock = registryHintsForTemplate(action)
  const outputBlock = outputContract()

  return [
    actionBlock,
    contextBlock,
    hintsBlock,
    invariantBlock,
    outputBlock,
    `Model: ${modelName} | protocol: v${AI_PROTOCOL_VERSION}`
  ]
    .filter((chunk) => chunk.length > 0)
    .join('\n\n')
}

/* -------------------------------------------------------------------------- */
/*                                 Blocks                                     */
/* -------------------------------------------------------------------------- */

function actionIntro(action: ActionDescriptor): string {
  switch (action.mode) {
    case 'template':
      return [
        `You are helping the author of an MDX note refine a passage.`,
        `Action: ${action.label} (mode = template).`,
        `If one of the existing interactive components fits the user's request, prefer to insert a JSX element with that component's name and props. Only fall back to a vault component draft if no template is suitable.`
      ].join('\n')
    case 'draft':
      return [
        `You are scaffolding a NEW vault component for an MDX note.`,
        `Action: ${action.label} (mode = draft).`,
        `Generate a complete vault component — component.tsx, manifest.json, README.md — under interactives/<slug>/. The component will be compiled by esbuild + a strict dependency allowlist and then sandboxed in an iframe; the user approves the diff before anything is written.`
      ].join('\n')
    case 'chat':
    default:
      return [
        `You are an assistant inside an MDX note app.`,
        `Action: ${action.label} (mode = chat).`,
        `When the user asks you to change the note, return patches in the contract below. When they ask for an explanation, answer succinctly in plain prose (no PatchProposal wrapper).`
      ].join('\n')
  }
}

function contextSummary(context: AssistantContext): string {
  const lines: string[] = []

  lines.push(`Note: ${context.noteRelativePath}`)
  lines.push(`Title: ${context.noteTitle}`)

  if (context.selection) {
    const selection: SelectionRange = context.selection
    lines.push(
      `Selection: lines ${selection.startLine}:${selection.startColumn}–${selection.endLine}:${selection.endColumn}`
    )
    lines.push('```')
    lines.push(indentBlock(selection.text))
    lines.push('```')
  }

  if (context.noteExcerpt) {
    lines.push('Note excerpt (truncated):')
    lines.push('```mdx')
    lines.push(indentBlock(truncate(context.noteExcerpt, 2400)))
    lines.push('```')
  }

  if (context.backlinks.length > 0) {
    lines.push('Backlinks:')
    for (const link of context.backlinks.slice(0, 8)) {
      lines.push(`- ${link.relativePath} (display: ${link.display})`)
    }
  }

  return lines.join('\n')
}

function registryHintsForTemplate(action: ActionDescriptor): string {
  if (action.mode === 'draft' || action.mode === 'chat') {
    return ''
  }

  return [
    'Template inventory:',
    '- QuizBlock          — multiple-choice question with `question`, `options`, `answerIndex`, optional `explanation`.',
    '- EquationSlider     — formula + per-variable ranges. Requires `formula` and `variables` map.',
    '- DataChart          — Recharts wrapper. Needs `type` ("line" | "bar" | "scatter"), `x`, `y`. Data via inline `data` array OR `src` to assets/*.csv.',
    '- AlgorithmVisualizer — `algorithm` ("binary-search" | "bubble-sort"), numeric `data`, optional `target`, optional `speed`.',
    '',
    'Inserted via JSX (these are trusted registry components; they pass through React directly, no sandbox).',
    'Example: <QuizBlock question="…" options={["a","b"]} answerIndex={0} explanation="…" />'
  ].join('\n')
}

function invariants(): string {
  return [
    'Invariants — read carefully:',
    '- You may ONLY read files via the `read_note` tool, and only the note the user is currently editing.',
    '- Vault components are restricted to dependencies in the allowlist: react, react-dom. Anything else will fail to compile.',
    '- NEVER propose deleting files, renaming, or moving existing content unless the user explicitly asked.',
    '- The user sees a diff and approves. Your output is a *proposal*, not an action.',
    '- Match the existing tone and prose density of the note.'
  ].join('\n')
}

function outputContract(): string {
  return [
    'Output contract:',
    'When proposing a change, respond with EXACTLY ONE JSON object (no prose, no markdown fences) that matches:',
    '{',
    '  "rationale": "one-line rationale",',
    '  "patches": [',
    '    {',
    '      "kind": "textPatch",',
    '      "rationale": "optional",',
    '      "start": <byte offset 0..length>,',
    '      "end":   <byte offset 0..length>,',
    '      "replacement": "<new MDX fragment>"',
    '    }',
    '    OR',
    '    {',
    '      "kind": "interactiveInsert",',
    '      "rationale": "optional",',
    '      "atOffset": <byte offset>,',
    '      "src": "interactives/<slug>",',
    '      "propsJson": "<space/newline-separated JSX attributes string>"',
    '    }',
    '    OR',
    '    {',
    '      "kind": "componentDraft",',
    '      "rationale": "optional",',
    '      "folderRelativePath": "interactives/<slug>",',
    '      "componentSource": "<full component.tsx contents>",',
    '      "manifestJson": "<manifest.json contents>",',
    '      "readmeMarkdown": "<README.md contents>",',
    '      "provenance": { "prompt": "...", "noteRelativePath": "...", "modelName": "...", "generatedAt": "<iso>" }',
    '    }',
    '  ]',
    '}',
    '',
    'Byte offsets are counted over the UTF-16 representation of the note.',
    'Selection.start / .end in the user message are START/END offsets for a `textPatch` that replaces exactly the selection.',
    'You may emit multiple `patches` to express a single intent; they are applied in order.'
  ].join('\n')
}

/* -------------------------------------------------------------------------- */
/*                                   Helpers                                  */
/* -------------------------------------------------------------------------- */

function indentBlock(text: string): string {
  return text
    .split('\n')
    .map((line) => `    ${line}`)
    .join('\n')
}

function truncate(text: string, max: number): string {
  if (text.length <= max) {
    return text
  }

  return `${text.slice(0, max)}\n…(truncated)`
}

/** Marker for grep-able review. */
export const AI_SYSTEM_PROMPT_MARKER = 'mdx-vault-ai-system-prompt:v1'
