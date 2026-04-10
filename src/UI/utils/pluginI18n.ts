// src/UI/utils/pluginI18n.ts

/**
 * 根據當前系統語言解析插件中的多語系標籤 (Resolve plugin labels based on current system language)
 * @param label 原始標籤（字串或物件）
 * @param defaultLabel 預設顯示文字
 * @returns 解析後的字串
 */
export function resolvePluginLabel(
  label: string | Record<string, string> | undefined,
  defaultLabel: string = 'Plugin Node'
): string {
  if (!label) return defaultLabel;
  
  if (typeof label === 'string') return label;
  
  // 取得當前語言設定 (zh-TW, en-US)
  const lang = typeof window !== 'undefined' ? (localStorage.getItem('language') || 'zh-TW') : 'zh-TW';
  
  // 優先回傳對應語言，否則回退到 zh-TW, en-US, 或第一個 Key
  return (
    label[lang] || 
    label['zh-TW'] || 
    label['en-US'] || 
    Object.values(label)[0] || 
    defaultLabel
  );
}
