import { PrismaClient } from './generated/client';
import { app } from 'electron';
import path from 'path';

import fs from 'fs';

const isDev = process.env.NODE_ENV === 'development';

// 根據環境動態決定資料庫路徑
const dbPath = isDev
  ? path.join(process.cwd(), 'prisma', 'dev.db')
  : path.join(app.getPath('userData'), 'database.db');

console.log(`[DB] 初始化路徑: ${dbPath} (isDev: ${isDev})`);

// --- 生產環境初始化：若用戶目錄沒有資料庫，從資源區複製範本 ---
if (!isDev && !fs.existsSync(dbPath)) {
    try {
        console.log('[DB] 正在偵測資源區範本...');
        const templatePath = path.join(process.resourcesPath, 'prisma', 'template.db');
        
        if (fs.existsSync(templatePath)) {
            const dbDir = path.dirname(dbPath);
            if (!fs.existsSync(dbDir)) {
                fs.mkdirSync(dbDir, { recursive: true });
            }
            fs.copyFileSync(templatePath, dbPath);
            console.log('[DB] 成功！已從資源區初始化資料庫範本:', templatePath);
        } else {
            console.error('[DB] 嚴重錯誤：找不到資料庫範本檔案於:', templatePath);
        }
    } catch (err) {
        console.error('[DB] 資料庫複製作業發生異常:', err);
    }
} else if (!isDev) {
    console.log('[DB] 生產環境資料庫已存在，略過初始化步驟。');
}

// 建立資料庫連線實例，並注入動態路徑
export const prisma = new PrismaClient({
  datasources: {
    db: {
      url: `file:${dbPath}`,
    },
  },
});