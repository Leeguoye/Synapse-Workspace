import React from 'react';
import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { 
  GripVertical, EyeOff, X, Eye 
} from 'lucide-react';
import type { Workspace } from '../../../shared/types';
import DynamicIcon from '../uiComponent/DynamicIcon'; 
import { t } from '../../../language';

interface SidebarItemProps {
  workspace: Workspace;
  isActive: boolean;
  isEditing: boolean;
  onSelect: () => void;
  onToggleVisibility: (id: string, currentStatus: boolean) => void;
  onDelete: (id: string) => void;
}

const SidebarItem: React.FC<SidebarItemProps> = ({ 
  workspace, isActive, isEditing, onSelect, onToggleVisibility, onDelete 
}) => {
  
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging
  } = useSortable({ 
    id: workspace.id,
    disabled: !isEditing || workspace.type === 'system' 
  });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    zIndex: isDragging ? 100 : 'auto',
    opacity: isDragging ? 0.5 : 1,
  };

  // 1. 處理系統圖示名稱轉換 (舊資料的 kebab-case -> 新的 PascalCase)
  // 這樣能確保 "hard-drive" 這種舊名字也能正確顯示
  const systemIconMap: Record<string, string> = {
    'hard-drive': 'HardDrive',
    'share-2': 'Share2',
    'star': 'Star',
    'trash-2': 'Trash2',
    'folder-heart': 'FolderHeart'
  };

  // 決定最終要顯示的 Icon Name (如果不在 map 裡，就直接用 workspace.icon)
  const iconName = systemIconMap[workspace.icon] || workspace.icon;

  // 2. 處理自訂顏色
  // 邏輯：如果是 "自訂區" 且 "有顏色"，則顯示該顏色。
  // 但例外是：當項目 "被選中 (isActive)" 且 "不在編輯模式" 時，背景是藍色，圖示強制為白色比較好看。
  const iconColor = (workspace.type === 'custom' && workspace.color && (!isActive || isEditing)) 
    ? workspace.color 
    : undefined;

  const handleClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (!isEditing) onSelect();
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      onClick={handleClick}
      className={`
        group flex items-center gap-3 px-3 py-2 rounded-md mb-0.5 transition-all select-none
        ${isActive && !isEditing ? 'bg-primary-main text-theme-50' : 'text-sidebar-muted hover:bg-sidebar-hover hover:text-sidebar-text'}
        ${isEditing ? 'cursor-default' : 'cursor-pointer'}
        ${!workspace.isVisible ? 'opacity-50' : ''} 
      `}
    >
      {/* 拖曳手把 */}
      {isEditing && workspace.type === 'custom' && (
        <div {...attributes} {...listeners} className="cursor-grab hover:text-theme-50 text-theme-600 mr-1">
          <GripVertical className="w-3.5 h-3.5" />
        </div>
      )}

      {/* 3. 圖示區域 (整合 DynamicIcon 與 Color) */}
      <div 
        className={`${isActive && !isEditing ? 'text-theme-50' : 'text-sidebar-muted group-hover:text-primary-text'}`}
        style={{ color: iconColor }} // 套用顏色
      >
        <DynamicIcon name={iconName} className="w-4 h-4" />
      </div>

      {/* 名稱 */}
      <span className="flex-1 text-sm font-medium truncate">
        {workspace.type === 'system' && workspace.mode 
          ? (t.sidebar.workspaces as any)[workspace.mode] || workspace.name 
          : workspace.name}
      </span>

      {/* 編輯模式按鈕 */}
      {isEditing && (
        <button
          onClick={(e) => {
            e.stopPropagation();
            if (workspace.type === 'system') {
              onToggleVisibility(workspace.id, workspace.isVisible);
            } else {
              onDelete(workspace.id);
            }
          }}
          className="p-1 rounded hover:bg-sidebar-hover text-sidebar-muted hover:text-danger-main transition-colors"
        >
          {workspace.type === 'system' ? (
             workspace.isVisible ? <Eye className="w-3.5 h-3.5" /> : <EyeOff className="w-3.5 h-3.5 text-theme-600" />
          ) : (
             <X className="w-3.5 h-3.5" />
          )}
        </button>
      )}
    </div>
  );
};

export default SidebarItem;