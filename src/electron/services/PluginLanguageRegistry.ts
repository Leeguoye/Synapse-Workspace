// src/electron/services/PluginLanguageRegistry.ts
import path from 'path';
import { PluginManifest } from '../../shared/plugin.types';

export interface LanguagePackEntry {
  pluginId: string;
  langCode: string; // e.g., "ja-JP"
  filePath: string; // Absolute path to the JSON file
}

class PluginLanguageRegistry {
  private languages: Map<string, LanguagePackEntry[]> = new Map();

  registerFromPlugin(pluginId: string, pluginPath: string, languages: Record<string, string>) {
    Object.entries(languages).forEach(([langCode, relPath]) => {
      const absPath = path.resolve(pluginPath, relPath);
      const entry: LanguagePackEntry = { pluginId, langCode, filePath: absPath };
      
      const current = this.languages.get(langCode) || [];
      // Remove existing entry from the same plugin if any
      const filtered = current.filter(e => e.pluginId !== pluginId);
      filtered.push(entry);
      this.languages.set(langCode, filtered);
    });
  }

  unregisterPlugin(pluginId: string) {
    for (const [langCode, entries] of this.languages.entries()) {
      const filtered = entries.filter(e => e.pluginId !== pluginId);
      if (filtered.length === 0) {
        this.languages.delete(langCode);
      } else {
        this.languages.set(langCode, filtered);
      }
    }
  }

  getAvailableLanguages(): string[] {
    return Array.from(this.languages.keys());
  }

  getEntriesForLanguage(langCode: string): LanguagePackEntry[] {
    return this.languages.get(langCode) || [];
  }
}

export const pluginLanguageRegistry = new PluginLanguageRegistry();
