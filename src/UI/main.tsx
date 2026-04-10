import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App.tsx';
import './index.css'; 
import { mergeLanguage } from '../language';

// 啟動函式 (Bootstrap function)
async function bootstrap() {
    const rootElement = document.getElementById('root');
    if (!rootElement) throw new Error('找不到 root 元素');

    // 1. 取得當前語言並從插件載入額外翻譯
    const lang = localStorage.getItem('language') || 'zh-TW';
    try {
        // @ts-ignore
        const extra = await window.electron.plugins.getLanguageContent(lang);
        if (extra) {
            mergeLanguage(extra);
            console.log('[I18n] Merged plugin language extensions for:', lang);
        }
    } catch (e) {
        console.error('[I18n] Failed to load plugin extensions:', e);
    }

    // 2. 渲染 UI
    ReactDOM.createRoot(rootElement).render(
        <React.StrictMode>
            <App />
        </React.StrictMode>,
    );
}

bootstrap();