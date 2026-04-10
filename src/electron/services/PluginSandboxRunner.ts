// src/electron/services/PluginSandboxRunner.ts

import vm from 'node:vm';
import fs from 'node:fs/promises';
import path from 'node:path';
import { app } from 'electron';
import { createPluginContext } from './PluginContextBridge';
import { pluginNodeRegistry } from './PluginNodeRegistry';

const TIMEOUT_MS = 30000; // 30 秒超時

export class PluginSandboxRunner {
  
  /**
   * 執行插件的一個節點
   */
  static async execute(
    pluginId: string,
    nodeType: string,
    inputs: Record<string, unknown>
  ): Promise<unknown> {
    const manifest = pluginNodeRegistry.getOne(pluginId, nodeType);
    if (!manifest) throw new Error(`[Sandbox] 找不到節點定義: ${pluginId}::${nodeType}`);

    // 定位插件節點腳本
    // 優先使用 SDK 文件規定的 plugin.js（單一檔案 + module.exports）
    // fallback 到舊格式 nodes/${nodeType}.js（獨立檔案）
    const pluginsDir = path.join(app.getPath('userData'), 'plugins');
    const pluginJsPath = path.join(pluginsDir, pluginId, 'plugin.js');
    const nodeJsPath = path.join(pluginsDir, pluginId, 'nodes', `${nodeType}.js`);

    let scriptContent: string;
    let scriptMode: 'plugin.js' | 'nodes/nodeType.js';

    try {
      scriptContent = await fs.readFile(pluginJsPath, 'utf8');
      scriptMode = 'plugin.js';
      console.log(`[PluginSandboxRunner] 使用 plugin.js 模式 (${pluginId}::${nodeType})`);
    } catch {
      try {
        scriptContent = await fs.readFile(nodeJsPath, 'utf8');
        scriptMode = 'nodes/nodeType.js';
        console.log(`[PluginSandboxRunner] 使用 nodes/${nodeType}.js fallback 模式 (${pluginId})`);
      } catch (e: any) {
        console.error(`[PluginSandboxRunner] 兩種路徑都找不到腳本: plugin.js | nodes/${nodeType}.js`);
        throw new Error(`[Sandbox] 找不到插件腳本。請確認 ${pluginJsPath} 或 ${nodeJsPath} 存在。`);
      }
    }

    const { ctx, getOutput } = createPluginContext(pluginId, nodeType, inputs);

    // 建立沙盒環境
    // 注入 module / exports 以支援 SDK 文件規定的 module.exports = {...} 格式
    const moduleObj = { exports: {} as Record<string, unknown> };
    const sandbox = vm.createContext({
      ctx,
      module: moduleObj,
      exports: moduleObj.exports,
      console: {
        log: (...args: any[]) => console.log(`[Plugin:${pluginId}:${nodeType}]`, ...args),
        error: (...args: any[]) => console.error(`[Plugin:${pluginId}:${nodeType}]`, ...args),
        warn: (...args: any[]) => console.warn(`[Plugin:${pluginId}:${nodeType}]`, ...args),
      },
      setTimeout,
      clearTimeout,
      URL,
      Buffer,
      Promise,
      JSON,
      Math,
      Date,
    });

    try {
      // 先執行腳本（讓 module.exports 或直接 ctx.output 都能運作）
      const script = new vm.Script(scriptContent);
      await script.runInContext(sandbox, { timeout: TIMEOUT_MS });

      if (scriptMode === 'plugin.js') {
        // plugin.js 模式：從 module.exports[nodeType] 取得 handler 並執行
        const handler = (moduleObj.exports as Record<string, unknown>)[nodeType];
        if (typeof handler !== 'function') {
          throw new Error(`[Sandbox] plugin.js 的 module.exports 中找不到 handler: "${nodeType}"。請確認 key 名稱與 nodeType 完全一致（區分大小寫）。`);
        }
        await (handler as (ctx: unknown) => Promise<void>)(ctx);
      }
      // nodes/nodeType.js 模式：腳本執行完畢即完成（腳本頂層直接操作 ctx）

      return getOutput();
    } catch (error: any) {
      console.error(`[Sandbox] 執行插件腳本失敗 (${pluginId}::${nodeType}):`, error);
      throw new Error(`插件執行錯誤: ${error.message}`);
    }
  }
}
