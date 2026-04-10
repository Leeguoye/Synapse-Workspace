import { zhTW } from './zh-TW';
import { enUS } from './en-US';

export type AppLanguage = typeof enUS;

// 基礎語系 (Built-in languages)
const builtin: Record<string, AppLanguage> = {
  'zh-TW': zhTW as AppLanguage,
  'en-US': enUS,
};

// 根據 localStorage 切換語言，預設為 zh-TW
const currentLang = typeof window !== 'undefined' ? (localStorage.getItem('language') || 'zh-TW') : 'zh-TW';

// 初始基礎語言
let base = builtin[currentLang] || builtin['zh-TW'];

/**
 * 允許從外部合併語系內容 (用於插件語言包)
 * Allow merging language content from external sources (e.g., plugin packs)
 */
export function mergeLanguage(extra: any) {
  if (!extra) return;
  // 遞迴合併或簡單合併 (Simple merge for now)
  Object.assign(base, extra);
}

// 導出 t，使用 Proxy 確保動態性 (雖然目前 reload 即可，但 Proxy 提供更好的擴充性)
export const t = new Proxy({} as AppLanguage, {
  get(_, prop: keyof AppLanguage) {
    return base[prop];
  }
});
