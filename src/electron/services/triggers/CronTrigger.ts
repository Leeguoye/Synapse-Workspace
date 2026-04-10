import * as cron from 'node-cron';
import { TriggerBase } from './TriggerBase';

export class CronTrigger extends TriggerBase {
  private cronExpression: string;
  private task: any = null;

  constructor(id: string, name: string, canvasId: string, cronExpression: string, config: string | null) {
    super(id, name, canvasId, config);
    this.cronExpression = cronExpression;
  }

  public start(): void {
    if (this.task) this.stop();
    
    // 驗證 cron 語法
    if (!cron.validate(this.cronExpression)) {
      console.error(`[Trigger:${this.id}] 無法啟動，無效的 Cron 語法: ${this.cronExpression}`);
      return;
    }

    try {
        this.task = cron.schedule(this.cronExpression, async () => {
          console.log(`[Trigger:${this.id}] Cron firing: ${this.name} (${this.cronExpression})`);
          await this.triggerPipeline();
        });

        this._isActive = true;
        console.log(`[Trigger:${this.id}] Cron started: ${this.name} (${this.cronExpression})`);
    } catch (err) {
        console.error(`[Trigger:${this.id}] Cron schedule failed:`, err);
    }
  }

  public stop(): void {
    if (this.task) {
      this.task.stop();
      this.task = null;
    }
    this._isActive = false;
    console.log(`[Trigger:${this.id}] Cron stopped: ${this.name}`);
  }
}
