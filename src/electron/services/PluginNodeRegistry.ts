// src/electron/services/PluginNodeRegistry.ts

import { NodePluginManifest } from '../../shared/plugin.types';

class PluginNodeRegistry {
  private registry = new Map<string, NodePluginManifest>();

  /**
   * 由 PluginService 在掃描插件時呼叫
   * 將此插件宣告的所有節點型式註冊到全局索引中
   */
  registerFromPlugin(pluginId: string, manifests: NodePluginManifest[]): void {
    for (const m of manifests) {
      // 全局唯一 Key 格式: {pluginId}::{nodeType}
      const fullKey = `${pluginId}::${m.nodeType}`;
      if (this.registry.has(fullKey)) {
        console.warn(`[PluginNodeRegistry] 節點型別衝突，跳過載入: ${fullKey}`);
        continue;
      }
      this.registry.set(fullKey, { ...m, pluginId });
    }
    console.log(`[PluginNodeRegistry] 插件 ${pluginId} 已註冊 ${manifests.length} 個節點`);
  }

  /**
   * 插件卸載或被停用時清除對應節點
   */
  unregisterPlugin(pluginId: string): void {
    const keysToDelete: string[] = [];
    this.registry.forEach((value, key) => {
      if (value.pluginId === pluginId) keysToDelete.push(key);
    });
    keysToDelete.forEach(key => this.registry.delete(key));
    console.log(`[PluginNodeRegistry] 已清理插件 ${pluginId} 的 ${keysToDelete.length} 個節點`);
  }

  /** 取得所有註冊的節點 */
  getAll(): NodePluginManifest[] {
    return Array.from(this.registry.values());
  }

  /** 取得單一節點定義 */
  getOne(pluginId: string, nodeType: string): NodePluginManifest | undefined {
    return this.registry.get(`${pluginId}::${nodeType}`);
  }

  /** 依類別分組取得 (供 UI 側邊欄渲染使用) */
  getByCategory(): Record<string, NodePluginManifest[]> {
    const grouped: Record<string, NodePluginManifest[]> = {};
    this.registry.forEach(m => {
      const cat = m.category || 'Other';
      if (!grouped[cat]) grouped[cat] = [];
      grouped[cat].push(m);
    });
    return grouped;
  }
}

export const pluginNodeRegistry = new PluginNodeRegistry();
