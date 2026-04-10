import React from 'react';
import { Handle, Position, NodeResizer } from '@xyflow/react';
import type { NodeProps, Node } from '@xyflow/react';
import type { CanvasNodeData, NodeShape, HandleVisibility } from './canvasTypes';
import { getShapeInnerStyle, resolveNodeColors, DEFAULT_FONT_SIZE } from './canvasUtils';

const DEFAULT_HANDLES: HandleVisibility = { top: true, bottom: true, left: true, right: true };

const HANDLE_STYLE: React.CSSProperties = {
  width: 8, height: 8,
  background: '#6366f1',
  border: '1.5px solid #818cf8',
  borderRadius: 2,
};

const CanvasShapeNode: React.FC<NodeProps<Node<CanvasNodeData>>> = ({ data, selected }) => {
  const shape = (data.shape ?? 'rounded') as NodeShape;
  const { text } = resolveNodeColors(data);
  const vis: HandleVisibility = { ...DEFAULT_HANDLES, ...(data.handles ?? {}) };
  const fontSize = (data.fontSize as number | undefined) ?? DEFAULT_FONT_SIZE;

  return (
    <>
      <NodeResizer
        minWidth={60} minHeight={36} isVisible={selected}
        lineStyle={{ borderWidth: 1, borderStyle: 'dashed', borderColor: '#818cf888' }}
        handleStyle={{ width: 6, height: 6, borderRadius: 1, background: '#6366f1', border: 'none' }}
      />
      {vis.top    && <Handle id="top"    type="source" position={Position.Top}    style={HANDLE_STYLE} />}
      {vis.bottom && <Handle id="bottom" type="source" position={Position.Bottom} style={HANDLE_STYLE} />}
      {vis.left   && <Handle id="left"   type="source" position={Position.Left}   style={HANDLE_STYLE} />}
      {vis.right  && <Handle id="right"  type="source" position={Position.Right}  style={HANDLE_STYLE} />}
      <div style={{ ...getShapeInnerStyle(shape), color: text, fontSize, position: 'relative' }}>
        {data.pipelineType && data.pipelineType !== 'none' && data.pipelineStatus && (
          <div 
            className={`absolute -top-3 -right-3 w-3 h-3 rounded-full shadow-md z-10 ${
              data.pipelineStatus === 'running' ? 'bg-blue-500 animate-pulse' : 
              data.pipelineStatus === 'success' ? 'bg-green-500' : 'bg-red-500'
            }`}
            title={Array.isArray(data.pipelineLogs) ? data.pipelineLogs.join('\n') : undefined}
          />
        )}
        {String(data.label ?? '')}
      </div>
    </>
  );
};

export default CanvasShapeNode;
