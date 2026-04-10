import React, { useState, useEffect } from 'react';
import { Key, Upload, Trash2, X, Plus } from 'lucide-react';
import { t } from '../../../language';

interface CredentialModalProps {
    isOpen: boolean;
    onClose: () => void;
}

export const CredentialModal: React.FC<CredentialModalProps> = ({ isOpen, onClose }) => {
    const [credentials, setCredentials] = useState<any[]>([]);
    const [isAdding, setIsAdding] = useState(false);
    
    // Add form state
    const [addType, setAddType] = useState<'string' | 'file'>('string');
    const [addKey, setAddKey] = useState('');
    const [addName, setAddName] = useState('');
    const [addValue, setAddValue] = useState('');
    const [addFile, setAddFile] = useState<File | null>(null);

    useEffect(() => {
        if (isOpen) {
            loadCredentials();
        } else {
            // Reset state
            setIsAdding(false);
            setAddKey('');
            setAddName('');
            setAddValue('');
            setAddFile(null);
        }
    }, [isOpen]);

    const loadCredentials = async () => {
        const list = await window.electron?.credentials?.list?.() || [];
        setCredentials(list);
    };

    const handleDelete = async (key: string) => {
        await window.electron?.credentials?.delete?.(key);
        await loadCredentials();
    };

    const handleSave = async () => {
        if (!addKey || !addName) return;

        let input: any = { key: addKey, name: addName, type: addType };

        if (addType === 'string') {
            if (!addValue) return;
            input.value = addValue;
        } else {
            if (!addFile) return;
            // Read file as text (assuming JSON or basic text for now). 
            // Better practice for binary files would be base64.
            const content = await addFile.text();
            input.fileName = addFile.name;
            input.fileContent = content;
        }

        await window.electron?.credentials?.save?.(input);
        await loadCredentials();
        setIsAdding(false);
        setAddKey('');
        setAddName('');
        setAddValue('');
        setAddFile(null);
    };

    if (!isOpen) return null;

    const inputCls = "w-full px-3 py-2 text-sm rounded-lg border outline-none bg-theme-800 border-theme-700 text-theme-200 focus:border-primary-main focus:ring-1 focus:ring-primary-main transition-colors";

    return (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/50 backdrop-blur-sm">
            <div className="bg-theme-900 border border-theme-700 shadow-2xl rounded-xl w-full max-w-2xl overflow-hidden flex flex-col max-h-[85vh]">
                {/* Header */}
                <div className="flex items-center justify-between px-6 py-4 border-b border-theme-800 shrink-0">
                    <h2 className="text-lg font-bold text-theme-100 flex items-center gap-2">
                        <Key className="w-5 h-5 text-primary-main" />
                        {t.settings?.credentials?.title || '安全與擴充 (Security & Credentials)'}
                    </h2>
                    <button onClick={onClose} className="p-1 hover:bg-theme-800 rounded-lg text-theme-400 hover:text-theme-100 transition-colors">
                        <X className="w-5 h-5" />
                    </button>
                </div>

                {/* Content */}
                <div className="flex-1 overflow-y-auto p-6 flex flex-col gap-6">
                    {/* List Section */}
                    <div>
                        <div className="flex items-center justify-between mb-4">
                            <h3 className="text-sm font-bold uppercase tracking-wider text-theme-500">{t.settings?.credentials?.savedList}</h3>
                            {!isAdding && (
                                <button 
                                    onClick={() => setIsAdding(true)}
                                    className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium bg-primary-main/10 text-primary-text hover:bg-primary-main/20 rounded-md transition-colors"
                                >
                                    <Plus className="w-4 h-4" /> {t.settings?.credentials?.addCredential}
                                </button>
                            )}
                        </div>

                        {credentials.length === 0 && !isAdding && (
                            <div className="text-center py-8 text-theme-500 text-sm">
                                {t.settings?.credentials?.noCredentials}
                            </div>
                        )}

                        <div className="space-y-3">
                            {credentials.map(c => (
                                <div key={c.key} className="flex items-center justify-between p-3 rounded-lg border border-theme-700 bg-theme-800/50">
                                    <div className="flex flex-col">
                                        <span className="text-sm font-medium text-theme-200">{c.name}</span>
                                        <span className="text-xs text-theme-500">ID: {c.key} | Type: {c.type === 'file' ? t.settings?.credentials?.typeFile : t.settings?.credentials?.typeString}</span>
                                    </div>
                                    <button 
                                        onClick={() => handleDelete(c.key)}
                                        className="p-2 text-theme-500 hover:text-danger-main hover:bg-danger-main/10 rounded-lg transition-colors"
                                    >
                                        <Trash2 className="w-4 h-4" />
                                    </button>
                                </div>
                            ))}
                        </div>
                    </div>

                    {/* Add Section */}
                    {isAdding && (
                        <div className="p-5 border border-theme-700 rounded-xl bg-theme-800 space-y-4">
                            <h3 className="text-sm font-bold text-theme-200 mb-2">{t.settings?.credentials?.addNew}</h3>
                            
                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-xs text-theme-400 mb-1">{t.settings?.credentials?.keyLabel}</label>
                                    <input 
                                        value={addKey} onChange={e => setAddKey(e.target.value)}
                                        className={inputCls} placeholder={t.settings?.credentials?.keyPlaceholder}
                                    />
                                </div>
                                <div>
                                    <label className="block text-xs text-theme-400 mb-1">{t.settings?.credentials?.nameLabel}</label>
                                    <input 
                                        value={addName} onChange={e => setAddName(e.target.value)}
                                        className={inputCls} placeholder={t.settings?.credentials?.namePlaceholder}
                                    />
                                </div>
                            </div>
                            
                            <div>
                                <label className="block text-xs text-theme-400 mb-1">{t.settings?.credentials?.typeLabel}</label>
                                <div className="flex gap-4">
                                    <label className="flex items-center gap-2 text-sm text-theme-200 cursor-pointer">
                                        <input type="radio" checked={addType === 'string'} onChange={() => setAddType('string')} className="accent-primary-main" />
                                        <span>{t.settings?.credentials?.typeStringOption}</span>
                                    </label>
                                    <label className="flex items-center gap-2 text-sm text-theme-200 cursor-pointer">
                                        <input type="radio" checked={addType === 'file'} onChange={() => setAddType('file')} className="accent-primary-main" />
                                        <span>{t.settings?.credentials?.typeFileOption}</span>
                                    </label>
                                </div>
                            </div>

                            {addType === 'string' ? (
                                <div>
                                    <label className="block text-xs text-theme-400 mb-1">{t.settings?.credentials?.secretLabel}</label>
                                    <input 
                                        type="password"
                                        value={addValue} onChange={e => setAddValue(e.target.value)}
                                        className={inputCls} placeholder={t.settings?.credentials?.secretPlaceholder}
                                    />
                                </div>
                            ) : (
                                <div>
                                    <label className="block text-xs text-theme-400 mb-1">{t.settings?.credentials?.fileLabel}</label>
                                    <label className="flex items-center justify-center w-full min-h-[80px] px-3 py-2 text-sm rounded-lg border-2 border-dashed border-theme-600 hover:border-primary-main bg-theme-900 text-theme-400 cursor-pointer transition-colors">
                                        {addFile ? (
                                            <span className="text-theme-200">{addFile.name} ({(addFile.size / 1024).toFixed(1)} KB)</span>
                                        ) : (
                                            <div className="flex flex-col items-center gap-1">
                                                <Upload className="w-5 h-5 mb-1 text-theme-500" />
                                                {t.settings?.credentials?.browseFile}
                                            </div>
                                        )}
                                        <input 
                                            type="file" 
                                            className="hidden" 
                                            onChange={e => {
                                                const f = e.target.files?.[0];
                                                if (f) setAddFile(f);
                                            }} 
                                        />
                                    </label>
                                </div>
                            )}

                            {/* Actions */}
                            <div className="flex justify-end gap-3 mt-4 pt-4 border-t border-theme-700">
                                <button 
                                    onClick={() => setIsAdding(false)}
                                    className="px-4 py-2 text-sm font-medium text-theme-300 hover:bg-theme-700/50 rounded-lg transition-colors"
                                >
                                    {t.settings?.credentials?.cancel}
                                </button>
                                <button 
                                    onClick={handleSave}
                                    disabled={!addKey || !addName || (addType === 'string' && !addValue) || (addType === 'file' && !addFile)}
                                    className="px-4 py-2 text-sm font-medium bg-primary-main text-white rounded-lg hover:bg-primary-hover disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                                >
                                    {t.settings?.credentials?.save}
                                </button>
                            </div>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};
