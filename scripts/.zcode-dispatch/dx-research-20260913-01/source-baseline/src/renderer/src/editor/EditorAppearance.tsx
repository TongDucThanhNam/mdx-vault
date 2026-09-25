import { Minus, Plus, Type, X } from 'lucide-react'
import { Popover } from 'radix-ui'
import { useContext, useId, useRef, useState } from 'react'
import { Button } from '@/components/ui/button'
import { useI18n } from '@/i18n/useI18n'
import type { AppSettingsPatch, EditorFontFamilySetting } from '../../../shared/app-settings'
import {
  MAX_EDITOR_FONT_SIZE,
  MAX_EDITOR_LINE_HEIGHT,
  MIN_EDITOR_FONT_SIZE,
  MIN_EDITOR_LINE_HEIGHT
} from '../../../shared/app-settings'
import {
  EditorAppearanceControlsContext,
  SOURCE_EDITOR_FONT_STACKS,
  useSourceEditorPreferences
} from './editor-preferences-context'

const comfortable: AppSettingsPatch = {
  editorFontFamily: 'jetbrains-mono',
  editorFontSize: 15,
  editorLineHeight: 1.6,
  editorFontWeight: 'regular',
  editorLigatures: false,
  editorRuler: false
}
const compact: AppSettingsPatch = {
  editorFontFamily: 'maple-mono',
  editorFontSize: 14,
  editorLineHeight: 1.45,
  editorFontWeight: 'regular',
  editorLigatures: true,
  editorRuler: true
}

/** Uses the shared settings transaction: the buffer stays mounted throughout. */
export function EditorAppearance({ live = false }: { live?: boolean }): React.JSX.Element | null {
  const preferences = useSourceEditorPreferences()
  const controls = useContext(EditorAppearanceControlsContext)
  const { t } = useI18n()
  const id = useId()
  const [spacingDraft, setSpacingDraft] = useState<number | null>(null)
  const spacingDraftRef = useRef<number | null>(null)
  if (!controls) return null
  const update = (patch: AppSettingsPatch): void => {
    void controls.update(patch)
  }
  const wrap = live ? preferences.noteWordWrap : preferences.codeWordWrap
  const lineHeight = spacingDraft ?? preferences.lineHeight
  const commitSpacing = (): void => {
    const value = spacingDraftRef.current
    if (value === null) return
    spacingDraftRef.current = null
    // Preview while dragging; persist once per gesture, without disabling the
    // focused slider or filling the settings queue with intermediate writes.
    void controls.update({ editorLineHeight: value }).then(() => {
      setSpacingDraft((current) => (current === value ? null : current))
    })
  }

  return (
    <Popover.Root modal>
      <Popover.Trigger asChild>
        <Button
          variant="ghost"
          size="xs"
          title={t('editor.appearance')}
          aria-label={t('editor.appearance')}
        >
          <Type aria-hidden="true" />
          <span className="font-mono text-xs tabular-nums">{preferences.fontSize}</span>
        </Button>
      </Popover.Trigger>
      <Popover.Portal>
        <Popover.Content
          aria-label={t('editor.appearance')}
          align="end"
          sideOffset={8}
          collisionPadding={12}
          className="z-[100] w-80 max-w-[calc(100vw-24px)] rounded-md border border-border bg-popover p-4 font-sans text-sm text-popover-foreground shadow-lg outline-none"
        >
          <div className="mb-4 flex items-center justify-between">
            <h2 className="font-semibold">{t('editor.appearance')}</h2>
            <Popover.Close asChild>
              <Button variant="ghost" size="icon-xs" aria-label={t('editor.close')}>
                <X aria-hidden="true" />
              </Button>
            </Popover.Close>
          </div>
          <fieldset aria-busy={controls.pending} className="space-y-4">
            <legend className="sr-only">{t('editor.appearance')}</legend>
            <div className="grid grid-cols-2 gap-2">
              <Button variant="outline" size="sm" onClick={() => update(comfortable)}>
                {t('editor.comfortable')}
              </Button>
              <Button variant="outline" size="sm" onClick={() => update(compact)}>
                {t('editor.compact')}
              </Button>
            </div>
            <div className="space-y-1.5">
              <label htmlFor={`${id}-font`} className="text-xs text-muted-foreground">
                {t('editor.font')}
              </label>
              <select
                id={`${id}-font`}
                value={preferences.fontFamily}
                onChange={(event) =>
                  update({ editorFontFamily: event.target.value as EditorFontFamilySetting })
                }
                className="h-9 w-full rounded-sm border border-input bg-card px-2 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring"
              >
                <option value="jetbrains-mono">JetBrains Mono</option>
                <option value="ibm-plex-mono">IBM Plex Mono</option>
                <option value="maple-mono">Maple Mono</option>
                <option value="system-mono">System Mono</option>
              </select>
            </div>
            <div className="flex items-center justify-between">
              <label htmlFor={`${id}-size`} className="text-xs text-muted-foreground">
                {t('editor.fontSize')}
              </label>
              <div className="flex items-center gap-1">
                <Button
                  variant="ghost"
                  size="icon-xs"
                  aria-label={t('editor.smaller')}
                  disabled={preferences.fontSize <= MIN_EDITOR_FONT_SIZE}
                  onClick={() => update({ editorFontSize: preferences.fontSize - 0.5 })}
                >
                  <Minus aria-hidden="true" />
                </Button>
                <output
                  id={`${id}-size`}
                  className="w-14 text-center font-mono text-xs tabular-nums"
                >
                  {preferences.fontSize} px
                </output>
                <Button
                  variant="ghost"
                  size="icon-xs"
                  aria-label={t('editor.larger')}
                  disabled={preferences.fontSize >= MAX_EDITOR_FONT_SIZE}
                  onClick={() => update({ editorFontSize: preferences.fontSize + 0.5 })}
                >
                  <Plus aria-hidden="true" />
                </Button>
              </div>
            </div>
            <div className="space-y-1.5">
              <label
                htmlFor={`${id}-spacing`}
                className="flex justify-between text-xs text-muted-foreground"
              >
                {t('editor.lineSpacing')}
                <span className="font-mono tabular-nums">{lineHeight.toFixed(2)}</span>
              </label>
              <input
                id={`${id}-spacing`}
                type="range"
                min={MIN_EDITOR_LINE_HEIGHT}
                max={MAX_EDITOR_LINE_HEIGHT}
                step="0.05"
                value={lineHeight}
                onChange={(event) => {
                  const value = Number(event.target.value)
                  spacingDraftRef.current = value
                  setSpacingDraft(value)
                }}
                onPointerUp={commitSpacing}
                onPointerCancel={commitSpacing}
                onKeyUp={commitSpacing}
                onBlur={commitSpacing}
                className="w-full accent-instrument-blue"
              />
            </div>
            <pre
              role="region"
              aria-label={t('editor.sample')}
              className="overflow-x-auto rounded-sm border border-border/60 bg-card px-3 py-2"
              style={{
                fontFamily: SOURCE_EDITOR_FONT_STACKS[preferences.fontFamily],
                fontSize: preferences.fontSize,
                fontWeight: preferences.fontWeight,
                lineHeight,
                fontVariantLigatures: preferences.ligatures ? 'contextual common-ligatures' : 'none'
              }}
            >
              {'const total = price * qty\n// Ghi chú: ý tưởng rõ ràng\n0O 1lI  {}  []  =>  !='}
            </pre>
            <div className="grid grid-cols-2 gap-3 text-xs">
              <label className="flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={wrap !== 'off'}
                  className="accent-instrument-blue"
                  onChange={(event) =>
                    update(
                      live
                        ? { editorNoteWordWrap: event.target.checked ? 'bounded' : 'off' }
                        : { editorCodeWordWrap: event.target.checked ? 'viewport' : 'off' }
                    )
                  }
                />
                {t('editor.wrap')}
              </label>
              <label className="flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={preferences.showRuler}
                  className="accent-instrument-blue"
                  onChange={(event) => update({ editorRuler: event.target.checked })}
                />
                {t('editor.ruler')}
              </label>
              <label className="flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={preferences.ligatures}
                  className="accent-instrument-blue"
                  onChange={(event) => update({ editorLigatures: event.target.checked })}
                />
                {t('editor.ligatures')}
              </label>
              <label className="flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={preferences.indentGuides}
                  className="accent-instrument-blue"
                  onChange={(event) => update({ editorIndentGuides: event.target.checked })}
                />
                {t('editor.indentGuides')}
              </label>
            </div>
          </fieldset>
        </Popover.Content>
      </Popover.Portal>
    </Popover.Root>
  )
}
