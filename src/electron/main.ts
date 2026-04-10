import { app, BrowserWindow, ipcMain, shell, session } from 'electron';
import path from 'path';
import { registerDriveOpsHandlers } from './ipc/driveOps';
import { authorizeAndListFiles, checkTokenStatus } from './utils/googleAuth.js';
import { registerFileSystemHandlers } from './ipc/filesystem';
import { registerWorkspaceHandlers } from './ipc/workspace';
import { registerCredentialIpc } from './ipc/credential';
import { verifyCredentialsHealth } from './services/CredentialService';
import { registerPluginIpc } from './ipc/pluginOps';
import { discoverPlugins } from './services/PluginService';
import { initWorkspaces } from './utils/seed.js';
import { registerWindowManagerHandlers } from './ipc/windowManager';
import { registerPipelineHandlers } from './ipc/pipelineOps';
import { initTray } from './trayManager';
import { TriggerManager } from './services/triggers/TriggerManager';

let mainWindow: BrowserWindow | null = null;
/** 當 tray「結束」被點擊時，設為 true，讓 close 攔截器放行 */
let forceQuit = false;

// --- Single Instance Lock ---
const gotTheLock = app.requestSingleInstanceLock();
if (!gotTheLock) {
  // If we don't get the lock, we must quit because the first instance is running.
  app.quit();
  process.exit(0);
}

const getWindow = () => mainWindow;
export const setForceQuit = (v: boolean) => { forceQuit = v; };

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1200,
    height: 800,
    titleBarStyle: 'hidden',
    trafficLightPosition: { x: -100, y: -100 },
    icon: (function() {
      const fs = require('fs');
      const pngPath = path.join(app.getAppPath(), 'src/assets/desktopIcon.png');
      return fs.existsSync(pngPath) ? pngPath : path.join(app.getAppPath(), 'src/assets/desktopIcon.svg');
    })(),
    webPreferences: {
      preload: path.join(__dirname, 'preload.cjs'),
      webviewTag: true,
      contextIsolation: true,
      nodeIntegration: false,
    },
  });

  if (process.env.NODE_ENV === 'development') {
    mainWindow.loadURL('http://localhost:5173');
    console.log('window created');
  } else {
    // 考慮到 dist-electron/electron/main.js 的結構，使用 ../../ 回到專案根目錄
    mainWindow.loadFile(path.join(__dirname, '../../dist-react/index.html'));
  }

  // 攔截 close 事件：未強制退出時改為隱藏，由 tray 控制真正結束
  mainWindow.on('close', (event) => {
    if (!forceQuit) {
      event.preventDefault();
      mainWindow?.hide();
    }
  });

  mainWindow.on('closed', () => {
    mainWindow = null;
  });
}

// 處理第二個實例啟動時的事件
app.on('second-instance', (event, commandLine, workingDirectory) => {
  // Someone tried to run a second instance, we should focus our window.
  if (mainWindow) {
    if (mainWindow.isMinimized()) mainWindow.restore();
    mainWindow.show();
    mainWindow.focus();
  }

  // Check if second instance passed --run-pipeline=ID
  const runArg = commandLine.find(arg => arg.startsWith('--run-pipeline='));
  if (runArg) {
    const fileId = runArg.split('=')[1];
    import('./ipc/pipelineOps.js').then(({ runPipelineFromCLI }) => {
      runPipelineFromCLI(fileId);
    });
  }
});

app.whenReady().then(async () => {

  session.defaultSession.webRequest.onHeadersReceived((details, callback) => {
    const responseHeaders = { ...details.responseHeaders };
    delete responseHeaders['X-Frame-Options'];
    delete responseHeaders['x-frame-options'];
    delete responseHeaders['Content-Security-Policy'];
    delete responseHeaders['content-security-policy'];
    callback({ cancel: false, responseHeaders });
  });

  ipcMain.handle('open-external', async (_, url) => {
    await shell.openExternal(url);
  });

  ipcMain.handle('trigger-google-login', async () => {
    console.log('[Main] 收到登入請求...');
    try {
      const files = await authorizeAndListFiles();
      syncGoogleWebSession();
      return { success: true, files };
    } catch (error) {
      console.error('[Main] Google Auth 發生錯誤:', error);
      return { success: false, error: String(error) };
    }
  });

  async function syncGoogleWebSession() {
    try {
      const cookies = await session.defaultSession.cookies.get({ url: 'https://drive.google.com' });
      if (cookies.length > 0) {
        console.log('[Main] Google Web Session 已存在，略過視窗同步。');
        return;
      }
      console.log('[Main] 找不到 Web Session，啟動同步視窗...');
      const win = new BrowserWindow({ width: 800, height: 600, show: true, alwaysOnTop: true });
      win.loadURL('https://accounts.google.com/ServiceLogin?continue=https://drive.google.com/');
      win.webContents.on('did-navigate', (_, url) => {
        if (url.includes('drive.google.com/drive/my-drive')) {
          console.log('[Main] Web Session Cookie 同步完成，自動關閉視窗');
          setTimeout(() => { if (!win.isDestroyed()) win.close(); }, 1500);
        }
      });
    } catch (error) {
      console.error('[Main] 檢查 Cookie 發生錯誤:', error);
    }
  }

  app.on('web-contents-created', (_, contents) => {
    contents.setWindowOpenHandler(({ url }) => {
      if (mainWindow && !mainWindow.isDestroyed()) {
        mainWindow.webContents.send('open-link-in-tab', url);
      }
      return { action: 'deny' };
    });
  });

  // 1. 先註冊 IPC 監聽器
  console.log('[Main] 啟動 IPC 監聽器註冊流程...');
  registerWindowManagerHandlers(getWindow);
  registerFileSystemHandlers();
  registerWorkspaceHandlers();
  registerDriveOpsHandlers();
  registerCredentialIpc();
  registerPluginIpc();
  registerPipelineHandlers();
  console.log('[Main] IPC 監聽器註冊完成。');

  // 2. 初始化工作區 (背景執行)
  console.log('[Main] 執行 initWorkspaces...');
  initWorkspaces()
    .then(() => console.log('[Main] initWorkspaces 執行完畢'))
    .catch(e => console.error('[Main] initWorkspaces 發生錯誤:', e));
    
  console.log('[Main] 執行插件與觸發器發現...');
  discoverPlugins();
  TriggerManager.instance.init();

  // 3. 建立視窗與系統匣
  console.log('[Main] 正在建立主視窗...');
  createWindow();
  initTray(getWindow, setForceQuit);

  // 4. 憑證檢查
  console.log('[Main] 開始憑證與健康狀態掃描...');
  verifyCredentialsHealth().then(isMissing => {
    if (isMissing) {
      console.log('[Main] 偵測到憑證缺失，排程於 5 秒後發送 auth-missing 通知');
      setTimeout(() => {
        if (mainWindow && !mainWindow.isDestroyed()) {
          mainWindow.webContents.send('auth-missing');
          console.log('[Main] 事件已發送：auth-missing');
        } else {
          console.warn('[Main] 無法發送 auth-missing，視窗不存在');
        }
      }, 5000);
    } else {
      console.log('[Main] 憑證健康良好，無需顯示設定畫面。');
    }
  });

  // 初次啟動如果在命令列中有 --run-pipeline=XXX，直接背景執行
  const runArg = process.argv.find(arg => arg.startsWith('--run-pipeline='));
  if (runArg) {
    const fileId = runArg.split('=')[1];
    console.log(`[Main] CLI 觸發器：啟動 Pipeline ${fileId}`);
    import('./ipc/pipelineOps.js').then(({ runPipelineFromCLI }) => {
      runPipelineFromCLI(fileId);
    });
  }

  // 啟動背景憑證效期監控與健康掃描 (5 分鐘檢查一次)
  setInterval(async () => {
    const isSecretDeleted = await verifyCredentialsHealth();
    if (isSecretDeleted) {
      BrowserWindow.getAllWindows().forEach(win => {
        if (!win.isDestroyed()) win.webContents.send('auth-missing');
      });
    }
    checkTokenStatus();
  }, 5 * 60 * 1000);

  app.on('activate', () => {
    if (mainWindow) {
      mainWindow.show();
      mainWindow.focus();
    } else {
      createWindow();
    }
  });
});

// 不在 window-all-closed 時退出，由 tray「結束」控制
app.on('window-all-closed', () => {
  // intentionally empty — only tray quit can exit the app
});
