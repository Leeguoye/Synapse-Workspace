import { prisma as db } from '../../db.js';
import { CronTrigger } from './CronTrigger';
import { EventTrigger } from './EventTrigger';
import { TriggerBase } from './TriggerBase';

/**
 * TriggerManager (Phase D-3)
 * 負責管理全域的自動化觸發器 (Cron, Event)
 * 並確保在應用程式啟動時自動掛載所有已啟用的項目
 */
export class TriggerManager {
  private static _instance: TriggerManager;
  private triggers: Map<string, TriggerBase> = new Map();

  private constructor() {}

  public static get instance(): TriggerManager {
    if (!TriggerManager._instance) {
      TriggerManager._instance = new TriggerManager();
    }
    return TriggerManager._instance;
  }

  /**
   * 初始化管理器，載入所有活躍中的觸發器
   */
  public async init() {
    console.log('[TriggerManager] Initializing and loading active triggers...');
    await this.resync();
  }

  /**
   * 同步資料庫中的觸發器狀態並重啟所有監聽器
   */
  public async resync() {
    // 1. 停止舊有觸發器
    for (const trigger of Array.from(this.triggers.values())) {
      trigger.stop();
    }
    this.triggers.clear();

    try {
      // 2. 從資料庫載入當前啟用的觸發器
      const activeTriggers = await db.trigger.findMany({
        where: { isActive: true }
      });

      for (const t of activeTriggers) {
        this.addTriggerToRuntime(t);
      }

      console.log(`[TriggerManager] Resync complete. Currently listening to ${this.triggers.size} triggers.`);
    } catch (err) {
      console.error('[TriggerManager] Failed to resync triggers:', err);
    }
  }

  /**
   * 將單一觸發器配置實例化並啟動
   */
  private addTriggerToRuntime(t: any) {
    if (this.triggers.has(t.id)) return;

    let triggerInstance: TriggerBase | null = null;

    if (t.type === 'cron') {
      triggerInstance = new CronTrigger(t.id, t.name, t.canvasId, t.value, t.config);
    } else if (t.type === 'event') {
      triggerInstance = new EventTrigger(t.id, t.name, t.canvasId, t.value, t.config);
    }

    if (triggerInstance) {
      triggerInstance.start();
      this.triggers.set(t.id, triggerInstance);
    }
  }

  /**
   * 手動切換觸發器狀態 (通常由 IPC 呼叫)
   */
  public async toggleTrigger(id: string, active: boolean) {
    if (active) {
      const t = await db.trigger.findUnique({ where: { id } });
      if (t) this.addTriggerToRuntime(t);
    } else {
      const existing = this.triggers.get(id);
      if (existing) {
        existing.stop();
        this.triggers.delete(id);
      }
    }
  }
}
