import { describe, expect, test } from 'bun:test'
import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'

import { RightPanel } from '../src/renderer/src/components/layout/RightPanel'
import type { KnowledgeUtilitiesController } from '../src/renderer/src/hooks/useKnowledgeUtilities'
import { I18nProvider } from '../src/renderer/src/i18n/I18nProvider'
import type { KnowledgePanelId } from '../src/shared/knowledge'

const controller = {
  snapshot: null,
  propertyInventory: [],
  bookmarks: { version: 1, revision: 0, children: [] },
  isLoading: false,
  isMutating: false,
  refresh: async () => undefined,
  mutateProperty: async () => false,
  linkMention: async () => false,
  planPropertyRename: async () => null,
  applyPropertyRename: async () => false,
  saveBookmarks: async () => false
} satisfies KnowledgeUtilitiesController

const noteIndex = {
  indexNotes: [],
  outlineHeadings: [],
  tags: [],
  selectedTag: null,
  taggedNotes: [],
  isLoadingTaggedNotes: false,
  backlinks: [],
  setSelectedTag: () => undefined
}

const panels: Array<[KnowledgePanelId, string]> = [
  ['outline', 'Outline'],
  ['tags', 'Tags'],
  ['backlinks', 'Backlinks'],
  ['outgoing', 'Outgoing links'],
  ['properties', 'Properties'],
  ['bookmarks', 'Bookmarks'],
  ['footnotes', 'Footnotes'],
  ['local-graph', 'Local graph']
]

describe('context utility selector', () => {
  test('keeps all eight destinations in one keyboard-native selector at fixed panel width', () => {
    const html = renderPanel('outline')
    expect((html.match(/<option/g) ?? []).length).toBe(8)
    expect(html).toContain('aria-label="Context utilities"')
    expect(html).toContain('id="context-utility-selector"')
    for (const [id, label] of panels) {
      expect(html).toContain(`value="${id}"`)
      expect(html).toContain(label)
    }
  })

  test('renders every controlled destination without private tab state', () => {
    for (const [id, label] of panels) {
      const html = renderPanel(id)
      expect(html).toContain(`context-utility-panel-${id}`)
      expect(html).toContain(label)
    }
  })
})

function renderPanel(activePanel: KnowledgePanelId): string {
  return renderToStaticMarkup(
    createElement(
      I18nProvider,
      { locale: 'en' },
      createElement(RightPanel, {
        activePanel,
        hasVault: true,
        vaultSessionId: 1,
        selectedPath: null,
        localGraphRoot: null,
        localGraphUnavailableReason: 'no-active-note',
        source: '',
        isDirty: false,
        propertyAddRequest: 0,
        noteIndex,
        outlineHeadings: [],
        activeHeadingId: null,
        knowledge: controller,
        onActivePanelChange: () => undefined,
        onSelectHeading: () => undefined,
        onBookmarkHeading: () => undefined,
        onRevealRange: () => undefined,
        onSelectNote: async () => true,
        onSelectBookmarkHeading: () => undefined,
        onSelectBookmarkFolder: () => undefined,
        onOpenSearch: () => undefined,
        onBookmarkNote: () => undefined,
        onCopyRelativePath: () => undefined,
        onRevealInExplorer: () => undefined
      })
    )
  )
}
