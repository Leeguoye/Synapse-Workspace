import { ipcMain } from 'electron';
import { TriggerBase } from './TriggerBase';

export class EventTrigger extends TriggerBase {
  private eventName: string;
  private handler: ((event: any, ...args: any[]) => void) | null = null;

  constructor(id: string, name: string, canvasId: string, eventName: string, config: string | null) {
    super(id, name, canvasId, config);
    this.eventName = eventName;
  }

  public start(): void {
    if (this.handler) this.stop();

    this.handler = async (event: any, ...args: any[]) => {
      console.log(`[Trigger:${this.id}] Event triggered on channel: ${this.eventName}`);
      await this.triggerPipeline();
    };

    ipcMain.on(this.eventName, this.handler);

    this._isActive = true;
    console.log(`[Trigger:${this.id}] Event listener active for channel: ${this.eventName}`);
  }

  public stop(): void {
    if (this.handler) {
      ipcMain.removeListener(this.eventName, this.handler);
      this.handler = null;
    }
    this._isActive = false;
    console.log(`[Trigger:${this.id}] Event listener stopped: ${this.eventName}`);
  }
}
