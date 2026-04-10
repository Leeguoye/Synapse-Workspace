/**
 * CanvasResourceNode - 資源嵌入節點
 * 從 Sidebar 拖拉 Google Drive 檔案進入畫布後建立的卡片節點
 * 功能：
 * - 4方向連接 Handle
 * - 文字/Markdown 預覽（downloadFileText）
 * - Google Docs/Sheets/Slides → iframe preview
 * - 大小拉伸時動態展示/隱藏內容
 * - 「在系統內開啟」→ 發送自訂 DOM 事件 nexus:openFile
 */
import React, { useEffect, useState, useRef } from 'react';
import { Handle, Position, NodeResizer, ReactFlow, ReactFlowProvider } from '@xyflow/react';
import type { NodeProps, Node } from '@xyflow/react';
import type { CanvasNodeData } from './canvasTypes';
import { getDynamicIcon } from '../../../utils/icons';
import { DEFAULT_FONT_SIZE } from './canvasUtils';
import { t } from '../../../../language';


/* ── 建立給巢狀畫布預覽專用的極簡 Node ── */
const PreviewDummyNode = ({ data }: any) => (
  <div style={{ fontSize: 6, padding: '2px 4px', background: 'var(--color-theme-700)', border: '1px solid var(--color-theme-600)', borderRadius: 4, color: 'var(--color-theme-50)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
    {data.label || 'Node'}
  </div>
);
const PREVIEW_NODE_TYPES = {
  shapeNode: PreviewDummyNode, stickyNode: PreviewDummyNode,
  groupNode: PreviewDummyNode, resourceNode: PreviewDummyNode,
};

/* ── MIME type detection ── */
const isGoogleNative = (mime: string) => ['document', 'spreadsheet', 'presentation', 'form'].some(t => mime.includes(t));
const isTextFile = (mime: string) => mime === 'text/markdown' || mime === 'text/plain' || mime === 'application/x-tex' || mime.startsWith('text/');
const isImage = (mime: string) => mime.startsWith('image/');
const isVideo = (mime: string) => mime.startsWith('video/');

// 新增這四個專用判斷
const isNexusCanvas = (mime: string) => mime === 'application/vnd.nexus.canvas' || mime === 'application/vnd.synapse.canvas';
const isNexusLink = (mime: string) => mime && (mime.includes('nexus.link') || mime.includes('synapse.link'));
const isYouTubeUrl = (url: string) => url && (url.includes('youtube.com') || url.includes('youtu.be'));
const isGoogleDocUrl = (url: string) => url && url.includes('docs.google.com');

function getPreviewUrl(link: string) {
  if (!link) return '';
  if (isYouTubeUrl(link)) {
    try {
      const url = new URL(link);
      const vid = url.searchParams.get('v') || url.pathname.split('/').pop();
      return `https://www.youtube.com/embed/${vid}`;
    } catch { return link; }
  }
  return link.replace(/\/(edit|view).*$/, '/preview');
}

/* ── Electron bridge ── */
function getElectron() {
  return (window as unknown as {
    electron: {
      downloadFileText: (id: string) => Promise<{ content: string }>;
      openExternal: (url: string) => void;
    }
  }).electron;
}

const HANDLE_STYLE: React.CSSProperties = {
  width: 8, height: 8, background: '#6366f1',
  border: '1.5px solid #818cf8', borderRadius: 2,
};

const MIN_H_FOR_PREVIEW = 100; // Only show preview when node is tall enough (px)

const CanvasResourceNode: React.FC<NodeProps<Node<CanvasNodeData>>> = ({ data, selected, width, height = 60 }) => {
  const name = data.resourceFileName ?? String(data.label ?? '未命名');
  const mimeType = data.resourceMimeType ?? '';
  const iconLink = data.resourceIconLink ?? '';
  const webViewLink = data.resourceWebViewLink ?? '';
  const fileId = data.resourceFileId ?? '';
  const fontSize = (data.fontSize as number | undefined) ?? DEFAULT_FONT_SIZE;

  // 1. 解析 n_link 實際對應的目標 URL (優先從 appProperties.syn_url 取得)
  const appProps = data.resourceAppProperties as Record<string, string> | undefined;
  const targetUrl = isNexusLink(mimeType)
    ? (appProps?.syn_url || appProps?.nex_url || appProps?.url || appProps?.targetUrl || (data.resourceLinkUrl as string) || webViewLink)
    : webViewLink;

  // 2. 依據目標 URL 精確判斷屬性
  const isYt = isYouTubeUrl(targetUrl);
  const isGDoc = isGoogleNative(mimeType) || isGoogleDocUrl(targetUrl);
  const isImg = isImage(mimeType);
  const isVid = isVideo(mimeType);
  const isCanvas = isNexusCanvas(mimeType);

  const [isResizing, setIsResizing] = useState(false); // 新增 Resize 狀態
  const [textContent, setTextContent] = useState<string | null>(null);
  const [loadError, setLoadError] = useState(false);
  const [refreshKey, setRefreshKey] = useState(0);
  const prevVisibility = useRef(document.visibilityState);

  const currentWidth = (width as number) || 320;
  const BASE_DOC_WIDTH = 800; // 欺騙 iframe 的虛擬寬度
  const scale = currentWidth / BASE_DOC_WIDTH;
  const invScale = 100 / scale; // 計算放大百分比

  // 3. 修改檔案下載條件：Text 或是 Canvas 都需要下載內文
  const shouldFetchText = isTextFile(mimeType) || isCanvas;
  useEffect(() => {
    if (!fileId || !shouldFetchText) return;
    setLoadError(false);
    getElectron().downloadFileText(fileId)
      .then(({ content }: { content: string }) => setTextContent(content ?? ''))
      .catch(() => setLoadError(true));
  }, [fileId, mimeType, refreshKey, shouldFetchText]);

  // 4. 解析 Canvas JSON
  let canvasNodes: any[] = [];
  let canvasEdges: any[] = [];
  if (isCanvas && textContent) {
    try {
      const parsed = JSON.parse(textContent);
      canvasNodes = parsed.nodes || [];
      canvasEdges = parsed.edges || [];
    } catch (e) { }
  }

  // Refresh when tab becomes visible again
  useEffect(() => {
    const onVisibility = () => {
      if (document.visibilityState === 'visible' && prevVisibility.current === 'hidden') {
        setRefreshKey(k => k + 1); // triggers re-fetch of text content / iframes reload
      }
      prevVisibility.current = document.visibilityState;
    };
    document.addEventListener('visibilitychange', onVisibility);
    return () => document.removeEventListener('visibilitychange', onVisibility);
  }, []);

  // Open within Nexus (dispatches custom event caught by App/FileTree)
  const openInNexus = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (!fileId) return;
    window.dispatchEvent(new CustomEvent('synapse:openFile', {
      detail: { id: fileId, name, mimeType, webViewLink },
    }));
  };

  // Google Workspace 節點永遠顯示 iframe，不受高度限制
  // (Google Workspace nodes always show iframe regardless of height)
  const showPreview = isGDoc ? true : (height as number) > MIN_H_FOR_PREVIEW;
  const previewUrl = targetUrl ? getPreviewUrl(targetUrl) + (isYt ? '' : isGDoc ? '?rm=minimal' : '') : '';

  return (
    <div style={{
      width: '100%', height: '100%',
      background: 'var(--color-theme-800)',
      border: selected ? '1.5px solid #6366f1' : '1.5px solid var(--color-theme-600)',
      borderRadius: '8px',
      boxShadow: '0 4px 12px rgba(0,0,0,0.4)',
      display: 'flex', flexDirection: 'column',
      overflow: 'hidden', fontSize,
      color: 'var(--color-theme-100)',
    }}>
      <NodeResizer
        minWidth={140} minHeight={50} isVisible={selected}
        lineStyle={{ borderWidth: 1, borderStyle: 'dashed', borderColor: '#6366f155' }}
        handleStyle={{ width: 6, height: 6, borderRadius: 1, background: '#6366f1', border: 'none' }}
        onResizeStart={() => setIsResizing(true)}
        onResizeEnd={() => setIsResizing(false)}
      />

      {/* Connection handles */}
      <Handle id="top" type="source" position={Position.Top} style={HANDLE_STYLE} />
      <Handle id="bottom" type="source" position={Position.Bottom} style={HANDLE_STYLE} />
      <Handle id="left" type="source" position={Position.Left} style={HANDLE_STYLE} />
      <Handle id="right" type="source" position={Position.Right} style={HANDLE_STYLE} />

      {/* Header bar */}
      <div style={{
        padding: '5px 8px',
        background: 'var(--color-theme-900)',
        borderBottom: '1px solid var(--color-theme-600)',
        display: 'flex', alignItems: 'center', gap: 6,
        flex: '0 0 auto',
      }}>
        {iconLink
          ? <img src={iconLink} alt="" style={{ width: 14, height: 14, objectFit: 'contain' }} />
          : getDynamicIcon(mimeType, name)
        }
        <span style={{
          flex: 1, overflow: 'hidden', textOverflow: 'ellipsis',
          whiteSpace: 'nowrap', fontSize: 11, fontWeight: 600, color: 'var(--color-theme-300)',
        }}>
          {name}
        </span>
        {/* Open in Nexus system (not external browser) */}
        <button
          onClick={openInNexus}
          style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#6366f1', padding: 0, lineHeight: 1, fontSize: 10 }}
          title={t.canvas.panel.openBySynapse || t.canvas.panel.openByNexus}
        >↗</button>
      </div>

      {/* Preview area - shown only when node is tall enough */}
      {showPreview && (
        <div style={{ flex: 1, overflow: 'hidden', position: 'relative' }}>

          {/* 加入 Canvas 唯讀畫布的條件渲染 */}
          {isCanvas ? (
            <div className="nodrag" style={{ width: '100%', height: '100%', background: 'var(--color-theme-950)', pointerEvents: (selected && !isResizing) ? 'auto' : 'none' }}>
              <ReactFlowProvider>
                <ReactFlow
                  nodes={canvasNodes} edges={canvasEdges}
                  nodeTypes={PREVIEW_NODE_TYPES} // 使用安全降級的預覽節點，避免循環引入
                  fitView panOnDrag={false} zoomOnScroll={false}
                  nodesDraggable={false} nodesConnectable={false} elementsSelectable={false}
                  colorMode="dark"
                />
              </ReactFlowProvider>
            </div>
          ) : isTextFile(mimeType) ? (
            <pre
              className="nodrag" // 避免使用者在滾動文字時誤觸節點拖曳
              style={{
                margin: 0, padding: '6px 8px',
                fontSize: Math.max(8, fontSize - 2),
                color: 'var(--color-theme-400)',
                whiteSpace: 'pre-wrap',  // 保持自動換行
                wordBreak: 'break-word', // 確保長單字不會撐破版面
                lineHeight: 1.4,
                overflow: 'auto',        // 允許內容過長時出現捲軸
                height: '100%',
                pointerEvents: isResizing ? 'none' : 'auto' // 縮放外框時封鎖內部互動
              }}
            >{loadError ? t.canvas.panel.loadError : textContent}</pre>
          ) : isYt ? (
            <iframe
              src={previewUrl}
              style={{
                width: '100%',
                height: '100%',
                border: 'none',
                pointerEvents: (selected && !isResizing) ? 'auto' : 'none'
              }} allowFullScreen title={name} />
          ) : ((isGDoc || isImg || isVid || isNexusLink(mimeType)) && previewUrl) ? (
            // 這裡把 n_link (isNexusLink) 也納入縮放預覽的支援，如果是普通網址就會直接用 iframe 載入縮放
            <iframe
              key={`${fileId}-${refreshKey}`}
              src={previewUrl}
              style={{
                position: 'absolute', top: 0, left: 0,
                width: `${invScale}%`, height: `${invScale}%`,
                transform: `scale(${scale})`, transformOrigin: 'top left',
                border: 'none', background: '#fff', display: 'block',
                pointerEvents: (selected && !isResizing) ? 'auto' : 'none' // 封鎖滑鼠事件
              }}
              sandbox="allow-scripts allow-same-origin allow-popups-to-escape-sandbox allow-popups allow-forms"
              title={name}
            />
          ) : (
            <div style={{ padding: '6px 8px', fontSize: 10, color: 'var(--color-theme-500)' }}>
              {mimeType.split('/').pop()?.replace('vnd.', '')}
            </div>
          )}
        </div>
      )}

      {/* When not tall enough, just show MIME type hint */}
      {!showPreview && (
        <div style={{ padding: '3px 8px', fontSize: 10, color: 'var(--color-theme-500)' }}>
          {mimeType.split('/').pop()?.replace('vnd.', '')}
        </div>
      )}
    </div>
  );
};

export default CanvasResourceNode;
