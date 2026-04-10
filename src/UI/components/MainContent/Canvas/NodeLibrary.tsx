import React, { useState, useEffect, useMemo } from 'react';
import { Search, ChevronDown, ChevronRight, Puzzle, X, GripVertical, icons as LucideIcons } from 'lucide-react';
import { t } from '../../../../language';
import type { PortSchema } from './canvasTypes';
import { resolvePluginLabel } from '../../../utils/pluginI18n';

interface NodeManifest {
  pluginId: string;
  nodeType: string;
  label: string | Record<string, string>;
  category?: string;
  description?: string | Record<string, string>;
  icon?: string;
  color?: string;
  inputs?: PortSchema[];
  outputs?: PortSchema[];
  renderMode?: 'pipeline' | 'htmlOutput';
  defaultVisible?: boolean;
  presentation?: { type: 'iframe' | 'table' | 'react-echarts' | 'none'; urlTemplate?: string; };
}

interface NodeLibraryProps {
  isOpen: boolean;
  onClose: () => void;
}

/** 僅支援 Lucide 圖示系列 (Strictly Lucide icons) */
function renderNodeIcon(icon?: string, size = 12): React.ReactNode {
  if (!icon) return <Puzzle size={size} />;
  const IconComponent = (LucideIcons as Record<string, React.FC<{ size?: number }>>)[icon];
  if (IconComponent) return <IconComponent size={size} />;
  return <Puzzle size={size} />;
}

const NodeLibrary: React.FC<NodeLibraryProps> = ({ isOpen, onClose }) => {
  const [groupedNodes, setGroupedNodes] = useState<Record<string, NodeManifest[]>>({});
  const [searchQuery, setSearchQuery] = useState('');
  const [openCategories, setOpenCategories] = useState<Record<string, boolean>>({});
  const [loading, setLoading] = useState(true);

  // 取得 Electron API
  const getPluginsApi = () => (window as any).api?.plugins;

  useEffect(() => {
    if (isOpen) {
      loadNodes();
    }
  }, [isOpen]);

  const loadNodes = async () => {
    setLoading(true);
    try {
      const api = getPluginsApi();
      if (api?.getNodesByCategory) {
        const data = await api.getNodesByCategory();
        setGroupedNodes(data);
        // 預設展開所有類別 (Default expand all categories)
        const initialOpen: Record<string, boolean> = {};
        Object.keys(data).forEach(cat => {
          initialOpen[cat] = true;
        });
        setOpenCategories(initialOpen);
      }
    } catch (err) {
      console.error('[NodeLibrary] Failed to load nodes:', err);
    } finally {
      setLoading(false);
    }
  };

  const toggleCategory = (cat: string) => {
    setOpenCategories(prev => ({ ...prev, [cat]: !prev[cat] }));
  };

  // 搜尋過濾 (Search filter)
  const filteredGroups = useMemo(() => {
    if (!searchQuery.trim()) return groupedNodes;

    const query = searchQuery.toLowerCase();
    const result: Record<string, NodeManifest[]> = {};

    Object.entries(groupedNodes).forEach(([cat, nodes]) => {
      const matched = nodes.filter(n => {
        const lbl = resolvePluginLabel(n.label).toLowerCase();
        const desc = resolvePluginLabel(n.description, '').toLowerCase();
        return lbl.includes(query) ||
               n.nodeType.toLowerCase().includes(query) ||
               desc.includes(query);
      });
      if (matched.length > 0) {
        result[cat] = matched;
      }
    });
    return result;
  }, [groupedNodes, searchQuery]);

  const onDragStart = (e: React.DragEvent, node: NodeManifest) => {
    // 傳遞完整節點規格，讓 onDrop 建立有正確 port schema 的節點
    const data = {
      type: 'pluginNode',
      pluginId: node.pluginId,
      nodeType: node.nodeType,
      label: node.label,
      color: node.color,
      icon: node.icon,
      inputs: node.inputs ?? [],
      outputs: node.outputs ?? [],
      renderMode: node.renderMode ?? 'pipeline',
      defaultVisible: node.defaultVisible,
      presentation: node.presentation,
    };
    e.dataTransfer.setData('application/vnd.synapse.node', JSON.stringify(data));
    e.dataTransfer.dropEffect = 'move';
  };

  if (!isOpen) return null;

  return (
    <div className="absolute left-0 top-0 bottom-0 z-[100] w-72 bg-theme-900/95 border-r border-theme-700 shadow-2xl flex flex-col backdrop-blur-md animate-in slide-in-from-left duration-300">
      {/* Header */}
      <div className="p-4 border-b border-theme-700 flex items-center justify-between">
        <div className="flex items-center gap-2 text-theme-100 font-semibold text-sm">
          <Puzzle size={16} className="text-primary-main" />
          {t.canvas.library.title}
        </div>
        <button
          onClick={onClose}
          className="p-1 hover:bg-theme-800 rounded-md text-theme-400 transition-colors"
        >
          <X size={16} />
        </button>
      </div>

      {/* Search */}
      <div className="p-3">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-theme-500" size={14} />
          <input
            type="text"
            placeholder={t.canvas.library.searchPlaceholder}
            className="w-full bg-theme-800 border border-theme-700 rounded-lg pl-9 pr-3 py-1.5 text-xs text-theme-200 focus:outline-none focus:border-primary-main transition-all"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
        </div>
      </div>

      {/* Node List */}
      <div className="flex-1 overflow-y-auto p-2 custom-scrollbar">
        {loading ? (
          <div className="flex flex-col items-center justify-center h-32 text-theme-500 text-xs gap-2">
            <div className="w-4 h-4 border-2 border-primary-main border-t-transparent animate-spin rounded-full" />
            {t.canvas.panel.loading}
          </div>
        ) : Object.keys(filteredGroups).length === 0 ? (
          <div className="text-center py-10 text-theme-500 text-xs">
            {t.canvas.library.noNodes}
          </div>
        ) : (
          Object.entries(filteredGroups).map(([cat, nodes]) => (
            <div key={cat} className="mb-2">
              <button
                onClick={() => toggleCategory(cat)}
                className="w-full flex items-center gap-1 px-2 py-1.5 hover:bg-theme-800 rounded-md transition-colors text-[11px] font-bold text-theme-400 uppercase tracking-wider"
              >
                {openCategories[cat] ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
                {cat}
                <span className="ml-auto bg-theme-800 px-1.5 rounded text-[9px]">{nodes.length}</span>
              </button>

              {openCategories[cat] && (
                <div className="grid grid-cols-1 gap-1 mt-1 px-1">
                  {nodes.map(node => {
                    const accentColor = node.color || '#6366f1';
                    return (
                      <div
                        key={`${node.pluginId}-${node.nodeType}`}
                        draggable
                        onDragStart={(e) => onDragStart(e, node)}
                        className="group flex flex-col p-2 bg-theme-850 border border-theme-700 hover:border-primary-main/50 hover:bg-theme-800 rounded-lg cursor-grab active:cursor-grabbing transition-all"
                        style={{ borderLeftColor: accentColor, borderLeftWidth: 3 }}
                      >
                        <div className="flex items-center gap-2 mb-1">
                          {/* 插件主題色色塊，hover 時顯示拖曳圖示 (Plugin accent color block, shows drag icon on hover) */}
                          <div
                            className="w-6 h-6 rounded flex items-center justify-center text-white flex-shrink-0"
                            style={{ backgroundColor: accentColor }}
                          >
                            <span className="group-hover:hidden flex items-center justify-center">
                              {renderNodeIcon(node.icon, 12)}
                            </span>
                            <GripVertical size={12} className="hidden group-hover:block opacity-70" />
                          </div>
                          <div className="flex flex-col min-w-0">
                            <span className="text-xs font-medium text-theme-100 truncate">{resolvePluginLabel(node.label)}</span>
                            <span className="text-[9px] text-theme-500 font-mono truncate">
                              {node.pluginId}::{node.nodeType}
                            </span>
                          </div>
                        </div>
                        {node.description && (
                          <p className="text-[10px] text-theme-400 line-clamp-2 leading-relaxed pl-8">
                            {resolvePluginLabel(node.description)}
                          </p>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          ))
        )}
      </div>
    </div>
  );
};

export default NodeLibrary;
