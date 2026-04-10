import React from 'react';
import { Info, X } from 'lucide-react';
import type { DriveFile } from '../../../../shared/types';
import { t } from '../../../../language';

interface FilePropertiesModalProps {
    propertiesFile: DriveFile;
    onClose: () => void;
}

const FilePropertiesModal: React.FC<FilePropertiesModalProps> = ({ propertiesFile, onClose }) => {
    return (
        <div className="fixed inset-0 flex items-center justify-center bg-black/50 z-[110]" onClick={onClose}>
            <div className="bg-theme-800 p-5 rounded-xl shadow-2xl w-96 border border-theme-700 flex flex-col gap-3" onClick={e => e.stopPropagation()}>
                <div className="flex items-center justify-between border-b border-theme-700 pb-2 mb-2">
                    <h3 className="text-theme-200 text-sm font-semibold flex items-center gap-2"><Info className="w-4 h-4 text-primary-text" /> {t.properties.title}</h3>
                    <button onClick={onClose} className="text-theme-400 hover:text-white"><X className="w-4 h-4" /></button>
                </div>
                <div className="text-sm text-theme-300 flex flex-col gap-2">
                    <p><span className="text-theme-500 w-20 inline-block">{t.properties.name}</span> {propertiesFile.name}</p>
                    <p><span className="text-theme-500 w-20 inline-block">{t.properties.type}</span> <span className="text-xs font-mono bg-theme-900 px-1 py-0.5 rounded">{propertiesFile.mimeType}</span></p>
                    {propertiesFile.size && <p><span className="text-theme-500 w-20 inline-block">{t.properties.size}</span> {(parseInt(propertiesFile.size, 10) / 1024).toFixed(1)} KB</p>}
                    <p><span className="text-theme-500 w-20 inline-block">{t.properties.owner}</span> {propertiesFile.ownerName || t.common.me}</p>

                    {/* 詳細描述 / 網址資料 */}
                    {propertiesFile.description && (
                        <div className="mt-2 pt-2 border-t border-theme-700">
                            <span className="text-theme-500 text-xs mb-1 block">{t.properties.detailsOrUrl}</span>
                            <div className="text-xs font-mono bg-theme-900 px-2 py-1.5 rounded break-all whitespace-pre-wrap text-theme-300">
                                {propertiesFile.description}
                            </div>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};

export default FilePropertiesModal;
