import React, { useEffect, useState, useRef } from 'react';
import { Settings } from 'lucide-react';
import { t } from '../../../language';
import { SettingsPopover } from './SettingsPopover';

interface TitleBarProps {
    theme: 'light' | 'dark' | 'warm' | 'eva' | 'miku';
    onOpenSecurity: () => void;
    onOpenPlugins: () => void;
}

export const TitleBar: React.FC<TitleBarProps> = ({ theme, onOpenSecurity, onOpenPlugins }) => {
    const [isMaximized, setIsMaximized] = useState(false);
    const [showSettings, setShowSettings] = useState(false);
    const [isHidden, setIsHidden] = useState(false);
    const settingsRef = useRef<HTMLDivElement>(null);

    // F11: toggle title bar visibility
    useEffect(() => {
        const handleKey = (e: KeyboardEvent) => {
            if (e.key === 'F11') {
                e.preventDefault();
                setIsHidden(h => !h);
            }
        };
        window.addEventListener('keydown', handleKey);
        return () => window.removeEventListener('keydown', handleKey);
    }, []);

    // Sync maximize state on mount and on change events from main process
    useEffect(() => {
        window.electron?.windowIsMaximized?.().then((v: boolean) => setIsMaximized(v));
        const unsubscribe = window.electron?.onMaximizedStateChanged?.((maximized: boolean) => {
            setIsMaximized(maximized);
        });
        return () => { unsubscribe?.(); };
    }, []);

    // Click-outside to close settings popover
    useEffect(() => {
        const handler = (e: MouseEvent) => {
            if (settingsRef.current && !settingsRef.current.contains(e.target as Node)) {
                setShowSettings(false);
            }
        };
        if (showSettings) document.addEventListener('mousedown', handler);
        return () => document.removeEventListener('mousedown', handler);
    }, [showSettings]);

    const isDark = theme === 'dark';

    if (isHidden) return null;

    return (
        <div
            className={`flex items-center justify-between h-8 shrink-0 select-none border-b transition-colors
                ${isDark ? 'bg-theme-950 border-theme-800 text-theme-400' : 'bg-theme-700 border-theme-600 text-theme-300'}`}
            style={{ WebkitAppRegion: 'drag' } as React.CSSProperties}
        >
            {/* App name (left side) */}
            <div className="flex items-center gap-2 pl-3 text-xs font-semibold tracking-wide truncate">
                <span className={isDark ? 'text-theme-300' : 'text-theme-100'}>Synapse</span>
            </div>

            {/* Window control buttons (right side – no-drag region) */}
            <div
                className="flex items-center h-full"
                style={{ WebkitAppRegion: 'no-drag' } as React.CSSProperties}
            >
                {/* Settings */}
                <div ref={settingsRef} className="relative h-full">
                    <TitleBarBtn
                        title={t.titleBar.settings}
                        isDark={isDark}
                        onClick={() => setShowSettings(p => !p)}
                    >
                        <Settings className="w-3.5 h-3.5" />
                    </TitleBarBtn>

                    {showSettings && (
                        <SettingsPopover
                            theme={theme}
                            onClose={() => setShowSettings(false)}
                            onOpenSecurity={onOpenSecurity}
                            onOpenPlugins={onOpenPlugins}
                        />
                    )}
                </div>

                {/* Minimize */}
                <TitleBarBtn title={t.titleBar.minimize} isDark={isDark} onClick={() => window.electron?.windowMinimize?.()}>
                    {/* — */}
                    <svg width="10" height="10" viewBox="0 0 10 10" fill="currentColor">
                        <rect x="0" y="4.5" width="10" height="1" />
                    </svg>
                </TitleBarBtn>

                {/* Maximize / Restore */}
                <TitleBarBtn title={isMaximized ? t.titleBar.restore : t.titleBar.maximize} isDark={isDark} onClick={() => window.electron?.windowMaximize?.()}>
                    {isMaximized ? (
                        // Restore icon (two overlapping squares)
                        <svg width="10" height="10" viewBox="0 0 10 10" fill="none" stroke="currentColor" strokeWidth="1">
                            <rect x="2" y="0" width="8" height="8" />
                            <rect x="0" y="2" width="8" height="8" fill="var(--color-theme-900)" />
                            <rect x="0" y="2" width="8" height="8" />
                        </svg>
                    ) : (
                        // Maximize icon (single square)
                        <svg width="10" height="10" viewBox="0 0 10 10" fill="none" stroke="currentColor" strokeWidth="1">
                            <rect x="0.5" y="0.5" width="9" height="9" />
                        </svg>
                    )}
                </TitleBarBtn>

                {/* Close — hover: red bg */}
                <button
                    title={t.titleBar.close}
                    onClick={() => window.electron?.windowClose?.()}
                    className={`flex items-center justify-center w-11 h-full transition-colors
                        hover:bg-danger-main hover:text-theme-50
                        ${isDark ? 'text-theme-400' : 'text-theme-300'}`}
                >
                    {/* × */}
                    <svg width="10" height="10" viewBox="0 0 10 10" fill="currentColor">
                        <line x1="0" y1="0" x2="10" y2="10" stroke="currentColor" strokeWidth="1.2" />
                        <line x1="10" y1="0" x2="0" y2="10" stroke="currentColor" strokeWidth="1.2" />
                    </svg>
                </button>
            </div>
        </div>
    );
};

/* Shared button component for min/max/settings */
const TitleBarBtn: React.FC<{
    title: string;
    isDark: boolean;
    onClick: () => void;
    children: React.ReactNode;
}> = ({ title, isDark, onClick, children }) => (
    <button
        title={title}
        onClick={onClick}
        className={`flex items-center justify-center w-11 h-full transition-colors
            ${isDark
                ? 'text-theme-400 hover:bg-theme-800 hover:text-theme-100'
                : 'text-theme-300 hover:bg-theme-600 hover:text-theme-50'
            }`}
    >
        {children}
    </button>
);
