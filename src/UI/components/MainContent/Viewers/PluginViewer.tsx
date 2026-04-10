import React, { useEffect, useState } from 'react';
import type { DriveFile } from '../../../../shared/types';
import { Loader2, AlertCircle } from 'lucide-react';

interface PluginViewerProps {
  file: DriveFile;
}

const PluginViewer: React.FC<PluginViewerProps> = ({ file }) => {
  const [htmlContent, setHtmlContent] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [themeKey, setThemeKey] = useState<string>('');

  // 1. 動態主題監看 (Host -> Plugin Sync)
  useEffect(() => {
    console.log('[PluginViewer:Theme] Initializing MutationObserver for theme sync.');
    const observer = new MutationObserver(() => {
      const currentClasses = document.body.className;
      console.log('[PluginViewer:Theme] Theme change detected:', currentClasses);
      setThemeKey(currentClasses);
    });

    observer.observe(document.body, { attributes: true, attributeFilter: ['class'] });
    setThemeKey(document.body.className);

    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    const loadPlugin = async () => {
      setLoading(true);
      setError(null);
      try {
        const pluginId = file.mimeType.replace('application/vnd.synapse.plugin.', '');
        console.log(`[PluginViewer:Loader] Initializing plugin: ${pluginId}`);
        
        let inputs: Record<string, any> = {};
        try {
          if (file.description && file.description.startsWith('{')) {
            inputs = JSON.parse(file.description);
          }
        } catch (e) {
          console.warn('[PluginViewer:Loader] Failed to parse file description', e);
        }

        const nodeType = 'workflow-dashboard';
        const language = localStorage.getItem('language') || 'zh-TW';
        inputs.language = language;
        
        console.log(`[PluginViewer:Loader] Executing entry node: ${nodeType}`, inputs);
        const result = await (window as any).electron.plugins.execute(pluginId, nodeType, inputs);
        
        if (result && typeof result.html === 'string') {
          console.log('[PluginViewer:Loader] Success. Received HTML payload.');
          setHtmlContent(result.html);
        } else {
          throw new Error('Plugin executed but returned no HTML output.');
        }
      } catch (err: any) {
        console.error('[PluginViewer:Loader] Error loading plugin:', err);
        setError(err.message || 'Unknown error occurred while loading the plugin.');
      } finally {
        setLoading(false);
      }
    };

    loadPlugin();
  }, [file.id, file.mimeType, file.description]);

  useEffect(() => {
    const handleMessage = async (event: MessageEvent) => {
      // Security: Check origin if needed, but since it's srcDoc it's nullish or from current origin
      const { type, payload } = event.data;
      if (!type) return;

      console.log(`[PluginViewer:Bridge] Inbound Message: ${type}`, payload);

      try {
        switch (type) {
          case 'PLUGIN_UPDATE_META':
            console.log('[PluginViewer:Bridge] Updating file metadata...', file.id);
            await (window as any).electron.updateFileMeta(file.id, payload.name, payload.description, payload.appProperties);
            window.location.reload();
            break;

          case 'PLUGIN_CREATE_SHEET':
            console.log('[PluginViewer:Bridge] Creating Google Sheet...', payload.name);
            const newSheet = await (window as any).electron.createFile(file.parentId || undefined, 'application/vnd.google-apps.spreadsheet', payload.name);
            if (newSheet.success) {
               console.log('[PluginViewer:Bridge] Sheet created. Returning result');
               event.source?.postMessage({ type: 'PLUGIN_SHEET_CREATED', payload: newSheet.file }, '*' as any);
            }
            break;

          case 'PLUGIN_EXECUTE_NODE':
            // 通用處理器：允許插件 UI 觸發任何背景邏輯節點
            const pluginId = file.mimeType.replace('application/vnd.synapse.plugin.', '');
            console.log(`[PluginViewer:Bridge] Executing background node: ${payload.nodeType}`);
            
            const result = await (window as any).electron.plugins.execute(pluginId, payload.nodeType, payload.inputs);
            
            console.log(`[PluginViewer:Bridge] Execution complete. Returning: PLUGIN_NODE_OUTPUT`);
            event.source?.postMessage({ 
              type: 'PLUGIN_NODE_OUTPUT', 
              payload: { ...result, nodeType: payload.nodeType } 
            }, '*' as any);
            break;
        }
      } catch (err) {
        console.error('[PluginViewer:Bridge] Error handling message:', err);
      }
    };

    window.addEventListener('message', handleMessage);
    return () => window.removeEventListener('message', handleMessage);
  }, [file.id, file.parentId]);

  const themeInjectedHtml = React.useMemo(() => {
    if (!htmlContent) return '';
    
    // Extract theme variables from body to pass to iframe
    const bodyStyles = getComputedStyle(document.body);
    const themeVars: Record<string, string> = {};
    const varsToExtract = [
      '--color-theme-50', '--color-theme-100', '--color-theme-200', '--color-theme-300', '--color-theme-400',
      '--color-theme-500', '--color-theme-600', '--color-theme-700', '--color-theme-800', '--color-theme-900',
      '--app-bg', '--app-text', '--app-border', '--primary-main', '--primary-hover'
    ];
    varsToExtract.forEach(v => themeVars[v] = bodyStyles.getPropertyValue(v).trim());
    
    const styleTag = `
      <style id="synapse-injected-styles">
        /* Base Reset & Forced Scrolling */
        html, body {
          height: 100% !important;
          margin: 0 !important;
          padding: 0 !important;
          overflow-y: auto !important;
          background-color: var(--app-bg, #1a1a1a);
          color: var(--app-text, #e5e5e5);
          font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
          -webkit-font-smoothing: antialiased;
        }

        /* SVG & Image Scaling Fix ("排版失效" Fix) */
        svg, img {
          max-width: 100%;
          height: auto !important;
          display: inline-block;
          vertical-align: middle;
        }
        svg { width: 1.5em; height: 1.5em; flex-shrink: 0; }

        /* Synapse Plugin Base UI (CSS-First System) */
        .syn-card {
          background: var(--color-theme-800, #252526);
          border: 1px solid var(--app-border, #333);
          border-radius: 8px;
          padding: 1rem;
          margin-bottom: 1rem;
          box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1);
        }
        .syn-btn {
          background: var(--primary-main, #3b82f6);
          color: white;
          padding: 0.5rem 1rem;
          border-radius: 4px;
          border: none;
          cursor: pointer;
          transition: opacity 0.2s;
        }
        .syn-btn:hover { opacity: 0.8; }
        .syn-text-muted { color: var(--color-theme-400, #9e9e9e); }

        /* Theme Variables Sync */
        :root {
          --color-theme-50: ${themeVars['--color-theme-50'] || '#fff'};
          --color-theme-100: ${themeVars['--color-theme-100'] || '#f5f5f5'};
          --color-theme-200: ${themeVars['--color-theme-200'] || '#e5e5e5'};
          --color-theme-300: ${themeVars['--color-theme-300'] || '#ccc'};
          --color-theme-400: ${themeVars['--color-theme-400'] || '#9e9e9e'};
          --color-theme-500: ${themeVars['--color-theme-500'] || '#737373'};
          --color-theme-600: ${themeVars['--color-theme-600'] || '#454545'};
          --color-theme-700: ${themeVars['--color-theme-700'] || '#333'};
          --color-theme-800: ${themeVars['--color-theme-800'] || '#252526'};
          --color-theme-900: ${themeVars['--color-theme-900'] || '#1e1e1e'};
          --app-bg: ${themeVars['--app-bg'] || '#1e1e1e'};
          --app-text: ${themeVars['--app-text'] || '#e5e5e5'};
          --app-border: ${themeVars['--app-border'] || '#333'};
          --primary-main: ${themeVars['--primary-main'] || '#3b82f6'};
          --primary-hover: ${themeVars['--primary-hover'] || '#2563eb'};
        }

        /* Scrollbar Sync */
        ::-webkit-scrollbar { width: 6px; height: 6px; }
        ::-webkit-scrollbar-thumb { background: var(--color-theme-600); border-radius: 4px; }
        ::-webkit-scrollbar-thumb:hover { background: var(--color-theme-500); }
      </style>
    `;

    // 智能注入：如果內容包含 <head>，則注入其中；否則置於頂部
    // Smart injection: inject into <head> if present; otherwise prepend
    if (htmlContent.includes('<head>')) {
      return htmlContent.replace('<head>', `<head>${styleTag}`);
    } else if (htmlContent.includes('<html>')) {
      return htmlContent.replace('<html>', `<html><head>${styleTag}</head>`);
    }
    
    return styleTag + htmlContent;
  }, [htmlContent, themeKey]);

  if (loading) {
    return (
      <div className="w-full h-full flex flex-col items-center justify-center bg-theme-900 border-t border-theme-800 p-6 text-center">
        <Loader2 className="w-8 h-8 animate-spin text-primary-main mb-4" />
        <p className="text-theme-400">正在啟動插件系統...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="w-full h-full flex flex-col items-center justify-center bg-theme-900 border-t border-theme-800 p-6 text-center">
        <AlertCircle className="w-12 h-12 text-error-main mb-4" />
        <h2 className="text-lg font-semibold text-theme-100 mb-2">插件載入失敗</h2>
        <p className="text-sm text-theme-400 mb-6 max-w-sm">{error}</p>
        <button 
          onClick={() => window.location.reload()}
          className="px-4 py-2 bg-theme-800 hover:bg-theme-700 text-theme-200 rounded-lg transition-colors border border-theme-700"
        >
          重試
        </button>
      </div>
    );
  }

  return (
    <div className="w-full h-full flex flex-col bg-theme-950">
      <iframe 
        srcDoc={themeInjectedHtml} 
        className="flex-1 w-full h-full border-none"
        title={file.name}
        sandbox="allow-scripts allow-forms allow-popups allow-modals allow-downloads"
      />
    </div>
  );
};

export default React.memo(PluginViewer);
