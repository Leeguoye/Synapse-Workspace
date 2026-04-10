import React from 'react';
import { ShieldAlert, CheckCircle2, XCircle } from 'lucide-react';
import type { PluginManifest, PermissionsPattern } from '../../../shared/plugin.types';
import { t } from '../../../language';
import { resolvePluginLabel } from '../../utils/pluginI18n';


interface PluginAuthModalProps {
    isOpen: boolean;
    manifest: PluginManifest | null;
    onApprove: () => void;
    onReject: () => void;
}

export const PluginAuthModal: React.FC<PluginAuthModalProps> = ({ 
    isOpen, 
    manifest, 
    onApprove, 
    onReject 
}) => {
    if (!isOpen || !manifest) return null;

    return (
        <div className="fixed inset-0 z-[200] flex items-center justify-center bg-black/60 backdrop-blur-md">
            <div className="bg-theme-900 border border-theme-700 shadow-2xl rounded-2xl w-full max-w-md overflow-hidden flex flex-col transform transition-all">
                
                {/* Header Icon */}
                <div className="flex flex-col items-center pt-8 pb-4 bg-theme-800/30">
                    <div className="w-16 h-16 bg-warning-main/10 rounded-full flex items-center justify-center mb-4">
                        <ShieldAlert className="w-8 h-8 text-warning-main" />
                    </div>
                    <h2 className="text-xl font-bold text-theme-100">{t.settings?.plugins?.authTitle || '外掛授權請求'}</h2>
                    <p className="text-sm text-theme-400 mt-2 text-center px-6">
                        <span className="font-bold text-primary-text">{resolvePluginLabel(manifest.name)}</span> {t.settings?.plugins?.authDesc}
                    </p>
                </div>

                {/* Details */}
                <div className="px-6 py-4 space-y-4">
                    <div className="space-y-1">
                        <div className="text-xs font-semibold text-theme-500 uppercase tracking-wide">{t.settings?.plugins?.developer}</div>
                        <div className="text-sm text-theme-200">{manifest.author || t.settings?.plugins?.unknownDeveloper}</div>
                    </div>
                    
                    <div className="space-y-1">
                        <div className="text-xs font-semibold text-theme-500 uppercase tracking-wide">{t.settings?.plugins?.version}</div>
                        <div className="text-sm text-theme-200">{manifest.version}</div>
                    </div>

                    <div className="space-y-2">
                        <div className="text-xs font-semibold text-theme-500 uppercase tracking-wide mt-4">{t.settings?.plugins?.requestedPermissions}</div>
                        <div className="bg-theme-800 border border-theme-700 rounded-lg p-3 space-y-2">
                            {manifest.permissions.map((p: PermissionsPattern) => (
                                <div key={p} className="flex items-start gap-2 text-sm text-theme-200">
                                    <CheckCircle2 className="w-4 h-4 text-warning-main shrink-0 mt-0.5" />
                                    <span>{p}</span>
                                </div>
                            ))}
                            {manifest.permissions.length === 0 && (
                                <div className="text-sm text-theme-500 italic">{t.settings?.plugins?.noSpecialPermissions}</div>
                            )}
                        </div>
                    </div>
                    
                    <div className="p-3 bg-danger-main/10 border border-danger-main/20 rounded-lg mt-2">
                        <p className="text-xs text-danger-text leading-relaxed">
                            {t.settings?.plugins?.warning}
                        </p>
                    </div>
                </div>

                {/* Actions */}
                <div className="flex items-center gap-3 px-6 py-5 bg-theme-800/30 border-t border-theme-800">
                    <button 
                        onClick={onReject}
                        className="flex-1 flex justify-center items-center gap-2 py-2.5 rounded-xl border border-theme-600 text-theme-300 font-medium hover:bg-theme-700 hover:text-theme-100 transition-colors"
                    >
                        <XCircle className="w-4 h-4" /> {t.settings?.plugins?.reject}
                    </button>
                    <button 
                        onClick={onApprove}
                        className="flex-1 flex justify-center items-center gap-2 py-2.5 rounded-xl bg-primary-main text-white font-medium hover:bg-primary-hover shadow-lg shadow-primary-main/20 transition-all"
                    >
                        <ShieldAlert className="w-4 h-4" /> {t.settings?.plugins?.allow}
                    </button>
                </div>
            </div>
        </div>
    );
};
