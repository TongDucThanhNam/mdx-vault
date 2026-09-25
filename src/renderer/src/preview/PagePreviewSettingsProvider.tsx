import type { ReactNode } from 'react'

import type { AppSettingsSnapshot } from '../../../shared/app-settings'
import { PagePreviewSettingsContext } from './page-preview-settings'

export function PagePreviewSettingsProvider({
  children,
  settings
}: {
  children: ReactNode
  settings: AppSettingsSnapshot['pagePreview']
}): React.JSX.Element {
  return (
    <PagePreviewSettingsContext.Provider value={settings}>
      {children}
    </PagePreviewSettingsContext.Provider>
  )
}
