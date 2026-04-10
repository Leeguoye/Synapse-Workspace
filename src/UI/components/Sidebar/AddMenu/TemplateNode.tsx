import React, { useState } from 'react';
import { Folder, ChevronDown, Loader2, FileText, LayoutDashboard, Presentation, BrainCircuit, FileCode } from 'lucide-react';
import type { DriveFile } from '../../../../shared/types';
import { t } from '../../../../language';

interface TemplateNodeProps {
    folder: DriveFile;
    onCopy: (file: DriveFile) => void;
}

const TemplateNode: React.FC<TemplateNodeProps> = ({ folder, onCopy }) => {
    const [expanded, setExpanded] = useState(false);
    const [items, setItems] = useState<DriveFile[]>([]);
    const [isLoading, setIsLoading] = useState(false);

    const toggleExpand = async (e: React.MouseEvent) => {
        e.stopPropagation();
        if (expanded) {
            setExpanded(false);
        } else {
            setExpanded(true);
            if (items.length === 0) {
                setIsLoading(true);
                try {
                    const files = await window.electron.listFiles({ mode: 'all', parentId: folder.id });
                    const nonTrashed = files.filter((f: DriveFile) => !f.trashed);
                    // 排序: 資料夾優先，名稱排序
                    const sorted = nonTrashed.sort((a: DriveFile, b: DriveFile) => {
                        const aFolder = a.mimeType === 'application/vnd.google-apps.folder';
                        const bFolder = b.mimeType === 'application/vnd.google-apps.folder';
                        if (aFolder && !bFolder) return -1;
                        if (!aFolder && bFolder) return 1;
                        return a.name.localeCompare(b.name);
                    });
                    setItems(sorted);
                } catch (error) {
                    console.error('Fetch template children error', error);
                } finally {
                    setIsLoading(false);
                }
            }
        }
    };

    return (
        <div className="relative">
            <button
                onClick={toggleExpand}
                className="w-full text-left pl-3 pr-3 py-2 hover:bg-theme-700 flex items-center justify-between text-theme-200"
            >
                <div className="flex items-center gap-2 truncate">
                    <Folder className="w-4 h-4 text-blue-400 shrink-0" />
                    <span className="truncate flex-1 text-[13px]">{folder.name}</span>
                </div>
                <ChevronDown className={`w-3.5 h-3.5 text-theme-500 shrink-0 ml-2 transition-transform duration-200 ${expanded ? 'rotate-180' : ''}`} />
            </button>

            {expanded && (
                <div className="bg-theme-900/50 py-1 pl-4 transition-all border-l border-theme-700/50 mt-1 mb-1 relative ml-1.5">
                    {isLoading ? (
                        <div className="flex justify-center py-2"><Loader2 className="w-3.5 h-3.5 animate-spin text-theme-400" /></div>
                    ) : items.length === 0 ? (
                        <div className="px-3 py-1.5 text-theme-500 text-xs text-center italic">{t.common.noContent}</div>
                    ) : (
                        items.map(item => {
                            if (item.mimeType === 'application/vnd.google-apps.folder') {
                                return <TemplateNode key={item.id} folder={item} onCopy={onCopy} />;
                            } else {
                                return (
                                    <button
                                        key={item.id}
                                        onClick={() => onCopy(item)}
                                        className="w-full text-left pl-2 pr-3 py-1.5 hover:bg-theme-700 flex items-center gap-2 text-theme-300 transition-colors"
                                    >
                                        {item.mimeType === 'application/vnd.google-apps.document' && <FileText className="w-3.5 h-3.5 text-blue-500 shrink-0" />}
                                        {item.mimeType === 'application/vnd.google-apps.spreadsheet' && <LayoutDashboard className="w-3.5 h-3.5 text-green-500 shrink-0" />}
                                        {item.mimeType === 'application/vnd.google-apps.presentation' && <Presentation className="w-3.5 h-3.5 text-yellow-500 shrink-0" />}
                                        {item.mimeType.includes('.nexus') || item.mimeType.includes('.synapse') ? <BrainCircuit className="w-3.5 h-3.5 text-teal-400 shrink-0" /> : null}
                                        {(!['application/vnd.google-apps.document', 'application/vnd.google-apps.spreadsheet', 'application/vnd.google-apps.presentation'].includes(item.mimeType) && !item.mimeType.includes('.nexus') && !item.mimeType.includes('.synapse')) && <FileCode className="w-3.5 h-3.5 text-theme-400 shrink-0" />}
                                        <span className="truncate flex-1 text-[11px]">{item.name}</span>
                                    </button>
                                );
                            }
                        })
                    )}
                </div>
            )}
        </div>
    );
};

export default TemplateNode;
