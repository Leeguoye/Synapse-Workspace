/** Canvas 工具列元件 (左側) */
import React from 'react';
import { Square, StickyNote, Grid2x2, Group, Puzzle } from 'lucide-react';
import { t } from '../../../../language';

interface CanvasToolbarProps {
  onAddTextNode: () => void;
  onAddStickyNode: () => void;
  onGroupSelected: () => void;
  snapEnabled: boolean;
  onToggleSnap: () => void;
  isLibraryOpen: boolean;
  onToggleLibrary: () => void;
  isAdvancedMode?: boolean;
  canvasMode: 'logic' | 'presentation';
}

const CanvasToolbar: React.FC<CanvasToolbarProps> = ({
  onAddTextNode,
  onAddStickyNode,
  onGroupSelected,
  snapEnabled,
  onToggleSnap,
  isLibraryOpen,
  onToggleLibrary,
  isAdvancedMode,
  canvasMode,
}) => (
  <div className="flex flex-col gap-0.5 bg-theme-900/95 border border-theme-700 rounded-xl p-1.5 shadow-xl backdrop-blur-sm">
    {canvasMode === 'logic' && isAdvancedMode && (
      <>
        <button
          title={t.canvas.library.title}
          onClick={onToggleLibrary}
          className={`p-2 rounded-lg transition-colors ${isLibraryOpen ? 'bg-primary-main/20 text-primary-main' : 'hover:bg-primary-main/10 text-theme-300 hover:text-primary-300'}`}
        >
          <Puzzle size={16} />
        </button>
        <div className="w-full h-px bg-theme-700/60 my-0.5" />
      </>
    )}
    <button
      title={t.canvas.toolbar.addNode}
      onClick={onAddTextNode}
      className="p-2 rounded-lg hover:bg-indigo-500/30 text-theme-300 hover:text-indigo-300 transition-colors"
    >
      <Square size={16} />
    </button>
    <button
      title={t.canvas.toolbar.addSticky}
      onClick={onAddStickyNode}
      className="p-2 rounded-lg hover:bg-yellow-500/20 text-theme-300 hover:text-yellow-300 transition-colors"
    >
      <StickyNote size={16} />
    </button>
    <button
      title={t.canvas.toolbar.groupSelected}
      onClick={onGroupSelected}
      className="p-2 rounded-lg hover:bg-purple-500/20 text-theme-300 hover:text-purple-300 transition-colors"
    >
      <Group size={16} />
    </button>
    <div className="w-full h-px bg-theme-700/60 my-0.5" />
    <button
      title={t.canvas.toolbar.snapToGrid}
      onClick={onToggleSnap}
      className={`p-2 rounded-lg transition-colors ${snapEnabled ? 'bg-indigo-500/30 text-indigo-300' : 'text-theme-500 hover:text-theme-300 hover:bg-theme-700/50'}`}
    >
      <Grid2x2 size={16} />
    </button>
  </div>
);

export default CanvasToolbar;
