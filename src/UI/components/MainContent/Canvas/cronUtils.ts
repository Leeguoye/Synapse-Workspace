/** 畫布排程工具：將 UI 狀態轉換為標準 Cron 表達式 (Canvas Schedule Utils) */

export interface CronParams {
  type: 'every_minute' | 'every_hour' | 'every_day' | 'custom';
  value?: number;      // 間隔 (Interval)
  hour?: number;       // 每日時 (Hour)
  minute?: number;     // 每日分 (Minute)
  expression?: string; // 自訂 (Custom Expression)
}

/** 轉換為 5 欄位 Cron 格式: 分 時 日 月 週 (Convert to 5-field Cron format) */
export function toCronExpression(params: CronParams): string {
  const { type, value = 5, hour = 0, minute = 0, expression = '' } = params;

  switch (type) {
    case 'every_minute':
      // 每 n 分鐘: */n * * * *
      return `*/${Math.max(1, value)} * * * *`;
    case 'every_hour':
      // 每 n 小時: 0 */n * * *
      return `0 */${Math.max(1, value)} * * *`;
    case 'every_day':
      // 每日特定時間: m h * * *
      return `${minute} ${hour} * * *`;
    case 'custom':
      // 手輸自訂格式
      return expression || '*/5 * * * *';
    default:
      return '*/5 * * * *';
  }
}

/** 從 Cron 表達式解析回 UI 狀態 (簡化版，主要用於還原) */
export function fromCronExpression(expr: string) {
  // 此處僅為示意，若需要從資料庫反推介面時可用。
  // 目前計畫由 .canvas 檔案儲存原始 UI 狀態，故較不依賴此函式。
  return expr;
}
