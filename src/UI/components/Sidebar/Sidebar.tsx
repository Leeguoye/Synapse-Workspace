import React, { useState, useEffect } from 'react';
import SidebarToolbar from './SidebarToolbar';
import FileTree from './FileTree';
import ModeSelector from './ModeSelector';
import AddWorkspaceModal from './Modals/AddWorkspaceModal';
import DeleteConfirmModal from './Modals/DeleteConfirmModal';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import type { FileQuery, Workspace, DriveFile } from '../../../shared/types';
import { t } from '../../../language';

interface SidebarProps {
  onFileSelect: (file: DriveFile) => void;
  onFileUpdate?: (file: DriveFile) => void;
  onWorkspaceChange?: (id: string) => void;
}

const Sidebar: React.FC<SidebarProps> = ({ onFileSelect, onFileUpdate, onWorkspaceChange }) => {
  const [isCollapsed, setIsCollapsed] = useState(false);

  const [workspaces, setWorkspaces] = useState<Workspace[]>([]);
  const [activeWorkspaceId, setActiveWorkspaceId] = useState<string>('');
  const [activeMode, setActiveMode] = useState<FileQuery['mode']>('my-drive');
  const [activeTargetId, setActiveTargetId] = useState<string | undefined>(undefined);

  const [showAddModal, setShowAddModal] = useState(false);
  const [isSyncing, setIsSyncing] = useState(false);

  const [refreshSignal, setRefreshSignal] = useState(0);

  const [deleteTarget, setDeleteTarget] = useState<{ id: string, name: string } | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [sortBy, setSortBy] = useState<'name' | 'modifiedTime' | 'createdTime'>('name');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('asc');

  useEffect(() => {
    loadWorkspaces();

    const handleTagSearch = (e: CustomEvent<string>) => {
      setSearchQuery(`tag:${e.detail}`);
    };
    window.addEventListener('tag-search', handleTagSearch as EventListener);

    return () => {
      window.removeEventListener('tag-search', handleTagSearch as EventListener);
    };
  }, []); // Added empty dependency array to run only once on mount

  const loadWorkspaces = async () => {
    const list = await window.electron.getWorkspaces();
    setWorkspaces(list);
    if (!activeWorkspaceId && list.length > 0) {
      handleSelectWorkspace(list[0]);
    }
  };

  const handleSelectWorkspace = (ws: Workspace) => {
    setActiveWorkspaceId(ws.id);
    setActiveMode(ws.mode);
    setActiveTargetId(ws.targetId || undefined);
    if (onWorkspaceChange) onWorkspaceChange(ws.id);
  };

  const handleUpdateWorkspaces = async (newWorkspaces: Workspace[]) => {
    setWorkspaces(newWorkspaces);
    await window.electron.updateWorkspaceOrder(newWorkspaces);
  };

  const handleDeleteRequest = (id: string) => {
    const ws = workspaces.find(w => w.id === id);
    if (ws) setDeleteTarget({ id: ws.id, name: ws.name });
  };

  const confirmDelete = async () => {
    if (!deleteTarget) return;
    await window.electron.deleteWorkspace(deleteTarget.id);
    loadWorkspaces();
    setDeleteTarget(null);
  };

  const handleAddWorkspace = async (name: string, targetId: string, icon: string, color: string) => {
    await window.electron.createCustomWorkspace({ name, targetId, icon, color });
    loadWorkspaces();
  };

  const handleSync = async () => {
    setIsSyncing(true);
    try {
      await window.electron.triggerGoogleLogin();
      setRefreshSignal(prev => prev + 1);
    } catch (e) {
      console.error(e);
    } finally {
      setIsSyncing(false);
    }
  };

  // ✅ 取得當前 Workspace 的名稱，傳給 FileTree 當 Header
  const currentWs = workspaces.find(w => w.id === activeWorkspaceId);
  const currentWorkspaceName = currentWs 
    ? (currentWs.type === 'system' && currentWs.mode ? (t.sidebar.workspaces as any)[currentWs.mode] || currentWs.name : currentWs.name)
    : t.common.noContent;

  return (
    <div
      className={`
        relative h-full bg-sidebar-bg border-r border-sidebar-border flex flex-col shrink-0
        transition-all duration-300 ease-in-out
        ${isCollapsed ? 'w-0 border-r-0' : 'w-64'} 
      `}
    >
      <button
        onClick={() => setIsCollapsed(!isCollapsed)}
        className={`
          absolute top-1/2 -translate-y-1/2 flex items-center justify-center w-5 h-24  
          bg-sidebar-bg hover:bg-sidebar-hover text-sidebar-muted hover:text-sidebar-text
          border border-sidebar-border border-l-0 rounded-r-xl shadow-lg cursor-pointer z-50
          transition-all duration-300 -right-5
        `}
      >
        {isCollapsed ? <ChevronRight className="w-4 h-4" /> : <ChevronLeft className="w-4 h-4" />}
      </button>

      <div className={`w-64 h-full flex flex-col overflow-hidden ${isCollapsed ? 'opacity-0 invisible' : 'opacity-100 visible'} transition-opacity duration-200`}>

        <SidebarToolbar
          searchQuery={searchQuery}
          onSearch={setSearchQuery}
          onSortChange={(field, order) => { setSortBy(field); setSortOrder(order); }}
          onSync={handleSync}
          isSyncing={isSyncing}
        />

        <ModeSelector
          workspaces={workspaces}
          activeWorkspaceId={activeWorkspaceId}
          onSelect={handleSelectWorkspace}
          onUpdateList={handleUpdateWorkspaces}
          onDelete={handleDeleteRequest}
          onAddClick={() => setShowAddModal(true)}
        />

        {/* ✅ 標題列已移入 FileTree 內部，這裡只需傳入 rootName */}
        <div className="flex-1 overflow-hidden flex flex-col mt-2">
          <FileTree
            mode={activeMode}
            parentId={activeTargetId}
            searchQuery={searchQuery}
            sortBy={sortBy}
            sortOrder={sortOrder}
            onSelect={onFileSelect}
            onFileUpdate={onFileUpdate}
            rootName={currentWorkspaceName}
            refreshSignal={refreshSignal}
            workspaceId={activeWorkspaceId}
          />
        </div>

        <div className="p-2 border-t border-sidebar-border text-[10px] text-sidebar-muted opacity-80 text-center">
          Synapse v0.2
        </div>

      </div>

      <AddWorkspaceModal isOpen={showAddModal} onClose={() => setShowAddModal(false)} onSubmit={handleAddWorkspace} />
      <DeleteConfirmModal isOpen={!!deleteTarget} title={deleteTarget?.name || ''} onClose={() => setDeleteTarget(null)} onConfirm={confirmDelete} />
    </div>
  );
};

export default Sidebar;