/**
 * Synapse Theme Configuration
 * 
 * To add a new theme:
 * 1. Add the theme ID to the ThemeType union.
 * 2. Add a new ThemeOption to the THEMES array.
 * 3. Define the corresponding CSS variables in src/UI/index.css (e.g., .theme-newtheme).
 * 4. Add the localized name to src/language/zh-TW.ts and en-US.ts under the titleBar section.
 */

export type ThemeType = 'light' | 'dark' | 'warm' | 'eva' | 'miku';

export interface ThemeOption {
    id: ThemeType;
    /** Key in t.titleBar (e.g., 'themeLight') */
    labelKey: string;
    /** Whether this theme should be treated as 'dark' for external libraries (Monaco, ReactFlow) and prose-invert */
    isDark: boolean;
    /** Icon name from lucide-react (string key) */
    iconName: string;
}

export const THEMES: ThemeOption[] = [
    { id: 'light', labelKey: 'themeLight', isDark: false, iconName: 'Sun'    },
    { id: 'dark',  labelKey: 'themeDark',  isDark: true,  iconName: 'Moon'   },
    { id: 'warm',  labelKey: 'themeWarm',  isDark: false, iconName: 'Coffee' },
    { id: 'eva',   labelKey: 'themeEva',   isDark: true,  iconName: 'Zap'    },
    { id: 'miku',  labelKey: 'themeMiku',  isDark: false, iconName: 'Music'  },
];

/**
 * Helper to determine if a theme is "dark" for UI logic (e.g. Monaco/ReactFlow mode)
 */
export const isDarkTheme = (theme?: ThemeType | string): boolean => {
    if (!theme) return true;
    const found = THEMES.find(t => t.id === theme);
    return found ? found.isDark : false;
};

/**
 * Helper to get the Monaco editor theme base (vs or vs-dark)
 */
export const getMonacoBaseTheme = (theme?: ThemeType | string): 'vs' | 'vs-dark' => {
    return isDarkTheme(theme) ? 'vs-dark' : 'vs';
};
