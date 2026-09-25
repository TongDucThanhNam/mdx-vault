import {
  Bot,
  FileText,
  Info,
  Keyboard,
  Search,
  Settings2,
  SlidersHorizontal,
  X
} from 'lucide-react'
import { useCallback, useEffect, useMemo, useState } from 'react'
import { createAssistantRuntime } from '@/ai/assistant-client'
import { AiSettingsForm } from '@/ai/panels/AiSettingsPanel'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogDescription, DialogTitle } from '@/components/ui/dialog'
import type { FileTreeSortMode } from '@/explorer/FileTree'
import { type AppSettingsController, useAppSettings } from '@/hooks/useAppSettings'
import type { AppTheme } from '@/hooks/useTheme'
import { formatError } from '@/lib/format-error'
import { cn } from '@/lib/utils'
import packageJson from '../../../../package.json'
import type { AiPublicSettings } from '../../../shared/ai'
import {
  APP_SETTINGS_CATALOG,
  type AppLocale,
  type AppSettingsPatch,
  type AppSettingsSnapshot,
  appSettingSearchText,
  DEFAULT_APP_SETTINGS_SNAPSHOT,
  type DefaultNoteViewSetting,
  type EditorFontFamilySetting,
  type EditorFontWeightSetting,
  type EditorTabSizeSetting,
  type EditorWhitespaceSetting,
  type EditorWordWrapSetting,
  type UiDensity
} from '../../../shared/app-settings'
import type { KeybindingPlatform } from '../../../shared/workspace-actions'
import { KeymapSettings } from './KeymapSettings'
import { keymapMatchesQuery } from './keymap-search'
import { SettingGroup, SettingsPage } from './SettingsLayout'

type SettingsSectionId = 'general' | 'editor' | 'workbench' | 'keymap' | 'ai' | 'about'

export interface SettingsDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  onOpenAnotherVault: () => Promise<void>
  /** Pass the app-wide controller so workbench behavior and Settings share one snapshot. */
  appSettings?: AppSettingsController
  /** Lets the global resolver activate its modal KeyRecorder context. */
  onKeyRecorderChange?: (active: boolean) => void
}

interface ChoiceOption {
  value: string
  label: string
  description: string
}

interface SettingsSectionDefinition {
  id: SettingsSectionId
  label: string
  icon: typeof Settings2
  searchText: string
}

const SECTIONS: readonly SettingsSectionDefinition[] = [
  {
    id: 'general',
    label: 'General',
    icon: Settings2,
    searchText: `${appSettingSearchText([
      APP_SETTINGS_CATALOG.theme,
      APP_SETTINGS_CATALOG.locale,
      APP_SETTINGS_CATALOG.density,
      APP_SETTINGS_CATALOG.uiScale,
      APP_SETTINGS_CATALOG.fileTreeSort
    ])} vault folder path`
  },
  {
    id: 'editor',
    label: 'Editor',
    icon: FileText,
    searchText: appSettingSearchText([
      APP_SETTINGS_CATALOG.defaultNoteView,
      APP_SETTINGS_CATALOG.editorFontSize,
      APP_SETTINGS_CATALOG.editorFontFamily,
      APP_SETTINGS_CATALOG.editorFontWeight,
      APP_SETTINGS_CATALOG.editorLineHeight,
      APP_SETTINGS_CATALOG.editorLigatures,
      APP_SETTINGS_CATALOG.editorTabSize,
      APP_SETTINGS_CATALOG.editorNoteWordWrap,
      APP_SETTINGS_CATALOG.editorCodeWordWrap,
      APP_SETTINGS_CATALOG.editorWrapColumn,
      APP_SETTINGS_CATALOG.editorIndentGuides,
      APP_SETTINGS_CATALOG.editorWhitespace,
      APP_SETTINGS_CATALOG.editorRuler,
      APP_SETTINGS_CATALOG.pagePreviewEnabled,
      APP_SETTINGS_CATALOG.pagePreviewRequireModifier
    ])
  },
  {
    id: 'workbench',
    label: 'Workbench',
    icon: SlidersHorizontal,
    searchText: appSettingSearchText([
      APP_SETTINGS_CATALOG.activateOnClose,
      APP_SETTINGS_CATALOG.whenClosingWithNoTabs
    ])
  },
  {
    id: 'keymap',
    label: 'Keymap',
    icon: Keyboard,
    searchText: appSettingSearchText([APP_SETTINGS_CATALOG.keymapOverrides])
  },
  {
    id: 'ai',
    label: 'AI',
    icon: Bot,
    searchText: 'ai assistant provider model api key credentials encrypted safe storage'
  },
  {
    id: 'about',
    label: 'About',
    icon: Info,
    searchText: 'about version local first mdx markdown react'
  }
]

const assistantRuntime = createAssistantRuntime()

export function SettingsDialog({
  open,
  onOpenChange,
  onOpenAnotherVault,
  appSettings,
  onKeyRecorderChange
}: SettingsDialogProps): React.JSX.Element {
  const privateSettings = useAppSettings({ enabled: open && !appSettings })
  const settings = appSettings ?? privateSettings
  const [section, setSection] = useState<SettingsSectionId>('general')
  const [query, setQuery] = useState('')
  const [vaultPath, setVaultPath] = useState<string | null>(null)
  const [openingVault, setOpeningVault] = useState(false)
  const [aiSettings, setAiSettings] = useState<AiPublicSettings | null>(null)
  const [aiSettingsError, setAiSettingsError] = useState<string | null>(null)
  const platform = getKeybindingPlatform()
  const snapshot = settings.snapshot ?? DEFAULT_APP_SETTINGS_SNAPSHOT
  const keymapOverrides = settings.snapshot?.keymapOverrides ?? {}
  const theme = settings.snapshot?.theme ?? APP_SETTINGS_CATALOG.theme.defaultValue
  const locale = settings.snapshot?.locale ?? APP_SETTINGS_CATALOG.locale.defaultValue
  const density = settings.snapshot?.density ?? APP_SETTINGS_CATALOG.density.defaultValue
  const uiScale = settings.snapshot?.uiScale ?? APP_SETTINGS_CATALOG.uiScale.defaultValue
  const fileTreeSort =
    settings.snapshot?.fileTreeSort ?? APP_SETTINGS_CATALOG.fileTreeSort.defaultValue

  const matchingSections = useMemo(
    () =>
      SECTIONS.filter((item) => {
        if (!query.trim()) {
          return true
        }
        if (item.id === 'keymap') {
          return (
            matchesSearchText(item.searchText, query) ||
            keymapMatchesQuery(query, platform, keymapOverrides)
          )
        }
        return matchesSearchText(item.searchText, query)
      }),
    [keymapOverrides, platform, query]
  )
  const visibleSection = matchingSections.some((item) => item.id === section)
    ? section
    : (matchingSections[0]?.id ?? null)

  const refreshVaultPath = useCallback(async (): Promise<void> => {
    const currentPath = await window.vaultApi.lastOpenVault()
    setVaultPath(currentPath)
  }, [])

  useEffect(() => {
    if (open) {
      void refreshVaultPath()
    }
  }, [open, refreshVaultPath])

  useEffect(() => {
    if (!open || visibleSection !== 'ai') {
      return
    }

    let cancelled = false
    setAiSettingsError(null)
    void assistantRuntime
      .getSettings()
      .then((confirmed) => {
        if (!cancelled) {
          setAiSettings(confirmed)
        }
      })
      .catch((loadError) => {
        if (!cancelled) {
          setAiSettingsError(formatError(loadError))
        }
      })

    return () => {
      cancelled = true
    }
  }, [open, visibleSection])

  const handleOpenAnotherVault = async (): Promise<void> => {
    setOpeningVault(true)
    try {
      await onOpenAnotherVault()
      await refreshVaultPath()
    } finally {
      setOpeningVault(false)
    }
  }

  const handleThemeChange = async (nextTheme: AppTheme): Promise<void> => {
    await settings.updateSettings({ theme: nextTheme })
  }

  const handleLocaleChange = async (nextLocale: AppLocale): Promise<void> => {
    await settings.updateSettings({ locale: nextLocale })
  }

  const handleDensityChange = async (nextDensity: UiDensity): Promise<void> => {
    await settings.updateSettings({ density: nextDensity })
  }

  const handleUiScaleChange = async (nextScale: number): Promise<void> => {
    await settings.updateSettings({ uiScale: nextScale })
  }

  const handleFileTreeSortChange = async (nextSort: FileTreeSortMode): Promise<void> => {
    await settings.updateSettings({ fileTreeSort: nextSort })
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className="h-[min(680px,calc(100vh-2rem))] w-[min(980px,calc(100vw-2rem))] max-w-none grid-cols-1 grid-rows-[auto_minmax(0,1fr)] gap-0 overflow-hidden bg-background p-0 sm:max-w-[980px] sm:grid-cols-[220px_minmax(0,1fr)] sm:grid-rows-1"
        aria-describedby="settings-description"
      >
        <aside className="min-h-0 border-b-2 border-foreground bg-chrome p-3 sm:border-r-2 sm:border-b-0 sm:p-4">
          <div className="mb-3 pr-8 sm:mb-5 sm:pr-0">
            <DialogTitle className="font-display text-2xl font-black">Settings</DialogTitle>
            <DialogDescription id="settings-description" className="mt-1 text-[10px]">
              Confirmed preferences apply immediately
            </DialogDescription>
          </div>

          <div className="relative mb-3">
            <label htmlFor="settings-search" className="sr-only">
              Search settings
            </label>
            <Search
              className="pointer-events-none absolute top-1/2 left-2.5 size-3.5 -translate-y-1/2 text-muted-foreground"
              aria-hidden="true"
            />
            <input
              id="settings-search"
              name="settings-search"
              type="search"
              autoComplete="off"
              value={query}
              autoFocus
              placeholder="Search settings…"
              className="h-9 w-full border-2 border-foreground bg-background pr-8 pl-8 font-mono text-xs outline-none placeholder:text-muted-foreground focus-visible:ring-[3px] focus-visible:ring-ring/50"
              onChange={(event) => setQuery(event.currentTarget.value)}
            />
            {query ? (
              <button
                type="button"
                className="absolute top-1/2 right-1.5 inline-flex size-6 -translate-y-1/2 items-center justify-center text-muted-foreground outline-none hover:bg-foreground hover:text-background focus-visible:ring-[3px] focus-visible:ring-ring/50"
                aria-label="Clear settings search"
                onClick={() => setQuery('')}
              >
                <X className="size-3" aria-hidden="true" />
              </button>
            ) : null}
          </div>

          <nav
            aria-label="Settings categories"
            className="flex gap-1 overflow-x-auto sm:block sm:max-h-[calc(100%-10rem)] sm:overflow-y-auto"
          >
            {matchingSections.map((item) => {
              const Icon = item.icon
              const active = item.id === visibleSection
              return (
                <button
                  key={item.id}
                  type="button"
                  className={cn(
                    'flex min-w-32 items-center gap-2 border-l-2 px-2.5 py-2 text-left font-mono text-[11px] font-bold uppercase tracking-wider outline-none transition-colors focus-visible:ring-[3px] focus-visible:ring-ring/50 motion-reduce:transition-none sm:mb-1 sm:w-full',
                    active
                      ? 'border-editorial-red bg-foreground text-background'
                      : 'border-transparent text-muted-foreground hover:border-foreground hover:bg-background hover:text-foreground'
                  )}
                  aria-current={active ? 'page' : undefined}
                  onClick={() => setSection(item.id)}
                >
                  <Icon className="size-3.5 shrink-0 opacity-75" aria-hidden="true" />
                  {item.label}
                </button>
              )
            })}
          </nav>

          {matchingSections.length === 0 ? (
            <p className="border-l-2 border-editorial-red px-2 py-1 font-mono text-[10px] leading-relaxed text-muted-foreground">
              No settings match “{query}”.
            </p>
          ) : null}

          {settings.isLoading || settings.isPending ? (
            <div
              className="mt-3 font-mono text-[9px] uppercase tracking-wider text-muted-foreground"
              aria-live="polite"
            >
              {settings.isPending ? 'Saving confirmed snapshot…' : 'Loading confirmed snapshot…'}
            </div>
          ) : null}
        </aside>

        <div className="min-h-0 overflow-y-auto overscroll-contain">
          {settings.error ? (
            <div
              className="sticky top-0 z-10 flex items-start justify-between gap-3 border-b-2 border-destructive bg-background px-5 py-3 font-mono text-[11px] leading-relaxed text-destructive"
              role="alert"
            >
              <span>{settings.error}</span>
              <button
                type="button"
                className="shrink-0 p-1 outline-none hover:bg-destructive hover:text-destructive-foreground focus-visible:ring-[3px] focus-visible:ring-ring/50"
                aria-label="Dismiss settings error"
                onClick={settings.dismissError}
              >
                <X className="size-3.5" aria-hidden="true" />
              </button>
            </div>
          ) : null}

          {visibleSection === 'general' ? (
            <GeneralSection
              theme={theme}
              locale={locale}
              density={density}
              uiScale={uiScale}
              fileTreeSort={fileTreeSort}
              vaultPath={vaultPath}
              openingVault={openingVault}
              settingsPending={settings.isPending || !settings.snapshot}
              onThemeChange={handleThemeChange}
              onLocaleChange={handleLocaleChange}
              onDensityChange={handleDensityChange}
              onUiScaleChange={handleUiScaleChange}
              onFileTreeSortChange={handleFileTreeSortChange}
              onOpenAnotherVault={handleOpenAnotherVault}
            />
          ) : null}
          {visibleSection === 'editor' ? (
            <EditorSection
              settings={snapshot}
              settingsPending={settings.isPending || !settings.snapshot}
              onChange={(patch) => settings.updateSettings(patch)}
            />
          ) : null}
          {visibleSection === 'workbench' ? <WorkbenchSection controller={settings} /> : null}
          {visibleSection === 'keymap' ? (
            <KeymapSettings
              controller={settings}
              query={query}
              platform={platform}
              onRecorderChange={onKeyRecorderChange}
            />
          ) : null}
          {visibleSection === 'ai' ? (
            <AiSection settings={aiSettings} error={aiSettingsError} onSaved={setAiSettings} />
          ) : null}
          {visibleSection === 'about' ? <AboutSection /> : null}
          {visibleSection === null ? <NoSearchResults query={query} /> : null}
        </div>
      </DialogContent>
    </Dialog>
  )
}

function GeneralSection({
  theme,
  locale,
  density,
  uiScale,
  fileTreeSort,
  vaultPath,
  openingVault,
  settingsPending,
  onThemeChange,
  onLocaleChange,
  onDensityChange,
  onUiScaleChange,
  onFileTreeSortChange,
  onOpenAnotherVault
}: {
  theme: AppTheme
  locale: AppLocale
  density: UiDensity
  uiScale: number
  fileTreeSort: FileTreeSortMode
  vaultPath: string | null
  openingVault: boolean
  settingsPending: boolean
  onThemeChange: (theme: AppTheme) => void | Promise<void>
  onLocaleChange: (locale: AppLocale) => void | Promise<void>
  onDensityChange: (density: UiDensity) => void | Promise<void>
  onUiScaleChange: (scale: number) => void | Promise<void>
  onFileTreeSortChange: (sort: FileTreeSortMode) => void
  onOpenAnotherVault: () => Promise<void>
}): React.JSX.Element {
  return (
    <SettingsPage
      eyebrow="Application"
      title="General"
      description="Appearance, navigation order, and the local folder currently in use."
    >
      <SettingGroup
        title={APP_SETTINGS_CATALOG.theme.label}
        description={APP_SETTINGS_CATALOG.theme.description}
      >
        <ChoiceGroup
          name="settings-theme"
          label="Theme"
          value={theme}
          options={APP_SETTINGS_CATALOG.theme.options}
          disabled={settingsPending}
          onChange={(value) => void onThemeChange(value as AppTheme)}
        />
      </SettingGroup>

      <SettingGroup
        title={APP_SETTINGS_CATALOG.locale.label}
        description={APP_SETTINGS_CATALOG.locale.description}
      >
        <ChoiceGroup
          name="settings-locale"
          label={APP_SETTINGS_CATALOG.locale.label}
          value={locale}
          options={APP_SETTINGS_CATALOG.locale.options}
          disabled={settingsPending}
          onChange={(value) => void onLocaleChange(value as AppLocale)}
        />
      </SettingGroup>

      <SettingGroup
        title={APP_SETTINGS_CATALOG.density.label}
        description={APP_SETTINGS_CATALOG.density.description}
      >
        <ChoiceGroup
          name="settings-density"
          label={APP_SETTINGS_CATALOG.density.label}
          value={density}
          options={APP_SETTINGS_CATALOG.density.options}
          disabled={settingsPending}
          onChange={(value) => void onDensityChange(value as UiDensity)}
        />
        <div className="mt-3 rounded-sm border border-border bg-card p-4">
          <div className="flex items-center justify-between gap-4">
            <label htmlFor="settings-ui-scale" className="font-mono text-xs font-medium">
              {APP_SETTINGS_CATALOG.uiScale.label}
            </label>
            <output
              htmlFor="settings-ui-scale"
              className="rounded-sm bg-foreground px-2 py-1 font-mono text-xs font-semibold tabular-nums text-background"
            >
              {uiScale}%
            </output>
          </div>
          <input
            id="settings-ui-scale"
            name="settings-ui-scale"
            type="range"
            min={APP_SETTINGS_CATALOG.uiScale.range.min}
            max={APP_SETTINGS_CATALOG.uiScale.range.max}
            step={APP_SETTINGS_CATALOG.uiScale.range.step}
            value={uiScale}
            disabled={settingsPending}
            className="mt-4 w-full accent-[var(--instrument-blue)]"
            onChange={(event) => void onUiScaleChange(event.currentTarget.valueAsNumber)}
          />
          <div className="mt-1 flex justify-between font-mono text-xs text-muted-foreground">
            <span>{APP_SETTINGS_CATALOG.uiScale.range.min}%</span>
            <span>{APP_SETTINGS_CATALOG.uiScale.range.max}%</span>
          </div>
        </div>
      </SettingGroup>

      <SettingGroup
        title={APP_SETTINGS_CATALOG.fileTreeSort.label}
        description={APP_SETTINGS_CATALOG.fileTreeSort.description}
      >
        <ChoiceGroup
          name="settings-file-sort"
          label="File tree sort"
          value={fileTreeSort}
          options={APP_SETTINGS_CATALOG.fileTreeSort.options}
          disabled={settingsPending}
          onChange={(value) => onFileTreeSortChange(value as FileTreeSortMode)}
        />
      </SettingGroup>

      <SettingGroup title="Vault" description="Notes remain files in this local folder.">
        <div className="border-2 border-foreground bg-card p-3">
          <div className="font-mono text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
            Current path
          </div>
          <code className="mt-1.5 block break-all font-mono text-xs text-foreground">
            {vaultPath ?? 'No vault open'}
          </code>
        </div>
        <Button
          type="button"
          variant="outline"
          className="mt-3"
          disabled={openingVault}
          onClick={() => void onOpenAnotherVault()}
        >
          {openingVault ? 'Opening…' : 'Open another vault…'}
        </Button>
      </SettingGroup>
    </SettingsPage>
  )
}

function EditorSection({
  settings,
  settingsPending,
  onChange
}: {
  settings: AppSettingsSnapshot
  settingsPending: boolean
  onChange: (patch: AppSettingsPatch) => Promise<unknown>
}): React.JSX.Element {
  return (
    <SettingsPage
      eyebrow="Writing voice"
      title="Editor"
      description="Choose how new notes open, then tune the source editor without changing the reading view."
    >
      <SettingGroup
        title={APP_SETTINGS_CATALOG.defaultNoteView.label}
        description={APP_SETTINGS_CATALOG.defaultNoteView.description}
      >
        <ChoiceGroup
          name="settings-default-note-view"
          label={APP_SETTINGS_CATALOG.defaultNoteView.label}
          value={settings.defaultNoteView}
          options={APP_SETTINGS_CATALOG.defaultNoteView.options}
          disabled={settingsPending}
          onChange={(value) => void onChange({ defaultNoteView: value as DefaultNoteViewSetting })}
        />
      </SettingGroup>

      <SettingGroup
        title={APP_SETTINGS_CATALOG.pagePreviewEnabled.label}
        description={APP_SETTINGS_CATALOG.pagePreviewEnabled.description}
      >
        <ToggleSetting
          id="settings-page-preview-enabled"
          label="Preview linked notes on hover"
          checked={settings.pagePreview.enabled}
          disabled={settingsPending}
          onChange={(enabled) => void onChange({ pagePreview: { enabled } })}
        />
        <ToggleSetting
          id="settings-page-preview-modifier"
          label={APP_SETTINGS_CATALOG.pagePreviewRequireModifier.label}
          description={APP_SETTINGS_CATALOG.pagePreviewRequireModifier.description}
          checked={settings.pagePreview.requireModifier}
          disabled={settingsPending || !settings.pagePreview.enabled}
          onChange={(requireModifier) => void onChange({ pagePreview: { requireModifier } })}
        />
      </SettingGroup>

      <SettingGroup
        title="Source typography"
        description="Choose a quiet editing voice, then tune its size and vertical rhythm independently from Reading view."
      >
        <div className="space-y-5 border border-border bg-card p-4">
          <ChoiceGroup
            name="settings-editor-font-family"
            label={APP_SETTINGS_CATALOG.editorFontFamily.label}
            value={settings.editorFontFamily}
            options={APP_SETTINGS_CATALOG.editorFontFamily.options}
            disabled={settingsPending}
            onChange={(value) =>
              void onChange({ editorFontFamily: value as EditorFontFamilySetting })
            }
          />
          <div className="grid gap-5 lg:grid-cols-2">
            <RangeSetting
              id="editor-font-size"
              label={APP_SETTINGS_CATALOG.editorFontSize.label}
              value={settings.editorFontSize}
              min={APP_SETTINGS_CATALOG.editorFontSize.range.min}
              max={APP_SETTINGS_CATALOG.editorFontSize.range.max}
              step={APP_SETTINGS_CATALOG.editorFontSize.range.step}
              suffix="px"
              disabled={settingsPending}
              onChange={(editorFontSize) => void onChange({ editorFontSize })}
            />
            <RangeSetting
              id="editor-line-height"
              label={APP_SETTINGS_CATALOG.editorLineHeight.label}
              value={settings.editorLineHeight}
              min={APP_SETTINGS_CATALOG.editorLineHeight.range.min}
              max={APP_SETTINGS_CATALOG.editorLineHeight.range.max}
              step={APP_SETTINGS_CATALOG.editorLineHeight.range.step}
              disabled={settingsPending}
              onChange={(editorLineHeight) => void onChange({ editorLineHeight })}
            />
          </div>
          <ChoiceGroup
            name="settings-editor-font-weight"
            label={APP_SETTINGS_CATALOG.editorFontWeight.label}
            value={settings.editorFontWeight}
            options={APP_SETTINGS_CATALOG.editorFontWeight.options}
            disabled={settingsPending}
            onChange={(value) =>
              void onChange({ editorFontWeight: value as EditorFontWeightSetting })
            }
          />
          <ToggleSetting
            id="settings-editor-ligatures"
            label={APP_SETTINGS_CATALOG.editorLigatures.label}
            description={APP_SETTINGS_CATALOG.editorLigatures.description}
            checked={settings.editorLigatures}
            disabled={settingsPending}
            onChange={(editorLigatures) => void onChange({ editorLigatures })}
          />
          <div
            className="border-l-2 border-instrument-blue bg-background px-4 py-3 text-foreground"
            style={{
              fontFamily: 'var(--editor-font-family)',
              fontSize: `${settings.editorFontSize}px`,
              fontWeight: settings.editorFontWeight === 'medium' ? 500 : 400,
              lineHeight: settings.editorLineHeight
            }}
          >
            Markdown remains the base layer. =&gt; MDX stays inspectable.
          </div>
        </div>
      </SettingGroup>

      <SettingGroup
        title="Wrapping by context"
        description="Raw Source follows IDE geometry; Live mode can keep a prose-friendly measure."
      >
        <div className="space-y-5 border border-border bg-card p-4">
          <ChoiceGroup
            name="settings-editor-note-wrap"
            label={APP_SETTINGS_CATALOG.editorNoteWordWrap.label}
            value={settings.editorNoteWordWrap}
            options={APP_SETTINGS_CATALOG.editorNoteWordWrap.options}
            disabled={settingsPending}
            onChange={(value) =>
              void onChange({ editorNoteWordWrap: value as EditorWordWrapSetting })
            }
          />
          <ChoiceGroup
            name="settings-editor-code-wrap"
            label={APP_SETTINGS_CATALOG.editorCodeWordWrap.label}
            value={settings.editorCodeWordWrap}
            options={APP_SETTINGS_CATALOG.editorCodeWordWrap.options}
            disabled={settingsPending}
            onChange={(value) =>
              void onChange({ editorCodeWordWrap: value as EditorWordWrapSetting })
            }
          />
          <RangeSetting
            id="editor-wrap-column"
            label={APP_SETTINGS_CATALOG.editorWrapColumn.label}
            value={settings.editorWrapColumn}
            min={APP_SETTINGS_CATALOG.editorWrapColumn.range.min}
            max={APP_SETTINGS_CATALOG.editorWrapColumn.range.max}
            step={APP_SETTINGS_CATALOG.editorWrapColumn.range.step}
            suffix=" col"
            disabled={settingsPending}
            onChange={(editorWrapColumn) => void onChange({ editorWrapColumn })}
          />
        </div>
      </SettingGroup>

      <SettingGroup
        title="Structure guides"
        description="Expose indentation and invisible characters only when they help inspect the source."
      >
        <div className="space-y-4 border border-border bg-card p-4">
          <ChoiceGroup
            name="settings-editor-tab-size"
            label={APP_SETTINGS_CATALOG.editorTabSize.label}
            value={settings.editorTabSize}
            options={APP_SETTINGS_CATALOG.editorTabSize.options}
            disabled={settingsPending}
            onChange={(value) => void onChange({ editorTabSize: value as EditorTabSizeSetting })}
          />
          <ChoiceGroup
            name="settings-editor-whitespace"
            label={APP_SETTINGS_CATALOG.editorWhitespace.label}
            value={settings.editorWhitespace}
            options={APP_SETTINGS_CATALOG.editorWhitespace.options}
            disabled={settingsPending}
            onChange={(value) =>
              void onChange({ editorWhitespace: value as EditorWhitespaceSetting })
            }
          />
          <ToggleSetting
            id="settings-editor-indent-guides"
            label={APP_SETTINGS_CATALOG.editorIndentGuides.label}
            description={APP_SETTINGS_CATALOG.editorIndentGuides.description}
            checked={settings.editorIndentGuides}
            disabled={settingsPending}
            onChange={(editorIndentGuides) => void onChange({ editorIndentGuides })}
          />
          <ToggleSetting
            id="settings-editor-ruler"
            label={APP_SETTINGS_CATALOG.editorRuler.label}
            description={APP_SETTINGS_CATALOG.editorRuler.description}
            checked={settings.editorRuler}
            disabled={settingsPending}
            onChange={(editorRuler) => void onChange({ editorRuler })}
          />
        </div>
      </SettingGroup>
    </SettingsPage>
  )
}

function RangeSetting({
  id,
  label,
  value,
  min,
  max,
  step,
  suffix = '',
  disabled,
  onChange
}: {
  id: string
  label: string
  value: number
  min: number
  max: number
  step: number
  suffix?: string
  disabled: boolean
  onChange: (value: number) => void
}): React.JSX.Element {
  return (
    <div>
      <div className="flex items-center justify-between gap-3">
        <label htmlFor={id} className="font-mono text-xs font-semibold uppercase tracking-wider">
          {label}
        </label>
        <output
          htmlFor={id}
          className="rounded-sm bg-foreground px-2 py-1 font-mono text-xs font-semibold text-background tabular-nums"
        >
          {value}
          {suffix}
        </output>
      </div>
      <input
        id={id}
        name={id}
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        disabled={disabled}
        className="mt-3 w-full accent-instrument-blue focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
        onChange={(event) => onChange(event.currentTarget.valueAsNumber)}
      />
      <div className="mt-1 flex justify-between font-mono text-xs text-muted-foreground tabular-nums">
        <span>{min}</span>
        <span>{max}</span>
      </div>
    </div>
  )
}

function ToggleSetting({
  id,
  label,
  description,
  checked,
  disabled,
  onChange
}: {
  id: string
  label: string
  description?: string
  checked: boolean
  disabled: boolean
  onChange: (checked: boolean) => void
}): React.JSX.Element {
  return (
    <label
      htmlFor={id}
      className={cn(
        'flex cursor-pointer items-start justify-between gap-4 border-2 border-foreground bg-card p-4',
        disabled && 'cursor-not-allowed opacity-55'
      )}
    >
      <span>
        <span className="block font-mono text-[11px] font-bold uppercase tracking-wider">
          {label}
        </span>
        {description ? (
          <span className="mt-1 block max-w-xl text-xs leading-relaxed text-muted-foreground">
            {description}
          </span>
        ) : null}
      </span>
      <input
        id={id}
        type="checkbox"
        className="mt-0.5 size-5 shrink-0 accent-editorial-red"
        checked={checked}
        disabled={disabled}
        onChange={(event) => onChange(event.currentTarget.checked)}
      />
    </label>
  )
}

function WorkbenchSection({
  controller
}: {
  controller: AppSettingsController
}): React.JSX.Element {
  const workbench = controller.snapshot?.workbench
  const disabled = controller.isPending || !workbench

  return (
    <SettingsPage
      eyebrow="Tab behavior"
      title="Workbench"
      description="Choose what becomes active after a tab closes and what Close Active Item does when no tabs remain."
    >
      {workbench ? (
        <>
          <SettingGroup
            title={APP_SETTINGS_CATALOG.activateOnClose.label}
            description={APP_SETTINGS_CATALOG.activateOnClose.description}
          >
            <ChoiceGroup
              name="settings-activate-on-close"
              label="Activate on close"
              value={workbench.activateOnClose}
              options={APP_SETTINGS_CATALOG.activateOnClose.options}
              disabled={disabled}
              onChange={(value) =>
                void controller.updateSettings({
                  workbench: {
                    activateOnClose: value as 'history' | 'right' | 'left'
                  }
                })
              }
            />
            <ResetButton
              disabled={
                disabled ||
                workbench.activateOnClose === APP_SETTINGS_CATALOG.activateOnClose.defaultValue
              }
              onClick={() =>
                void controller.updateSettings({
                  workbench: {
                    activateOnClose: APP_SETTINGS_CATALOG.activateOnClose.defaultValue
                  }
                })
              }
            />
          </SettingGroup>

          <SettingGroup
            title={APP_SETTINGS_CATALOG.whenClosingWithNoTabs.label}
            description={APP_SETTINGS_CATALOG.whenClosingWithNoTabs.description}
          >
            <ChoiceGroup
              name="settings-no-tabs"
              label="When closing with no tabs"
              value={workbench.whenClosingWithNoTabs}
              options={APP_SETTINGS_CATALOG.whenClosingWithNoTabs.options}
              disabled={disabled}
              onChange={(value) =>
                void controller.updateSettings({
                  workbench: {
                    whenClosingWithNoTabs: value as 'keep_window_open' | 'close_window'
                  }
                })
              }
            />
            <ResetButton
              disabled={
                disabled ||
                workbench.whenClosingWithNoTabs ===
                  APP_SETTINGS_CATALOG.whenClosingWithNoTabs.defaultValue
              }
              onClick={() =>
                void controller.updateSettings({
                  workbench: {
                    whenClosingWithNoTabs: APP_SETTINGS_CATALOG.whenClosingWithNoTabs.defaultValue
                  }
                })
              }
            />
          </SettingGroup>
        </>
      ) : (
        <div className="border-2 border-foreground bg-card p-4 font-mono text-xs text-muted-foreground">
          Loading confirmed workbench behavior…
        </div>
      )}
    </SettingsPage>
  )
}

function ResetButton({
  disabled,
  onClick
}: {
  disabled: boolean
  onClick: () => void
}): React.JSX.Element {
  return (
    <Button
      type="button"
      variant="ghost"
      size="xs"
      className="mt-2"
      disabled={disabled}
      onClick={onClick}
    >
      Reset to default
    </Button>
  )
}

function AiSection({
  settings,
  error,
  onSaved
}: {
  settings: AiPublicSettings | null
  error: string | null
  onSaved: (settings: AiPublicSettings) => void
}): React.JSX.Element {
  return (
    <SettingsPage
      eyebrow="On demand"
      title="AI"
      description="Assistant provider, model, and protected credentials."
    >
      <div className="border-l-2 border-editorial-red bg-muted px-3 py-2 font-mono text-[11px] leading-relaxed text-muted-foreground">
        API keys are encrypted by Electron safeStorage and never returned to this screen after
        saving.
      </div>
      {error ? (
        <div className="border-2 border-destructive bg-destructive/10 px-3 py-2 font-mono text-[11px] uppercase tracking-wider text-destructive">
          {error}
        </div>
      ) : settings ? (
        <AiSettingsForm settings={settings} onSaved={onSaved} />
      ) : (
        <div className="border-2 border-foreground bg-card p-4 font-mono text-xs text-muted-foreground">
          Loading secure AI settings…
        </div>
      )}
    </SettingsPage>
  )
}

function AboutSection(): React.JSX.Element {
  return (
    <SettingsPage
      eyebrow="Local-first MDX"
      title="About"
      description="A writing environment where Markdown stays foundational and React stays optional."
    >
      <div className="border-2 border-foreground bg-card shadow-[3px_3px_0_0_var(--foreground)]">
        <div className="border-b-2 border-foreground bg-foreground px-4 py-3 text-background">
          <div className="font-display text-2xl font-black">mdx-vault</div>
          <div className="mt-1 font-mono text-[10px] uppercase tracking-[0.15em] text-background/75">
            Version {packageJson.version}
          </div>
        </div>
        <p className="max-w-prose p-4 font-serif text-sm leading-relaxed">
          Notes live on your filesystem as plain MDX. Interactive islands appear only where the
          document needs behavior.
        </p>
      </div>
    </SettingsPage>
  )
}

function NoSearchResults({ query }: { query: string }): React.JSX.Element {
  return (
    <section className="p-7">
      <div className="border-2 border-foreground bg-card p-5 shadow-[3px_3px_0_0_var(--foreground)]">
        <Search className="size-5 text-muted-foreground" aria-hidden="true" />
        <h2 className="mt-3 font-display text-2xl font-black">No matching settings</h2>
        <p className="mt-2 max-w-prose text-sm leading-relaxed text-muted-foreground">
          Nothing matches “{query}”. Try a control name, action, category, or binding.
        </p>
      </div>
    </section>
  )
}

function ChoiceGroup({
  name,
  label,
  value,
  options,
  disabled = false,
  onChange
}: {
  name: string
  label: string
  value: string
  options: readonly ChoiceOption[]
  disabled?: boolean
  onChange: (value: string) => void
}): React.JSX.Element {
  return (
    <fieldset className="grid gap-2 sm:grid-cols-3" disabled={disabled}>
      <legend className="sr-only">{label}</legend>
      {options.map((option) => {
        const selected = option.value === value
        return (
          <label
            key={option.value}
            className={cn(
              'relative min-h-20 cursor-pointer border-2 p-3 text-left outline-none transition-colors focus-within:ring-[3px] focus-within:ring-ring/50 motion-reduce:transition-none',
              selected
                ? 'border-foreground bg-foreground text-background shadow-[2px_2px_0_0_var(--editorial-red)]'
                : 'border-foreground bg-card text-foreground hover:bg-muted',
              disabled && 'cursor-not-allowed opacity-40'
            )}
          >
            <input
              type="radio"
              name={name}
              value={option.value}
              checked={selected}
              className="sr-only"
              onChange={() => onChange(option.value)}
            />
            <span className="block font-mono text-[11px] font-bold uppercase tracking-wider">
              {option.label}
            </span>
            <span
              className={cn(
                'mt-1 block text-[11px] leading-snug',
                selected ? 'text-background/70' : 'text-muted-foreground'
              )}
            >
              {option.description}
            </span>
          </label>
        )
      })}
    </fieldset>
  )
}

function getKeybindingPlatform(): KeybindingPlatform {
  const platform = window.windowApi?.platform
  if (platform === 'darwin' || platform === 'win32') {
    return platform
  }
  return 'linux'
}

function matchesSearchText(searchText: string, query: string): boolean {
  const haystack = searchText.toLocaleLowerCase()
  return query
    .trim()
    .toLocaleLowerCase()
    .split(/\s+/)
    .every((term) => haystack.includes(term))
}
