// src/shared/plugin.types.ts

// 權限列舉 (Permissions Enumeration)
export const Permissions = {
  DRIVE_READ: 'drive:read',
  DRIVE_WRITE: 'drive:write',
  NOTION_READ: 'notion:read',
  NOTION_WRITE: 'notion:write',
  SQLITE_READ: 'sqlite:read',
  SQLITE_WRITE: 'sqlite:write',
  NETWORK_FETCH: 'network:fetch',
} as const;

export type PermissionsPattern = typeof Permissions[keyof typeof Permissions];

// 插件的進入點定義 (Plugin Entry Point Definition)
export interface PluginEntryPoints {
  main?: string; // 後端(Node/Electron)進入點，相對於擴充套件根目錄 (例如 "dist/main.js")
  renderer?: string; // 前端(React/UI)進入點，相對於擴充套件根目錄 (例如 "dist/renderer.js")
}

// 插件宣告清單 (Plugin Manifest) - 1.0 Unified Format
export interface PluginManifest {
  pluginId: string;       // 唯一標識符，建議為 com.author.plugin-name
  name: string | Record<string, string>;           // 顯示名稱 (Display name)
  version: string;        // Semantic Versioning
  author?: string;
  description?: string | Record<string, string>; // 插件描述 (Description)
  permissions: PermissionsPattern[]; // 需要請求的系統權限
  // 1.0 新增：直接在此宣告節點，不需分開 node-manifest.json
  nodes?: NodePluginManifest[];
  languages?: Record<string, string>; // 1.2 新增：支援語言包 (e.g. { "ja-JP": "lang/ja-JP.json" })
}

// SDK 注入到前端/後端的上下文物件事 (Plugin Context/API)
// 這裡定義傳送給外掛的可用 API
export interface PluginContext {
  // 可注入一些跟系統溝通的介面，例如發送通知、讀取憑證等
  id: string;
}

/** 每個輸入/輸出 Port 的資料型別 */
export type PortDataType = 'string' | 'number' | 'boolean' | 'json' | 'table' | 'credential' | 'fileRef' | 'any';
export type PortAccepts = 'spreadsheet' | 'document' | 'presentation' | 'any';

/** 一個 Port 的完整宣告 */
export interface PortSchema {
  key: string;          // 在 contextData 中的鍵名
  label: string | Record<string, string>;        // UI 顯示名稱
  type: PortDataType;
  accepts?: PortAccepts; // 僅 type === 'fileRef' 時有效
  required?: boolean;
  default?: unknown;    // 沒有上游連線時的預設值
  description?: string | Record<string, string>;
  options?: string[];   // type === 'select' 時使用
}

/** 節點的渲染模式 */
export type NodeRenderMode = 'pipeline' | 'htmlOutput' | 'iframe' | 'chart';

/** 一個插件節點宣告的完整 Manifest */
export interface NodePluginManifest {
  pluginId: string;         // 對應 PluginManifest.id
  nodeType: string;         // 唯一的節點型別識別碼 (如 "google-sheets-read")
  label: string | Record<string, string>;            // UI 顯示名稱
  description?: string | Record<string, string>;
  icon?: string;            // Lucide icon 名稱
  color?: string;           // 節點色系
  category?: string;        // 節點類別
  renderMode: NodeRenderMode;
  defaultVisible?: boolean; // 1.1 新增：開發者定義展示模式預設是否可見
  iframeUrl?: string;       // renderMode='iframe' 時使用
  inputs: PortSchema[];
  outputs: PortSchema[];
  presentation?: { type: 'iframe' | 'table' | 'react-echarts' | 'none'; urlTemplate?: string; };
}
