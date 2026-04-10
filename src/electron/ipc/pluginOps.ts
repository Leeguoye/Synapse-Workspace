import { ipcMain } from 'electron';
import {
  listPlugins,
  setPluginActive,
  uninstallPlugin,
  installPlugin
} from '../services/PluginService';
import { pluginNodeRegistry } from '../services/PluginNodeRegistry';
import { pluginLanguageRegistry } from '../services/PluginLanguageRegistry';
import { PluginSandboxRunner } from '../services/PluginSandboxRunner';
import { TriggerManager } from '../services/triggers/TriggerManager';
import { prisma as db } from '../db.js';
import fs from 'fs/promises';

export function registerPluginIpc() {
  ipcMain.handle('plugin:execute', async (_, pluginId: string, nodeType: string, inputs: Record<string, unknown>) => {
    return await PluginSandboxRunner.execute(pluginId, nodeType, inputs);
  });
  ipcMain.handle('plugin:list', async () => {
    return await listPlugins();
  });

  ipcMain.handle('plugin:set-active', async (_, pluginId: string, isActive: boolean) => {
    const result = await setPluginActive(pluginId, isActive);
    // 依據狀態與 PluginService 聯動註冊或卸載 (此處由 PluginService.ts 同步處理較佳，但先留 API 接口)
    return result;
  });

  ipcMain.handle('plugin:uninstall', async (_, pluginId: string) => {
    return await uninstallPlugin(pluginId);
  });

  ipcMain.handle('plugin:install', async () => {
    const { dialog } = require('electron');
    const result = await dialog.showOpenDialog({
      properties: ['openFile', 'openDirectory'],
      title: '選擇外掛路徑 (Pick Plugin Folder or File)',
      message: '請選擇包含 plugin.json 的資料夾，或是外掛主程式檔案。'
    });

    if (result.canceled || result.filePaths.length === 0) {
      return { success: false, message: '已取消' };
    }

    try {
      return await installPlugin(result.filePaths[0]);
    } catch (e: any) {
      return { success: false, error: e.message };
    }
  });

  // --- 節點庫相關 IPC ---
  ipcMain.handle('plugin:node-registry:list', async () => {
    return pluginNodeRegistry.getAll();
  });

  ipcMain.handle('plugin:node-registry:get-by-category', async () => {
    return pluginNodeRegistry.getByCategory();
  });

  ipcMain.handle('plugin:node-registry:get-one', async (_, pluginId: string, nodeType: string) => {
    return pluginNodeRegistry.getOne(pluginId, nodeType);
  });

  // --- 語言包相關 IPC ---
  ipcMain.handle('plugin:list-languages', async () => {
    return pluginLanguageRegistry.getAvailableLanguages();
  });

  ipcMain.handle('plugin:get-language-content', async (_, langCode: string) => {
    const entries = pluginLanguageRegistry.getEntriesForLanguage(langCode);
    const result: any = {};
    
    for (const entry of entries) {
      try {
        const content = await fs.readFile(entry.filePath, 'utf-8');
        const json = JSON.parse(content);
        // 合併 (Merge)
        // 注意：簡單合併，如果有 Key 重複，後面的插件會覆蓋前面的
        Object.assign(result, json);
      } catch (e) {
        console.warn(`[pluginOps] Failed to read language file ${entry.filePath}:`, e);
      }
    }
    return result;
  });

  // --- 觸發器管理 (Phase D-3 測試用) ---
  ipcMain.handle('plugin:trigger:create', async (_, data: any) => {
    const trigger = await db.trigger.create({
      data: {
        name: data.name || '手動測試觸發器',
        type: data.type, // 'cron' | 'event'
        value: data.value,
        canvasId: data.canvasId,
        isActive: data.isActive ?? true,
        config: data.config ? JSON.stringify(data.config) : null
      }
    });
    // 重啟管理器以立即載入新觸發器
    await TriggerManager.instance.resync();
    return trigger;
  });

  ipcMain.handle('plugin:trigger:list', async () => {
    return await db.trigger.findMany();
  });

  ipcMain.handle('plugin:trigger:delete', async (_, id: string) => {
    await db.trigger.delete({ where: { id } });
    await TriggerManager.instance.resync();
    return { success: true };
  });

  ipcMain.handle('plugin:trigger:upsert-canvas-cron', async (_, data: { canvasId: string, cron: string, isActive: boolean }) => {
    const existing = await db.trigger.findFirst({
      where: { canvasId: data.canvasId, type: 'cron' }
    });

    if (existing) {
      await db.trigger.update({
        where: { id: existing.id },
        data: { value: data.cron, isActive: data.isActive }
      });
    } else if (data.isActive) {
      await db.trigger.create({
        data: {
          name: `Canvas Cron: ${data.canvasId.substring(0, 8)}`,
          type: 'cron',
          value: data.cron,
          canvasId: data.canvasId,
          isActive: true
        }
      });
    }

    await TriggerManager.instance.resync();
    return { success: true };
  });
}
