import fs from 'fs';
import path from 'path';
import { app, BrowserWindow } from 'electron';
import { google, drive_v3 } from 'googleapis';
import { authenticate } from '@google-cloud/local-auth';
import { OAuth2Client } from 'google-auth-library';
import {
  saveDriveFiles,
  saveSystemSetting,
  getSystemSetting,
  processDriveChanges
} from '../services/DatabaseService';

const SCOPES = [
  // --- 基礎檔案管理 ---
  'https://www.googleapis.com/auth/drive',
  'https://www.googleapis.com/auth/drive.activity.readonly',

  // --- 內容讀寫 ---
  'https://www.googleapis.com/auth/documents',
  'https://www.googleapis.com/auth/spreadsheets',
  'https://www.googleapis.com/auth/presentations',
  'https://www.googleapis.com/auth/forms.body', // Google 表單

  // --- 通訊與排程 ---
  'https://mail.google.com/',                   // Gmail 全權限
  'https://www.googleapis.com/auth/tasks',      // Google Tasks 待辦事項
  'https://www.googleapis.com/auth/calendar',   // Google 日曆
  'https://www.googleapis.com/auth/contacts.readonly', // 聯絡人 (自動完成 Email 用)

  'https://www.googleapis.com/auth/youtube.readonly',       // 讀取 YouTube 頻道資料、影片資訊與基本數據
  'https://www.googleapis.com/auth/yt-analytics.readonly',   // 讀取 YouTube 流量與進階數據分析 (YouTube Analytics API)
];
const getAuthDir = () => {
  const authDir = path.join(app.getPath('userData'), 'auth');
  if (!fs.existsSync(authDir)) {
    fs.mkdirSync(authDir, { recursive: true });
  }
  return authDir;
};

const getCredentialsPath = () => path.join(getAuthDir(), 'client_secret.json');

// 這是後端抓資料專用的介面，不需要分享給前端
interface DriveApiResponse {
  data: {
    files?: drive_v3.Schema$File[];
    nextPageToken?: string | null;
    id?: string;
    name?: string;
  };
}



import { getCredential, saveCredential, deleteCredential } from '../services/CredentialService';
const getClientKeys = async () => {
    try {
        const cred = await getCredential('google-oauth-secret');
        let content = '';

        if (cred) {
            if (cred.type === 'string' && 'decryptedValue' in cred) {
                content = (cred as any).decryptedValue;
            } else if (cred.type === 'file' && 'absoluteFilePath' in cred) {
                const filePath = (cred as any).absoluteFilePath;
                if (fs.existsSync(filePath)) {
                    content = await fs.promises.readFile(filePath, 'utf-8');
                }
            }
        }

        if (content) {
            const keys = JSON.parse(content);
            return keys.installed || keys.web;
        }

        // 開發環境備案：讀取根目錄中的 client_secret.json (僅限開發期)
        if (process.env.NODE_ENV === 'development') {
            const devPath = path.join(process.cwd(), 'client_secret.json');
            if (fs.existsSync(devPath)) {
                content = await fs.promises.readFile(devPath, 'utf-8');
                const keys = JSON.parse(content);
                return keys.installed || keys.web;
            }
        }

        throw new Error('找不到 google-oauth-secret。請在「進階 -> 安全與擴充」中設定您的 Google OAuth 憑證。');
    } catch (error) {
        throw new Error(`讀取 Google OAuth 金鑰失敗: ${error}`);
    }
};

async function loadSavedCredentialsIfExist(): Promise<OAuth2Client | null> {
  try {
    const cred = await getCredential('google-oauth-token');
    if (!cred || cred.type !== 'string' || !('decryptedValue' in cred) || !cred.decryptedValue) return null;

    const tokenData = JSON.parse(cred.decryptedValue);
    const key = await getClientKeys();
    const client = new google.auth.OAuth2(key.client_id, key.client_secret, key.redirect_uris[0]);
    client.setCredentials({
      refresh_token: tokenData.refresh_token,
      access_token: tokenData.access_token,
      expiry_date: tokenData.expiry_date,
    });
    return client;
  } catch { return null; }
}

async function saveCredentials(client: OAuth2Client) {
  const payload = JSON.stringify({
    refresh_token: client.credentials.refresh_token,
    access_token: client.credentials.access_token,
    expiry_date: client.credentials.expiry_date,
  });
  
  await saveCredential({
    key: 'google-oauth-token',
    name: 'Google OAuth Token',
    type: 'string',
    value: payload
  });
}

export async function clearAuthToken() {
  try {
    const cred = await getCredential('google-oauth-token');
    if (cred) {
      await deleteCredential('google-oauth-token');
      console.log('[Auth] 已從資料庫刪除過期的 OAuth Token');
      BrowserWindow.getAllWindows().forEach(win => {
        if (!win.isDestroyed()) win.webContents.send('auth-expired');
      });
    }
  } catch (error) {
    console.error('[Auth] 刪除 token 失敗:', error);
  }
}

async function fetchAndSaveRootId(authClient: OAuth2Client) {
  const drive = google.drive({ version: 'v3', auth: authClient });
  console.log('[Sync] 正在解析根目錄真實 ID...');
  try {
    const res = (await drive.files.get({
      fileId: 'root',
      fields: 'id, name',
    })) as unknown as DriveApiResponse;
    const rootId = res.data.id;
    if (rootId) {
      await saveSystemSetting('ROOT_FOLDER_ID', rootId);
    }
    return rootId;
  } catch (error) {
    console.error('無法取得根目錄 ID:', error);
    return null;
  }
}

// 定義我們需要的欄位字串 (Changes API 和 Files API 都用這個)
const FILE_FIELDS = [
  'id', 'name', 'mimeType', 'parents', 'size',
  'webViewLink', 'iconLink', 'thumbnailLink',
  'createdTime', 'modifiedTime',
  'starred', 'trashed',
  'ownedByMe', 'shared', 'sharedWithMeTime',
  'owners(displayName,photoLink)',
  'capabilities(canEdit)',
  'folderColorRgb', 'description', 'appProperties'
].join(', ');

/**
 * 輔助：向 Google 拿一個最新的「時光切片標記 (StartPageToken)」
 * 這在第一次全量同步前必須先做，否則會漏掉同步期間發生的變更
 */
async function getStartPageToken(drive: drive_v3.Drive): Promise<string | null> {
  try {
    const res = await drive.changes.getStartPageToken({});
    return res.data.startPageToken || null;
  } catch (error) {
    console.error('無法取得 StartPageToken:', error);
    return null;
  }
}

/**
 * 模式 A: 全量同步 (Full Sync)
 * 適用於：第一次執行，或 Token 過期/遺失時
 */
async function performFullSync(drive: drive_v3.Drive) {
  console.log('[Sync] 偵測到初次執行，準備開始全量同步...');

  // 1. 【關鍵】在開始抓檔前，先拿現在的 Token，作為未來的起點
  const startToken = await getStartPageToken(drive);

  // 2. 開始地毯式搜索
  let pageToken: string | undefined = undefined;
  let totalCount = 0;

  do {
    const res = (await drive.files.list({
      q: "trashed = true or trashed = false", // 抓全部
      pageSize: 1000,
      fields: `nextPageToken, files(${FILE_FIELDS})`,
      pageToken: pageToken,
    })) as unknown as DriveApiResponse;

    const currentFiles = res.data.files;
    if (currentFiles && currentFiles.length > 0) {
      await saveDriveFiles(currentFiles);
      totalCount += currentFiles.length;
      process.stdout.write(`.`);
    }

    pageToken = res.data.nextPageToken || undefined;

  } while (pageToken);

  console.log(`\n[Sync] 全量同步完成！共 ${totalCount} 筆。`);

  // 3. 儲存 Token，下次就會變成增量同步
  if (startToken) {
    await saveSystemSetting('DRIVE_SYNC_TOKEN', startToken);
  }
}

/**
 * 模式 B: 增量同步 (Incremental Sync)
 * 適用於：已有 Token，只抓變更
 */
async function performIncrementalSync(drive: drive_v3.Drive, savedToken: string) {
  console.log('[Sync] 偵測到已有 Token，開始檢查變更...');

  let pageToken = savedToken;
  let hasMore = true;

  while (hasMore) {
    try {
      // 使用 changes.list API
      const res = await drive.changes.list({
        pageToken: pageToken,
        pageSize: 1000,
        // 注意：這裡的 fields 結構跟 files.list 不一樣
        // 我們要拿 newStartPageToken, 和 changes 陣列
        // changes 裡面包含 removed 標記和 file 物件
        fields: `newStartPageToken, nextPageToken, changes(fileId, removed, file(${FILE_FIELDS}))`,
      });

      const changes = res.data.changes;

      if (changes && changes.length > 0) {
        // 呼叫 DB Service 的新函式處理變更
        await processDriveChanges(changes);
      }

      if (res.data.nextPageToken) {
        pageToken = res.data.nextPageToken;
      } else {
        hasMore = false;
        // 如果沒有下一頁了，Google 會給一個 newStartPageToken 作為下次的起點
        if (res.data.newStartPageToken) {
          await saveSystemSetting('DRIVE_SYNC_TOKEN', res.data.newStartPageToken);
          console.log('[Sync] 增量同步完成，Token 已更新。');
        }
      }
    } catch (error) {
      console.error('[Sync] 增量同步失敗 (可能是 Token 過期):', error);
      // 如果 Token 過期 (410 Gone)，策略通常是刪掉 Token，下次重跑 Full Sync
      // 這裡先簡單 throw 
      throw error;
    }
  }
}

/**
 * 主入口：智慧判斷同步策略
 */
async function syncDriveData(authClient: OAuth2Client) {
  const drive = google.drive({ version: 'v3', auth: authClient });

  // 1. 確保 Root ID 存在
  await fetchAndSaveRootId(authClient);

  // 2. 讀取上次的進度
  const savedToken = await getSystemSetting('DRIVE_SYNC_TOKEN');

  // 3. 決定策略
  if (!savedToken) {
    // 沒 Token -> 全量同步
    await performFullSync(drive);
  } else {
    // 有 Token -> 增量同步
    await performIncrementalSync(drive, savedToken);
  }

  return []; // 前端直接讀 DB，不回傳資料
}

export async function authorizeAndListFiles() {
  let client = await loadSavedCredentialsIfExist();
  if (client) return syncDriveData(client);

  console.log('[Auth] 開始新的認證流程...');
  const key = await getClientKeys();
  const cred = await getCredential('google-oauth-secret');
  
  let keyPath = '';

  if (cred && cred.type === 'file' && 'absoluteFilePath' in cred) {
      keyPath = (cred as any).absoluteFilePath;
  } else {
      keyPath = getCredentialsPath();
      await fs.promises.writeFile(keyPath, JSON.stringify({ installed: key }), 'utf-8');
  }

  const localAuthClient = await authenticate({
    scopes: SCOPES,
    keyfilePath: keyPath,
  });
  client = new google.auth.OAuth2(key.client_id, key.client_secret, key.redirect_uris[0]);
  if (localAuthClient.credentials) {
    client.setCredentials(localAuthClient.credentials);
    await saveCredentials(client);
  }
  return syncDriveData(client);
}

export async function getDriveClient() {
  const client = await loadSavedCredentialsIfExist();
  if (!client) {
    throw new Error('尚未登入 Google 帳號或 Token 已失效');
  }
  return google.drive({ version: 'v3', auth: client });
}

export async function getDriveAuth() {
  return await loadSavedCredentialsIfExist();
}

/**
 * 檢查 Token 狀態，如果失效則發送通知 (Check token status and notify if expired)
 */
export async function checkTokenStatus() {
  const client = await loadSavedCredentialsIfExist();
  if (!client) return;

  try {
    const drive = google.drive({ version: 'v3', auth: client });
    await drive.changes.getStartPageToken({});
  } catch (error: any) {
    const errMsg = error?.message || '';
    if (errMsg.includes('invalid_grant') || errMsg.includes('expired')) {
      console.warn('[Auth Monitor] Token 驗證失敗，正在清除過期憑證...');
      await clearAuthToken();
    }
  }
}