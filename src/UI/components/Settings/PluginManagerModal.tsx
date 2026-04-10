import React, { useState, useEffect } from 'react';
import { X, Puzzle, User, HardDrive, CheckCircle2, Plus } from 'lucide-react';
import { t } from '../../../language';

interface PluginData {
    pluginId: string;
    name: string;
    version: string;
    description?: string;
    author?: string;
    isActive: boolean;
}

interface PluginManagerModalProps {
    isOpen: boolean;
    onClose: () => void;
}

export const PluginManagerModal: React.FC<PluginManagerModalProps> = ({ isOpen, onClose }) => {
    const [plugins, setPlugins] = useState<PluginData[]>([]);
    const [loading, setLoading] = useState(false);

    const loadPlugins = async () => {
        setLoading(true);
        try {
            const list = await (window as any).electron.plugins.list();
            setPlugins(list);
        } catch (error) {
            console.error('[PluginManager] Failed to load plugins:', error);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        if (isOpen) {
            loadPlugins();
        }
    }, [isOpen]);

    const handleToggleActive = async (pluginId: string, currentStatus: boolean) => {
        try {
            await (window as any).electron.plugins.setActive(pluginId, !currentStatus);
            // Refresh list to show updated status
            await loadPlugins();
        } catch (error) {
            console.error('[PluginManager] Failed to toggle plugin:', error);
            alert('Failed to update plugin status');
        }
    };

    const handleInstallPlugin = async () => {
        try {
            const res = await (window as any).electron.plugins.install();
            if (res.success) {
                await loadPlugins();
            } else if (res.error) {
                alert(`安裝失敗: ${res.error}`);
            }
        } catch (error) {
            console.error('[PluginManager] Install Error:', error);
            alert('安裝過程中發生錯誤');
        }
    };

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-200">
            <div className="bg-theme-900 border border-theme-700 w-full max-w-2xl rounded-2xl shadow-2xl flex flex-col max-h-[80vh] overflow-hidden">
                
                {/* Header */}
                <div className="px-6 py-4 border-b border-theme-700 flex items-center justify-between bg-theme-800/50">
                    <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-xl bg-primary-main/20 flex items-center justify-center text-primary-text">
                            <Puzzle size={20} />
                        </div>
                        <div>
                            <h2 className="text-lg font-bold text-theme-100 leading-tight">
                                {t.settings?.plugins?.managerTitle || '外掛管理中心'}
                            </h2>
                            <p className="text-xs text-theme-400">
                                {t.settings?.plugins?.managePlugins || '管理您的擴充插件與邏輯節點'}
                            </p>
                        </div>
                    </div>
                    <div className="flex items-center gap-2">
                        <button 
                            onClick={handleInstallPlugin}
                            className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-primary-main/10 hover:bg-primary-main/20 text-primary-text text-sm font-bold transition-all border border-primary-main/30"
                        >
                            <Plus size={16} />
                            {t.common?.add || '安裝'}
                        </button>
                        <button 
                            onClick={onClose}
                            className="p-2 rounded-lg hover:bg-theme-700 text-theme-400 transition-colors"
                        >
                            <X size={20} />
                        </button>
                    </div>
                </div>

                {/* Content */}
                <div className="flex-1 overflow-y-auto p-6 space-y-4">
                    {loading && plugins.length === 0 ? (
                        <div className="flex flex-col items-center justify-center py-20 text-theme-500 gap-3">
                            <div className="w-8 h-8 border-2 border-primary-main border-t-transparent rounded-full animate-spin" />
                            <span className="text-sm">{t.common?.loading}</span>
                        </div>
                    ) : plugins.length === 0 ? (
                        <div className="flex flex-col items-center justify-center py-20 text-theme-500 bg-theme-800/20 rounded-xl border border-dashed border-theme-700">
                            <HardDrive size={40} strokeWidth={1.5} className="mb-3 opacity-20" />
                            <span className="text-sm">{t.common?.noContent}</span>
                        </div>
                    ) : (
                        <div className="grid gap-3">
                            {plugins.map((plugin) => (
                                <div 
                                    key={plugin.pluginId}
                                    className={`group relative p-4 rounded-xl border transition-all duration-200 ${
                                        plugin.isActive 
                                        ? 'bg-primary-main/5 border-primary-main/30' 
                                        : 'bg-theme-800/40 border-theme-700 hover:border-theme-600'
                                    }`}
                                >
                                    <div className="flex items-start justify-between gap-4">
                                        <div className="flex-1 min-w-0">
                                            <div className="flex items-center gap-2 mb-1">
                                                <h3 className="font-bold text-theme-100 truncate">
                                                    {plugin.name}
                                                </h3>
                                                <span className="px-1.5 py-0.5 rounded bg-theme-700 text-[10px] text-theme-300 font-mono">
                                                    v{plugin.version}
                                                </span>
                                                {plugin.isActive && (
                                                    <span className="flex items-center gap-1 text-[10px] text-green-400 font-medium">
                                                        <CheckCircle2 size={10} /> Active
                                                    </span>
                                                )}
                                            </div>
                                            
                                            <div className="flex items-center gap-3 text-[11px] text-theme-400 mb-2">
                                                <div className="flex items-center gap-1 truncate max-w-[150px]">
                                                    <User size={12} className="shrink-0" />
                                                    {plugin.author || t.settings?.plugins?.unknownDeveloper}
                                                </div>
                                                <div className="font-mono opacity-60">
                                                    ID: {plugin.pluginId}
                                                </div>
                                            </div>

                                            {plugin.description && (
                                                <p className="text-xs text-theme-500 line-clamp-2 leading-relaxed">
                                                    {plugin.description}
                                                </p>
                                            )}
                                        </div>

                                        {/* Toggle Switch */}
                                        <button
                                            onClick={() => handleToggleActive(plugin.pluginId, plugin.isActive)}
                                            className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${
                                                plugin.isActive ? 'bg-primary-main' : 'bg-theme-700'
                                            }`}
                                        >
                                            <span 
                                                className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${
                                                    plugin.isActive ? 'translate-x-5' : 'translate-x-0'
                                                }`}
                                            />
                                        </button>
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </div>

                {/* Footer */}
                <div className="px-6 py-4 bg-theme-800/50 border-t border-theme-700 flex justify-end">
                    <button
                        onClick={onClose}
                        className="px-6 py-2 rounded-lg bg-theme-700 hover:bg-theme-600 text-theme-200 text-sm font-medium transition-all"
                    >
                        {t.common?.confirm || 'Close'}
                    </button>
                </div>
            </div>
        </div>
    );
};
