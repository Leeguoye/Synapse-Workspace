// src/electron/ipc/filesystem.ts

import { ipcMain } from 'electron';
import { prisma } from '../db';
import { Prisma } from '../generated/client';
import type { FileQuery } from '../../shared/types';
import { getTags, updateTagLastUsed, getTemplateFolders } from '../services/DatabaseService';
import { getDriveAuth } from '../utils/googleAuth';
import { google } from 'googleapis';

const FOLDER_MIME_TYPE = 'application/vnd.google-apps.folder';

/**
 * 輔助函式：取得指定資料夾底下的所有子資料夾 ID (包含自己)
 * 這用於 Custom Mode 的深層搜尋
 */
async function getDescendantFolderIds(rootId: string): Promise<string[]> {
  // 1. 只撈出所有的 "資料夾" 結構 (輕量級查詢)
  const allFolders = await prisma.driveFile.findMany({
    where: {
      mimeType: FOLDER_MIME_TYPE,
      trashed: false
    },
    select: { id: true, parentId: true }
  });

  // 2. 建構 Map 加速查找 (ParentID -> [ChildrenIDs])
  const folderMap = new Map<string, string[]>();
  for (const f of allFolders) {
    if (f.parentId) {
      if (!folderMap.has(f.parentId)) folderMap.set(f.parentId, []);
      folderMap.get(f.parentId)?.push(f.id);
    }
  }

  // 3. 廣度優先搜尋 (BFS) 找出所有後代
  const results = [rootId]; // 包含根目錄自己
  const queue = [rootId];

  while (queue.length > 0) {
    const currentId = queue.shift()!;
    const children = folderMap.get(currentId);

    if (children) {
      for (const childId of children) {
        results.push(childId); // 加入結果
        queue.push(childId);   // 加入佇列繼續找下一層
      }
    }
  }

  return results;
}



export function registerFileSystemHandlers() {

  ipcMain.handle('fs:list-files', async (_, params: FileQuery) => {
    const { mode, parentId, sortBy = 'name', sortOrder = 'asc', searchQuery, mimeType } = params;

    try {
      if (mode === 'custom' && !parentId && !searchQuery) return [];
      if (mode === 'ids' && !params.ids?.length) return [];

      const whereClause: Prisma.DriveFileWhereInput = {};

      if (mode === 'ids') {
        whereClause.id = { in: params.ids };
      }

      // --- 1. 垃圾桶過濾 ---
      if (mode === 'trashed') {
        whereClause.trashed = true;
      } else {
        whereClause.trashed = false;
      }

      // --- 2. 區域隔離邏輯 (Zone Isolation) ---
      // 這裡要非常小心，不要讓 custom 繼承到 my-drive 的限制

      if (mode === 'my-drive') {
        whereClause.sharedWithMeTime = null; // 只找自己的
      } else if (mode === 'shared-with-me') {
        whereClause.sharedWithMeTime = { not: null }; // 只找別人分享的
      } else if (mode === 'starred') {
        whereClause.starred = true;
      } else if (mode === 'all') {
        // [新增] 全局模式：不加任何額外限制，只要 trashed=false
        // 這樣可以同時搜到 "我的雲端" 和 "與我共用"
      }
      // [關鍵] mode === 'custom' 不做任何 shared/owned 限制
      // 因為工作區可能是自己的，也可能是別人分享的

      // --- 3. MimeType 過濾 ---
      if (mimeType) {
        whereClause.mimeType = mimeType;
      }

      // --- 4. 搜尋與層級 ---
      if (searchQuery) {
        // [新增] 如果輸入的搜尋字串開頭是 tag:
        const lowerQuery = searchQuery.toLowerCase().trim();
        if (lowerQuery.startsWith('tag:')) {
          const tagQuery = lowerQuery.slice(4).trim();
          if (tagQuery) {
            whereClause.tags = {
              some: { name: { contains: tagQuery } }
            };
          }
        } else {
          whereClause.name = { contains: searchQuery };
        }

        // Custom Mode 深層搜尋
        if (mode === 'custom' && parentId) {
          const validParentIds = await getDescendantFolderIds(parentId);
          whereClause.parentId = { in: validParentIds };
        }
        // 其他模式 (all, my-drive...) 就全域搜，不限 parentId

      } else {
        // 非搜尋模式：限制層級
        if (parentId) {
          whereClause.parentId = parentId;
        } else if (mode === 'my-drive') {
          const rootSetting = await prisma.systemSettings.findUnique({ where: { key: 'ROOT_FOLDER_ID' } });
          if (rootSetting) whereClause.parentId = rootSetting.value;
        }
        // Custom 模式如果沒 parentId 在最上面已經 return [] 了
      }

      // --- 5. 執行查詢 ---
      const filesDesc = await prisma.driveFile.findMany({
        where: whereClause,
        include: { tags: true } // 一併帶出標籤
      });

      const files = filesDesc.map((f: any) => ({
        ...f,
        appProperties: typeof f.appProperties === 'string' ? JSON.parse(f.appProperties) : f.appProperties,
        tags: f.tags ? f.tags.map((t: any) => t.name) : []
      }));

      // --- 6. 排序 (保持不變) ---
      return files.sort((a: any, b: any) => {
        // ... (原有的排序邏輯)
        const isFolderA = a.mimeType === 'application/vnd.google-apps.folder';
        const isFolderB = b.mimeType === 'application/vnd.google-apps.folder';
        if (isFolderA && !isFolderB) return -1;
        if (!isFolderA && isFolderB) return 1;

        let compareA: string | number = 0;
        let compareB: string | number = 0;
        const rawA = a[sortBy as keyof typeof a];
        const rawB = b[sortBy as keyof typeof b];

        if (sortBy === 'modifiedTime' || sortBy === 'createdTime') {
          compareA = rawA ? new Date(rawA as string | Date).getTime() : 0;
          compareB = rawB ? new Date(rawB as string | Date).getTime() : 0;
        } else {
          compareA = (rawA || '').toString().toLowerCase();
          compareB = (rawB || '').toString().toLowerCase();
        }

        if (compareA < compareB) return sortOrder === 'asc' ? -1 : 1;
        if (compareA > compareB) return sortOrder === 'asc' ? 1 : -1;
        return 0;
      });

    } catch (error) {
      console.error('[FS] 讀取失敗:', error);
      return [];
    }
  });

  // --- 模板引擎 API ---
  ipcMain.handle('fs:get-templates', async () => {
    return await getTemplateFolders();
  });

  // --- Tag API ---
  ipcMain.handle('fs:get-tags', async (_, workspaceId?: string) => {
    return await getTags(workspaceId);
  });

  ipcMain.handle('fs:add-tag', async (_, fileId: string, tagName: string, workspaceId?: string) => {
    try {
      // 1. 本地資料庫處理
      await prisma.driveFile.update({
        where: { id: fileId },
        data: {
          tags: {
            connectOrCreate: {
              where: { name: tagName },
              create: { name: tagName }
            }
          }
        }
      });
      await updateTagLastUsed(tagName, workspaceId);

      // 2. Google Drive 端同步寫入 (這會觸發 Webhook 同步，不需要立即 block，但如果想安全可 await)
      const auth = await getDriveAuth();
      if (!auth) throw new Error('Not authenticated');
      const drive = google.drive({ version: 'v3', auth });

      // 先抓出目前的 appProperties
      const res = await drive.files.get({ fileId, fields: 'appProperties' });
      const currentProps = res.data.appProperties || {};
      const currentTagsStr = currentProps.nex_tags || '';
      const currentTags = currentTagsStr.split(',').map(t => t.trim()).filter(Boolean);

      if (!currentTags.includes(tagName)) {
        currentTags.push(tagName);
        await drive.files.update({
          fileId,
          requestBody: {
            appProperties: {
              ...currentProps,
              nex_tags: currentTags.join(',')
            }
          }
        });
      }
    } catch (e) {
      console.error('[FS] Add Tag Error:', e);
      throw e;
    }
  });

  ipcMain.handle('fs:remove-tag', async (_, fileId: string, tagName: string) => {
    try {
      // 1. 本地移除關聯
      await prisma.driveFile.update({
        where: { id: fileId },
        data: {
          tags: {
            disconnect: { name: tagName }
          }
        }
      });

      // 2. Google Drive 端同步
      const auth = await getDriveAuth();
      if (!auth) throw new Error('Not authenticated');
      const drive = google.drive({ version: 'v3', auth });

      const res = await drive.files.get({ fileId, fields: 'appProperties' });
      const currentProps = res.data.appProperties || {};
      const currentTagsStr = currentProps.nex_tags || '';
      let currentTags = currentTagsStr.split(',').map(t => t.trim()).filter(Boolean);

      if (currentTags.includes(tagName)) {
        currentTags = currentTags.filter(t => t !== tagName);
        const nextTagsStr = currentTags.length > 0 ? currentTags.join(',') : '';

        await drive.files.update({
          fileId,
          requestBody: {
            appProperties: {
              ...currentProps,
              // 如果傳 null 表示從 appProperties 中刪除該鍵，我們直接塞空字串以符合 TS string 定義
              nex_tags: nextTagsStr
            }
          }
        });
      }
    } catch (e) {
      console.error('[FS] Remove Tag Error:', e);
      throw e;
    }
  });
}

