import { prisma } from '../db';

const DEFAULT_SYSTEM_WORKSPACES = [
  { name: '我的雲端', icon: 'hard-drive', mode: 'my-drive', order: 0 },
  { name: '與我共用', icon: 'share-2', mode: 'shared-with-me', order: 1 },
  { name: '已加星號', icon: 'star', mode: 'starred', order: 2 },
  { name: '垃圾桶', icon: 'trash-2', mode: 'trashed', order: 999 },
];

export async function initWorkspaces() {
  try {
    const count = await prisma.workspace.count();
    if (count === 0) {
      console.log('[System] 初始化預設工作區...');
      for (const sys of DEFAULT_SYSTEM_WORKSPACES) {
        await prisma.workspace.create({
          data: {
            name: sys.name,
            type: 'system',
            icon: sys.icon,
            mode: sys.mode,
            order: sys.order,
            isVisible: true
          }
        });
      }
    }
  } catch (error) {
    console.error('[System] 初始化失敗:', error);
  }
}