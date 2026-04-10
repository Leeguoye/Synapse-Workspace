/** Canvas 屬性面板 - 節點/連線 選取後才顯示 */
import React, { useState, useRef, useCallback, useEffect } from 'react';
import { Layers, Trash2, Plus, Ungroup, PlayCircle, Puzzle } from 'lucide-react';
import type { Node, Edge } from '@xyflow/react';
import { t } from '../../../../language';
import {
  getEdgeStyle,
  NODE_COLOR_THEMES,
  NODE_SHAPES,
  applyNodeAppearance,
  applyNodeCustomColor,
  resolveNodeColors,
  DEFAULT_FONT_SIZE,
} from './canvasUtils';
import { resolvePluginLabel } from '../../../utils/pluginI18n';
import type {
  EdgeStyleVariant,
  EdgeRouteType,
  NodeShape,
  CanvasEdgeData,
  CanvasNodeData,
  HandleVisibility,
} from './canvasTypes';

/* ── Custom palette storage ── */
const CUSTOM_PALETTE_KEY = 'synapse_canvas_custom_palette'; // Changed to synapse while maintaining potential fallback if needed
interface PaletteEntry { id: string; label: string; bg: string; border: string; text: string }
function loadCustomPalette(): PaletteEntry[] {
  try { return JSON.parse(localStorage.getItem(CUSTOM_PALETTE_KEY) ?? '[]'); }
  catch { return []; }
}
function saveCustomPalette(entries: PaletteEntry[]) {
  localStorage.setItem(CUSTOM_PALETTE_KEY, JSON.stringify(entries));
}

interface CanvasPropertyPanelProps {
  selectedNode: Node | null;
  selectedEdge: Edge | null;
  onUpdateNode: (id: string, changes: Partial<Node>) => void;
  onUpdateEdge: (id: string, changes: Partial<Edge>) => void;
  onDeleteNode: (id: string) => void;
  onDeleteEdge: (id: string) => void;
  onUngroup: (id: string) => void;
  canvasMode?: 'logic' | 'presentation';
  isAdvancedMode?: boolean;
}

/* ── Shared CSS classes ── */
const panelBase = 'bg-theme-900/95 border border-theme-700 rounded-xl shadow-2xl text-theme-200 text-xs select-none backdrop-blur-sm overflow-y-auto max-h-[85vh]';
const sectionTitle = 'text-theme-400 uppercase tracking-widest text-[10px] font-semibold mb-1.5 mt-3 first:mt-0';
const btnBase = 'px-2 py-1 rounded-md border transition-colors text-xs';
const activeBtn = 'bg-primary-main border-primary-hover text-theme-50';
const inactiveBtn = 'bg-theme-800 border-theme-600 text-theme-300 hover:bg-theme-700';

/* ── Injected CSS to normalize all range inputs and remove colour adjusting outline ── */
export const PANEL_SLIDER_CSS = `
  .nexus-panel input[type=range] {
    -webkit-appearance: none;
    appearance: none;
    height: 4px;
    border-radius: 2px;
    background: #334155;
    outline: none;
    cursor: pointer;
  }
  .nexus-panel input[type=range]::-webkit-slider-thumb {
    -webkit-appearance: none;
    width: 10px; height: 10px;
    border-radius: 50%;
    cursor: pointer;
    border: none;
    background: var(--thumb-color, #6366f1);
  }
  .nexus-panel input[type=range]::-moz-range-thumb {
    width: 10px; height: 10px;
    border-radius: 50%;
    cursor: pointer;
    border: none;
    background: var(--thumb-color, #6366f1);
  }
  .nexus-canvas.color-picking .react-flow__resize-control {
    display: none !important;
  }
`;

/* ── Handle visibility ── */
const DEFAULT_HANDLES: HandleVisibility = { top: true, bottom: true, left: true, right: true };
const HANDLE_DIRS: { key: keyof HandleVisibility; label: string }[] = [
  { key: 'top', label: '↑' }, { key: 'bottom', label: '↓' },
  { key: 'left', label: '←' }, { key: 'right', label: '→' },
];

/* ── Shape icon SVGs ── */
const SHAPE_ICONS: Record<NodeShape, React.ReactNode> = {
  rectangle: <svg viewBox="0 0 20 14" width="20" height="14" fill="none" stroke="currentColor" strokeWidth="1.5"><rect x="1" y="1" width="18" height="12" rx="0" /></svg>,
  rounded: <svg viewBox="0 0 20 14" width="20" height="14" fill="none" stroke="currentColor" strokeWidth="1.5"><rect x="1" y="1" width="18" height="12" rx="3" /></svg>,
  pill: <svg viewBox="0 0 20 14" width="20" height="14" fill="none" stroke="currentColor" strokeWidth="1.5"><rect x="1" y="1" width="18" height="12" rx="6" /></svg>,
  circle: <svg viewBox="0 0 16 16" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="1.5"><circle cx="8" cy="8" r="7" /></svg>,
};

/* ── Edge routing icons ── */
const ROUTE_ICONS: { type: EdgeRouteType; label: string; icon: React.ReactNode }[] = [
  { type: 'default', label: t.canvas.edge.curve, icon: <svg viewBox="0 0 20 12" width="20" height="12" fill="none" stroke="currentColor" strokeWidth="1.5"><path d="M2 10 C6 2, 14 2, 18 10" /></svg> },
  { type: 'smoothstep', label: t.canvas.edge.round, icon: <svg viewBox="0 0 20 12" width="20" height="12" fill="none" stroke="currentColor" strokeWidth="1.5"><path d="M2 10 L2 4 Q2 2 4 2 L16 2 Q18 2 18 4 L18 10" /></svg> },
  { type: 'step', label: t.canvas.edge.edged, icon: <svg viewBox="0 0 20 12" width="20" height="12" fill="none" stroke="currentColor" strokeWidth="1.5"><path d="M2 10 L2 6 L18 6 L18 10" /></svg> },
  { type: 'straight', label: t.canvas.edge.straight, icon: <svg viewBox="0 0 20 12" width="20" height="12" fill="none" stroke="currentColor" strokeWidth="1.5"><line x1="2" y1="10" x2="18" y2="2" /></svg> },
];

/* ── Edge button 3+2 stage ── */
function applyEdgeButton(
  current: { style: EdgeStyleVariant; animated: boolean },
  clicked: EdgeStyleVariant,
): { style: EdgeStyleVariant; animated: boolean } {
  if (clicked === 'solid') return { style: 'solid', animated: false };
  if (current.style !== clicked) return { style: clicked, animated: false };
  return { style: clicked, animated: !current.animated };
}

/* ── RGBA helpers ── */
function clamp(v: number, lo = 0, hi = 255) { return Math.max(lo, Math.min(hi, Math.round(v))); }
function toRgba(r: number, g: number, b: number, a: number) {
  return `rgba(${clamp(r)},${clamp(g)},${clamp(b)},${Math.max(0, Math.min(1, a)).toFixed(2)})`;
}
function parseRgba(val: string): [number, number, number, number] {
  if (!val || val === 'transparent') return [255, 255, 255, 0]; // 支援透明底色解析
  const m = val.match(/rgba?\((\d+),\s*(\d+),\s*(\d+)(?:,\s*([\d.]+))?\)/);
  if (m) return [+m[1], +m[2], +m[3], m[4] !== undefined ? parseFloat(m[4]) : 1];
  const h = val.replace('#', '');
  if (h.length >= 6) {
    const n = parseInt(h.slice(0, 6), 16);
    return [(n >> 16) & 255, (n >> 8) & 255, n & 255, 1];
  }
  return [30, 41, 59, 1];
}

/* ── Unified RGBA Sliders ── */
const SLIDER_CHANNELS: { label: string; color: string; key: 'r' | 'g' | 'b' | 'a' }[] = [
  { label: 'R', color: '#ef4444', key: 'r' },
  { label: 'G', color: '#22c55e', key: 'g' },
  { label: 'B', color: '#3b82f6', key: 'b' },
  { label: 'A', color: '#a5b4fc', key: 'a' },
];

const RgbaSliders: React.FC<{
  r: number; g: number; b: number; a: number;
  onChange: (r: number, g: number, b: number, a: number) => void;
}> = ({ r, g, b, a, onChange }) => {
  const vals: Record<string, number> = { r, g, b, a };
  return (
    <div className="synapse-panel mt-1">
      {SLIDER_CHANNELS.map(({ label, color, key }) => {
        const isAlpha = key === 'a';
        const value = vals[key];
        const max = isAlpha ? 1 : 255;
        return (
          <div key={key} className="flex items-center gap-1.5 mb-1">
            <span className="text-[10px] text-theme-400 w-3 font-mono">{label}</span>
            <input
              type="range" min={0} max={max} step={isAlpha ? 0.05 : 1} value={value}
              style={{ '--thumb-color': color } as React.CSSProperties}
              onChange={(e) => {
                const v = parseFloat(e.target.value);
                onChange(key === 'r' ? v : r, key === 'g' ? v : g, key === 'b' ? v : b, key === 'a' ? v : a);
              }}
              className="flex-1"
            />
            <span className="text-[10px] text-theme-400 font-mono w-7 text-right">
              {isAlpha ? Math.round(value * 100) + '%' : Math.round(value)}
            </span>
          </div>
        );
      })}
    </div>
  );
};

/* ── Expandable Color Palette (reused by NodePanel, EdgePanel, GroupPanel) ── */
interface ColorPaletteProps {
  currentBg: string;
  currentBorder: string;
  currentText: string;
  colorKey?: string;
  shape?: NodeShape;
  showPresets?: boolean;
  targetLabels?: { bg: string, border: string, text: string };
  onApplyPreset?: (key: string) => void;
  onChange: (bg: string, border: string, text: string) => void;
  onPickerStateChange?: (open: boolean) => void;
}

const ColorPalettePanel: React.FC<ColorPaletteProps> = ({
  currentBg, currentBorder, currentText, colorKey, shape: _shape, showPresets = true,
  targetLabels, onApplyPreset, onChange, onPickerStateChange,
}) => {
  const [expanded, setExpanded] = useState(false);
  const [target, setTarget] = useState<'bg' | 'border' | 'text'>('bg');
  const [customPalette, setCustomPalette] = useState<PaletteEntry[]>(loadCustomPalette);

  const getTargetVal = (t2: 'bg' | 'border' | 'text') =>
    t2 === 'bg' ? currentBg : t2 === 'border' ? currentBorder : currentText;

  const [r, g, b, a] = parseRgba(getTargetVal(target));

  const toggleExpand = (v: boolean) => {
    setExpanded(v);
    onPickerStateChange?.(v);
  };

  const handleSlider = useCallback((nr: number, ng: number, nb: number, na: number) => {
    const rgba = toRgba(nr, ng, nb, na);
    const nextBg = target === 'bg' ? rgba : currentBg;
    const nextBr = target === 'border' ? rgba : currentBorder;
    const nextTx = target === 'text' ? rgba : currentText;
    onChange(nextBg, nextBr, nextTx);
  }, [target, currentBg, currentBorder, currentText, onChange]);

  const handleTargetChange = (t2: 'bg' | 'border' | 'text') => setTarget(t2);

  const handleAddToPalette = () => {
    const entry: PaletteEntry = {
      id: `c-${Date.now()}`,
      label: `+ ${customPalette.length + 1}`,
      bg: currentBg, border: currentBorder, text: currentText,
    };
    const next = [...customPalette, entry];
    setCustomPalette(next);
    saveCustomPalette(next);
  };

  const previewColor = toRgba(r, g, b, a);

  return (
    <div>
      <div className="flex flex-wrap gap-1 mb-1 items-center">
        {/* 僅控制預設主題的顯示 */}
        {showPresets && Object.entries(NODE_COLOR_THEMES).map(([key, theme]) => (
          <button key={key} title={theme.label}
            className={`w-5 h-5 rounded-full border-2 transition-transform hover:scale-110 ${colorKey === key ? 'border-theme-50 scale-110' : 'border-theme-600'}`}
            style={{ backgroundColor: theme.border }}
            onClick={() => {
              onChange(theme.bg, theme.border, theme.text);
              onApplyPreset?.(key);
            }}
          />
        ))}

        {/* 自訂顏色與展開按鈕：無條件顯示 */}
        {customPalette.map(entry => (
          <div key={entry.id} className="relative group">
            <button title={entry.label}
              className="w-5 h-5 rounded-full border-2 border-dashed border-theme-500 hover:scale-110 transition-transform"
              style={{ backgroundColor: entry.border }}
              onClick={() => onChange(entry.bg, entry.border, entry.text)}
            />
            <button
              className="absolute -top-1 -right-1 hidden group-hover:flex w-3 h-3 rounded-full bg-danger-main text-theme-50 items-center justify-center text-[8px] leading-none"
              onClick={(e) => {
                e.stopPropagation();
                const next = customPalette.filter(c => c.id !== entry.id);
                setCustomPalette(next);
                saveCustomPalette(next);
              }}
            ></button>
          </div>
        ))}
        <button title={t.canvas.panel.addCustomColor}
          className={`w-5 h-5 rounded-full border-2 border-dashed flex items-center justify-center transition-colors ${expanded ? 'border-primary-main text-primary-main' : 'border-theme-500 text-theme-500 hover:border-theme-300 hover:text-theme-300'}`}
          onClick={() => toggleExpand(!expanded)}
        ><Plus size={9} /></button>
      </div>

      {expanded && (
        <div className="rounded-lg bg-theme-800 border border-theme-700 p-2 mb-1">
          {/* Target selector */}
          <div className="flex gap-0.5 mb-2">
            {(['bg', 'border', 'text'] as const).map((k) => (
              <button key={k}
                className={`${btnBase} flex-1 text-[10px] px-0.5 ${target === k ? activeBtn : inactiveBtn}`}
                onClick={() => handleTargetChange(k)}
              >
                {targetLabels ? targetLabels[k] : (k === 'bg' ? t.canvas.panel.backgroundColor : k === 'border' ? t.canvas.panel.borderColor : t.canvas.panel.textColor)}
              </button>
            ))}
          </div>
          {/* Preview swatch */}
          <div className="h-4 rounded-sm border border-theme-600 mb-2" style={{ background: previewColor }} />
          {/* Unified RGBA sliders */}
          <RgbaSliders r={r} g={g} b={b} a={a} onChange={handleSlider} />
          <button className={`${btnBase} w-full mt-2 ${activeBtn} text-[10px]`} onClick={handleAddToPalette}>
            ＋ {t.canvas.panel.saveTopalette}
          </button>
        </div>
      )}
    </div>
  );
};

/* ── NodePanel ── */
const NodePanel: React.FC<{
  node: Node;
  isGroup: boolean;
  onUpdate: (changes: Partial<Node>) => void;
  onUngroup: () => void;
  onPickerOpen: (open: boolean) => void;
  canvasMode?: 'logic' | 'presentation';
  isAdvancedMode?: boolean;
}> = ({ node, isGroup, onUpdate, onUngroup, onPickerOpen, canvasMode = 'logic', isAdvancedMode = false }) => {
  const data = node.data as CanvasNodeData;
  const isSticky = node.type === 'stickyNode';
  const isResource = node.type === 'resourceNode';

  const currentShape = (data.shape ?? 'rounded') as NodeShape;
  const currentColorKey = data.colorKey ?? 'slate';

  const [editingLabel, setEditingLabel] = useState(String(data.label ?? ''));
  const prevId = useRef<string | null>(null);
  if (node.id !== prevId.current) { prevId.current = node.id; setEditingLabel(String(data.label ?? '')); }

  const resolved = resolveNodeColors(data);
  const handles: HandleVisibility = { ...DEFAULT_HANDLES, ...(data.handles ?? {}) };
  const fontSize = (data.fontSize as number | undefined) ?? DEFAULT_FONT_SIZE;

  const applyColor = useCallback((bg: string, border: string, text: string) => {
    onUpdate(applyNodeCustomColor(node, bg, border, text));
  }, [node, onUpdate]);

  // Ensure color-picking class is cleaned up when node changes / panel unmounts
  const canvasRef = useCallback((open: boolean) => {
    const canvas = document.querySelector('.synapse-canvas');
    if (canvas) canvas.classList.toggle('color-picking', open);
    // also propagate up
    onPickerOpen(open);
  }, [onPickerOpen]);

  return (
    <>
      <p className={sectionTitle}>{t.canvas.panel.nodeSection}</p>

      {isGroup && (
        <button
          className={`${btnBase} w-full mb-2 flex items-center justify-center gap-1.5 bg-purple-900/30 border-purple-700 text-purple-300 hover:bg-purple-800/40`}
          onClick={onUngroup}
          title={t.canvas.group.ungroupTitle}
        >
          <Ungroup size={12} /> {t.canvas.group.ungroup}
        </button>
      )}

      {/* Text label */}
      {!isResource && (
        <>
          <label className="block mb-0.5 text-theme-400">{t.canvas.panel.textContent}</label>
          <textarea
            className="w-full bg-theme-800 border border-theme-600 rounded-md px-2 py-1 text-xs text-theme-100 resize-none focus:outline-none focus:border-primary-main mb-2"
            rows={3} value={editingLabel}
            onChange={(e) => setEditingLabel(e.target.value)}
            onBlur={() => onUpdate({ data: { ...data, label: editingLabel } as CanvasNodeData })}
          />
        </>
      )}

      {/* Shape – not for sticky/group/resource */}
      {!isSticky && !isGroup && !isResource && (
        <>
          <label className="block mb-0.5 text-theme-400">{t.canvas.panel.shape}</label>
          <div className="flex gap-1 mb-2">
            {NODE_SHAPES.map(({ value }) => (
              <button key={value} title={value}
                className={`${btnBase} flex-1 flex items-center justify-center p-1.5 ${currentShape === value ? activeBtn : inactiveBtn}`}
                onClick={() => onUpdate(applyNodeAppearance(node, value, currentColorKey))}
              >{SHAPE_ICONS[value]}</button>
            ))}
          </div>
        </>
      )}

      {/* Font size – for text shapes AND sticky notes (not resource) */}
      {!isResource && (
        <>
          <label className="block mb-0.5 text-theme-400">{t.canvas.panel.fontSize} ({fontSize}px)</label>
          <div className="synapse-panel mb-2">
            <input
              type="range" min={9} max={36} step={1} value={fontSize}
              style={{ '--thumb-color': '#6366f1' } as React.CSSProperties}
              onChange={(e) => onUpdate({ data: { ...data, fontSize: +e.target.value } as CanvasNodeData })}
              className="w-full"
            />
          </div>
        </>
      )}

      {/* Color – shape nodes and groups only (not sticky, not resource; sticky uses fixed palette) */}

      {!isSticky && !isResource && (
        <>
          <label className="block mb-0.5 text-theme-400">{t.canvas.panel.color}</label>
          <ColorPalettePanel
            currentBg={resolved.bg}
            currentBorder={resolved.border}
            currentText={resolved.text}
            colorKey={!data.customColor ? currentColorKey : undefined}
            shape={currentShape}
            // showPresets={!isGroup}
            onApplyPreset={(key) => onUpdate(applyNodeAppearance(node, currentShape, key))}
            onChange={applyColor}
            onPickerStateChange={canvasRef}
          />
        </>
      )}

      {/* Handles – only for shape nodes (not for plugins) */}
      {!isSticky && !isGroup && !isResource && !data.nodePluginId && (
        <>
          <label className="block mb-0.5 mt-2 text-theme-400">{t.canvas.panel.handles}</label>
          <div className="flex gap-1 mb-1">
            {HANDLE_DIRS.map(({ key, label }) => (
              <button key={key} title={key}
                className={`${btnBase} flex-1 text-center font-mono ${handles[key] ? activeBtn : inactiveBtn}`}
                onClick={() => onUpdate({ data: { ...data, handles: { ...handles, [key]: !handles[key] } } as CanvasNodeData })}
              >{label}</button>
            ))}
          </div>
        </>
      )}

      {/* Pipeline Type Switch - Only in logic mode AND Advanced mode */}
      {canvasMode === 'logic' && isAdvancedMode && (
        <>
          <div className="h-px bg-theme-700 my-4" />
          <label className="block mb-1 text-theme-400 flex items-center gap-1.5">
            <PlayCircle size={12} className="text-primary-main" />
            {t.canvas.panel.pipelineType}
          </label>
          <select
            className="w-full bg-theme-800 border border-theme-600 rounded-md px-2 py-1.5 text-xs text-theme-100 focus:outline-none focus:border-primary-main mb-2"
            value={data.pipelineType || 'none'}
            onChange={(e) => onUpdate({ data: { ...data, pipelineType: e.target.value } as CanvasNodeData })}
          >
            <option value="none">{t.canvas.panel.none}</option>
            <option value="python">{t.canvas.panel.python}</option>
            <option value="javascript">{t.canvas.panel.javascript}</option>
          </select>

          {data.pipelineType && data.pipelineType !== 'none' && (
            <>
              <label className="block mb-1 text-theme-400">{t.canvas.panel.pipelineScript}</label>
              <textarea
                className="w-full bg-theme-900 border border-theme-600 rounded-md px-2 py-1.5 text-[10px] font-mono text-primary-200 resize-none focus:outline-none focus:border-primary-main h-24 mb-2"
                placeholder="# Input data is in contextData variable\n# Example: print(contextData['prev_node_id'])"
                value={data.pipelineScript || ''}
                onChange={(e) => onUpdate({ data: { ...data, pipelineScript: e.target.value } as CanvasNodeData })}
              />
            </>
          )}
        </>
      )}

      {/* Visibility Toggle - Only in Logic Mode */}
      {canvasMode === 'logic' && (
        <div className="mt-3 flex items-center justify-between border-t border-theme-700 pt-3">
          <label className="text-theme-300 font-medium text-[10px]">{t.canvas.panel.visibleInPresentation}</label>
          <button
            className={`${btnBase} px-2 py-1 rounded border transition-all text-[10px] ${data.isVisibleInPresentation ? 'bg-primary-main/20 border-primary-500 text-primary-200' : 'bg-theme-800 border-theme-600 text-theme-500'}`}
            onClick={() => onUpdate({ data: { ...data, isVisibleInPresentation: !data.isVisibleInPresentation } as CanvasNodeData })}
          >
            {data.isVisibleInPresentation ? t.canvas.panel.visible : t.canvas.panel.hidden}
          </button>
        </div>
      )}

      {/* Plugin Configuration (Phase D-4) - Always show in Logic Mode */}
      {data.nodePluginId && canvasMode === 'logic' && (
        <PluginConfigSection 
          pluginId={data.nodePluginId} 
          nodeType={data.nodeType || ''}
          config={data.nodeInputConfig || {}}
          onUpdateConfig={(newConfig) => onUpdate({ data: { ...data, nodeInputConfig: newConfig } as CanvasNodeData })}
        />
      )}
    </>
  );
};

/** 插件節點專用的配置區塊 */
const PluginConfigSection: React.FC<{
  pluginId: string;
  nodeType: string;
  config: Record<string, any>;
  onUpdateConfig: (conf: Record<string, any>) => void;
}> = ({ pluginId, nodeType, config, onUpdateConfig }) => {
  const [manifest, setManifest] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!pluginId) return;
    const fetchManifest = async () => {
      setLoading(true);
      setError(null);
      // 分解 ID: com.test.plugin::node-type -> [com.test.plugin, node-type]
      const parts = pluginId.split('::');
      const pId = parts[0];
      const nType = parts[1] || nodeType;

      console.log(`[PluginConfig] Fetching manifestation for: Plugin=${pId}, Type=${nType}`);
      try {
        const m = await (window as any).api?.plugins?.getNodeManifest(pId, nType);
        if (m) {
          setManifest(m);
        } else {
          setError(`${t.canvas.panel.manifestNotFound}: ${pluginId}`);
        }
      } catch (err) {
        console.error('Failed to fetch node manifest:', err);
        setError(t.canvas.panel.manifestLoadError);
      } finally {
        setLoading(false);
      }
    };
    fetchManifest();
  }, [pluginId, nodeType, t]);

  const handleChange = (key: string, value: any) => {
    console.log(`[PluginConfig] Updating ${key} -> ${value}`);
    onUpdateConfig({ ...config, [key]: value });
  };

  if (loading) return <div className="p-4 text-xs text-theme-500 animate-pulse">{t.canvas.panel.loadingManifest}</div>;
  if (error) return <div className="p-4 text-xs text-red-400 bg-red-400/10 rounded-lg">{error}</div>;
  if (!manifest) return null;

  return (
    <div className="mt-4 pt-4 border-t border-theme-700">
      <p className="text-primary-400 uppercase tracking-widest text-[10px] font-bold mb-2 flex items-center gap-1">
        <Puzzle size={10} />
        {t.canvas.panel.nodeInputConfig || '插件配置'}
      </p>
      
      {manifest.inputs?.map((input: any) => (
        <div key={input.key} className="mb-3">
          <label className="block mb-1 text-theme-400 text-[10px] flex justify-between items-center">
            <span className="font-medium">{resolvePluginLabel(input.label || input.key)}</span>
            {input.required && <span className="text-red-500/80 text-[8px] scale-90">REQUIRED</span>}
          </label>
          
          {input.type === 'boolean' ? (
            <button 
              className={`${btnBase} w-full text-left py-1.5 flex justify-between items-center ${config[input.key] ? activeBtn : inactiveBtn}`}
              onClick={() => handleChange(input.key, !config[input.key])}
            >
              <span>{config[input.key] ? 'Enabled' : 'Disabled'}</span>
              <div className={`w-1.5 h-1.5 rounded-full ${config[input.key] ? 'bg-white animate-pulse' : 'bg-theme-500'}`} />
            </button>
          ) : input.options && input.options.length > 0 ? (
            <select
              className="w-full bg-theme-900 border border-theme-700 rounded-md px-2 py-1.5 text-[10px] text-theme-100 focus:outline-none focus:border-primary-main cursor-pointer"
              value={config[input.key] ?? input.default ?? ''}
              onChange={(e) => handleChange(input.key, e.target.value)}
            >
              {!input.required && <option value="">— Select —</option>}
              {input.options.map((opt: string) => (
                <option key={opt} value={opt}>{opt}</option>
              ))}
            </select>
          ) : (
            <input 
              type={input.type === 'number' ? 'number' : 'text'}
              className="w-full bg-theme-900 border border-theme-700 rounded-md px-2 py-1.5 text-[10px] text-theme-100 focus:outline-none focus:border-primary-main placeholder:text-theme-600"
              value={config[input.key] ?? (input.default !== undefined ? input.default : '')}
              onChange={(e) => handleChange(input.key, input.type === 'number' ? Number(e.target.value) : e.target.value)}
              placeholder={resolvePluginLabel(input.description || `Enter ${input.key}...`)}
            />
          )}
        </div>
      ))}
      
      <p className="text-[9px] text-theme-500 italic mt-1">
        ID: {pluginId}::{nodeType}
      </p>
    </div>
  );
};

/* ── EdgePanel ── */
const EdgePanel: React.FC<{
  edge: Edge;
  onUpdate: (changes: Partial<Edge>) => void;
  onPickerOpen: (open: boolean) => void;
}> = ({ edge, onUpdate, onPickerOpen }) => {
  const edgeData = edge.data as CanvasEdgeData;
  const current = { style: (edgeData?.strokeStyle ?? 'solid') as EdgeStyleVariant, animated: !!edge.animated };
  const routeType = (edgeData?.routeType ?? 'default') as EdgeRouteType;
  const edgeColor = edgeData?.color ?? '#94a3b8';
  const edgeWidth = (edgeData?.strokeWidth as number | undefined) ?? 2;

  // 提取標籤相關顏色，若無則給定預設值
  const labelColor = (edgeData?.labelColor as string) ?? '#ffffff';
  const labelBgColor = (edgeData?.labelBgColor as string) ?? 'transparent';

  const [edgeLabel, setEdgeLabel] = useState(typeof edge.label === 'string' ? edge.label : '');

  // 更新邏輯同時套用 3 種顏色維度
  const applyEdgeStyle = (style: EdgeStyleVariant, animated: boolean, color: string, width: number, lColor: string, lBgColor: string) => {
    const isTransparent = lBgColor === 'transparent' || lBgColor.includes(',0.00)');
    onUpdate({
      animated,
      style: getEdgeStyle(style, animated, color, width),
      labelStyle: { fill: lColor, fontSize: 11 },
      labelShowBg: !isTransparent,
      labelBgStyle: { fill: lBgColor },
      data: { ...edgeData, strokeStyle: style, animated, color, strokeWidth: width, labelColor: lColor, labelBgColor: lBgColor } as CanvasEdgeData,
    });
  };

  const handleStyleBtn = (style: EdgeStyleVariant) => {
    const next = applyEdgeButton(current, style);
    applyEdgeStyle(next.style, next.animated, edgeColor, edgeWidth, labelColor, labelBgColor);
  };

  const handleRoute = (rt: EdgeRouteType) => onUpdate({ type: rt, data: { ...edgeData, routeType: rt } as CanvasEdgeData });

  const handleColorChange = (bg: string, border: string, text: string) => {
    // bg對應字底色, border對應線條色, text對應字色
    applyEdgeStyle(current.style, current.animated, border, edgeWidth, text, bg);
  };

  const handleWidthChange = (w: number) => applyEdgeStyle(current.style, current.animated, edgeColor, w, labelColor, labelBgColor);

  return (
    <>
      <p className={sectionTitle}>{t.canvas.panel.edgeSection}</p>

      {/* Route type */}
      <label className="block mb-0.5 text-theme-400">{t.canvas.edge.pathType}</label>
      <div className="flex gap-1 mb-2">
        {ROUTE_ICONS.map(({ type, label, icon }) => (
          <button key={type} title={label} className={`${btnBase} flex-1 flex items-center justify-center p-1.5 ${routeType === type ? activeBtn : inactiveBtn}`} onClick={() => handleRoute(type)}>{icon}</button>
        ))}
      </div>

      {/* Stroke style */}
      <label className="block mb-0.5 text-theme-400">{t.canvas.panel.edgeStyle}</label>
      <div className="flex gap-1 mb-2">
        <button className={`${btnBase} flex-1 ${current.style === 'solid' ? activeBtn : inactiveBtn}`} onClick={() => handleStyleBtn('solid')}>{t.canvas.edge.solid}</button>
        <button className={`${btnBase} flex-1 ${current.style === 'dashed' ? activeBtn : inactiveBtn}`} onClick={() => handleStyleBtn('dashed')}>{current.style === 'dashed' && current.animated ? t.canvas.edge.dashedAndAnimated : t.canvas.edge.dashed}</button>
        <button className={`${btnBase} flex-1 ${current.style === 'dotted' ? activeBtn : inactiveBtn}`} onClick={() => handleStyleBtn('dotted')}>{current.style === 'dotted' && current.animated ? t.canvas.edge.dottedAndAnimated : t.canvas.edge.dotted}</button>
      </div>

      {/* Edge & Label colors (多維度面板) */}
      <label className="block mb-0.5 text-theme-400">{t.canvas.edge.edgeColor}</label>
      <ColorPalettePanel
        currentBg={labelBgColor === 'transparent' ? 'rgba(0,0,0,0)' : labelBgColor}
        currentBorder={edgeColor}
        currentText={labelColor}
        targetLabels={{ bg: t.canvas.panel.backgroundColor, border: t.canvas.panel.borderColor, text: t.canvas.panel.textColor }}
        showPresets={true} onChange={handleColorChange} onPickerStateChange={onPickerOpen}
      />

      {/* Stroke width */}
      <label className="block mb-0.5 mt-2 text-theme-400">{t.canvas.edge.edgeWidth} ({edgeWidth}px)</label>
      <div className="synapse-panel mb-2">
        <input type="range" min={1} max={8} step={0.5} value={edgeWidth} style={{ '--thumb-color': '#6366f1' } as React.CSSProperties} onChange={(e) => handleWidthChange(parseFloat(e.target.value))} className="w-full" />
      </div>

      {/* Edge label */}
      <label className="block mb-0.5 text-theme-400">{t.canvas.edge.edgeLabel}</label>
      <input className="w-full bg-theme-800 border border-theme-600 rounded-md px-2 py-1 text-xs text-theme-100 focus:outline-none focus:border-primary-main mb-1" value={edgeLabel} placeholder={t.canvas.edge.edgeLabelPlaceholder} onChange={(e) => setEdgeLabel(e.target.value)} onBlur={() => onUpdate({ label: edgeLabel || undefined })} />
    </>
  );
};

/* ── Main panel ── */
const CanvasPropertyPanel: React.FC<CanvasPropertyPanelProps> = ({
  selectedNode, selectedEdge, onUpdateNode, onUpdateEdge, onDeleteNode, onDeleteEdge, onUngroup, 
  canvasMode = 'logic', isAdvancedMode = false,
}) => {
  if (!selectedNode && !selectedEdge) return null;
  const isGroup = selectedNode?.type === 'groupNode';

  const handleDelete = () => {
    if (selectedNode) onDeleteNode(selectedNode.id);
    else if (selectedEdge) onDeleteEdge(selectedEdge.id);
  };

  const [pickerOpen, setPickerOpen] = useState(false);

  // 1. 監聽選取對象切換：當切換選擇其他節點/線條時，強制關閉顏色面板並恢復 Resizer
  useEffect(() => {
    setPickerOpen(false);
    const canvas = document.querySelector('.synapse-canvas');
    if (canvas) canvas.classList.remove('color-picking');
  }, [selectedNode?.id, selectedEdge?.id]); // 依賴於目標 ID

  // 2. 監聽面板完全卸載：當點擊畫布空白處，面板消失時恢復 Resizer
  useEffect(() => {
    return () => {
      const canvas = document.querySelector('.synapse-canvas');
      if (canvas) canvas.classList.remove('color-picking');
    };
  }, []);

  // Toggle synapse-canvas class for resizer hiding
  const handlePickerState = useCallback((open: boolean) => {
    setPickerOpen(open);
    const canvas = document.querySelector('.synapse-canvas');
    if (canvas) canvas.classList.toggle('color-picking', open);
  }, []);

  return (
    <div className={`${panelBase} w-52 p-3`} style={{ outline: pickerOpen ? '1px solid #6366f144' : 'none' }}>
      <div className="flex items-center justify-between mb-2">
        <p className="font-semibold text-[11px] text-theme-300 flex items-center gap-1.5">
          <Layers size={12} className="text-primary-main" />
          {t.canvas.panel.title}
        </p>
        <button title={t.canvas.panel.deleteNode} onClick={handleDelete}
          className="p-1 rounded-md text-theme-500 hover:text-danger-main hover:bg-danger-hover transition-colors">
          <Trash2 size={13} />
        </button>
      </div>

      {selectedNode && (
        <NodePanel
          node={selectedNode} isGroup={isGroup}
          onUpdate={(c) => onUpdateNode(selectedNode.id, c)}
          onUngroup={() => onUngroup(selectedNode.id)}
          onPickerOpen={handlePickerState}
          canvasMode={canvasMode}
          isAdvancedMode={isAdvancedMode}
        />
      )}
      {selectedEdge && !selectedNode && (
        <EdgePanel edge={selectedEdge} onUpdate={(c) => onUpdateEdge(selectedEdge.id, c)} onPickerOpen={handlePickerState} />
      )}
    </div>
  );
};

export default CanvasPropertyPanel;
