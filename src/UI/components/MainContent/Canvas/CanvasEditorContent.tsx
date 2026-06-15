/** 無限畫布主內容元件 */
import React, { useCallback, useEffect, useRef, useState, useMemo } from 'react';
import {
  ReactFlow, MiniMap, Controls, Background,
  useNodesState, useEdgesState, Panel, BackgroundVariant,
  ConnectionMode,
  type Connection, type Edge, type Node,
  type NodeMouseHandler, type EdgeMouseHandler, type ReactFlowInstance,
} from '@xyflow/react';
import '@xyflow/react/dist/style.css';
import { Save, LayoutGrid, MonitorPlay, Settings, Check, ToggleRight, ToggleLeft } from 'lucide-react';
import type { DriveFile } from '../../../../shared/types';
import { buildEdge, makeTextNode, makeStickyNode, makeGroupNode, NODE_COLOR_THEMES, SNAP_GRID, resolveNodeColors } from './canvasUtils';
import type { EdgeStyleVariant, EdgeRouteType, CanvasNodeData, CanvasEdgeData, PortSchema } from './canvasTypes';
import CanvasToolbar from './CanvasToolbar';
import CanvasPropertyPanel from './CanvasPropertyPanel';
import CanvasShapeNode from './CanvasShapeNode';
import CanvasStickyNode from './CanvasStickyNode';
import CanvasGroupNode from './CanvasGroupNode';
import CanvasResourceNode from './CanvasResourceNode';
import CanvasPluginNode from './CanvasPluginNode';
import NodeLibrary from './NodeLibrary';
import { t } from '../../../../language';

interface CanvasSettings {
  isAdvancedMode?: boolean;
  canvasMode?: 'logic' | 'presentation';
  cronEnabled?: boolean;
  cronType?: 'every_minute' | 'every_hour' | 'every_day' | 'custom';
  cronValue?: number;
  cronHour?: number;
  cronMinute?: number;
  cronExpression?: string;
}
interface CanvasData { version: 1; nodes: Node[]; edges: Edge[]; settings?: CanvasSettings }

const nodeTypes = {
  shapeNode: CanvasShapeNode,
  stickyNode: CanvasStickyNode,
  groupNode: CanvasGroupNode,
  resourceNode: CanvasResourceNode,
  pluginNode: CanvasPluginNode,
};

import { isDarkTheme } from '../../../configs/themeConfig';
import type { ThemeType } from '../../../configs/themeConfig';

interface CanvasEditorContentProps {
  file: DriveFile;
  currentWorkspaceId: string;
  onFileSelect: (file: DriveFile) => void;
  theme: ThemeType;
}

const WELCOME: Node[] = [makeTextNode('welcome-1', 200, 180, 'Welcome to Synapse Canvas')];
const EMPTY_EDGES: Edge[] = [];

function getElectron() {
  return (window as unknown as {
    electron: {
      downloadFileText: (id: string) => Promise<{ content: string }>;
      updateFileText: (id: string, meta: { mimeType: string; body: string }) => Promise<{ success: boolean; status: string }>;
      openExternal: (url: string) => void;
      pipeline: {
        start: (fileId: string, canvasDataString: string) => Promise<{ success: boolean; data?: any; message?: string }>;
        stop: (fileId: string) => Promise<{ success: boolean; message?: string }>;
        onStatusUpdate: (callback: (data: { fileId: string, nodeId: string, status: 'running' | 'success' | 'error', logs?: string[], data?: any }) => void) => () => void;
      };
      plugin: {
        trigger: {
          upsertCanvasCron: (data: { canvasId: string, cron: string, isActive: boolean }) => Promise<{ success: boolean }>;
        };
      };
    }
  }).electron;
}

const CanvasEditorContent: React.FC<CanvasEditorContentProps> = ({ file, onFileSelect, theme }) => {
  const [nodes, setNodes, onNodesChange] = useNodesState(WELCOME);
  const [edges, setEdges, onEdgesChange] = useEdgesState(EMPTY_EDGES);
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null);
  const [selectedEdgeId, setSelectedEdgeId] = useState<string | null>(null);

  // 衍生選取對象 (Derive from state to avoid stale references)
  const selectedNode = useMemo(() => nodes.find(n => n.id === selectedNodeId) || null, [nodes, selectedNodeId]);
  const selectedEdge = useMemo(() => edges.find(e => e.id === selectedEdgeId) || null, [edges, selectedEdgeId]);
  const [minimapHover, setMinimapHover] = useState(false);
  const [snapEnabled, setSnapEnabled] = useState(false);
  const [saveStatus, setSaveStatus] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle');
  const [isLoaded, setIsLoaded] = useState(false);
  const [isInteracting, setIsInteracting] = useState(false);
  const [canvasMode, setCanvasMode] = useState<'logic' | 'presentation'>('logic');
  const [pipelineRunning, setPipelineRunning] = useState(false);
  const [gearOpen, setGearOpen] = useState(false);
  
  // Pipeline Schedule Settings
  const [cronEnabled, setCronEnabled] = useState(false);
  const [cronType, setCronType] = useState<'every_minute' | 'every_hour' | 'every_day' | 'custom'>('every_minute');
  const [cronValue, setCronValue] = useState(5);
  const [cronHour, setCronHour] = useState(9);
  const [cronMinute, setCronMinute] = useState(30);
  const [cronExpression, setCronExpression] = useState('*/5 * * * *');
  const [isLibraryOpen, setIsLibraryOpen] = useState(false);
  const [isAdvancedMode, setIsAdvancedMode] = useState(false);

  const [, setPast] = useState<{nodes: Node[], edges: Edge[]}[]>([]);
  const [, setFuture] = useState<{nodes: Node[], edges: Edge[]}[]>([]);

  const pushHistory = useCallback(() => {
    setPast(p => [...p.slice(-49), { nodes: nodesRef.current, edges: edgesRef.current }]);
    setFuture([]);
  }, []);

  const handleUndo = useCallback(() => {
    setPast(p => {
      if (p.length === 0) return p;
      const previous = p[p.length - 1];
      const newPast = p.slice(0, -1);
      setFuture(f => [{ nodes: nodesRef.current, edges: edgesRef.current }, ...f]);
      setNodes(previous.nodes);
      setEdges(previous.edges);
      return newPast;
    });
  }, [setNodes, setEdges]);

  const handleRedo = useCallback(() => {
    setFuture(f => {
      if (f.length === 0) return f;
      const next = f[0];
      const newFuture = f.slice(1);
      setPast(p => [...p, { nodes: nodesRef.current, edges: edgesRef.current }]);
      setNodes(next.nodes);
      setEdges(next.edges);
      return newFuture;
    });
  }, [setNodes, setEdges]);

  const handleInteractStart = useCallback(() => {
    setIsInteracting(true);
    pushHistory();
  }, [pushHistory]);
  const handleInteractEnd = useCallback(() => setIsInteracting(false), []);

  const lastEdgeStyle = useRef<EdgeStyleVariant>('solid');
  const lastEdgeAnimated = useRef(false);
  const lastEdgeRoute = useRef<EdgeRouteType>('default');
  const rfInstance = useRef<ReactFlowInstance | null>(null);
  const nodesRef = useRef<Node[]>(nodes);
  const edgesRef = useRef<Edge[]>(edges);
  nodesRef.current = nodes;
  edgesRef.current = edges;
  const isDirtyRef = useRef(false);

  const mousePosRef = useRef({ x: window.innerWidth / 2, y: window.innerHeight / 2 });
  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      mousePosRef.current = { x: e.clientX, y: e.clientY };
    };
    window.addEventListener('mousemove', handleMouseMove);
    return () => window.removeEventListener('mousemove', handleMouseMove);
  }, []);

  /* ── Sync Positions ── */
  const syncPositionToData = useCallback((nds: Node[], mode: 'logic' | 'presentation') => {
    return nds.map(n => {
      const d = { ...(n.data || {}) } as CanvasNodeData;
      if (mode === 'logic') d.logicPosition = { ...n.position };
      else d.presentationPosition = { ...n.position };
      
      // 確保保留關鍵的 UI 狀態 (Ensure persistent UI state)
      d.canvasMode = mode;
      
      // 修復舊有插件節點 ID 格式 (Migration)
      if (d.nodePluginId && !d.nodePluginId.includes('::') && d.nodeType) {
        d.nodePluginId = `${d.nodePluginId}::${d.nodeType}`;
      }
      
      return { ...n, data: d };
    });
  }, []);

  /* ── Load from Drive ── */
  useEffect(() => {
    if (!file?.id) { setIsLoaded(true); return; }
    getElectron().downloadFileText(file.id)
      .then(({ content }: { content: string }) => {
        if (content?.trim()) {
          const parsed = JSON.parse(content) as CanvasData;

          // 還原儲存的模式與定時設定
          const savedAdvanced = parsed.settings?.isAdvancedMode ?? false;
          const savedMode = parsed.settings?.canvasMode ?? 'logic';
          setIsAdvancedMode(savedAdvanced);
          setCanvasMode(savedMode);
          
          setCronEnabled(parsed.settings?.cronEnabled ?? false);
          setCronType(parsed.settings?.cronType ?? 'every_minute');
          setCronValue(parsed.settings?.cronValue ?? 5);
          setCronHour(parsed.settings?.cronHour ?? 9);
          setCronMinute(parsed.settings?.cronMinute ?? 30);
          setCronExpression(parsed.settings?.cronExpression ?? '*/5 * * * *');

          if (parsed.nodes?.length) {
            const initialNodes = parsed.nodes.map(n => {
              const d = { ...(n.data || {}), canvasMode: savedMode } as CanvasNodeData;
              const pos = savedMode === 'logic' ? (d.logicPosition || n.position) : (d.presentationPosition || n.position);
              return { ...n, position: pos, data: d, hidden: savedMode === 'presentation' && !d.isVisibleInPresentation };
            });
            setNodes(initialNodes);
          }
          if (parsed.edges?.length) setEdges(parsed.edges);
        }
      })
      .catch(() => {/* new canvas */ })
      .finally(() => setIsLoaded(true));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [file?.id]);

  /* ── Save ── */
  const saveCanvas = useCallback(async (silent = false) => {
    if (!file?.id || !isLoaded) return;
    if (!silent) setSaveStatus('saving');
    const finalNodes = syncPositionToData(nodesRef.current, canvasMode);
    // 同時儲存目前的模式設定 (Persist current mode settings)
    const body: CanvasData = {
      version: 1,
      nodes: finalNodes,
      edges: edgesRef.current,
      settings: { 
        isAdvancedMode, 
        canvasMode,
        cronEnabled,
        cronType,
        cronValue,
        cronHour,
        cronMinute,
        cronExpression
      },
    };
    try {
      const electron = getElectron();
      await electron.updateFileText(file.id, { mimeType: file.mimeType || 'application/vnd.synapse.canvas', body: JSON.stringify(body, null, 2) });
      
      // 同步至後台 Trigger (Sync to background Trigger)
      if (electron.plugin?.trigger) {
        const { toCronExpression } = await import('./cronUtils');
        const cronStr = toCronExpression({
          type: cronType,
          value: cronValue,
          hour: cronHour,
          minute: cronMinute,
          expression: cronExpression
        });
        await electron.plugin.trigger.upsertCanvasCron({
          canvasId: file.id,
          cron: cronStr,
          isActive: cronEnabled
        });
      }

      isDirtyRef.current = false;
      if (!silent) { setSaveStatus('saved'); setTimeout(() => setSaveStatus('idle'), 2000); }
    } catch {
      if (!silent) { setSaveStatus('error'); setTimeout(() => setSaveStatus('idle'), 3000); }
    }
  }, [file?.id, isLoaded, canvasMode, isAdvancedMode, syncPositionToData]);

  /* ── Auto-save on tab switch / window close ── */
  useEffect(() => {
    const onVisibility = () => { if (document.hidden && isDirtyRef.current) void saveCanvas(true); };
    const onUnload = () => { if (isDirtyRef.current) void saveCanvas(true); };
    document.addEventListener('visibilitychange', onVisibility);
    window.addEventListener('beforeunload', onUnload);
    return () => {
      document.removeEventListener('visibilitychange', onVisibility);
      window.removeEventListener('beforeunload', onUnload);
    };
  }, [saveCanvas]);

  /* ── nexus:openFile – resource node "open in Nexus" button ── */
  useEffect(() => {
    const handler = (e: Event) => {
      const detail = (e as CustomEvent<{ id: string; name: string; mimeType: string; webViewLink: string }>).detail;
      if (!detail?.id) return;
      // Route through the internal file select mechanism
      onFileSelect({
        id: detail.id,
        name: detail.name,
        mimeType: detail.mimeType,
        webViewLink: detail.webViewLink
      } as DriveFile);
    };
    window.addEventListener('nexus:openFile', handler);
    window.addEventListener('synapse:openFile', handler);
    return () => {
      window.removeEventListener('nexus:openFile', handler);
      window.removeEventListener('synapse:openFile', handler);
    };
  }, [onFileSelect]);

  // 1. 強制掃描修復所有節點 ID (Migration on Load)
  useEffect(() => {
    if (isLoaded && nodes.length > 0) {
      console.log("[Canvas] Running startup sanitization...");
      const sanitized = nodes.map(n => {
        const d = n.data as CanvasNodeData;
        if (d.nodePluginId && !d.nodePluginId.includes('::') && d.nodeType) {
          console.log(`[Canvas] Standardizing node ${n.id} plugin ID...`);
          return { ...n, data: { ...d, nodePluginId: `${d.nodePluginId}::${d.nodeType}` } };
        }
        return n;
      });
      if (JSON.stringify(sanitized) !== JSON.stringify(nodes)) {
        setNodes(sanitized);
      }
    }
  }, [isLoaded]);

  /* ── Pipeline Runner ── */
  useEffect(() => {
    if (!file?.id || !getElectron().pipeline) return;
    const cleanup = getElectron().pipeline.onStatusUpdate((evt) => {
      if (evt.fileId !== file.id) return;
      setNodes((nds) => nds.map((n) => {
        if (n.id === evt.nodeId) {
          const updatedData = { 
            ...n.data, 
            pipelineStatus: evt.status,
            pipelineLogs: evt.logs,
            pipelineData: evt.data
          };
          return { ...n, data: updatedData };
        }
        return n;
      }));
    });
    return cleanup;
  }, [file?.id, setNodes]);

  const runPipeline = useCallback(async () => {
    if (!file?.id) return;
    setPipelineRunning(true);
    try {
      const syncedNodes = syncPositionToData(nodesRef.current, canvasMode);
      const finalNodes = syncedNodes.map(n => {
        const d = (n.data || {}) as CanvasNodeData;
        
        // 讓插件可以讀取連接的形狀節點顏色
        if (n.type === 'pluginNode') {
          const connectedShapeColors: Record<string, { bg: string, border: string, text: string }> = {};
          edgesRef.current.filter(e => e.target === n.id).forEach(e => {
            const srcNode = syncedNodes.find(sn => sn.id === e.source);
            if (srcNode && srcNode.type === 'shapeNode') {
              connectedShapeColors[e.source] = resolveNodeColors(srcNode.data as CanvasNodeData);
            }
          });
          d.connectedShapeColors = connectedShapeColors;
        }

        console.log(`[Pipeline Frontend] Executing node ${n.id} (${d.label}) [${d.nodePluginId}]`);
        console.log(`[Pipeline Frontend] Passed Config:`, d.nodeInputConfig);
        return n;
      });
      const body = { version: 1, nodes: finalNodes, edges: edgesRef.current };
      console.log("[Pipeline Frontend] Sending payload to background...");
      await saveCanvas(true);
      const res = await getElectron().pipeline.start(file.id, JSON.stringify(body));
      if (!res.success) {
        const errorMsg = res.message || t.canvas.panel.executionFailed;
        console.error("Pipeline failed", errorMsg);
        alert(`${t.canvas.panel.pipelineErrorPrefix}${errorMsg}`);
      } else {
        console.log("Pipeline finished correctly", res.data);
      }
    } catch (e: any) {
      console.error("Pipeline error", e);
    } finally {
      setPipelineRunning(false);
    }
  }, [file?.id, syncPositionToData, canvasMode, saveCanvas]);

  const toggleCanvasMode = useCallback(() => {
    const nextMode = canvasMode === 'logic' ? 'presentation' : 'logic';
    
    // 1. Sync current node positions to current mode
    const syncedNodes = syncPositionToData(nodesRef.current, canvasMode);
    
    // 2. Map positions to next mode and update hidden state
    const mappedNodes = syncedNodes.map(n => {
      const d = n.data as CanvasNodeData;
      const pos = nextMode === 'logic' ? (d.logicPosition || n.position) : (d.presentationPosition || n.position);
      return { 
        ...n, 
        position: pos, 
        data: { ...d, canvasMode: nextMode },
        hidden: nextMode === 'presentation' && !d.isVisibleInPresentation 
      };
    });
    
    // 3. Optional: Hide edges whose source or target is hidden
    const hiddenMap = new Set(mappedNodes.filter(n => n.hidden).map(n => n.id));
    setEdges(eds => eds.map(e => ({
      ...e,
      hidden: nextMode === 'presentation' && (hiddenMap.has(e.source) || hiddenMap.has(e.target))
    })));
    
    setCanvasMode(nextMode);
    setNodes(mappedNodes);
    isDirtyRef.current = true; // explicitly trigger dirty to save new layout logic
  }, [canvasMode, syncPositionToData, setNodes, setEdges]);

  const handleToggleAdvancedMode = useCallback(() => {
    const next = !isAdvancedMode;
    setIsAdvancedMode(next);
    // 如果關閉進階模式且當前在後台，強制切換回前台
    if (!next && canvasMode === 'logic') {
      setTimeout(() => toggleCanvasMode(), 0);
    }
  }, [isAdvancedMode, canvasMode, toggleCanvasMode]);

  /* ── Debounced auto-save (5s after last change) ── */
  const autoSaveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const scheduleAutoSave = useCallback(() => {
    isDirtyRef.current = true;
    if (autoSaveTimer.current) clearTimeout(autoSaveTimer.current);
    autoSaveTimer.current = setTimeout(() => void saveCanvas(true), 5000);
  }, [saveCanvas]);

  /* ── Plugin node inline input change listener ── */
  // CanvasPluginNode 透過 CustomEvent 通知，避免在節點內直接操作 setNodes
  useEffect(() => {
    const handleInputChange = (e: Event) => {
      const { nodeId, key, value } = (e as CustomEvent<{ nodeId: string; key: string; value: unknown }>).detail;
      setNodes(nds => nds.map(n => {
        if (n.id !== nodeId) return n;
        const existing = ((n.data as CanvasNodeData).nodeInputConfig ?? {}) as Record<string, unknown>;
        return { ...n, data: { ...n.data, nodeInputConfig: { ...existing, [key]: value } } };
      }));
      scheduleAutoSave();
    };

    const handleGenerateHtml = (e: Event) => {
      const { nodeId, pluginId, config } = (e as CustomEvent<{ nodeId: string; pluginId: string; config: Record<string, unknown> }>).detail;
      // 未來呼叫 IPC: window.api.plugins.generateHtml(pluginId, config)
      // 目前先 log（Generate HTML IPC not yet implemented）
      console.info('[Canvas] Generate HTML requested:', { nodeId, pluginId, config });
    };

    const handleRunPipeline = (e: Event) => {
      const { nodeId } = (e as CustomEvent<{ nodeId: string }>).detail;
      console.info(`[Canvas] Run pipeline triggered by node: ${nodeId}`);
      void runPipeline();
    };

    const handleNodeResize = (e: Event) => {
      const { nodeId, width, height } = (e as CustomEvent<{ nodeId: string; width: number; height: number }>).detail;
      setNodes(nds => nds.map(n => {
        if (n.id !== nodeId) return n;
        return { ...n, data: { ...n.data, width, height } };
      }));
      scheduleAutoSave();
    };

    document.addEventListener('synapse:plugin-node-input-change', handleInputChange);
    document.addEventListener('synapse:plugin-node-generate-html', handleGenerateHtml);
    document.addEventListener('synapse:plugin-node-run-pipeline', handleRunPipeline);
    document.addEventListener('synapse:node-resize', handleNodeResize);
    return () => {
      document.removeEventListener('synapse:plugin-node-input-change', handleInputChange);
      document.removeEventListener('synapse:plugin-node-generate-html', handleGenerateHtml);
      document.removeEventListener('synapse:plugin-node-run-pipeline', handleRunPipeline);
      document.removeEventListener('synapse:node-resize', handleNodeResize);
    };
  }, [setNodes, scheduleAutoSave, runPipeline]);

  /* ── Connect ── */
  const onConnect = useCallback((params: Connection | Edge) => {
    setEdges((eds) => {
      const newEdge = buildEdge(params, lastEdgeStyle.current, lastEdgeAnimated.current, eds, lastEdgeRoute.current);
      scheduleAutoSave();
      return [...eds, newEdge];
    });
  }, [setEdges, scheduleAutoSave]);

  /* ── Selection ── */
  const onNodeClick: NodeMouseHandler = useCallback((_e, node) => {
    console.log(`[Canvas] Selected Node ID: ${node.id}, PluginID: ${node.data?.nodePluginId}`);
    setSelectedNodeId(node.id); setSelectedEdgeId(null);
  }, []);
  const onEdgeClick: EdgeMouseHandler = useCallback((_e, edge) => {
    setSelectedEdgeId(edge.id); setSelectedNodeId(null);
    const d = edge.data as CanvasEdgeData;
    if (d?.strokeStyle) lastEdgeStyle.current = d.strokeStyle;
    if (typeof d?.animated === 'boolean') lastEdgeAnimated.current = d.animated;
    if (d?.routeType) lastEdgeRoute.current = d.routeType;
  }, []);
  const onPaneClick = useCallback(() => { setSelectedNodeId(null); setSelectedEdgeId(null); }, []);

  /* ── Add nodes ── */
  const center = useCallback(() =>
    rfInstance.current?.screenToFlowPosition({ x: window.innerWidth / 2, y: window.innerHeight / 2 })
    ?? { x: 300, y: 220 }, []);

  const addTextNode = useCallback(() => {
    pushHistory();
    const c = center();
    const nodeId = `text-${Date.now()}`;
    const newNode = makeTextNode(nodeId, c.x - 70, c.y - 20);
    newNode.data = { 
      ...newNode.data, 
      isVisibleInPresentation: true,
      logicPosition: { ...newNode.position },
      presentationPosition: { ...newNode.position }
    };
    setNodes(n => [...n, newNode]); 
    scheduleAutoSave(); 
  }, [setNodes, center, scheduleAutoSave]);

  const addStickyNode = useCallback(() => {
    pushHistory();
    const c = center();
    const nodeId = `sticky-${Date.now()}`;
    const newNode = makeStickyNode(nodeId, c.x - 90, c.y - 60);
    newNode.data = { 
      ...newNode.data, 
      isVisibleInPresentation: true,
      logicPosition: { ...newNode.position },
      presentationPosition: { ...newNode.position }
    };
    setNodes(n => [...n, newNode]); 
    scheduleAutoSave(); 
  }, [setNodes, center, scheduleAutoSave]);

  /* ── Grouping ── */
  const groupSelectedNodes = useCallback(() => {
    pushHistory();
    const selected = nodesRef.current.filter(n => n.selected && !n.parentId);
    if (selected.length < 2) return;
    const xs = selected.map(n => n.position.x);
    const ys = selected.map(n => n.position.y);
    const minX = Math.min(...xs) - 30;
    const minY = Math.min(...ys) - 50;
    const maxX = Math.max(...selected.map((n, i) => xs[i] + (Number((n.style as Record<string, unknown>)?.width) || 140)));
    const maxY = Math.max(...selected.map((n, i) => ys[i] + (Number((n.style as Record<string, unknown>)?.height) || 60)));
    const groupId = `group-${Date.now()}`;
    const group = makeGroupNode(groupId, minX, minY, 'rounded', 'slate', maxX - minX + 30, maxY - minY + 30);
    setNodes(nds => {
      const ids = new Set(selected.map(n => n.id));
      return [group, ...nds.map(n => ids.has(n.id)
        ? { ...n, parentId: groupId, extent: 'parent' as const, position: { x: n.position.x - minX, y: n.position.y - minY } }
        : n)];
    });
    scheduleAutoSave();
  }, [setNodes, scheduleAutoSave]);

  /* ── Ungroup ── */
  const ungroupNode = useCallback((groupId: string) => {
    pushHistory();
    setNodes(nds => {
      const group = nds.find(n => n.id === groupId);
      if (!group) return nds;
      const groupX = group.position.x;
      const groupY = group.position.y;
      return nds
        .filter(n => n.id !== groupId)
        .map(n => n.parentId === groupId
          ? { ...n, parentId: undefined, extent: undefined, position: { x: n.position.x + groupX, y: n.position.y + groupY } }
          : n);
    });
    if (selectedNodeId === groupId) setSelectedNodeId(null);
    scheduleAutoSave();
  }, [setNodes, scheduleAutoSave, selectedNodeId]);

  /* ── Resource node drop ── */
  const onDrop = useCallback((e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    if (!rfInstance.current) return;
    pushHistory();

    // ── 1. Plugin node drop from NodeLibrary ──────────────────────────────
    const pluginRaw = e.dataTransfer.getData('application/vnd.synapse.node');
    if (pluginRaw) {
      try {
        const nodeInfo = JSON.parse(pluginRaw) as {
          pluginId: string; nodeType: string; label: string;
          color?: string; icon?: string;
          inputs?: PortSchema[]; outputs?: PortSchema[];
          portInputs?: PortSchema[]; portOutputs?: PortSchema[];
          renderMode?: 'pipeline' | 'htmlOutput';
          defaultVisible?: boolean;
          presentation?: { type: 'iframe' | 'table' | 'react-echarts' | 'none'; urlTemplate?: string; };
        };
        const pos = rfInstance.current.screenToFlowPosition({ x: e.clientX, y: e.clientY });
        const nodeId = `plugin-${Date.now()}`;
        
        // 解析輸入輸出 (Unified ports resolution)
        const finalInputs = nodeInfo.inputs || nodeInfo.portInputs || [];
        const finalOutputs = nodeInfo.outputs || nodeInfo.portOutputs || [];

        // 建立預設 input config（把 default 值填入）
        const defaultConfig: Record<string, unknown> = {};
        finalInputs.forEach(p => {
          if (p.default !== undefined) defaultConfig[p.key] = p.default;
        });

        const newNode: Node = {
          id: nodeId,
          type: 'pluginNode', 
          position: { x: pos.x - 80, y: pos.y - 30 },
          data: {
            label: nodeInfo.label,
            nodePluginId: `${nodeInfo.pluginId}::${nodeInfo.nodeType}`,
            nodeType: nodeInfo.nodeType,
            nodeIcon: nodeInfo.icon,
            nodeColor: nodeInfo.color,
            nodeRenderMode: nodeInfo.renderMode ?? 'pipeline',
            nodeInputConfig: defaultConfig,
            portInputs: finalInputs,
            portOutputs: finalOutputs,
            isVisibleInPresentation: nodeInfo.defaultVisible ?? true,
            logicPosition: { x: pos.x - 80, y: pos.y - 30 },
            presentationPosition: { x: pos.x - 80, y: pos.y - 30 },
            canvasMode: canvasMode,
            presentation: nodeInfo.presentation,
          } satisfies CanvasNodeData,
        };
        setNodes(nds => [...nds, newNode]);
        scheduleAutoSave();
      } catch { /* corrupt drag data */ }
      return;
    }

    // ── 2. Drive file drop onto an existing plugin node (auto-inject fileRef) ──
    const filesRawCheck = e.dataTransfer.getData('application/vnd.synapse.files')
      || e.dataTransfer.getData('application/vnd.nexus.files')
      || e.dataTransfer.getData('application/vnd.synapse.file')
      || e.dataTransfer.getData('application/vnd.nexus.file');

    if (filesRawCheck && rfInstance.current) {
      // 檢查滑鼠是否落在某個 pluginNode 上 (Check if drop target is a plugin node)
      const dropPos = rfInstance.current.screenToFlowPosition({ x: e.clientX, y: e.clientY });
      const targetPluginNode = nodesRef.current.find(n => {
        if (n.type !== 'pluginNode') return false;
        const nodeW = 220; // CanvasPluginNode 固定寬度
        const portInputs = ((n.data as CanvasNodeData).portInputs ?? []) as PortSchema[];
        const portOutputs = ((n.data as CanvasNodeData).portOutputs ?? []) as PortSchema[];
        const nodeH = 48 + (portInputs.length + portOutputs.length) * 28 + 20;
        return (
          dropPos.x >= n.position.x && dropPos.x <= n.position.x + nodeW &&
          dropPos.y >= n.position.y && dropPos.y <= n.position.y + nodeH
        );
      });

      if (targetPluginNode) {
        // 取得被拖入的第一個 Drive 檔案 (Get first dropped Drive file)
        let driveFile: { id: string; name: string; mimeType: string } | null = null;
        try {
          const multi = e.dataTransfer.getData('application/vnd.synapse.files') || e.dataTransfer.getData('application/vnd.nexus.files');
          if (multi) {
            const arr = JSON.parse(multi) as { id: string; name: string; mimeType: string }[];
            driveFile = arr[0] ?? null;
          } else {
            const single = e.dataTransfer.getData('application/vnd.synapse.file') || e.dataTransfer.getData('application/vnd.nexus.file');
            if (single) driveFile = JSON.parse(single);
          }
        } catch { /* ignore */ }

        if (driveFile) {
          // 找第一個 fileRef input port (Find first fileRef input port)
          const portInputs = ((targetPluginNode.data as CanvasNodeData).portInputs ?? []) as PortSchema[];
          const fileRefPort = portInputs.find(p => p.type === 'fileRef');
          if (fileRefPort) {
            const existingConfig = ((targetPluginNode.data as CanvasNodeData).nodeInputConfig ?? {}) as Record<string, unknown>;
            setNodes(nds => nds.map(n => n.id === targetPluginNode.id
              ? { ...n, data: { ...n.data, nodeInputConfig: { ...existingConfig, [fileRefPort.key]: driveFile!.id } } }
              : n
            ));
            scheduleAutoSave();
            // 短暫 toast 通知（用 console 先做 placeholder）
            console.info(`[Canvas] Auto-injected fileId "${driveFile.id}" → ${fileRefPort.key} (${driveFile.name})`);
            return;
          }
        }
      }
    }

    const filesRaw = e.dataTransfer.getData('application/vnd.synapse.files') || e.dataTransfer.getData('application/vnd.nexus.files');
    if (filesRaw) {
      try {
        const driveFiles: DriveFile[] = JSON.parse(filesRaw);
        const pos = rfInstance.current.screenToFlowPosition({ x: e.clientX, y: e.clientY });
        const newNodes: Node[] = [];
        driveFiles.forEach((df, idx) => {
          const nodeId = `res-${Date.now()}-${idx}`;
          const dropX = pos.x - 80 + (idx * 20);
          const dropY = pos.y - 30 + (idx * 20);

          // ─── Google Workspace 節點：直接以 resourceNode 建立，PipelineRunner 會自動輸出 fileId ───
          // （不再需要特殊的 pluginNode，架構更簡潔）
          const isGWorkspace = df.mimeType?.startsWith('application/vnd.google-apps.');
          
          // 根據類型決定 iframe 的預覽 URL
          let iframeUrl = df.webViewLink || '';
          if (df.mimeType === 'application/vnd.google-apps.spreadsheet') {
            iframeUrl = `https://docs.google.com/spreadsheets/d/${df.id}/edit?rm=minimal`;
          } else if (df.mimeType === 'application/vnd.google-apps.document') {
            iframeUrl = `https://docs.google.com/document/d/${df.id}/preview`;
          } else if (df.mimeType === 'application/vnd.google-apps.presentation') {
            iframeUrl = `https://docs.google.com/presentation/d/${df.id}/preview`;
          }

          const resNode: Node = {
            id: nodeId,
            type: 'resourceNode',
            position: { x: dropX, y: dropY },
            data: {
              label: df.name,
              id: df.id, // 增加原生 id 欄位，確保 PipelineRunner 與 Plugin 的魯棒性
              resourceFileId: df.id,
              resourceFileName: df.name,
              resourceMimeType: df.mimeType,
              resourceIconLink: df.iconLink ?? undefined,
              resourceWebViewLink: (iframeUrl || df.webViewLink) ?? undefined,
              resourceAppProperties: df.appProperties ?? undefined,
              resourceLinkUrl: (df as any).linkUrl || (df as any).nex_url || (df as any).syn_url,
              canvasMode: canvasMode,
              isVisibleInPresentation: true,
              logicPosition: { x: dropX, y: dropY },
              presentationPosition: { x: dropX, y: dropY },
            } satisfies CanvasNodeData,
            // Google Workspace 節點預設高度更大，確保 iframe 有足夠空間顯示
            style: isGWorkspace
              ? { width: 600, height: 420, minHeight: 200 }
              : { width: 180, height: 270, minHeight: 70 },
          };
          newNodes.push(resNode);

        });
        setNodes(nds => [...nds, ...newNodes]);
        scheduleAutoSave();
      } catch { /* corrupt drag data */ }
      return;
    }

    const raw = e.dataTransfer.getData('application/vnd.synapse.file') || e.dataTransfer.getData('application/vnd.nexus.file');
    if (!raw) return;
    try {
      const driveFile = JSON.parse(raw) as {
        id: string; name: string; mimeType: string;
        iconLink?: string; webViewLink?: string;
        appProperties?: Record<string, string>;
      };
      const pos = rfInstance.current.screenToFlowPosition({ x: e.clientX, y: e.clientY });
      const nodeId = `res-${Date.now()}`;
      const resNode: Node = {
        id: nodeId,
        type: 'resourceNode',
        position: { x: pos.x - 80, y: pos.y - 30 },
        data: {
          label: driveFile.name,
          resourceFileId: driveFile.id,
          resourceFileName: driveFile.name,
          resourceMimeType: driveFile.mimeType,
          resourceIconLink: driveFile.iconLink,
          resourceWebViewLink: driveFile.webViewLink,
          resourceAppProperties: driveFile.appProperties,
          resourceLinkUrl: (driveFile as any).linkUrl || (driveFile as any).nex_url || (driveFile as any).syn_url,
        } satisfies CanvasNodeData,
        style: { width: 180, height: 270, minHeight: 70 },
      };
      setNodes(nds => [...nds, resNode]);
      scheduleAutoSave();
    } catch { /* corrupt drag data */ }
  }, [setNodes, scheduleAutoSave]);

  /* ── Update helpers ── */
  const onUpdateNode = useCallback((id: string, changes: Partial<Node>) => {
    setNodes(nds => nds.map(n => n.id === id ? { ...n, ...changes } : n));
    scheduleAutoSave();
  }, [setNodes, scheduleAutoSave]);

  const onUpdateEdge = useCallback((id: string, changes: Partial<Edge>) => {
    setEdges(eds => eds.map(e => e.id === id ? { ...e, ...changes } : e));
    scheduleAutoSave();
  }, [setEdges, scheduleAutoSave]);

  const onDeleteNode = useCallback((id: string) => {
    setNodes(nds => nds.filter(n => n.id !== id && n.parentId !== id));
    if (selectedNodeId === id) setSelectedNodeId(null);
    scheduleAutoSave();
  }, [setNodes, scheduleAutoSave, selectedNodeId]);

  const onDeleteEdge = useCallback((id: string) => {
    setEdges(eds => eds.filter(e => e.id !== id));
    if (selectedEdgeId === id) setSelectedEdgeId(null);
    scheduleAutoSave();
  }, [setEdges, scheduleAutoSave, selectedEdgeId]);

  /* ── Keyboard shortcuts ── */
  const onKeyDown = useCallback(async (e: React.KeyboardEvent) => {
    const tag = (e.target as HTMLElement).tagName;
    if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return;

    // Undo: Ctrl+Z (not shift)
    if (e.ctrlKey && !e.shiftKey && (e.key === 'z' || e.key === 'Z')) { e.preventDefault(); handleUndo(); return; }
    // Redo: Ctrl+Shift+Z or Ctrl+Y
    if (e.ctrlKey && (e.shiftKey && (e.key === 'Z' || e.key === 'z') || (!e.shiftKey && (e.key === 'y' || e.key === 'Y')))) { e.preventDefault(); handleRedo(); return; }

    if (e.ctrlKey && (e.key === 's' || e.key === 'S')) { e.preventDefault(); void saveCanvas(); return; }

    // Copy: Ctrl+C
    if (e.ctrlKey && (e.key === 'c' || e.key === 'C')) {
      e.preventDefault();
      const selectedNodes = nodesRef.current.filter(n => n.selected);
      const selectedEdges = edgesRef.current.filter(e => e.selected);
      if (selectedNodes.length || selectedEdges.length) {
        await navigator.clipboard.writeText(JSON.stringify({ type: 'synapse-canvas-clipboard', nodes: selectedNodes, edges: selectedEdges }));
      }
      return;
    }

    // Cut: Ctrl+X
    if (e.ctrlKey && (e.key === 'x' || e.key === 'X')) {
      e.preventDefault();
      const selectedNodes = nodesRef.current.filter(n => n.selected);
      const selectedEdges = edgesRef.current.filter(e => e.selected);
      if (selectedNodes.length || selectedEdges.length) {
        await navigator.clipboard.writeText(JSON.stringify({ type: 'synapse-canvas-clipboard', nodes: selectedNodes, edges: selectedEdges }));
        pushHistory();
        const selectedNodeIds = new Set(selectedNodes.map(n => n.id));
        const selectedEdgeIds = new Set(selectedEdges.map(e => e.id));
        setNodes(nds => nds.filter(n => !selectedNodeIds.has(n.id) && !selectedNodeIds.has(n.parentId || '')));
        setEdges(eds => eds.filter(e => !selectedEdgeIds.has(e.id)));
        setSelectedNodeId(null); setSelectedEdgeId(null);
        scheduleAutoSave();
      }
      return;
    }

    // Paste: Ctrl+V
    if (e.ctrlKey && (e.key === 'v' || e.key === 'V')) {
      e.preventDefault();
      try {
        const text = await navigator.clipboard.readText();
        const data = JSON.parse(text);
        if (data.type === 'synapse-canvas-clipboard') {
          pushHistory();
          const newNodes: Node[] = [];
          const newEdges: Edge[] = [];
          const idMap = new Map<string, string>();
          
          let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
          data.nodes.forEach((n: Node) => {
            if (n.position.x < minX) minX = n.position.x;
            if (n.position.y < minY) minY = n.position.y;
            if (n.position.x > maxX) maxX = n.position.x;
            if (n.position.y > maxY) maxY = n.position.y;
          });
          
          let offsetX = 20, offsetY = 20;
          if (data.nodes.length > 0) {
            const pasteCenter = rfInstance.current?.screenToFlowPosition(mousePosRef.current) ?? center();
            const groupCenterX = (minX + maxX) / 2;
            const groupCenterY = (minY + maxY) / 2;
            offsetX = pasteCenter.x - groupCenterX;
            offsetY = pasteCenter.y - groupCenterY;
            offsetX += (Math.random() - 0.5) * 20;
            offsetY += (Math.random() - 0.5) * 20;
          }

          data.nodes.forEach((n: Node) => {
            const newId = `${n.type}-${Date.now()}-${Math.floor(Math.random() * 1000)}`;
            idMap.set(n.id, newId);
            newNodes.push({
              ...n,
              id: newId,
              selected: true,
              position: { x: n.position.x + offsetX, y: n.position.y + offsetY },
              data: { ...n.data, logicPosition: undefined, presentationPosition: undefined }
            });
          });
          
          data.edges.forEach((e: Edge) => {
            if (idMap.has(e.source) && idMap.has(e.target)) {
              const newId = `e-${idMap.get(e.source)}-${idMap.get(e.target)}-${Date.now()}`;
              newEdges.push({
                ...e,
                id: newId,
                source: idMap.get(e.source)!,
                target: idMap.get(e.target)!,
                selected: true
              });
            }
          });

          setNodes(nds => [...nds.map(n => ({ ...n, selected: false } as Node)), ...newNodes]);
          setEdges(eds => [...eds.map(e => ({ ...e, selected: false } as Edge)), ...newEdges]);
          scheduleAutoSave();
        }
      } catch (err) {
        // Not canvas data or clipboard error
      }
      return;
    }

    if (e.key === 't' || e.key === 'T') { addTextNode(); }
    if (e.key === 's' || e.key === 'S') { addStickyNode(); }
    if (e.key === 'g' || e.key === 'G') { groupSelectedNodes(); }

    if (e.key === 'Delete' || e.key === 'Backspace') { 
      const selectedNodes = nodesRef.current.filter(n => n.selected);
      const selectedEdges = edgesRef.current.filter(e => e.selected);
      if (selectedNodes.length || selectedEdges.length) {
        pushHistory();
        const selectedNodeIds = new Set(selectedNodes.map(n => n.id));
        const selectedEdgeIds = new Set(selectedEdges.map(e => e.id));
        setNodes(nds => nds.filter(n => !selectedNodeIds.has(n.id) && !selectedNodeIds.has(n.parentId || '')));
        setEdges(eds => eds.filter(e => !selectedEdgeIds.has(e.id)));
        setSelectedNodeId(null); setSelectedEdgeId(null);
        scheduleAutoSave();
      }
    }
  }, [addTextNode, addStickyNode, groupSelectedNodes, saveCanvas, onDeleteNode, onDeleteEdge, selectedNode, selectedEdge, handleUndo, handleRedo, pushHistory, setNodes, setEdges, scheduleAutoSave, center]);
  const saveLabel = saveStatus === 'saving' ? t.canvas.panel.saving : saveStatus === 'saved' ? t.canvas.panel.saved : saveStatus === 'error' ? t.canvas.panel.loadError : t.canvas.panel.saveShortcut;

  if (!isLoaded) return (

    <div className="w-full h-full flex items-center justify-center bg-theme-950 text-theme-500 text-sm">{t.canvas.panel.loading}</div>
  );

  return (
    <div
      className={`synapse-react-flow w-full h-full relative outline-none ${isInteracting ? 'is-interacting' : ''}`}
      style={{ backgroundColor: canvasMode === 'logic' ? 'var(--color-theme-800)' : 'var(--color-theme-900)' }}
      tabIndex={0}
      onKeyDown={onKeyDown}
      onDrop={onDrop}
      onDragOver={(e) => { e.preventDefault(); e.dataTransfer.dropEffect = 'copy'; }}
    >
      <ReactFlow
        nodes={nodes}
        edges={edges}
        onNodesChange={(changes) => { onNodesChange(changes); if (isLoaded) scheduleAutoSave(); }}
        onEdgesChange={(changes) => { onEdgesChange(changes); if (isLoaded) scheduleAutoSave(); }}
        onConnect={onConnect}
        onNodeClick={onNodeClick} onEdgeClick={onEdgeClick} onPaneClick={onPaneClick}
        onNodeDoubleClick={(e) => e.stopPropagation()}
        onEdgeDoubleClick={(e) => e.stopPropagation()}
        onNodeDragStart={handleInteractStart}
        onNodeDragStop={handleInteractEnd}
        onConnectStart={handleInteractStart}
        onConnectEnd={handleInteractEnd}
        onInit={(inst) => { rfInstance.current = inst; }}
        nodeTypes={nodeTypes}
        connectionMode={ConnectionMode.Loose}
        fitView colorMode={isDarkTheme(theme) ? 'dark' : 'light'} deleteKeyCode={null}
        snapToGrid={snapEnabled} snapGrid={SNAP_GRID}
        minZoom={0.01} maxZoom={100}
      >
        <Background variant={BackgroundVariant.Dots} gap={20} size={1.5} color={isDarkTheme(theme) ? '#555555' : '#aaaaaa'} />
        <Controls />

        {/* MiniMap hover-expand */}
        <Panel position="bottom-right" style={{ padding: 0, margin: 0 }}>
          <div
            onMouseEnter={() => setMinimapHover(true)}
            onMouseLeave={() => setMinimapHover(false)}
            style={{ transition: 'transform 0.25s ease, opacity 0.25s ease', transformOrigin: 'bottom right', transform: minimapHover ? 'scale(1)' : 'scale(0.5)', opacity: minimapHover ? 1 : 0.65 }}
          >
            <MiniMap nodeColor={minimapColor} maskColor="var(--minimap-mask)" className="bg-theme-900 border-theme-700" style={{ margin: 0 }} />
          </div>
        </Panel>



        <Panel position="top-left">
          <CanvasToolbar
            onAddTextNode={addTextNode} onAddStickyNode={addStickyNode}
            onGroupSelected={groupSelectedNodes} snapEnabled={snapEnabled}
            onToggleSnap={() => setSnapEnabled(v => !v)}
            isLibraryOpen={isLibraryOpen}
            onToggleLibrary={() => setIsLibraryOpen(v => !v)}
            isAdvancedMode={isAdvancedMode}
            canvasMode={canvasMode}
          />
        </Panel>

        {/* Top-center: save only */}
        <Panel position="top-center">
          <button onClick={() => void saveCanvas()} title={saveStatus === 'saving' ? t.canvas.panel.saving : saveStatus === 'saved' ? t.canvas.panel.saved : t.canvas.panel.saveShortcut}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg border text-xs font-medium shadow-lg transition-all backdrop-blur-sm ${
              saveStatus === 'saved' ? 'bg-green-900/60 border-green-600 text-green-300'
              : saveStatus === 'error' ? 'bg-red-900/60 border-red-600 text-red-300'
              : 'bg-theme-900/90 border-theme-700 text-theme-400 hover:text-theme-200 hover:border-theme-500'
            }`}
          ><Save size={12} />{saveLabel}</button>
        </Panel>

        {/* Top-right: Property Panel + gear menu */}
        <Panel position="top-right">
          <div className="flex items-start gap-2">
            {/* Gear button + dropdown */}
            <div className="relative">
              <button
                onClick={() => setGearOpen(v => !v)}
                title="Canvas Options"
                className="flex items-center justify-center w-8 h-8 rounded-lg border text-xs shadow-lg transition-all backdrop-blur-sm bg-theme-900/90 border-theme-700 text-theme-400 hover:text-theme-200 hover:border-theme-500"
              >
                <Settings size={14} />
              </button>
              {gearOpen && (
                <div className="absolute right-0 top-10 z-50 min-w-[200px] bg-theme-900/95 border border-theme-700 rounded-xl shadow-2xl p-2 flex flex-col gap-1 backdrop-blur-sm">
                  {/* Advanced Mode Toggle */}
                  <button 
                    onClick={handleToggleAdvancedMode}
                    className="flex items-center justify-between px-3 py-2 rounded-lg text-xs font-medium transition-all text-theme-300 hover:bg-theme-800"
                  >
                    <div className="flex items-center gap-2">
                      {isAdvancedMode ? <ToggleRight size={14} className="text-primary-main" /> : <ToggleLeft size={14} />}
                      {t.canvas.panel.advancedMode || '進階模式'}
                    </div>
                    {isAdvancedMode && <Check size={12} className="text-primary-main" />}
                  </button>

                  <div className="h-px bg-theme-700 my-1 mx-2" />

                  {/* Mode Switcher - Only reachable in Advanced Mode */}
                  <button onClick={() => { if(isAdvancedMode) toggleCanvasMode(); setGearOpen(false); }}
                    disabled={!isAdvancedMode}
                    className={`flex items-center gap-2 px-3 py-2 rounded-lg text-xs font-medium transition-all ${
                      isAdvancedMode ? 'text-theme-300 hover:bg-theme-800 hover:text-theme-100' : 'text-theme-600 cursor-not-allowed opacity-50'
                    }`}
                  >
                    {canvasMode === 'logic' ? <MonitorPlay size={13} /> : <LayoutGrid size={13} />}
                    {canvasMode === 'logic' ? t.canvas.mode.switchPresentation : t.canvas.mode.switchLogic}
                  </button>

                  {/* Run Pipeline - Only reachable in Advanced Mode */}
                  <button onClick={() => { if(isAdvancedMode) void runPipeline(); setGearOpen(false); }} 
                    disabled={pipelineRunning || !isAdvancedMode}
                    className={`flex items-center gap-2 px-3 py-2 rounded-lg text-xs font-medium transition-all ${
                      !isAdvancedMode ? 'text-theme-600 cursor-not-allowed opacity-50'
                      : pipelineRunning ? 'text-theme-500 cursor-not-allowed' 
                      : 'text-primary-300 hover:bg-primary-main/20 hover:text-primary-200'
                    }`}
                  >
                    <MonitorPlay size={13} />
                    {pipelineRunning ? t.canvas.panel.running : t.canvas.panel.runPipeline}
                  </button>

                  <div className="h-px bg-theme-700 my-1 mx-2" />

                  {/* ── Pipeline Schedule Settings ── */}
                  <div className="px-3 py-2">
                    <p className="text-[10px] text-theme-500 uppercase font-bold tracking-wider mb-2 flex items-center gap-1.5">
                      <ToggleRight size={10} /> {t.canvas.panel.schedule || '排程設定'}
                    </p>
                    
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-xs text-theme-300">{t.canvas.panel.enableSchedule || '啟用定時'}</span>
                      <button 
                        onClick={() => { setCronEnabled(!cronEnabled); scheduleAutoSave(); }}
                        className={`w-8 h-4 rounded-full transition-colors relative ${cronEnabled ? 'bg-primary-main' : 'bg-theme-700'}`}
                      >
                        <div className={`absolute top-0.5 w-3 h-3 rounded-full bg-white transition-all ${cronEnabled ? 'right-0.5' : 'left-0.5'}`} />
                      </button>
                    </div>

                    {cronEnabled && (
                      <div className="space-y-2 animate-in fade-in slide-in-from-top-1 duration-200">
                        <select 
                          value={cronType}
                          onChange={(e) => { setCronType(e.target.value as any); scheduleAutoSave(); }}
                          className="w-full bg-theme-900 border border-theme-700 rounded px-2 py-1 text-[11px] text-theme-200 outline-none focus:border-primary-500"
                        >
                          <option value="every_minute">每隔幾分鐘</option>
                          <option value="every_hour">每隔幾小時</option>
                          <option value="every_day">每日定時</option>
                          <option value="custom">自訂 (Cron)</option>
                        </select>

                        {/* Interval Fields (Minute/Hour) */}
                        {(cronType === 'every_minute' || cronType === 'every_hour') && (
                          <div className="flex items-center gap-2 animate-in fade-in zoom-in-95 duration-200">
                            <span className="text-[10px] text-theme-400">間隔</span>
                            <input 
                              type="number" 
                              value={cronValue}
                              min={1}
                              onChange={(e) => { setCronValue(parseInt(e.target.value) || 1); scheduleAutoSave(); }}
                              className="w-16 bg-theme-900 border border-theme-700 rounded px-2 py-0.5 text-[11px] text-theme-200 outline-none focus:border-primary-500"
                            />
                            <span className="text-[10px] text-theme-400">{cronType === 'every_minute' ? '分' : '時'}</span>
                          </div>
                        )}

                        {/* Specific Time Fields (Day) */}
                        {cronType === 'every_day' && (
                          <div className="flex items-center gap-2 animate-in fade-in zoom-in-95 duration-200">
                            <span className="text-[10px] text-theme-400">定時</span>
                            <div className="flex items-center bg-theme-900 border border-theme-700 rounded px-1">
                              <input 
                                type="number" 
                                value={cronHour}
                                min={0} max={23}
                                onChange={(e) => { setCronHour(Math.min(23, Math.max(0, parseInt(e.target.value) || 0))); scheduleAutoSave(); }}
                                className="w-8 bg-transparent text-center py-0.5 text-[11px] text-theme-200 outline-none"
                                placeholder="HH"
                              />
                              <span className="text-theme-600">:</span>
                              <input 
                                type="number" 
                                value={cronMinute}
                                min={0} max={59}
                                onChange={(e) => { setCronMinute(Math.min(59, Math.max(0, parseInt(e.target.value) || 0))); scheduleAutoSave(); }}
                                className="w-8 bg-transparent text-center py-0.5 text-[11px] text-theme-200 outline-none"
                                placeholder="mm"
                              />
                            </div>
                          </div>
                        )}

                        {/* Custom Expression Field */}
                        {cronType === 'custom' && (
                          <div className="space-y-1 animate-in fade-in zoom-in-95 duration-200">
                            <span className="text-[10px] text-theme-400 block">Cron 式</span>
                            <input 
                              type="text" 
                              value={cronExpression}
                              onChange={(e) => { setCronExpression(e.target.value); scheduleAutoSave(); }}
                              placeholder="* * * * *"
                              className="w-full bg-theme-900 border border-theme-700 rounded px-2 py-0.5 text-[11px] text-theme-200 font-mono outline-none focus:border-primary-500"
                            />
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>
            <CanvasPropertyPanel
              selectedNode={selectedNode} selectedEdge={selectedEdge}
              onUpdateNode={onUpdateNode} onUpdateEdge={onUpdateEdge}
              onDeleteNode={onDeleteNode} onDeleteEdge={onDeleteEdge}
              onUngroup={ungroupNode}
              canvasMode={canvasMode}
            />
          </div>
        </Panel>
      </ReactFlow>

      {/* 節點庫側邊欄 */}
      <NodeLibrary 
        isOpen={isLibraryOpen} 
        onClose={() => setIsLibraryOpen(false)} 
      />
    </div>
  );
};

function minimapColor(node: Node): string {
  if (node.type === 'stickyNode') return '#fde047';
  if (node.type === 'groupNode') return '#6366f1';
  if (node.type === 'resourceNode') return '#0ea5e9';
  const data = node.data as CanvasNodeData;
  return NODE_COLOR_THEMES[data?.colorKey ?? 'slate']?.border ?? '#334155';
}

export default CanvasEditorContent;
