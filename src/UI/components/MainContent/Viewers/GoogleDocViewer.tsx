import React, { useEffect, useRef, useState } from 'react';
import type { DriveFile } from '../../../../shared/types';
import { Loader2, ExternalLink, Terminal } from 'lucide-react';
import { parseLinkData } from '../../../utils/icons'; // ✅ 引入解析器

interface GoogleDocViewerProps {
  file: DriveFile;
  onOpenLink?: (url: string) => void;
  onUrlChange?: (url: string) => void;
  onTitleChange?: (title: string) => void;
}

interface NewWindowEvent extends Event { url: string; }

const GoogleDocViewer: React.FC<GoogleDocViewerProps> = ({ file, onOpenLink, onUrlChange, onTitleChange }) => {
  const [loading, setLoading] = useState(true);
  const webviewRef = useRef<HTMLElement>(null);
  const onUrlChangeRef = useRef(onUrlChange);
  const onTitleChangeRef = useRef(onTitleChange);
  const onOpenLinkRef = useRef(onOpenLink);

  useEffect(() => {
    onUrlChangeRef.current = onUrlChange;
    onTitleChangeRef.current = onTitleChange;
    onOpenLinkRef.current = onOpenLink;
  }, [onUrlChange, onTitleChange, onOpenLink]);

  const getUrl = () => {
    // If the file ID is modified for splitting the tab, extract the real ID
    const realId = file.id.startsWith('split-') ? file.id.replace(/^split-([^-]+)-.*/, '$1') : file.id;

    if (file.mimeType === 'application/vnd.nexus.link' || file.mimeType === 'application/vnd.synapse.link') {
      return parseLinkData(file.description).url || 'https://notebooklm.google.com/';
    }
    if (file.mimeType === 'application/vnd.google-apps.folder') {
      if (['root', 'starred', 'trash', 'sharedWithMe'].includes(realId)) {
        if (realId === 'root') return 'https://drive.google.com/drive/my-drive';
        if (realId === 'starred') return 'https://drive.google.com/drive/starred';
        if (realId === 'trash') return 'https://drive.google.com/drive/trash';
        if (realId === 'sharedWithMe') return 'https://drive.google.com/drive/shared-with-me';
      }
      return `https://drive.google.com/drive/folders/${realId}`;
    }

    // Google 特有格式
    if (file.mimeType.includes('spreadsheet')) return `https://docs.google.com/spreadsheets/d/${realId}/edit`;
    if (file.mimeType.includes('presentation')) return `https://docs.google.com/presentation/d/${realId}/edit`;
    if (file.mimeType.includes('document')) return `https://docs.google.com/document/d/${realId}/edit`;

    // 如果有官方提供的預覽連結，優先使用
    if (file.webViewLink) return file.webViewLink;

    // 後置處理：如果是 JSON 或其他一般檔案
    return `https://drive.google.com/file/d/${realId}/view`;
  };

  const targetUrl = getUrl();

  useEffect(() => {
    const webview = webviewRef.current;
    if (!webview) return;

    interface WebviewNavigationEvent extends Event {
      url?: string;
      isMainFrame?: boolean;
    }

    // 只在真正的頁面導航觸發 loading，
    // did-start-loading 會被 hover 觸發資源請求污染，已棄用
    const handleNavigate = (e: Event) => {
      const navEvent = e as WebviewNavigationEvent;
      if (navEvent.isMainFrame === false) return;
      setLoading(true);
      console.log(`[WebView Navigate] 頁面跳轉，觸發載入預覽中...\n網址: ${navEvent.url}\nmainFrame: ${navEvent.isMainFrame}`);
    };

    const handleDomReady = () => {
      setLoading(false);
      console.log(`[WebView DomReady] 頁面載入完成`);
    };

    const handleFail = () => {
      setLoading(false);
      console.log(`[WebView DidFailLoad] 載入失敗`);
    };

    const handleNewWindow = (e: Event) => {
      e.preventDefault();
      const newWindowEvt = e as NewWindowEvent;
      let newUrl = newWindowEvt.url;
      if (newUrl.includes('google.com/url')) {
        try { newUrl = new URL(newUrl).searchParams.get('q') || newUrl; } catch (err) {
          console.error(err);
        }
      }
      if (onOpenLinkRef.current) onOpenLinkRef.current(newUrl);
    };

    const handleUpdateTargetUrl = (e: Event) => {
      const navEvent = e as WebviewNavigationEvent;
      if (navEvent.isMainFrame === false) return;
      if (onUrlChangeRef.current && navEvent.url) onUrlChangeRef.current(navEvent.url);
    };

    interface WebviewTitleEvent extends Event { title: string; }
    const handleUpdateTitle = (e: Event) => {
      const titleEvent = e as WebviewTitleEvent;
      if (onTitleChangeRef.current && titleEvent.title) {
        onTitleChangeRef.current(titleEvent.title);
      }
    };

    webview.addEventListener('did-navigate', handleNavigate);
    webview.addEventListener('did-navigate', handleUpdateTargetUrl);
    webview.addEventListener('did-navigate-in-page', handleUpdateTargetUrl);
    webview.addEventListener('page-title-updated', handleUpdateTitle);
    webview.addEventListener('dom-ready', handleDomReady);
    webview.addEventListener('did-fail-load', handleFail);
    webview.addEventListener('new-window', handleNewWindow);

    return () => {
      webview.removeEventListener('did-navigate', handleNavigate);
      webview.removeEventListener('did-navigate', handleUpdateTargetUrl);
      webview.removeEventListener('did-navigate-in-page', handleUpdateTargetUrl);
      webview.removeEventListener('page-title-updated', handleUpdateTitle);
      webview.removeEventListener('dom-ready', handleDomReady);
      webview.removeEventListener('did-fail-load', handleFail);
      webview.removeEventListener('new-window', handleNewWindow);
    };
  }, [file.id, targetUrl]); // ✅ 只依賴 ID 和網址，移除 Callback 依賴避免 re-render！

  const WebView = 'webview' as unknown as React.ElementType;

  if (file.mimeType === 'application/vnd.google.colaboratory') {
    return (
      <div className="w-full h-full flex flex-col items-center justify-center bg-theme-900 border-t border-theme-800 p-6 text-center">
        <div className="w-16 h-16 bg-warning-main/20 rounded-2xl flex items-center justify-center mb-4 ring-1 ring-warning-main/50">
          <Terminal className="w-8 h-8 text-warning-main" />
        </div>
        <h2 className="text-xl font-semibold text-theme-200 mb-2">{file.name}</h2>
        <p className="text-sm text-theme-400 mb-6 max-w-sm">Colab 筆記本因權限與環境限制，無法在內部預覽。請點擊下方按鈕在外部瀏覽器開啟器進行編輯。</p>
        <button
          onClick={() => {
            window.electron.openExternal(targetUrl);
          }}
          className="flex items-center gap-2 px-6 py-2.5 bg-primary-main hover:bg-primary-hover text-theme-50 rounded-lg transition-colors shadow-lg shadow-primary-main/20 font-medium"
        >
          <ExternalLink className="w-4 h-4" />
          在瀏覽器中開啟
        </button>
      </div>
    );
  }

  return (
    <div className="w-full h-full relative flex flex-col bg-white group">
      {loading && (
        <div className="absolute inset-0 flex flex-col items-center justify-center bg-theme-900 z-10">
          <Loader2 className="w-8 h-8 animate-spin text-primary-main mb-2" />
          <span className="text-theme-500 text-sm">載入預覽中...</span>
        </div>
      )}
      <WebView
        ref={webviewRef}
        src={targetUrl}
        className="flex-1 w-full h-full border-none outline-none"
        partition="persist:google-session"
        allowpopups="true"
        style={{ height: '100%', width: '100%' }}
      />
    </div>
  );
};
export default React.memo(GoogleDocViewer, (prevProps, nextProps) => {
  return prevProps.file.id === nextProps.file.id && prevProps.file.description === nextProps.file.description;
});