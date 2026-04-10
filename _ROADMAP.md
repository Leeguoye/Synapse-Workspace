# 專案開發藍圖與系統規格 (Roadmap & Feature Specs)

## 產品定位
基於 Google Drive 的**混合式戰情室平台 (Hybrid War Room Platform)**
將強大的雲端能力，透過插件架構打造自動化中樞。
專案採BYOK機制，所有資料與憑證皆由使用者自行管理。軟體本身開源且基本免費，提供patreon自由贊助，但未來可能會推出付費的插件。

**注意：全面暫時站停本地端開發，專注於雲端功能開發**

## 核心地基
* (暫停) **虛擬檔案系統 (VFS)**: 抽象化檔案操作，支援 Google Drive 與 本地資料夾 (Node.js FS) 的無縫切換。
* **連接核心 (Connection Base)**: 整合 Google Auth/Drive/Sheets/Gmail 與本地 SQLite 緩存。
* **視覺引擎 (Base UI)**: 內建 Markdown 編輯器與基於 React Flow 的無限畫布框架。
* **插件 SDK (Plugin SDK)**: 暴露核心能力 (Auth, DB, UI 注入)，允許開發者自訂節點、第三方 API 串接。
* **憑證管理員 (Credential Manager)**: 統一管理雲端金鑰 (BYOK) 與本地敏感憑證。

---

## 1. 核心開發階段 (Core Development Phases — 按相依性排序)
*遵循「地基先行、自身插件驗證 (Dogfooding)」原則，確保系統穩定與 SDK 可用性。*

### Phase A: 安全地基與環境隔離 (Security & Persistence)
- [x] **品牌名稱與環境隔離遷移**: 將名稱由 Nexus 遷移至 Synapse 並完成 `%APPDATA%` 路徑安全重定向。
- [x] **OAuth 金鑰資料庫化**: 拋棄明文 `token.json`，將登入後金鑰遷移至 SQLite 憑證庫，且採用 AES-256-GCM 加密保護。
- [x] **實體金鑰即時健康防呆**: 實作開機與背景輪詢。若發現指定的金鑰實體檔案被從後台誤刪，能自動清除資料庫假紀錄並切斷連線。

### Phase B: 憑證管理器與 Plugin SDK 雛型 (SDK Definition)
- [x] **Credential Manager UI**: 實作全域憑證管理介面，支援文字字串、實體檔案等多格式金鑰建立與刪除。
- [x] **無痛入門設定教學 (SetupScreen)**: 缺乏金鑰時，於主視窗強制呈現精美的多語系 i18n 導引設定教學分頁，免除新手困境。
- [x] **Plugin SDK 基建**: 規劃完整的 `PluginManifest`，定義了擴充權限 (如 `drive:read`、`sqlite:write`)，並實作 `%appData%/plugins` 的開機自動探索與 SQLite 註冊。

### Phase C: 視覺化程式引擎與管線 (Visual Programming Pipeline)
*將抽象的後台資料同步實體化，打造類 Node-RED / n8n 的視覺化邏輯編輯器。此階段為核心功能的最終型態。*
- [x] **雙層畫布架構 (Logic vs Presentation)**: 
  - **架構原則**: 採用「單一組件、雙重模式 (`mode="logic" | "presentation"`)」。底層共用同一份 JSON 結構，僅透過模式切換渲染樣式、位置與可見度。
  - **邏輯控制區 (後台)**: 供開發者拉線拼接「自動化工作流」。React Flow 僅負責**定義節點關聯 (DAG)**，產生邏輯 JSON。
  - **展示互動區 (前台)**: 即無限畫布。存放最終呈現在介面的 UI 節點 (如 ECharts)。
- [x] **Electron 背景執行引擎 (Main Process Runner)**:
  - **核心限制**: API 抓取與定時任務 (Cron) **必須由 Electron 主程序負責執行**，嚴禁於 React Renderer 內執行耗時或具副作用的邏輯。
  - **轉譯器**: 實作將邏輯 JSON 轉譯為背景執行緒 (Worker) 或主程序任務的 Runner 類別。
- [x] **資料匯流排 (Event Bus / IPC Sync)**:
  - 實作解耦更新機制。邏輯區抓取到資料後，透過 SQLite 紀錄狀態並以 IPC 通知前端節點，達成動態響應。
- [x] **Python 運算與腳本節點 (Python Node/Block)**:
  - 核心功能：實作能呼叫本機端 Python 直譯器執行的邏輯方塊，支援讀寫 SQLite 與本機自動化腳本。這將作為視覺化編輯器強大的數據處理輔助中樞。
- [x] **CLI 自動化門戶**: 與背景執行引擎對接，支援外部命令列觸發工作流。

### Phase D: 核心外掛引擎與沙盒實作 (Plugin Runtime Engine)
*在雙層畫布架構穩定後，才開始實作外掛載入，確保 SDK 注入位址已定型。*

#### D-1. 插件節點定義標準 (NodePlugin Spec)
- [x] **定義 `NodePluginManifest` 型別**（`pluginId`, `nodeType`, `portSchema`, `renderMode`, `icon`, `color`）。
- [x] **定義 `PortSchema` 標準**：宣告每個節點輸入/輸出的資料格式。
- [x] **建立 `PluginNodeRegistry`**：Main Process 啟動時自動掃描並匯入節點宣告。
- [x] **更新 `canvasTypes.ts`**：支援 `nodePluginId` 元資料。

#### D-2. 插件沙盒執行環境 (Plugin Sandbox)
- [x] **實作 `PluginContextBridge`**：提供 `http`, `google`, `sqlite`, `credentials` 等受控 API。
- [x] **實作 `PluginSandboxRunner`**：使用 Node.js `vm` 模組建立隔離執行環境，成功通過 `ENOENT` 與 `Google API` 連通性測試。
- [x] **整合 `PipelineRunner.ts`**：實現插件節點的自動分流執行邏輯。

#### D-3. 觸發器管理員 (Trigger Manager) [x]
- [x] 定義 `TriggerBase` 抽象類別：包含生命週期方法。
- [x] 實作 `CronTrigger` (定時觸發)：內建 `node-cron` 解析器。
- [x] 實作 `EventTrigger` (IPC 事件): 支援外部信號喚醒。
- [x] 整合 `TriggerManager`: 實現應用啟動時自動掛載觸發器。
- [x] **驗證**: 已通過資料庫掛載與服務初始化測試。

#### D-4. 插件節點存放介面 (Plugin Node Library UI)
- [x] 在畫布工具列加入「節點庫」按鈕，展開一個可搜尋的浮動面板。
- [x] 面板中以分類卡片顯示所有已安裝插件的節點類型（來自 `PluginNodeRegistry`）。
- [x] 支援「拖拉節點卡片至畫布」的操作（`onDrop` 時依 `nodePluginId` 建立對應節點）。
- [x] 插件節點的 Property Panel 由插件自身的 Schema 動態生成（顯示輸入接口的設定欄位，而非固定的腳本文字框）。
- [x] 移除舊有 `pipelineType` 的硬編碼下拉選單，整合進新的節點庫系統。

### Phase E: 官方插件庫與自身驗證 (Official Plugins & Dogfooding)
*親自使用 Phase D 完成的引擎開發核心功能，確保 SDK 絕對好用。*
- [ ] **Google Workspace 複合插件**: 包含 Sheets 讀寫（row/column `table`）、Doc 讀寫（`text/plain`/`batchUpdate`）、md/tex/link 檔案編輯，合為單一 `com.synapse.official.workspace` 插件。
- [x] **Cron Trigger 整合**: 實作畫布排程 (Cron) 圖形化介面，支援間隔與「每日定時 (HH:mm)」模式。
- [ ] **(暫停) 本地 CSV 資料編輯器**: 實作 `.csv` 視覺化編輯，並建立自動載入 SQLite 的 Data Pipeline。

#### E-1. 基礎邏輯插件 (com.synapse.official.logic) [已完成]
> HTML 輸出型態：**無**（純畫布節點）
- [x] `button-trigger` — 手動觸發按鈕（前台可見）
- [x] `text-input` — 文字輸入節點
- [x] `text-output` — 文字輸出顯示節點
- [x] `arithmetic` — 基礎四則運算（+, -, *, /, %, 取整）
- [x] `random` — 隨機數 / 隨機選擇
- [x] `if-branch` — 條件分支（if/else）
- [x] `text-joiner` — 文本組合器（支援 A-D 槽位與分隔符）
- [x] `compare` — 數值與邏輯比較器
- [x] `delay` — 非同步延遲傳遞節點
- [x] `type-cast` — 手動型別轉換 (String/Number/Bool)
- [x] `json-parse / json-stringify` — JSON 資料解析與序列化
- [x] `calendar-picker` — 視覺化日曆選擇器（輸出 ISO 8601 與本地時區偏置）


#### E-2 資料視覺化插件：ECharts (com.synapse.official.charts) [已完成]
- [x] 實作 ECharts 原生渲染引擎 (React-ECharts Embed)。
- [x] 提供 19 個視覺化相關節點（含 5 個資料轉換器與 14 個圖表類型）。
- [x] 支援從 Google Sheets 自動讀取並轉換為 ECharts Option。
- [x] 實作雙模式分離渲染：展示模式下自動放大圖表寬度。
- [x] **狀態**: ✅ 已發布。核心邏輯已在 `plugin.js` 實作。

#### E-3. 工單與管理系統插件 (com.synapse.official.workflow) [計劃中]
> HTML 輸出型態：**強烈建議**（每份工單 = 一個獨立 HTML 實體檔）
- [ ] 工單建立節點（填入負責人、審查人、截止日、標籤）
- [ ] 狀態流轉節點（待處理→進行中→審查中→完成→封存）
- [ ] Gmail 自動發信觸發（每次狀態變更通知負責人與審查人）
- [ ] 自動生成獨立 HTML 工單實體（每階段同步一次，完成後封存至 Drive）
- [ ] Canvas 節點亦可直接顯示工單列表（備用方案）
- [ ] **可行性**: ✅ 高。核心邏輯可完全在管線內實作，HTML 實體透過 `html-generator` 節點 + Drive 寫入即可。Gmail API 已在 `ctx.google.gmail` 計劃中。

#### E-4. Google Workspace 操作插件 (com.synapse.official.workspace) [已完成]
- [x] 實作 `drive-create-link` 渲染
- [x] 實作 `sheets/docs-read/write` 節點 (支援覆寫與追加模式)
- [x] 實作 `md/tex-write` 節點 (支援 Overwrite/Append)
- [x] 實作 `gmail-send` 節點
- [x] 實作 `calendar-create` 節點
- [x] 實作 `gemini-ai` 整合節點 (REST API + BYOK)
- [x] 實作 `Dual-Mode Rendering` (Presentation iframe)
- [x] 建立 `plugin.json` 與 `plugin.js`

#### E-5. 語言學習插件 (com.synapse.official.langlearn) [計劃中]
> HTML 輸出型態：**強烈建議**（獨立 HTML 學習介面）
- [ ] 單字庫節點（連結 Google Sheets 作資料庫）
- [ ] 遺忘曲線排程節點（SM-2 演算法或 FSRS）
- [ ] 測驗生成節點（選擇題/填空題）
- [ ] 個人化曲線調整（慢速遺忘者可調整關鍵節點間隔）
- [ ] 獨立 HTML 測驗介面（可離線靜態操作）
- [ ] **可行性**: ✅ 可行。SM-2 可在 `plugin.js` 純 JS 實作。HTML 介面透過 `html-generator` 節點生成，Google Sheets 作資料持久化。

#### E-6. 一鍵發文插件 (com.synapse.official.social-post) [計劃中]
> HTML 輸出型態：**無**（純管線節點）
- [ ] Facebook 發文（Graph API）
- [ ] Instagram 發文（Instagram Graph API）
- [ ] X (Twitter) 發文（Twitter API v2）
- [ ] Threads 發文（Threads API）
- [ ] 圖片附件支援（連結 Drive 圖片）
- [ ] 發文排程（Cron Trigger 整合）
- [ ] **可行性**: ⚠️ 中等。各平台 API 認證流程不同，需各自在 Credential Manager 存放 Token。FB/IG 使用同一 Meta API，相對方便。X API 有付費門檻（Basic tier $100/月）——需告知使用者。Threads API 目前較新，文件仍在演進。

#### E-7. YouTube 分析插件 (com.synapse.official.youtube) [計劃中]
> HTML 輸出型態：**建議**（客製化儀表板獨立 HTML）
- [ ] 頻道數據抓取（訂閱數、觀看數、影片列表）
- [ ] 影片詳細數據（按讚、留言、觀看時間趨勢）
- [ ] ECharts 視覺化儀表板（搭配 E-2 插件）
- [ ] 客製化 HTML 儀表板輸出
- [ ] **可行性**: ✅ 高。YouTube Data API v3 有免費配額（10,000 unit/day），對個人使用者足夠。透過 `ctx.http` 呼叫，或整合 Google OAuth。

#### E-8. 金融分析插件 (com.synapse.official.finance) [計劃中]
> HTML 輸出型態：**建議**（分析報告獨立 HTML）
- [ ] 股票/加密貨幣資料抓取節點（Yahoo Finance / CoinGecko API）
- [ ] 技術指標計算節點（MA, RSI, MACD）
- [ ] Python 數據分析整合（pandas, ta-lib）
- [ ] ECharts K線圖、趨勢圖
- [ ] 自動生成分析報告 HTML
- [ ] **可行性**: ✅ 可行。Yahoo Finance 非官方 API 免費可用。ta-lib 需使用 Python 節點（Phase C 已支援）。CoinGecko 有免費公開 API。


### Phase F: 體驗優化與 UX 補完 (UX Polishing)
- [ ] **畫布撤銷/重做系統 (Undo/Redo)**。
- [ ] **節點複製貼上**
- [x] **全域語意化主題重構**: 移除應編碼顏色，全面遷移至 Tailwind CSS v4 語意化變數系統。
- [x] **Canvas 模式與座標分離**: 實作 Logic/Presentation 獨立座標存儲，並支援 Manifest 定義的 `defaultVisible` 預設顯示狀態。
- [x] **Canvas 模式記憶**: Canvas 儲存時記錄最後的 `isAdvancedMode` 與 `canvasMode`，下次開啟時恢復。
- [ ] **插件節點 UI 自訂**: 在 Canvas 節點庫中，插件可宣告自訂 `icon`（emoji 或 Lucide 名稱）與 `color`，節點卡片與節點頭部同步顯示。
- [ ] **細項調優**: 隱藏網址/分頁列、語系選擇、自訂同步間隔。
- [ ] **日曆/gmail介面**: 在titlebar設定按鈕左側新增日曆與gmail按鈕，透過API接收通知，點擊時跳轉到對應的線上網頁(內部web view)


### Phase G: 插件生態系統 (Plugin Ecosystem)
*等官方插件驗證穩定後，開放第三方插件生態。*
- [ ] **插件 Marketplace UI**: 在設定中提供插件安裝/更新/移除 UI（本地資料夾掃描）。
- [ ] **插件簽章驗證**: 可選的插件簽章機制，提示使用者風險。
- [ ] **付費插件機制**: 透過 Patreon/LemonSqueezy 提供付費插件授權碼驗證（長遠規劃）。

---

## 2. 已完成項目紀錄 (Completed Items Tracking)
- [x] **工作區與搜尋系統**: 支援多 Root Folder 與全域檢索。
- [x] **雙開視窗與標籤系統**: 支援 Split-view 與 Google `appProperties` 同步標籤。
- [x] **原生編輯器**: Monaco Editor 整合 (.md, .tex)。
- [x] **無限畫布底層**: 基礎節點、色盤、資源嵌入與標籤關聯圖 (Graph View)。

---

## 系統評估與展望 (System Vision)
1. **自身插件測試 (Dogfooding)**: 官方核心功能（CSV, Calendar）均以插件形式實作，確保 SDK 絕對好用。
2. **雙層視覺化工廠 (Visual Nodes Engine)**: 將生硬的 API 與排程化為 React Flow 邏輯節點，並由 Electron 主程序穩定執行。

---

## 核心技術架構原則 (Technical Guardrails)
*   **計算與渲染分離**: 所有的資料抓取、DAG 執行、Cron 任務須實作於 **Electron Main Process**。前端 React 僅作為 UI 的「定義者」與「觀察者」。