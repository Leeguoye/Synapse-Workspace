import { contextBridge, ipcRenderer } from 'electron';
import { FileQuery, Workspace } from '../shared/types';

const apiObject = {
  triggerGoogleLogin: () => ipcRenderer.invoke('trigger-google-login'),

  // 前端呼叫這個來拿資料
  listFiles: (params: FileQuery) => ipcRenderer.invoke('fs:list-files', params),

  // --- 工作區相關 API ---
  getWorkspaces: () => ipcRenderer.invoke('workspace:get-all'),
  createCustomWorkspace: (data: { name: string, targetId: string }) =>
    ipcRenderer.invoke('workspace:create-custom', data),
  updateWorkspaceOrder: (workspaces: Workspace[]) =>
    ipcRenderer.invoke('workspace:update-order', workspaces),
  deleteWorkspace: (id: string) => ipcRenderer.invoke('workspace:delete', id),
  trashFile: (fileId: string) => ipcRenderer.invoke('drive:trash', fileId),
  renameFile: (fileId: string, newName: string) =>
    ipcRenderer.invoke('drive:rename', fileId, newName),

  copyFile: (sourceId: string, targetFolderId: string, newName?: string) =>
    ipcRenderer.invoke('drive:copy', sourceId, targetFolderId, newName),

  moveFile: (sourceId: string, targetFolderId: string) =>
    ipcRenderer.invoke('drive:move', sourceId, targetFolderId),

  createFile: (targetFolderId: string | undefined, mimeType: string, customName?: string, description?: string) =>
    ipcRenderer.invoke('drive:create', targetFolderId, mimeType, customName, description),

  uploadFile: (targetFolderId: string | undefined, filePath: string, fileName: string, mimeType: string) =>
    ipcRenderer.invoke('drive:upload', targetFolderId, filePath, fileName, mimeType),

  updateFileMeta: (fileId: string, newName?: string, newDescription?: string, newAppProperties?: Record<string, string>) =>
    ipcRenderer.invoke('drive:updateMeta', fileId, newName, newDescription, newAppProperties),

  onOpenLinkInTab: (callback: (url: string) => void) => {
    ipcRenderer.on('open-link-in-tab', (_, url) => callback(url));
  },

  // --- Native Editor API ---
  downloadFileText: (fileId: string) => ipcRenderer.invoke('drive:downloadText', fileId),
  updateFileText: (fileId: string, meta: { mimeType: string, body: string }) => ipcRenderer.invoke('drive:updateText', fileId, meta),
  onAuthExpired: (callback: () => void) => {
    ipcRenderer.on('auth-expired', () => callback());
  },
  onAuthMissing: (callback: () => void) => {
    ipcRenderer.on('auth-missing', () => callback());
  },

  openExternal: (url: string) => ipcRenderer.invoke('open-external', url),

  getDriveApps: () => ipcRenderer.invoke('drive:getApps'),

  // --- 模板引擎 API ---
  getTemplateFolders: () => ipcRenderer.invoke('fs:get-templates'),
  toggleTemplate: (fileId: string, isTemplate: boolean) => ipcRenderer.invoke('drive:toggleTemplate', fileId, isTemplate),
  createFromTemplate: (templateFolderId: string, targetFolderId: string) => ipcRenderer.invoke('drive:createFromTemplate', templateFolderId, targetFolderId),

  // --- Tag 相關 API ---
  getTags: (workspaceId?: string) => ipcRenderer.invoke('fs:get-tags', workspaceId),
  addTag: (fileId: string, tagName: string, workspaceId?: string) =>
    ipcRenderer.invoke('fs:add-tag', fileId, tagName, workspaceId),
  removeTag: (fileId: string, tagName: string) =>
    ipcRenderer.invoke('fs:remove-tag', fileId, tagName),

  // --- 視窗控制 API ---
  windowMinimize: () => ipcRenderer.invoke('window:minimize'),
  windowMaximize: () => ipcRenderer.invoke('window:maximize'),
  windowClose: () => ipcRenderer.invoke('window:close'),
  windowIsMaximized: () => ipcRenderer.invoke('window:is-maximized'),
  windowOpenDevTools: () => ipcRenderer.invoke('window:open-devtools'),
  /** 訂閱最大化狀態變化事件，回傳取消訂閱的函式 */
  onMaximizedStateChanged: (callback: (isMaximized: boolean) => void) => {
    const handler = (_: Electron.IpcRendererEvent, value: boolean) => callback(value);
    ipcRenderer.on('window:maximized-state-changed', handler);
    return () => ipcRenderer.removeListener('window:maximized-state-changed', handler);
  },

  // --- Credentials API ---
  credentials: {
    list: () => ipcRenderer.invoke('credential:list'),
    save: (input: any) => ipcRenderer.invoke('credential:save', input),
    delete: (key: string) => ipcRenderer.invoke('credential:delete', key),
  },

  // --- Plugins API ---
  plugins: {
    list: () => ipcRenderer.invoke('plugin:list'),
    setActive: (pluginId: string, isActive: boolean) => ipcRenderer.invoke('plugin:set-active', pluginId, isActive),
    uninstall: (pluginId: string) => ipcRenderer.invoke('plugin:uninstall', pluginId),
    install: () => ipcRenderer.invoke('plugin:install'),
    listLanguages: () => ipcRenderer.invoke('plugin:list-languages'),
    getLanguageContent: (langCode: string) => ipcRenderer.invoke('plugin:get-language-content', langCode),
    execute: (pluginId: string, nodeType: string, inputs: Record<string, unknown>) => ipcRenderer.invoke('plugin:execute', pluginId, nodeType, inputs),
    // --- 節點庫相關 ---
    listNodes: () => ipcRenderer.invoke('plugin:node-registry:list'),
    getNodesByCategory: () => ipcRenderer.invoke('plugin:node-registry:get-by-category'),
    getNodeManifest: (pluginId: string, nodeType: string) => ipcRenderer.invoke('plugin:node-registry:get-one', pluginId, nodeType),
  },
    // --- 觸發器管理 ---
    triggers: {
      create: (data: any) => ipcRenderer.invoke('plugin:trigger:create', data),
      list: () => ipcRenderer.invoke('plugin:list-triggers'),
      delete: (id: string) => ipcRenderer.invoke('plugin:trigger:delete', id),
    },

    // --- Pipeline API ---
    pipeline: {
      start: (fileId: string, canvasDataString: string) => ipcRenderer.invoke('pipeline:start', fileId, canvasDataString),
      stop: (fileId: string) => ipcRenderer.invoke('pipeline:stop', fileId),
      onStatusUpdate: (callback: (data: { fileId: string, nodeId: string, status: 'running' | 'success' | 'error', logs?: string[], data?: any }) => void) => {
        const handler = (_: any, data: any) => callback(data);
        ipcRenderer.on('pipeline:status-update', handler);
        return () => { ipcRenderer.removeListener('pipeline:status-update', handler); };
      }
    }
};

contextBridge.exposeInMainWorld('electron', apiObject);
contextBridge.exposeInMainWorld('api', apiObject);