import React, { useState, useCallback } from 'react';
import type { DriveFile } from '../../../shared/types';
import GoogleDocViewer from './Viewers/GoogleDocViewer';
import NativeEditor from './NativeEditor';
import CanvasEditor from './Canvas/CanvasEditor';
import GraphViewEditor from './GraphView/GraphViewEditor';
import PluginViewer from './Viewers/PluginViewer';
import { getDynamicIcon, parseLinkData } from '../../utils/icons';
import { X, Copy, ExternalLink, Columns, Maximize2 } from 'lucide-react'; // 加入 Columns, Maximize2 作為分割畫面切換按鈕
import desktopIcon from '../../../assets/desktopIcon.svg';
import { SetupScreen } from '../Setup/SetupScreen';


interface MainContentProps {
  leftFiles: DriveFile[];
  rightFiles: DriveFile[];
  leftActiveId: string | null;
  rightActiveId: string | null;
  splitMode: boolean;
  activePane: 'left' | 'right';
  onTabSelect: (pane: 'left' | 'right', id: string) => void;
  onTabClose: (pane: 'left' | 'right', id: string) => void;
  onTabsReorder: (pane: 'left' | 'right', newOrder: DriveFile[]) => void;
  onOpenLink: (url: string) => void;
  onUpdateTab: (fileId: string, title?: string, url?: string) => void;
  onPaneFocus: (pane: 'left' | 'right') => void;
  onToggleSplit: (forceMode?: boolean) => void;
  onMoveTab: (file: DriveFile, fromPane: 'left' | 'right', toPane: 'left' | 'right') => void;
  onFileSelect: (file: DriveFile) => void;
  workspaceId: string;
  theme: 'light' | 'dark' | 'warm' | 'eva' | 'miku';
  onOpenSecurity: () => void;
}

/*
const getIcon = (mimeType: string) => {
    if (mimeType.includes('document')) return <FileText className="w-4 h-4 text-blue-400" />;
    if (mimeType.includes('spreadsheet')) return <LayoutDashboard className="w-4 h-4 text-green-400" />;
    if (mimeType.includes('presentation')) return <Presentation className="w-4 h-4 text-yellow-400" />;
    if (mimeType.includes('form')) return <FormInput className="w-4 h-4 text-purple-400" />;
    if (mimeType.includes('script')) return <Code className="w-4 h-4 text-blue-500" />;
    if (mimeType.includes('colaboratory')) return <Terminal className="w-4 h-4 text-orange-400" />;
    if (mimeType.includes('nexus.link')) return <BrainCircuit className="w-4 h-4 text-teal-400" />;
    return <File className="w-4 h-4 text-gray-400" />;
};
*/

const MainContent: React.FC<MainContentProps> = ({
  leftFiles, rightFiles, leftActiveId, rightActiveId, splitMode, activePane,
  onTabSelect, onTabClose, onTabsReorder, onOpenLink, onUpdateTab,
  onPaneFocus, onToggleSplit, onMoveTab, onFileSelect, workspaceId, theme,
  onOpenSecurity
}) => {
  const [draggedTab, setDraggedTab] = useState<{ id: string, pane: 'left' | 'right' } | null>(null);
  const [dynamicUrls, setDynamicUrls] = useState<Record<string, string>>({});
  const [dynamicTitles, setDynamicTitles] = useState<Record<string, string>>({});

  const handleUrlChange = useCallback((fileId: string, newUrl: string) => {
    setDynamicUrls(prev => {
      if (prev[fileId] === newUrl) return prev;
      return { ...prev, [fileId]: newUrl };
    });
    onUpdateTab(fileId, undefined, newUrl);
  }, [onUpdateTab]);

  const handleTitleChange = useCallback((fileId: string, newTitle: string) => {
    setDynamicTitles(prev => {
      if (prev[fileId] === newTitle) return prev;
      return { ...prev, [fileId]: newTitle };
    });
    onUpdateTab(fileId, newTitle, undefined);
  }, [onUpdateTab]);

  const handleDragStart = (e: React.DragEvent, id: string, pane: 'left' | 'right') => {
    setDraggedTab({ id, pane });
    e.dataTransfer.effectAllowed = 'move';
  };

  const handleDragOver = (e: React.DragEvent, targetId: string, targetPane: 'left' | 'right') => {
    e.preventDefault();
    if (!draggedTab || (draggedTab.id === targetId && draggedTab.pane === targetPane)) return;

    if (draggedTab.pane === targetPane) {
      // 同一窗格內排序
      const files = targetPane === 'left' ? leftFiles : rightFiles;
      const oldIndex = files.findIndex(f => f.id === draggedTab.id);
      const newIndex = files.findIndex(f => f.id === targetId);

      if (oldIndex !== -1 && newIndex !== -1) {
        const newOrder = [...files];
        const [movedItem] = newOrder.splice(oldIndex, 1);
        newOrder.splice(newIndex, 0, movedItem);
        onTabsReorder(targetPane, newOrder);
      }
    }
  };

  const handleDropToPane = (e: React.DragEvent, targetPane: 'left' | 'right') => {
    e.preventDefault();
    if (!draggedTab || draggedTab.pane === targetPane) return;

    // 跨窗格拖曳
    const sourceFiles = draggedTab.pane === 'left' ? leftFiles : rightFiles;
    const fileToMove = sourceFiles.find(f => f.id === draggedTab.id);
    if (fileToMove) {
      onMoveTab(fileToMove, draggedTab.pane, targetPane);
    }
    setDraggedTab(null);
  };

  const renderPane = (pane: 'left' | 'right') => {
    const files = pane === 'left' ? leftFiles : rightFiles;
    const activeId = pane === 'left' ? leftActiveId : rightActiveId;
    const isActivePane = activePane === pane;

    if (files.length === 0) {
      return (
        <div
          className={`flex-1 flex flex-col items-center justify-center bg-theme-900 transition-colors ${isActivePane ? 'bg-theme-900' : 'bg-theme-950'} ${pane === 'right' ? 'border-l border-theme-700' : ''}`}
          onClick={() => onPaneFocus(pane)}
          onDragOver={(e) => { e.preventDefault(); e.dataTransfer.dropEffect = 'move'; }}
          onDrop={(e) => handleDropToPane(e, pane)}
        >
          {splitMode && pane === 'right' && (
            <button onClick={() => onToggleSplit()} className="absolute top-4 right-4 p-2 bg-theme-800 text-theme-400 hover:text-theme-50 rounded z-20">
              <X className="w-4 h-4" />
            </button>
          )}
          <div className="text-center opacity-50">
            <div className="w-16 h-16 bg-theme-800 rounded-2xl flex items-center justify-center mx-auto mb-4 shadow-inner ring-1 ring-theme-700 overflow-hidden">
              <img src={desktopIcon} alt="Synapse" className="w-10 h-10 object-contain" />
            </div>
            <p className="tracking-widest uppercase text-xs font-semibold text-theme-500">
              {pane === 'left' ? 'Synapse Workspace' : 'Drop Tab Here'}
            </p>
          </div>
        </div>
      );
    }

    const activeFile = files.find(f => f.id === activeId);
    const getActiveUrl = () => {
      if (!activeFile) return '';
      if (dynamicUrls[activeFile.id]) return dynamicUrls[activeFile.id];
      if (activeFile.mimeType === 'application/vnd.synapse.link' || activeFile.mimeType === 'application/vnd.nexus.link') return parseLinkData(activeFile.description).url || 'https://notebooklm.google.com/';
      if (activeFile.webViewLink) return activeFile.webViewLink;
      if (activeFile.mimeType.includes('document')) return `https://docs.google.com/document/d/${activeFile.id}/edit`;
      return `https://drive.google.com/file/d/${activeFile.id}/preview`;
    };

    return (
      <div
        className={`flex-1 flex flex-col h-full overflow-hidden relative ${pane === 'right' ? 'border-l border-theme-700' : ''}`}
        onClickCapture={() => { if (!isActivePane) onPaneFocus(pane); }}
        onDragOver={(e) => { e.preventDefault(); e.dataTransfer.dropEffect = 'move'; }}
        onDrop={(e) => handleDropToPane(e, pane)}
      >
        {/* 標籤列 */}
        <div className={`shrink-0 flex items-end h-10 border-b px-2 pt-2 gap-1 overflow-x-auto custom-scrollbar scrollbar-thin scrollbar-thumb-theme-700 scrollbar-track-transparent ${isActivePane ? 'bg-theme-950 border-theme-800' : 'bg-theme-900 border-theme-800'} transition-colors`}>
          {files.map(file => {
            const isTabActive = file.id === activeId;
            return (
              <div
                key={file.id}
                draggable
                onDragStart={(e) => handleDragStart(e, file.id, pane)}
                onDragOver={(e) => handleDragOver(e, file.id, pane)}
                onClick={() => onTabSelect(pane, file.id)}
                className={`flex items-center gap-2 px-3 h-full min-w-[120px] max-w-[200px] text-xs font-medium cursor-pointer transition-all relative group/tab
                  ${isTabActive
                    ? `bg-theme-900 text-theme-100 border-x border-theme-700 z-10 shadow-[0_2px_0_0_var(--color-theme-900)]`
                    : 'text-theme-400 hover:text-theme-200 hover:bg-theme-800/50 border-x border-transparent'
                  }${draggedTab?.id === file.id && draggedTab?.pane === pane ? 'opacity-50' : ''}
                `}
              >
                {getDynamicIcon(file.mimeType, file.name, file.description)}
                <span className="truncate text-xs font-medium flex-1">{dynamicTitles[file.id] || file.name}</span>
                <button
                  onClick={(e) => { e.stopPropagation(); onTabClose(pane, file.id); }}
                  className={`p-0.5 rounded-md opacity-0 group-hover:opacity-100 transition-opacity ${isTabActive ? 'opacity-100 hover:bg-theme-700' : 'hover:bg-theme-700'}`}
                >
                  <X className="w-3 h-3" />
                </button>
              </div>
            );
          })}
        </div>

        {/* 網址列佈局 */}
        {activeFile && (
          <div className={`flex items-center px-2 py-1 border-b text-[10px] gap-2 shrink-0 transition-colors ${isActivePane ? 'bg-theme-900 border-theme-800 text-theme-400' : 'bg-theme-800 border-theme-800/50 text-theme-500'}`}>
            <div className={`flex-1 truncate font-mono px-2 py-0.5 rounded border select-all cursor-text ${isActivePane ? 'bg-theme-800 border-theme-950/50 text-theme-400' : 'bg-theme-900/40 border-theme-800/50 text-theme-500'}`}>
              {getActiveUrl()}
            </div>
            <button onClick={() => {
              if (activeFile.webViewLink) window.electron.openExternal(activeFile.webViewLink);
            }} className="p-1 hover:bg-theme-800 hover:text-theme-50 rounded transition-colors" title="在預設瀏覽器開啟"><ExternalLink className="w-3 h-3" /></button>
            <button onClick={() => navigator.clipboard.writeText(getActiveUrl())} className="p-1 hover:bg-theme-800 hover:text-theme-50 rounded transition-colors" title="複製網址"><Copy className="w-3 h-3" /></button>

            <div className="w-px h-3 bg-theme-700 mx-1"></div>

            <button
              onClick={() => onToggleSplit()}
              className={`p-1 rounded transition-colors ${splitMode ? 'bg-primary-main/20 text-primary-text hover:bg-primary-main/40' : 'hover:bg-theme-800 hover:text-theme-50'}`}
              title={splitMode ? "關閉雙開模式" : "向右分割視窗"}
            >
              {splitMode ? <Maximize2 className="w-3 h-3" /> : <Columns className="w-3 h-3" />}
            </button>
          </div>
        )}

        {/* 網頁內容 */}
        <div className={`flex-1 relative ${isActivePane ? '' : 'grayscale-[20%] opacity-95 pointer-events-none'}`}>
          {files.map(file => {
            const isNativeEditable = file.mimeType === 'text/markdown' || file.mimeType === 'application/x-tex';
            const isCanvas = file.mimeType === 'application/vnd.synapse.canvas' || file.mimeType === 'application/vnd.nexus.canvas' || 
                             file.name.toLowerCase().endsWith('.syn_canvas') || file.name.toLowerCase().endsWith('.nex_canvas');
            const isGraphView = file.mimeType === 'application/vnd.synapse.graph' || file.mimeType === 'application/vnd.nexus.graph' || 
                             file.name.toLowerCase().endsWith('.syn_graph') || file.name.toLowerCase().endsWith('.nex_graph');
            const isSetupPage = file.mimeType === 'application/vnd.synapse.setup';
            const isPlugin = file.mimeType.startsWith('application/vnd.synapse.plugin.');

            return (
              <div key={file.id} className={`absolute inset-0 ${file.id === activeId ? 'flex' : 'hidden'} ${isNativeEditable || isCanvas || isGraphView || isSetupPage || isPlugin ? 'bg-app-bg' : 'bg-white'}`}>
                {isSetupPage ? (
                  <SetupScreen onOpenSecurity={onOpenSecurity} />
                ) : isPlugin ? (
                  <PluginViewer file={file} />
                ) : isNativeEditable ? (
                  <NativeEditor file={file} currentWorkspaceId={workspaceId} theme={theme} />
                ) : isCanvas ? (
                  <CanvasEditor file={file} currentWorkspaceId={workspaceId} onFileSelect={onFileSelect} theme={theme} />
                ) : isGraphView ? (
                  <GraphViewEditor file={file} currentWorkspaceId={workspaceId} onFileSelect={onFileSelect} theme={theme} />
                ) : (
                  <GoogleDocViewer
                    file={file}
                    onOpenLink={onOpenLink}
                    onUrlChange={(newUrl) => handleUrlChange(file.id, newUrl)}
                    onTitleChange={(newTitle) => handleTitleChange(file.id, newTitle)}
                  />
                )}
              </div>
            );
          })}
        </div>
      </div>
    );
  };

  return (
    <div className="flex-1 flex w-full h-full overflow-hidden bg-theme-950">
      {renderPane('left')}
      {splitMode && renderPane('right')}
    </div>
  );
};

export default React.memo(MainContent);