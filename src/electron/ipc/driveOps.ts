// src/electron/ipc/driveOps.ts
import { ipcMain } from 'electron';
import { getDriveClient, clearAuthToken } from '../utils/googleAuth.js';
import { saveDriveFiles, setFileTemplateStatus, saveLocalDraft, getLocalDraft, clearLocalDraft } from '../services/DatabaseService.js';
import { drive_v3 } from 'googleapis';
import { Readable } from 'stream';

// 定義完整的請求欄位，確保回傳的資料與 Prisma Schema 完全對齊（包含 folderColorRgb, 標籤與模板標記）
const FILE_FIELDS = 'id, name, mimeType, parents, size, webViewLink, iconLink, thumbnailLink, createdTime, modifiedTime, starred, trashed, ownedByMe, shared, sharedWithMeTime, owners(displayName,photoLink), capabilities(canEdit), folderColorRgb, description, appProperties(syn_tags, syn_template, syn_url, syn_icon, syn_color, nex_tags, nex_template, nex_url, nex_icon, nex_color)';

async function handleDriveError(error: any, context: string) {
  console.error(`[DriveOps] ${context} error:`, error);
  const errMsg = error?.message || error?.response?.data?.error || '';
  if (errMsg === 'invalid_grant' || errMsg.includes('Token has been expired')) {
    await clearAuthToken();
    throw new Error('AUTH_EXPIRED');
  }
  throw error;
}

export function registerDriveOpsHandlers() {

  // 1. 移至垃圾桶
  ipcMain.handle('drive:trash', async (_, fileId: string) => {
    try {
      const drive = await getDriveClient();
      const response = await drive.files.update({
        fileId: fileId,
        requestBody: { trashed: true },
        fields: FILE_FIELDS
      });
      await saveDriveFiles([response.data as drive_v3.Schema$File]); // ✅ 即時寫入 DB
      return { success: true };
    } catch (error: any) {
      await handleDriveError(error, 'Trash');
    }
  });

  // 2. 重新命名
  ipcMain.handle('drive:rename', async (_, fileId: string, newName: string) => {
    try {
      const drive = await getDriveClient();
      const response = await drive.files.update({
        fileId: fileId,
        requestBody: { name: newName },
        fields: FILE_FIELDS
      });
      await saveDriveFiles([response.data as drive_v3.Schema$File]); // ✅ 即時寫入 DB
      return { success: true };
    } catch (error: any) {
      await handleDriveError(error, 'Rename');
    }
  });

  // 3. 複製檔案
  ipcMain.handle('drive:copy', async (_, sourceId: string, targetFolderId: string, newName?: string) => {
    try {
      const drive = await getDriveClient();
      const requestBody: drive_v3.Schema$File = {
        parents: [targetFolderId]
      };
      if (newName) {
        requestBody.name = newName;
      }
      const response = await drive.files.copy({
        fileId: sourceId,
        requestBody,
        fields: FILE_FIELDS
      });
      await saveDriveFiles([response.data as drive_v3.Schema$File]); // ✅ 即時寫入 DB
      return { success: true };
    } catch (error: any) {
      await handleDriveError(error, 'Copy');
    }
  });

  // 4. 移動檔案 (Google API 的移動是: 加入新母資料夾 + 移除舊母資料夾)
  ipcMain.handle('drive:move', async (_, sourceId: string, targetFolderId: string) => {
    try {
      const drive = await getDriveClient();

      // 先取得檔案原本的 parents
      const file = await drive.files.get({
        fileId: sourceId,
        fields: 'parents'
      });
      const previousParents = file.data.parents?.join(',') || '';

      // 執行移動
      const response = await drive.files.update({
        fileId: sourceId,
        addParents: targetFolderId,
        removeParents: previousParents,
        fields: FILE_FIELDS
      });
      await saveDriveFiles([response.data as drive_v3.Schema$File]); // ✅ 即時寫入 DB
      return { success: true };
    } catch (error: any) {
      await handleDriveError(error, 'Move');
    }
  });

  // 5. 建立新檔案/資料夾 (支援所有您列出的 Google 原生 MIME Type)
  ipcMain.handle('drive:create', async (_, targetFolderId: string | undefined, mimeType: string, customName?: string, description?: string) => {
    try {
      const drive = await getDriveClient();

      let defaultName = '未命名檔案';
      const typeMap: Record<string, string> = {
        'application/vnd.google-apps.folder': '新資料夾',
        'application/vnd.google-apps.document': '數位文件',
        'application/vnd.google-apps.spreadsheet': '預算/排程表',
        'application/vnd.google-apps.presentation': '簡報投影片',
        'application/vnd.google-apps.form': '自訂表單',
        'application/vnd.google-apps.drawing': '流程繪圖',
        'application/vnd.google-apps.map': '專案地圖',
        'application/vnd.google-apps.site': '協作平台',
        'application/vnd.google-apps.script': '應用程式腳本',
        'application/vnd.google-apps.jam': 'Jamboard 畫布',
        'application/vnd.google.colaboratory': 'IPython 筆記本',
        'application/vnd.google-apps.vid': 'Vids 專案',
        'text/markdown': '筆記.md',
        'application/x-tex': 'LaTeX 文件.tex',
        'application/vnd.synapse.canvas': 'Synapse 畫布.canvas',
        'application/vnd.synapse.graph': 'Synapse 關聯圖.syn_graph',
        'application/vnd.synapse.link': '網頁連結'
      };

      // 判斷命名邏輯：優先使用使用者輸入，若無則使用 typeMap，最後才用 '未命名檔案'
      if (customName && customName.trim() !== '') {
        defaultName = customName;
      } else if (typeMap[mimeType]) {
        defaultName = typeMap[mimeType];
      }

      // 特殊處理：插件文件自動補上後綴
      if (mimeType.startsWith('application/vnd.synapse.plugin.') && !defaultName.toLowerCase().endsWith('.plugin')) {
        defaultName += '.plugin';
      }

      const requestBody: drive_v3.Schema$File = {
        name: defaultName,
        mimeType: mimeType,
        description: description
      };

      // Link type: write URL/icon/color to appProperties
      if (mimeType === 'application/vnd.synapse.link' || mimeType === 'application/vnd.synapse.link.custom' ||
          mimeType === 'application/vnd.nexus.link' || mimeType === 'application/vnd.nexus.link.custom') {
        if (description) {
          try {
            const linkData = JSON.parse(description) as { url?: string; icon?: string; color?: string };
            requestBody.appProperties = {
              ...(linkData.url   ? { syn_url:   linkData.url }   : {}),
              ...(linkData.icon  ? { syn_icon:  linkData.icon }  : {}),
              ...(linkData.color ? { syn_color: linkData.color } : {}),
            };
          } catch { /* not JSON, skip */ }
        }
      }

      if (targetFolderId) {
        requestBody.parents = [targetFolderId];
      }

      // 修正 0KB 問題：為插件檔案寫入基礎 HTML 內容
      let media: any = undefined;
      if (mimeType.startsWith('application/vnd.synapse.plugin.')) {
        const initialHtml = `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <title>${defaultName}</title>
  <style>
    body { background: #1a1a1a; color: #ccc; font-family: sans-serif; display: flex; align-items: center; justify-content: center; height: 100vh; margin: 0; }
    .card { border: 1px solid #333; padding: 2rem; border-radius: 12px; text-align: center; background: #252526; }
  </style>
</head>
<body>
  <div class="card">
    <h2>Synapse Plugin: ${defaultName}</h2>
    <p>This is a manifest file for the Synapse Desktop plugin system.</p>
    <p>Created: ${new Date().toLocaleString()}</p>
  </div>
</body>
</html>`;
        media = {
          mimeType: 'text/html',
          body: Readable.from(initialHtml)
        };
      }

      const response = await drive.files.create({
        requestBody: requestBody,
        media: media,
        fields: FILE_FIELDS
      });

      await saveDriveFiles([response.data as drive_v3.Schema$File]); // 即時寫入 DB，實現建立後零延遲渲染

      // 修正：回傳完整 file 物件，讓前端拿到 id 和 mimeType 以觸發 onSelect 跳轉
      return { success: true, file: response.data };
    } catch (error: any) {
      await handleDriveError(error, 'Create');
    }
  });

  ipcMain.handle('drive:getApps', async () => {
    try {
      const drive = await getDriveClient();

      // 呼叫 apps.list API
      const response = await drive.apps.list();

      // API 會回傳 items 陣列，裡面包含 app 的名稱、支援的 MimeType 與圖示網址
      return {
        success: true,
        apps: response.data.items || []
      };
    } catch (error: any) {
      await handleDriveError(error, 'getApps');
    }
  });


  // 用來更新檔案的中繼資料 (名稱、描述)
  // 用來更新檔案的中繼資料 (名稱、描述、appProperties)
  ipcMain.handle('drive:updateMeta', async (_, fileId: string, newName?: string, newDescription?: string, newAppProperties?: Record<string, string>) => {
    try {
      const drive = await getDriveClient();
      const requestBody: drive_v3.Schema$File = {};

      if (newName) requestBody.name = newName;
      if (newDescription !== undefined) requestBody.description = newDescription;
      if (newAppProperties) requestBody.appProperties = newAppProperties;

      if (Object.keys(requestBody).length > 0) {
        const response = await drive.files.update({
          fileId,
          requestBody,
          fields: FILE_FIELDS
        });
        await saveDriveFiles([response.data as drive_v3.Schema$File]); // 同步本地資料庫
        return { success: true };
      }
      return { success: false };
    } catch (error: any) {
      await handleDriveError(error, 'Update meta');
    }
  });

  // --- 純文字檔案讀寫 (Native Editor) ---

  // 下載純文字檔案內容 (不寫入硬碟，直接回傳字串)
  ipcMain.handle('drive:downloadText', async (_, fileId: string) => {
    try {
      // 1. 先檢查是否有本地尚未同步的草稿 (isDirty)
      const draft = await getLocalDraft(fileId) as any;
      if (draft?.isDirty && draft?.localBody !== null) {
        console.log(`[Offline Sync] 載入檔 ${fileId} 的本地離線草稿`);
        return { content: draft.localBody, isLocalDraft: true, conflict: false };
      }

      // 2. 正常向 Google 下載
      const drive = await getDriveClient();
      // alt=media 代表我們不是要拿 meta info，而是要直接拿內容本體
      const response = await drive.files.get(
        { fileId: fileId, alt: 'media' },
        { responseType: 'text' } // 確保 axios/googleapis 把回應當成文字解析
      );
      return { content: response.data, isLocalDraft: false, conflict: false };
    } catch (error: any) {
      if (error.code === 'ENOTFOUND' || error.code === 'ETIMEDOUT' || error.message.includes('network')) {
        // 如果連不上網，而且又沒有 draft 只能報錯
        throw new Error('OFFLINE_NO_CACHE');
      }
      await handleDriveError(error, 'Download Text File');
    }
  });

  // 覆寫純文字檔案內容
  ipcMain.handle('drive:updateText', async (_, fileId: string, meta: { mimeType: string, body: string, forceOverride?: boolean }) => {
    try {
      // 1. 取得雲端最新狀態來做版本檢測 (Version Vector)
      const drive = await getDriveClient();
      const metaResponse = await drive.files.get({ fileId: fileId, fields: 'modifiedTime' });
      const remoteModifiedTime = metaResponse.data.modifiedTime ? new Date(metaResponse.data.modifiedTime) : null;

      const localDraft = await getLocalDraft(fileId) as any;
      const localKnownModified = localDraft?.localModifiedTime || localDraft?.modifiedTime;

      // 如果不是強制覆寫，且雲端的 modifiedTime 比本地認知的 modifiedTime 還新，觸發衝突
      if (!meta.forceOverride && remoteModifiedTime && localKnownModified && remoteModifiedTime > localKnownModified) {
        console.warn(`[Offline Sync] 發現版本衝突! Remote: ${remoteModifiedTime}, LocalKnown: ${localKnownModified}`);

        // 抓取遠端最新內容回傳給前端做 Diff
        const remoteContentResponse = await drive.files.get({ fileId: fileId, alt: 'media' }, { responseType: 'text' });

        return {
          success: false,
          status: 'conflict',
          remoteContent: remoteContentResponse.data,
          remoteModifiedTime: remoteModifiedTime
        };
      }

      // 2. 正常更新到 Google Drive
      // 使用 update 方法，傳入 media 的 mimeType 與 body
      const response = await drive.files.update({
        fileId: fileId,
        media: {
          mimeType: meta.mimeType,
          body: meta.body
        },
        fields: FILE_FIELDS // 更新後順便把最新的 meta 抓回來更新本地 DB
      });

      // 3. 即時寫入 DB，確保修改時間 (modifiedTime) 被更新，並清空本地草稿狀態
      await saveDriveFiles([response.data as drive_v3.Schema$File]);
      await clearLocalDraft(fileId);

      return { success: true, status: 'synced' };
    } catch (error: any) {
      // 如果是網路錯誤，則切換到離線存檔模式
      if (error.code === 'ENOTFOUND' || error.code === 'ETIMEDOUT' || error.message.includes('network') || error.message.includes('fetch')) {
        console.log(`[Offline Sync] 網路無法連線，將改為儲存本地離線草稿: ${fileId}`);
        await saveLocalDraft(fileId, meta.body, new Date());
        return { success: true, status: 'offline_saved' };
      }
      await handleDriveError(error, 'Update Text File');
    }
  });

  // --- 模板引擎擴充功能 ---

  // 切換資料夾是否為模板 (改為純本地 SQLite 儲存)
  ipcMain.handle('drive:toggleTemplate', async (_, fileId: string, isTemplate: boolean) => {
    try {
      console.log(`[IPC] drive:toggleTemplate 收到請求: fileId=${fileId}, isTemplate=${isTemplate}`);
      const updatedFile = await setFileTemplateStatus(fileId, isTemplate);
      console.log(`[IPC] drive:toggleTemplate 更新成功`);
      return { success: true, file: updatedFile };
    } catch (error: any) {
      console.error(`[IPC] drive:toggleTemplate 發生錯誤:`, error);
      await handleDriveError(error, 'Toggle Template Local Update');
    }
  });

  // 從模板建立 (僅拷貝該目錄底下的「檔案」，不遞迴複製子資料夾)
  ipcMain.handle('drive:createFromTemplate', async (_, templateFolderId: string, targetFolderId: string) => {
    try {
      const drive = await getDriveClient();

      // 1. 取得模板資料夾下的所有檔案 (排除資料夾與已刪除)
      const query = `'${templateFolderId}' in parents and mimeType != 'application/vnd.google-apps.folder' and trashed = false`;
      const listResponse = await drive.files.list({
        q: query,
        fields: 'files(id, name)',
        pageSize: 1000
      });

      const filesToCopy = listResponse.data.files || [];
      if (filesToCopy.length === 0) {
        return { success: true, copiedCount: 0 };
      }

      // 2. 對每個檔案執行 copy API，並指定目標父資料夾為 targetFolderId
      const copiedResults: drive_v3.Schema$File[] = [];
      for (const file of filesToCopy) {
        if (!file.id) continue;
        const copyRes = await drive.files.copy({
          fileId: file.id,
          requestBody: {
            parents: [targetFolderId],
            name: file.name // 保持原名
          },
          fields: FILE_FIELDS
        });
        if (copyRes.data) {
          copiedResults.push(copyRes.data as drive_v3.Schema$File);
        }
      }

      // 3. 將這些新建立的拷貝檔案寫入本地端 DB 讓 UI 瞬間更新
      if (copiedResults.length > 0) {
        await saveDriveFiles(copiedResults);
      }

      return { success: true, copiedCount: copiedResults.length, newFiles: copiedResults };
    } catch (error: any) {
      await handleDriveError(error, 'Create From Template');
    }
  });

}