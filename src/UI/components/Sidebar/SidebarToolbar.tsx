import React, { useState } from 'react';
import { RefreshCw, Search, ArrowDownAZ, ArrowUpAZ, Clock, Calendar } from 'lucide-react';
import { t } from '../../../language';
// import type { FileQuery } from '../../../shared/types';

interface SidebarToolbarProps {
  searchQuery: string;
  onSearch: (query: string) => void;
  onSortChange: (field: 'name' | 'modifiedTime' | 'createdTime', order: 'asc' | 'desc') => void;
  onSync: () => void;
  isSyncing: boolean;
}

const SidebarToolbar: React.FC<SidebarToolbarProps> = ({ searchQuery, onSearch, onSortChange, onSync, isSyncing }) => {
  const [showSortMenu, setShowSortMenu] = useState(false);
  const [sortState, setSortState] = useState<{ field: string, order: 'asc' | 'desc' }>({ field: 'name', order: 'asc' });

  const handleSortClick = (field: 'name' | 'modifiedTime' | 'createdTime') => {
    // 如果點擊相同欄位，切換順序；否則預設 asc
    const newOrder = (sortState.field === field && sortState.order === 'asc') ? 'desc' : 'asc';
    setSortState({ field, order: newOrder });
    onSortChange(field, newOrder);
    setShowSortMenu(false);
  };

  return (
    <div className="flex items-center gap-2 px-3 py-2 border-b border-theme-800 bg-theme-900/50">

      {/* 1. 同步按鈕 (最左邊) */}
      <button
        onClick={onSync}
        disabled={isSyncing}
        className={`p-1.5 rounded-md hover:bg-theme-700 text-theme-400 transition-colors ${isSyncing ? 'animate-spin text-blue-400' : 'hover:text-blue-400'}`}
        title={t.sidebar.syncGoogleDrive}
      >
        <RefreshCw className="w-4 h-4" />
      </button>

      {/* 2. 搜尋欄位 (中間，佔滿剩餘空間) */}
      <div className="flex-1 relative group">
        <div className="absolute left-2 top-1/2 -translate-y-1/2 text-theme-500 group-focus-within:text-blue-400">
          <Search className="w-3.5 h-3.5" />
        </div>
        <input
          type="text"
          value={searchQuery}
          placeholder="Search..."
          onChange={(e) => onSearch(e.target.value)}
          className="w-full bg-theme-800 border border-theme-700 rounded-md py-1 pl-8 pr-2 text-xs text-theme-200 focus:outline-none focus:border-blue-500 transition-colors placeholder:text-theme-600"
        />
      </div>

      {/* 3. 排序按鈕 (最右邊，包含下拉選單) */}
      <div className="relative">
        <button
          onClick={() => setShowSortMenu(!showSortMenu)}
          className="p-1.5 rounded-md hover:bg-theme-700 text-theme-400 hover:text-sidebar-text transition-colors"
          title={t.sidebar.sortMode}
        >
          {sortState.order === 'asc' ? <ArrowDownAZ className="w-4 h-4" /> : <ArrowUpAZ className="w-4 h-4" />}
        </button>

        {/* 排序選單 */}
        {showSortMenu && (
          <div className="absolute right-0 top-full mt-1 w-32 bg-theme-800 border border-theme-700 rounded-lg shadow-xl z-50 overflow-hidden text-xs">
            <div className="p-1 space-y-0.5">
              <button onClick={() => handleSortClick('name')} className="flex items-center gap-2 w-full px-2 py-1.5 hover:bg-theme-700 text-theme-300 rounded text-left">
                <ArrowDownAZ className="w-3.5 h-3.5" /> {t.sidebar.sortByName}
              </button>
              <button onClick={() => handleSortClick('modifiedTime')} className="flex items-center gap-2 w-full px-2 py-1.5 hover:bg-theme-700 text-theme-300 rounded text-left">
                <Clock className="w-3.5 h-3.5" /> {t.sidebar.sortByModifiedTime}
              </button>
              <button onClick={() => handleSortClick('createdTime')} className="flex items-center gap-2 w-full px-2 py-1.5 hover:bg-theme-700 text-theme-300 rounded text-left">
                <Calendar className="w-3.5 h-3.5" /> {t.sidebar.sortByCreatedTime}
              </button>
            </div>
          </div>
        )}
      </div>

    </div>
  );
};

export default SidebarToolbar;