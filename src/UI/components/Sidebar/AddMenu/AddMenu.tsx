import React from 'react';
import { CopyPlus, FolderPlus, ChevronRight, LayoutTemplate, FileCode, Sigma, PenTool, Globe, BrainCircuit, Share2, Notebook, Sparkles } from 'lucide-react';
import type { DriveFile } from '../../../../shared/types';
import { t } from '../../../../language';
import TemplateNode from './TemplateNode';
import {
    OFFICE_APPS,
    ADVANCED_APPS,
    TEMPLATE_MENU_OFFSET_X,
    TEMPLATE_MENU_OFFSET_Y,
    TEMPLATE_MENU_WIDTH,
    ADD_MENU_WIDTH_CLASS,
    ADD_MENU_SUBMENU_WIDTH_CLASS
} from '../Constants/Sidebar.constants';

interface AddMenuProps {
    x: number;
    y: number;
    file: DriveFile | null;
    templateFolders: DriveFile[];
    activeTemplateSubMenu: boolean;
    onClose: () => void;
    onCreateNew: (targetFile: DriveFile | null, mimeType: string, customName?: string) => void;
    onSetTemplateSubMenu: (active: boolean) => void;
    onLoadTemplateFolders: () => void;
    onCopyTemplateFile: (file: DriveFile) => void;
}

export const AddMenu: React.FC<AddMenuProps> = ({
    x, y, file, templateFolders, activeTemplateSubMenu,
    onClose, onCreateNew, onSetTemplateSubMenu, onLoadTemplateFolders, onCopyTemplateFile
}) => {
    return (
        <div className={`fixed z-50 ${ADD_MENU_WIDTH_CLASS} bg-theme-800 border border-theme-600 rounded-lg shadow-2xl py-1 text-sm text-theme-300 animate-in fade-in zoom-in-95 duration-100`} style={{ top: y, left: x }}>
            <button onClick={() => { onCreateNew(file, 'application/vnd.google-apps.folder'); onClose(); onSetTemplateSubMenu(false); }} onMouseEnter={() => onSetTemplateSubMenu(false)} className="w-full text-left px-3 py-2 hover:bg-theme-700 flex items-center gap-3 font-medium text-theme-300">
                <FolderPlus className="w-4 h-4 text-blue-400" /> {t.fileTree.newFolder}
            </button>

            <div className="h-px bg-theme-700 my-1 mx-2" />

            <div className="relative group/sub">
                <div className="flex items-center justify-between px-3 py-2 hover:bg-theme-700 cursor-default" onMouseEnter={() => onSetTemplateSubMenu(false)}>
                    <span className="flex items-center gap-3">{t.menu.googleOffice}</span>
                    <ChevronRight className="w-3.5 h-3.5 text-theme-500" />
                </div>
                <div className={`absolute left-full top-0 ml-0.5 ${ADD_MENU_SUBMENU_WIDTH_CLASS} bg-theme-800 border border-theme-600 rounded-lg shadow-xl py-1 hidden group-hover/sub:block`}>
                    {OFFICE_APPS.map(app => (
                        <button key={app.name} onClick={() => { onCreateNew(file, app.mimeType); onClose(); }} className="w-full text-left px-3 py-1.5 hover:bg-theme-700 flex items-center gap-3">
                            {app.icon} {app.name}
                        </button>
                    ))}
                </div>
            </div>

            <div className="relative group/sub">
                <div className="flex items-center justify-between px-3 py-2 hover:bg-theme-700 cursor-default" onMouseEnter={() => onSetTemplateSubMenu(false)}>
                    <span className="flex items-center gap-3">{t.menu.advancedServices}</span>
                    <ChevronRight className="w-3.5 h-3.5 text-theme-500" />
                </div>
                <div className={`absolute left-full top-0 ml-0.5 ${ADD_MENU_SUBMENU_WIDTH_CLASS} bg-theme-800 border border-theme-600 rounded-lg shadow-xl py-1 hidden group-hover/sub:block`}>
                    {ADVANCED_APPS.map(app => (
                        <button key={app.name} onClick={() => { onCreateNew(file, app.mimeType); onClose(); }} className="w-full text-left px-3 py-1.5 hover:bg-theme-700 flex items-center gap-3">
                            {app.icon} {app.name}
                        </button>
                    ))}
                </div>
            </div>

            <div className="relative" onMouseEnter={() => { onSetTemplateSubMenu(true); onLoadTemplateFolders(); }}>
                <button className="w-full text-left px-3 py-2 hover:bg-theme-700 flex items-center justify-between font-medium text-theme-100 hover:text-theme-500 transition-colors">
                    <div className="flex items-center gap-3">
                        <LayoutTemplate className="w-4 h-4" /> {t.menu.createFromTemplate}
                    </div>
                    <ChevronRight className="w-4 h-4 text-theme-500" />
                </button>

                {activeTemplateSubMenu && (
                    <div
                        className="absolute bg-theme-800 border border-theme-600 rounded-lg shadow-2xl py-1 min-h-[40px] max-h-[40vh] overflow-y-auto custom-scrollbar animate-in fade-in slide-in-from-left-2 duration-150 z-50"
                        style={{ top: `${TEMPLATE_MENU_OFFSET_Y}px`, left: `calc(100% + ${TEMPLATE_MENU_OFFSET_X}px)`, width: TEMPLATE_MENU_WIDTH }}
                        onMouseLeave={() => { onSetTemplateSubMenu(false); }}
                    >
                        {templateFolders.length === 0 ? (
                            <div className="px-3 py-2 text-theme-500 text-xs text-center italic">{t.menu.noTemplateFolders}</div>
                        ) : (
                            templateFolders.map((folder) => (
                                <div key={folder.id} className="relative">
                                    <TemplateNode folder={folder} onCopy={onCopyTemplateFile} />
                                </div>
                            ))
                        )}
                    </div>
                )}
            </div>

            <div className="h-px bg-theme-700 my-1 mx-2" />
            <div className="relative group/sub">
                <div className="flex items-center justify-between px-3 py-2 hover:bg-theme-700 cursor-default text-theme-300">
                    <span className="flex items-center gap-3"><Notebook className="w-4 h-4 text-blue-400" /> {t.menu.notesAndDocs}</span>
                    <ChevronRight className="w-3.5 h-3.5 text-theme-500" />
                </div>
                <div className={`absolute left-full bottom-0 ml-0.5 ${ADD_MENU_SUBMENU_WIDTH_CLASS} bg-theme-800 border border-theme-600 rounded-lg shadow-xl py-1 hidden group-hover/sub:block z-50`}>
                    <button onClick={() => { onCreateNew(file, 'text/markdown'); onClose(); }} className="w-full text-left px-3 py-2 hover:bg-theme-700 flex items-center gap-3 text-theme-300 transition-colors">
                        <FileCode className="w-4 h-4 text-blue-400" /> <span>{t.menu.markdownNotes}</span>
                    </button>
                    <button onClick={() => { onCreateNew(file, 'application/x-tex'); onClose(); }} className="w-full text-left px-3 py-2 hover:bg-theme-700 flex items-center gap-3 text-theme-300 transition-colors">
                        <Sigma className="w-4 h-4 text-emerald-400" /> <span>{t.menu.latexDocument}</span>
                    </button>
                </div>
            </div>

            <div className="relative group/sub">
                <div className="flex items-center justify-between px-3 py-2 hover:bg-theme-700 cursor-default text-theme-300">
                    <span className="flex items-center gap-3"><Sparkles className="w-4 h-4 text-purple-400" /> {t.menu.nexusExtensions}</span>
                    <ChevronRight className="w-3.5 h-3.5 text-theme-500" />
                </div>
                <div className={`absolute left-full bottom-0 ml-0.5 ${ADD_MENU_SUBMENU_WIDTH_CLASS} bg-theme-800 border border-theme-600 rounded-lg shadow-xl py-1 hidden group-hover/sub:block z-50`}>
                    <button onClick={() => { onCreateNew(file, 'application/vnd.synapse.canvas'); onClose(); }} className="w-full text-left px-3 py-2 hover:bg-theme-700 flex items-center gap-3 text-theme-300 transition-colors">
                        <PenTool className="w-4 h-4 text-purple-400" /> <span>{t.menu.generalCanvas}</span>
                    </button>
                    <button onClick={() => { onCreateNew(file, 'application/vnd.synapse.graph'); onClose(); }} className="w-full text-left px-3 py-2 hover:bg-theme-700 flex items-center gap-3 text-theme-300 transition-colors">
                        <Share2 className="w-4 h-4 text-emerald-400" /> <span>{t.menu.graphView}</span>
                    </button>
                    <button onClick={() => { onCreateNew(file, 'application/vnd.synapse.link'); onClose(); }} className="w-full text-left px-3 py-2 hover:bg-theme-700 flex items-center gap-3 text-theme-300 transition-colors">
                        <BrainCircuit className="w-4 h-4 text-teal-400" /> <span>{t.menu.notebookLm}</span>
                    </button>
                    <button onClick={() => { onCreateNew(file, 'application/vnd.synapse.link.custom'); onClose(); }} className="w-full text-left px-3 py-2 hover:bg-theme-700 flex items-center gap-3 text-theme-300 transition-colors">
                        <Globe className="w-4 h-4 text-blue-400" /> <span>{t.menu.externalLink}</span>
                    </button>
                </div>
            </div>

            <PluginMenuSection file={file} onSetTemplateSubMenu={onSetTemplateSubMenu} onClose={onClose} onCreateNew={onCreateNew} />
        </div>
    );
};

const PluginMenuSection: React.FC<{
    file: DriveFile | null,
    onSetTemplateSubMenu: (active: boolean) => void,
    onClose: () => void,
    onCreateNew: (targetFile: DriveFile | null, mimeType: string, customName?: string) => void
}> = ({ file, onSetTemplateSubMenu, onClose, onCreateNew }) => {
    const [plugins, setPlugins] = React.useState<any[]>([]);

    React.useEffect(() => {
        window.electron.plugins.list().then((list: any[]) => {
            // Filter: Only show plugins that have at least one node with 'htmlOutput' renderMode
            const standalonePlugins = list.filter(p => {
                if (!p.isActive) return false;
                try {
                    const manifest = JSON.parse(p.manifest);
                    return manifest.nodes?.some((node: any) => node.renderMode === 'htmlOutput');
                } catch (e) {
                    return false;
                }
            });
            setPlugins(standalonePlugins);
        });
    }, []);

    if (plugins.length === 0) return null;

    return (
        <div className="relative group/sub mt-1">
            <div className="flex items-center justify-between px-3 py-2 hover:bg-theme-700 cursor-default text-theme-300" onMouseEnter={() => onSetTemplateSubMenu(false)}>
                <span className="flex items-center gap-3"><CopyPlus className="w-4 h-4 text-pink-400" /> {t.menu.plugins}</span>
                <ChevronRight className="w-3.5 h-3.5 text-theme-500" />
            </div>
            <PluginAddSubMenu plugins={plugins} file={file} onClose={onClose} onCreateNew={onCreateNew} />
        </div>
    );
};

const PluginAddSubMenu: React.FC<{
    plugins: any[],
    file: DriveFile | null,
    onClose: () => void,
    onCreateNew: (targetFile: DriveFile | null, mimeType: string, customName?: string) => void
}> = ({ plugins, file, onClose, onCreateNew }) => {
    return (
        <div className={`absolute left-full bottom-0 ml-0.5 ${ADD_MENU_SUBMENU_WIDTH_CLASS} bg-theme-800 border border-theme-600 rounded-lg shadow-xl py-1 hidden group-hover/sub:block z-50`}>
            {plugins.map(plugin => (
                <button
                    key={plugin.pluginId}
                    onClick={() => {
                        onCreateNew(file, `application/vnd.synapse.plugin.${plugin.pluginId}`, plugin.name);
                        onClose();
                    }}
                    className="w-full text-left px-3 py-2 hover:bg-theme-700 flex items-center gap-3 text-theme-300 transition-colors"
                >
                    <div className="w-4 h-4 flex items-center justify-center bg-theme-700 rounded text-[10px] font-bold text-pink-400">
                        {plugin.name.charAt(0)}
                    </div>
                    <span className="truncate">{plugin.name}</span>
                </button>
            ))}
        </div>
    );
};

