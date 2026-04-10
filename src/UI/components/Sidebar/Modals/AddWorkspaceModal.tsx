import React, { useState, useEffect, useRef } from 'react';
import { X, FolderPlus, Loader2, Search, Folder, ChevronDown } from 'lucide-react';
import { t } from '../../../../language';
import type { DriveFile } from '../../../../shared/types';
import IconPicker from '../IconPicker';
import DynamicIcon from '../../uiComponent/DynamicIcon';

interface AddWorkspaceModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (name: string, targetId: string, icon: string, color: string) => Promise<void>;
}

const AddWorkspaceModal: React.FC<AddWorkspaceModalProps> = ({ isOpen, onClose, onSubmit }) => {
  const [name, setName] = useState('');
  const [targetId, setTargetId] = useState('');
  const [selectedIcon, setSelectedIcon] = useState('FolderHeart');
  const [selectedColor, setSelectedColor] = useState('#3b82f6');

  const [showIconPicker, setShowIconPicker] = useState(false);
  const iconPickerRef = useRef<HTMLDivElement>(null);

  const [searchTerm, setSearchTerm] = useState('');
  const [searchResults, setSearchResults] = useState<DriveFile[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [selectedFolder, setSelectedFolder] = useState<DriveFile | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    if (!isOpen) {
      setName('');
      setTargetId('');
      setSearchTerm('');
      setSearchResults([]);
      setSelectedFolder(null);
      setSelectedIcon('FolderHeart');
      setSelectedColor('#3b82f6');
      setShowIconPicker(false);
      setIsSubmitting(false); // 重置 loading 狀態
    }
  }, [isOpen]);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (iconPickerRef.current && !iconPickerRef.current.contains(event.target as Node)) {
        setShowIconPicker(false);
      }
    };
    if (showIconPicker) document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [showIconPicker]);

  useEffect(() => {
    const delayDebounceFn = setTimeout(async () => {
      if (searchTerm.trim().length > 0) {
        setIsSearching(true);
        try {
          const results = await window.electron.listFiles({
            mode: 'all',
            searchQuery: searchTerm,
            mimeType: 'application/vnd.google-apps.folder'
          });
          setSearchResults(results);
        } catch (error) {
          console.error(error);
          setSearchResults([]);
        } finally {
          setIsSearching(false);
        }
      } else {
        setSearchResults([]);
      }
    }, 500);
    return () => clearTimeout(delayDebounceFn);
  }, [searchTerm]);

  const handleSelectFolder = (folder: DriveFile) => {
    setSelectedFolder(folder);
    setTargetId(folder.id);
    if (!name) setName(folder.name);
    setSearchResults([]);
    setSearchTerm('');
  };

  // ✅ 修正 1: 加入 try-catch-finally 確保 loading 狀態一定會解除
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name || !targetId) return;

    setIsSubmitting(true);
    try {
      await onSubmit(name, targetId, selectedIcon, selectedColor);
      onClose(); // 只有成功才關閉
    } catch (error) {
      console.error("建立失敗:", error);
      alert("建立失敗，請檢查後端日誌");
    } finally {
      setIsSubmitting(false); // 無論成功失敗都停止轉圈圈
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/70 backdrop-blur-md z-50 flex items-center justify-center p-4">
      {/* 移除 overflow-hidden，這樣向右彈出的 IconPicker 就不會被切掉 
         同時加入 visible，確保子元素可以超出邊界
      */}
      <div className="bg-theme-900 border border-theme-700 rounded-2xl shadow-2xl w-125 flex flex-col max-h-[90vh] animate-in fade-in zoom-in-95 duration-200 overflow-visible">

        {/* Header: 手動加入 rounded-t-2xl 來維持圓角 */}
        <div className="flex justify-between items-center px-6 py-4 bg-theme-900 border-b border-theme-800 rounded-t-2xl">
          <h3 className="text-lg font-bold text-theme-50 flex items-center gap-2">
            <FolderPlus className="w-5 h-5 text-primary-main" />
            {t.sidebar.addWorkspace}
          </h3>
          <button onClick={onClose} className="text-theme-500 hover:text-theme-300 transition-colors">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Identity Section */}
        <div className="px-6 py-5 bg-theme-800/50 border-b border-theme-800 z-20">
          <div className="flex gap-4 items-start">

            {/* Icon Picker Button */}
            <div className="relative" ref={iconPickerRef}>
              <button
                type="button"
                onClick={() => setShowIconPicker(!showIconPicker)}
                className="w-16 h-16 rounded-2xl bg-theme-800 border-2 border-theme-700 hover:border-theme-500 hover:bg-theme-700 flex flex-col items-center justify-center gap-1 transition-all group shadow-sm"
                title={t.sidebar.selectIcon}
              >
                <div style={{ color: selectedColor }} className="transition-transform group-hover:scale-110">
                  <DynamicIcon name={selectedIcon} className="w-7 h-7" />
                </div>
                <ChevronDown className="w-3 h-3 text-theme-600 group-hover:text-theme-400" />
              </button>

              {/* Icon Picker Popover */}
              {showIconPicker && (
                // 這裡的 z-50 和 absolute 確保它浮在所有東西上面
                // 因為父層移除了 overflow-hidden，所以它可以自由向右延伸
                <div className="absolute top-0 left-full ml-4 z-50">
                  <IconPicker
                    selectedIcon={selectedIcon}
                    selectedColor={selectedColor}
                    onSelectIcon={setSelectedIcon}
                    onSelectColor={setSelectedColor}
                    onClose={() => setShowIconPicker(false)}
                  />
                </div>
              )}
            </div>

            {/* Name Input */}
            <div className="flex-1 space-y-2">
              <label className="text-xs font-bold text-theme-500 uppercase tracking-wider">{t.sidebar.workspaceName}</label>
              <input
                type="text"
                value={name}
                onChange={e => setName(e.target.value)}
                placeholder={t.sidebar.workspaceNamePlaceholder}
                className="w-full bg-theme-900 border border-theme-700 rounded-lg px-4 py-3 text-base text-theme-300 focus:ring-2 focus:ring-primary-main focus:border-transparent outline-none placeholder:text-theme-600 transition-all"
                autoFocus
              />
            </div>
          </div>
        </div>

        {/* Body Section: 需要 overflow-y-auto 來捲動搜尋結果 */}
        <form id="workspace-form" onSubmit={handleSubmit} className="flex-1 overflow-y-auto custom-scrollbar p-6 bg-theme-900">
          <div className="space-y-3">
            <label className="text-xs font-bold text-theme-500 uppercase tracking-wider flex justify-between">
              <span>{t.sidebar.selectTargetFolder}</span>
              {isSearching && <span className="text-primary-text flex items-center gap-1"><Loader2 className="w-3 h-3 animate-spin" /> {t.sidebar.searching}</span>}
            </label>

            {selectedFolder ? (
              <div className="flex items-center justify-between bg-primary-main/10 border border-primary-main/30 rounded-xl p-4 animate-in fade-in slide-in-from-bottom-2">
                <div className="flex items-center gap-4 overflow-hidden">
                  <div className="w-10 h-10 rounded-lg bg-primary-main flex items-center justify-center shrink-0 shadow-lg shadow-primary-main/50">
                    <Folder className="w-5 h-5 text-theme-50" />
                  </div>
                  <div className="min-w-0">
                    <div className="text-sm font-bold text-theme-50 truncate">{selectedFolder.name}</div>
                    <div className="text-xs text-primary-text truncate font-mono opacity-80">{selectedFolder.id}</div>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => { setSelectedFolder(null); setTargetId(''); }}
                  className="p-2 hover:bg-white/10 rounded-full text-primary-text hover:text-theme-50 transition-colors"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            ) : (
              <div className="relative group">
                <div className="absolute left-3 top-3 text-theme-500 group-focus-within:text-primary-main transition-colors">
                  <Search className="w-5 h-5" />
                </div>
                <input
                  type="text"
                  value={searchTerm}
                  onChange={e => setSearchTerm(e.target.value)}
                  placeholder={t.sidebar.folderIdPlaceholder}
                  className="w-full bg-theme-800 border border-theme-700 rounded-xl py-3 pl-10 pr-4 text-sm text-theme-300 focus:ring-2 focus:ring-primary-main focus:border-transparent outline-none placeholder:text-theme-600 transition-all"
                />

                {searchResults.length > 0 && (
                  <div className="mt-2 bg-theme-800 border border-theme-700 rounded-xl overflow-hidden shadow-lg">
                    {searchResults.map(folder => (
                      <button
                        key={folder.id}
                        type="button"
                        onClick={() => handleSelectFolder(folder)}
                        className="w-full text-left px-4 py-3 hover:bg-theme-700 flex items-center gap-3 border-b border-theme-700/50 last:border-0 group/item transition-colors"
                      >
                        <Folder className="w-4 h-4 text-theme-100 group-hover/item:text-theme-400 shrink-0" />
                        <span className="text-sm text-theme-100 group-hover/item:text-theme-300 truncate">{folder.name}</span>
                      </button>
                    ))}
                  </div>
                )}

                {searchTerm && searchResults.length === 0 && !isSearching && (
                  <div className="mt-4 text-center text-theme-600 text-sm py-4 border border-dashed border-theme-800 rounded-xl">
                    {t.sidebar.noFoldersFound}
                  </div>
                )}
              </div>
            )}
          </div>
        </form>

        {/* Footer: 手動加入 rounded-b-2xl */}
        <div className="p-5 border-t border-theme-800 bg-theme-800/30 flex justify-end gap-3 rounded-b-2xl">
          <button
            type="button"
            onClick={onClose}
            className="px-5 py-2.5 text-sm font-medium text-theme-400 hover:text-theme-100 hover:bg-theme-800 rounded-lg transition-colors"
          >
            {t.common.cancel}
          </button>
          <button
            type="submit"
            form="workspace-form"
            disabled={isSubmitting || !name || !targetId}
            className="px-6 py-2.5 bg-primary-main hover:bg-primary-hover text-theme-50 text-sm rounded-lg font-bold shadow-lg shadow-primary-main/20 transition-all hover:translate-y-[-1px] active:translate-y-[0px] disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
          >
            {isSubmitting && <Loader2 className="w-4 h-4 animate-spin" />}
            {t.sidebar.createWorkspace}
          </button>
        </div>

      </div>
    </div>
  );
};

export default AddWorkspaceModal;