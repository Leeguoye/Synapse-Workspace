# Synapse Plugin SDK 開發文件

> **版本**: 1.1  
> **目標讀者**: 插件開發者  
> **更新日期**: 2026-04-06

---

## 目錄

1. [什麼是 Synapse 插件？](#1-什麼是-synapse-插件)
2. [目錄結構與最低要求](#2-目錄結構與最低要求)
3. [plugin.json 完整規格](#3-pluginjson-完整規格)
4. [節點宣告：NodePluginManifest](#4-節點宣告-nodepluginmanifest)
5. [執行腳本：plugin.js](#5-執行腳本-pluginjs)
6. [Context API 完整參考](#6-context-api-完整參考)
7. [插件顏色與圖示自訂](#7-插件顏色與圖示自訂)
8. [模式與座標系統 (Logic vs Presentation)](#8-模式與座標系統-logic-vs-presentation)
9. [發布與安裝](#9-發布與安裝)
10. [範例插件：Google Sheets 讀取器](#10-範例插件google-sheets-讀取器)
11. [常見錯誤與排除](#11-常見錯誤與排除)
12. [HTML Output 插件](#12-html-output-插件讓節點生成獨立-html-檔案)
13. [互動式 UI 通訊協定 (Interactive Bridge)](#13-互動式-ui-通訊協定-interactive-bridge)

---

## 13. 互動式 UI 通訊協定 (Interactive Bridge)

當插件使用 `presentation` 模式渲染 UI 時，由於 `iframe` 的安全隔離，UI 無法直接與主程序通訊。Synapse 提供了一套基於 `window.postMessage` 的**通用橋接器 (Universal Bridge)**。

### 13.1 執行背景邏輯節點 (`PLUGIN_EXECUTE_NODE`)

這是 SDK 推薦的互動模式：UI 負責收集輸入與觸發，邏輯則由 `plugin.js` 中的背景節點執行。

**發送請求 (從插件 UI 發起):**
```javascript
window.parent.postMessage({
  type: 'PLUGIN_EXECUTE_NODE',
  payload: {
    nodeType: 'create-order', // 要執行的背景節點名稱
    inputs: {                 // 傳給該節點的輸入值
      customer: '張三',
      amount: 1000
    }
  }
}, '*');
```

**接收結果 (在渲染完成後回傳):**
主程式執行完背景節點後，會回傳 `PLUGIN_NODE_OUTPUT` 訊息給 iframe。
```javascript
window.addEventListener('message', (event) => {
  const { type, payload } = event.data;
  if (type === 'PLUGIN_NODE_OUTPUT') {
    if (payload.success) {
      console.log('執行成功:', payload.output);
      // 根據結果更新 UI 或重整畫面
      window.location.reload();
    } else {
      alert('錯誤: ' + payload.error);
    }
  }
});
```

### 13.2 主題同步 (Theme Variables)

主程式會自動將目前的 CSS 變數注入到插件的 `:root` 中。開發者可以不需任何額外設定，直接在插件範本中使用下列變數：

- `var(--app-bg)`: 主程式背景
- `var(--app-text)`: 主文字顏色
- `var(--primary-main)`: 品牌主色調
- `var(--color-theme-50)` ~ `var(--color-theme-900)`: 主題階梯色

這些變數會隨著主程式主題切換而即時更新。

### 13.3 常用系統指令

| 指令 (type) | 說明 | Payload 規格 |
|---|---|---|
| `PLUGIN_UPDATE_META` | 更新此 `.plugin` 檔案的元數據 | `{ name, description, appProperties }` |
| `PLUGIN_CREATE_SHEET` | 在同目錄下建立 Google 試算表 | `{ name }` |
| `PLUGIN_EXECUTE_NODE` | 執行指定的插件節點 | `{ nodeType, inputs }` |

---

## 1. 什麼是 Synapse 插件？

Synapse 插件是存放在 `%APPDATA%/Synapse/plugins/<your-plugin-id>/` 下的資料夾。每個插件可宣告一到多個**節點類型 (Node Types)**，這些節點可以被拖入 Canvas 進行視覺化程式編排（管線 Pipeline）。

插件的程式碼在 Electron 主程序的 **沙盒環境 (Node.js `vm` module)** 內執行，無法直接存取 DOM 或 `window`，但可透過 `ctx` (Context API) 存取受控能力。

---

## 2. 目錄結構與最低要求

```
%APPDATA%/Synapse/plugins/
└── com.yourname.myplugin/          ← pluginId（必須唯一）
    ├── plugin.json                 ← 插件宣告（必要）
    └── plugin.js                   ← 執行腳本（必要）
```

> **注意**: 插件 ID 建議採反向域名格式 (`com.yourname.pluginname`)，避免衝突。

---

## 3. plugin.json 完整規格

```json
{
  "pluginId": "com.yourname.myplugin",
  "name": "My Plugin",
  "version": "1.0.0",
  "author": "Your Name",
  "description": "一行描述這個插件做什麼",
  "permissions": ["http", "google.sheets", "sqlite"],
  "nodes": [
    {
      "nodeType": "fetch-data",
      "label": "抓取資料",
      "category": "資料來源",
      "description": "從 API 端點抓取 JSON 資料",
      "icon": "Download",
      "color": "#6366f1",
      "renderMode": "pipeline",
      "defaultVisible": false,
      "inputs": [
        {
          "key": "url",
          "type": "string",
          "label": "API URL",
          "description": "目標端點，例如 https://api.example.com/data",
          "required": true
        },
        {
          "key": "method",
          "type": "select",
          "label": "HTTP 方法",
          "options": ["GET", "POST", "PUT", "DELETE"],
          "default": "GET"
        },
        {
          "key": "headers",
          "type": "json",
          "label": "請求標頭 (JSON)",
          "description": "例如: {\"Authorization\": \"Bearer token\"}"
        }
      ],
      "outputs": [
        {
          "key": "data",
          "type": "json",
          "label": "回應資料"
        }
      ]
    }
  ]
}
```

### presentation 欄位 [1.2 新增]

用於定義節點在**展示模式 (Presentation Mode)** 下的渲染方式。目前僅支援 `iframe` 類型。

| 屬性 | 類型 | 說明 |
|---|---|---|
| `type` | `"iframe"` | 渲染一個 iframe。 |
| `urlTemplate` | `string` | iframe 的 URL 模板。支援 `{key}` 語法，會自動替換為 `ctx.inputs` 中對應的值。 |

### permissions 可用值

| 權限字串 | 說明 |
|---|---|
| `http` | 允許呼叫 `ctx.http.get/post/put/delete` |
| `google.sheets` | 允許讀寫 Google Sheets |
| `google.gmail` | 允許透過 Gmail API 發信 |
| `google.drive` | 允許讀取 Google Drive 檔案清單 |
| `google.calendar` | 允許讀寫 Google Calendar 事件 |
| `sqlite` | 允許讀寫本地 SQLite 資料庫 |
| `credentials` | 允許讀取使用者在 Credential Manager 存放的金鑰 |
| `filesystem` | 允許讀寫本地檔案系統（謹慎使用） |

### inputs.type 可用值

| 類型 | 說明 | 節點上的呈現方式 |
|---|---|---|
| `string` | 單行文字 | `<input type="text">` |
| `text` | 多行文字 | `<textarea>` |
| `number` | 數字 | `<input type="number">` |
| `boolean` | 布林開關 | Checkbox |
| `select` | 下拉選單（搭配 `options`） | `<select>` |
| `json` | JSON 字串 | 多行 `<textarea>` |
| `credential` | 憑證選擇器 | Credential Manager 下拉 |
| `fileRef` | **Drive 檔案 ID**（可拖曳注入） | 文字輸入（支援從 FileTree 拖入 Drive 檔案自動填充 ID） |

> **fileRef 拖曳注入**：宣告 `type: "fileRef"` 的 input port，使用者可從左側 FileTree 直接把 Google Drive 檔案拖到節點上，Synapse 會自動填入 Drive `fileId`。不需使用者手動複製 ID。
>
> 搭配 `accepts` 欄位可限定接受的檔案類型（`spreadsheet` / `document` / `presentation` / `any`）。

---

## 4. 節點宣告：NodePluginManifest

節點宣告定義在 `plugin.json` 的 `nodes[]` 陣列中。每個節點對應 `plugin.js` 裡 `module.exports` 中同名的 handler 函式。

```typescript
// 型別參考（src/shared/types.ts 對應型別）
interface NodePluginManifest {
  nodeType: string;         // 節點唯一識別符（在此插件內唯一）
  label: string;             // 顯示名稱
  category?: string;         // 分類，用於節點庫面板分組
  description?: string;      // 簡短描述（顯示在節點庫卡片）
  icon?: string;             // emoji 或 Lucide React 圖示名稱（如 "Database"）
  color?: string;            // 十六進位顏色，如 "#6366f1"（節點頭部顏色）
  renderMode: "pipeline" | "htmlOutput"; // 執行模式
  defaultVisible?: boolean;  // [1.1 新增] 展示模式下是否預設顯示 (預設為 false)
  inputs: PortSchema[];      // 輸入接口定義
  outputs: PortSchema[];     // 輸出接口定義
}

interface PortSchema {
  key: string;               // 欄位識別符，對應 ctx.inputs[key]
  type: string;              // 見上表
  label: string;             // 顯示名稱
  description?: string;      // 說明文字（顯示為 placeholder）
  required?: boolean;        // 是否必填
  default?: unknown;         // 預設值
  options?: string[];        // type="select" 時的選項
}
```

---

## 5. 執行腳本：plugin.js

`plugin.js` 使用 CommonJS 格式。`module.exports` 是一個物件，**key 為 nodeType**，值為 `async (ctx) => {}` 函式。

```javascript
// plugin.js 基本範例

module.exports = {
  // 對應 plugin.json 裡 nodeType: "fetch-data"
  'fetch-data': async (ctx) => {
    const url = ctx.inputs.url;
    const method = ctx.inputs.method || 'GET';

    if (!url) {
      throw new Error('URL 不能為空');
    }

    // 使用 ctx.http 發送請求（需宣告 "http" 權限）
    const response = await ctx.http.get(url);

    // 透過 ctx.output() 傳遞結果給下一個節點
    ctx.output({ data: response.data });
  },

  // 另一個節點類型
  'transform-data': async (ctx) => {
    const incoming = ctx.inputs.data; // 上一個節點的輸出會自動注入
    const result = incoming.map(item => ({ ...item, processed: true }));
    ctx.output({ result });
  },
};
```

### plugin.js 限制

- **禁止**使用 `require('fs')`, `require('child_process')` 等原生模組（沙盒已封鎖）
- **禁止**直接 `fetch()`——請使用 `ctx.http`
- **必須**透過 `ctx.output()` 傳遞輸出，否則後續節點收不到資料
- **支援** `async/await`

---

## 6. Context API 完整參考

`ctx` 物件在每次節點執行時注入，提供所有受控 API。

### ctx.inputs

上一個節點的輸出 + 使用者在 Property Panel 設定的靜態值。

```javascript
// 若上個節點輸出 { url: "..." }，以及使用者設定了 method = "POST"
const url = ctx.inputs.url;    // 來自前序節點
const method = ctx.inputs.method; // 來自 Property Panel
```

### ctx.output(data)

傳遞輸出給後續節點。`data` 必須是純物件。

```javascript
ctx.output({ result: [1, 2, 3], count: 3 });
```

### ctx.http

```javascript
// GET
const res = await ctx.http.get('https://api.example.com/items', {
  headers: { 'Authorization': 'Bearer token' },
  params: { limit: 10 }
});

// POST
const res2 = await ctx.http.post('https://api.example.com/items', {
  body: { name: 'New Item' },
  headers: { 'Content-Type': 'application/json' }
});

// res.data   → 解析後的 JSON
// res.status → HTTP 狀態碼
// res.headers → 回應標頭
```

### ctx.google.getAccessToken() [1.2 新增]

獲取當前登入使用者的 Google OAuth 存取權杖 (Access Token)。這是**解耦架構**下的核心 API，讓插件可以自行透過 `ctx.http` 呼叫任何 Google REST API。

```javascript
const token = await ctx.google.getAccessToken();

// 呼叫 Google Drive API 範例
const res = await ctx.http('https://www.googleapis.com/drive/v3/files', {
  headers: { Authorization: `Bearer ${token}` }
});
```

> **注意**: 原有的 `ctx.google.sheets.*` 等硬編碼方法已廢棄，建議改用 `ctx.http` 搭配 `getAccessToken` 以獲得最大彈性。

### ctx.google.gmail（計劃中）

```javascript
await ctx.google.gmail.sendEmail({
  to: 'recipient@example.com',
  subject: '主旨',
  body: '<p>HTML 內容</p>',
  isHtml: true
});
```

### ctx.sqlite

```javascript
// 讀取（SELECT）
const rows = await ctx.sqlite.query(
  'SELECT * FROM my_table WHERE status = ?',
  ['active']
);

// 寫入（INSERT/UPDATE/DELETE）
await ctx.sqlite.run(
  'INSERT INTO my_table (key, value) VALUES (?, ?)',
  ['my_key', JSON.stringify(data)]
);
```

### ctx.credentials

```javascript
// 讀取使用者在 Credential Manager 存放的金鑰
// credentialId 是使用者在 Credential Manager 建立時指定的名稱
const apiKey = await ctx.credentials.get('my-api-key');
```

### ctx.log

```javascript
ctx.log('處理中...', { count: 42 });
// 日誌會出現在 Pipeline 執行後的節點狀態面板中
```

---

## 7. 插件顏色與圖示自訂

每個節點類型可在 `plugin.json` 中宣告 `icon` 與 `color`：

```json
{
  "nodeType": "send-email",
  "label": "發送郵件",
  "icon": "Mail",
  "color": "#f59e0b"
}
```

**icon 支援兩種格式：**

1. **Emoji**：直接寫 emoji 字元，如 `"📧"`, `"📊"`, `"🔔"`
2. **Lucide 圖示名稱**：使用 [Lucide React](https://lucide.dev/) 的圖示名，如 `"Mail"`, `"Database"`, `"BarChart"`（首字母大寫）

**color**：十六進位色碼，決定節點庫卡片左側色塊與節點頭部顏色。

> 在 Canvas 屬性面板中，使用者可以覆蓋節點的顏色設定（透過色盤），但 `plugin.json` 的 `color` 是預設值。

---

## 8. 模式與座標系統 (Logic vs Presentation)

Synapse Canvas 支援兩套獨立的模式，各具備私有的狀態紀錄：

### 8.1 邏輯模式 (Logic Mode)
- **定位**：後台邏輯佈線，開發者在此建立節點連線。
- **座標**：記錄在 `data.logicPosition`。

### 8.2 展示模式 (Presentation Mode)
- **定位**：前台終端介面，僅顯示使用者需要互動或查看結果的節點。
- **座標**：記錄在 `data.presentationPosition`。
- **可見性**：
    - 開發者可透過 `defaultVisible: true` 讓節點（如文字輸出）預設在此模式顯示。
    - 使用者可透過節點右上角的「👁️」按鈕手動強制顯示/隱藏。
    - **座標分離**：在此模式移動節點位置**不會**影響邏輯模式的佈局，允許建立整潔的儀表板。

---

## 9. 發布與安裝

### 開發/測試

1. 建立資料夾 `%APPDATA%/Synapse/plugins/com.yourname.myplugin/`
2. 放入 `plugin.json` 與 `plugin.js`
3. 重新啟動 Synapse，或在 Canvas 的節點庫面板點擊重新整理
4. 拖入節點，設定屬性，執行 Pipeline 測試

### 發布

目前 Synapse 採本地安裝方式，尚無集中式市集。建議：

- **zip 打包**整個資料夾，說明手動解壓至 `%APPDATA%/Synapse/plugins/` 的步驟
- 在 GitHub Release 附上 `install.ps1` 腳本自動複製

---

## 10. 範例插件：Google Sheets 讀取器

以下是一個完整可用的插件範例，從指定的 Google Sheets 讀取資料並輸出 JSON。

**plugin.json**
```json
{
  "pluginId": "com.synapse.official.sheets-reader",
  "name": "Google Sheets 讀取器",
  "version": "1.0.0",
  "author": "Synapse Official",
  "description": "從 Google Sheets 讀取指定範圍資料",
  "permissions": ["google.sheets"],
  "nodes": [
    {
      "nodeType": "read-range",
      "label": "讀取範圍",
      "category": "Google Workspace",
      "description": "從 Sheets 讀取指定儲存格範圍",
      "icon": "Sheet",
      "color": "#22c55e",
      "renderMode": "pipeline",
      "inputs": [
        {
          "key": "spreadsheetId",
          "type": "string",
          "label": "試算表 ID",
          "description": "URL 中 /d/ 後的長字串",
          "required": true
        },
        {
          "key": "range",
          "type": "string",
          "label": "範圍",
          "description": "例如 Sheet1!A1:D100",
          "default": "Sheet1!A1:Z100"
        }
      ],
      "outputs": [
        {
          "key": "rows",
          "type": "json",
          "label": "列資料 (string[][])"
        }
      ]
    }
  ]
}
```

**plugin.js**
```javascript
module.exports = {
  'read-range': async (ctx) => {
    const spreadsheetId = ctx.inputs.spreadsheetId;
    const range = ctx.inputs.range || 'Sheet1!A1:Z100';

    if (!spreadsheetId) {
      throw new Error('[Sheets Reader] spreadsheetId 不能為空');
    }

    ctx.log('正在讀取 Sheets...', { spreadsheetId, range });

    const rows = await ctx.google.sheets.read({ spreadsheetId, range });

    ctx.log(`讀取完成，共 ${rows.length} 列`);
    ctx.output({ rows });
  },
};
```

---

## 11. 常見錯誤與排除

| 錯誤訊息 | 原因 | 解決方式 |
|---|---|---|
| `Plugin not found` | pluginId 拼錯或資料夾名稱不符 | 確認資料夾名稱 = `pluginId` |
| `Permission denied: google.sheets` | `plugin.json` 未宣告對應權限 | 在 `permissions[]` 加入 `"google.sheets"` |
| `ctx.inputs.xxx is undefined` | 使用者未在 Property Panel 填寫必填欄位 | 加入 `required: true` 並在程式碼中驗證 |
| `Cannot require 'fs'` | 嘗試使用被封鎖的原生模組 | 改用 `ctx.sqlite` 或 `ctx.http` |
| 節點庫看不到節點 | 插件掃描失敗 | 檢查 `plugin.json` JSON 格式是否正確（用 JSON Validator） |
| 管線執行後無輸出 | 忘記呼叫 `ctx.output()` | 確保每個節點都有 `ctx.output({...})` |

---

## 附錄：插件開發 Checklist

- [ ] `plugin.json` 的 `pluginId` 與資料夾名稱完全一致
- [ ] 所有用到的 API 都有宣告對應 `permissions`
- [ ] `plugin.js` 的 `module.exports` key 與 `nodeType` 完全一致（區分大小寫）
- [ ] 每個節點 handler 都有呼叫 `ctx.output()`
- [ ] 必填的 `inputs` 都有在程式碼中驗證後才使用
- [ ] 測試過 Pipeline 執行成功且後續節點收得到資料
- [ ] `fileRef` 類型的 port 加了 `accepts` 欄位，縮小拖曳範圍
- [ ] `htmlOutput` 節點提供了 `template.html`，且 `renderMode: "htmlOutput"` 已宣告
- [ ] 決定每個節點在展示模式的預設狀態：輸入/輸出類節點設 `defaultVisible: true`，純運算節點設 `false`

---

## 12. HTML Output 插件：讓節點生成獨立 HTML 檔案

HTML Output 插件是一種特殊的插件模式，**節點不參與管線 Pipeline 執行**，而是作為「配置器」：使用者在節點上設定參數，點擊「Generate HTML」按鈕，插件就會根據設定和 Drive 數據，生成一份完整的 HTML 文件並存到 Google Drive。

### 使用場景

| 場景 | 說明 |
|---|---|
| 工單系統 | 設定工單資料對應的 Sheets，生成一份可獨立操作的 HTML 工單介面 |
| 語言學習 | 設定單字庫 Sheets，生成帶 SM-2 演算法的學習 HTML App |
| 數據看板 | 設定資料來源，生成帶 ECharts 圖表的靜態 HTML Dashboard |

### plugin.json 宣告 htmlOutput 節點

```json
{
  "nodeType": "ticket-board",
  "label": "工單看板",
  "category": "工單系統",
  "icon": "🎫",
  "color": "#f59e0b",
  "renderMode": "htmlOutput",
  "inputs": [
    {
      "key": "spreadsheetId",
      "type": "fileRef",
      "accepts": "spreadsheet",
      "label": "資料試算表",
      "description": "拖入 Google Sheets 自動填入 ID",
      "required": true
    },
    {
      "key": "title",
      "type": "string",
      "label": "工單標題",
      "default": "My Ticket Board"
    },
    {
      "key": "outputFolder",
      "type": "fileRef",
      "accepts": "any",
      "label": "輸出資料夾 ID"
    }
  ],
  "outputs": [
    {
      "key": "fileId",
      "type": "fileRef",
      "label": "生成的 HTML 檔案 ID"
    }
  ]
}
```

> **關鍵差異**：加上 `"renderMode": "htmlOutput"` 後，節點元件上會顯示 🌐 標誌與「Generate HTML」按鈕，且此節點不會被 Pipeline Runner 排程執行。

### plugin.js 實作 htmlOutput handler

```javascript
module.exports = {
  // htmlOutput 節點的 handler 透過 ctx.generateHtml() 生成檔案
  'ticket-board': async (ctx) => {
    const spreadsheetId = ctx.inputs.spreadsheetId;
    const title = ctx.inputs.title || 'My Ticket Board';
    const outputFolder = ctx.inputs.outputFolder;

    // 1. 從 Sheets 讀取資料（需 google.sheets 權限）
    const rows = await ctx.google.sheets.read({
      spreadsheetId,
      range: 'Tickets!A1:F100'
    });

    // 2. 生成 HTML 內容（開發者自行設計介面）
    const htmlContent = `<!DOCTYPE html>
<html lang="zh-TW">
<head>
  <meta charset="UTF-8">
  <title>${title}</title>
  <style>
    body { font-family: sans-serif; padding: 2rem; }
    .ticket { border: 1px solid #ccc; padding: 1rem; margin: 0.5rem 0; border-radius: 8px; }
  </style>
</head>
<body>
  <h1>${title}</h1>
  <div id="tickets">
    ${rows.slice(1).map(row => `
      <div class="ticket">
        <strong>#${row[0]}</strong> — ${row[1]}
        <span class="badge">${row[3]}</span>
      </div>
    `).join('')}
  </div>
</body>
</html>`;

    // 3. 輸出 HTML 到 Drive（ctx.drive.writeHtml 由 Synapse 提供）
    const fileId = await ctx.drive.writeHtml({
      fileName: `${title}.html`,
      content: htmlContent,
      parentFolderId: outputFolder,
    });

    ctx.log(`HTML 生成完成，fileId: ${fileId}`);
    ctx.output({ fileId });
  }
};
```

### template.html（可選）

如果 HTML 內容很複雜，也可以把模板放在插件資料夾的 `template.html` 內，用 `ctx.loadTemplate('template.html')` 讀取後做字串替換：

```javascript
const template = await ctx.loadTemplate('template.html');
const html = template
  .replace('{{TITLE}}', title)
  .replace('{{DATA_JSON}}', JSON.stringify(rows));
```

這樣就能讓設計師獨立維護 `template.html`，不需動 `plugin.js`。
