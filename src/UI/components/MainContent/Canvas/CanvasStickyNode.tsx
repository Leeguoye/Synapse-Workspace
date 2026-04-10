/**
 * CanvasStickyNode - 便利貼節點
 * 亮色背景、無邊框、支援 fontSize、NodeResizer
 */
import React from 'react';
import { NodeResizer } from '@xyflow/react';
import type { NodeProps, Node } from '@xyflow/react';
import type { CanvasNodeData } from './canvasTypes';
import { DEFAULT_FONT_SIZE } from './canvasUtils';

const STICKY_COLORS: { bg: string; text: string }[] = [
  { bg: '#fef08a', text: '#713f12' }, // 黃
];


const CanvasStickyNode: React.FC<NodeProps<Node<CanvasNodeData>>> = ({ data, selected }) => {
  const colorIndex = typeof data.colorKey === 'string'
    ? parseInt(data.colorKey, 10) % STICKY_COLORS.length
    : 0;
  const { bg, text } = STICKY_COLORS[isNaN(colorIndex) ? 0 : colorIndex];
  // Use fontSize from data (set by property panel font size slider)
  const fontSize = (data.fontSize as number | undefined) ?? DEFAULT_FONT_SIZE;

  return (
    <div style={{
      width: '100%', height: '100%',
      background: bg, color: text,
      borderRadius: '2px',
      boxShadow: '3px 4px 12px rgba(0,0,0,0.25)',
      padding: '5px', fontSize, lineHeight: '1.5',
      whiteSpace: 'pre-wrap', wordBreak: 'break-word',
      fontFamily: 'inherit', position: 'relative',
    }}>
      <NodeResizer
        minWidth={50} minHeight={30} isVisible={selected}
        lineStyle={{ borderWidth: 1, borderStyle: 'dashed', borderColor: `${text}44` }}
        handleStyle={{ width: 6, height: 6, borderRadius: 1, background: text, border: 'none', opacity: 0.5 }}
      />
      {String(data.label ?? '')}
    </div>
  );
};

export default CanvasStickyNode;
