import { app } from 'electron';
import fs from 'fs/promises';
import path from 'path';
import { prisma as db } from '../db';
import { PluginManifest } from '../../shared/plugin.types';
import { pluginNodeRegistry } from './PluginNodeRegistry';
import { pluginLanguageRegistry } from './PluginLanguageRegistry';

export async function getPluginsDirectory(): Promise<string> {
  const pluginsPath = path.join(app.getPath('userData'), 'plugins');
  try {
    await fs.mkdir(pluginsPath, { recursive: true });
  } catch (e) {
    // ignore
  }
  return pluginsPath;
}

/**
 * Scans the plugins directory and loads valid manifests.
 * In a real-world scenario, you might want to also verify signatures.
 */
export async function discoverPlugins() {
  const pluginsDir = await getPluginsDirectory();
  try {
    const entries = await fs.readdir(pluginsDir, { withFileTypes: true });

    for (const entry of entries) {
      if (entry.isDirectory()) {
        try {
          // 1. 載入 1.0 統一格式插件宣告 (Unified Plugin Manifest)
          const pluginPath = path.join(pluginsDir, entry.name);
          const manifestPath = path.join(pluginPath, 'plugin.json');
          const manifestContent = await fs.readFile(manifestPath, 'utf-8');
          const manifest: PluginManifest = JSON.parse(manifestContent);
          
          const dbPlugin = await registerOrUpdatePlugin(manifest);

          // 2. 註冊節點與語言包 (Register nodes and language packs from the same file)
          if (dbPlugin.isActive) {
            if (manifest.nodes) {
                pluginNodeRegistry.registerFromPlugin(manifest.pluginId, manifest.nodes);
            }
            if (manifest.languages) {
                pluginLanguageRegistry.registerFromPlugin(manifest.pluginId, pluginPath, manifest.languages);
            }
          } else {
            pluginNodeRegistry.unregisterPlugin(manifest.pluginId);
            pluginLanguageRegistry.unregisterPlugin(manifest.pluginId);
          }
        } catch (e) {
          console.warn(`[PluginService] Failed to load plugin.json for ${entry.name}:`, e);
        }
      }
    }
    
    // 3. 清理已從磁碟刪除但仍存在於資料庫的插件 (Cleanup plugins that are in DB but deleted from disk)
    await cleanupMissingPlugins();
  } catch (error) {
    console.error('[PluginService] Failed to read plugins directory:', error);
  }
}

/**
 * 檢查資料庫中的插件，若實體資料夾已不存在則註銷 (Check DB plugins, unregister if physical folder is missing)
 */
async function cleanupMissingPlugins() {
  const pluginsDir = await getPluginsDirectory();
  const dbPlugins = await db.plugin.findMany();
  
  for (const plugin of dbPlugins) {
    const pluginPath = path.join(pluginsDir, plugin.pluginId);
    const manifestPath = path.join(pluginPath, 'plugin.json');
    
    try {
      await fs.access(manifestPath);
    } catch (e) {
      // 找不到檔案，視為插件已消失 (File not found, consider plugin gone)
      console.log(`[PluginService] Plugin ${plugin.pluginId} folder missing, unregistering...`);
      await uninstallPlugin(plugin.pluginId);
    }
  }
}

/**
 * 插件啟動或停用時同步註冊 (Sync registration when toggling active state)
 */
async function refreshPluginResources(pluginId: string, isActive: boolean) {
  if (!isActive) {
    pluginNodeRegistry.unregisterPlugin(pluginId);
    pluginLanguageRegistry.unregisterPlugin(pluginId);
    return;
  }

  const pluginsDir = await getPluginsDirectory();
  const manifestPath = path.join(pluginsDir, pluginId, 'plugin.json');

  try {
    const content = await fs.readFile(manifestPath, 'utf-8');
    const manifest: PluginManifest = JSON.parse(content);
    const pluginPath = path.join(pluginsDir, pluginId);

    if (manifest.nodes) {
      pluginNodeRegistry.registerFromPlugin(pluginId, manifest.nodes);
    }
    if (manifest.languages) {
      pluginLanguageRegistry.registerFromPlugin(pluginId, pluginPath, manifest.languages);
    }
  } catch (e) {
    pluginNodeRegistry.unregisterPlugin(pluginId);
    pluginLanguageRegistry.unregisterPlugin(pluginId);
  }
}

async function registerOrUpdatePlugin(manifest: PluginManifest) {
  const resolve = (val: any): string => {
    if (!val) return '';
    if (typeof val === 'string') return val;
    return val['zh-TW'] || val['en-US'] || Object.values(val)[0] || '';
  };

  const manifestString = JSON.stringify(manifest);

  const plugin = await db.plugin.upsert({
    where: { pluginId: manifest.pluginId },
    update: {
      name: resolve(manifest.name),
      author: manifest.author || '',
      version: manifest.version,
      description: resolve(manifest.description),
      manifest: manifestString,
    },
    create: {
      pluginId: manifest.pluginId,
      name: resolve(manifest.name),
      author: manifest.author || '',
      version: manifest.version,
      description: resolve(manifest.description),
      manifest: manifestString,
      isActive: manifest.pluginId.startsWith('com.synapse.official'),
    }
  });

  console.log(`[PluginService] Registered plugin: ${manifest.name} (${manifest.pluginId})`);
  return plugin;
}

/**
 * List all known plugins from DB
 */
export async function listPlugins() {
  return await db.plugin.findMany({
    orderBy: { createdAt: 'desc' }
  });
}

/**
 * Grant or revoke permissions (activate/deactivate)
 */
export async function setPluginActive(pluginId: string, isActive: boolean) {
  const plugin = await db.plugin.update({
    where: { pluginId },
    data: { isActive }
  });

  // 同步更新 Registry
  await refreshPluginResources(pluginId, isActive);
  
  return plugin;
}

/**
 * Deletes a plugin entirely (from DB, optionally deletes folder but won't do that yet for safety)
 */
export async function uninstallPlugin(pluginId: string) {
  const plugin = await db.plugin.findUnique({ where: { pluginId } });
  if (plugin) {
    pluginNodeRegistry.unregisterPlugin(pluginId);
    pluginLanguageRegistry.unregisterPlugin(pluginId);
    
    // 同時移除實體資料夾 (Remove physical folder from userData)
    const pluginsDir = await getPluginsDirectory();
    const pluginPath = path.join(pluginsDir, pluginId);
    try {
      await fs.rm(pluginPath, { recursive: true, force: true });
      console.log(`[PluginService] Physical folder removed for: ${pluginId}`);
    } catch (e) {
      console.warn(`[PluginService] Failed to remove folder for ${pluginId}:`, e);
    }
  }
  return await db.plugin.delete({ where: { pluginId } });
}

/**
 * 遞迴複製資料夾 Helper (Recursive Copy Helper)
 */
async function copyDir(src: string, dest: string) {
    await fs.mkdir(dest, { recursive: true });
    const entries = await fs.readdir(src, { withFileTypes: true });

    for (const entry of entries) {
        const srcPath = path.join(src, entry.name);
        const destPath = path.join(dest, entry.name);

        if (entry.isDirectory()) {
            await copyDir(srcPath, destPath);
        } else {
            await fs.copyFile(srcPath, destPath);
        }
    }
}

/**
 * 從指定路徑安裝外掛 (Install plugin from a workspace path)
 */
export async function installPlugin(sourcePath: string) {
    console.log(`[PluginService] Attempting to install plugin from: ${sourcePath}`);
    
    // 檢查來源
    const stats = await fs.stat(sourcePath);
    let targetId = '';
    let pluginDirToCopy = '';

    if (stats.isDirectory()) {
        const manifestPath = path.join(sourcePath, 'plugin.json');
        try {
            await fs.access(manifestPath);
            const content = await fs.readFile(manifestPath, 'utf-8');
            const manifest: PluginManifest = JSON.parse(content);
            targetId = manifest.pluginId;
            pluginDirToCopy = sourcePath;
        } catch (e) {
            throw new Error('該資料夾內找不到 plugin.json，請確保這是一個符合規範的外掛。');
        }
    } else {
        // 選取的是單一檔案 (exe/js/python)
        // 嘗試在同目錄下找 plugin.json
        const parentDir = path.dirname(sourcePath);
        const manifestPath = path.join(parentDir, 'plugin.json');
        try {
            await fs.access(manifestPath);
            const content = await fs.readFile(manifestPath, 'utf-8');
            const manifest: PluginManifest = JSON.parse(content);
            targetId = manifest.pluginId;
            pluginDirToCopy = parentDir;
        } catch (e) {
           throw new Error('選取的檔案周圍找不到 plugin.json，無法確定外掛識別碼。');
        }
    }

    if (!targetId || !pluginDirToCopy) throw new Error('無法識別外掛 ID。');

    const pluginsDir = await getPluginsDirectory();
    const destination = path.join(pluginsDir, targetId);

    // 執行複製 (Copying)
    console.log(`[PluginService] Copying ${pluginDirToCopy} to ${destination}`);
    await copyDir(pluginDirToCopy, destination);
    
    // 重新掃描 (Rescan)
    await discoverPlugins();
    
    return { success: true, pluginId: targetId };
}
