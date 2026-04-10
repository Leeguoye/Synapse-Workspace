/** Canvas 主入口 - 提供 ReactFlowProvider 包裝 */
import React from 'react';
import { ReactFlowProvider } from '@xyflow/react';
import type { DriveFile } from '../../../../shared/types';
import CanvasEditorContent from './CanvasEditorContent';

interface CanvasEditorProps {
  file: DriveFile;
  currentWorkspaceId: string;
  onFileSelect: (file: DriveFile) => void;
  theme: 'light' | 'dark' | 'warm' | 'eva' | 'miku';
}

const CanvasEditor: React.FC<CanvasEditorProps> = (props) => (
  <ReactFlowProvider>
    <CanvasEditorContent {...props} />
  </ReactFlowProvider>
);

export default CanvasEditor;
