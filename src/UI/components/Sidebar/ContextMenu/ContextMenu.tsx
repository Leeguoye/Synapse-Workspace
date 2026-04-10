import { useState, useEffect, useRef } from 'react';
import { Edit2, Scissors, Copy, ClipboardPaste, Star, Trash2, Info, X, Tag as TagIcon, Plus, ChevronRight } from 'lucide-react';
import { t } from '../../../../language';

import {
    CONTEXT_MENU_MAX_HEIGHT,
    CONTEXT_MENU_MAIN_WIDTH_CLASS,
    CONTEXT_OFFSET_RENAME,
    CONTEXT_OFFSET_DELETE,
    CONTEXT_OFFSET_PROPERTIES,
    CONTEXT_OFFSET_TAGS,
    CONTEXT_SUBMENU_WIDTH_RENAME,
    CONTEXT_SUBMENU_WIDTH_DELETE,
    CONTEXT_SUBMENU_WIDTH_PROPERTIES,
    CONTEXT_SUBMENU_WIDTH_TAGS,
    TAG_LIST_MAX_HEIGHT,
    TAG_PADDING
} from '../Constants/Sidebar.constants';
import type { DriveFile, Tag } from '../../../../shared/types';

declare global {
    interface Window {
        electron: any;
    }
}

interface ContextMenuProps {
    x: number;
    y: number;
    file?: DriveFile;
    rootName: string;
    clipboard: any;
    onClose: () => void;
    onEdit: (file: DriveFile) => void;
    onCut: (file: DriveFile) => void;
    onCopy: (file: DriveFile) => void;
    onPaste: (file?: DriveFile) => void;
    onDelete: (file: DriveFile) => void;
    onRenameSubmit?: (file: DriveFile, newName: string) => void;
    onAddTag: (fileId: string, tagName: string) => Promise<void>;
    onRemoveTag: (fileId: string, tagName: string) => Promise<void>;
    currentWorkspaceId?: string;
    onFileUpdate: (file: DriveFile) => void;
}

export function ContextMenu({
    x, y, file, rootName, clipboard,
    onClose, onEdit, onCut, onCopy, onPaste, onDelete, onRenameSubmit,
    onAddTag, onRemoveTag, currentWorkspaceId, onFileUpdate
}: ContextMenuProps) {
    const menuRef = useRef<HTMLDivElement>(null);

    // 用來控制子選單 (Tag 新增視窗)
    const [tagInput, setTagInput] = useState('');
    const [recentTags, setRecentTags] = useState<Tag[]>([]);
    const [isSubmitting, setIsSubmitting] = useState(false);

    const [activeSubMenu, setActiveSubMenu] = useState<'rename' | 'properties' | 'delete' | 'tags' | null>(null);
    const [stickySubMenu, setStickySubMenu] = useState<'rename' | 'properties' | 'delete' | 'tags' | null>(null);
    const [renameInput, setRenameInput] = useState('');

    useEffect(() => {
        if (file) setRenameInput(file.name);
    }, [file]);

    // 點擊外部關閉
    useEffect(() => {
        const handleClickOutside = (e: MouseEvent) => {
            // 避免點到彈出的子選單關閉
            if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
                onClose();
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, [onClose]);

    // 載入近期標籤
    useEffect(() => {
        if (activeSubMenu === 'tags') {
            window.electron.getTags(currentWorkspaceId).then(setRecentTags).catch(console.error);
        }
    }, [activeSubMenu, currentWorkspaceId]);

    // 過濾標籤 
    const filteredTags = recentTags.filter(t => t.name.toLowerCase().includes(tagInput.toLowerCase()));

    const [localTags, setLocalTags] = useState<string[]>([]);

    useEffect(() => {
        if (file && file.tags) {
            setLocalTags(file.tags);
        } else {
            setLocalTags([]);
        }
    }, [file]);

    useEffect(() => {
        const handleTagsUpdated = (e: CustomEvent<{ fileId: string, tags: string[] }>) => {
            if (file && e.detail.fileId === file.id) {
                setLocalTags(e.detail.tags);
            }
        };
        window.addEventListener('tags-updated', handleTagsUpdated as EventListener);
        return () => window.removeEventListener('tags-updated', handleTagsUpdated as EventListener);
    }, [file]);

    const handleAddNewTag = async (tagName: string) => {
        const targetId = file ? file.id : currentWorkspaceId;
        if (!targetId || !tagName.trim() || isSubmitting) return;
        setIsSubmitting(true);
        const newTag = tagName.trim();
        try {
            const updatedTags = localTags.includes(newTag) ? localTags : [...localTags, newTag];
            setLocalTags(updatedTags);
            await onAddTag(targetId, newTag);
            window.dispatchEvent(new CustomEvent('tags-updated', { detail: { fileId: targetId, tags: updatedTags } }));
            setTagInput('');
            setActiveSubMenu(null);
            setStickySubMenu(null);
        } catch (e) {
            console.error(e);
        } finally {
            setIsSubmitting(false);
        }
    };

    const currentTags = localTags;

    return (
        <div
            ref={menuRef}
            className={`fixed z-50 animate-in fade-in zoom-in-95 duration-100 ${CONTEXT_MENU_MAIN_WIDTH_CLASS}`}
            style={{ top: y, left: x }}
            onMouseLeave={() => {
                // Rule 3: 如果有固定住的子選單，滑鼠移開不關閉
                if (stickySubMenu) return;
                // 若焦點在選單內的輸入框中，不要因為滑鼠移開就關閉選單
                if (menuRef.current?.contains(document.activeElement) && document.activeElement?.tagName === 'INPUT') {
                    return;
                }
                setActiveSubMenu(null);
            }}
        >
            {/* 母選單的捲動容器 (將 overflow 與 absolute 脫離) */}
            <div
                className="w-full bg-theme-800 border border-theme-700 rounded-lg shadow-2xl py-0 text-sm text-theme-300 overflow-y-auto overflow-x-hidden custom-scrollbar"
                style={{ maxHeight: CONTEXT_MENU_MAX_HEIGHT }}
                dir="rtl"
            >
                <div dir="ltr" className="py-1">
                    <div
                        className="px-3 py-2 border-b border-theme-700 text-xs text-theme-400 font-bold truncate"
                        onMouseEnter={() => { setActiveSubMenu(null); setStickySubMenu(null); }}
                    >
                        {file ? file.name : `ROOT: ${rootName}`}
                    </div>

                    {file && file.canEdit !== false && (
                        <button
                            onMouseEnter={() => { setActiveSubMenu('rename'); setStickySubMenu(null); }}
                            onClick={(e) => {
                                e.stopPropagation();
                                if (file.mimeType === 'application/vnd.synapse.link' || file.mimeType === 'application/vnd.nexus.link') { onEdit(file); onClose(); }
                                else { setStickySubMenu('rename'); }
                            }}
                            className={`w-full text-left px-3 py-1.5 flex items-center justify-between transition-colors ${activeSubMenu === 'rename' ? 'bg-theme-700' : 'hover:bg-theme-700'}`}
                        >
                            <div className="flex items-center gap-2">
                                <Edit2 className="w-4 h-4" />
                                {(file.mimeType === 'application/vnd.synapse.link' || file.mimeType === 'application/vnd.nexus.link') ? t.sidebar.editLink : t.sidebar.rename}
                            </div>
                            {(file.mimeType !== 'application/vnd.synapse.link' && file.mimeType !== 'application/vnd.nexus.link') && <ChevronRight className="w-4 h-4 text-theme-500" />}
                        </button>
                    )}

                    {file && file.mimeType === 'application/vnd.google-apps.folder' && file.canEdit !== false && (
                        <button
                            onMouseEnter={() => { setActiveSubMenu(null); setStickySubMenu(null); }}
                            onClick={(e) => {
                                e.stopPropagation();
                                const newState = !file.isTemplate;
                                // 樂觀更新 UI (直接變更物件參考以確保下一次重新點擊時為最新值)
                                file.isTemplate = newState;
                                onFileUpdate({ ...file });
                                onClose();
                                // 背景執行不 await，避免卡頓 UI
                                window.electron.toggleTemplate(file.id, newState).catch((error: any) => {
                                    console.error('Toggle Template failed:', error);
                                    // 失敗時回復原狀
                                    file.isTemplate = !newState;
                                    onFileUpdate({ ...file });
                                });
                            }}
                            className="w-full text-left px-3 py-1.5 hover:bg-theme-700 flex items-center justify-between transition-colors"
                        >
                            <div className="flex items-center gap-2">
                                <Star className={`w-4 h-4 ${file.isTemplate ? 'fill-warning-main text-warning-main' : 'text-theme-400'}`} />
                                {file.isTemplate ? t.sidebar.unsetTemplate : t.sidebar.setTemplate}
                            </div>
                        </button>
                    )}

                    {file && file.mimeType !== 'application/vnd.google-apps.folder' && (
                        <>
                            <button onMouseEnter={() => { setActiveSubMenu(null); setStickySubMenu(null); }} onClick={() => { onCut(file); onClose(); }} className="w-full text-left px-3 py-1.5 hover:bg-theme-700 flex items-center gap-2"><Scissors className="w-4 h-4" /> {t.common.cut}</button>
                            <button onMouseEnter={() => { setActiveSubMenu(null); setStickySubMenu(null); }} onClick={() => { onCopy(file); onClose(); }} className="w-full text-left px-3 py-1.5 hover:bg-theme-700 flex items-center gap-2"><Copy className="w-4 h-4" /> {t.common.copy}</button>
                        </>
                    )}

                    {(!file || file.mimeType === 'application/vnd.google-apps.folder') && clipboard && (
                        <button onMouseEnter={() => { setActiveSubMenu(null); setStickySubMenu(null); }} onClick={() => { onPaste(file); onClose(); }} className="w-full text-left px-3 py-1.5 hover:bg-theme-700 flex items-center gap-2 text-primary-text font-medium"><ClipboardPaste className="w-4 h-4" /> {t.sidebar.pasteHere}</button>
                    )}

                    {file && file.ownedByMe !== false && !file.trashed && (
                        <button
                            onMouseEnter={() => { setActiveSubMenu('delete'); setStickySubMenu(null); }}
                            onClick={(e) => { e.stopPropagation(); setStickySubMenu('delete'); setActiveSubMenu('delete'); }}
                            className={`w-full text-left px-3 py-1.5 text-danger-main flex items-center justify-between mt-1 transition-colors ${activeSubMenu === 'delete' ? 'bg-danger-hover' : 'hover:bg-danger-hover'}`}
                        >
                            <div className="flex items-center gap-2"><Trash2 className="w-4 h-4" /> {t.sidebar.moveToTrash}</div>
                            <ChevronRight className="w-3.5 h-3.5 text-danger-main" />
                        </button>
                    )}

                    {/* 屬性 */}
                    <div className="relative group" onMouseEnter={() => { setActiveSubMenu('properties'); setStickySubMenu(null); }}>
                        <button
                            className={`w-full text-left px-3 py-1.5 flex items-center justify-between transition-colors ${activeSubMenu === 'properties' ? 'bg-theme-700' : 'hover:bg-theme-700'}`}
                            onClick={(e) => { e.stopPropagation(); setStickySubMenu('properties'); setActiveSubMenu('properties'); }}
                        >
                            <div className="flex items-center gap-2"><Info className="w-4 h-4" /> {t.sidebar.properties}</div>
                            <ChevronRight className="w-3.5 h-3.5 text-theme-500" />
                        </button>
                    </div>

                    {/* 標籤區塊 (屬性之一) */}
                    <div
                        className="px-3 py-2 mt-1 border-t border-theme-700/50 pt-2 cursor-pointer transition-colors hover:bg-theme-700/30"
                        onMouseEnter={() => { setActiveSubMenu('tags'); setStickySubMenu(null); }}
                        onClick={(e) => {
                            e.stopPropagation();
                            setActiveSubMenu('tags');
                            setStickySubMenu('tags');
                        }}
                    >
                        <div className="flex items-center justify-between group relative">
                            <span className="text-xs text-theme-400 font-bold uppercase tracking-wider flex items-center gap-1.5">
                                <TagIcon className="w-3.5 h-3.5" /> {t.sidebar.tags}
                            </span>

                            {/* 如果有實體 file 就判斷 canEdit，如果是 Root 就預設可以 (或是您可以自己加條件) */}
                            {(!file || file.canEdit !== false) && (
                                <button
                                    className="text-theme-500 hover:text-theme-50 transition-colors p-0.5 rounded hover:bg-theme-600"
                                    onClick={(e) => {
                                        e.stopPropagation();
                                        setActiveSubMenu('tags');
                                        setStickySubMenu('tags');
                                    }}
                                >
                                    <Plus className="w-3 h-3" />
                                </button>
                            )}
                        </div>
                    </div>

                    {/* 實際的標籤列表 (Pill Shape) */}
                    <div className="px-3 pb-2 flex flex-wrap gap-2">
                        {currentTags.map(tag => (
                            <div
                                key={tag}
                                onClick={(e) => {
                                    e.stopPropagation();
                                    window.dispatchEvent(new CustomEvent('tag-search', { detail: tag }));
                                    onClose();
                                }}
                                className={`group relative flex items-center bg-theme-700/50 text-theme-300 text-xs ${TAG_PADDING} rounded-full border border-theme-600/50 hover:border-theme-500 transition-colors cursor-pointer overflow-hidden`}
                            >
                                <span>{tag}</span>
                                {(!file || file.canEdit !== false) && (
                                    <button
                                        onClick={(e) => {
                                            const targetId = file ? file.id : currentWorkspaceId;
                                            if (!targetId) return;
                                            e.stopPropagation();
                                            const updatedTags = localTags.filter(t => t !== tag);
                                            setLocalTags(updatedTags);
                                            onRemoveTag(targetId, tag).then(() => {
                                                window.dispatchEvent(new CustomEvent('tags-updated', { detail: { fileId: targetId, tags: updatedTags } }));
                                            }).catch(console.error);
                                        }}
                                        className="absolute right-1.5 top-1/2 -translate-y-1/2 text-theme-400 hover:text-danger-main opacity-0 group-hover:opacity-100 transition-opacity z-10"
                                        title={t.sidebar.removeTag}
                                    >
                                        <X className="w-3.5 h-3.5" />
                                    </button>
                                )}
                            </div>
                        ))}
                        {currentTags.length === 0 && (
                            <span className="text-xs text-theme-600 italic">{t.sidebar.noTags}</span>
                        )}
                    </div>
                </div>
            </div>

            {/* Submenus Rendered OUTSIDE the Mother Menu Scroll Box */}
            {activeSubMenu === 'rename' && file && file.mimeType !== 'application/vnd.synapse.link' && file.mimeType !== 'application/vnd.nexus.link' && (
                <div className={`absolute left-full ml-1 ${CONTEXT_SUBMENU_WIDTH_RENAME} bg-theme-800 border border-theme-600 rounded-lg shadow-xl p-2 z-50 animate-in fade-in`} style={{ bottom: CONTEXT_OFFSET_RENAME }} onClick={e => e.stopPropagation()}>
                    <input
                        type="text"
                        autoFocus
                        value={renameInput}
                        onChange={e => setRenameInput(e.target.value)}
                        onKeyDown={e => {
                            if (e.key === 'Enter') {
                                if (onRenameSubmit) onRenameSubmit(file, renameInput);
                                onClose();
                            }
                        }}
                        className="w-full bg-theme-900 text-sm text-theme-200 px-2 py-1.5 rounded border border-theme-700 focus:outline-none focus:border-primary-main"
                    />
                    <div className="text-xs text-theme-500 mt-2">{t.sidebar.renameHint}</div>
                </div>
            )}

            {activeSubMenu === 'delete' && file && (
                <div className={`absolute left-full ml-1 ${CONTEXT_SUBMENU_WIDTH_DELETE} bg-theme-800 border border-theme-600 rounded-lg shadow-xl p-3 z-50 animate-in fade-in`} style={{ bottom: CONTEXT_OFFSET_DELETE }} onClick={e => e.stopPropagation()}>
                    <div className="text-sm font-bold text-theme-200 mb-1">{t.sidebar.deleteConfirm}</div>
                    <div className="text-xs text-theme-400 mb-3 break-all">{file.name}</div>
                    <button
                        className="w-full bg-danger-main hover:bg-danger-hover text-theme-50 py-1.5 rounded text-xs font-semibold"
                        onClick={() => { onDelete(file); onClose(); }}
                    >
                        {t.sidebar.confirmMoveToTrash}
                    </button>
                </div>
            )}

            {activeSubMenu === 'properties' && (
                <div className={`absolute left-full ml-1 ${CONTEXT_SUBMENU_WIDTH_PROPERTIES} bg-theme-800 border border-theme-600 rounded-lg shadow-xl p-3 z-50 animate-in fade-in cursor-default`} style={{ bottom: CONTEXT_OFFSET_PROPERTIES }} onClick={e => e.stopPropagation()}>
                    <div className="text-sm font-bold text-theme-200 mb-2 border-b border-theme-700 pb-1">{t.sidebar.properties}</div>
                    <div className="grid grid-cols-[60px_1fr] gap-x-2 gap-y-1 text-xs text-theme-300">
                        <span className="text-theme-500">{t.properties.name}</span><span className="truncate break-all" title={file?.name || rootName}>{file?.name || rootName}</span>
                        <span className="text-theme-500">{t.properties.type}</span><span className="truncate" title={file?.mimeType || 'Workspace Root'}>{file?.mimeType || 'Workspace Root'}</span>
                        <span className="text-theme-500">{t.properties.owner}</span><span>{file?.ownerName || t.common.me}</span>
                        {file && file.size && <><span className="text-theme-500">{t.properties.size}</span><span>{(parseInt(file.size) / 1024).toFixed(1)} KB</span></>}
                        {file && file.createdTime && <><span className="text-theme-500">{t.sidebar.createdAt}</span><span>{new Date(file.createdTime).toLocaleString()}</span></>}
                        {file && file.modifiedTime && <><span className="text-theme-500">{t.sidebar.modifiedAt}</span><span>{new Date(file.modifiedTime).toLocaleString()}</span></>}
                    </div>
                </div>
            )}

            {activeSubMenu === 'tags' && (
                <div
                    className={`absolute left-full ml-1 ${CONTEXT_SUBMENU_WIDTH_TAGS} bg-theme-800 border border-theme-600 rounded-lg shadow-xl p-2 z-50 animate-in fade-in zoom-in-95`}
                    style={{ bottom: CONTEXT_OFFSET_TAGS }}
                    onClick={e => e.stopPropagation()}
                >
                    <input
                        type="text"
                        value={tagInput}
                        onChange={e => setTagInput(e.target.value)}
                        onKeyDown={e => {
                            if (e.key === 'Enter') handleAddNewTag(tagInput);
                            if (e.key === 'Escape') {
                                setActiveSubMenu(null);
                                setStickySubMenu(null);
                            }
                        }}
                        placeholder={t.sidebar.tagInputPlaceholder}
                        className="w-full bg-theme-900 text-sm text-theme-200 px-2 py-1.5 rounded border border-theme-700 focus:outline-none focus:border-primary-main mb-2"
                        autoFocus
                        disabled={isSubmitting}
                    />

                    {/* 推薦/最近使用標籤 */}
                    <div className="overflow-y-auto custom-scrollbar" style={{ maxHeight: TAG_LIST_MAX_HEIGHT }}>
                        {filteredTags.length > 0 ? (
                            <div className="flex flex-col gap-0.5">
                                {filteredTags.map(t => (
                                    <button
                                        key={t.id}
                                        onClick={() => handleAddNewTag(t.name)}
                                        disabled={isSubmitting || currentTags.includes(t.name)}
                                        className={`text-left px-2 py-1 rounded text-xs truncate transition-colors ${currentTags.includes(t.name)
                                            ? 'opacity-50 cursor-not-allowed'
                                            : 'hover:bg-theme-700 text-theme-300'
                                            }`}
                                    >
                                        {t.name}
                                    </button>
                                ))}
                            </div>
                        ) : (
                            <div className="text-xs text-theme-500 text-center py-2">
                                {tagInput ? t.sidebar.addTagHint : t.sidebar.noSuggestedTags}
                            </div>
                        )}
                    </div>
                </div>
            )}
        </div>
    );
}
