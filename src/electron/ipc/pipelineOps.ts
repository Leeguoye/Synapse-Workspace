import { ipcMain } from 'electron';
import { PipelineRunner } from '../services/PipelineRunner';
import * as driveOps from './driveOps'; // We can use downloadFileText internally if needed
// Assuming driveFile operations are available to fetch the file content

const activePipelines = new Map<string, PipelineRunner>();

export function registerPipelineHandlers() {
  ipcMain.handle('pipeline:start', async (event, fileId: string, canvasDataString: string) => {
    try {
      const data = JSON.parse(canvasDataString);
      const runner = new PipelineRunner(
        data.nodes || [], 
        data.edges || [], 
        (nodeId, status, logs, nodeData) => {
          // 透過 Event Bus (WebContents) 發送狀態回前端
          if (!event.sender.isDestroyed()) {
            event.sender.send('pipeline:status-update', {
              fileId,
              nodeId,
              status,
              logs,
              data: nodeData
            });
          }
        }
      );
      
      activePipelines.set(fileId, runner);
      
      // Execute without blocking the IPC return, or await it if we want to know when it finishes
      // Here we await it so the frontend knows the whole pipeline is done
      const result = await runner.executePipeline();
      activePipelines.delete(fileId);
      
      return result;
    } catch (error: any) {
      activePipelines.delete(fileId);
      throw new Error(`Failed to start pipeline: ${error.message || String(error)}`);
    }
  });

  ipcMain.handle('pipeline:stop', async (event, fileId: string) => {
    const runner = activePipelines.get(fileId);
    if (!runner) return { success: false, message: 'No active pipeline found for this file.' };
    
    // In a fully featured version, we'd implement AbortController inside PythonRunner and PipelineRunner
    // For now, we remove it from tracking (could implement hard kill in the future)
    activePipelines.delete(fileId);
    return { success: true };
  });
}

/**
 * 用於 CLI 或背景無介面情境下執行 Pipeline。
 * 1. 取得 Google Drive File 內容
 * 2. 啟動 PipelineRunner 並執行
 */
export async function runPipelineFromCLI(fileId: string) {
  try {
    console.log(`[Pipeline CLI] 開始解析並執行 Pipeline: ${fileId}`);
    
    const { getDriveClient } = await import('../utils/googleAuth.js');
    const drive = await getDriveClient();
    
    // 1. 先取得 Metadata 以診斷檔案型態
    const meta = await drive.files.get({ fileId: fileId, fields: 'id, name, mimeType' });
    const { name, mimeType } = meta.data;
    console.log(`[Pipeline CLI] 正在處理: ${name} (${mimeType})`);

    let content: any;

    if (mimeType?.startsWith('application/vnd.google-apps.')) {
      // 2. 如果是 Google 原生文件，則需要使用 export 介面
      // 目前僅支援將 Docs/Sheets 轉為純文字/CSV 作為 Data 來源，但 Pipeline 執行仍需 nodes/edges
      console.log(`[Pipeline CLI] 偵測到 Google 原生文件，嘗試導出內容...`);
      const exportType = mimeType.endsWith('spreadsheet') ? 'text/csv' : 'text/plain';
      const response = await drive.files.export({ fileId: fileId, mimeType: exportType });
      content = response.data;

      // 如果導出後的內容不是 JSON (Pipeline 格式)，則視為單一 Data Input
      // 這裡我們暫時提示不支援直接執行文件，除非該文件內容本身就是 JSON
      if (typeof content === 'string' && !content.trim().startsWith('{')) {
        throw new Error(`檔案 "${name}" 是 Google 文件，其內容不包含 Pipeline 定義 (JSON)。請確保您執行的是 Synapse Canvas 檔案。`);
      }
    } else {
      // 3. 正常下載 (Canvas 檔案通常是 JSON)
      const response = await drive.files.get({ fileId: fileId, alt: 'media' }, { responseType: 'text' });
      content = response.data;
    }

    if (!content) {
      throw new Error(`無法讀取檔案內容或內容為空: ${fileId}`);
    }

    // 嘗試解析 JSON
    const parsedData = typeof content === 'string' ? JSON.parse(content) : content;
    const { nodes, edges } = parsedData;

    if (!nodes || !Array.isArray(nodes)) {
      throw new Error(`檔案內容不符合 Pipeline 規範 (缺少 nodes 陣列)。`);
    }
    
    const runner = new PipelineRunner(nodes || [], edges || [], (id, status, logs) => {
      console.log(`[Pipeline CLI] Node ${id} - ${status}`);
      if (logs && logs.length > 0) {
        console.log(`[Pipeline CLI] Logs for Node ${id}:\n  ` + logs.join('\n  '));
      }
    });

    const result = await runner.executePipeline();

    if (result.success) {
      console.log(`[Pipeline CLI] 執行完成！`);
    } else {
      console.error(`[Pipeline CLI] 執行失敗，細節請查看日誌。`);
    }
  } catch (err: any) {
    console.error(`[Pipeline CLI] 執行錯誤: ${err.message || String(err)}`);
  }
}

