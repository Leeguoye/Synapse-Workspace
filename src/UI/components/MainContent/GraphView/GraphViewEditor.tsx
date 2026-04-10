import React, { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import {
    ReactFlow, Background, Controls, useNodesState, useEdgesState,
    ReactFlowProvider, Panel, Handle, Position, StraightEdge, useReactFlow
} from '@xyflow/react';
import type { Node, Edge, EdgeTypes } from '@xyflow/react';
import '@xyflow/react/dist/style.css';
import { Save } from 'lucide-react';
import type { DriveFile } from '../../../../shared/types';
import GraphSidePanel from './GraphSidePanel';
import { getDynamicIcon } from '../../../utils/icons';
import { t } from '../../../../language';
import * as d3 from 'd3-force';

// ─── D3 Physics Constants (adjust here) ──────────────────────────────────────
const D3_CHARGE_STRENGTH = 1000;
const D3_LINK_DISTANCE   = 150;
const D3_COLLIDE_PADDING = 80;
// ─────────────────────────────────────────────────────────────────────────────

const DEFAULT_TAG_COLOR  = '#8b5cf6';
const DEFAULT_FILE_COLOR = '#475569';

import { isDarkTheme } from '../../../configs/themeConfig';
import type { ThemeType } from '../../../configs/themeConfig';

interface GraphViewEditorProps {
    file: DriveFile;
    currentWorkspaceId: string;
    onFileSelect?: (file: DriveFile) => void;
    theme: ThemeType;
}

// ─── Persisted types ──────────────────────────────────────────────────────────
interface TagChain {
    id: string; name: string; tags: string[]; isPrimary: boolean;
    edgeColor?: string;      // line colour = node border colour
    nodeBgColor?: string;    // tag node background
    nodeTextColor?: string;  // tag node text / label
    isHidden?: boolean;
}
interface GraphColorOverrides { tag?: string; file?: string }
interface GraphFileData {
    version: 2;
    colorOverrides: GraphColorOverrides;
    pinnedFiles?: DriveFile[]; // Embedded metadata (Canvas-style)
    pinnedFileIds?: string[];  // Legacy (optional)
    tagChains: TagChain[];
    hiddenTags?: string[];
}
function emptyGraph(): GraphFileData {
    return { version: 2, colorOverrides: {}, pinnedFileIds: [], tagChains: [], hiddenTags: [] };
}
function parseGraphBody(body: string): GraphFileData {
    try {
        const parsed = JSON.parse(body);
        return {
            version: 2,
            colorOverrides: parsed.colorOverrides ?? {},
            pinnedFiles: parsed.pinnedFiles ?? [], // Added: restore embedded metadata
            pinnedFileIds: parsed.pinnedFileIds ?? [],
            tagChains: parsed.tagChains ?? [],
            hiddenTags: parsed.hiddenTags ?? []
        };
    } catch { return emptyGraph(); }
}

// ─── Custom Nodes ─────────────────────────────────────────────────────────────
const HANDLE_STYLE: React.CSSProperties = { opacity: 0, top: '50%', left: '50%', transform: 'translate(-50%,-50%)', width: 1, height: 1 };

const TagNode = ({ data }: { data: { label: string; color: string; bg?: string; textColor?: string; isPrimary?: boolean } }) => (
    <div className="px-4 py-2 shadow-lg rounded-full font-bold text-xs select-none"
        style={{
            background: data.bg ?? data.color + '33',
            border: `${data.isPrimary ? '2.5px' : '1.5px'} solid ${data.color}`,
            color: data.textColor ?? data.color,
            boxShadow: data.isPrimary ? `0 0 0 2px #0f172a, 0 0 0 4px ${data.color}` : 'none',
        }}>
        <Handle type="source" position={Position.Top}    id="t"  style={HANDLE_STYLE} />
        <Handle type="source" position={Position.Bottom} id="b"  style={HANDLE_STYLE} />
        <Handle type="source" position={Position.Left}   id="l"  style={HANDLE_STYLE} />
        <Handle type="source" position={Position.Right}  id="r"  style={HANDLE_STYLE} />
        <Handle type="target" position={Position.Top}    id="tt" style={HANDLE_STYLE} />
        <Handle type="target" position={Position.Bottom} id="tb" style={HANDLE_STYLE} />
        <Handle type="target" position={Position.Left}   id="tl" style={HANDLE_STYLE} />
        <Handle type="target" position={Position.Right}  id="tr" style={HANDLE_STYLE} />
        {data.label}{data.isPrimary && <span className="ml-1 text-[9px] opacity-70">★</span>}
    </div>
);

const FileNode = ({ data }: { data: { label: string; icon: React.ReactNode; onDoubleClick: () => void; color: string } }) => (
    <div className="px-3 py-2 shadow-lg rounded-lg text-xs select-none flex items-center gap-2 cursor-pointer border"
        style={{ 
            background: data.color + '33', 
            borderColor: data.color + '88', 
            color: 'var(--color-theme-100)' 
        }}
        onDoubleClick={data.onDoubleClick} title={data.label}>
        <Handle type="target" position={Position.Top}    id="t" style={HANDLE_STYLE} />
        <Handle type="target" position={Position.Bottom} id="b" style={HANDLE_STYLE} />
        <Handle type="target" position={Position.Left}   id="l" style={HANDLE_STYLE} />
        <Handle type="target" position={Position.Right}  id="r" style={HANDLE_STYLE} />
        {data.icon}
        <span className="truncate max-w-[150px]">{data.label}</span>
    </div>
);

const nodeTypes = { tagNode: TagNode, fileNode: FileNode };
const edgeTypes: EdgeTypes = { straight: StraightEdge };

// ─── IPC helper ───────────────────────────────────────────────────────────────
function getElectron() {
    return (window as any).electron as {
        updateFileText:   (id: string, meta: { mimeType: string; body: string }) => Promise<{ success: boolean; status?: string }>;
        downloadFileText: (id: string) => Promise<{ content: string }>;
        listFiles:        (q: any) => Promise<DriveFile[]>;
        addTag:           (id: string, tag: string, wsId: string) => Promise<void>;
        removeTag:        (id: string, tag: string) => Promise<void>;
    };
}

// ─── Main component ───────────────────────────────────────────────────────────
const GraphViewEditorContent: React.FC<GraphViewEditorProps> = ({ file, currentWorkspaceId, onFileSelect, theme }) => {
    const { fitView } = useReactFlow();
    const [nodes, setNodes, onNodesChange] = useNodesState<Node>([]);
    const [edges, setEdges, onEdgesChange] = useEdgesState<Edge>([]);

    const fileMapRef = useRef<Map<string, DriveFile>>(new Map());
    const [allFiles, setAllFiles] = useState<DriveFile[]>([]);

    const [colorOverrides, setColorOverrides] = useState<GraphColorOverrides>({});
    const [tagChains,      setTagChains]      = useState<TagChain[]>([]);
    const [hiddenTags,     setHiddenTags]     = useState<string[]>([]);
    const [saveStatus, setSaveStatus]         = useState<'idle' | 'saving' | 'saved' | 'error'>('idle');
    const [isLoaded,   setIsLoaded]           = useState(false);

    const simulationRef = useRef<any>(null);
    const simNodesRef   = useRef<any[]>([]);

    const syncFiles = useCallback(() => {
        setAllFiles(Array.from(fileMapRef.current.values()));
    }, []);

    const removeFile = useCallback((id: string) => {
        fileMapRef.current.delete(id);
        syncFiles();
    }, [syncFiles]);

    // ── 0. Load from Drive (mirror canvas pattern) ────────────────────────
    useEffect(() => {
        if (!file?.id) { setIsLoaded(true); return; }
        console.log('[GraphView] loading file:', file.id, file.name);
        fileMapRef.current.clear();
        setAllFiles([]);
        getElectron()
            .downloadFileText(file.id)
            .then(({ content }) => {
                console.log('[GraphView] downloadFileText raw:', content?.slice(0, 300));
                if (content?.trim()) {
                    const data = parseGraphBody(content);
                    console.log('[GraphView] parsed graph data:', data);
                    setColorOverrides(data.colorOverrides ?? {});
                    setTagChains(data.tagChains ?? []);
                    setHiddenTags(data.hiddenTags ?? []);

                    // Restore pinned files metadata
                    if (data.pinnedFiles?.length) {
                        data.pinnedFiles.forEach(f => {
                            if (f && f.id) {
                                console.log('[GraphView] restoring pinned file:', f.name, f.id);
                                fileMapRef.current.set(f.id, f);
                            }
                        });
                        syncFiles();
                    }
                } else {
                    console.log('[GraphView] no content — starting fresh');
                }
            })
            .catch((err) => { console.error('[GraphView] downloadFileText error:', err); })
            .finally(() => { console.log('[GraphView] load finished, isLoaded=true'); setIsLoaded(true); });
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [file?.id]);

    // ── 1. Refresh workspace (merge, never replace) ───────────────────────
    const refreshWorkspace = useCallback(() => {
        if (!currentWorkspaceId) return;
        
        // 1. Refresh global workspace folder files
        const wsPromise = getElectron().listFiles({ mode: 'custom', parentId: currentWorkspaceId });
        
        // 2. Refresh pinned files specifically (by ID) to catch tag changes even if they are in other folders
        const pinnedIds = Array.from(fileMapRef.current.keys());
        const pinnedPromise = pinnedIds.length > 0 
            ? getElectron().listFiles({ mode: 'ids', ids: pinnedIds })
            : Promise.resolve([]);

        Promise.all([wsPromise, pinnedPromise])
            .then(([wsFiles, pinnedFiles]) => {
                console.log('[GraphView] refreshWorkspace results - WS:', wsFiles.length, 'Pinned:', pinnedFiles.length);
                wsFiles.forEach(f => fileMapRef.current.set(f.id, f));
                pinnedFiles.forEach(f => fileMapRef.current.set(f.id, f));
                syncFiles();
            })
            .catch(console.error);
    }, [currentWorkspaceId, syncFiles]);

    useEffect(() => { if (isLoaded) refreshWorkspace(); }, [isLoaded, refreshWorkspace]);

    // ── 2. Drop ────────────────────────────────────────────────────────────
    const onDrop = useCallback((e: React.DragEvent<HTMLDivElement>) => {
        e.preventDefault();
        
        const filesRaw = e.dataTransfer.getData('application/vnd.synapse.files') || e.dataTransfer.getData('application/vnd.nexus.files');
        if (filesRaw) {
            try {
                const driveFiles: DriveFile[] = JSON.parse(filesRaw);
                let changed = false;
                for (const df of driveFiles) {
                    if (df.mimeType !== 'application/vnd.google-apps.folder') {
                        fileMapRef.current.set(df.id, df);
                        changed = true;
                    }
                }
                if (changed) {
                    syncFiles();
                    refreshWorkspace();
                }
            } catch { console.error('[GraphView] onDrop files parse failed'); }
            return;
        }

        const raw = e.dataTransfer.getData('application/vnd.synapse.file') || e.dataTransfer.getData('application/vnd.nexus.file');
        if (!raw) return;
        try {
            const driveFile = JSON.parse(raw) as DriveFile;
            if (driveFile.mimeType === 'application/vnd.google-apps.folder') return;
            fileMapRef.current.set(driveFile.id, driveFile);
            syncFiles();
            refreshWorkspace();
        } catch { console.error('[GraphView] onDrop parse failed'); }
    }, [syncFiles, refreshWorkspace]);

    // ── 3. Derived tags ────────────────────────────────────────────────────
    const allTags = useMemo(() => {
        const s = new Set<string>();
        allFiles.forEach(f => f.tags?.forEach(t => s.add(t)));
        return Array.from(s);
    }, [allFiles]);

    // ── 4. Build graph + D3 physics ───────────────────────────────────────
    useEffect(() => {
        if (!isLoaded) return;
        simulationRef.current?.stop();

        const tagColor  = colorOverrides.tag  ?? DEFAULT_TAG_COLOR;
        const fileColor = colorOverrides.file ?? DEFAULT_FILE_COLOR;

        const newNodes: Node[] = [];
        const newEdges: Edge[] = [];
        const simNodes: any[]  = [];
        const simLinks: any[]  = [];

        const primaryChain = tagChains.find(c => c.isPrimary);
        const primaryTags  = new Set(primaryChain?.tags ?? []);
        const hiddenTagsSet = new Set(hiddenTags);

        // Build a map: tag → chain node style (first chain that contains tag wins)
        const tagChainStyle = new Map<string, { nodeColor: string; nodeBg: string; nodeText: string }>();
        tagChains.forEach(chain => {
            if (chain.isHidden) return; // Skip hidden chains for styling tags
            const edgeColor   = chain.edgeColor   ?? '#f59e0b';
            const nodeBg      = chain.nodeBgColor  ?? edgeColor + '33';
            const nodeText    = chain.nodeTextColor ?? edgeColor;
            chain.tags.forEach(tag => {
                if (!tagChainStyle.has(tag)) tagChainStyle.set(tag, { nodeColor: edgeColor, nodeBg, nodeText });
            });
        });

        allTags.filter(tag => !hiddenTagsSet.has(tag)).forEach(tag => {
            const id = `tag-${tag}`;
            const style = tagChainStyle.get(tag);
            const nodeColor = style?.nodeColor ?? tagColor;
            const nodeBg    = style?.nodeBg    ?? tagColor + '33';
            const nodeText  = style?.nodeText  ?? tagColor;
            newNodes.push({ id, type: 'tagNode', data: { label: tag, color: nodeColor, bg: nodeBg, textColor: nodeText, isPrimary: primaryTags.has(tag) }, position: { x: 0, y: 0 } });
            simNodes.push({ id, radius: 44 });
        });

        tagChains.forEach(chain => {
            if (chain.isHidden) return;
            const chainColor = chain.edgeColor ?? '#f59e0b';
            for (let i = 0; i < chain.tags.length - 1; i++) {
                const a = chain.tags[i]; const b = chain.tags[i + 1];
                if (!allTags.includes(a) || !allTags.includes(b)) continue;
                if (hiddenTagsSet.has(a) || hiddenTagsSet.has(b)) continue;
                newEdges.push({
                    id: `chain-${chain.id}-${i}`,
                    source: `tag-${a}`, target: `tag-${b}`, type: 'straight',
                    style: { stroke: chainColor, strokeWidth: chain.isPrimary ? 2.5 : 1.5, opacity: 0.8,
                        strokeDasharray: chain.isPrimary ? undefined : '6 3' },
                });
                simLinks.push({ source: `tag-${a}`, target: `tag-${b}`, distance: 90 });
            }
        });

        allFiles.filter(f => f.mimeType !== 'application/vnd.google-apps.folder').forEach(f => {
            const id = `file-${f.id}`;
            newNodes.push({ id, type: 'fileNode', data: { label: f.name, icon: getDynamicIcon(f.mimeType, f.name, f.description), color: fileColor, onDoubleClick: () => onFileSelect?.(f) }, position: { x: 0, y: 0 } });
            simNodes.push({ id, radius: 64 });
            f.tags?.forEach(tag => {
                if (!allTags.includes(tag) || hiddenTagsSet.has(tag)) return;
                newEdges.push({ id: `edge-${f.id}-${tag}`, source: `tag-${tag}`, target: id, type: 'straight', style: { stroke: tagColor, strokeWidth: 1.5, opacity: 0.5 } });
                simLinks.push({ source: `tag-${tag}`, target: id });
            });
        });

        console.log('[GraphView] building graph nodes:', newNodes.length, 'edges:', newEdges.length);

        const simulation = d3.forceSimulation(simNodes)
            .force('charge', d3.forceManyBody().strength(D3_CHARGE_STRENGTH))
            .force('center', d3.forceCenter(600, 400))
            .force('collide', d3.forceCollide().radius((d: any) => d.radius + D3_COLLIDE_PADDING))
            .force('link', d3.forceLink(simLinks).id((d: any) => d.id).distance(D3_LINK_DISTANCE))
            .on('tick', () => {
                setNodes(nds => nds.map(node => {
                    const sn = simNodes.find(n => n.id === node.id);
                    if (sn && !node.dragging) return { ...node, position: { x: sn.x ?? 0, y: sn.y ?? 0 } };
                    return node;
                }));
            });

        simulationRef.current = simulation;
        simNodesRef.current = simNodes;
        setNodes(newNodes);
        setEdges(newEdges);
        return () => { simulation.stop(); };
    }, [allFiles, allTags, colorOverrides, tagChains, hiddenTags, isLoaded, setNodes, setEdges, onFileSelect]);

    // ── 4.5 Auto-fit view ──────────────────────────────────────────────────
    useEffect(() => {
        if (isLoaded && nodes.length > 0) {
            const timer = setTimeout(() => {
                fitView({ padding: 0.15, duration: 600 });
            }, 300);
            return () => clearTimeout(timer);
        }
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [isLoaded, nodes.length > 0]);

    // ── 5. Node drag → D3 ─────────────────────────────────────────────────
    const onNodeDragStart = useCallback((_: any, node: Node) => {
        const sn = simNodesRef.current.find(n => n.id === node.id);
        if (sn) { sn.fx = node.position.x; sn.fy = node.position.y; simulationRef.current?.alphaTarget(0.3).restart(); }
    }, []);
    const onNodeDrag = useCallback((_: any, node: Node) => {
        const sn = simNodesRef.current.find(n => n.id === node.id);
        if (sn) { sn.fx = node.position.x; sn.fy = node.position.y; }
    }, []);
    const onNodeDragStop = useCallback((_: any, node: Node) => {
        const sn = simNodesRef.current.find(n => n.id === node.id);
        if (sn) { sn.fx = null; sn.fy = null; simulationRef.current?.alphaTarget(0); }
    }, []);

    // ── 6. Save ────────────────────────────────────────────────────────────
    const saveGraph = useCallback(async () => {
        if (!file?.id || !isLoaded) return;
        setSaveStatus('saving');
        const data: GraphFileData = {
            version: 2,
            colorOverrides,
            pinnedFiles: Array.from(fileMapRef.current.values()),
            tagChains,
            hiddenTags
        };
        console.log('[GraphView] saving data:', JSON.stringify(data).slice(0, 400));
        try {
            await getElectron().updateFileText(file.id, { mimeType: file.mimeType || 'application/vnd.synapse.graph', body: JSON.stringify(data, null, 2) });
            setSaveStatus('saved');
            setTimeout(() => setSaveStatus('idle'), 2000);
        } catch {
            setSaveStatus('error');
            setTimeout(() => setSaveStatus('idle'), 3000);
        }
    }, [file?.id, isLoaded, colorOverrides, tagChains, hiddenTags]);

    // ── 7. Ctrl+S ──────────────────────────────────────────────────────────
    const onKeyDown = useCallback((e: React.KeyboardEvent<HTMLDivElement>) => {
        if (e.ctrlKey && (e.key === 's' || e.key === 'S')) { e.preventDefault(); void saveGraph(); }
    }, [saveGraph]);

    const saveLabel = saveStatus === 'saving' ? t.canvas.panel.saving
        : saveStatus === 'saved' ? t.canvas.panel.saved
        : saveStatus === 'error' ? t.canvas.panel.loadError
        : t.graph.saveShortcut;

    if (!isLoaded) return (
        <div className="w-full h-full flex items-center justify-center bg-theme-950 text-theme-500 text-sm">{t.graph.loading}</div>
    );

    return (
        <div
            className="w-full h-full relative bg-theme-900 overflow-hidden isolate outline-none"
            tabIndex={0} onKeyDown={onKeyDown}
            onDrop={onDrop}
            onDragOver={e => { e.preventDefault(); e.dataTransfer.dropEffect = 'copy'; }}
        >
            <ReactFlow
                nodes={nodes} edges={edges}
                nodeTypes={nodeTypes} edgeTypes={edgeTypes}
                onNodesChange={onNodesChange} onEdgesChange={onEdgesChange}
                onNodeDragStart={onNodeDragStart} onNodeDrag={onNodeDrag} onNodeDragStop={onNodeDragStop}
                fitView minZoom={0.1} maxZoom={2} colorMode={isDarkTheme(theme) ? 'dark' : 'light'}
            >
                <Background color={isDarkTheme(theme) ? '#555555' : '#aaaaaa'} size={1.5} gap={24} />
                <Controls />
                {/* Save button — matches canvas style, top-center */}
                <Panel position="top-center">
                    <button
                        onClick={() => void saveGraph()}
                        title={saveLabel}
                        className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg border text-xs font-medium shadow-lg transition-all backdrop-blur-sm ${
                            saveStatus === 'saved' ? 'bg-green-900/60 border-green-600 text-green-300'
                            : saveStatus === 'error' ? 'bg-red-900/60 border-red-600 text-red-300'
                            : 'bg-theme-900/90 border-theme-700 text-theme-400 hover:text-theme-200 hover:border-theme-500'
                        }`}
                    >
                        <Save size={12} />
                        {saveLabel}
                    </button>
                </Panel>
            </ReactFlow>

            {/* Side panel — absolute overlay, independent of ReactFlow */}
            <GraphSidePanel
                currentWorkspaceId={currentWorkspaceId}
                files={allFiles}
                colorOverrides={colorOverrides}
                onColorOverridesChange={setColorOverrides}
                tagChains={tagChains}
                onTagChainsChange={setTagChains}
                hiddenTags={hiddenTags}
                onHiddenTagsChange={setHiddenTags}
                onRefreshRequest={refreshWorkspace}
                onRemoveFile={removeFile}
            />
        </div>
    );
};

const GraphViewEditor: React.FC<GraphViewEditorProps> = (props) => (
    <ReactFlowProvider>
        <GraphViewEditorContent {...props} />
    </ReactFlowProvider>
);

export default React.memo(GraphViewEditor);
