# Synapse 系統架構與資料流總說明

這份文件概述了整個專案的結構、各檔案與資料夾的主要職責、以及資料如何在各個系統層級間傳遞。

## 系統概覽 (Overview)

Synapse 是一個基於 **Electron** 與 **React (Vite 構建)** 的混合式桌面應用程式，主要目標是作為一個增強型的 Google Drive 客戶端。它不僅具備瀏覽雲端硬碟檔案的功能，還支援工作區(Workspace)管理、自訂捷徑(Links)、多窗格瀏覽(Split Mode) 以及整合內部的 Canvas 等進階服務。

### 核心技術堆疊
* **前端**: React 18, Tailwind CSS, Lucide React (圖示), @dnd-kit (拖曳排序功能)
* **後端 / Desktop Native**: Electron (Main Process + Preload Script)
* **API / 雲端整合**: Google Drive API (`googleapis`, `@google-cloud/local-auth`)
* **資料視覺化**: Apache ECharts (`echarts`, `echarts-for-react`)
* **編譯工具**: TypeScript, Vite

---

## 目錄結構與職責說明 (Directory Structure & Responsibilities)

專案原始碼主要集中在 `src/` 目錄內。依照架構分為三大區塊：`UI (前端 React)`、`electron (後端 Node.js)` 與 `shared (共用型別)`。

### 1. `src/UI/` - 前端 React 應用程式
這裡負責所有使用者介面的繪製與本地狀態管理。

*   **`App.tsx` (根元件)**
    *   **職責**: 管理最頂層的狀態，包含目前開啟的檔案列表 (`leftFiles/rightFiles`)、目前選取的檔案 (`activeId`)，以及控制單窗格/雙窗格 (`splitMode`)。
    *   **依賴**: `Sidebar.tsx`, `MainContent.tsx`

*   **`components/Sidebar/` (側邊欄系統)**
    *   **職責**: 負責導覽、工作區切換、檔案樹狀清單、右鍵選單、新增檔案選單等。
    *   **核心檔案**:
        *   `Sidebar.tsx`: 側邊欄的主控元件。
        *   `ModeSelector.tsx`: 切換不同的工作區 (如 My Drive, Starred, Custom Workspaces)。
        *   `FileTree.tsx`: 最複雜的元件，負責向後端請求檔案列表並以樹狀結構進行遞迴渲染。它內部管理了自己的各種選單狀態。
        *   `TreeItem.tsx`: 檔案樹的單一節點，支援雙擊開啟、拖曳操作支援。
        *   `ContextMenu/ContextMenu.tsx`: 點擊右鍵時彈出的操作選單(重新命名、刪除、屬性等)。
        *   `AddMenu/AddMenu.tsx`: 點擊 `+` 號時彈出的新建檔案與範本選單。
        *   `Modals/`: 包含所有跳出視窗（如：`AddWorkspaceModal.tsx`, `FilePropertiesModal.tsx` 等）。
        *   `Constants/Sidebar.constants.tsx`: 統一管理側邊欄 UI 的寬度、位移量等設定參數。

*   **`components/MainContent/` (主內容區)**
    *   **職責**: 負責顯示選中檔案的內容。若為 Google Office 或 PDF 等，則透過 WebView (`GoogleDocViewer`) 渲染；若是本地端支援的格式 (Markdown、Canvas) 則由內部編輯器處理。
    *   **Native Editor (原生編輯器)**: 攔截 `.md` 與 `.tex`，採 Monaco Editor 渲染。包含「雙畫面預覽」(Split View)。
        *   *Offline Sync*: 當收到後端 `offline_saved` 狀態時，UI 頂部會浮現黃色本地暫存徽章。收到 `conflict` 狀態時，系統會先比對 `originalContent` 與 `remoteContent` 是否完全相等，若文字確實被他人異動，則會以 React Portal 彈出滿版 `ConflictResolutionModal` (內建 Monaco DiffEditor) 讓使用者進行視覺化的人工比對與覆寫。

*   **`configs/` (全域設定)**
    *   **`themeConfig.ts`**: **主題管理中樞 (Single Source of Truth)**。定義所有可用主題 (如 Light, Dark, Eva, Miku)、對應圖示及分類邏輯 (`isDarkTheme`)。
*   **`utils/`, `uiComponent/` (共用工具與基礎元件)**
    *   **職責**: 放置整個前端共用的工具函數（如：圖示解析 `getDynamicIcon`）與無狀態小元件 (`DynamicIcon`)。

---

### 2. `src/electron/` - 後端 Electron 程序
這裡負責與作業系統底層互動、網路請求 (Google Drive API) 以及本地端快取 (Store)。

*   **`main.ts`**
    *   **職責**: Electron 主程序的入口，負責建立應用程式視窗 (BrowserWindow)，並啟動 IPC (Inter-Process Communication) 監聽器。
*   **`preload.ts`**
    *   **職責**: 安全橋樑 (Context Isolation)。它將 Node.js 環境下的特定方法 (如 `ipcRenderer.invoke`) 包裝後，透過 `contextBridge` 暴露給前端的 `window.electron` 物件。
*   **`ipc/` (IPC 處理常式)**
    *   **職責**: 實際執行前端呼叫的後端邏輯。
    *   **`driveOps.ts`**: 封裝所有與 Google Drive API 溝通的邏輯 (取得檔案清單、重新命名、刪除、複製、搬移等)。
        *   *Metadata Prefix*: 採用 `syn_` 作為最新元資料前綴（如 `syn_url`, `syn_tags`），並向下兼容舊有的 `nex_` 前綴。
        *   *Offline Sync*: 負責防呆機制。如果網路斷線，會將更新寫入 `DatabaseService` 中的 `localBody` 暫存，回傳 `offline_saved`。若恢復連線且偵測到雲端版本比本地庫中的 `modifiedTime` 更新（衝突），會攔截操作並回傳 `conflict` 狀態與雲端最新內容供前端比對。
    *   **`filesystem.ts`, `workspace.ts`**: 處理本機端設定檔或 Workspace 相關的持久化儲存。
    *   **`credential.ts`, `pluginOps.ts`**: 負責與 Plugin SDK 和本機憑證基礎設施溝通。
    *   **`pipelineOps.ts`**: 負責接收來自前端的 Pipeline 執行請求，或透由 `--run-pipeline` 命令列觸發背景 Pipeline 執行。
    *   **CanvasEditorContent.tsx**: 核心畫布元件。採用 **ID 導向的狀態管理 (`selectedNodeId`)** 非物件引用，確保在模式切換（Layout 重新渲染）時狀態不失真。內建啟動修補程式 (Startup Sanitizer)，自動將節點 ID 標準化為 `pluginId::nodeType`。
        *   **雙模式座標管理**: 實作了「邏輯 (Logic)」與「展示 (Presentation)」模式的座標分離。節點資料 (`CanvasNodeData`) 同時持有 `logicPosition` 與 `presentationPosition`，確保開發環境佈線與終端儀表板配置互不干涉。
        *   **自動化可見性**: 支援根據插件 Manifest 中的 `defaultVisible` 欄位自動決定節點在展示模式下的初始顯示狀態。
    *   **CanvasPropertyPanel.tsx**: 動態屬性面板。根據插件的 `PortSchema` 與 Manifest 自動生成輸入欄位，達成「宣告式 UI (Manifest-driven UI)」。
    *   **ECharts 渲染引擎**: 在 `CanvasPluginNode.tsx` 中實作。偵測到 `presentation.type === 'react-echarts'` 時，會將 Pipeline 輸出的 `option` 資料饋入原生 ECharts 組件進行渲染，支援高互動性的資料圖表嵌入。

... (Service updates) ...
    *   **`PipelineRunner.ts`**: 將畫布 JSON 轉為 DAG 流程圖。負責動態合併節點的屬性配置 (`nodeInputConfig`) 與前序節點輸出。
    *   **`PluginNodeRegistry.ts`**: 管理所有插件宣告的節點類型，作為畫布節點庫的原生資料來源。
    *   **`PluginSandboxRunner.ts`**: 利用 Node.js `vm` 模組建立受限的執行環境。支援 `async/await` 並透過 `ctx.output` 回傳結果至 Pipeline。
    *   **`PluginContextBridge.ts`**: 定義插件執行時的 `ctx` 物件。目前已穩定支援 `ctx.google.sheets` API 注入。
    *   **`triggers/`**: 自動化觸發器 (Phase D-3)
        *   **`TriggerManager.ts`**: 觸發器生命週期管理器
        *   **`CronTrigger.ts`**: 定時排程
        *   **`EventTrigger.ts`**: 事件監聽
    *   **`PythonRunner.ts`**: 利用 Node.js `child_process.spawn` 呼叫本機 `python` 直譯器。

---

### 3. `src/shared/` - 共用資源
*   **`types.ts`**
    *   **職責**: 定義前端與後端共用的 TypeScript 型別 (Interface)。例如 `DriveFile` (檔案結構), `Workspace` (工作區結構) 等，確保資料傳遞時型別安全。

### 4. `src/language/` - 多國語系
*   **`zh-TW.ts`, `index.ts`**
    *   **職責**: 集中管理整個應用程式介面所顯示的字串字典，方便未來實作 i18n 多國語系切換。

---

## 主題管理架構 (Theme Management)

為了確保擴充性，Synapse 採用中心化的主題管理機制：

1.  **集中定義**: 所有主題元資料及分類邏輯存放在 `src/UI/configs/themeConfig.ts`。
2.  **語意化 Token**: 在 `src/UI/index.css` 定義全域變數，區分為：
    *   **結構色 (`theme-*`)**: 依背景、邊框、文字灰階定義的 50-950 色階。
    *   **功能色 (`primary`, `danger`, `warning`)**: 負責按鈕、狀態提示、危險操作等。
3.  **狀態同步**: `App.tsx` 持有 `theme` 狀態，透過對 `<body>` 注入 CSS Class (如 `.warm`, `.eva`) 來切換主題 Token。
4.  **組件解耦**: 元件不再寫死色彩判斷，直接引用如 `bg-primary-main` 等類別。
5.  **第三方適配**:
    *   **Monaco Editor**: 映射至 `vs-dark` 或 `vs`。
    *   **ReactFlow (Canvas/Graph)**: 控制 `colorMode` 與背景點顏色。

---

## 資料傳遞與依賴路線圖 (Data Flow & Dependencies Diagram)

本系統採 **React (UI) <-> ContextBridge (Preload) <-> IPC Main (Backend) <-> 外部 API** 的標準 Electron 通訊架構。

### 核心資料流動方向

```mermaid
graph TD
    subgraph Frontend [UI (React)]
        App[App.tsx<br/>(Top Level State)]
        Sidebar[Sidebar 系列元件]
        MainContent[MainContent 系列元件]
        
        App --> |Props/Callbacks| Sidebar
        App --> |Props/Files Data| MainContent
        Sidebar --> |onSelect/onUpdate| App
    end

    subgraph Preload [Electron Preload]
        ContextBridge[window.electron API]
    end

    subgraph Backend [Electron Main Process]
        IPC[IPC Listeners]
        DriveService[api/driveOps.ts]
        LocalStore[Local Configuration]
    end

    External[Google Drive API]

    %% Data Flow Lines
    Sidebar -.->|呼叫 window.electron| ContextBridge
    MainContent -.->|呼叫 window.electron| ContextBridge
    
    ContextBridge ==>|ipcRenderer.invoke| IPC
    IPC ==>|Call Function| DriveService
    IPC ==>|Read/Write| LocalStore
    
    DriveService <==>|HTTPS Request/JSON| External
```

### 具體情境範例：載入某個資料夾內容

1.  **使用者操作**: 使用者在 `TreeItem.tsx` 點擊一個資料夾展開。
2.  **前端觸發**: `TreeItem` 內部呼叫 `window.electron.listFiles({ parentId: '...' })`。
3.  **Preload 轉發**: `preload.ts` 攔截到，使用 `ipcRenderer.invoke('drive:listFiles', ...)` 傳給主程序。
4.  **後端處理**: `main.ts` 中註冊的監聽器收到指令，轉交給 `driveOps.ts` 內的 API 操作。
5.  **API 請求**: `driveOps` 使用 `@google-cloud` 模組向 Google Drive API 發出 HTTP 請求。
6.  **資料回傳**: Google Server 回傳 JSON，`driveOps` 將其解析並轉換為 `src/shared/types.ts` 定義的 `DriveFile[]` 格式回落給 IPC。
7.  **狀態更新**: `TreeItem.tsx` 獲得回傳的檔案列表，`setChildren(result)`，React 重新渲染畫面上出現該資料夾底下的子檔案。

---

## 總結

專案遵守極高內聚力且低耦合的設計。前端將各種 UI 操作拆解至以 `Sidebar` 及 `MainContent` 為首的元件庫中，並將複雜的底層檔案讀寫與雲端網路請求完全推播到 Electron 後端處理。前後端唯一的溝通管道是強型別定義的 `window.electron` Bridge 與 `shared/types.ts`。
