import React, { useState, useEffect, useRef, useCallback } from 'react';
import Editor from '@monaco-editor/react';

declare global {
    interface Window {
        electron: any;
    }
}
import type { DriveFile } from '../../../shared/types';
import { Loader2, AlertTriangle, GripVertical } from 'lucide-react';
import { Group, Panel, Separator } from 'react-resizable-panels';
import { NativeEditorToolbar } from './NativeEditorToolbar';
import type { ViewMode } from './NativeEditorToolbar';
import { NativeEditorPreview } from './NativeEditorPreview';
import { LatexJsPreview } from './LatexJsPreview';
import { ConflictResolutionModal } from '../Sidebar/Modals/ConflictResolutionModal';

import { isDarkTheme } from '../../configs/themeConfig';
import type { ThemeType } from '../../configs/themeConfig';

interface NativeEditorProps {
    file: DriveFile;
    onClose?: () => void;
    currentWorkspaceId?: string;
    theme: ThemeType;
}

const NativeEditor: React.FC<NativeEditorProps> = ({ file, currentWorkspaceId, theme }) => {
    const [content, setContent] = useState('');
    const [originalContent, setOriginalContent] = useState('');
    const [isLoading, setIsLoading] = useState(true);
    const [isSaving, setIsSaving] = useState(false);
    const [isDirty, setIsDirty] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [fontSize, setFontSize] = useState(14); // 新增字體大小狀態
    const [viewMode, setViewMode] = useState<ViewMode>('split'); // 版面檢視模式
    const editorRef = useRef<any>(null); // 保存 Monaco Editor 實例以供工具列操作
    const previewRef = useRef<HTMLDivElement>(null); // 保存預覽區 DOM
    const isEditorScrolling = useRef(false);
    const isPreviewScrolling = useRef(false);
    const [previewScrollRatio, setPreviewScrollRatio] = useState<number | null>(null);

    // 衝突狀態管理
    const [isOfflineSaved, setIsOfflineSaved] = useState(file.isDirty || false);
    const [conflictState, setConflictState] = useState<{
        isOpen: boolean;
        remoteContent: string;
        localContent: string;
    } | null>(null);

    // Tags 狀態管理
    const [tags, setTags] = useState<string[]>(file.tags || []);

    // 用於追蹤最新狀態供 Cleanup 存檔使用
    const contentRef = useRef(content);
    const isDirtyRef = useRef(isDirty);

    useEffect(() => {
        contentRef.current = content;
        isDirtyRef.current = isDirty;
    }, [content, isDirty]);

    useEffect(() => {
        setTags(file.tags || []);
    }, [file]);

    const handleAddTag = async (tagName: string) => {
        if (!tagName.trim() || tags.includes(tagName.trim())) return;
        const newTag = tagName.trim();
        try {
            const updatedTags = [...tags, newTag];
            setTags(updatedTags);
            await window.electron.addTag(file.id, newTag, currentWorkspaceId);
            window.dispatchEvent(new CustomEvent('tags-updated', { detail: { fileId: file.id, tags: updatedTags } }));
        } catch (e) {
            console.error('Failed to add tag:', e);
            // Revert local state if API call fails
            setTags(prev => prev.filter(t => t !== newTag));
        }
    };

    const handleRemoveTag = async (tagName: string) => {
        const originalTags = tags; // Store original tags for potential revert
        const updatedTags = tags.filter(t => t !== tagName);
        setTags(updatedTags);
        try {
            await window.electron.removeTag(file.id, tagName);
            window.dispatchEvent(new CustomEvent('tags-updated', { detail: { fileId: file.id, tags: updatedTags } }));
        } catch (e) {
            console.error('Failed to remove tag:', e);
            // Revert local state if API call fails
            setTags(originalTags);
        }
    };

    // 1. 載入檔案內容
    useEffect(() => {
        const handleTagsUpdated = (e: CustomEvent<{ fileId: string, tags: string[] }>) => {
            if (e.detail.fileId === file.id) {
                setTags(e.detail.tags);
            }
        };
        window.addEventListener('tags-updated', handleTagsUpdated as EventListener);
        return () => window.removeEventListener('tags-updated', handleTagsUpdated as EventListener);
    }, [file.id]);

    useEffect(() => {
        let isMounted = true;
        const loadFile = async () => {
            setIsLoading(true);
            setError(null);
            try {
                // 這裡要呼叫後端 IPC 來「純下載字串」
                // 需要去 IPC (driveOps.ts) 新增/確認這個下載文字的 API
                const response = await window.electron.downloadFileText(file.id);
                // response 可能是一個包含 { content, isLocalDraft } 的物件 (因為剛改寫了 driveOps.ts)
                const text = typeof response === 'string' ? response : response.content || '';
                if (isMounted) {
                    setContent(text);
                    setOriginalContent(text);
                    setIsDirty(false);
                }
            } catch (err: any) {
                if (isMounted) {
                    setError('無法載入檔案內容: ' + (err.message || '未知錯誤'));
                }
            } finally {
                if (isMounted) setIsLoading(false);
            }
        };

        if (file?.id) {
            loadFile();
        }

        return () => {
            isMounted = false;
        };
    }, [file.id]);

    // 2. 主動存檔動作
    const handleSave = useCallback(async (forceOverride: boolean = false, overrideContent?: string) => {
        if (!file?.id) return;
        if (!isDirtyRef.current && !forceOverride && !isOfflineSaved) return;

        setIsSaving(true);
        const contentToSave = overrideContent !== undefined ? overrideContent : contentRef.current;

        try {
            const result = await window.electron.updateFileText(file.id, {
                mimeType: file.mimeType,
                body: contentToSave,
                forceOverride: forceOverride
            });

            if (result?.status === 'conflict') {
                // 依照使用者要求：除非原來載入的舊內容與雲端最新內容「完全一致」，否則只要有差異就強制開啟審查視窗
                if (originalContent === result.remoteContent) {
                    console.log('[Offline Sync] 雲端最新內容與載入時無差異，略過衝突視窗直接覆寫');
                    // 內容並未被他人實質修改，只是時間戳記較新 (或是假衝突)，直接以我們現在的修改覆寫
                    await window.electron.updateFileText(file.id, {
                        mimeType: file.mimeType,
                        body: contentToSave,
                        forceOverride: true
                    });
                    setIsDirty(false);
                    setOriginalContent(contentToSave);
                    return;
                }

                // 只要網路內容有被別人改動 (與原內容不同)，強制開啟差異比較視窗由人工確認
                setConflictState({
                    isOpen: true,
                    remoteContent: result.remoteContent,
                    localContent: contentToSave
                });
                return;
            }

            if (result?.status === 'offline_saved') {
                setIsOfflineSaved(true);
                // 狀態仍留作 isDirty，因為尚未真正上傳
            } else {
                setIsOfflineSaved(false);
                setOriginalContent(contentToSave);
                setIsDirty(false);

                // 若是因為衝突解決而覆寫，同步更新編輯器內文
                if (overrideContent !== undefined) {
                    setContent(overrideContent);
                    if (editorRef.current && editorRef.current.getValue() !== overrideContent) {
                        editorRef.current.setValue(overrideContent);
                    }
                }
            }
        } catch (err: any) {
            console.error('儲存失敗:', err);
            setError('儲存失敗: ' + (err.message || '未知錯誤'));
        } finally {
            setIsSaving(false);
        }
    }, [file, isOfflineSaved]);

    // 3. 攔截 Ctrl+S 與 Ctrl+/- 縮放
    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            if (e.ctrlKey || e.metaKey) {
                // 存檔 Ctrl+S
                if (e.key.toLowerCase() === 's') {
                    e.preventDefault();
                    handleSave();
                }
                // 放大 Ctrl+Plus/Equals
                else if (e.key === '=' || e.key === '+') {
                    e.preventDefault();
                    setFontSize(prev => Math.min(prev + 2, 48));
                }
                // 縮小 Ctrl+Minus
                else if (e.key === '-') {
                    e.preventDefault();
                    setFontSize(prev => Math.max(prev - 2, 8));
                }
            }
        };
        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [handleSave]);

    // 4. 防呆自動存檔 (Component Unmount 時)
    useEffect(() => {
        return () => {
            if (isDirtyRef.current && file?.id) {
                console.log('Background Auto Save:', file.name);
                // 這裡觸發 IPC，不需要 await，因為 Component 已經要死了
                window.electron.updateFileText(file.id, {
                    mimeType: file.mimeType,
                    body: contentRef.current
                }).catch((err: any) => {
                    console.error('Background save failed:', err);
                });
            }
        };
    }, [file.id, file.name, file.mimeType]);

    // Monaco Editor Change 處理
    const handleEditorChange = (value: string | undefined) => {
        if (value !== undefined) {
            setContent(value);
            setIsDirty(value !== originalContent);
        }
    };

    // 判斷語言
    const language = file.mimeType === 'application/x-tex' ? 'stex' : 'markdown';

    // 處理工具列的快速模板插入
    const handleInsertText = (prefix: string, suffix: string = '', defaultText: string = '') => {
        const editor = editorRef.current;
        if (!editor) return;

        const selection = editor.getSelection();
        const model = editor.getModel();
        if (!selection || !model) return;

        const selectedText = model.getValueInRange(selection);
        const textToInsert = selectedText || defaultText;
        const insertContent = `${prefix}${textToInsert}${suffix}`;

        // 執行編輯並推入 Undo stack
        editor.executeEdits('toolbar-insert', [{
            range: selection,
            text: insertContent,
            forceMoveMarkers: true
        }]);

        // 重新選取新插入的文字區塊 (不包含前後綴)
        editor.setSelection({
            startLineNumber: selection.startLineNumber,
            startColumn: selection.startColumn + prefix.length,
            endLineNumber: selection.endLineNumber,
            endColumn: selection.startColumn + prefix.length + textToInsert.length
        });
        editor.focus();
    };

    if (isLoading) {
        return (
            <div className="flex-1 flex flex-col items-center justify-center bg-app-bg h-full w-full p-8">
                <Loader2 className="w-8 h-8 animate-spin text-theme-500 mb-4" />
                <p className="text-theme-400 text-sm">載入內容中...</p>
            </div>
        );
    }

    if (error) {
        return (
            <div className="flex-1 flex flex-col items-center justify-center bg-app-bg h-full w-full p-8">
                <AlertTriangle className="w-12 h-12 text-red-500 mb-4" />
                <p className="text-red-400 text-sm">{error}</p>
            </div>
        );
    }

    return (
        <div className="flex-1 flex flex-col h-full bg-app-bg border-l border-theme-700 overflow-hidden relative group">
            <NativeEditorToolbar
                viewMode={viewMode}
                setViewMode={setViewMode}
                onInsertText={handleInsertText}
                isDirty={isDirty || isOfflineSaved}
                isSaving={isSaving}
                onSave={() => handleSave()}
                tags={tags}
                onAddTag={handleAddTag}
                onRemoveTag={handleRemoveTag}
                currentWorkspaceId={currentWorkspaceId}
                mimeType={file.mimeType}
                theme={theme}
            />

            {/* Offline Badge */}
            {isOfflineSaved && (
                <div className="absolute top-14 left-1/2 -translate-x-1/2 z-20 bg-amber-900/90 text-amber-200 border border-amber-700/50 px-3 py-1 text-xs rounded-full shadow-lg backdrop-blur-sm flex items-center gap-2 pointer-events-none">
                    <span className="relative flex h-2 w-2">
                        <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-amber-400 opacity-75"></span>
                        <span className="relative inline-flex rounded-full h-2 w-2 bg-amber-500"></span>
                    </span>
                    已儲存為本地離線草稿 (等待網路連線後同步)
                </div>
            )}

            {/* Conflict Modal */}
            {conflictState?.isOpen && (
                <ConflictResolutionModal
                    isOpen={true}
                    onClose={() => setConflictState(null)}
                    fileName={file.name}
                    localContent={conflictState.localContent}
                    remoteContent={conflictState.remoteContent}
                    onResolve={async (resolvedContent, forceOverride) => {
                        setConflictState(null);
                        await handleSave(forceOverride, resolvedContent);
                    }}
                    theme={theme}
                />
            )}

            {/* Editor & Preview Split View */}
            <div className="flex-1 relative min-h-0 min-w-0 bg-app-bg">
                <Group orientation="horizontal">
                    {/* Monaco Editor Panel */}
                    {viewMode !== 'preview' && (
                        <Panel id="editor-panel" defaultSize={50} minSize={20}>
                            <div className="h-full relative pl-[15px]">
                                <div className="absolute inset-0 bg-app-bg">
                                    <Editor
                                        height="100%"
                                        width="100%"
                                        language={language}
                                        theme={isDarkTheme(theme) ? 'vs-dark' : 'light'}
                                        defaultValue={content}
                                        onChange={handleEditorChange}
                                        onMount={(editor, monaco) => {
                                            editorRef.current = editor;

                                            // Register basic LaTeX syntax highlighting if stex isn't fully supported
                                            monaco.languages.register({ id: 'stex' });
                                            monaco.languages.setMonarchTokensProvider('stex', {
                                                tokenizer: {
                                                    root: [
                                                        [/\\%/, 'string.escape'],
                                                        [/%.*$/, 'comment'],
                                                        [/\\(begin|end)\s*\{[^\}]+\}/, 'keyword'],
                                                        [/\\[a-zA-Z]+/, 'keyword'],
                                                        [/\{|\}/, 'delimiter.bracket'],
                                                        [/\$\$/, { token: 'string', bracket: '@open', next: '@mathblock' }],
                                                        [/\$[^\$]+\$/, 'string'],
                                                    ],
                                                    mathblock: [
                                                        [/[^\$]+/, 'string'],
                                                        [/\$\$/, { token: 'string', bracket: '@close', next: '@pop' }],
                                                        [/\$/, 'string']
                                                    ]
                                                }
                                            });

                                            // Markdown 自動延續清單序列 (- / * / 1. / - [ ])
                                            if (language === 'markdown') {
                                                editor.addCommand(monaco.KeyCode.Enter, () => {
                                                    const position = editor.getPosition();
                                                    const model = editor.getModel();
                                                    if (!position || !model) {
                                                        // Fallback: 確實送出換行
                                                        editor.trigger('keyboard', 'type', { text: '\n' });
                                                        return;
                                                    }

                                                    const lineContent = model.getLineContent(position.lineNumber);
                                                    const textBeforeCursor = lineContent.substring(0, position.column - 1);

                                                    const unorderedMatch = textBeforeCursor.match(/^(\s*)([-*+])\s+(?:\[([xX\s])\]\s+)?(.*)$/);
                                                    const orderedMatch = textBeforeCursor.match(/^(\s*)(\d+)([\.\)])\s+(.*)$/);

                                                    if (unorderedMatch) {
                                                        const [_, indent, bullet, checkmark, content] = unorderedMatch;

                                                        // 若在空列表項目上按下 Enter，則清除該項的符號並換行
                                                        if (!content.trim()) {
                                                            editor.executeEdits('auto-list', [{
                                                                range: new monaco.Range(position.lineNumber, 1, position.lineNumber, position.column),
                                                                text: ''
                                                            }]);
                                                            return;
                                                        }

                                                        let prefix = `${indent}${bullet} `;
                                                        if (checkmark !== undefined) {
                                                            prefix += `[ ] `; // 預設產生未勾選方框
                                                        }

                                                        editor.trigger('keyboard', 'type', { text: '\n' + prefix });
                                                    } else if (orderedMatch) {
                                                        const [_, indent, numStr, punctuation, content] = orderedMatch;

                                                        if (!content.trim()) {
                                                            editor.executeEdits('auto-list', [{
                                                                range: new monaco.Range(position.lineNumber, 1, position.lineNumber, position.column),
                                                                text: ''
                                                            }]);
                                                            return;
                                                        }

                                                        const nextNum = parseInt(numStr, 10) + 1;
                                                        const prefix = `${indent}${nextNum}${punctuation} `;

                                                        editor.trigger('keyboard', 'type', { text: '\n' + prefix });
                                                    } else {
                                                        editor.trigger('keyboard', 'type', { text: '\n' });
                                                    }
                                                });
                                            }

                                            // 同步 Editor -> Preview 滞動
                                            editor.onDidScrollChange((e: any) => {
                                                if (isPreviewScrolling.current) return;
                                                const scrollHeight = editor.getScrollHeight();
                                                const layoutHeight = editor.getLayoutInfo().height;
                                                const scrollable = scrollHeight - layoutHeight;
                                                if (scrollable <= 0) return;
                                                isEditorScrolling.current = true;
                                                setPreviewScrollRatio(e.scrollTop / scrollable);
                                                setTimeout(() => { isEditorScrolling.current = false; }, 60);
                                            });
                                        }}
                                        options={{
                                            automaticLayout: true,
                                            minimap: { enabled: false },
                                            wordWrap: 'on',
                                            fontSize: fontSize,
                                            fontFamily: "'Fira Code', 'Cascadia Code', Consolas, monospace",
                                            padding: { top: 16, bottom: 16 },
                                            scrollBeyondLastLine: false,
                                            renderWhitespace: 'selection',
                                            stickyScroll: { enabled: false },
                                            overviewRulerLanes: 0,
                                            overviewRulerBorder: false,
                                            hideCursorInOverviewRuler: true,
                                            glyphMargin: false,
                                            folding: false,
                                            lineDecorationsWidth: 10,
                                            lineNumbersMinChars: 5,
                                            quickSuggestions: false,
                                            suggestOnTriggerCharacters: false,
                                            wordBasedSuggestions: "off",
                                            parameterHints: { enabled: false },
                                            acceptSuggestionOnEnter: "off"
                                        }}
                                        loading={<div className="flex w-full h-full items-center justify-center bg-app-bg"><Loader2 className="w-6 h-6 animate-spin text-theme-500" /></div>}
                                    />
                                </div>
                            </div>
                        </Panel>
                    )}

                    {/* Resizer */}
                    {viewMode === 'split' && (
                        <Separator className="w-1.5 bg-theme-800 border-x border-theme-700 hover:bg-blue-500/50 transition-colors flex items-center justify-center group/resizer cursor-col-resize z-10 shadow-[0_0_10px_rgba(0,0,0,0.2)]">
                            <GripVertical className="w-3 h-8 text-theme-500 group-hover/resizer:text-blue-300" />
                        </Separator>
                    )}

                    {/* Markdown / LaTeX Preview Panel */}
                    {viewMode !== 'edit' && (
                        <Panel id="preview-panel" defaultSize={50} minSize={20}>
                            {language === 'stex' ? (
                                <LatexJsPreview
                                    content={content}
                                    scrollToRatio={previewScrollRatio}
                                    onScroll={(scrollTop: number, scrollHeight: number, clientHeight: number) => {
                                        if (isEditorScrolling.current || !editorRef.current) return;
                                        const scrollable = scrollHeight - clientHeight;
                                        if (scrollable <= 0) return;
                                        isPreviewScrolling.current = true;
                                        const ratio = scrollTop / scrollable;
                                        const editorScrollable = editorRef.current.getScrollHeight() - editorRef.current.getLayoutInfo().height;
                                        editorRef.current.setScrollTop(ratio * editorScrollable);
                                        setTimeout(() => { isPreviewScrolling.current = false; }, 50);
                                    }}
                                />
                            ) : (
                                <NativeEditorPreview
                                    ref={previewRef}
                                    content={content}
                                    mimeType={file.mimeType}
                                    scrollToRatio={previewScrollRatio}
                                    onUpdateContent={(newContent: string) => {
                                        setContent(newContent);
                                        setIsDirty(true);
                                        if (editorRef.current) {
                                            const model = editorRef.current.getModel();
                                            if (model && model.getValue() !== newContent) {
                                                const position = editorRef.current.getPosition();
                                                editorRef.current.executeEdits('preview-checkbox', [{
                                                    range: model.getFullModelRange(),
                                                    text: newContent
                                                }]);
                                                if (position) editorRef.current.setPosition(position);
                                            }
                                        }
                                    }}
                                    onScroll={(scrollTop, scrollHeight, clientHeight) => {
                                        if (isEditorScrolling.current || !editorRef.current) return;
                                        const scrollable = scrollHeight - clientHeight;
                                        if (scrollable <= 0) return;
                                        isPreviewScrolling.current = true;
                                        const ratio = scrollTop / scrollable;
                                        const editorScrollable = editorRef.current.getScrollHeight() - editorRef.current.getLayoutInfo().height;
                                        editorRef.current.setScrollTop(ratio * editorScrollable);
                                        setTimeout(() => { isPreviewScrolling.current = false; }, 50);
                                    }}
                                    theme={theme}
                                />
                            )}
                        </Panel>
                    )}
                </Group>
            </div>
        </div>
    );
};

export default NativeEditor;
