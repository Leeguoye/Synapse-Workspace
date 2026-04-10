import { PipelineRunner } from '../PipelineRunner';
import { prisma as db } from '../../db.js';
import { getDriveClient } from '../../utils/googleAuth.js';

export abstract class TriggerBase {
  public readonly id: string;
  public readonly name: string;
  public readonly canvasId: string;
  public readonly config: any;
  protected _isActive: boolean = false;

  constructor(id: string, name: string, canvasId: string, config: string | null) {
    this.id = id;
    this.name = name;
    this.canvasId = canvasId;
    try {
        this.config = config ? JSON.parse(config) : {};
    } catch {
        this.config = {};
    }
  }

  public abstract start(): void;
  public abstract stop(): void;

  /**
   * 觸發 Pipeline 執行
   */
  protected async triggerPipeline() {
    console.log(`[Trigger:${this.id}] Firing pipeline for canvas: ${this.canvasId}`);
    
    try {
      // 1. 取得現有 Metadata
      const file = await db.driveFile.findUnique({
        where: { id: this.canvasId },
        select: { localBody: true, name: true }
      });

      let canvasData: any;

      // 如果本地無快取，自動從雲端下載內容 (核心修正：讓背景觸發更強大)
      if (!file || !file.localBody) {
        console.log(`[Trigger:${this.id}] 本地無快取內容，正在從 Google Drive 下載...`);
        try {
          const drive = await getDriveClient();
          const response = await drive.files.get({
            fileId: this.canvasId,
            alt: 'media'
          }, { responseType: 'text' });
          
          const content = response.data;
          canvasData = typeof content === 'string' ? JSON.parse(content) : content;
          console.log(`[Trigger:${this.id}] 雲端內容下載完成: ${file?.name || this.canvasId}`);
        } catch (fetchErr: any) {
          throw new Error(`無法從雲端獲取畫布內容: ${fetchErr.message || String(fetchErr)}`);
        }
      } else {
        canvasData = JSON.parse(file.localBody);
      }

      // 檢查內容格式
      if (!canvasData || !canvasData.nodes) {
          throw new Error(`畫布內容無效或缺少節點定義。`);
      }

      // 2. 建立 PipelineRunner 並執行
      const runner = new PipelineRunner(
        canvasData.nodes || [], 
        canvasData.edges || [],
        (nodeId, status, logs) => {
          if (status === 'error' && logs) {
            console.error(`[Trigger:${this.id}] Node ${nodeId} Error:`, logs);
          }
        }
      );
      
      const result = await runner.executePipeline();
      
      // 3. 更新最後執行紀錄
      await db.trigger.update({
        where: { id: this.id },
        data: { lastFired: new Date() }
      });

      console.log(`[Trigger:${this.id}] Pipeline "${file?.name || this.canvasId}" 執行完畢: ${result.success ? '成功' : '失敗'}`);
    } catch (err: any) {
      console.error(`[Trigger:${this.id}] 觸發導航失敗:`, err);
    }
  }
}
