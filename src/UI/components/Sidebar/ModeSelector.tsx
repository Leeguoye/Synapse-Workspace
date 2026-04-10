import React, { useState, useRef, useEffect } from 'react';
import { 
  DndContext, closestCenter, PointerSensor, useSensor, useSensors 
} from '@dnd-kit/core';
import type { DragEndEvent } from '@dnd-kit/core/dist/types';
import { 
  arrayMove, SortableContext, verticalListSortingStrategy 
} from '@dnd-kit/sortable';
import { ChevronDown, Plus, Settings2, Check } from 'lucide-react';
import { t } from '../../../language';
import type { Workspace } from '../../../shared/types';
import SidebarItem from './SidebarItem'; // 我們會重複使用這個 Item

interface ModeSelectorProps {
  workspaces: Workspace[];
  activeWorkspaceId: string;
  onSelect: (ws: Workspace) => void;
  onUpdateList: (list: Workspace[]) => void; // 用來存回排序結果
  onDelete: (id: string) => void;
  onAddClick: () => void;
}

const ModeSelector: React.FC<ModeSelectorProps> = ({ 
  workspaces, activeWorkspaceId, onSelect, onUpdateList, onDelete, onAddClick 
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // DND Sensors (使用 PointerSensor 體驗較好)
  const sensors = useSensors(useSensor(PointerSensor));

  // 點擊外部關閉選單
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
        setIsEditing(false); // 關閉選單時自動退出編輯模式
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // 處理拖曳結束
  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    if (!over || active.id === over.id) return;

    const oldIndex = workspaces.findIndex(w => w.id === active.id);
    const newIndex = workspaces.findIndex(w => w.id === over.id);
    
    // 更新列表順序
    const newOrderList = arrayMove(workspaces, oldIndex, newIndex);
    onUpdateList(newOrderList);
  };

  // 切換顯示狀態 (System Workspace)
  const handleToggleVisibility = (id: string, currentStatus: boolean) => {
    const newWorkspaces = workspaces.map(w => 
      w.id === id ? { ...w, isVisible: !currentStatus } : w
    );
    onUpdateList(newWorkspaces);
  };

  // 分類
  const currentWs = workspaces.find(w => w.id === activeWorkspaceId);
  const systemWorkspaces = workspaces.filter(w => w.type === 'system');
  const customWorkspaces = workspaces.filter(w => w.type === 'custom');

  // 在編輯模式下顯示所有 System，非編輯模式只顯示可見的
  const visibleSystemWorkspaces = isEditing ? systemWorkspaces : systemWorkspaces.filter(w => w.isVisible);

  return (
    <div className="px-2 py-3 border-b border-theme-700 bg-theme-900 z-30" ref={dropdownRef}>
      <div className="relative">
        
        {/* 1. 主按鈕 (Trigger) */}
        <button
          onClick={() => setIsOpen(!isOpen)}
          className={`
            w-full flex items-center justify-between px-3 py-2 rounded-md
            bg-theme-800 border border-theme-700 hover:border-theme-500
            text-theme-200 text-sm font-medium transition-all
            ${isOpen ? 'ring-2 ring-blue-500/50 border-blue-500' : ''}
          `}
        >
          <div className="flex items-center gap-2 truncate">
             {/* 這裡可以放當前 Icon，但文字比較重要 */}
             <span className="truncate">
               {currentWs 
                 ? (currentWs.type === 'system' && currentWs.mode ? (t.sidebar.workspaces as any)[currentWs.mode] || currentWs.name : currentWs.name) 
                 : t.sidebar.selectWorkspace}
             </span>
          </div>
          <ChevronDown className={`w-4 h-4 text-theme-500 transition-transform ${isOpen ? 'rotate-180' : ''}`} />
        </button>

        {/* 2. 下拉選單內容 (Absolute) */}
        {isOpen && (
          <div className="absolute top-full left-0 w-full mt-2 bg-theme-900 border border-theme-700 rounded-lg shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-100 z-50 flex flex-col max-h-125">
            
            {/* 標題列 + 編輯開關 */}
            <div className="flex items-center justify-between px-3 py-2 bg-theme-800 border-b border-theme-700">
              <span className="text-[10px] text-theme-400 font-bold uppercase">Workspaces</span>
              <button 
                onClick={() => setIsEditing(!isEditing)}
                className={`p-1 rounded hover:bg-theme-700 transition-colors ${isEditing ? 'text-blue-400' : 'text-theme-500'}`}
                title={isEditing ? t.common.confirm : t.sidebar.editSort}
              >
                {isEditing ? <Check className="w-3.5 h-3.5" /> : <Settings2 className="w-3.5 h-3.5" />}
              </button>
            </div>

            {/* 列表內容 (可捲動) */}
            <div className="flex-1 overflow-y-auto custom-scrollbar p-1">
              
              {/* (A) 系統區 */}
              {visibleSystemWorkspaces.map(ws => (
                <SidebarItem 
                  key={ws.id}
                  workspace={ws}
                  isActive={activeWorkspaceId === ws.id}
                  isEditing={isEditing}
                  onSelect={() => { onSelect(ws); setIsOpen(false); }}
                  onToggleVisibility={handleToggleVisibility}
                  onDelete={onDelete}
                />
              ))}

              {/* (B) 分隔線 */}
              <div className="mx-2 my-1 border-t border-theme-700 border-dashed" />

              {/* (C) 自訂區 (支援拖曳) */}
              <DndContext 
                sensors={sensors} 
                collisionDetection={closestCenter} 
                onDragEnd={handleDragEnd}
              >
                <SortableContext 
                  items={customWorkspaces.map(w => w.id)} 
                  strategy={verticalListSortingStrategy}
                >
                  <div>
                    {customWorkspaces.map(ws => (
                      <SidebarItem 
                        key={ws.id}
                        workspace={ws}
                        isActive={activeWorkspaceId === ws.id}
                        isEditing={isEditing}
                        onSelect={() => { onSelect(ws); setIsOpen(false); }}
                        onToggleVisibility={handleToggleVisibility}
                        onDelete={onDelete}
                      />
                    ))}
                  </div>
                </SortableContext>
              </DndContext>

              {/* 新增按鈕 */}
              <button
                onClick={() => { onAddClick(); setIsOpen(false); }}
                className="flex items-center gap-2 px-3 py-2 mt-1 w-full text-xs text-theme-500 hover:text-blue-400 hover:bg-theme-800/50 rounded transition-colors"
              >
                <Plus className="w-3.5 h-3.5" />
                {t.sidebar.addWorkspace}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default ModeSelector;