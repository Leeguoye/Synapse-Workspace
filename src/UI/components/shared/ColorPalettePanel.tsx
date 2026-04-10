/**
 * Shared ColorPalettePanel – extracted from CanvasPropertyPanel.tsx
 * Used by Canvas and GraphView for consistent colour picking.
 */
import React, { useState, useCallback } from 'react';
import { Plus } from 'lucide-react';

/* ── Custom palette storage ── */
const CUSTOM_PALETTE_KEY = 'synapse_canvas_custom_palette';
interface PaletteEntry { id: string; label: string; bg: string; border: string; text: string }
function loadCustomPalette(): PaletteEntry[] {
    try { return JSON.parse(localStorage.getItem(CUSTOM_PALETTE_KEY) ?? '[]'); }
    catch { return []; }
}
function saveCustomPalette(entries: PaletteEntry[]) {
    localStorage.setItem(CUSTOM_PALETTE_KEY, JSON.stringify(entries));
}

/* ── RGBA helpers ── */
function clamp(v: number, lo = 0, hi = 255) { return Math.max(lo, Math.min(hi, Math.round(v))); }
export function toRgba(r: number, g: number, b: number, a: number) {
    return `rgba(${clamp(r)},${clamp(g)},${clamp(b)},${Math.max(0, Math.min(1, a)).toFixed(2)})`;
}
export function parseRgba(val: string): [number, number, number, number] {
    if (!val || val === 'transparent') return [255, 255, 255, 0];
    const m = val.match(/rgba?\((\d+),\s*(\d+),\s*(\d+)(?:,\s*([\d.]+))?\)/);
    if (m) return [+m[1], +m[2], +m[3], m[4] !== undefined ? parseFloat(m[4]) : 1];
    const h = val.replace('#', '');
    if (h.length >= 6) {
        const n = parseInt(h.slice(0, 6), 16);
        return [(n >> 16) & 255, (n >> 8) & 255, n & 255, 1];
    }
    return [30, 41, 59, 1];
}

/* ── RGBA sliders ── */
const SLIDER_CHANNELS: { label: string; color: string; key: 'r' | 'g' | 'b' | 'a' }[] = [
    { label: 'R', color: '#ef4444', key: 'r' },
    { label: 'G', color: '#22c55e', key: 'g' },
    { label: 'B', color: '#3b82f6', key: 'b' },
    { label: 'A', color: '#a5b4fc', key: 'a' },
];

const RgbaSliders: React.FC<{
    r: number; g: number; b: number; a: number;
    onChange: (r: number, g: number, b: number, a: number) => void;
}> = ({ r, g, b, a, onChange }) => {
    const vals: Record<string, number> = { r, g, b, a };
    return (
        <div className="synapse-panel mt-1">
            {SLIDER_CHANNELS.map(({ label, color, key }) => {
                const isAlpha = key === 'a';
                const value = vals[key];
                const max = isAlpha ? 1 : 255;
                return (
                    <div key={key} className="flex items-center gap-1.5 mb-1">
                        <span className="text-[10px] text-theme-400 w-3 font-mono">{label}</span>
                        <input
                            type="range" min={0} max={max} step={isAlpha ? 0.05 : 1} value={value}
                            style={{ '--thumb-color': color } as React.CSSProperties}
                            onChange={(e) => {
                                const v = parseFloat(e.target.value);
                                onChange(
                                    key === 'r' ? v : r,
                                    key === 'g' ? v : g,
                                    key === 'b' ? v : b,
                                    key === 'a' ? v : a,
                                );
                            }}
                            className="flex-1"
                        />
                        <span className="text-[10px] text-theme-400 font-mono w-7 text-right">
                            {isAlpha ? Math.round(value * 100) + '%' : Math.round(value)}
                        </span>
                    </div>
                );
            })}
        </div>
    );
};

/* ── Main export ── */
export interface ColorPalettePanelProps {
    currentBg: string;
    currentBorder: string;
    currentText: string;
    /** Pre-defined theme swatches (optional) */
    presets?: { key: string; color: string; label: string }[];
    activePresetKey?: string;
    targetLabels?: { bg: string; border: string; text: string };
    /** Only show these channels in the expanded RGBA picker (default: all three) */
    visibleTargets?: Array<'bg' | 'border' | 'text'>;
    onChange: (bg: string, border: string, text: string) => void;
    onApplyPreset?: (key: string) => void;
    onPickerStateChange?: (open: boolean) => void;

    /** New props for split rendering & customisation */
    showSwatches?: boolean;
    showPicker?: boolean;
    hideCustom?: boolean;
    expanded?: boolean;
    onToggleExpand?: (v: boolean) => void;
    toggleMode?: 'icon' | 'color';
}

const ColorPalettePanel: React.FC<ColorPalettePanelProps> = ({
    currentBg, currentBorder, currentText,
    presets, activePresetKey,
    targetLabels, visibleTargets,
    onChange, onApplyPreset, onPickerStateChange,
    showSwatches = true, showPicker = true, hideCustom = false,
    expanded: controlledExpanded, onToggleExpand,
    toggleMode = 'icon',
}) => {
    // Which channels are visible (default: all)
    const shownTargets = visibleTargets ?? (['bg', 'border', 'text'] as const);
    const [internalExpanded, setInternalExpanded] = useState(false);
    const expanded = controlledExpanded ?? internalExpanded;

    const [target, setTarget] = useState<'bg' | 'border' | 'text'>('border');
    const [customPalette, setCustomPalette] = useState<PaletteEntry[]>(loadCustomPalette);

    const getVal = (t: 'bg' | 'border' | 'text') =>
        t === 'bg' ? currentBg : t === 'border' ? currentBorder : currentText;

    const [r, g, b, a] = parseRgba(getVal(target));
    const previewColor = toRgba(r, g, b, a);

    const toggleExpand = (v: boolean) => {
        if (onToggleExpand) onToggleExpand(v);
        else setInternalExpanded(v);
        onPickerStateChange?.(v);
    };

    const handleSlider = useCallback((nr: number, ng: number, nb: number, na: number) => {
        const rgba = toRgba(nr, ng, nb, na);
        onChange(
            target === 'bg'     ? rgba : currentBg,
            target === 'border' ? rgba : currentBorder,
            target === 'text'   ? rgba : currentText,
        );
    }, [target, currentBg, currentBorder, currentText, onChange]);

    const handleAddToPalette = () => {
        const entry: PaletteEntry = {
            id: `c-${Date.now()}`,
            label: `+${customPalette.length + 1}`,
            bg: currentBg, border: currentBorder, text: currentText,
        };
        const next = [...customPalette, entry];
        setCustomPalette(next);
        saveCustomPalette(next);
    };

    const defaultLabels = { bg: '底色', border: '框線色', text: '文字色' };
    const labels = targetLabels ?? defaultLabels;

    return (
        <div>
            {showSwatches && (
                <div className="flex flex-wrap gap-1 mb-1 items-center">
                    {/* Preset swatches */}
                    {presets?.map(({ key, color, label }) => (
                        <button
                            key={key} title={label}
                            className={`w-5 h-5 rounded-full border-2 transition-transform hover:scale-110 ${activePresetKey === key ? 'border-theme-50 scale-110' : 'border-theme-600'}`}
                            style={{ backgroundColor: color }}
                            onClick={() => onApplyPreset?.(key)}
                        />
                    ))}
                    {/* Saved custom swatches */}
                    {!hideCustom && customPalette.map(entry => (
                        <div key={entry.id} className="relative group">
                            <button title={entry.label}
                                className="w-5 h-5 rounded-full border-2 border-dashed border-theme-500 hover:scale-110 transition-transform"
                                style={{ backgroundColor: entry.border }}
                                onClick={() => onChange(entry.bg, entry.border, entry.text)}
                            />
                            <button
                                className="absolute -top-1 -right-1 hidden group-hover:flex w-3 h-3 rounded-full bg-danger-main text-theme-50 items-center justify-center text-[8px]"
                                onClick={(e) => {
                                    e.stopPropagation();
                                    const next = customPalette.filter(c => c.id !== entry.id);
                                    setCustomPalette(next);
                                    saveCustomPalette(next);
                                }}
                            />
                        </div>
                    ))}
                    {/* Expand/collapse picker */}
                    <button
                        title="自訂顏色"
                        className={`w-5 h-5 rounded-full border-2 flex items-center justify-center transition-all ${expanded ? 'border-primary-main ring-2 ring-primary-main/50' : 'border-theme-500 hover:border-theme-300'} ${toggleMode === 'icon' ? 'border-dashed' : 'border-solid shadow-sm'}`}
                        style={toggleMode === 'color' ? { backgroundColor: currentBorder } : {}}
                        onClick={() => toggleExpand(!expanded)}
                    >
                        {toggleMode === 'icon' && <Plus size={9} />}
                    </button>
                </div>
            )}

            {showPicker && expanded && (
                <div className="rounded-lg bg-theme-800 border border-theme-700 p-2 mb-1">
                    {/* Target buttons — only show channels declared in visibleTargets */}
                    {shownTargets.length > 1 && (
                        <div className="flex gap-0.5 mb-2">
                            {shownTargets.map(k => (
                                <button key={k}
                                    className={`flex-1 px-0.5 py-1 rounded-md border text-[10px] transition-colors ${target === k ? 'bg-primary-main border-primary-main text-theme-50' : 'bg-theme-700 border-theme-600 text-theme-300 hover:bg-theme-600'}`}
                                    onClick={() => setTarget(k)}
                                >
                                    {labels[k]}
                                </button>
                            ))}
                        </div>
                    )}
                    {/* Preview */}
                    <div className="h-4 rounded-sm border border-theme-600 mb-2" style={{ background: previewColor }} />
                    <RgbaSliders r={r} g={g} b={b} a={a} onChange={handleSlider} />
                    {!hideCustom && (
                        <button
                            className="px-2 py-1 rounded-md border text-xs w-full mt-2 bg-primary-main border-primary-main text-theme-50"
                            onClick={handleAddToPalette}
                        >
                            ＋ 儲存至調色盤
                        </button>
                    )}
                </div>
            )}
        </div>
    );
};

export default ColorPalettePanel;
