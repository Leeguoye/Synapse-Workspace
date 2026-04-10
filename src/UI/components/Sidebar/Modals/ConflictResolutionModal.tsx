import React, { useRef, useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { DiffEditor } from '@monaco-editor/react';
import { X, CheckCircle, AlertCircle } from 'lucide-react';

import { isDarkTheme } from '../../../configs/themeConfig';
import type { ThemeType } from '../../../configs/themeConfig';

interface ConflictResolutionModalProps {
    isOpen: boolean;
    onClose: () => void;
    fileName: string;
    localContent: string;
    remoteContent: string;
    onResolve: (resolvedContent: string, forceOverride: boolean) => void;
    theme: ThemeType;
}

export const ConflictResolutionModal: React.FC<ConflictResolutionModalProps> = ({
    isOpen,
    onClose,
    fileName,
    localContent,
    remoteContent,
    onResolve,
    theme
}) => {
    const diffEditorRef = useRef<any>(null);

    const [mounted, setMounted] = useState(false);
    useEffect(() => { setMounted(true); }, []);

    if (!isOpen || !mounted) return null;

    const handleMount = (editor: any) => {
        diffEditorRef.current = editor;
    };

    const handleResolve = (forceOverride: boolean) => {
        if (!diffEditorRef.current) return;
        // 取得修改後（右側）的語法，這是最終版本
        const resolvedContent = diffEditorRef.current.getModifiedEditor().getValue();
        onResolve(resolvedContent, forceOverride);
    };

    const modalContent = (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
            <div className={`${isDarkTheme(theme) ? 'bg-theme-900 border-theme-700' : 'bg-theme-50 border-theme-200'} rounded-xl shadow-2xl w-[calc(100vw-4rem)] max-w-7xl h-[calc(100vh-4rem)] flex flex-col border overflow-hidden`}>
                {/* Header */}
                <div className={`flex items-center justify-between p-4 border-b ${isDarkTheme(theme) ? 'border-theme-800 bg-theme-950' : 'border-theme-200 bg-theme-100'}`}>
                    <div className="flex items-center gap-3">
                        <AlertCircle className="w-5 h-5 text-warning-main" />
                        <div>
                            <h2 className="text-lg font-semibold text-theme-200">版本衝突: {fileName}</h2>
                            <p className="text-xs text-theme-400">系統發現在您離線或編輯期間，雲端檔案已被更新。</p>
                        </div>
                    </div>
                    <button onClick={onClose} className="p-2 text-theme-400 hover:text-white hover:bg-theme-800 rounded-lg transition-colors">
                        <X className="w-5 h-5" />
                    </button>
                </div>

                {/* Diff Editor */}
                <div className={`flex-1 ${isDarkTheme(theme) ? 'bg-[#1e1e1e]' : 'bg-white'} relative`}>
                    <div className={`absolute top-0 left-0 right-0 h-8 flex text-xs text-theme-400 ${isDarkTheme(theme) ? 'bg-[#252526] border-[#3c3c3c]' : 'bg-theme-100 border-theme-200'} border-b z-10`}>
                        <div className="flex-1 flex items-center px-4 border-r border-[#3c3c3c] font-mono">
                            雲端最新版本 (Original)
                        </div>
                        <div className="flex-1 flex items-center px-4 font-mono text-warning-main">
                            您的本地版本 (Modified) - 請在此區塊手動修改合併
                        </div>
                    </div>
                    <div className="pt-8 w-full h-full">
                        <DiffEditor
                            original={remoteContent}
                            modified={localContent}
                            language="markdown"
                            theme={isDarkTheme(theme) ? 'vs-dark' : 'light'}
                            onMount={handleMount}
                            options={{
                                renderSideBySide: true,
                                readOnly: false,
                                automaticLayout: true,
                                ignoreTrimWhitespace: false,
                                wordWrap: 'on',
                                minimap: { enabled: false },
                                enableSplitViewResizing: false
                            }}
                        />
                    </div>
                </div>

                {/* Footer Controls */}
                <div className={`p-4 ${isDarkTheme(theme) ? 'bg-theme-950 border-theme-800' : 'bg-theme-100 border-theme-200'} border-t flex justify-between items-center`}>
                    <div className="text-xs text-theme-400">
                        編輯右側面板來手動合併，完成後點擊「確認合併並覆寫」。
                    </div>
                    <div className="flex gap-3">
                        <button
                            onClick={() => onResolve(remoteContent, true)}
                            className="px-4 py-2 text-sm font-medium text-theme-300 bg-theme-800 hover:bg-theme-700 rounded-lg transition-colors border border-theme-700"
                        >
                            <span className="flex items-center gap-2">
                                捨棄本地，保留雲端
                            </span>
                        </button>
                        <button
                            onClick={() => handleResolve(true)}
                            className="px-4 py-2 text-sm font-medium text-theme-50 bg-warning-main hover:bg-warning-hover rounded-lg transition-colors shadow-lg shadow-warning-main/20"
                        >
                            <span className="flex items-center gap-2">
                                <CheckCircle className="w-4 h-4" />
                                確認手動合併並上傳
                            </span>
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );

    return createPortal(modalContent, document.body);
};
