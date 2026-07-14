import { electronApp, is, optimizer } from '@electron-toolkit/utils'
import { app, BrowserWindow, ipcMain, shell } from 'electron'
import { join } from 'path'
import { z } from 'zod'
import icon from '../../resources/icon.png?asset'
import { registerAiIpc } from './ipc/ai-ipc'
import { registerExportIpc } from './ipc/export-ipc'
import { registerIndexIpc } from './ipc/index-ipc'
import { registerSandboxIpc } from './ipc/sandbox-ipc'
import { registerVaultIpc } from './ipc/vault-ipc'
import { registerWindowIpc, registerWindowStateEvents } from './ipc/window-ipc'
import {
  AppSettingsService,
  MAX_EDITOR_FONT_SIZE,
  MIN_EDITOR_FONT_SIZE
} from './services/app-settings'
import {
  registerSandboxDocumentProtocol,
  registerSandboxDocumentScheme
} from './services/sandbox-document-protocol'
import { closeCurrentVault } from './services/vault-session'

registerSandboxDocumentScheme()

function enableNativeVisualZoom(mainWindow: BrowserWindow): void {
  const applyVisualZoomLimits = (): void => {
    void mainWindow.webContents.setVisualZoomLevelLimits(1, 4)
  }

  applyVisualZoomLimits()
  mainWindow.webContents.on('did-finish-load', applyVisualZoomLimits)
}

function createWindow(): void {
  // Create the browser window.
  const mainWindow = new BrowserWindow({
    width: 1280,
    height: 820,
    minWidth: 980,
    minHeight: 640,
    show: false,
    autoHideMenuBar: true,
    titleBarStyle: process.platform === 'darwin' ? 'hiddenInset' : 'hidden',
    ...(process.platform === 'linux' ? { icon } : {}),
    webPreferences: {
      preload: join(__dirname, '../preload/index.js'),
      nodeIntegration: false,
      contextIsolation: true,
      sandbox: true,
      webSecurity: true
    }
  })

  enableNativeVisualZoom(mainWindow)
  registerWindowStateEvents(mainWindow)

  mainWindow.on('ready-to-show', () => {
    mainWindow.show()
  })

  mainWindow.webContents.setWindowOpenHandler((details) => {
    shell.openExternal(details.url)
    return { action: 'deny' }
  })

  // HMR for renderer base on electron-vite cli.
  // Load the remote URL for development or the local html file for production.
  if (is.dev && process.env['ELECTRON_RENDERER_URL']) {
    mainWindow.loadURL(process.env['ELECTRON_RENDERER_URL'])
  } else {
    mainWindow.loadFile(join(__dirname, '../renderer/index.html'))
  }
}

// This method will be called when Electron has finished
// initialization and is ready to create browser windows.
// Some APIs can only be used after this event occurs.
app.whenReady().then(() => {
  // Set app user model id for windows
  electronApp.setAppUserModelId('com.electron')

  // Default open or close DevTools by F12 in development
  // and ignore CommandOrControl + R in production.
  // see https://github.com/alex8088/electron-toolkit/tree/master/packages/utils
  app.on('browser-window-created', (_, window) => {
    optimizer.watchWindowShortcuts(window)
  })

  const appSettings = new AppSettingsService(app.getPath('userData'))

  registerSandboxDocumentProtocol()
  registerVaultIpc({
    onIndexChanged: broadcastIndexChanged,
    onTreeChanged: broadcastVaultTreeChanged,
    appSettings
  })
  registerIndexIpc({ onIndexChanged: broadcastIndexChanged })
  registerSandboxIpc()
  registerAiIpc()
  registerExportIpc()
  registerWindowIpc()
  registerAppSettingsIpc(appSettings)

  createWindow()

  app.on('activate', () => {
    // On macOS it's common to re-create a window in the app when the
    // dock icon is clicked and there are no other windows open.
    if (BrowserWindow.getAllWindows().length === 0) createWindow()
  })
})

// Quit when all windows are closed, except on macOS. There, it's common
// for applications and their menu bar to stay active until the user quits
// explicitly with Cmd + Q.
app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit()
  }
})

app.on('before-quit', () => {
  void closeCurrentVault()
})

// In this file you can include the rest of your app's specific main process
// code. You can also put them in separate files and require them here.

function broadcastIndexChanged(): void {
  for (const window of BrowserWindow.getAllWindows()) {
    if (!window.isDestroyed()) {
      window.webContents.send('index:changed')
    }
  }
}

function broadcastVaultTreeChanged(): void {
  for (const window of BrowserWindow.getAllWindows()) {
    if (!window.isDestroyed()) {
      window.webContents.send('vault:tree-changed')
    }
  }
}

/**
 * Theme + UI prefs IPC. These live outside the vault (app userData), so they
 * must NOT depend on a vault being open. Only non-sensitive UI state here.
 */
function registerAppSettingsIpc(appSettings: AppSettingsService): void {
  ipcMain.handle('app:get-theme', async () => {
    return appSettings.getTheme()
  })

  ipcMain.handle('app:set-theme', async (_event, payload: unknown) => {
    const result = appThemeSchema.safeParse(payload)
    if (result.success) {
      await appSettings.setTheme(result.data)
      return result.data
    }
    return appSettings.getTheme()
  })

  ipcMain.handle('app:get-file-tree-sort', async () => {
    return appSettings.getFileTreeSort()
  })

  ipcMain.handle('app:set-file-tree-sort', async (_event, payload: unknown) => {
    const result = fileTreeSortSchema.safeParse(payload)
    if (result.success) {
      await appSettings.setFileTreeSort(result.data)
      return result.data
    }
    return appSettings.getFileTreeSort()
  })

  ipcMain.handle('app:get-editor-font-size', async () => {
    return appSettings.getEditorFontSize()
  })

  ipcMain.handle('app:set-editor-font-size', async (_event, payload: unknown) => {
    const result = editorFontSizeSchema.safeParse(payload)
    if (result.success) {
      await appSettings.setEditorFontSize(result.data)
    }
    return appSettings.getEditorFontSize()
  })
}

const appThemeSchema = z.enum(['light', 'dark', 'system'])
const fileTreeSortSchema = z.enum(['name', 'modified-desc', 'created-desc'])
const editorFontSizeSchema = z.number().finite().min(MIN_EDITOR_FONT_SIZE).max(MAX_EDITOR_FONT_SIZE)
