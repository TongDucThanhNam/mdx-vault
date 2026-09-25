import { createContext, useContext } from 'react'

import {
  type AppSettingsSnapshot,
  DEFAULT_APP_SETTINGS_SNAPSHOT
} from '../../../shared/app-settings'

export const PagePreviewSettingsContext = createContext<AppSettingsSnapshot['pagePreview']>(
  DEFAULT_APP_SETTINGS_SNAPSHOT.pagePreview
)

export function usePagePreviewSettings(): AppSettingsSnapshot['pagePreview'] {
  return useContext(PagePreviewSettingsContext)
}
