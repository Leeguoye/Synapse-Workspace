/** Canvas 相關 TypeScript 型別定義 */

export type EdgeStyleVariant = 'solid' | 'dashed' | 'dotted';
export type EdgeRouteType = 'default' | 'step' | 'smoothstep' | 'straight';
export type NodeShape = 'rectangle' | 'rounded' | 'pill' | 'circle';

export interface NodeColorTheme {
  label: string;
  bg: string;
  border: string;
  text: string;
}

export interface CustomColor {
  bg: string;
  border: string;
  text: string;
}

export interface HandleVisibility {
  top: boolean;
  bottom: boolean;
  left: boolean;
  right: boolean;
}

export interface CanvasEdgeData {
  strokeStyle?: EdgeStyleVariant;
  animated?: boolean;
  routeType?: EdgeRouteType;
  color?: string;
  strokeWidth?: number;
  [key: string]: unknown;
}

/** Plugin port 型別 (Plugin port types) */
export type PortType =
  | 'string'
  | 'number'
  | 'boolean'
  | 'json'
  | 'credential'
  | 'fileRef'    // Drive 檔案 ID（拖曳自動填充）(Drive file ID, supports drag & drop injection)
  | 'any';

/** Plugin port 接受的 Drive 檔案分類 (Accepted Drive MIME category for fileRef ports) */
export type PortAccepts = 'spreadsheet' | 'document' | 'presentation' | 'any';

/** 單一 Port 規格定義，來自 plugin.json (Single port specification from plugin.json) */
export interface PortSchema {
  key: string;
  label: string;
  type: PortType;
  required?: boolean;
  default?: unknown;
  /** 僅 fileRef 類型：限定接受的 Drive 檔案類型 (Only for fileRef: accepted Drive file category) */
  accepts?: PortAccepts;
  /** 僅 string 類型且有此欄位時，渲染成 select 下拉 (Rendered as select when provided) */
  options?: string[];
  description?: string;
  /** 是否在畫布節點上隱藏連接埠（僅顯示於屬性面板） (Hidden from canvas ports, only in property panel) */
  hidden?: boolean;
}

export interface CanvasNodeData {
  label?: string;
  shape?: NodeShape;
  colorKey?: string;
  customColor?: CustomColor;
  handles?: HandleVisibility;
  fontSize?: number;
  resourceFileId?: string;
  resourceFileName?: string;
  resourceMimeType?: string;
  resourceIconLink?: string;
  resourceWebViewLink?: string;
  resourceAppProperties?: Record<string, string>;

  // Dual Canvas Mode properties
  canvasMode?: 'logic' | 'presentation';
  isVisibleInPresentation?: boolean;
  logicPosition?: { x: number; y: number };
  presentationPosition?: { x: number; y: number };

  // Pipeline Execution Metadata
  pipelineType?: 'none' | 'python' | 'text' | 'javascript';
  pipelineStatus?: 'running' | 'success' | 'error';
  pipelineLogs?: string[];
  pipelineData?: any;
  pipelineScript?: string;

  // Plugin Node Metadata (Phase D+)
  nodePluginId?: string;       // 格式: "{pluginId}::{nodeType}"
  nodeType?: string;           // 插件定義的節點型別
  nodeIcon?: string;           // 插件自訂 icon（emoji 或 Lucide name）
  nodeColor?: string;          // 插件自訂主題色（hex）
  /** 插件渲染模式：pipeline = 參與管線執行；htmlOutput = 純設定型，輸出 HTML 檔 */
  nodeRenderMode?: 'pipeline' | 'htmlOutput';
  /** 展示模式渲染設定 (Presentation mode rendering settings) */
  presentation?: {
    type: 'iframe' | 'table' | 'react-echarts' | 'none';
    urlTemplate?: string;      // 供 iframe 使用
  };
  /** 使用者設定的各 Input Port 靜態值（無連線時使用）*/
  nodeInputConfig?: Record<string, unknown>;
  /** Port Schema（由插件 manifest 在 onDrop 時一併寫入，方便節點元件直接讀取）*/
  portInputs?: PortSchema[];
  portOutputs?: PortSchema[];

  [key: string]: unknown;
}
