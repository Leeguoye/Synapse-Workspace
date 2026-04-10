import React, { useState, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { Plus } from 'lucide-react';
import type { Tag } from '../../../shared/types';
import { t } from '../../../language';

interface TagPopoverProps {
    currentWorkspaceId?: string;
    existingTags: string[];
    onAddTag: (tagName: string) => void;
}

export const TagPopover: React.FC<TagPopoverProps> = ({
    currentWorkspaceId,
    existingTags,
    onAddTag
}) => {
    const [isOpen, setIsOpen] = useState(false);
    const [tagInput, setTagInput] = useState('');
    const [recentTags, setRecentTags] = useState<Tag[]>([]);
    const [isSubmitting, setIsSubmitting] = useState(false);

    const buttonRef = useRef<HTMLButtonElement>(null);
    const menuRef = useRef<HTMLDivElement>(null);
    const inputRef = useRef<HTMLInputElement>(null);

    const [menuStyle, setMenuStyle] = useState<React.CSSProperties>({});

    useEffect(() => {
        if (isOpen) {
            window.electron.getTags(currentWorkspaceId).then(setRecentTags).catch(console.error);
            setTimeout(() => inputRef.current?.focus(), 50);

            if (buttonRef.current) {
                const rect = buttonRef.current.getBoundingClientRect();
                setMenuStyle({
                    position: 'fixed',
                    top: `${rect.bottom + 4}px`,
                    right: `${window.innerWidth - rect.right}px`,
                    zIndex: 99999
                });
            }
        }
    }, [isOpen, currentWorkspaceId]);

    useEffect(() => {
        const handleClickOutside = (e: MouseEvent) => {
            if (
                buttonRef.current && !buttonRef.current.contains(e.target as Node) &&
                menuRef.current && !menuRef.current.contains(e.target as Node)
            ) {
                setIsOpen(false);
                setTagInput('');
            }
        };
        if (isOpen) document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, [isOpen]);

    const filteredTags = recentTags.filter(t => t.name.toLowerCase().includes(tagInput.toLowerCase()));

    const submitNewTag = async (tagName: string) => {
        const cleanName = tagName.trim();
        if (!cleanName || isSubmitting) return;

        setIsSubmitting(true);
        try {
            onAddTag(cleanName);
            setTagInput('');
            setIsOpen(false);
        } finally {
            setIsSubmitting(false);
        }
    };

    return (
        <div className="relative flex">
            <button
                ref={buttonRef}
                onClick={() => setIsOpen(!isOpen)}
                className="flex items-center gap-1 justify-center px-1.5 py-0.5 rounded-md bg-theme-800 text-theme-400 hover:bg-theme-700 hover:text-theme-50 border border-theme-700 transition-colors whitespace-nowrap"
                title={t.editor.newTag}
            >
                <Plus className="w-3.5 h-3.5" />
                <span className="text-xs font-medium">{t.editor.newTag}</span>
            </button>

            {isOpen && createPortal(
                <div
                    ref={menuRef}
                    className="w-48 bg-theme-800 border border-theme-600 rounded-lg shadow-xl p-2 animate-in fade-in zoom-in-95"
                    style={menuStyle}
                >
                    <input
                        ref={inputRef}
                        type="text"
                        value={tagInput}
                        onChange={e => setTagInput(e.target.value)}
                        onKeyDown={e => {
                            if (e.key === 'Enter') submitNewTag(tagInput);
                            if (e.key === 'Escape') {
                                setIsOpen(false);
                                setTagInput('');
                            }
                        }}
                        placeholder={t.editor.newTagPrompt}
                        className="w-full bg-theme-900 text-xs text-theme-200 px-2 py-1.5 rounded border border-theme-700 focus:outline-none focus:border-primary-main mb-2"
                        disabled={isSubmitting}
                    />

                    <div className="overflow-y-auto custom-scrollbar max-h-32">
                        {filteredTags.length > 0 ? (
                            <div className="flex flex-col gap-0.5">
                                {filteredTags.map(tag => (
                                    <button
                                        key={tag.id}
                                        onClick={() => submitNewTag(tag.name)}
                                        disabled={isSubmitting || existingTags.includes(tag.name)}
                                        className={`text-left px-2 py-1 rounded text-[10px] truncate transition-colors ${existingTags.includes(tag.name)
                                            ? 'opacity-50 cursor-not-allowed'
                                            : 'hover:bg-theme-700 text-theme-300'
                                            }`}
                                    >
                                        {tag.name}
                                    </button>
                                ))}
                            </div>
                        ) : (
                            <div className="text-[10px] text-theme-500 text-center py-2 text-wrap">
                                {tagInput ? '按下 Enter 新增標籤' : '無建議標籤'}
                            </div>
                        )}
                    </div>
                </div>,
                document.body
            )}
        </div>
    );
};
