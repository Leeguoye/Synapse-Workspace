import React, { useState, useEffect, useRef } from 'react';
import type { DriveFile } from '../../../shared/types';
import { ChevronRight, ChevronDown, Folder, Loader2, Plus } from 'lucide-react';
import { getDynamicIcon } from '../../utils/icons';

interface TreeItemProps {
  file: DriveFile;
  level?: number;
  isSelected: boolean;
  onItemClick: (file: DriveFile, e: React.MouseEvent) => void;
  onSelect: (file: DriveFile, e: React.MouseEvent) => void;
  onContextMenu: (e: React.MouseEvent, file: DriveFile) => void;
  onAddClick: (e: React.MouseEvent, file: DriveFile) => void;
  onDeleteKey: (file: DriveFile) => void;
  onCopyKey: (file: DriveFile) => void;
  onPasteKey: (file: DriveFile) => void;
  refreshKey: number;
  onMoveDrop: (draggedFile: DriveFile, targetFolderId: string) => void;
  onMultiMoveDrop: (draggedFiles: DriveFile[], targetFolderId: string) => void;
  onLinkDrop?: (draggedFile: DriveFile, targetFile: DriveFile) => void;
  getSelectedFiles: () => DriveFile[];
}

const TreeItem: React.FC<TreeItemProps> = ({
  file, level = 0, isSelected, onItemClick, onSelect, onContextMenu, onAddClick, onDeleteKey, onCopyKey, onPasteKey, refreshKey, onMoveDrop, onMultiMoveDrop, onLinkDrop, getSelectedFiles
}) => {
  const [isExpanded, setIsExpanded] = useState(false);
  const [children, setChildren] = useState<DriveFile[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [hasFetched, setHasFetched] = useState(false);

  const [isDragOver, setIsDragOver] = useState(false);
  const dragCounter = useRef(0);

  const isFolder = file.mimeType === 'application/vnd.google-apps.folder';
  const folderColor = isFolder && file.folderColorRgb ? file.folderColorRgb : undefined;

  const isLinkable = [
    'application/vnd.google-apps.document',
    'application/vnd.google-apps.spreadsheet',
    'application/vnd.google-apps.presentation',
    'text/markdown',
    'application/x-tex',
    'application/vnd.synapse.canvas',
    'application/vnd.nexus.canvas'
  ].includes(file.mimeType);

  const isValidDropTarget = isFolder || isLinkable;

  const fetchChildren = React.useCallback(async (silent = false) => {
    if (!silent) setIsLoading(true);
    try {
      const result = await window.electron.listFiles({ parentId: file.id });
      setChildren(result);
      setHasFetched(true);
    } catch (error) {
      console.error(error);
      if (!silent) setIsExpanded(false);
    } finally {
      setIsLoading(false);
    }
  }, [file.id]);

  useEffect(() => {
    if (isExpanded) fetchChildren(true);
  }, [refreshKey, isExpanded, fetchChildren]);

  const toggleExpand = () => {
    if (isExpanded) { setIsExpanded(false); return; }
    setIsExpanded(true);
    if (!hasFetched) fetchChildren();
  };

  const handleClick = (e: React.MouseEvent) => { 
    e.stopPropagation(); 
    if (isFolder && !e.ctrlKey && !e.metaKey && !e.shiftKey) toggleExpand(); 
    onItemClick(file, e);
  };
  const handleDoubleClick = (e: React.MouseEvent) => { e.stopPropagation(); onSelect(file, e); };
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if ((e.key === 'Delete' || e.key === 'Backspace') && file.ownedByMe !== false) {
      e.stopPropagation();
      onDeleteKey(file);
    }
    if (e.ctrlKey && e.key.toLowerCase() === 'c') { e.stopPropagation(); onCopyKey(file); }
    if (e.ctrlKey && e.key.toLowerCase() === 'v') { e.stopPropagation(); onPasteKey(file); }
  };

  const handleDragStart = (e: React.DragEvent) => {
    e.stopPropagation();
    e.dataTransfer.setData('application/vnd.synapse.file', JSON.stringify(file));
    e.dataTransfer.setData('application/vnd.nexus.file', JSON.stringify(file));

    let draggedFiles = [file];
    if (isSelected) {
      const selected = getSelectedFiles();
      if (selected.length > 1) {
        draggedFiles = selected;
      }
    }
    
    if (draggedFiles.length > 1) {
      e.dataTransfer.setData('application/vnd.synapse.files', JSON.stringify(draggedFiles));
      e.dataTransfer.setData('application/vnd.nexus.files', JSON.stringify(draggedFiles));
    }

    const urlList: string[] = [];
    const htmlList: string[] = [];

    draggedFiles.forEach(f => {
      let fUrl = f.webViewLink || `https://drive.google.com/file/d/${f.id}/view`;
      if (f.mimeType === 'application/vnd.synapse.link' || f.mimeType === 'application/vnd.nexus.link') {
        try {
          const data = JSON.parse(f.description || '{}');
          if (data.url) fUrl = data.url;
        } catch (err) { /* ignore */ }
      }
      urlList.push(fUrl);
      htmlList.push(`<a href="${fUrl}">${f.name}</a>`);
    });

    e.dataTransfer.setData('text/html', htmlList.join('<br/>'));
    e.dataTransfer.setData('text/plain', urlList.join(' '));
    e.dataTransfer.setData('text/uri-list', urlList.join('\n'));

    e.dataTransfer.effectAllowed = 'copyMove';
  };

  const handleDragOver = (e: React.DragEvent) => {
    if (!isValidDropTarget) return;
    e.preventDefault();
    e.stopPropagation();
    e.dataTransfer.dropEffect = isFolder ? 'move' : 'link';
  };

  const handleDragEnter = (e: React.DragEvent) => {
    if (!isValidDropTarget) return;
    e.preventDefault(); e.stopPropagation();
    dragCounter.current += 1;
    if (dragCounter.current === 1) setIsDragOver(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    if (!isValidDropTarget) return;
    e.preventDefault(); e.stopPropagation();
    dragCounter.current -= 1;
    if (dragCounter.current === 0) setIsDragOver(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    if (!isValidDropTarget) return;
    e.preventDefault(); e.stopPropagation();

    dragCounter.current = 0;
    setIsDragOver(false);

    const filesDataStr = e.dataTransfer.getData('application/vnd.synapse.files') || e.dataTransfer.getData('application/vnd.nexus.files');
    if (filesDataStr) {
      const draggedFiles: DriveFile[] = JSON.parse(filesDataStr);
      if (isFolder) {
        onMultiMoveDrop(draggedFiles, file.id);
      }
      return;
    }

    // 處理內部拖曳
    const fileDataStr = e.dataTransfer.getData('application/vnd.synapse.file') || e.dataTransfer.getData('application/vnd.nexus.file');
    if (fileDataStr) {
      const draggedFile: DriveFile = JSON.parse(fileDataStr);
      if (draggedFile.id === file.id) return;

      if (isFolder) {
        if (draggedFile.parents?.[0] !== file.id) {
          onMoveDrop(draggedFile, file.id);
        }
      } else if (isLinkable && onLinkDrop) {
        onLinkDrop(draggedFile, file);
      }
    }
  };

  const getDropZoneStyle = () => {
    if (!isDragOver) return '';
    if (isFolder) return 'bg-blue-600/30 ring-1 ring-blue-500 rounded';
    return 'bg-emerald-600/30 ring-1 ring-emerald-500 rounded';
  };

  return (
    <div className="select-none outline-none">
      <div
        draggable
        onDragStart={handleDragStart}
        onDragOver={handleDragOver}
        onDragEnter={handleDragEnter}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        className={`
          flex items-center justify-between py-1 px-2 cursor-pointer synapse-file-item
          hover:bg-sidebar-hover text-sidebar-muted hover:text-sidebar-text transition-colors group outline-none focus:bg-sidebar-hover
          ${isExpanded ? 'bg-sidebar-hover/50' : ''}
          ${isSelected ? 'bg-blue-600/30 ring-1 ring-blue-500 rounded' : ''}
          ${getDropZoneStyle()}
        `}
        style={{ paddingLeft: `${level * 12 + 8}px` }}
        data-file-id={file.id}
        data-file-json={JSON.stringify(file)}
        onClick={handleClick}
        onDoubleClick={handleDoubleClick}
        onContextMenu={(e) => { e.stopPropagation(); e.preventDefault(); onContextMenu(e, file); }}
        onKeyDown={handleKeyDown}
        tabIndex={0}
        title={file.name}
      >
        <div className="flex items-center gap-2 overflow-hidden flex-1 pointer-events-none">
          <div className="w-4 h-4 flex items-center justify-center shrink-0">
            {isFolder && (isLoading ? <Loader2 className="w-3 h-3 animate-spin text-blue-400" /> : isExpanded ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4 text-sidebar-muted" />)}
          </div>
          {isFolder ? <Folder className={`w-4 h-4 shrink-0 ${!folderColor ? (isExpanded ? 'text-blue-400' : 'text-blue-500') : ''}`} style={folderColor ? { color: folderColor, fill: folderColor, fillOpacity: 0.2 } : {}} /> : getDynamicIcon(file.mimeType, file.name, file.description)}
          <span className="truncate text-sm">{file.name}</span>
        </div>

        {isFolder && <button onClick={(e) => onAddClick(e, file)} className="opacity-0 group-hover:opacity-100 p-0.5 hover:bg-sidebar-hover rounded text-sidebar-muted hover:text-sidebar-text transition-all shrink-0 mr-1"><Plus className="w-3.5 h-3.5" /></button>}
      </div>

      {isExpanded && (
        <div className="animate-in fade-in slide-in-from-left-1 duration-200">
          {children.length > 0 ? children.map((child) => (
            <TreeItem
              key={child.id} file={child} level={level + 1}
              isSelected={getSelectedFiles().some(f => f.id === child.id)}
              onItemClick={onItemClick}
              onSelect={onSelect} onContextMenu={onContextMenu} onAddClick={onAddClick} onDeleteKey={onDeleteKey} onCopyKey={onCopyKey} onPasteKey={onPasteKey} refreshKey={refreshKey}
              onMoveDrop={onMoveDrop} onMultiMoveDrop={onMultiMoveDrop} getSelectedFiles={getSelectedFiles} onLinkDrop={onLinkDrop} // ✅ 移除了 onExternalDrop
            />
          )) : (!isLoading && <div className="py-1 text-xs text-theme-500/50 italic" style={{ paddingLeft: `${(level + 1) * 12 + 28}px` }}>(空)</div>)
          }
        </div>
      )}
    </div>
  );
};

export default TreeItem;