import React, { useState, useRef, useCallback } from 'react';
import {
    GripHorizontal, Tag as TagIcon,
    Search, ChevronDown, ChevronUp, X, Plus, Star, Trash2,
    Eye, EyeOff
} from 'lucide-react';
import type { DriveFile } from '../../../../shared/types';
import { getDynamicIcon } from '../../../utils/icons';
import ColorPalettePanel from '../../shared/ColorPalettePanel';
import { t } from '../../../../language';

interface TagChain {
    id: string; name: string; tags: string[]; isPrimary: boolean;
    edgeColor?: string;      // line colour = node border colour
    nodeBgColor?: string;    // tag node background
    nodeTextColor?: string;  // tag node text / label
    isHidden?: boolean;
}
interface GraphColorOverrides { tag?: string; file?: string }

interface GraphSidePanelProps {
    currentWorkspaceId: string;
    files: DriveFile[];
    colorOverrides: GraphColorOverrides;
    onColorOverridesChange: (v: GraphColorOverrides) => void;
    tagChains: TagChain[];
    onTagChainsChange: (chains: TagChain[]) => void;
    hiddenTags: string[];
    onHiddenTagsChange: (tags: string[]) => void;
    onRefreshRequest: () => void;
    onRemoveFile: (id: string) => void;
}

const TYPE_PRESETS = {
    tag:  [
        { key: 'violet',  color: '#8b5cf6' }, { key: 'emerald', color: '#059669' },
        { key: 'blue',    color: '#3b82f6' }, { key: 'amber',   color: '#f59e0b' },
        { key: 'pink',    color: '#ec4899' }, { key: 'teal',    color: '#14b8a6' },
        { key: 'orange',  color: '#f97316' },
    ],
    file: [
        { key: 'slate',  color: '#475569' }, { key: 'zinc',   color: '#71717a' },
        { key: 'blue',   color: '#1d4ed8' }, { key: 'indigo', color: '#4338ca' },
    ],
};

function getElectron() {
    return (window as any).electron as {
        addTag:    (id: string, tag: string, wsId: string) => Promise<void>;
        removeTag: (id: string, tag: string) => Promise<void>;
        getTags:   (wsId: string) => Promise<{ id: string; name: string }[]>;
    };
}

// ─────────────────────────────────────────────────────────────────────────────

const GraphSidePanel: React.FC<GraphSidePanelProps> = ({
    currentWorkspaceId, files, colorOverrides, onColorOverridesChange,
    tagChains, onTagChainsChange, onRefreshRequest, onRemoveFile,
    hiddenTags, onHiddenTagsChange
}) => {
    const panelRef   = useRef<HTMLDivElement>(null);
    const [position, setPosition]   = useState({ x: 20, y: 20 });
    const [collapsed, setCollapsed] = useState(false);
    const isDragging  = useRef(false);
    const dragOffset  = useRef({ x: 0, y: 0 });

    const [activeTab,    setActiveTab]    = useState<'tags' | 'files' | 'chains' | 'colors'>('tags');
    const [search,       setSearch]       = useState('');
    const [expandedId,   setExpandedId]   = useState<string | null>(null);
    const [newTagInput,  setNewTagInput]  = useState('');
    const [recentTags,   setRecentTags]   = useState<{ id: string; name: string }[]>([]);
    const [newChainName, setNewChainName] = useState('');
    const [newChainTag,  setNewChainTag]  = useState('');
    const [editingChainId, setEditingChainId] = useState<string | null>(null);
    const [expandedChainColorId, setExpandedChainColorId] = useState<string | null>(null);

    // Fetch tags for suggestions
    React.useEffect(() => {
        if (activeTab === 'files' && expandedId) {
            getElectron().getTags(currentWorkspaceId).then(setRecentTags).catch(console.error);
        }
    }, [activeTab, expandedId, currentWorkspaceId]);

    // ── Derived ──────────────────────────────────────────────────────────
    const tagStats = React.useMemo(() => {
        const m = new Map<string, number>();
        files.forEach(f => f.tags?.forEach(tag => m.set(tag, (m.get(tag) ?? 0) + 1)));
        return Array.from(m.entries()).map(([tag, count]) => ({ tag, count })).sort((a, b) => b.count - a.count);
    }, [files]);

    const allTags = React.useMemo(() => tagStats.map(ts => ts.tag), [tagStats]);

    const filteredFiles = React.useMemo(() => {
        const q = search.toLowerCase();
        return q ? files.filter(f => f.name.toLowerCase().includes(q) || f.tags?.some(tag => tag.toLowerCase().includes(q))) : files;
    }, [files, search]);

    const tagColor  = colorOverrides.tag  ?? '#8b5cf6';
    const fileColor = colorOverrides.file ?? '#475569';

    // ── Panel drag ──────────────────────────────────────────────────────
    const handlePointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
        isDragging.current = true;
        if (panelRef.current) {
            const r = panelRef.current.getBoundingClientRect();
            dragOffset.current = { x: e.clientX - r.left, y: e.clientY - r.top };
            e.currentTarget.setPointerCapture(e.pointerId);
        }
    };
    const handlePointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
        if (!isDragging.current || !panelRef.current?.parentElement) return;
        const pr = panelRef.current.parentElement.getBoundingClientRect();
        setPosition({
            x: Math.max(0, Math.min(e.clientX - pr.left - dragOffset.current.x, pr.width  - panelRef.current.offsetWidth)),
            y: Math.max(0, Math.min(e.clientY - pr.top  - dragOffset.current.y, pr.height - panelRef.current.offsetHeight)),
        });
    };
    const handlePointerUp = (e: React.PointerEvent<HTMLDivElement>) => {
        isDragging.current = false;
        e.currentTarget.releasePointerCapture(e.pointerId);
    };

    // ── Tag actions ─────────────────────────────────────────────────────
    const handleAddTag = useCallback(async (fileId: string, tagName?: string) => {
        const tag = (tagName || newTagInput).trim();
        if (!tag) return;
        await getElectron().addTag(fileId, tag, currentWorkspaceId);
        setNewTagInput('');
        onRefreshRequest();
    }, [newTagInput, currentWorkspaceId, onRefreshRequest]);

    const handleRemoveTag = useCallback(async (fileId: string, tag: string) => {
        await getElectron().removeTag(fileId, tag);
        onRefreshRequest();
    }, [onRefreshRequest]);

    const toggleTagVisibility = (tag: string) => {
        if (hiddenTags.includes(tag)) onHiddenTagsChange(hiddenTags.filter(t => t !== tag));
        else onHiddenTagsChange([...hiddenTags, tag]);
    };

    const toggleChainVisibility = (chainId: string) => {
        onTagChainsChange(tagChains.map(c => c.id === chainId ? { ...c, isHidden: !c.isHidden } : c));
    };

    // ── Chain actions ───────────────────────────────────────────────────
    const createChain = useCallback(() => {
        if (!newChainName.trim()) return;
        const chain: TagChain = {
            id: `chain-${Date.now()}`,
            name: newChainName.trim(),
            tags: [],
            isPrimary: tagChains.length === 0,
            edgeColor: '#f59e0b',
            nodeBgColor: '#f59e0b33',
            nodeTextColor: '#f59e0b'
        };
        onTagChainsChange([...tagChains, chain]);
        setNewChainName('');
        setEditingChainId(chain.id);
    }, [newChainName, tagChains, onTagChainsChange]);

    const addTagToChain = useCallback((chainId: string) => {
        if (!newChainTag) return;
        onTagChainsChange(tagChains.map(c => c.id === chainId ? { ...c, tags: c.tags.includes(newChainTag) ? c.tags : [...c.tags, newChainTag] } : c));
        setNewChainTag('');
    }, [newChainTag, tagChains, onTagChainsChange]);

    const removeTagFromChain = useCallback((chainId: string, tag: string) =>
        onTagChainsChange(tagChains.map(c => c.id === chainId ? { ...c, tags: c.tags.filter(tg => tg !== tag) } : c)),
    [tagChains, onTagChainsChange]);

    const deleteChain = useCallback((chainId: string) => {
        let remaining = tagChains.filter(c => c.id !== chainId);
        if (tagChains.find(c => c.id === chainId)?.isPrimary && remaining.length > 0) remaining[0] = { ...remaining[0], isPrimary: true };
        onTagChainsChange(remaining);
    }, [tagChains, onTagChainsChange]);

    const setPrimaryChain = useCallback((chainId: string) =>
        onTagChainsChange(tagChains.map(c => ({ ...c, isPrimary: c.id === chainId }))),
    [tagChains, onTagChainsChange]);

    const moveTagInChain = useCallback((chainId: string, idx: number, dir: -1 | 1) => {
        onTagChainsChange(tagChains.map(c => {
            if (c.id !== chainId) return c;
            const tags = [...c.tags]; const target = idx + dir;
            if (target < 0 || target >= tags.length) return c;
            [tags[idx], tags[target]] = [tags[target], tags[idx]];
            return { ...c, tags };
        }));
    }, [tagChains, onTagChainsChange]);

    const setChainColors = useCallback((chainId: string, edge: string, bg: string, text: string) =>
        onTagChainsChange(tagChains.map(c => c.id === chainId ? { ...c, edgeColor: edge, nodeBgColor: bg, nodeTextColor: text } : c)),
    [tagChains, onTagChainsChange]);

    // ── Render ──────────────────────────────────────────────────────────
    return (
        <div
            ref={panelRef}
            className={`absolute z-50 bg-theme-800/90 backdrop-blur-md border border-theme-700/50 rounded-xl shadow-2xl flex flex-col text-theme-200 text-sm overflow-hidden transition-[width,height,background-color] duration-300 ease-in-out ${collapsed ? 'w-48 h-[44px]' : 'w-72'}`}
            style={{ left: position.x, top: position.y }}
        >
            {/* Header */}
            <div
                className="flex items-center justify-between px-4 py-3 bg-theme-900/80 border-b border-theme-700/50 cursor-move touch-none shrink-0"
                onPointerDown={handlePointerDown} onPointerMove={handlePointerMove}
                onPointerUp={handlePointerUp} onPointerCancel={handlePointerUp}
            >
                <div className="flex items-center gap-2 font-semibold tracking-wide text-xs text-theme-300">
                    <GripHorizontal className="w-4 h-4 text-theme-500" />
                    {t.graph.panel.title}
                </div>
                <div className="flex items-center gap-2">
                    <span className="text-[10px] text-theme-500">{files.length} · {tagStats.length} · {tagChains.length}</span>
                    <button 
                        onClick={(e) => { e.stopPropagation(); setCollapsed(v => !v); }} 
                        onPointerDown={(e) => e.stopPropagation()}
                        className="text-theme-400 hover:text-theme-200 transition-colors p-0.5"
                    >
                        {collapsed ? <ChevronDown className="w-4 h-4" /> : <ChevronUp className="w-4 h-4" />}
                    </button>
                </div>
            </div>

            {/* Body — only visible when not collapsed */}
            {!collapsed && (
                <div className="flex flex-col" style={{ maxHeight: '75vh' }}>
                    {/* Tab bar */}
                    <div className="flex border-b border-theme-700/50 shrink-0">
                        {([
                            { id: 'tags',   label: t.graph.panel.tabTags   },
                            { id: 'files',  label: t.graph.panel.tabFiles  },
                            { id: 'chains', label: t.graph.panel.tabChains },
                            { id: 'colors', label: t.graph.panel.tabColors },
                        ] as const).map(({ id, label }) => (
                            <button key={id} onClick={() => setActiveTab(id)}
                                className={`flex-1 py-2 text-[11px] font-medium transition-colors whitespace-nowrap ${activeTab === id ? 'text-primary-text border-b-2 border-primary-main bg-primary-main/10' : 'text-theme-400 hover:text-theme-200'}`}>
                                {label}
                            </button>
                        ))}
                    </div>

                    {/* Search */}
                    {(activeTab === 'tags' || activeTab === 'files') && (
                        <div className="px-3 py-2 border-b border-theme-700/30 shrink-0">
                            <div className="flex items-center gap-2 bg-theme-900/60 rounded-lg px-2 py-1.5">
                                <Search className="w-3.5 h-3.5 text-theme-500 shrink-0" />
                                <input value={search} onChange={e => setSearch(e.target.value)}
                                    placeholder={activeTab === 'tags' ? t.graph.panel.searchTags : t.graph.panel.searchFiles}
                                    className="flex-1 bg-transparent text-xs placeholder-theme-500 focus:outline-none" />
                            </div>
                        </div>
                    )}

                    {/* Scrollable content */}
                    <div className="flex-1 overflow-y-auto">

                        {/* ─ Tags ─ */}
                        {activeTab === 'tags' && (
                            <div className="p-3 flex flex-col gap-2">
                                {tagStats.filter(ts => !search || ts.tag.toLowerCase().includes(search.toLowerCase())).map(({ tag, count }) => (
                                    <div key={tag} className="flex items-center justify-between rounded-lg px-3 py-2 bg-theme-900/50 border border-theme-700/30">
                                        <div className="flex items-center gap-2">
                                            <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ background: tagColor, opacity: hiddenTags.includes(tag) ? 0.3 : 1 }} />
                                            <span className={`text-xs font-medium transition-opacity ${hiddenTags.includes(tag) ? 'opacity-40 line-through' : ''}`}>#{tag}</span>
                                        </div>
                                        <div className="flex items-center gap-2">
                                            <span className="text-[10px] text-theme-500 mr-1">{count}</span>
                                            <button 
                                                onClick={() => toggleTagVisibility(tag)}
                                                title={hiddenTags.includes(tag) ? t.graph.panel.show : t.graph.panel.hide}
                                                className="text-theme-500 hover:text-theme-300 transition-colors p-1"
                                            >
                                                {hiddenTags.includes(tag) ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                                            </button>
                                        </div>
                                    </div>
                                ))}
                                {tagStats.length === 0 && <div className="text-center py-8 text-xs text-theme-500">{t.graph.panel.noTags}</div>}
                            </div>
                        )}

                        {/* ─ Files ─ */}
                        {activeTab === 'files' && (
                            <div className="p-2 flex flex-col gap-1">
                                {filteredFiles.length === 0 && <div className="text-center py-8 text-xs text-theme-500">{t.graph.panel.noFiles}</div>}
                                {filteredFiles.map(f => (
                                    <div key={f.id} className="bg-theme-900/50 rounded-lg overflow-hidden border border-theme-700/30">
                                        <div className="flex items-center gap-3 px-3 py-2 cursor-pointer hover:bg-theme-700/50 transition-colors"
                                            onClick={() => setExpandedId(expandedId === f.id ? null : f.id)}>
                                            {getDynamicIcon(f.mimeType, f.name, f.description)}
                                            <div className="flex-1 truncate text-xs font-medium text-theme-300">{f.name}</div>
                                            {(f.tags?.length ?? 0) > 0 && (
                                                <div className="text-[10px] bg-theme-700/50 text-theme-400 px-2 py-0.5 rounded-full flex items-center gap-1 shrink-0">
                                                    <TagIcon className="w-3 h-3" />{f.tags!.length}
                                                </div>
                                            )}
                                            <button 
                                                onClick={(e) => { e.stopPropagation(); onRemoveFile(f.id); }}
                                                onPointerDown={(e) => e.stopPropagation()}
                                                title={t.graph.panel.remove}
                                                className="text-theme-500 hover:text-danger-main transition-colors p-1"
                                            >
                                                <Trash2 className="w-3.5 h-3.5" />
                                            </button>
                                        </div>
                                        {expandedId === f.id && (
                                            <div className="px-3 pb-3 pt-1 border-t border-theme-700/30 bg-theme-950/30">
                                                <div className="flex flex-wrap gap-1 mb-2 mt-1">
                                                    {f.tags?.map(tag => (
                                                        <span key={tag} className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs border"
                                                            style={{ background: tagColor + '22', borderColor: tagColor + '66', color: tagColor }}>
                                                            #{tag}
                                                            <button onClick={() => handleRemoveTag(f.id, tag)} className="hover:opacity-70"><X className="w-3 h-3" /></button>
                                                        </span>
                                                    ))}
                                                    {!f.tags?.length && <span className="text-xs text-theme-500 italic py-1">{t.graph.panel.noTags}</span>}
                                                </div>
                                                <div className="flex gap-1 relative">
                                                    <input type="text" value={newTagInput} onChange={e => setNewTagInput(e.target.value)}
                                                        onKeyDown={e => e.key === 'Enter' && handleAddTag(f.id)}
                                                        placeholder={t.graph.panel.addTagPlaceholder}
                                                        className="flex-1 bg-theme-900 border border-theme-700 rounded px-2 py-1 text-xs focus:outline-none focus:border-primary-main" />
                                                    <button onClick={() => handleAddTag(f.id)} className="bg-primary-main hover:bg-primary-hover text-theme-50 rounded px-2 py-1 transition-colors">
                                                        <Plus className="w-3 h-3" />
                                                    </button>
                                                    
                                                    {/* Tag Suggestions */}
                                                    {newTagInput && (
                                                        <div className="absolute bottom-full left-0 w-full mb-1 bg-theme-900 border border-theme-700 rounded-lg shadow-xl overflow-hidden z-10 max-h-32 overflow-y-auto custom-scrollbar animate-in slide-in-from-bottom-2 duration-200">
                                                            {recentTags.filter(rt => !f.tags?.includes(rt.name) && rt.name.toLowerCase().includes(newTagInput.toLowerCase())).length > 0 ? (
                                                                recentTags.filter(rt => !f.tags?.includes(rt.name) && rt.name.toLowerCase().includes(newTagInput.toLowerCase())).map(rt => (
                                                                    <button key={rt.id} 
                                                                        onClick={() => handleAddTag(f.id, rt.name)}
                                                                        className="w-full text-left px-3 py-1.5 text-[11px] hover:bg-theme-700 text-theme-300 transition-colors">
                                                                        #{rt.name}
                                                                    </button>
                                                                ))
                                                            ) : (
                                                                <button onClick={() => handleAddTag(f.id)}
                                                                    className="w-full text-left px-3 py-1.5 text-[11px] hover:bg-theme-700 text-primary-text font-medium">
                                                                    {t.sidebar.addTagHint}: {newTagInput}
                                                                </button>
                                                            )}
                                                        </div>
                                                    )}
                                                </div>
                                            </div>
                                        )}
                                    </div>
                                ))}
                            </div>
                        )}

                        {/* ─ Chains ─ */}
                        {activeTab === 'chains' && (
                            <div className="p-3 flex flex-col gap-3">
                                <div className="flex gap-1">
                                    <input value={newChainName} onChange={e => setNewChainName(e.target.value)}
                                        onKeyDown={e => e.key === 'Enter' && createChain()}
                                        placeholder={t.graph.panel.newChainName}
                                        className="flex-1 bg-theme-900 border border-theme-700 rounded px-2 py-1 text-xs focus:outline-none focus:border-primary-main" />
                                    <button onClick={createChain} className="bg-primary-main hover:bg-primary-hover text-theme-50 rounded px-2 py-1 transition-colors flex items-center gap-1 text-xs">
                                        <Plus className="w-3 h-3" />{t.graph.panel.create}
                                    </button>
                                </div>

                                {tagChains.length === 0 && <div className="text-center py-6 text-xs text-theme-500">{t.graph.panel.noChains}</div>}

                                {tagChains.map(chain => {
                                    const edgeColor = chain.edgeColor ?? '#f59e0b';
                                    return (
                                        <div key={chain.id} className="rounded-lg border p-3"
                                            style={{ borderColor: edgeColor + '60', background: edgeColor + '08' }}>
                                            {/* Chain header */}
                                            <div className="flex items-center gap-2 mb-2">
                                                <button 
                                                    onClick={(e) => { e.stopPropagation(); toggleChainVisibility(chain.id); }}
                                                    onPointerDown={(e) => e.stopPropagation()}
                                                    className="text-theme-500 hover:text-theme-300 transition-colors p-1"
                                                    title={chain.isHidden ? t.graph.panel.show : t.graph.panel.hide}
                                                >
                                                    {chain.isHidden ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                                                </button>
                                        <div className={`flex-1 flex items-center gap-2 min-w-0 transition-opacity ${chain.isHidden ? 'opacity-40' : ''}`}>
                                            {chain.isPrimary && <Star className="w-3.5 h-3.5 text-warning-main shrink-0 fill-warning-main" />}
                                            <input
                                                value={chain.name}
                                                onChange={e => onTagChainsChange(tagChains.map(c => c.id === chain.id ? { ...c, name: e.target.value } : c))}
                                                className="flex-1 bg-transparent text-xs font-semibold text-theme-200 focus:outline-none min-w-0"
                                            />
                                        </div>
                                                <ColorPalettePanel
                                                    currentBg={chain.nodeBgColor ?? (edgeColor + '33')}
                                                    currentBorder={edgeColor}
                                                    currentText={chain.nodeTextColor ?? edgeColor}
                                                    showPicker={false}
                                                    hideCustom={true}
                                                    toggleMode="color"
                                                    expanded={expandedChainColorId === chain.id}
                                                    onToggleExpand={v => setExpandedChainColorId(v ? chain.id : null)}
                                                    targetLabels={{
                                                        border: t.graph.panel.chainColor,
                                                        bg: t.graph.panel.colorBg,
                                                        text: t.graph.panel.colorText
                                                    }}
                                                    onChange={(bg, edge, txt) => setChainColors(chain.id, edge, bg, txt)}
                                                />
                                                <button onClick={() => setPrimaryChain(chain.id)} title={t.graph.panel.setPrimary}
                                                    className={`transition-colors ${chain.isPrimary ? 'text-warning-main' : 'text-theme-500 hover:text-warning-main'}`}>
                                                    <Star className="w-3.5 h-3.5" />
                                                </button>
                                                <button onClick={() => setEditingChainId(editingChainId === chain.id ? null : chain.id)}
                                                    className="text-theme-500 hover:text-primary-text transition-colors">
                                                    <Plus className="w-3.5 h-3.5" />
                                                </button>
                                                <button onClick={() => deleteChain(chain.id)} className="text-theme-500 hover:text-danger-main transition-colors">
                                                    <Trash2 className="w-3.5 h-3.5" />
                                                </button>
                                            </div>

                                            {/* Tags in chain */}
                                            <div className="flex flex-wrap gap-1 mb-2 min-h-[24px]">
                                                {chain.tags.length === 0 && <span className="text-[10px] text-theme-500 italic">{t.graph.panel.chainEmpty}</span>}
                                                {chain.tags.map((tag, idx) => (
                                                    <span key={tag} className="inline-flex items-center gap-0.5 bg-theme-800 border border-theme-600 rounded px-1.5 py-0.5 text-[10px] text-theme-300">
                                                        {idx > 0 && <button onClick={() => moveTagInChain(chain.id, idx, -1)} className="hover:text-white opacity-50 hover:opacity-100 px-0.5">◀</button>}
                                                        #{tag}
                                                        {idx < chain.tags.length - 1 && <button onClick={() => moveTagInChain(chain.id, idx, 1)} className="hover:text-white opacity-50 hover:opacity-100 px-0.5">▶</button>}
                                                        <button onClick={() => removeTagFromChain(chain.id, tag)} className="ml-0.5 hover:text-danger-main opacity-60 hover:opacity-100"><X className="w-2.5 h-2.5" /></button>
                                                    </span>
                                                ))}
                                            </div>

                                            {/* Add tag dropdown — fixed width, truncate overflow */}
                                            {editingChainId === chain.id && (
                                                <div className="flex gap-1 mt-1">
                                                    <div className="flex-1 min-w-0">
                                                        <select value={newChainTag} onChange={e => setNewChainTag(e.target.value)}
                                                            className="w-full bg-theme-900 border border-theme-700 rounded px-2 py-1 text-xs focus:outline-none focus:border-primary-main text-theme-200 overflow-hidden text-ellipsis">
                                                            <option value="">{t.graph.panel.selectTag}</option>
                                                            {allTags.filter(tg => !chain.tags.includes(tg)).map(tg => (
                                                                <option key={tg} value={tg} style={{ maxWidth: '200px' }}>#{tg}</option>
                                                            ))}
                                                        </select>
                                                    </div>
                                                    <button onClick={() => addTagToChain(chain.id)}
                                                        className="shrink-0 bg-primary-main hover:bg-primary-hover text-theme-50 rounded px-2 py-1 transition-colors">
                                                        <Plus className="w-3 h-3" />
                                                    </button>
                                                </div>
                                            )}

                                            {/* Picker-only panel relocated below selection */}
                                            <ColorPalettePanel
                                                currentBg={chain.nodeBgColor ?? (edgeColor + '33')}
                                                currentBorder={edgeColor}
                                                currentText={chain.nodeTextColor ?? edgeColor}
                                                showSwatches={false}
                                                hideCustom={true}
                                                expanded={expandedChainColorId === chain.id}
                                                targetLabels={{
                                                    border: t.graph.panel.chainColor,
                                                    bg: t.graph.panel.colorBg,
                                                    text: t.graph.panel.colorText
                                                }}
                                                onChange={(bg, edge, txt) => setChainColors(chain.id, edge, bg, txt)}
                                            />
                                        </div>
                                    );
                                })}
                            </div>
                        )}

                        {/* ─ Colors ─ */}
                        {activeTab === 'colors' && (
                            <div className="p-3 flex flex-col gap-4">
                                <div className="bg-theme-900/50 rounded-lg p-3 border border-theme-700/30">
                                    <div className="flex items-center gap-2 mb-2">
                                        <span className="w-2.5 h-2.5 rounded-full" style={{ background: tagColor }} />
                                        <span className="text-xs font-semibold text-theme-300">{t.graph.panel.tagNodeColor}</span>
                                    </div>
                                    {/* Only show border (main hue) channel — hide bg/text */}
                                    <ColorPalettePanel
                                        currentBg={tagColor + '33'} currentBorder={tagColor} currentText={tagColor}
                                        presets={TYPE_PRESETS.tag.map(p => ({ ...p, label: p.key }))}
                                        targetLabels={{ bg: t.graph.panel.colorBg, border: t.graph.panel.colorMain, text: t.graph.panel.colorText }}
                                        visibleTargets={['border']}
                                        onApplyPreset={key => { const p = TYPE_PRESETS.tag.find(x => x.key === key); if (p) onColorOverridesChange({ ...colorOverrides, tag: p.color }); }}
                                        onChange={(_, border) => onColorOverridesChange({ ...colorOverrides, tag: border })}
                                    />
                                </div>
                                <div className="bg-theme-900/50 rounded-lg p-3 border border-theme-700/30">
                                    <div className="flex items-center gap-2 mb-2">
                                        <span className="w-2.5 h-2.5 rounded-full" style={{ background: fileColor }} />
                                        <span className="text-xs font-semibold text-theme-300">{t.graph.panel.fileNodeColor}</span>
                                    </div>
                                    <ColorPalettePanel
                                        currentBg={fileColor + '22'} currentBorder={fileColor} currentText="#e2e8f0"
                                        presets={TYPE_PRESETS.file.map(p => ({ ...p, label: p.key }))}
                                        targetLabels={{ bg: t.graph.panel.colorBg, border: t.graph.panel.colorMain, text: t.graph.panel.colorText }}
                                        visibleTargets={['border']}
                                        onApplyPreset={key => { const p = TYPE_PRESETS.file.find(x => x.key === key); if (p) onColorOverridesChange({ ...colorOverrides, file: p.color }); }}
                                        onChange={(_, border) => onColorOverridesChange({ ...colorOverrides, file: border })}
                                    />
                                </div>
                                <p className="text-[10px] text-theme-500 text-center">{t.graph.panel.colorSaveHint}</p>
                            </div>
                        )}
                    </div>
                </div>
            )}
        </div>
    );
};

export default GraphSidePanel;
