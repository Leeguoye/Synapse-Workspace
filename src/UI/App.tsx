import React, { useState, useEffect } from 'react';
import Sidebar from './components/Sidebar/Sidebar';
import MainContent from './components/MainContent/MainContent';
import { TitleBar } from './components/TitleBar/TitleBar';
import { CredentialModal } from './components/Settings/CredentialModal';
import { PluginManagerModal } from './components/Settings/PluginManagerModal';
import { t } from '../language';
import type { DriveFile } from '../shared/types';
import { parseLinkData } from './utils/icons';
import { THEMES } from './configs/themeConfig';
import type { ThemeType } from './configs/themeConfig';

const App: React.FC = () => {
  // ✅ 雙開視窗狀態
  const [leftFiles, setLeftFiles] = useState<DriveFile[]>([]);
  const [rightFiles, setRightFiles] = useState<DriveFile[]>([]);
  const [leftActiveId, setLeftActiveId] = useState<string | null>(null);
  const [rightActiveId, setRightActiveId] = useState<string | null>(null);
  const [splitMode, setSplitMode] = useState<boolean>(false);
  const [activePane, setActivePane] = useState<'left' | 'right'>('left');
  
  // ✅ 狀態提升
  const [isSecurityOpen, setIsSecurityOpen] = useState(false);
  const [isPluginManagerOpen, setIsPluginManagerOpen] = useState(false);
  
  const themeIds = THEMES.map(t => t.id);

  const [theme, setThemeState] = useState<ThemeType>(() => (localStorage.getItem('theme') as ThemeType) || 'dark');

  // ✅ 當前 WebView 的即時網址，我們從 MainContent 取得並更新到此
  const [dynamicUrls, setDynamicUrls] = useState<Record<string, string>>({});

  // ✅ 當前工作區 ID，傳給 MainContent 讓其分配標籤使用
  const [currentWorkspaceId, setCurrentWorkspaceId] = useState<string>('');

  // ✅ 統一處理設定作用中檔案
  const updateFilesForPane = (pane: 'left' | 'right', updater: (prev: DriveFile[]) => DriveFile[]) => {
    if (pane === 'left') setLeftFiles(updater);
    else setRightFiles(updater);
  };

  const updateActiveIdForPane = (pane: 'left' | 'right', id: string | null) => {
    if (pane === 'left') setLeftActiveId(id);
    else setRightActiveId(id);
  };

  const handleFileSelect = (file: DriveFile) => {
    const setFiles = activePane === 'left' ? setLeftFiles : setRightFiles;
    const setActiveId = activePane === 'left' ? setLeftActiveId : setRightActiveId;

    setFiles(prev => {
      let targetFileId = file.id;

      // 如果原本的 file.id 存在，檢查它是否已經被 WebView 跳轉到其他網頁
      const activeUrl = dynamicUrls[file.id];
      if (activeUrl) {
        let originalUrl = file.webViewLink || `https://drive.google.com/file/d/${file.id}/preview`;
        if (file.mimeType === 'application/vnd.google-apps.folder') {
          if (['root', 'starred', 'trash', 'sharedWithMe'].includes(file.id)) {
            if (file.id === 'root') originalUrl = 'https://drive.google.com/drive/my-drive';
            else if (file.id === 'starred') originalUrl = 'https://drive.google.com/drive/starred';
            else if (file.id === 'trash') originalUrl = 'https://drive.google.com/drive/trash';
            else if (file.id === 'sharedWithMe') originalUrl = 'https://drive.google.com/drive/shared-with-me';
          } else {
            originalUrl = `https://drive.google.com/drive/folders/${file.id}`;
          }
        } else if (file.mimeType === 'application/vnd.nexus.link' || file.mimeType === 'application/vnd.synapse.link') {
          // Prefer cached linkUrl from appProperties; fall back to description JSON
          originalUrl = file.linkUrl || parseLinkData(file.description).url || 'https://notebooklm.google.com/';
        } else if (file.mimeType.includes('document')) originalUrl = `https://docs.google.com/document/d/${file.id}/edit`;
        else if (file.mimeType.includes('spreadsheet')) originalUrl = `https://docs.google.com/spreadsheets/d/${file.id}/edit`;
        else if (file.mimeType.includes('presentation')) originalUrl = `https://docs.google.com/presentation/d/${file.id}/edit`;

        // 特殊處理：如果是資料夾，而且跳轉的網址仍然是 Google Drive 的資料夾，那就允許在同一個分頁中瀏覽，不要 split
        const isFolderNavigating = file.mimeType === 'application/vnd.google-apps.folder' && (activeUrl.includes('drive.google.com/drive/folders/') || activeUrl.includes('drive.google.com/drive/my-drive') || activeUrl.includes('drive.google.com/drive/starred') || activeUrl.includes('drive.google.com/drive/trash') || activeUrl.includes('drive.google.com/drive/shared-with-me'));

        // 判斷是否偏差（考慮重新導向的容錯，簡單比對 origin 或 path）
        if (!isFolderNavigating && !activeUrl.includes(originalUrl.split('?')[0]) && activeUrl !== originalUrl && activeUrl !== 'about:blank') {
          // 這個標籤已經被當成瀏覽器跳到別的地方了！因此我們「重新」幫這個檔案開一個新標籤！
          targetFileId = `split-${file.id}-${Date.now()}`;
        }
      }

      const existingIndex = prev.findIndex(f => f.id === targetFileId);
      if (existingIndex >= 0) {
        const newFiles = [...prev];
        newFiles[existingIndex] = { ...file, id: targetFileId };
        setActiveId(targetFileId);
        return newFiles;
      }

      setActiveId(targetFileId);
      return [...prev, { ...file, id: targetFileId }];
    });
  };

  const handleFileUpdate = (file: DriveFile) => {
    const updateFn = (prev: DriveFile[]) => {
      const existingIndex = prev.findIndex(f => f.id === file.id);
      if (existingIndex >= 0) {
        const newFiles = [...prev];
        newFiles[existingIndex] = { ...newFiles[existingIndex], ...file };
        return newFiles;
      }
      return prev;
    };
    setLeftFiles(updateFn);
    setRightFiles(updateFn);
  };

  const handleTabClose = (pane: 'left' | 'right', fileId: string) => {
    const setFiles = pane === 'left' ? setLeftFiles : setRightFiles;
    const setActiveId = pane === 'left' ? setLeftActiveId : setRightActiveId;
    const currentActiveId = pane === 'left' ? leftActiveId : rightActiveId;

    setFiles(prev => {
      const newFiles = prev.filter(f => f.id !== fileId);
      if (currentActiveId === fileId) {
        setActiveId(newFiles.length > 0 ? newFiles[newFiles.length - 1].id : null);
      }
      // 如果所有標籤都關閉了，且在雙開模式下，不一定要強制退出，可以保留空視窗，或者您可以決定關閉右邊如果空了
      return newFiles;
    });
  };

  // ✅ 修復 4：移除視窗標題連動，避免檔名被亂七八糟的網頁標題覆寫
  const handleUpdateTab = (fileId: string, _newTitle?: string, newUrl?: string) => {
    const updateFn = (prev: DriveFile[]) => {
      let isChanged = false;
      const newFiles = prev.map(f => {
        if (f.id === fileId) {
          const updated = { ...f };

          if (newUrl && (f.mimeType === 'application/vnd.nexus.link' || f.mimeType === 'application/vnd.synapse.link')) {
            const currentData = parseLinkData(f.description);
            const currentUrl  = f.linkUrl ?? currentData.url;
            if (currentUrl !== newUrl) {
              updated.description = JSON.stringify({ ...currentData, url: newUrl });
              isChanged = true;
            }
          }

          if (isChanged && f.mimeType === 'application/vnd.nexus.link' && !f.id.startsWith('temp-')) {
            window.electron.updateFileMeta(fileId, undefined, updated.description).catch(() => { });
          }
          return updated;
        }
        return f;
      });
      return isChanged ? newFiles : prev;
    };

    setLeftFiles(updateFn);
    setRightFiles(updateFn);
  };

  // ✅ 修復 2 & 3：全新且精準的網址解析器，準確分配 Google 套件的正確格式
  const handleOpenLink = (url: string) => {
    let targetUrl = url;
    if (targetUrl.includes('google.com/url')) {
      try { targetUrl = new URL(targetUrl).searchParams.get('q') || targetUrl; } catch (e) { console.error(e) }
    }

    const docsMatch = targetUrl.match(/docs\.google\.com\/(document|spreadsheets|presentation|forms)\/d\/([a-zA-Z0-9_-]+)/);
    const driveMatch = targetUrl.match(/drive\.google\.com\/(?:file\/d\/|drive\/folders\/)([a-zA-Z0-9_-]+)/);

    let fileId = null;
    let detectedMime = 'application/vnd.google-apps.document';

    if (docsMatch) {
      fileId = docsMatch[2];
      const type = docsMatch[1];
      if (type === 'spreadsheets') detectedMime = 'application/vnd.google-apps.spreadsheet';
      else if (type === 'presentation') detectedMime = 'application/vnd.google-apps.presentation';
      else if (type === 'forms') detectedMime = 'application/vnd.google-apps.form';
    } else if (driveMatch) {
      fileId = driveMatch[1];
      if (targetUrl.includes('/folders/')) detectedMime = 'application/vnd.google-apps.folder';
      else detectedMime = 'application/octet-stream';
    }

    if (fileId) {
      handleFileSelect({ id: fileId, name: '載入中...', mimeType: detectedMime } as DriveFile);
    } else {
      const tempId = 'temp-' + Date.now();
      const tempDesc = JSON.stringify({ url: targetUrl, icon: 'Globe', color: '#94a3b8' });
      handleFileSelect({ id: tempId, name: '外部連結', mimeType: 'application/vnd.synapse.link', description: tempDesc } as DriveFile);
    }
  };

  useEffect(() => {
    // ✅ Global theme switcher (backend toggle)
    (window as any).setTheme = (t: string) => {
      setThemeState(t as ThemeType);
      
      // Remove all possible theme classes
      document.documentElement.classList.remove(...themeIds);
      // Add selected
      document.documentElement.classList.add(t);
      localStorage.setItem('theme', t);
    };

    (window as any).toggleTheme = () => {
      setThemeState(prev => {
        const nextIdx = (themeIds.indexOf(prev) + 1) % themeIds.length;
        const next = themeIds[nextIdx];
        (window as any).setTheme(next);
        return next;
      });
    };

    // Restore from localStorage
    const savedTheme = localStorage.getItem('theme');
    if (savedTheme) {
      (window as any).setTheme(savedTheme);
    }

    // 建立一個穩定的回呼函式參考，避免閉包陷阱
    const listener = (url: string) => handleOpenLink(url);

    if (window.electron?.onOpenLinkInTab) {
      window.electron.onOpenLinkInTab(listener);
    }

    if (window.electron?.onAuthExpired) {
      window.electron.onAuthExpired(() => {
        alert('您的 Google 授權已過期或被迫撤銷，系統已清除舊的登入狀態。\n請點擊確定以重新載入應用程式，並重新點擊「登入 Google」按鈕以取得新授權。');
        window.location.reload();
      });
    }

    if (window.electron?.onAuthMissing) {
      window.electron.onAuthMissing(() => {
        const setupFileId = 'synapse-setup-screen';
        setLeftFiles(prev => {
          if (prev.some(f => f.id === setupFileId)) return prev;
          return [...prev, {
            id: setupFileId,
            name: t.settings?.credentials?.setupTab || '開始設定',
            mimeType: 'application/vnd.synapse.setup',
            description: 'Synapse Google Auth Setup',
            fileData: ''
          } as DriveFile];
        });
        setLeftActiveId(setupFileId);
      });
    }

    return () => {
      // 確保在元件卸載或重新綁定時，移除舊的監聽器以免重複觸發
      if (window.electron?.offOpenLinkInTab) {
        window.electron.offOpenLinkInTab(listener);
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ✅ 初始化時檢查憑證
  useEffect(() => {
    if (window.electron?.credentials?.list) {
      window.electron.credentials.list().then((creds: any[]) => {
        const hasSecret = creds.some(c => c.key === 'google-oauth-secret');
        if (!hasSecret) {
          const setupFileId = 'synapse-setup-screen';
          setLeftFiles(prev => {
            if (prev.some(f => f.id === setupFileId)) return prev;
            return [...prev, {
              id: setupFileId,
              name: t.settings?.credentials?.setupTab || '開始設定',
              mimeType: 'application/vnd.synapse.setup',
              description: '{}'
            } as DriveFile];
          });
          setLeftActiveId(setupFileId);
        }
      }).catch(console.error);
    }
  }, []);

  return (
    <div className="flex flex-col h-screen bg-app-bg text-app-text overflow-hidden transition-colors duration-300">
      {/* 自訂標顔列（正常模式下顯示；在 Electron 以外执行時自動隐藏） */}
      <TitleBar
        theme={theme}
        onOpenSecurity={() => setIsSecurityOpen(true)}
        onOpenPlugins={() => setIsPluginManagerOpen(true)}
      />
      <div className="flex flex-1 min-h-0 overflow-hidden">
        <div className="border-r border-sidebar-border shrink-0 flex flex-col bg-sidebar-bg z-20 transition-all duration-300 relative">
          <Sidebar onFileSelect={handleFileSelect} onFileUpdate={handleFileUpdate} onWorkspaceChange={setCurrentWorkspaceId} />
        </div>
        <div className="flex-1 flex flex-col min-w-0 bg-app-bg z-10 transition-colors duration-300 relative">
          <MainContent
          workspaceId={currentWorkspaceId}
          theme={theme}
          onOpenSecurity={() => setIsSecurityOpen(true)}
          leftFiles={leftFiles} rightFiles={rightFiles}
          leftActiveId={leftActiveId} rightActiveId={rightActiveId}
          splitMode={splitMode} activePane={activePane}
          onFileSelect={handleFileSelect}
          onTabSelect={(pane, id) => {
            setActivePane(pane);
            updateActiveIdForPane(pane, id);
          }}
          onTabClose={handleTabClose}
          onTabsReorder={(pane, newOrder) => updateFilesForPane(pane, () => newOrder)}
          onOpenLink={handleOpenLink}
          onUpdateTab={(id, title, newUrl) => {
            handleUpdateTab(id, title, newUrl);
            if (newUrl) {
              setDynamicUrls(prev => ({ ...prev, [id]: newUrl }));
            }
          }}
          onPaneFocus={setActivePane}
          onToggleSplit={(forceMode?: boolean) => {
            const newMode = forceMode !== undefined ? forceMode : !splitMode;
            setSplitMode(newMode);
            if (newMode) {
              // 進入雙開模式時，將目前的 active 檔案移到右邊
              if (activePane === 'left' && leftActiveId) {
                const fileToMove = leftFiles.find(f => f.id === leftActiveId);
                if (fileToMove) {
                  setLeftFiles(prev => prev.filter(f => f.id !== leftActiveId));
                  setRightFiles(prev => [...prev, fileToMove]);
                  setRightActiveId(leftActiveId);

                  // 左邊需要選一個新的 active
                  const remainingLeft = leftFiles.filter(f => f.id !== leftActiveId);
                  setLeftActiveId(remainingLeft.length > 0 ? remainingLeft[remainingLeft.length - 1].id : null);
                  setActivePane('right');
                }
              }
            } else {
              // 退出雙開模式時，將右邊的檔案合併到左邊
              setLeftFiles(prev => {
                const merged = [...prev];
                rightFiles.forEach(rf => { if (!merged.some(f => f.id === rf.id)) merged.push(rf); });
                return merged;
              });
              setRightFiles([]);
              setRightActiveId(null);
              setActivePane('left');
              // 若左側目前沒 active，從右側來的檔案中選一個
              if (!leftActiveId && rightActiveId) setLeftActiveId(rightActiveId);
            }
          }}
          onMoveTab={(file, fromPane, toPane) => {
            // 處理跨窗格拖曳
            updateFilesForPane(fromPane, prev => prev.filter(f => f.id !== file.id));
            if (fromPane === 'left' && leftActiveId === file.id) setLeftActiveId(null);
            if (fromPane === 'right' && rightActiveId === file.id) setRightActiveId(null);

            updateFilesForPane(toPane, prev => [...prev, file]);
            updateActiveIdForPane(toPane, file.id);
            setActivePane(toPane);
          }}
        />
        </div>
      </div>

      {/* Global Modals */}
      <CredentialModal 
        isOpen={isSecurityOpen} 
        onClose={() => setIsSecurityOpen(false)} 
      />
      
      <PluginManagerModal
        isOpen={isPluginManagerOpen}
        onClose={() => setIsPluginManagerOpen(false)}
      />
    </div>
  );
};
export default App;