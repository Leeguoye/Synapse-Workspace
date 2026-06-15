import React, { useState, useRef, useEffect } from 'react';
import { ChevronDown } from 'lucide-react';
import { t } from '../../../../language';
import IconPicker from '../IconPicker';
import DynamicIcon from '../../uiComponent/DynamicIcon';

interface LinkEditorModalProps {
  isOpen: boolean; // 介面保留以符合父元件傳遞
  initialName: string;
  initialUrl: string;
  initialIcon: string;
  initialColor: string;
  onClose: () => void;
  onSave: (name: string, url: string, icon: string, color: string) => void;
}

// ✅ 移除 isOpen 的解構，消滅 ESLint 警告
const LinkEditorModal: React.FC<LinkEditorModalProps> = ({ initialName, initialUrl, initialIcon, initialColor, onClose, onSave }) => {
  const [name, setName] = useState(initialName);
  const [url, setUrl] = useState(initialUrl);
  // 保證預設為有效的 Lucide 名字
  const [icon, setIcon] = useState(initialIcon === 'LinkIcon' ? 'Link' : (initialIcon || 'Link'));
  const [color, setColor] = useState(initialColor || '#34d399');

  const [showIconPicker, setShowIconPicker] = useState(false);
  const iconPickerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (iconPickerRef.current && !iconPickerRef.current.contains(event.target as Node)) {
        setShowIconPicker(false);
      }
    };
    if (showIconPicker) document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [showIconPicker]);

  return (
    <div className="fixed inset-0 flex items-center justify-center bg-black/60 backdrop-blur-sm z-100" onClick={onClose}>
      <div className="bg-theme-900 p-5 rounded-xl shadow-2xl w-[420px] border border-theme-700 overflow-visible" onClick={e => e.stopPropagation()}>
        <h3 className="text-theme-200 text-sm font-semibold mb-4">{t.sidebar.editLinkShortcut}</h3>
        <div className="flex gap-4 items-start">
          {/* 左側：圖示選擇器 */}
          <div className="relative mt-[22px]" ref={iconPickerRef}>
            <button
              type="button"
              onClick={() => setShowIconPicker(!showIconPicker)}
              className="w-16 h-16 rounded-xl bg-theme-800 border border-theme-700 hover:border-theme-500 hover:bg-theme-700 flex flex-col items-center justify-center gap-1 transition-all group shadow-sm"
              title={t.sidebar.selectIcon}
            >
              <div style={{ color }} className="transition-transform group-hover:scale-110">
                <DynamicIcon name={icon} className="w-7 h-7" />
              </div>
              <ChevronDown className="w-3 h-3 text-theme-600 group-hover:text-theme-400" />
            </button>

            {showIconPicker && (
              <div className="absolute top-0 left-full ml-4 z-[110]">
                <IconPicker
                  selectedIcon={icon}
                  selectedColor={color}
                  onSelectIcon={setIcon}
                  onSelectColor={setColor}
                  onClose={() => setShowIconPicker(false)}
                />
              </div>
            )}
          </div>

          {/* 右側：輸入框 */}
          <div className="flex-1 space-y-4">
            <div>
              <label className="block text-[10px] text-theme-400 mb-1 uppercase tracking-wider">{t.sidebar.shortcutName}</label>
              <input value={name} onChange={e => setName(e.target.value)} className="w-full bg-theme-900 border border-theme-700 rounded px-3 py-2 text-theme-200 text-sm focus:outline-none focus:border-primary-main" placeholder={t.sidebar.shortcutNamePlaceholder} />
            </div>
            <div>
              <label className="block text-[10px] text-theme-400 mb-1 uppercase tracking-wider">{t.sidebar.targetUrl}</label>
              <input value={url} onChange={e => setUrl(e.target.value)} className="w-full bg-theme-900 border border-theme-700 rounded px-3 py-2 text-theme-200 text-sm focus:outline-none focus:border-primary-main" placeholder="https://..." />
            </div>
          </div>
        </div>
        <div className="flex justify-end gap-2 mt-6">
          <button onClick={onClose} className="px-4 py-2 text-xs text-theme-400 hover:text-white hover:bg-theme-800 rounded transition-colors">{t.common.cancel}</button>
          <button onClick={() => onSave(name, url, icon === 'Link' ? 'LinkIcon' : icon, color)} className="px-4 py-2 text-xs bg-primary-main hover:bg-primary-hover text-theme-50 rounded transition-colors font-medium">{t.sidebar.saveSettings}</button>
        </div>
      </div>
    </div>
  );
};
export default LinkEditorModal;