import { electronApp, is, optimizer } from '@electron-toolkit/utils'
import { app, BrowserWindow, Menu, shell } from 'electron'
import { existsSync } from 'fs'
import { join } from 'path'
import icon from '../../resources/icon.png?asset'
import { registerAiIpc } from './ipc/ai-ipc'
import { registerAppSettingsIpc } from './ipc/app-settings-ipc'
import { registerBookmarkIpc } from './ipc/bookmark-ipc'
import { registerExportIpc } from './ipc/export-ipc'
import { registerGraphIpc } from './ipc/graph-ipc'
import { registerIndexIpc } from './ipc/index-ipc'
import { registerInteractiveAuthoringIpc } from './ipc/interactive-authoring-ipc'
import { registerKnowledgeIpc } from './ipc/knowledge-ipc'
import { registerSandboxIpc } from './ipc/sandbox-ipc'
import { registerVaultIpc } from './ipc/vault-ipc'
import { registerWindowIpc, registerWindowStateEvents } from './ipc/window-ipc'
import { AppSettingsService } from './services/app-settings'
import {
  registerSandboxDocumentProtocol,
  registerSandboxDocumentScheme
} from './services/sandbox-document-protocol'
import { configureDisposableUserData } from './services/test-user-data'
import { closeCurrentVault } from './services/vault-session'
import {
  getWindowShortcutPolicy,
  type NativeMenuItemSpec,
  WINDOW_SHORTCUT_WATCHER_OPTIONS
} from './window-shortcut-policy'

function configurePackagedEsbuildBinary(): void {
  if (!app.isPackaged) {
    return
  }
  const binaryPath = join(
    process.resourcesPath,
    'app.asar.unpacked',
    'node_modules',
    '@esbuild',
    `${process.platform}-${process.arch}`,
    process.platform === 'win32' ? 'esbuild.exe' : 'bin/esbuild'
  )
  if (!existsSync(binaryPath)) {
    throw new Error('Packaged esbuild binary is missing.')
  }
  process.env['ESBUILD_BINARY_PATH'] = binaryPath
}

configurePackagedEsbuildBinary()
configureDisposableUserData(app)
registerSandboxDocumentScheme()

function toElectronMenuTemplate(
  items: readonly NativeMenuItemSpec[]
): Electron.MenuItemConstructorOptions[] {
  return items.map((item) => {
    if (item.kind === 'role') return { role: item.role }
    if (item.kind === 'separator') return { type: 'separator' }
    return { label: item.label, submenu: toElectronMenuTemplate(item.items) }
  })
}

function applyNativeApplicationMenu(platform: string): void {
  const policy = getWindowShortcutPolicy(platform)
  if (policy.applicationMenu.kind === 'none') {
    Menu.setApplicationMenu(null)
    return
  }
  Menu.setApplicationMenu(
    Menu.buildFromTemplate(toElectronMenuTemplate(policy.applicationMenu.items))
  )
}

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

  // Keep only native commands covered by the explicit main/renderer boundary.
  // The macOS template preserves standard app/edit roles but omits Close Window
  // so Cmd+W reaches the registered Close Active Item renderer action.
  applyNativeApplicationMenu(process.platform)

  // Default open or close DevTools by F12 in development
  // and ignore CommandOrControl + R in production.
  // see https://github.com/alex8088/electron-toolkit/tree/master/packages/utils
  app.on('browser-window-created', (_, window) => {
    optimizer.watchWindowShortcuts(window, WINDOW_SHORTCUT_WATCHER_OPTIONS)
  })

  const appSettings = new AppSettingsService(app.getPath('userData'))

  registerSandboxDocumentProtocol()
  registerVaultIpc({
    onIndexChanged: broadcastIndexChanged,
    onTreeChanged: broadcastVaultTreeChanged,
    appSettings
  })
  registerIndexIpc({ onIndexChanged: broadcastIndexChanged })
  registerKnowledgeIpc()
  registerBookmarkIpc()
  registerSandboxIpc()
  registerAiIpc()
  registerExportIpc()
  registerGraphIpc()
  registerInteractiveAuthoringIpc({ onTreeChanged: broadcastVaultTreeChanged })
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
