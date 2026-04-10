/**
 * CanvasGroupNode - 群組母節點
 * 可包含子節點，拖拉邊角縮放，標題欄顯示群組名稱
 */
import React from 'react';
import { NodeResizer } from '@xyflow/react';
import type { NodeProps, Node } from '@xyflow/react';
import type { CanvasNodeData } from './canvasTypes';
import { resolveNodeColors, DEFAULT_FONT_SIZE } from './canvasUtils'; // 新增引入
import { t } from '../../../../language';

const CanvasGroupNode: React.FC<NodeProps<Node<CanvasNodeData>>> = ({ data, selected }) => {
  const label = String(data.label ?? t.canvas.group.defaultName);

  // 動態解析顏色與字體大小
  const { bg, border, text } = resolveNodeColors(data);
  const fontSize = (data.fontSize as number | undefined) ?? DEFAULT_FONT_SIZE;

  // 為了讓預設主題色在群組上呈現半透明，若無自訂顏色，我們可以在這裡調整預設透明度
  // 但由於您已支援 RGBA 自訂面板，這裡直接套用解析出的 bg (若使用者需要透明，可自己調 A 值)

  return (
    <div
      style={{
        width: '100%',
        height: '100%',
        background: bg, // 動態底色
        border: `1.5px ${selected ? 'solid' : 'dashed'} ${border}`, // 動態邊框色
        borderRadius: '10px',
        position: 'relative',
        transition: 'border-color 0.15s',
      }}
    >
      <NodeResizer
        minWidth={120}
        minHeight={80}
        isVisible={selected}
        lineStyle={{ borderWidth: 1, borderStyle: 'dashed', borderColor: border }}
        handleStyle={{ width: 6, height: 6, borderRadius: 1, background: border, border: 'none' }}
      />
      {/* Group title bar */}
      <div
        style={{
          position: 'absolute',
          top: 0,
          left: 0,
          right: 0,
          padding: '4px 10px',
          fontSize: `${fontSize}px`, // 動態字體大小
          fontWeight: 600,
          color: text,               // 動態字色
          borderBottom: `1px dashed ${border}`,
          background: 'rgba(0,0,0,0.1)', // 標題列微微加深以區分內容區
          borderRadius: '10px 10px 0 0',
          pointerEvents: 'none',
          userSelect: 'none',
        }}
      >
        {label}
      </div>
    </div>
  );
};

export default CanvasGroupNode;
