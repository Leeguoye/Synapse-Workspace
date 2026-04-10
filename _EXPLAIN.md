# Synapse：混合式戰情室平台與自動化中樞 

**Synapse** 是一個基於 Electron 與 React 開發的「混合式戰情室平台 (Hybrid War Room Platform)」。它不僅是一個桌面端的檔案管理與 Markdown 編輯器，更是一個強大的**視覺化無程式碼/低程式碼 (No-Code / Low-Code) 自動化工作流引擎**。

透過高度解耦的插件 (Plugin) 架構與 BYOK (Bring Your Own Key) 的憑證管理系統，Synapse 允許使用者將 Google Workspace、本地端資料庫、Python 腳本與各大 API 服務串聯起來，打造專屬的資料處理管線與視覺化儀表板。

---

## 核心功能特色 (Core Features)

1. **視覺化邏輯引擎 (Visual Programming Pipeline)**
   - 類似 Node-RED 或 n8n 的「無限畫布」工作流編輯器。
   - **雙模式架構**：
     - `Logic Mode (邏輯模式)`：供開發者拉線拼接節點、處理 API 請求、資料轉換與定時排程。
     - `Presentation Mode (展示模式)`：隱藏雜亂的邏輯連線，僅呈現精美的 UI 節點 (如 ECharts 儀表板、互動按鈕、文字方塊)。
   - **背景執行**：所有非同步操作與 API 呼叫均在安全的 Electron 獨立執行緒（Main Process / Worker）中執行，保證 UI 流暢不卡頓。

2. **強大的觸發器與排程 (Trigger & Scheduling)**
   - 內建 `CronJob` 支援，允許節點工作流在指定時間或週期間隔自動執行（如：每天早上 8 點自動抓取股票資料並發送信件）。
   - 支援 CLI 指令喚醒與手動畫布按鈕觸發。

3. **統一憑證安全管理器 (Credential Manager & BYOK)**
   - 全面採用 BYOK (自攜金鑰) 機制。使用者的 Google OAuth Token 或第三方 API Key 皆儲存於本地 SQLite 資料庫中。
   - 採用 `AES-256-GCM` 高強度加密防護，並具備金鑰遺失自動防呆偵測，不將敏感覺料上傳至第三方伺服器。

4. **資料庫與 VFS (虛擬檔案系統) 整合**
   - 抽象化底層檔案系統，目前專注於雲端的 Google Drive 檔案結構整合與存取。
   - 提供內開視窗的 Markdown 編輯與邏輯關聯檢視。

5. **沙盒化外掛架構 (Plugin SDK & Sandbox)**
   - 開放完整的開發者 SDK，支援讀寫 SQLite、呼叫 Http Request、操作 Google API 等權限。
   - 外掛程式碼跑在隔離的 Node.js `vm` 沙盒中，確保系統底層安全。

---

## 現有內建插件 (Available Plugins)

目前系統已實作並搭載了以下三大核心官方插件群：

### 1. 基礎邏輯外掛 (`com.synapse.official.logic`)
負責處理工作管線中的資料控制、運算與流程分流。
- **基礎輸入/輸出**：文字輸入、文字顯示、手動觸發按鈕、視覺化日曆選擇器。
- **資料處理與運算**：基礎四則運算 (`arithmetic`)、字串組合 (`text-joiner`)、隨機數、JSON 解析與序列化。
- **流程控制**：條件分支 (`if-branch`)、邏輯與數值比較 (`compare`)、延遲等待 (`delay`)。

### 2. 數據視覺化套件 (`com.synapse.official.charts`)
深度整合 ECharts，提供專案管理、財務分析與數據報告的視覺化呈現。
- **資料轉換器 (Transformers)**：將試算表 (Google Sheets) 原始資料轉譯為圖表可讀格式。
- **視覺圖表 (Charts)**：高達 14 種原生互動式圖表。包含：折線圖、長條圖、圓餅圖、熱力圖 (Heatmap)、年曆熱力圖、箱型圖 (Boxplot)、K 線圖 (Candlestick)、專案甘特圖 (Gantt/Project Status)、關係圖 (Graph Node)、雷達圖與儀表板等。

### 3. Google Workspace 整合工具 (`com.synapse.official.workspace`)
實現跨服務的雲端自動化與 AI 輔助。
- **Google Sheets & Docs**：支援試算表讀寫（附加/覆寫）、文件讀寫。
- **Google Calendar & Gmail**：建立日曆行程、觸發自動寄送 Email。
- **Gemini AI**：內建 Gemini LLM API 呼叫節點，可直接將分析結果或文字送給 AI 總結處理。

---

## 未來發展與計畫中插件 (Upcoming Plugins)

為完善「個人自動化中樞」的願景，未來藍圖將逐步支援更多進階與第三方生態插件：

### 1. 工單與專案管理系統 (`com.synapse.official.workflow`)
- 提供標準化工單建立、狀態流轉（Pending -> In Progress -> Done）節點。
- 支援狀態變更時自動觸發 Gmail 通知，並搭配 HTML Generator 節點將專案進度即時渲染為 Drive 實體網頁。

### 2. 語言與記憶學習工具 (`com.synapse.official.langlearn`)
- 整合 SM-2 或 FSRS 遺忘曲線演算法。
- 以 Google Sheets 做為單字庫緩存，自動推播每日測驗與複習清單，打造專屬的生字本管線。

### 3. 社群媒體一鍵化發布 (`com.synapse.official.social-post`)
- 整合 Facebook, Instagram, Threads 與 X (Twitter) API。
- 支援夾帶 Google Drive 圖片，透過 Cron Trigger 實現多平台自動排程貼文。

### 4. YouTube 頻道分析資料庫 (`com.synapse.official.youtube`)
- 抓取頻道訂閱數、影片按讚與留言趨勢。
- 將數據直接餵給 ECharts 視覺化套件，輕鬆建立客製化的創作者即時儀表板。

### 5. 財經自動化分析 (`com.synapse.official.finance`)
- 讀取 Yahoo Finance 或 CoinGecko API 抓取股價與加密貨幣即時行情。
- 結合 Python 本地運算節點 (TA-lib)，自動計算 MA、RSI、MACD 等技術指標，甚至發出買賣訊號通知。

---

## 商業計畫與開源模式 (Business Model)

Synapse 堅信軟體的本體技術應該被開放與普及，同時發展出健康的開發者生態以維持長期營運：

- **核心軟體 (Free & Open-Source)**：Synapse 的主程式、框架引擎、VFS 以及基礎插件(Logic, Workspace)，將維持完全免費且開源（Open-Source）。我們鼓勵任何人下載、檢查原始碼並進行客製化。軟體本身的日常開發營運，將透過 **Patreon** 接受社群使用者的自由贊助。
- **高階插件付費制 (Premium Plugins)**：為保障長期開發價值，未來推出的特定高階 / 專業版插件（如深度商業分析、特化 API 整合、工單系統進階版等）將需付費解鎖。
  - 我們計畫運用 **Patreon** 作為訂閱/權限管理中樞。贊助者可依據不同層級，獲取專屬高階插件的實體檔案載點與授權驗證。
  - 這套機制為未來的第三方外掛市集 (Marketplace) 鋪路，讓獨立開發者也能透過平台生態獲得實質收益。
