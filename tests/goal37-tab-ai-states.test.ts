import { describe, expect, test } from 'bun:test'
import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { AiComposer } from '../src/renderer/src/ai/panels/AiComposer'
import { AiMessageList } from '../src/renderer/src/ai/panels/AiMessageList'
import { selectAiPanelState } from '../src/renderer/src/ai/panels/ai-panel-state'
import {
  tabOverflowEdges,
  tabScrollTarget,
  tabVisibleRange
} from '../src/renderer/src/components/layout/tab-overflow'
import { findKeyBindingConflicts } from '../src/shared/keybindings'

describe('GOAL-37 tab overflow', () => {
  const spans = Array.from({ length: 17 }, (_, index) => ({
    id: `tab-${index}`,
    start: index * 140,
    end: (index + 1) * 140
  }))

  test('tracks complete and partially visible tabs without losing hidden items', () => {
    expect(tabVisibleRange(spans, 0, 560)).toEqual({ first: 0, last: 3 })
    expect(tabVisibleRange(spans, 280, 560)).toEqual({ first: 2, last: 5 })
    expect(tabVisibleRange(spans, 2000, 380)).toEqual({ first: 14, last: 16 })
  })

  test('scrolls active tab to nearest edge and marks overflowing sides', () => {
    expect(tabScrollTarget(spans[10]!, 0, 560)).toBe(980)
    expect(tabScrollTarget(spans[1]!, 560, 560)).toBe(140)
    expect(tabScrollTarget(spans[4]!, 560, 560)).toBe(560)
    expect(tabOverflowEdges(0, 560, 2380)).toEqual({ left: false, right: true })
    expect(tabOverflowEdges(500, 560, 2380)).toEqual({ left: true, right: true })
    expect(tabOverflowEdges(1820, 560, 2380)).toEqual({ left: true, right: false })
  })
})

describe('GOAL-37 AI copy and editor chords', () => {
  test('selects honest copy for note, key, secure storage and ready states', () => {
    const noNote = selectAiPanelState({
      noteOpen: false,
      settingsLoaded: true,
      hasApiKey: false,
      safeStorageAvailable: true
    })
    expect(noNote.state).toBe('no-note')
    expect(noNote.composerHint).toContain('Open a note')
    const noKey = selectAiPanelState({
      noteOpen: true,
      settingsLoaded: true,
      hasApiKey: false,
      safeStorageAvailable: true
    })
    expect(noKey.state).toBe('no-key')
    expect(noKey.emptyHint).toContain('API key')
    expect(noKey.composerHint).not.toContain('Open a note')
    expect(
      selectAiPanelState({
        noteOpen: true,
        settingsLoaded: true,
        hasApiKey: true,
        safeStorageAvailable: false
      }).state
    ).toBe('storage-unavailable')
    expect(
      selectAiPanelState({
        noteOpen: true,
        settingsLoaded: true,
        hasApiKey: true,
        safeStorageAvailable: true
      }).state
    ).toBe('ready')
  })

  test('Ctrl+H and Ctrl+Shift+H have no workbench binding conflict on Windows/Linux', () => {
    for (const platform of ['win32', 'linux'] as const) {
      expect(findKeyBindingConflicts('editor.replace', 'Ctrl+H', platform, {})).toEqual([])
      expect(findKeyBindingConflicts('editor.highlight', 'Ctrl+Shift+H', platform, {})).toEqual([])
    }
  })

  test('busy, error, and cancelled assistant states retain visible feedback', () => {
    const transcript = (streaming: boolean, error: string | null) =>
      renderToStaticMarkup(
        createElement(AiMessageList, {
          messages: [],
          toolCalls: [],
          proposal: null,
          error: error ? { message: error, code: 'TEST_ERROR' } : null,
          streaming
        })
      )
    const composer = (busy: boolean) =>
      renderToStaticMarkup(
        createElement(AiComposer, {
          disabled: false,
          busy,
          onSend: () => undefined,
          onCancel: () => undefined
        })
      )
    expect(transcript(true, null)).toContain('Thinking…')
    expect(composer(true)).toContain('Cancel assistant request')
    expect(transcript(false, 'Request failed')).toContain('Request failed')
    expect(transcript(false, null)).not.toContain('Thinking…')
    expect(composer(false)).not.toContain('Cancel assistant request')
  })
})
