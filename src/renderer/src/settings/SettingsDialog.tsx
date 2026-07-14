import { Bot, FileText, Info, Settings2 } from 'lucide-react'
import { useCallback, useEffect, useState } from 'react'
import { createAssistantRuntime } from '@/ai/assistant-client'
import { AiSettingsForm } from '@/ai/panels/AiSettingsPanel'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogDescription, DialogTitle } from '@/components/ui/dialog'
import type { FileTreeSortMode } from '@/explorer/FileTree'
import { MAX_EDITOR_FONT_SIZE, MIN_EDITOR_FONT_SIZE } from '@/hooks/useEditorFontSize'
import type { AppTheme } from '@/hooks/useTheme'
import { formatError } from '@/lib/format-error'
import { cn } from '@/lib/utils'
import packageJson from '../../../../package.json'
import type { AiPublicSettings } from '../../../shared/ai'

type SettingsSectionId = 'general' | 'editor' | 'ai' | 'about'

interface SettingsDialogProps {
  open: boolean
  theme: AppTheme
  fileTreeSort: FileTreeSortMode
  editorFontSize: number
  onOpenChange: (open: boolean) => void
  onThemeChange: (theme: AppTheme) => void | Promise<void>
  onFileTreeSortChange: (sort: FileTreeSortMode) => void
  onEditorFontSizeChange: (fontSize: number) => void | Promise<void>
  onOpenAnotherVault: () => Promise<void>
}

interface ChoiceOption {
  value: string
  label: string
  description: string
}

const SECTIONS: ReadonlyArray<{
  id: SettingsSectionId
  label: string
  icon: typeof Settings2
}> = [
  { id: 'general', label: 'General', icon: Settings2 },
  { id: 'editor', label: 'Editor', icon: FileText },
  { id: 'ai', label: 'AI', icon: Bot },
  { id: 'about', label: 'About', icon: Info }
]

const THEME_OPTIONS: ReadonlyArray<ChoiceOption> = [
  { value: 'light', label: 'Light', description: 'Warm paper edition' },
  { value: 'dark', label: 'Dark', description: "Tonight's edition" },
  { value: 'system', label: 'System', description: 'Follow this device' }
]

const FILE_TREE_SORT_OPTIONS: ReadonlyArray<ChoiceOption> = [
  { value: 'name', label: 'Name', description: 'A–Z by path' },
  { value: 'modified-desc', label: 'Modified', description: 'Recently edited first' },
  { value: 'created-desc', label: 'Created', description: 'Newest first' }
]

const assistantRuntime = createAssistantRuntime()

export function SettingsDialog({
  open,
  theme,
  fileTreeSort,
  editorFontSize,
  onOpenChange,
  onThemeChange,
  onFileTreeSortChange,
  onEditorFontSizeChange,
  onOpenAnotherVault
}: SettingsDialogProps): React.JSX.Element {
  const [section, setSection] = useState<SettingsSectionId>('general')
  const [vaultPath, setVaultPath] = useState<string | null>(null)
  const [openingVault, setOpeningVault] = useState(false)
  const [aiSettings, setAiSettings] = useState<AiPublicSettings | null>(null)
  const [aiSettingsError, setAiSettingsError] = useState<string | null>(null)

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
    if (!open || section !== 'ai') {
      return
    }

    let cancelled = false
    setAiSettingsError(null)
    void assistantRuntime
      .getSettings()
      .then((settings) => {
        if (!cancelled) {
          setAiSettings(settings)
        }
      })
      .catch((error) => {
        if (!cancelled) {
          setAiSettingsError(formatError(error))
        }
      })

    return () => {
      cancelled = true
    }
  }, [open, section])

  const handleOpenAnotherVault = async (): Promise<void> => {
    setOpeningVault(true)
    try {
      await onOpenAnotherVault()
      await refreshVaultPath()
    } finally {
      setOpeningVault(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className="h-[min(520px,calc(100vh-2rem))] w-[min(760px,calc(100vw-2rem))] max-w-none grid-cols-1 grid-rows-[auto_minmax(0,1fr)] gap-0 overflow-hidden bg-background p-0 sm:max-w-[760px] sm:grid-cols-[184px_minmax(0,1fr)] sm:grid-rows-1"
        aria-describedby="settings-description"
      >
        <aside className="border-b-2 border-foreground bg-chrome p-3 sm:border-r-2 sm:border-b-0 sm:p-4">
          <div className="mb-3 pr-8 sm:mb-6 sm:pr-0">
            <DialogTitle className="font-display text-2xl font-black">Settings</DialogTitle>
            <DialogDescription id="settings-description" className="mt-1 text-[10px]">
              Preferences apply immediately
            </DialogDescription>
          </div>

          <nav aria-label="Settings categories" className="flex gap-1 overflow-x-auto sm:block">
            {SECTIONS.map((item) => {
              const Icon = item.icon
              const active = item.id === section
              return (
                <button
                  key={item.id}
                  type="button"
                  className={cn(
                    'flex min-w-28 items-center gap-2 border-l-2 px-2.5 py-2 text-left font-mono text-[11px] font-bold uppercase tracking-wider outline-none transition-colors focus-visible:ring-[3px] focus-visible:ring-ring/50 motion-reduce:transition-none sm:mb-1 sm:w-full',
                    active
                      ? 'border-[var(--editorial-red)] bg-foreground text-background'
                      : 'border-transparent text-muted-foreground hover:border-foreground hover:bg-background hover:text-foreground'
                  )}
                  aria-current={active ? 'page' : undefined}
                  onClick={() => setSection(item.id)}
                >
                  <Icon className="size-3.5 shrink-0" aria-hidden="true" />
                  {item.label}
                </button>
              )
            })}
          </nav>
        </aside>

        <div className="min-h-0 overflow-y-auto">
          {section === 'general' ? (
            <GeneralSection
              theme={theme}
              fileTreeSort={fileTreeSort}
              vaultPath={vaultPath}
              openingVault={openingVault}
              onThemeChange={onThemeChange}
              onFileTreeSortChange={onFileTreeSortChange}
              onOpenAnotherVault={handleOpenAnotherVault}
            />
          ) : null}
          {section === 'editor' ? (
            <EditorSection
              editorFontSize={editorFontSize}
              onEditorFontSizeChange={onEditorFontSizeChange}
            />
          ) : null}
          {section === 'ai' ? (
            <AiSection settings={aiSettings} error={aiSettingsError} onSaved={setAiSettings} />
          ) : null}
          {section === 'about' ? <AboutSection /> : null}
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
  onThemeChange,
  onFileTreeSortChange,
  onOpenAnotherVault
}: {
  theme: AppTheme
  fileTreeSort: FileTreeSortMode
  vaultPath: string | null
  openingVault: boolean
  onThemeChange: (theme: AppTheme) => void | Promise<void>
  onFileTreeSortChange: (sort: FileTreeSortMode) => void
  onOpenAnotherVault: () => Promise<void>
}): React.JSX.Element {
  return (
    <SettingsSection
      eyebrow="Application"
      title="General"
      description="Appearance, navigation order, and the local folder currently in use."
    >
      <SettingGroup title="Theme" description="Choose the edition used across the application.">
        <ChoiceGroup
          label="Theme"
          value={theme}
          options={THEME_OPTIONS}
          onChange={(value) => void onThemeChange(value as AppTheme)}
        />
      </SettingGroup>

      <SettingGroup
        title="File tree sort"
        description="Change how files are ordered in the vault explorer."
      >
        <ChoiceGroup
          label="File tree sort"
          value={fileTreeSort}
          options={FILE_TREE_SORT_OPTIONS}
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
    </SettingsSection>
  )
}

function EditorSection({
  editorFontSize,
  onEditorFontSizeChange
}: {
  editorFontSize: number
  onEditorFontSizeChange: (fontSize: number) => void | Promise<void>
}): React.JSX.Element {
  return (
    <SettingsSection
      eyebrow="Writing voice"
      title="Editor"
      description="Tune the source editor while keeping the reading view unchanged."
    >
      <SettingGroup
        title="Font size"
        description="Applies immediately to MDX notes and plain-text files."
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
            min={MIN_EDITOR_FONT_SIZE}
            max={MAX_EDITOR_FONT_SIZE}
            step={0.5}
            value={editorFontSize}
            className="mt-5 w-full accent-[var(--editorial-red)]"
            onChange={(event) => void onEditorFontSizeChange(event.currentTarget.valueAsNumber)}
          />
          <div className="mt-1 flex justify-between font-mono text-[10px] text-muted-foreground">
            <span>{MIN_EDITOR_FONT_SIZE}px</span>
            <span>{MAX_EDITOR_FONT_SIZE}px</span>
          </div>
          <p
            className="mt-4 border-l-2 border-[var(--editorial-red)] pl-3 font-mono leading-relaxed"
            style={{ fontSize: `${editorFontSize}px` }}
          >
            Markdown remains the base layer.
          </p>
        </div>
      </SettingGroup>
    </SettingsSection>
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
    <SettingsSection
      eyebrow="On demand"
      title="AI"
      description="Assistant provider, model, and protected credentials."
    >
      <div className="border-l-2 border-[var(--editorial-red)] bg-muted px-3 py-2 font-mono text-[11px] leading-relaxed text-muted-foreground">
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
    </SettingsSection>
  )
}

function AboutSection(): React.JSX.Element {
  return (
    <SettingsSection
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
        <p className="p-4 font-serif text-sm leading-relaxed">
          Notes live on your filesystem as plain MDX. Interactive islands appear only where the
          document needs behavior.
        </p>
      </div>
    </SettingsSection>
  )
}

function SettingsSection({
  eyebrow,
  title,
  description,
  children
}: {
  eyebrow: string
  title: string
  description: string
  children: React.ReactNode
}): React.JSX.Element {
  return (
    <section className="p-5 sm:p-7">
      <header className="mb-7 border-b-2 border-foreground pb-4 pr-8">
        <div className="font-mono text-[10px] font-bold uppercase tracking-[0.18em] text-[var(--editorial-red)]">
          {eyebrow}
        </div>
        <h2 className="mt-1 font-display text-3xl font-black tracking-tight">{title}</h2>
        <p className="mt-2 max-w-xl text-sm leading-relaxed text-muted-foreground">{description}</p>
      </header>
      <div className="space-y-7">{children}</div>
    </section>
  )
}

function SettingGroup({
  title,
  description,
  children
}: {
  title: string
  description: string
  children: React.ReactNode
}): React.JSX.Element {
  return (
    <section>
      <h3 className="font-mono text-xs font-bold uppercase tracking-[0.14em]">{title}</h3>
      <p className="mt-1 mb-3 text-xs leading-relaxed text-muted-foreground">{description}</p>
      {children}
    </section>
  )
}

function ChoiceGroup({
  label,
  value,
  options,
  onChange
}: {
  label: string
  value: string
  options: ReadonlyArray<ChoiceOption>
  onChange: (value: string) => void
}): React.JSX.Element {
  return (
    <div role="radiogroup" aria-label={label} className="grid gap-2 sm:grid-cols-3">
      {options.map((option) => {
        const selected = option.value === value
        return (
          <button
            key={option.value}
            type="button"
            role="radio"
            aria-checked={selected}
            className={cn(
              'min-h-20 border-2 p-3 text-left outline-none transition-colors focus-visible:ring-[3px] focus-visible:ring-ring/50 motion-reduce:transition-none',
              selected
                ? 'border-foreground bg-foreground text-background shadow-[2px_2px_0_0_var(--editorial-red)]'
                : 'border-foreground bg-card text-foreground hover:bg-muted'
            )}
            onClick={() => onChange(option.value)}
          >
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
          </button>
        )
      })}
    </div>
  )
}
