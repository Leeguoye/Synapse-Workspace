import React, { useState } from 'react';
import { t } from '../../../../language';

interface InputModalProps {
    title: string;
    initialValue: string;
    placeholder?: string;
    onSubmit: (val: string) => void;
    onCancel: () => void;
}

const InputModal: React.FC<InputModalProps> = ({ title, initialValue, placeholder, onSubmit, onCancel }) => {
    const [val, setVal] = useState(initialValue);
    return (
        <div className="fixed inset-0 flex items-center justify-center bg-black/50 z-[100]" onClick={onCancel}>
            <div className="bg-theme-800 p-5 rounded-xl shadow-2xl w-80 border border-theme-700" onClick={(e) => e.stopPropagation()}>
                <h3 className="text-theme-200 text-sm font-semibold mb-3">{title}</h3>
                <input
                    autoFocus
                    placeholder={placeholder}
                    value={val}
                    onChange={(e) => setVal(e.target.value)}
                    onKeyDown={(e) => {
                        e.stopPropagation();
                        if (e.key === 'Enter') onSubmit(val);
                        if (e.key === 'Escape') onCancel();
                    }}
                    className="w-full bg-theme-900 border border-theme-600 rounded px-3 py-2 text-theme-200 text-sm focus:outline-none focus:border-primary-main mb-4 placeholder:text-theme-600"
                />
                <div className="flex justify-end gap-2">
                    <button onClick={onCancel} className="px-3 py-1.5 text-xs text-theme-400 hover:text-theme-300 transition-colors">{t.common.cancel}</button>
                    <button onClick={() => onSubmit(val)} className="px-3 py-1.5 text-xs bg-primary-main hover:bg-primary-hover text-theme-50 rounded transition-colors">{t.common.confirm}</button>
                </div>
            </div>
        </div>
    );
};

export default InputModal;
