/**
 * CanvasPluginNode — Blender 風格的插件節點元件
 * 根據 PortSchema 動態渲染 input/output handles 與 inline 輸入框
 * (Plugin node with Blender-style dynamic ports based on PortSchema)
 */
import React, { useMemo, useCallback } from 'react';
import { Handle, Position, useEdges, NodeResizer } from '@xyflow/react';
import type { NodeProps, Node, Edge } from '@xyflow/react';
import type { CanvasNodeData, PortSchema } from './canvasTypes';
import { Puzzle, icons as LucideIcons, RefreshCw, Globe, Play, BarChart3 } from 'lucide-react';
import ReactECharts from 'echarts-for-react';
import { resolvePluginLabel } from '../../../utils/pluginI18n';

// ─── Icon Renderer ────────────────────────────────────────────────────────────
function renderIcon(icon?: string, size = 12): React.ReactNode {
  if (!icon) return <Puzzle size={size} />;
  // 僅支援 Lucide 圖示系列 (Strictly Lucide icons)
  const Comp = (LucideIcons as Record<string, React.FC<{ size?: number }>>)[icon];
  return Comp ? <Comp size={size} /> : <Puzzle size={size} />;
}

// ─── Port Input Widget ────────────────────────────────────────────────────────
interface PortWidgetProps {
  port: PortSchema;
  value: unknown;
  onChange: (key: string, val: unknown) => void;
}

const PortWidget: React.FC<PortWidgetProps> = ({ port, value, onChange }) => {
  const str = value !== undefined && value !== null ? String(value) : '';

  if (port.type === 'boolean') {
    return (
      <input
        type="checkbox"
        checked={!!value}
        onChange={e => onChange(port.key, e.target.checked)}
        className="w-3 h-3 accent-primary-main cursor-pointer"
        title={port.description}
      />
    );
  }

  if (port.options && port.options.length > 0) {
    return (
      <select
        value={str}
        onChange={e => onChange(port.key, e.target.value)}
        className="flex-1 min-w-0 bg-black/30 border border-white/10 rounded px-1.5 py-0.5 text-[10px] text-white/80 focus:outline-none focus:border-white/30 cursor-pointer"
      >
        {!port.required && <option value="">—</option>}
        {port.options.map(o => <option key={o} value={o}>{o}</option>)}
      </select>
    );
  }

  const inputType = port.type === 'number' ? 'number' : 'text';
  return (
    <input
      type={inputType}
      value={str}
      placeholder={port.type === 'fileRef' ? 'Drop Drive file…' : (port.description ?? port.label)}
      onChange={e => onChange(port.key, e.target.value)}
      className="flex-1 min-w-0 bg-black/30 border border-white/10 rounded px-1.5 py-0.5 text-[10px] text-white/80 placeholder:text-white/25 focus:outline-none focus:border-white/30"
    />
  );
};

// ─── Node Value Display ────────────────────────────────────────────────────────
const NodeValueDisplay: React.FC<{ 
  nodeType: string; 
  config: Record<string, any>; 
  pipelineData?: any;
  accentColor: string;
}> = ({ nodeType, config, pipelineData, accentColor }) => {
  const hasResult = !!pipelineData;

  // ─── Arithmetic ───
  if (nodeType === 'arithmetic') {
    const op = config.operator || '+';
    const opMap: Record<string, string> = { '+': '+', '-': '-', '*': '×', '/': '÷', '%': '%', 'floor': '⌊⌋', 'ceil': '⌈⌉' };
    const result = pipelineData?.result;

    return (
      <div className="flex flex-col items-center py-2 group-hover:brightness-125 transition-all">
        <div className={`font-bold transition-all ${hasResult ? 'text-[10px] opacity-40' : 'text-xl opacity-80'}`} style={{ color: accentColor }}>
          {opMap[op] || op}
        </div>
        {hasResult && (
          <div className="text-lg font-black text-theme-100 animate-in zoom-in-50 duration-300">
            {result !== undefined ? result : '?'}
          </div>
        )}
      </div>
    );
  }

  // ─── Text Output (Log) ───
  if (nodeType === 'text-output') {
    const text = pipelineData?.text;
    return (
      <div className="px-3 py-2">
        <div className="bg-black/40 rounded border border-white/5 p-1.5 min-h-[40px] max-h-[80px] overflow-y-auto custom-scrollbar">
          {hasResult ? (
            <div className="text-[10px] text-theme-100 break-words leading-relaxed animate-in fade-in duration-500">
              {text}
            </div>
          ) : (
            <div className="text-[10px] text-white/20 italic text-center mt-2">Waiting...</div>
          )}
        </div>
      </div>
    );
  }

  // ─── Random ───
  if (nodeType === 'random') {
    const min = config.min ?? 0;
    const max = config.max ?? 100;
    const value = pipelineData?.value;

    return (
      <div className="px-3 py-2 text-center text-[10px]">
        <div className="text-white/30 lowercase tracking-widest font-bold mb-1">
          {min} .. {max}
        </div>
        {hasResult && (
          <div className="text-xl font-black text-theme-100 animate-in slide-in-from-top-2">
            {value}
          </div>
        )}
      </div>
    );
  }

  // ─── General Inputs ───
  if (nodeType === 'number-input' || nodeType === 'text-input' || nodeType === 'boolean-input') {
    if (!hasResult) return null;
    const val = pipelineData.value ?? pipelineData.text;
    return (
      <div className="px-3 pb-2 -mt-1 text-right">
        <span className="text-[9px] px-1.5 py-0.5 rounded-full bg-white/10 text-white/40 border border-white/5 font-mono">
          Live: {String(val)}
        </span>
      </div>
    );
  }

  return null;
};

// ─── Main Node ────────────────────────────────────────────────────────────────
const HANDLE_BASE: React.CSSProperties = {
  width: 10, height: 10, borderRadius: '50%', border: '2px solid rgba(255,255,255,0.4)',
};

const CanvasPluginNode: React.FC<NodeProps<Node<CanvasNodeData>>> = ({ id, data, selected }) => {
  const edges = useEdges();
  const accentColor = data.nodeColor || '#6366f1';
  
  const inputs = ((data.portInputs || data.inputs || []) as PortSchema[]).filter(p => !p.hidden);
  const outputs = (data.portOutputs || data.outputs || []) as PortSchema[];
  const config = (data.nodeInputConfig || {}) as Record<string, any>;
  const isHtmlOutput = data.nodeRenderMode === 'htmlOutput';

  // 找出哪些 input port 目前有 edge 連入 (Which input ports have incoming edges)
  const connectedInputKeys = useMemo(() => {
    const connected = new Set<string>();
    edges.forEach((edge: Edge) => {
      if (edge.target === id && edge.targetHandle) {
        connected.add(edge.targetHandle);
      }
    });
    return connected;
  }, [edges, id]);

  // inline input 值變更回調 (Callback for inline input value changes)
  const handleValueChange = useCallback((key: string, val: unknown) => {
    // 透過 custom event 通知 Canvas 更新節點 data，避免在節點元件內直接舉用 setNodes
    const event = new CustomEvent('synapse:plugin-node-input-change', {
      detail: { nodeId: id, key, value: val },
      bubbles: true,
    });
    document.dispatchEvent(event);
  }, [id]);

  // HTML Output 節點的「生成」按鈕回調
  const handleGenerate = useCallback(() => {
    const event = new CustomEvent('synapse:plugin-node-generate-html', {
      detail: { nodeId: id, pluginId: data.nodePluginId, config },
      bubbles: true,
    });
    document.dispatchEvent(event);
  }, [id, data.nodePluginId, config]);

  // pipeline-start 節點的「執行管線」按鈕回調
  const handleRunPipeline = useCallback(() => {
    const event = new CustomEvent('synapse:plugin-node-run-pipeline', {
      detail: { nodeId: id },
      bubbles: true,
    });
    document.dispatchEvent(event);
  }, [id]);

  // ─── Dynamic Layout ─────────────────────────────────────────
  const isPipelineStart = data.nodeType === 'pipeline-start';
  const isCron = data.nodeType === 'pipeline-cron';
  const hasNoPorts = inputs.length === 0 && outputs.length === 0;
  
  // 針對簡單節點優化寬度 (Shrink width for simple nodes)
  // 針對簡單節點優化寬度，圖表節點在展示模式下放大 (Shrink width for simple nodes, expand for charts)
  const isChart = data.presentation?.type === 'react-echarts';
  
  // Use persisted dimensions if available, otherwise default
  const styleWidth = (data.width as number) || (isChart ? 400 : ((hasNoPorts || data.nodeType === 'arithmetic' || isCron || isPipelineStart) ? 150 : 180));
  const styleHeight = (data.height as number) || 'auto';

  const onResizeEnd = (_evt: any, params: { width: number; height: number }) => {
    // 透過 custom event 通知 Canvas 更新節點大小
    const event = new CustomEvent('synapse:node-resize', {
      detail: { nodeId: id, width: params.width, height: params.height },
      bubbles: true,
    });
    document.dispatchEvent(event);
  };

  return (
    <div
      style={{
        width: styleWidth,
        height: styleHeight,
        background: 'var(--color-theme-800)',
        border: `1.5px solid ${selected ? accentColor : 'var(--color-theme-600)'}`,
        borderRadius: 8,
        boxShadow: selected
          ? `0 0 0 2px ${accentColor}55, 0 8px 24px rgba(0,0,0,0.5)`
          : '0 4px 16px rgba(0,0,0,0.4)',
        overflow: 'visible',
        position: 'relative',
        minWidth: 150,
        minHeight: 100,
      }}
    >
      {isChart && selected && (
        <NodeResizer 
          minWidth={200} 
          minHeight={150} 
          isVisible={selected} 
          lineClassName="border-primary-main" 
          handleClassName="h-3 w-3 bg-white border-2 border-primary-main rounded-full"
          onResizeEnd={onResizeEnd}
        />
      )}
      {/* ── Header ── */}
      <div
        style={{ 
          background: isCron ? `linear-gradient(135deg, ${accentColor}, #075985)` : accentColor, 
          borderRadius: '6px 6px 0 0' 
        }}
        className="flex items-center gap-1.5 px-2.5 py-1"
      >
        <div className="w-4 h-4 rounded flex items-center justify-center text-white flex-shrink-0">
          {renderIcon(isCron ? 'Clock' : data.nodeIcon, 11)}
        </div>
        <span className="text-white font-bold text-[11px] truncate flex-1 min-w-0">
          {resolvePluginLabel(data.label)}
        </span>
        {isHtmlOutput && <Globe size={10} className="text-white/70 flex-shrink-0" />}
      </div>

      {/* ── Status indicator ── */}
      {data.pipelineStatus && data.pipelineStatus !== undefined && (
        <div
          className={`absolute -top-2 -right-2 w-3 h-3 rounded-full shadow-md z-10 ${
            data.pipelineStatus === 'running' ? 'bg-blue-500 animate-pulse' :
            data.pipelineStatus === 'success' ? 'bg-green-500' : 'bg-red-500'
          }`}
          title={Array.isArray(data.pipelineLogs) ? data.pipelineLogs.join('\n') : undefined}
        />
      )}

      {/* ── Body (Ports or Presentation) ── */}
      {(() => {
        const isPresentation = data.canvasMode === 'presentation';
        const pres = data.presentation;

        // 僅在展示模式且具備 iframe 配置時顯示內容 (Only show iframe in presentation mode)
          if (isPresentation && pres?.type === 'iframe' && pres.urlTemplate) {
            // 解析 URL (Resolve URL from template and config)
            const fileId = config.fileId || data.nodeInputConfig?.fileId || '';
            const url = pres.urlTemplate.replace('{fileId}', String(fileId));

            return (
              <div className="p-2 animate-in fade-in zoom-in-95 duration-500">
                <div className="bg-black/20 rounded overflow-hidden border border-white/10" style={{ height: 320 }}>
                  <iframe 
                    src={url} 
                    className="w-full h-full border-none" 
                    title={data.label}
                    allow="autoplay; encrypted-media; clipboard-write; select-on-check"
                  />
                </div>
              </div>
            );
          }

          // ─── Native ECharts Embed (Render in ALL modes) ───
          let chartElement = null;
          if (pres?.type === 'react-echarts') {
            const chartOption = data.pipelineData?.option || data.pipelineData || {};
            const hasData = !!data.pipelineData;

            // ─── Injection Logic for Custom Chart Types (Phase D-Fix) ───
            const enrichedOption = { ...chartOption };
            if (data.nodeType === 'echarts-project' && enrichedOption.series?.[0]?.type === 'custom') {
              // 注入 tooltip formatter
              if (enrichedOption.tooltip) {
                enrichedOption.tooltip.formatter = (params: any) => {
                  const p = Array.isArray(params) ? params[0] : params;
                  const formatDt = (ts: number | string) => {
                    const d = new Date(Number(ts));
                    return `${d.getFullYear()}/${d.getMonth() + 1}/${d.getDate()}`;
                  };
                  return p.name + ': ' + formatDt(p.value[1]) + ' - ' + formatDt(p.value[2]);
                };
              }
              
              enrichedOption.series[0].renderItem = (_params: any, api: any) => {
                const categoryIndex = api.value(0);
                const start = api.coord([api.value(1), categoryIndex]);
                const end = api.coord([api.value(2), categoryIndex]);
                const height = api.size([0, 1])[1] * 0.6;
                return {
                  type: 'rect',
                  shape: {
                    x: start[0],
                    y: start[1] - height / 2,
                    width: Math.max(0, end[0] - start[0]),
                    height: height
                  },
                  style: api.style()
                };
              };
            }

            chartElement = (
              <div className="p-2 nodrag animate-in fade-in zoom-in-95 duration-500">
                <div className="bg-theme-950/40 rounded-xl overflow-hidden border border-theme-700/50 flex flex-col shadow-inner" style={{ height: 300 }}>
                  {hasData ? (
                    <ReactECharts 
                      option={{
                        ...enrichedOption,
                        backgroundColor: 'transparent'
                      }} 
                      style={{ height: '100%', width: '100%' }}
                      theme={document.documentElement.classList.contains('dark') ? 'dark' : 'light'}
                      notMerge={true}
                      lazyUpdate={true}
                    />
                  ) : (
                    <div className="flex-1 flex flex-col items-center justify-center text-theme-500/30 gap-3">
                      <BarChart3 size={40} className="opacity-20 animate-pulse" />
                      <span className="text-[10px] font-medium tracking-wide brightness-75 uppercase">Waiting for pipeline data...</span>
                    </div>
                  )}
                </div>
              </div>
            );
          }

        return (
          <>
            {/* ── Value Display ── */}
            <NodeValueDisplay 
              nodeType={data.nodeType || ''} 
              config={config} 
              pipelineData={data.pipelineData}
              accentColor={accentColor}
            />

            {chartElement}

            {/* ── Ports body ── */}
            <div className="py-0.5">
              {/* Input rows */}
              {inputs.map((port) => {
                const isConnected = connectedInputKeys.has(port.key);
                const rowH = 24;

                return (
                  <div
                    key={port.key}
                    className="flex items-center gap-1.5 px-3 group/port"
                    style={{ height: rowH, position: 'relative' }}
                  >
                    {/* Left Handle (input) */}
                    <Handle
                      id={port.key}
                      type="target"
                      position={Position.Left}
                      style={{
                        ...HANDLE_BASE,
                        background: isConnected ? accentColor : '#374151',
                        left: -6,
                        top: '50%',
                        transform: 'translateY(-50%)',
                        position: 'absolute',
                        zIndex: 20,
                        transition: 'all 0.2s',
                        boxShadow: isConnected ? `0 0 8px ${accentColor}` : 'none'
                      }}
                    />

                    <span
                      className="text-[10px] flex-shrink-0"
                      style={{
                        color: port.required ? 'var(--color-theme-100)' : 'var(--color-theme-200)',
                        minWidth: 50,
                        paddingLeft: 6,
                        whiteSpace: 'nowrap',
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                        maxWidth: isConnected ? 90 : 70,
                      }}
                      title={resolvePluginLabel(port.description ?? port.label)}
                    >
                      {resolvePluginLabel(port.label)}
                      {port.required && <span className="text-red-400 ml-0.5">*</span>}
                    </span>

                    {/* Inline widget — 無連線時顯示 (Show widget only when not connected) */}
                    {!isConnected && (
                      <PortWidget
                        port={port}
                        value={config[port.key] ?? port.default}
                        onChange={handleValueChange}
                      />
                    )}

                    {/* Connected badge */}
                    {isConnected && (
                      <span className="text-[9px] text-white/30 italic ml-auto pr-1 opacity-0 group-hover/port:opacity-100 transition-opacity">←connected</span>
                    )}
                  </div>
                );
              })}

              {/* Separator when both inputs and outputs exist or display exists */}
              {(inputs.length > 0 && outputs.length > 0) && (
                <div className="mx-3 my-0.5 border-t border-white/5" />
              )}

              {/* Output rows */}
              {outputs.map((port) => (
                <div
                  key={port.key}
                  className="flex items-center justify-end gap-1.5 px-3 group/port"
                  style={{ height: 28, position: 'relative' }}
                >
                  <span
                    className="text-[10px] text-theme-200"
                    style={{ whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', maxWidth: 140 }}
                    title={resolvePluginLabel(port.description ?? port.label)}
                  >
                    {resolvePluginLabel(port.label)}
                  </span>

                  {/* Right Handle (output) */}
                  <Handle
                    id={port.key}
                    type="source"
                    position={Position.Right}
                    style={{
                      ...HANDLE_BASE,
                      background: accentColor,
                      right: -6,
                      top: '50%',
                      transform: 'translateY(-50%)',
                      position: 'absolute',
                      zIndex: 20,
                      transition: 'all 0.2s',
                      boxShadow: `0 0 8px ${accentColor}44`
                    }}
                  />
                </div>
              ))}

              {/* Empty state when no ports */}
              {hasNoPorts && <div className="h-2" />}
            </div>

            {/* ── HTML Output: Generate button ── */}
            {isHtmlOutput && (
              <div className="px-3 pb-3 pt-1">
                <button
                  onClick={handleGenerate}
                  className="w-full flex-center gap-1.5 py-1.5 rounded text-[11px] font-medium text-white transition-all hover:brightness-110 active:scale-95"
                  style={{ background: accentColor, display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                >
                  <RefreshCw size={11} />
                  Generate HTML
                </button>
              </div>
            )}

            {/* ── Pipeline Start: Run button ── */}
            {isPipelineStart && (
              <div className="px-3 pb-3 pt-1">
                <button
                  onClick={handleRunPipeline}
                  className="w-full flex-center gap-1.5 py-1.5 rounded text-[11px] font-medium text-white transition-all hover:brightness-110 active:scale-95"
                  style={{ background: accentColor, display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                >
                  <Play size={11} fill="currentColor" />
                  Run Pipeline
                </button>
              </div>
            )}
          </>
        );
      })()}

      {/* ── Plugin ID footer ── */}
      <div className="px-3 pb-1.5">
        <span className="text-[9px] text-white/15 font-mono">
          {String(data.nodePluginId ?? '')}
        </span>
      </div>
    </div>
  );
};

export default CanvasPluginNode;
