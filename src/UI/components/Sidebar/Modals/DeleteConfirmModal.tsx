import React from 'react';
import { AlertTriangle, Trash2 } from 'lucide-react';
import { t } from '../../../../language';

interface DeleteConfirmModalProps {
  isOpen: boolean;
  title: string;
  onClose: () => void;
  onConfirm: () => void;
  mode?: 'workspace' | 'file'; // 新增模式切換
}

const DeleteConfirmModal: React.FC<DeleteConfirmModalProps> = ({ 
  isOpen, title, onClose, onConfirm, mode = 'workspace' 
}) => {
  if (!isOpen) return null;

  const isFile = mode === 'file';

  return (
    <div className="fixed inset-0 bg-theme-950/60 backdrop-blur-sm z-100 flex items-center justify-center p-4 animate-in fade-in duration-200">
      <div className="bg-theme-900 border border-danger-border rounded-xl shadow-2xl w-96 overflow-hidden">
        
        <div className="p-6 text-center space-y-4">
          <div className="w-12 h-12 bg-danger-bg rounded-full flex items-center justify-center mx-auto">
            <AlertTriangle className="w-6 h-6 text-danger-text" />
          </div>
          
          <div className="space-y-1">
            <h3 className="text-lg font-bold text-theme-50">
              {isFile ? t.sidebar.moveFileToTrashConfirm : t.sidebar.deleteWorkspaceTitle}
            </h3>
            <p className="text-sm text-theme-400">
              {t.sidebar.deleteConfirmPrefix}
              <span className="text-theme-100 font-medium">"{title}"</span>
              {t.sidebar.deleteConfirmSuffix}
            </p>
            <p className="text-xs text-theme-500">
              {isFile 
                ? t.sidebar.fileMoveToTrashNote 
                : t.sidebar.workspaceDeleteNote}
            </p>
          </div>
        </div>

        <div className="flex border-t border-theme-800">
          <button 
            onClick={onClose}
            className="flex-1 py-3 text-sm text-theme-400 hover:bg-theme-800 transition-colors"
          >
            {t.common.cancel}
          </button>
          <div className="w-px bg-theme-800" />
          <button 
            onClick={() => { onConfirm(); onClose(); }}
            className="flex-1 py-3 text-sm text-danger-text hover:bg-danger-hover hover:text-danger-hover-text transition-colors font-medium flex items-center justify-center gap-2"
          >
            <Trash2 className="w-4 h-4" />
            {t.common.confirm}
          </button>
        </div>

      </div>
    </div>
  );
};

export default DeleteConfirmModal;