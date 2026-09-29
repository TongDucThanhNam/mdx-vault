export type AiPanelState = 'no-note' | 'loading' | 'no-key' | 'storage-unavailable' | 'ready'

export function selectAiPanelState(input: {
  noteOpen: boolean
  settingsLoaded: boolean
  hasApiKey: boolean
  safeStorageAvailable: boolean
}): { state: AiPanelState; composerHint: string; emptyHint: string } {
  if (!input.noteOpen)
    return {
      state: 'no-note',
      composerHint: 'Open a note to chat about it…',
      emptyHint: 'Open a note, then ask the assistant for help.'
    }
  if (!input.settingsLoaded)
    return {
      state: 'loading',
      composerHint: 'Checking assistant settings…',
      emptyHint: 'Checking assistant settings…'
    }
  if (!input.safeStorageAvailable)
    return {
      state: 'storage-unavailable',
      composerHint: 'Secure key storage is unavailable.',
      emptyHint: 'Secure key storage is unavailable. Check your system settings.'
    }
  if (!input.hasApiKey)
    return {
      state: 'no-key',
      composerHint: 'Add an API key in AI settings to chat…',
      emptyHint: 'Add an API key to use the assistant with this note.'
    }
  return {
    state: 'ready',
    composerHint: 'Ask the assistant. Enter sends, Shift+Enter inserts a newline.',
    emptyHint: 'Select prose or ask about this note.'
  }
}
