import { prisma } from '../db.js'; // 注意 .js 副檔名 (ESM 規範)
import { drive_v3 } from 'googleapis';


// 定義 Changes API 回傳的單一變更結構
interface DriveChange {
  fileId?: string | null;
  removed?: boolean | null;
  file?: drive_v3.Schema$File | null;
}


/**
 * 將 Google Drive 檔案列表儲存到 SQLite
 * 使用 Transaction 確保這批寫入要嘛全成功，要嘛全失敗
 */
export async function saveDriveFiles(files: drive_v3.Schema$File[]) {
  if (files.length === 0) return;

  const operations = files.map((file) => {
    // 1. 資料清洗與轉型
    // Google 的時間是字串 (ISO 8601)，Prisma 需要 Date 物件
    const createdTime = file.createdTime ? new Date(file.createdTime) : null;
    const modifiedTime = file.modifiedTime ? new Date(file.modifiedTime) : null;
    const sharedWithMeTime = file.sharedWithMeTime ? new Date(file.sharedWithMeTime) : null;

    // 處理擁有者資訊 (只取第一個擁有者)
    const owner = file.owners?.[0];

    // 處理權限 (從 capabilities 拿)
    const canEdit = file.capabilities?.canEdit || false;

    // 處理標籤 (優先從 syn_tags，後備 nex_tags)
    const synTagsStr = file.appProperties?.syn_tags || file.appProperties?.nex_tags || '';
    const fileTags = synTagsStr.split(',').map(t => t.trim()).filter(t => t.length > 0);

    // 本地系統自行管理模板屬性，不從 Google Drive 讀取
    // const isTemplate = file.appProperties?.nex_template === 'true';

    // Extract link data from appProperties (優先從 syn_，後備 nex_)
    const ap = file.appProperties ?? {};
    const synUrl   = ap.syn_url   || ap.nex_url   || null;
    const synIcon  = ap.syn_icon  || ap.nex_icon  || null;
    const synColor = ap.syn_color || ap.nex_color || null;

    // Serialize all appProperties as JSON for future use
    const appPropertiesJson = Object.keys(ap).length > 0 ? JSON.stringify(ap) : null;

    // 準備寫入的資料物件 (對應 Prisma Schema)
    const updateData = {
      name: file.name || '未命名檔案',
      mimeType: file.mimeType || 'application/octet-stream',
      parentId: file.parents?.[0] || null, // 只取第一個父資料夾
      description: file.description || null,
      appProperties: appPropertiesJson,
      linkUrl:  synUrl,
      linkIcon: synIcon,
      linkColor: synColor,

      size: file.size || null,
      iconLink: file.iconLink || null,
      webViewLink: file.webViewLink || null,
      thumbnailLink: file.thumbnailLink || null,
      folderColorRgb: file.folderColorRgb || null,

      starred: file.starred || false,
      trashed: file.trashed || false,

      ownedByMe: file.ownedByMe || false,
      shared: file.shared || false,
      canEdit: canEdit,

      ownerName: owner?.displayName || null,
      ownerPhoto: owner?.photoLink || null,

      sharedWithMeTime: sharedWithMeTime,
      createdTime: createdTime,
      modifiedTime: modifiedTime,

      syncedAt: new Date(), // 更新同步時間

      // 標籤多對多關聯：透過 connectOrCreate 來處理
      tags: {
        connectOrCreate: fileTags.map(tag => ({
          where: { name: tag },
          create: { name: tag }
        }))
      }
    };

    // 2. 建立 Upsert 指令
    // 如果 ID 存在 -> Update
    // 如果 ID 不存在 -> Create
    return prisma.driveFile.upsert({
      where: { id: file.id! }, // Google File ID 必定存在，這裡用 ! 斷言
      update: updateData,
      create: {
        id: file.id!,
        ...updateData,
        isTemplate: false, // 只有新增時預設為 false，避免覆疊本地設定
      },
    });
  });

  // 3. 執行批次寫入 (Transaction)
  // 這比一筆一筆 await 快非常多
  await prisma.$transaction(operations);

  console.log(`[DB] 已同步 ${files.length} 筆檔案資料`);
}


/**
 * 【新增】處理 Google Drive 的「變更」清單
 * 包含：新增、修改、移除
 */
export async function processDriveChanges(changes: DriveChange[]) {
  const toUpsert: drive_v3.Schema$File[] = [];
  const toDeleteIds: string[] = [];

  for (const change of changes) {
    if (change.removed && change.fileId) {
      // 情況 A: Google 說這個檔案被移除了 (永久刪除或取消權限)
      toDeleteIds.push(change.fileId);
    } else if (change.file) {
      // 情況 B: 檔案新增或內容變更 -> 準備 Upsert
      toUpsert.push(change.file);
    }
  }

  // 1. 執行批量刪除
  if (toDeleteIds.length > 0) {
    await prisma.driveFile.deleteMany({
      where: { id: { in: toDeleteIds } },
    });
    console.log(`[DB] 已刪除 ${toDeleteIds.length} 筆本地資料`);
  }

  // 2. 執行批量更新/新增
  if (toUpsert.length > 0) {
    await saveDriveFiles(toUpsert);
    console.log(`[DB] 已更新/新增 ${toUpsert.length} 筆資料`);
  }
}

/**
 * 【新增】讀取系統設定 (用於獲取 Sync Token)
 */
export async function getSystemSetting(key: string): Promise<string | null> {
  const setting = await prisma.systemSettings.findUnique({
    where: { key },
  });
  return setting?.value || null;
}

/**
 * 儲存系統設定
 */
export async function saveSystemSetting(key: string, value: string) {
  await prisma.systemSettings.upsert({
    where: { key },
    update: { value },
    create: { key, value },
  });
  // console.log(`[DB] 設定已儲存: ${key}`);
}

/**
 * 取得系統中記錄的標籤 (Tags)
 * @param currentWorkspaceId 當前正在查詢/編輯的工作區 ID (可選)
 * @returns 排序過後的標籤陣列
 */
export async function getTags(currentWorkspaceId?: string) {
  const tags = await prisma.tag.findMany({
    orderBy: [
      { lastUsed: 'desc' },
      { name: 'asc' }
    ]
  });

  // 如果有提供 workspaceId，我們在前端或這裡做排序，把同工作區的放前面
  if (currentWorkspaceId) {
    const sameWs = tags.filter(t => t.workspaceId === currentWorkspaceId);
    const otherWs = tags.filter(t => t.workspaceId !== currentWorkspaceId);
    return [...sameWs, ...otherWs].slice(0, 10);
  }

  return tags.slice(0, 10);
}

/**
 * 更新或建立標籤紀錄
 * @param tagName 標籤名稱
 * @param workspaceId (可選) 紀錄最後使用時的工作區
 */
export async function updateTagLastUsed(tagName: string, workspaceId?: string) {
  await prisma.tag.upsert({
    where: { name: tagName },
    update: {
      lastUsed: new Date(),
      workspaceId: workspaceId || null // 最後一次輸入的工作區
    },
    create: {
      name: tagName,
      workspaceId: workspaceId || null
    }
  });
}

/**
 * 【新增】取得所有設定為模板的資料夾 (從本地端快取直接撈)
 */
export async function getTemplateFolders() {
  return prisma.driveFile.findMany({
    where: {
      isTemplate: true,
      mimeType: 'application/vnd.google-apps.folder',
      trashed: false
    },
    orderBy: { name: 'asc' }
  });
}

/**
 * 【新增】設定資料夾的模板狀態 (純本地 SQLite 更新)
 */
export async function setFileTemplateStatus(fileId: string, isTemplate: boolean) {
  console.log(`[DB] 設定模板狀態: id=${fileId}, isTemplate=${isTemplate}`);
  return prisma.driveFile.update({
    where: { id: fileId },
    data: { isTemplate }
  });
}

/**
 * 【新增】離線同步机制: 儲存本地草稿
 */
export async function saveLocalDraft(fileId: string, body: string, localModifiedTime: Date) {
  return prisma.driveFile.update({
    where: { id: fileId },
    data: {
      isDirty: true,
      localBody: body,
      localModifiedTime: localModifiedTime
    } as any
  });
}

/**
 * 【新增】離線同步机制: 取得本地草稿
 */
export async function getLocalDraft(fileId: string) {
  return prisma.driveFile.findUnique({
    where: { id: fileId },
    select: {
      isDirty: true,
      localBody: true,
      localModifiedTime: true,
      modifiedTime: true // 雲端最後同步時間
    } as any
  });
}

/**
 * 【新增】離線同步机制: 清除本地草稿 (當成功上傳或捨棄時)
 */
export async function clearLocalDraft(fileId: string) {
  return prisma.driveFile.update({
    where: { id: fileId },
    data: {
      isDirty: false,
      localBody: null,
      localModifiedTime: null
    } as any
  });
}