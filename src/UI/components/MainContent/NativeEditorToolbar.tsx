import React, { useRef } from 'react';
import {
    Bold, Italic, Strikethrough, Heading, List, ListOrdered,
    Quote, Code, Link as LinkIcon, Image, Table, Minus,
    PenLine, SplitSquareHorizontal, Eye, Loader2, Save,
    X as CloseIcon, Underline, Baseline, Sigma
} from 'lucide-react';
import { t } from '../../../language';
import { TagPopover } from './TagPopover';
import { TAG_PADDING } from '../Sidebar/Constants/Sidebar.constants';

export type ViewMode = 'edit' | 'split' | 'preview';

interface NativeEditorToolbarProps {
    viewMode: ViewMode;
    setViewMode: (mode: ViewMode) => void;
    onInsertText: (prefix: string, suffix?: string, defaultText?: string) => void;
    isDirty: boolean;
    isSaving: boolean;
    onSave: () => void;
    tags: string[];
    onAddTag: (tag: string) => void;
    onRemoveTag: (tag: string) => void;
    currentWorkspaceId?: string;
    mimeType: string;
    theme: 'light' | 'dark' | 'warm' | 'eva' | 'miku';
}

export const NativeEditorToolbar: React.FC<NativeEditorToolbarProps> = ({
    viewMode,
    setViewMode,
    onInsertText,
    isDirty,
    isSaving,
    onSave,
    tags,
    onAddTag,
    onRemoveTag,
    currentWorkspaceId,
    mimeType,
    theme
}) => {
    const scrollContainerRef = useRef<HTMLDivElement>(null);

    const handleWheel = (e: React.WheelEvent<HTMLDivElement>) => {
        if (scrollContainerRef.current) {
            scrollContainerRef.current.scrollLeft += e.deltaY;
        }
    };

    const renderModeButton = (mode: ViewMode, icon: React.ReactNode, tooltip: string) => {
        const isActive = viewMode === mode;
        return (
            <button
                onClick={() => setViewMode(mode)}
                title={tooltip}
                className={`p-1.5 rounded transition-colors ${isActive ? ((theme === 'dark' || theme === 'eva') ? 'bg-primary-main/30 text-primary-text' : 'bg-primary-main/10 text-primary-main') : 'text-theme-400 hover:bg-theme-700 hover:text-theme-300'
                    }`}
            >
                {icon}
            </button>
        );
    };

    const renderActionBtn = (icon: React.ReactNode, tooltip: string, action: () => void) => (
        <button
            onClick={action}
            title={tooltip}
            className="p-1.5 rounded text-theme-400 hover:bg-theme-700 hover:text-theme-300 transition-colors"
        >
            {icon}
        </button>
    );

    return (
        <div className={`h-10 shrink-0 bg-theme-800 border-theme-700 border-b flex items-center justify-between px-4 text-xs select-none transition-colors`}>
            {/* Action Buttons based on MimeType */}
            <div className={`flex items-center gap-1 ${viewMode === 'preview' ? 'opacity-30 pointer-events-none' : ''}`}>
                {mimeType === 'application/x-tex' ? (
                    // LaTeX Toolbar
                    <>
                        {renderActionBtn(<Bold className="w-4 h-4" />, t.editor.bold || 'Bold', () => onInsertText('\\textbf{', '}'))}
                        {renderActionBtn(<Italic className="w-4 h-4" />, t.editor.italic || 'Italic', () => onInsertText('\\textit{', '}'))}
                        {renderActionBtn(<Underline className="w-4 h-4" />, 'Underline', () => onInsertText('\\underline{', '}'))}
                        {renderActionBtn(<Heading className="w-4 h-4" />, t.editor.heading || 'Section', () => onInsertText('\\section{', '}'))}
                        <div className="w-px h-4 bg-theme-600 mx-1"></div>
                        {renderActionBtn(<List className="w-4 h-4" />, t.editor.bulletList || 'Itemize', () => onInsertText('\\begin{itemize}\n    \\item ', '\n\\end{itemize}\n', '項目'))}
                        {renderActionBtn(<ListOrdered className="w-4 h-4" />, t.editor.numberedList || 'Enumerate', () => onInsertText('\\begin{enumerate}\n    \\item ', '\n\\end{enumerate}\n', '項目'))}
                        <div className="w-px h-4 bg-theme-600 mx-1"></div>
                        {renderActionBtn(<LinkIcon className="w-4 h-4" />, 'Hyperlink', () => onInsertText('\\url{', '}'))}
                        <div className="w-px h-4 bg-theme-600 mx-1"></div>
                        {renderActionBtn(<Baseline className="w-4 h-4" />, 'Inline Math', () => onInsertText('$', '$', 'x^2'))}
                        {renderActionBtn(<Sigma className="w-4 h-4" />, 'Equation Block', () => onInsertText('\\[\n    ', '\n\\]\n', 'E = mc^2'))}
                        {renderActionBtn(<Code className="w-4 h-4" />, 'Monospace Text', () => onInsertText('\\texttt{', '}', 'code'))}
                    </>
                ) : (
                    // Markdown Toolbar
                    <>
                        {renderActionBtn(<Bold className="w-4 h-4" />, t.editor.bold, () => onInsertText('**', '**', '粗體'))}
                        {renderActionBtn(<Italic className="w-4 h-4" />, t.editor.italic, () => onInsertText('*', '*', '斜體'))}
                        {renderActionBtn(<Strikethrough className="w-4 h-4" />, t.editor.strikethrough, () => onInsertText('~~', '~~', '刪除線'))}
                        {renderActionBtn(<Heading className="w-4 h-4" />, t.editor.heading, () => onInsertText('#', ''))}
                        <div className="w-px h-4 bg-theme-600 mx-1"></div>
                        {renderActionBtn(<Code className="w-4 h-4" />, t.editor.codeBlock, () => onInsertText('```\n', '\n```\n', '程式碼'))}
                        {renderActionBtn(<Quote className="w-4 h-4" />, t.editor.quote, () => onInsertText('> ', ''))}
                        {renderActionBtn(<List className="w-4 h-4" />, t.editor.bulletList, () => onInsertText('- ', ''))}
                        {renderActionBtn(<ListOrdered className="w-4 h-4" />, t.editor.numberedList, () => onInsertText('1. ', ''))}
                        <div className="w-px h-4 bg-theme-600 mx-1"></div>
                        {renderActionBtn(<LinkIcon className="w-4 h-4" />, t.editor.link, () => onInsertText('[', '](https://)', '連結文字'))}
                        {renderActionBtn(<Image className="w-4 h-4" />, t.editor.image, () => onInsertText('![', '](https://)', '圖片替代文字'))}
                        {renderActionBtn(<Table className="w-4 h-4" />, t.editor.table, () => onInsertText('| 標題1 | 標題2 |\n|---|---|\n| 內容1 | 內容2 |'))}
                        {renderActionBtn(<Minus className="w-4 h-4" />, t.editor.horizontalRule, () => onInsertText('\n---\n'))}
                    </>
                )}
            </div>

            {/* Right Side Actions and Tags */}
            <div className="flex items-center gap-2.5 overflow-hidden">

                {/* File Tags Area with Fade Effect */}
                <div className="relative flex-1 flex items-center min-w-0">
                    <div
                        ref={scrollContainerRef}
                        onWheel={handleWheel}
                        className="flex items-center gap-1.5 overflow-x-auto overflow-y-hidden pb-1 pt-1 pr-2 w-full flex-row-reverse"
                        style={{
                            scrollbarWidth: 'none',
                            msOverflowStyle: 'none',
                            maskImage: 'linear-gradient(to right, black calc(100% - 30px), transparent 100%)',
                            WebkitMaskImage: 'linear-gradient(to right, black calc(100% - 30px), transparent 100%)'
                        }}
                    >
                        <style>{`
                            .hide-scrollbar::-webkit-scrollbar { display: none; }
                        `}</style>
                        {[...tags].reverse().map(tag => (
                            <span key={tag} className={`flex items-center gap-1 ${TAG_PADDING} bg-theme-700/50 text-theme-300 text-xs rounded-full border border-theme-600/50 shrink-0 select-none group hover:border-theme-500 transition-colors`}>
                                {tag}
                                <button onClick={() => onRemoveTag(tag)} className="text-theme-400 hover:text-danger-main transition-colors opacity-0 group-hover:opacity-100">
                                    <CloseIcon className="w-3.5 h-3.5" />
                                </button>
                            </span>
                        ))}
                    </div>
                </div>

                <TagPopover
                    currentWorkspaceId={currentWorkspaceId}
                    existingTags={tags}
                    onAddTag={onAddTag}
                />

                {/* HTML Download Button - moved to far right */}

                {/* Save Button (Modern Pill) */}
                <button
                    onClick={onSave}
                    disabled={!isDirty || isSaving}
                    className={`flex items-center gap-1.5 px-3 py-1 text-xs font-medium rounded-full transition-all shrink-0 ${isDirty && !isSaving
                        ? 'bg-primary-main/90 hover:bg-primary-hover text-theme-50 shadow-md'
                        : 'bg-theme-800 text-theme-500 cursor-not-allowed opacity-50'
                        }`}
                    title={t.editor.saveShortcut}
                >
                    {isSaving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Save className="w-3.5 h-3.5" />}
                    <span>{t.editor.save}</span>
                </button>

                {/* View Mode Switcher */}
                <div className={`flex items-center gap-1 p-1 bg-theme-800 border border-theme-700 rounded-full shrink-0 transition-colors`}>
                    {renderModeButton('edit', <PenLine className="w-4 h-4" />, t.editor.editMode)}
                    {renderModeButton('split', <SplitSquareHorizontal className="w-4 h-4" />, t.editor.splitMode)}
                    {renderModeButton('preview', <Eye className="w-4 h-4" />, t.editor.previewMode)}
                </div>
            </div>
        </div>
    );
};

