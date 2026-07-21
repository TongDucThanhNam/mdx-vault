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
import { APP_SETTINGS_CATALOG, appSettingSearchText } from '../../../shared/app-settings'
import type { KeybindingPlatform } from '../../../shared/workspace-actions'
import { KeymapSettings } from './KeymapSettings'
import { keymapMatchesQuery } from './keymap-search'
import { SettingGroup, SettingsPage } from './SettingsLayout'

type SettingsSectionId = 'general' | 'editor' | 'workbench' | 'keymap' | 'ai' | 'about'

export interface SettingsDialogProps {
  open: boolean
  editorFontSize: number
  onOpenChange: (open: boolean) => void
  onEditorFontSizeChange: (fontSize: number) => void | Promise<void>
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
      APP_SETTINGS_CATALOG.fileTreeSort
    ])} vault folder path`
  },
  {
    id: 'editor',
    label: 'Editor',
    icon: FileText,
    searchText: appSettingSearchText([APP_SETTINGS_CATALOG.editorFontSize])
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
  editorFontSize,
  onOpenChange,
  onEditorFontSizeChange,
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
  const keymapOverrides = settings.snapshot?.keymapOverrides ?? {}
  const theme = settings.snapshot?.theme ?? APP_SETTINGS_CATALOG.theme.defaultValue
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

  const handleFileTreeSortChange = async (nextSort: FileTreeSortMode): Promise<void> => {
    await settings.updateSettings({ fileTreeSort: nextSort })
  }

  const handleEditorFontSizeChange = async (nextSize: number): Promise<void> => {
    const confirmed = await settings.updateSettings({ editorFontSize: nextSize })
    if (confirmed) {
      try {
        await onEditorFontSizeChange(confirmed.editorFontSize)
      } catch (applyError) {
        settings.reportError(
          `Font size was saved, but the editor could not apply it. ${formatError(applyError)}`
        )
      }
    }
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
              type="search"
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

        <div className="min-h-0 overflow-y-auto">
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
              fileTreeSort={fileTreeSort}
              vaultPath={vaultPath}
              openingVault={openingVault}
              settingsPending={settings.isPending || !settings.snapshot}
              onThemeChange={handleThemeChange}
              onFileTreeSortChange={handleFileTreeSortChange}
              onOpenAnotherVault={handleOpenAnotherVault}
            />
          ) : null}
          {visibleSection === 'editor' ? (
            <EditorSection
              editorFontSize={editorFontSize}
              settingsPending={settings.isPending || !settings.snapshot}
              onEditorFontSizeChange={handleEditorFontSizeChange}
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
  fileTreeSort,
  vaultPath,
  openingVault,
  settingsPending,
  onThemeChange,
  onFileTreeSortChange,
  onOpenAnotherVault
}: {
  theme: AppTheme
  fileTreeSort: FileTreeSortMode
  vaultPath: string | null
  openingVault: boolean
  settingsPending: boolean
  onThemeChange: (theme: AppTheme) => void | Promise<void>
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
  editorFontSize,
  settingsPending,
  onEditorFontSizeChange
}: {
  editorFontSize: number
  settingsPending: boolean
  onEditorFontSizeChange: (fontSize: number) => void | Promise<void>
}): React.JSX.Element {
  return (
    <SettingsPage
      eyebrow="Writing voice"
      title="Editor"
      description="Tune the source editor while keeping the reading view unchanged."
    >
      <SettingGroup
        title={APP_SETTINGS_CATALOG.editorFontSize.label}
        description={APP_SETTINGS_CATALOG.editorFontSize.description}
      >
        <div className="border-2 border-foreground bg-card p-4">
          <div className="flex items-end justify-between gap-4">
            <label
              htmlFor="editor-font-size"
              className="font-mono text-[11px] font-bold uppercase tracking-wider"
            >
              Source editor
            </label>
            <output
              htmlFor="editor-font-size"
              className="border-2 border-foreground bg-foreground px-2 py-1 font-mono text-xs font-bold tabular-nums text-background"
            >
              {editorFontSize}px
            </output>
          </div>
          <input
            id="editor-font-size"
            type="range"
            min={APP_SETTINGS_CATALOG.editorFontSize.range.min}
            max={APP_SETTINGS_CATALOG.editorFontSize.range.max}
            step={APP_SETTINGS_CATALOG.editorFontSize.range.step}
            value={editorFontSize}
            disabled={settingsPending}
            className="mt-5 w-full accent-editorial-red"
            onChange={(event) => void onEditorFontSizeChange(event.currentTarget.valueAsNumber)}
          />
          <div className="mt-1 flex justify-between font-mono text-[10px] text-muted-foreground">
            <span>{APP_SETTINGS_CATALOG.editorFontSize.range.min}px</span>
            <span>{APP_SETTINGS_CATALOG.editorFontSize.range.max}px</span>
          </div>
          <p
            className="mt-4 border-l-2 border-editorial-red pl-3 font-mono leading-relaxed"
            style={{ fontSize: `${editorFontSize}px` }}
          >
            Markdown remains the base layer.
          </p>
        </div>
      </SettingGroup>
    </SettingsPage>
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
