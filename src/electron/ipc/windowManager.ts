import { BrowserWindow, ipcMain } from 'electron';

/**
 * Registers all window-control IPC handlers.
 * Call this after createWindow() so mainWindow is initialized.
 * @param getWindow - factory that returns the current mainWindow (may be null)
 */
export function registerWindowManagerHandlers(getWindow: () => BrowserWindow | null) {
    // Minimize the window
    ipcMain.handle('window:minimize', () => {
        getWindow()?.minimize();
    });

    // Toggle maximize / restore
    ipcMain.handle('window:maximize', () => {
        const win = getWindow();
        if (!win) return;
        if (win.isMaximized()) {
            win.unmaximize();
        } else {
            win.maximize();
        }
    });

    // Hide window (sends to tray instead of destroying)
    ipcMain.handle('window:close', () => {
        getWindow()?.hide();
    });

    // Return current maximized state (used to sync icon in renderer)
    ipcMain.handle('window:is-maximized', () => {
        return getWindow()?.isMaximized() ?? false;
    });

    // Open devtools for debugging
    ipcMain.handle('window:open-devtools', () => {
        getWindow()?.webContents.openDevTools();
    });

    // Relay maximize-state changes to renderer so the button icon stays in sync
    const win = getWindow();
    if (win) {
        win.on('maximize', () => {
            win.webContents.send('window:maximized-state-changed', true);
        });
        win.on('unmaximize', () => {
            win.webContents.send('window:maximized-state-changed', false);
        });
    }
}
