import React from 'react';
import { Code, ChevronDown, Key, Puzzle } from 'lucide-react';
import { t } from '../../../language';

import { THEMES } from '../../configs/themeConfig';
import type { ThemeType } from '../../configs/themeConfig';
interface SettingsPopoverProps {
    theme: ThemeType;
    onClose: () => void;
    onOpenSecurity: () => void;
    onOpenPlugins: () => void;
}

/** 基礎語言 (Built-in languages) */
const BASE_LANGUAGES = [
    { code: 'zh-TW', label: '繁體中文' },
    { code: 'en-US', label: 'English' },
];

export const SettingsPopover: React.FC<SettingsPopoverProps> = ({ theme, onClose, onOpenSecurity, onOpenPlugins }) => {
    const currentLang = localStorage.getItem('language') ?? 'zh-TW';
    const [languages, setLanguages] = React.useState(BASE_LANGUAGES);

    React.useEffect(() => {
        // 抓取額外語系 (Fetch extra languages from plugins)
        window.electron?.plugins?.listLanguages?.().then((codes: string[]) => {
            if (codes && codes.length > 0) {
                const combined = [...BASE_LANGUAGES];
                
                // 定義常見代碼的映射表
                const labelMap: Record<string, string> = {
                    'zh-CN': '简体中文',
                    'ja-JP': '日本語',
                    'ko-KR': '한국어',
                    'fr-FR': 'Français',
                    'de-DE': 'Deutsch',
                };

                codes.forEach(code => {
                    if (!combined.find(l => l.code === code)) {
                        combined.push({ 
                            code, 
                            label: labelMap[code] || code 
                        });
                    }
                });
                setLanguages(combined);
            }
        });
    }, []);

    const handleLanguageChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
        localStorage.setItem('language', e.target.value);
        window.location.reload();
    };

    const handleOpenDevTools = () => {
        window.electron?.windowOpenDevTools?.();
        onClose();
    };

    /** 選擇色系後呼叫全域 setTheme */
    const handleThemeChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
        const selected = e.target.value as ThemeType;
        if (selected !== theme) {
            (window as any).setTheme(selected);
        }
    };

    // Shared select className
    const selectCls = `w-full px-3 py-2 text-sm rounded-lg border outline-none appearance-none cursor-pointer
        transition-colors pr-8
        bg-theme-800 border-theme-700 text-theme-200 hover:bg-theme-700`;

    const sectionLabel = 'px-1 pb-1 text-[10px] font-bold uppercase tracking-wider text-theme-500';

    return (
        <div
            className="absolute right-0 top-full mt-1 z-50 w-52 rounded-xl shadow-2xl border overflow-hidden p-3 space-y-3
                bg-theme-900 border-theme-700"
        >
            {/* ── Section: 主題 ── */}
            <div>
                <div className={sectionLabel}>{t.titleBar.theme}</div>
                <div className="relative">
                    <select
                        value={theme}
                        onChange={handleThemeChange}
                        className={selectCls}
                    >
                        {THEMES.map(opt => (
                            <option key={opt.id} value={opt.id}>
                                {(t.titleBar as any)[opt.labelKey]}
                            </option>
                        ))}
                    </select>
                    <ChevronDown className="absolute right-2 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-theme-500 pointer-events-none" />
                </div>
            </div>

            <div className="h-px bg-theme-800" />

            {/* ── Section: 語言 ── */}
            <div>
                <div className={sectionLabel}>{t.titleBar.language}</div>
                <div className="relative">
                    <select
                        value={currentLang}
                        onChange={handleLanguageChange}
                        className={selectCls}
                    >
                        {languages.map(lang => (
                            <option key={lang.code} value={lang.code}>
                                {lang.label}
                            </option>
                        ))}
                    </select>
                    <ChevronDown className="absolute right-2 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-theme-500 pointer-events-none" />
                </div>
            </div>

            <div className="h-px bg-theme-800" />

            {/* ── Section: 進階 ── */}
            <div>
                <div className={sectionLabel}>{t.settings?.advanced || '進階 (Advanced)'}</div>
                <button
                    onClick={() => {
                        onOpenSecurity();
                        onClose();
                    }}
                    className="flex items-center gap-2 w-full px-3 py-2 text-sm rounded-lg transition-colors hover:bg-theme-800 text-theme-200"
                >
                    <Key className="w-3.5 h-3.5 text-primary-text shrink-0" />
                    {t.settings?.securityAndExtensions || '安全與擴充中心'}
                </button>
                <button
                    onClick={() => {
                        onOpenPlugins();
                        onClose();
                    }}
                    className="flex items-center gap-2 w-full px-3 py-2 text-sm rounded-lg transition-colors hover:bg-theme-800 text-theme-200"
                >
                    <Puzzle className="w-3.5 h-3.5 text-primary-text shrink-0" />
                    {t.settings?.plugins?.managePlugins || '外掛管理'}
                </button>
                <button
                    onClick={handleOpenDevTools}
                    className="flex items-center gap-2 w-full px-3 py-2 text-sm rounded-lg transition-colors hover:bg-theme-800 text-theme-200"
                >
                    <Code className="w-3.5 h-3.5 text-primary-text shrink-0" />
                    {t.titleBar.openDevTools}
                </button>
            </div>
        </div>
    );
};
