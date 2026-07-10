export interface CommandAction {
  id: string
  title: string
  description: string
  category: string
  keywords?: string[]
  hotkeys?: string[]
  disabled?: boolean
  run: () => void | Promise<void>
}
