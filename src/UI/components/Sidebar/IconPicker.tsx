import React, { useState, useMemo } from 'react';
import * as LucideIcons from 'lucide-react';
import { Search } from 'lucide-react';
import DynamicIcon from '../uiComponent/DynamicIcon';

interface IconPickerProps {
  selectedIcon: string;
  selectedColor: string;
  onSelectIcon: (iconName: string) => void;
  onSelectColor: (color: string) => void;
  onClose: () => void;
}

const COLORS = [
  '#64748b', '#ef4444', '#f97316', '#eab308', '#22c55e', 
  '#06b6d4', '#3b82f6', '#8b5cf6', '#d946ef', '#f43f5e',
];

const ALL_ICON_NAMES = Object.keys(LucideIcons).filter(key => 
  key !== 'createLucideIcon' && key !== 'default' && key !== 'LucideProps'
);

const COMMON_ICONS = [
  'FolderHeart', 'Briefcase', 'Code', 'Terminal', 'Cpu', 'Database', 
  'Globe', 'Cloud', 'Server', 'Settings', 'Music', 'Image', 'Video', 
  'Book', 'GraduationCap', 'Gamepad2', 'Ghost', 'Coffee', 'Zap', 
  'Star', 'Heart', 'Shield', 'Lock', 'User', 'Users', 'Home', 'Building'
];

const IconPicker: React.FC<IconPickerProps> = ({ 
  selectedIcon, selectedColor, onSelectIcon, onSelectColor 
}) => {
  const [searchTerm, setSearchTerm] = useState('');

  const filteredIcons = useMemo(() => {
    if (!searchTerm) return COMMON_ICONS;
    return ALL_ICON_NAMES.filter(name => 
      name.toLowerCase().includes(searchTerm.toLowerCase())
    ).slice(0, 60);
  }, [searchTerm]);

  return (
    // 獨立懸浮面板樣式
    // 注意：這裡移除了 absolute right-0，改由父層決定定位，或使用固定寬度
    <div 
      className="w-80 bg-theme-800 border border-theme-600 rounded-xl shadow-2xl flex flex-col overflow-hidden animate-in fade-in zoom-in-95 duration-200"
      onClick={e => e.stopPropagation()}
    >
      
      {/* 1. 顏色選擇區 (Header) */}
      <div className="p-4 bg-theme-900/50 border-b border-theme-700">
        <div className="text-[10px] text-theme-400 font-bold uppercase tracking-wider mb-3">
          選擇主題色
        </div>
        <div className="flex flex-wrap gap-2 justify-center">
          {COLORS.map(color => (
            <button
              key={color}
              type="button"
              onClick={() => onSelectColor(color)}
              className={`
                w-5 h-5 rounded-full transition-all hover:scale-110 border border-theme-700
                ${selectedColor === color ? 'ring-2 ring-theme-50 ring-offset-2 ring-offset-theme-900 scale-110' : 'opacity-70 hover:opacity-100'}
              `}
              style={{ backgroundColor: color }}
            />
          ))}
        </div>
      </div>

      {/* 2. 圖示搜尋 (Sticky) */}
      <div className="p-3 border-b border-theme-700 bg-theme-800">
        <div className="relative">
          <Search className="absolute left-2.5 top-2 w-3.5 h-3.5 text-theme-500" />
          <input 
            type="text"
            placeholder="搜尋 1000+ 圖示..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full bg-theme-900 border border-theme-700 rounded-lg py-1.5 pl-8 pr-3 text-xs text-theme-200 focus:ring-1 focus:ring-primary-main outline-none placeholder:text-theme-600 transition-all"
            autoFocus
          />
        </div>
      </div>

      {/* 3. 圖示網格 (Scrollable) */}
      <div className="h-56 overflow-y-auto custom-scrollbar p-2 bg-theme-800">
        <div className="grid grid-cols-6 gap-1">
          {filteredIcons.map(name => (
            <button
              key={name}
              type="button"
              onClick={() => onSelectIcon(name)}
              title={name}
              className={`
                aspect-square rounded-md flex items-center justify-center transition-all hover:bg-theme-700 hover:text-theme-50
                ${selectedIcon === name ? 'bg-theme-700 text-theme-50 ring-1 ring-theme-500 shadow-sm' : 'text-theme-500'}
              `}
            >
              <DynamicIcon name={name} className="w-4 h-4" />
            </button>
          ))}
        </div>
      </div>
      
      {/* Footer info */}
      <div className="px-3 py-1.5 bg-theme-900 border-t border-theme-700 text-[9px] text-theme-500 text-center">
        {searchTerm ? `搜尋結果: ${filteredIcons.length}` : '常用推薦'}
      </div>
    </div>
  );
};

export default IconPicker;