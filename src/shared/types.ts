// src/shared/types.ts

export type FileQueryMode = 'my-drive' | 'shared-with-me' | 'starred' | 'trashed' | 'custom' | 'all' | 'ids';
export type FileQuerySortBy = 'name' | 'modifiedTime' | 'createdTime';
export type FileQuerySortOrder = 'asc' | 'desc';


// 1. 查詢參數 (保持您原本的)
export interface FileQuery {
  mode: FileQueryMode;
  parentId?: string;

  //如果是點擊自訂工作區，這裡會帶入該工作區的 ID，方便後端驗證
  workspaceId?: string;

  // 排序與搜尋
  sortBy?: FileQuerySortBy;
  sortOrder?: FileQuerySortOrder;
  searchQuery?: string;

  mimeType?: string;
  ids?: string[];
}

// 2. 定義 DriveFile (這是給 UI 和資料庫用的，不依賴 googleapis)
export interface DriveFile {
  id: string;
  name: string;
  mimeType: string;
  parents?: string[];

  // 以下是為了對齊 Prisma Schema 新增的屬性
  parentId?: string | null;
  size?: string | null;
  iconLink?: string | null;
  webViewLink?: string | null;
  thumbnailLink?: string | null;
  folderColorRgb?: string | null;

  starred?: boolean;
  trashed?: boolean;
  isTemplate?: boolean;
  ownedByMe?: boolean;
  shared?: boolean;
  canEdit?: boolean;

  ownerName?: string | null;
  ownerPhoto?: string | null;

  // ✅ 修正：加上時間屬性
  sharedWithMeTime?: Date | string | null;
  createdTime?: Date | string | null;
  modifiedTime?: Date | string | null;

  // ✅ 新增：標籤陣列
  tags?: string[];
  syncedAt?: Date | string;

  description?: string;
  /** JSON-serialised Google Drive appProperties for this Synapse app */
  appProperties?: Record<string, string> | null;
  /** Cached link fields from appProperties (syn_url/syn_icon/syn_color / fallback to nex_*) */
  linkUrl?: string | null;
  linkIcon?: string | null;
  linkColor?: string | null;

  // --- 離線同步狀態 (Offline Sync) ---
  isDirty?: boolean;
  localModifiedTime?: Date | string | null;
}

// 3. 定義標籤 (Tag)
export interface Tag {
  id: string;
  name: string;
  workspaceId?: string | null;
  lastUsed?: Date | string;
}

// 3. 登入結果 (前端需要知道這個)
export interface GoogleLoginResult {
  success: boolean;
  files?: DriveFile[];
  error?: string;
}

// 定義 Workspace 資料結構
export interface Workspace {
  id: string;
  name: string;
  type: 'system' | 'custom';
  icon: string;
  color: string;
  mode: FileQueryMode;
  targetId?: string | null;
  order: number;
  isVisible: boolean;
}

