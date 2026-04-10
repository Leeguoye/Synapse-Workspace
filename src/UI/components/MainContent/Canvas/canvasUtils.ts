/** Canvas 畫布工具函式 */
import type { Node, Edge, Connection } from '@xyflow/react';
import { addEdge } from '@xyflow/react';
import type {
  EdgeStyleVariant,
  EdgeRouteType,
  NodeShape,
  NodeColorTheme,
  CanvasEdgeData,
  CanvasNodeData,
  CustomColor,
} from './canvasTypes';
import { t } from '../../../../language';

/* ─────────────────────────────────────────────
   可調參數 (Tunable constants)
───────────────────────────────────────────── */
/** 對齊格線間距 (px)，可依需求調整 */
export const SNAP_GRID: [number, number] = [10, 10];
/** 預設字體大小 */
export const DEFAULT_FONT_SIZE = 14;

/* ─────────────────────────────────────────────
   Edge styles
───────────────────────────────────────────── */
export function getEdgeStyle(variant: EdgeStyleVariant, _animated: boolean, color = '#94a3b8', strokeWidth = 2): React.CSSProperties {
  const base: React.CSSProperties = { stroke: color, strokeWidth };
  if (variant === 'dashed') return { ...base, strokeDasharray: '8 4' };
  if (variant === 'dotted') return { ...base, strokeDasharray: '2 6', strokeLinecap: 'round' };
  return base;
}

export function buildEdge(
  params: Connection | Edge,
  style: EdgeStyleVariant,
  animated: boolean,
  existingEdges: Edge[],
  routeType: EdgeRouteType = 'default',
  color = '#94a3b8',
  strokeWidth = 2,
): Edge {
  const updated = addEdge({ ...params, animated }, existingEdges);
  const newEdge = updated[updated.length - 1];
  return {
    ...newEdge,
    type: routeType,
    style: getEdgeStyle(style, animated, color, strokeWidth),
    labelShowBg: false,
    labelStyle: { fill: '#ffffff', fontSize: 11 },
    data: { strokeStyle: style, animated, routeType, color, strokeWidth } as CanvasEdgeData,
  };
}

/* ─────────────────────────────────────────────
   Node color themes
───────────────────────────────────────────── */
export const NODE_COLOR_THEMES: Record<string, NodeColorTheme> = {
  slate: { label: t.canvas.panel.slate, bg: 'var(--color-theme-800)', border: 'var(--color-theme-600)', text: 'var(--color-theme-200)' },
  blue: { label: t.canvas.panel.blue, bg: '#1e3a5f', border: '#2563eb', text: '#bfdbfe' },
  green: { label: t.canvas.panel.green, bg: '#14311f', border: '#16a34a', text: '#86efac' },
  purple: { label: t.canvas.panel.purple, bg: '#2e1065', border: '#7c3aed', text: '#e9d5ff' },
  amber: { label: t.canvas.panel.amber, bg: '#431407', border: '#d97706', text: '#fde68a' },
  rose: { label: t.canvas.panel.red, bg: '#4c0519', border: '#e11d48', text: '#fecdd3' },
};

/* ─────────────────────────────────────────────
   Node shapes
───────────────────────────────────────────── */
export const NODE_SHAPES: { value: NodeShape }[] = [
  { value: 'rectangle' },
  { value: 'rounded' },
  { value: 'pill' },
  { value: 'circle' },
];

/** Inner div shape styles - no transform on wrapper */
export function getShapeInnerStyle(shape: NodeShape): React.CSSProperties {
  const base: React.CSSProperties = {
    width: '100%',
    height: '100%',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    padding: '10px 14px',
    textAlign: 'center',
    whiteSpace: 'pre-wrap',
    wordBreak: 'break-word',
    boxSizing: 'border-box',
    fontSize: '14px',
    lineHeight: '1.5',
    minWidth: 0,
  };
  switch (shape) {
    case 'rectangle': return { ...base, borderRadius: '0px' };
    case 'rounded': return { ...base, borderRadius: '8px' };
    case 'pill': return { ...base, borderRadius: '9999px', padding: '10px 22px' };
    case 'circle': return { ...base, borderRadius: '50%', padding: '12px' };
    default: return { ...base, borderRadius: '8px' };
  }
}

export function getNodeWrapperStyle(
  shape: NodeShape,
  bg: string,
  border: string,
  textColor: string,
): React.CSSProperties {
  return {
    background: bg,
    color: textColor,
    border: `1.5px solid ${border}`,
    boxShadow: '0 4px 12px rgba(0,0,0,0.4)',
    minWidth: shape === 'circle' ? 80 : 140,
    minHeight: shape === 'circle' ? 80 : undefined,
    fontSize: '14px',
    padding: 0,
    borderRadius: shape === 'circle' ? '50%'
      : shape === 'pill' ? '9999px'
        : shape === 'rounded' ? '8px'
          : '0px',
  };
}

/* ─────────────────────────────────────────────
   Resolve actual colors from node data
───────────────────────────────────────────── */
export function resolveNodeColors(data: CanvasNodeData): { bg: string; border: string; text: string } {
  if (data.customColor) {
    const cc = data.customColor as CustomColor;
    return { bg: cc.bg, border: cc.border, text: cc.text };
  }
  const theme = NODE_COLOR_THEMES[data.colorKey ?? 'slate'] ?? NODE_COLOR_THEMES.slate;
  return { bg: theme.bg, border: theme.border, text: theme.text };
}

/* ─────────────────────────────────────────────
   Factory: create shape node
───────────────────────────────────────────── */
export function makeTextNode(
  id: string,
  x: number,
  y: number,
  text = t.canvas.panel.doubleClickToEdit,
  shape: NodeShape = 'rounded',
  colorKey = 'slate',
): Node {
  const theme = NODE_COLOR_THEMES[colorKey] ?? NODE_COLOR_THEMES.slate;
  return {
    id,
    type: 'shapeNode',
    position: { x, y },
    data: { label: text, shape, colorKey } satisfies CanvasNodeData,
    style: getNodeWrapperStyle(shape, theme.bg, theme.border, theme.text),
  };
}

export function makeStickyNode(id: string, x: number, y: number): Node {
  return {
    id,
    type: 'stickyNode',
    position: { x, y },
    data: { label: t.canvas.panel.stickyNode } satisfies CanvasNodeData,
    style: { width: 180, minHeight: 120 },
  };
}

export function makeGroupNode(
  id: string,
  x: number,
  y: number,
  shape: NodeShape = 'rounded',
  colorKey = 'slate',
  w = 300,
  h = 200): Node {
  const theme = NODE_COLOR_THEMES[colorKey] ?? NODE_COLOR_THEMES.slate;
  return {
    id,
    type: 'groupNode',
    position: { x, y },
    data: { label: t.canvas.group.defaultName, shape, colorKey } satisfies CanvasNodeData,
    style: getNodeWrapperStyle(shape, theme.bg, theme.border, theme.text),
    width: w,
    height: h,
  };
}

/** Rebuild node style/data when shape or color changes */
export function applyNodeAppearance(node: Node, shape: NodeShape, colorKey: string): Partial<Node> {
  const data = node.data as CanvasNodeData;
  const { bg, border, text } = resolveNodeColors({ ...data, colorKey, customColor: undefined });
  return {
    data: { ...data, shape, colorKey, customColor: undefined } as CanvasNodeData,
    style: getNodeWrapperStyle(shape, bg, border, text),
  };
}

/** Apply custom RGBA color to node */
export function applyNodeCustomColor(node: Node, bg: string, border: string, text: string): Partial<Node> {
  const data = node.data as CanvasNodeData;
  const shape = (data.shape ?? 'rounded') as NodeShape;
  return {
    data: { ...data, customColor: { bg, border, text } } as CanvasNodeData,
    style: getNodeWrapperStyle(shape, bg, border, text),
  };
}
