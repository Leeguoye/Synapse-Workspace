import { ipcMain } from 'electron';
import { prisma } from '../db';
import { Workspace } from '../../shared/types';

export function registerWorkspaceHandlers() {

  // 取得所有工作區
  ipcMain.handle('workspace:get-all', async () => {

    // 回傳所有工作區 (依照 order 排序)
    return prisma.workspace.findMany({
      orderBy: { order: 'asc' }
    });
  });

  // 2. 新增自訂工作區
  ipcMain.handle('workspace:create-custom', async (_, { name, targetId, icon, color }: { name: string, targetId: string, icon: string, color: string }) => {
    const lastItem = await prisma.workspace.findFirst({ orderBy: { order: 'desc' } });
    const newOrder = (lastItem?.order ?? 0) + 1;

    return prisma.workspace.create({
      data: {
        name,
        type: 'custom',
        icon: icon || 'folder-heart', // 如果沒傳就用預設
        color: color || '#3b82f6',
        mode: 'custom',
        targetId,
        order: newOrder,
        isVisible: true
      }
    });
  });

  // 3. 更新工作區 (包含重新排序、更名、隱藏/顯示)
  // 前端拖曳完後，會把整個陣列傳回來，我們直接更新每個 Item 的 order
  ipcMain.handle('workspace:update-order', async (_, workspaces: Workspace[]) => {
    // 使用 Transaction 確保原子性
    const updates = workspaces.map((ws, index) => 
      prisma.workspace.update({
        where: { id: ws.id },
        data: { 
          order: index,
          isVisible: ws.isVisible // 順便更新顯示狀態
        }
      })
    );
    await prisma.$transaction(updates);
    return true;
  });

  // 4. 刪除/隱藏工作區
  ipcMain.handle('workspace:delete', async (_, id: string) => {
    const target = await prisma.workspace.findUnique({ where: { id } });
    if (!target) return false;

    if (target.type === 'system') {
      // 官方區：只能隱藏，不能刪除
      await prisma.workspace.update({
        where: { id },
        data: { isVisible: false }
      });
    } else {
      // 自訂區：直接刪除
      await prisma.workspace.delete({ where: { id } });
    }
    return true;
  });
}