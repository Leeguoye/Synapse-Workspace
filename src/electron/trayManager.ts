import { app, BrowserWindow, Menu, Tray, nativeImage } from 'electron';
import path from 'path';

let tray: Tray | null = null;

/**
 * Initializes the system tray icon and context menu.
 * On all platforms: left-click toggles window visibility.
 * Context menu: Show / Hide / Quit.
 * @param getWindow - factory returning the current mainWindow
 */
export function initTray(getWindow: () => BrowserWindow | null, setForceQuit: (v: boolean) => void): void {
    // Resolve tray icon — ship a 32x32 (Win/Linux) or 16x16/22x22 (mac) icon.
    // Falls back to built-in empty image if asset is missing during dev.
    const iconPath = getIconPath();
    let icon: Electron.NativeImage;

    try {
        icon = nativeImage.createFromPath(iconPath);
        // macOS: resize to menubar size
        if (process.platform === 'darwin') {
            icon = icon.resize({ width: 16, height: 16 });
        }
    } catch {
        icon = nativeImage.createEmpty();
    }

    tray = new Tray(icon);
    tray.setToolTip('Synapse');

    const buildMenu = () => {
        const win = getWindow();
        const isVisible = win?.isVisible() ?? false;

        return Menu.buildFromTemplate([
            {
                label: isVisible ? '隱藏視窗' : '顯示視窗',
                click: () => {
                    const w = getWindow();
                    if (!w) return;
                    if (w.isVisible()) {
                        w.hide();
                    } else {
                        w.show();
                        w.focus();
                    }
                    // Rebuild menu to refresh label
                    tray?.setContextMenu(buildMenu());
                }
            },
            { type: 'separator' },
            {
                label: '結束 Synapse',
                click: () => {
                    setForceQuit(true);
                    app.quit();
                }
            }
        ]);
    };

    tray.setContextMenu(buildMenu());

    // Left-click: toggle window (useful on Windows / Linux)
    tray.on('click', () => {
        const win = getWindow();
        if (!win) return;
        if (win.isVisible()) {
            win.hide();
        } else {
            win.show();
            win.focus();
        }
        // Rebuild context menu so label stays in sync
        tray?.setContextMenu(buildMenu());
    });

    // Double-click on macOS shows the window
    tray.on('double-click', () => {
        const win = getWindow();
        if (win && !win.isVisible()) {
            win.show();
            win.focus();
        }
    });
}

/**
 * Returns the platform-appropriate tray icon path.
 * Looks for icons in `public/icons/` relative to the app root.
 */
function getIconPath(): string {
    const fs = require('fs');
    
    // 優先序 1: 生產環境中的 extraResources (由 electron-builder 複製到 resources/icons)
    if (app.isPackaged) {
        const prodPath = path.join(process.resourcesPath, 'icons', 'tray-Icon.png');
        if (fs.existsSync(prodPath)) return prodPath;
        const prodIco = path.join(process.resourcesPath, 'icons', 'tray-Icon.ico');
        if (fs.existsSync(prodIco)) return prodIco;
    }

    // 優先序 2: 原始 public/icons (開發環境)
    const devPath = path.join(app.getAppPath(), 'public', 'icons', 'tray-Icon.png');
    if (fs.existsSync(devPath)) return devPath;

    // 優先序 3: 已包含在 files 中的 src/assets (萬能備援)
    const assetPath = path.join(app.getAppPath(), 'src/assets', 'desktopIcon.png');
    if (fs.existsSync(assetPath)) return assetPath;

    // 優先序 4: macOS 專用
    if (process.platform === 'darwin') {
        const macPath = path.join(app.getAppPath(), 'public', 'icons', 'tray-icon-mac.png');
        if (fs.existsSync(macPath)) return macPath;
    }

    // 如果都找不到，回傳一個存在的檔案路徑或由 nativeImage.createEmpty 處理
    return assetPath;
}
