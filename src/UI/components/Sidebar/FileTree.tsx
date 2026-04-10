import React, { useEffect, useState, useCallback } from 'react';
import type { DriveFile, FileQuery, FileQueryMode, FileQuerySortBy, FileQuerySortOrder } from '../../../shared/types';
import TreeItem from './TreeItem';
import {
  Loader2, FolderHeart, Plus
} from 'lucide-react';
import DeleteConfirmModal from './Modals/DeleteConfirmModal';
import LinkEditorModal from './Modals/LinkEditorModal';
import { parseLinkData } from '../../utils/icons';
import { ContextMenu } from './ContextMenu/ContextMenu';
import { t } from '../../../language';

import {
  CONTEXT_MENU_MIN_BOTTOM_SPACE,
  ADD_MENU_SAFE_BOTTOM_SPACE
} from './Constants/Sidebar.constants';
import InputModal from './Modals/InputModal';
import { AddMenu } from './AddMenu/AddMenu';
import FilePropertiesModal from './Modals/FilePropertiesModal';

interface FileTreeProps {
  mode: FileQueryMode;
  parentId?: string;
  searchQuery?: string;
  sortBy?: FileQuerySortBy;
  sortOrder?: FileQuerySortOrder;
  onSelect: (file: DriveFile) => void;
  onFileUpdate?: (file: DriveFile) => void;
  rootName: string;
  refreshSignal?: number;
  workspaceId: string;
}

interface MenuState {
  file: DriveFile | null;
  x: number;
  y: number;
}

const FileTree: React.FC<FileTreeProps> = ({ mode, parentId, searchQuery, sortBy, sortOrder, onSelect, onFileUpdate, rootName, refreshSignal, workspaceId }) => {
  const [files, setFiles] = useState<DriveFile[]>([]);
  const [loading, setLoading] = useState(false);
  const [refreshKey, setRefreshKey] = useState(0);
  const [actionState, setActionState] = useState({ isSyncing: false, message: '' });

  const [contextMenu, setContextMenu] = useState<MenuState | null>(null);
  const [addMenu, setAddMenu] = useState<MenuState | null>(null);
  const [clipboard, setClipboard] = useState<{ file: DriveFile, action: 'copy' | 'cut' } | null>(null);

  const [selectedItems, setSelectedItems] = useState<Map<string, DriveFile>>(new Map());
  const [lastSelectedId, setLastSelectedId] = useState<string | null>(null);

  const [inputModal, setInputModal] = useState<{
    isOpen: boolean;
    title: string;
    initialValue: string;
    placeholder?: string;
    onSubmit: (val: string) => void;
    onCancel: () => void;
  }>({ isOpen: false, title: '', initialValue: '', onSubmit: () => { }, onCancel: () => { } });

  const [deleteModal, setDeleteModal] = useState<{ isOpen: boolean; file: DriveFile | null }>({ isOpen: false, file: null });

  const [templateFolders, setTemplateFolders] = useState<DriveFile[]>([]);
  const [activeTemplateSubMenu, setActiveTemplateSubMenu] = useState(false);

  const handleDelete = (file: DriveFile) => {
    setDeleteModal({ isOpen: true, file });
  };

  const confirmDelete = () => {
    if (!deleteModal.file) return;
    executeWithAutoSync(async () => {
      await window.electron.trashFile(deleteModal.file!.id);
    }, t.fileTree.deleting);
    setDeleteModal({ isOpen: false, file: null });
  };

  const [propertiesFile, setPropertiesFile] = useState<DriveFile | null>(null);

  const fetchRoot = useCallback(async (isSilent = false) => {
    if (!isSilent) setLoading(true);
    try {
      const params: FileQuery = { mode, parentId, sortBy, sortOrder, searchQuery: searchQuery || undefined };
      const result = await window.electron.listFiles(params);
      setFiles(result);
    } catch (err) { console.error(err); }
    finally { setLoading(false); }
  }, [mode, parentId, searchQuery, sortBy, sortOrder]);

  useEffect(() => { fetchRoot(); }, [fetchRoot]);

  useEffect(() => {
    if (refreshSignal && refreshSignal > 0) {
      setRefreshKey(prev => prev + 1);
      fetchRoot(true);
    }
  }, [refreshSignal, fetchRoot]);

  useEffect(() => {
    const interval = setInterval(() => {
      window.electron.triggerGoogleLogin().then(() => {
        setRefreshKey(prev => prev + 1);
      }).catch((e: unknown) => console.error(e));
    }, 300000);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    const handleTagsUpdated = (e: CustomEvent<{ fileId: string, tags: string[] }>) => {
      setFiles(prev => prev.map(f =>
        f.id === e.detail.fileId ? { ...f, tags: e.detail.tags } : f
      ));
    };
    window.addEventListener('tags-updated', handleTagsUpdated as EventListener);
    return () => window.removeEventListener('tags-updated', handleTagsUpdated as EventListener);
  }, []);

  const getSafePosition = (e: React.MouseEvent, height: number) => {
    let y = e.pageY;
    if (y + height > window.innerHeight) y = Math.max(0, e.pageY - height);
    return { x: e.pageX, y };
  };

  const openContextMenu = (e: React.MouseEvent, file: DriveFile | null) => {
    e.preventDefault(); e.stopPropagation();
    if (file && selectedItems.size > 1 && selectedItems.has(file.id)) {
      // Do not open context menu if multiple items are selected and the user right-clicked one of them
      return;
    }
    setAddMenu(null);
    setContextMenu({ file, ...getSafePosition(e, CONTEXT_MENU_MIN_BOTTOM_SPACE) });
  };

  const openAddMenu = (e: React.MouseEvent, file: DriveFile | null) => {
    e.preventDefault(); e.stopPropagation();
    setContextMenu(null);
    setAddMenu({ file, ...getSafePosition(e, ADD_MENU_SAFE_BOTTOM_SPACE) });
  };

  interface LinkDefaultData { name: string; url: string; icon: string; color: string; }
  const [linkEditor, setLinkEditor] = useState<{
    isOpen: boolean; file: DriveFile | null; isNew: boolean; targetId?: string; defaultData?: LinkDefaultData;
  }>({ isOpen: false, file: null, isNew: false });

  const handleSaveLink = (name: string, url: string, icon: string, color: string) => {
    const description = JSON.stringify({ url, icon, color });
    const appProps = { syn_url: url, syn_icon: icon, syn_color: color };
    if (linkEditor.isNew) {
      const dest = linkEditor.targetId ?? parentId;
      executeWithAutoSync(async () => {
        await window.electron.createFile(dest, 'application/vnd.synapse.link', name, description);
      }, t.fileTree.creatingLink);
    } else if (linkEditor.file) {
      executeWithAutoSync(async () => {
        await window.electron.updateFileMeta(linkEditor.file!.id, name, description, appProps);
        if (onFileUpdate) onFileUpdate({ ...linkEditor.file!, name, description, linkUrl: url, linkIcon: icon, linkColor: color });
      }, t.fileTree.updatingLink);
    }
    setLinkEditor({ isOpen: false, file: null, isNew: false });
  };

  const handleCreateNew = (targetFile: DriveFile | null, mimeType: string, customName?: string) => {
    const targetId = targetFile ? targetFile.id : parentId;

    const doCreate = async (customName?: string, description?: string) => {
      setInputModal(prev => ({ ...prev, isOpen: false }));
      setActionState({ isSyncing: true, message: t.fileTree.creating });

      let finalName = customName;
      if (finalName) {
        if (mimeType.includes('markdown') && !finalName.toLowerCase().endsWith('.md')) {
          finalName += '.md';
        } else if (mimeType.includes('tex') && !finalName.toLowerCase().endsWith('.tex')) {
          finalName += '.tex';
        }
      }

      try {
        const res = await window.electron.createFile(targetId, mimeType, finalName, description);
        if (res?.success && res.file) {
          setRefreshKey(prev => prev + 1);
          await fetchRoot(true);
          onSelect(res.file as DriveFile);
          window.electron.triggerGoogleLogin().catch(() => { });
        }
      } catch (e) { console.error('建立失敗', e); }
      finally { setActionState({ isSyncing: false, message: '' }); }
    };

    if (customName) {
      // 外部直送檔案名稱（如插件建立），跳過彈窗直衝
      doCreate(customName);
    } else if (mimeType === 'application/vnd.google-apps.folder') {
      setInputModal({ isOpen: true, title: t.fileTree.newFolder, initialValue: t.fileTree.untitledFolder, onSubmit: doCreate, onCancel: () => setInputModal(prev => ({ ...prev, isOpen: false })) });
    } else if (mimeType === 'application/vnd.synapse.link') {
      setLinkEditor({ isOpen: true, file: null, isNew: true, targetId, defaultData: { name: t.menu.notebookLm, url: 'https://notebooklm.google.com/', icon: 'BrainCircuit', color: '#2dd4bf' } });
    } else if (mimeType === 'application/vnd.synapse.link.custom') {
      setLinkEditor({ isOpen: true, file: null, isNew: true, targetId, defaultData: { name: t.fileTree.newLink, url: '', icon: 'Globe', color: '#38bdf8' } });
    } else if (mimeType.includes('synapse') || mimeType.includes('nexus') || mimeType.includes('tex') || mimeType.includes('markdown')) {
      setInputModal({ isOpen: true, title: t.fileTree.newFile, initialValue: '', onSubmit: doCreate, onCancel: () => setInputModal(prev => ({ ...prev, isOpen: false })) });
    } else {
      doCreate();
    }
  };

  const loadTemplateFolders = async () => {
    try {
      const folders = await window.electron.getTemplateFolders();
      setTemplateFolders(folders || []);
    } catch (e) { console.error('Load templates failed', e); }
  };

  const handleCopyTemplateFile = (sourceFile: DriveFile) => {
    setAddMenu(null);
    setActiveTemplateSubMenu(false);

    setInputModal({
      isOpen: true,
      title: t.fileTree.createFromTemplateAndName,
      initialValue: sourceFile.name,
      onSubmit: (newName) => {
        setInputModal(prev => ({ ...prev, isOpen: false }));
        const targetId = addMenu?.file ? addMenu.file.id : parentId;
        executeWithAutoSync(async () => {
          await window.electron.copyFile(sourceFile.id, targetId, newName);
        }, t.fileTree.copyingFromTemplate);
      },
      onCancel: () => setInputModal(prev => ({ ...prev, isOpen: false }))
    });
  };

  const handleEditItem = (file: DriveFile) => {
    if (file.mimeType === 'application/vnd.synapse.link' || file.mimeType === 'application/vnd.nexus.link') {
      // Prefer linkUrl/linkIcon/linkColor (from appProperties cache) over description JSON
      const data = file.linkUrl
        ? { url: file.linkUrl ?? '', icon: file.linkIcon ?? 'LinkIcon', color: file.linkColor ?? '#34d399' }
        : parseLinkData(file.description || '');
      setLinkEditor({ isOpen: true, file, isNew: false, defaultData: { name: file.name, ...data } });
    } else {
      handleRename(file);
    }
  };

  const executeWithAutoSync = async (actionFn: () => Promise<void>, loadingMsg = t.common.loading) => {
    setActionState({ isSyncing: true, message: loadingMsg });
    try {
      await actionFn();
      setRefreshKey(prev => prev + 1);
      await fetchRoot(true);
      window.electron.triggerGoogleLogin().catch(() => { });
    } catch (error) {
      console.error('操作失敗', error);
    } finally {
      setActionState({ isSyncing: false, message: '' });
    }
  };

  const handleItemClick = useCallback((file: DriveFile, e: React.MouseEvent) => {
    if (e.ctrlKey || e.metaKey) {
      setSelectedItems(prev => {
        const next = new Map(prev);
        if (next.has(file.id)) next.delete(file.id);
        else next.set(file.id, file);
        return next;
      });
      setLastSelectedId(file.id);
    } else if (e.shiftKey && lastSelectedId) {
      const elements = Array.from(document.querySelectorAll('.synapse-file-item'));
      const fileList = elements.map(el => {
        try { return JSON.parse(el.getAttribute('data-file-json') || 'null'); } catch { return null; }
      }).filter(Boolean) as DriveFile[];
      const ids = fileList.map(f => f.id);
      const startIdx = ids.indexOf(lastSelectedId);
      const endIdx = ids.indexOf(file.id);
      if (startIdx !== -1 && endIdx !== -1) {
        const min = Math.min(startIdx, endIdx);
        const max = Math.max(startIdx, endIdx);
        const rangeFiles = fileList.slice(min, max + 1);
        setSelectedItems(prev => {
          const next = new Map(prev);
          rangeFiles.forEach(f => next.set(f.id, f));
          return next;
        });
      }
    } else {
      setSelectedItems(new Map([[file.id, file]]));
      setLastSelectedId(file.id);
    }
  }, [lastSelectedId]);

  const handleRename = (file: DriveFile) => {
    setInputModal({
      isOpen: true, title: t.fileTree.renamePromptTitle, initialValue: file.name,
      onSubmit: (newName) => {
        setInputModal(prev => ({ ...prev, isOpen: false }));
        if (newName !== file.name) executeWithAutoSync(async () => {
          await window.electron.renameFile(file.id, newName);
          if (onFileUpdate) onFileUpdate({ ...file, name: newName });
        }, t.fileTree.renaming);
      },
      onCancel: () => setInputModal(prev => ({ ...prev, isOpen: false }))
    });
  };

  const handlePaste = (target?: DriveFile | null) => {
    if (!clipboard) return;
    executeWithAutoSync(async () => {
      const tid = target ? target.id : parentId;
      if (clipboard.action === 'copy') await window.electron.copyFile(clipboard.file.id, tid);
      else await window.electron.moveFile(clipboard.file.id, tid);
      setClipboard(null);
    }, t.fileTree.pasting);
  };

  const handleAddTag = async (fileId: string, tagName: string) => {
    try {
      await window.electron.addTag(fileId, tagName, workspaceId);
      setFiles(prev => prev.map(f =>
        f.id === fileId
          ? { ...f, tags: [...(f.tags || []), tagName] }
          : f
      ));
    } catch (error) {
      console.error('Add tag failed:', error);
    }
  };

  const handleRemoveTag = async (fileId: string, tagName: string) => {
    try {
      await window.electron.removeTag(fileId, tagName);
      setFiles(prev => prev.map(f =>
        f.id === fileId
          ? { ...f, tags: (f.tags || []).filter(tag => tag !== tagName) }
          : f
      ));
    } catch (error) {
      console.error('Remove tag failed:', error);
    }
  };

  const handleMoveDrop = (draggedFile: DriveFile, targetFolderId: string) => {
    executeWithAutoSync(async () => {
      await window.electron.moveFile(draggedFile.id, targetFolderId);
    }, t.fileTree.moving);
  };

  const handleMultiMoveDrop = (draggedFiles: DriveFile[], targetFolderId: string) => {
    executeWithAutoSync(async () => {
      for (const f of draggedFiles) {
        if (f.id !== targetFolderId && f.parents?.[0] !== targetFolderId) {
          await window.electron.moveFile(f.id, targetFolderId);
        }
      }
      setSelectedItems(new Map());
    }, t.fileTree.moving);
  };

  const [isRootDragOver, setIsRootDragOver] = useState(false);
  const handleRootDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsRootDragOver(true);
    if (e.dataTransfer.types && e.dataTransfer.types.includes('Files')) {
      e.dataTransfer.dropEffect = 'copy';
    }
  };
  const handleRootDragLeave = () => setIsRootDragOver(false);

  const handleRootDrop = (e: React.DragEvent) => {
    e.preventDefault(); setIsRootDragOver(false);
    const targetFolderId = parentId || 'root';

    const filesDataStr = e.dataTransfer.getData('application/vnd.synapse.files') || e.dataTransfer.getData('application/vnd.nexus.files');
    if (filesDataStr) {
      const draggedFiles: DriveFile[] = JSON.parse(filesDataStr);
      handleMultiMoveDrop(draggedFiles, targetFolderId);
      return;
    }

    const fileDataStr = e.dataTransfer.getData('application/vnd.synapse.file') || e.dataTransfer.getData('application/vnd.nexus.file');
    if (fileDataStr) {
      const draggedFile: DriveFile = JSON.parse(fileDataStr);
      if (draggedFile.parents?.[0] !== targetFolderId) {
        handleMoveDrop(draggedFile, targetFolderId);
      }
    }
  };


  return (
    <div className="flex-1 flex flex-col overflow-hidden relative" onContextMenu={(e) => openContextMenu(e, null)}>

      {(contextMenu || addMenu) && (
        <div
          className="fixed inset-0 z-40 bg-transparent"
          onClick={(e) => { e.stopPropagation(); setContextMenu(null); setAddMenu(null); }}
          onContextMenu={(e) => { e.preventDefault(); e.stopPropagation(); setContextMenu(null); setAddMenu(null); }}
        />
      )}

      {actionState.isSyncing && (
        <div className="absolute inset-0 z-50 bg-theme-900/60 flex flex-col items-center justify-center backdrop-blur-sm animate-in fade-in duration-200">
          <Loader2 className="w-8 h-8 animate-spin text-primary-main mb-3" />
          <p className="text-sm text-theme-300 font-medium tracking-wide">{actionState.message}</p>
        </div>
      )}

      {/*母資料夾的標題列*/}
      <div
        onClick={() => {
          let actualRootId = parentId;
          if (!actualRootId) {
            if (mode === 'starred') actualRootId = 'starred';
            else if (mode === 'trashed') actualRootId = 'trash';
            else if (mode === 'shared-with-me') actualRootId = 'sharedWithMe';
            else actualRootId = 'root';
          }
          onSelect({ id: actualRootId, name: rootName, mimeType: 'application/vnd.google-apps.folder' } as DriveFile);
        }}
        className="px-4 py-2 text-xs font-semibold text-theme-500 uppercase tracking-wider flex items-center justify-between group border-b border-theme-800/50 mb-1 hover:bg-theme-800/30 cursor-pointer relative z-10"
        onContextMenu={(e) => openContextMenu(e, null)}
      >
        <div className="flex items-center gap-2">
          <FolderHeart className="w-3 h-3" />
          <span className="truncate">{rootName}</span>
        </div>
        <button onClick={(e) => openAddMenu(e, null)} className="p-1 hover:bg-theme-700 rounded text-theme-400 hover:text-theme-50 transition-all relative z-10">
          <Plus className="w-3.5 h-3.5" />
        </button>
      </div>

      <div
        className={`flex-1 overflow-y-auto custom-scrollbar relative z-10 transition-colors duration-200 ${isRootDragOver ? 'bg-primary-main/20 ring-inset ring-2 ring-primary-main/50' : ''}`}
        onDragOver={handleRootDragOver}
        onDragLeave={handleRootDragLeave}
        onDrop={handleRootDrop}
      >
        {loading && !actionState.isSyncing && (
          <div className="absolute top-0 left-0 w-full h-0.5 bg-primary-main/30 overflow-hidden z-20">
            <div className="w-full h-full bg-primary-main animate-progress origin-left" />
          </div>
        )}

        {files.map((file) => (
          <TreeItem
            key={file.id} file={file}
            isSelected={selectedItems.has(file.id)}
            onItemClick={handleItemClick}
            onSelect={onSelect}
            refreshKey={refreshKey}
            onDeleteKey={handleDelete}
            onContextMenu={openContextMenu}
            onAddClick={openAddMenu}
            onCopyKey={(f) => f.mimeType !== 'application/vnd.google-apps.folder' && setClipboard({ file: f, action: 'copy' })}
            onPasteKey={(f) => handlePaste(f)}
            onMoveDrop={handleMoveDrop}
            onMultiMoveDrop={handleMultiMoveDrop}
            getSelectedFiles={() => Array.from(selectedItems.values())}
          />
        ))}
      </div>

      {contextMenu && (
        <ContextMenu
          x={contextMenu.x}
          y={contextMenu.y}
          file={contextMenu.file || undefined}
          rootName={rootName}
          clipboard={clipboard}
          onClose={() => setContextMenu(null)}
          onEdit={(f: DriveFile) => { handleEditItem(f); setContextMenu(null); }}
          onCut={(f: DriveFile) => { setClipboard({ file: f, action: 'cut' }); setContextMenu(null); }}
          onCopy={(f: DriveFile) => { setClipboard({ file: f, action: 'copy' }); setContextMenu(null); }}
          onPaste={handlePaste}
          onDelete={(f: DriveFile) => {
            executeWithAutoSync(async () => {
              await window.electron.trashFile(f.id);
            }, t.fileTree.trashing);
            setContextMenu(null);
          }}
          onRenameSubmit={(f: DriveFile, newName: string) => {
            if (newName !== f.name) {
              executeWithAutoSync(async () => {
                await window.electron.renameFile(f.id, newName);
                if (onFileUpdate) onFileUpdate({ ...f, name: newName });
              }, t.fileTree.renaming);
            }
          }}
          onAddTag={handleAddTag}
          onRemoveTag={handleRemoveTag}
          currentWorkspaceId={workspaceId}
          onFileUpdate={onFileUpdate || (() => { })}
        />
      )}

      {addMenu && (
        <AddMenu
          x={addMenu.x}
          y={addMenu.y}
          file={addMenu.file}
          templateFolders={templateFolders}
          activeTemplateSubMenu={activeTemplateSubMenu}
          onClose={() => setAddMenu(null)}
          onCreateNew={handleCreateNew}
          onSetTemplateSubMenu={setActiveTemplateSubMenu}
          onLoadTemplateFolders={loadTemplateFolders}
          onCopyTemplateFile={handleCopyTemplateFile}
        />
      )}

      {inputModal.isOpen && (
        <InputModal
          title={inputModal.title}
          initialValue={inputModal.initialValue}
          onSubmit={inputModal.onSubmit}
          onCancel={inputModal.onCancel}
        />
      )}

      <DeleteConfirmModal
        isOpen={deleteModal.isOpen}
        title={deleteModal.file?.name || ''}
        mode="file"
        onConfirm={confirmDelete}
        onClose={() => setDeleteModal({ isOpen: false, file: null })}
      />

      {propertiesFile && (
        <FilePropertiesModal propertiesFile={propertiesFile} onClose={() => setPropertiesFile(null)} />
      )}

      {linkEditor.isOpen && (
        <LinkEditorModal
          isOpen={linkEditor.isOpen}
          initialName={linkEditor.defaultData?.name || ''}
          initialUrl={linkEditor.defaultData?.url || ''}
          initialIcon={linkEditor.defaultData?.icon || 'LinkIcon'}
          initialColor={linkEditor.defaultData?.color || '#34d399'}
          onClose={() => setLinkEditor({ isOpen: false, file: null, isNew: false })}
          onSave={handleSaveLink}
        />
      )}
    </div>
  );
};

export default FileTree;