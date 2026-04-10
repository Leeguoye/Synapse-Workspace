/// <reference types="vite/client" />

// 引入共用型別
import { DriveFile, FileQuery, GoogleLoginResult, Workspace } from './shared/types';

interface Window {
  electron: {
    triggerGoogleLogin: () => Promise<GoogleLoginResult>;
    listFiles: (params: FileQuery) => Promise<DriveFile[]>;

    // --- 工作區相關 API ---
    getWorkspaces: () => Promise<Workspace[]>;
    createCustomWorkspace: (data: { name: string, targetId: string, icon: string, color: string }) => Promise<Workspace>;
    updateWorkspaceOrder: (workspaces: Workspace[]) => Promise<boolean>;
    deleteWorkspace: (id: string) => Promise<boolean>;

    // --- 視窗控制 API ---
    windowMinimize: () => Promise<void>;
    windowMaximize: () => Promise<void>;
    windowClose: () => Promise<void>;
    windowIsMaximized: () => Promise<boolean>;
    windowOpenDevTools: () => Promise<void>;
    onMaximizedStateChanged: (callback: (isMaximized: boolean) => void) => () => void;

    // --- Plugins API ---
    plugins: {
      list: () => Promise<any[]>;
      setActive: (pluginId: string, isActive: boolean) => Promise<boolean>;
      uninstall: (pluginId: string) => Promise<boolean>;
    };

    // --- Pipeline API ---
    pipeline: {
      start: (fileId: string, canvasDataString: string) => Promise<{ success: boolean; data?: any; message?: string }>;
      stop: (fileId: string) => Promise<{ success: boolean; message?: string }>;
      onStatusUpdate: (callback: (data: { fileId: string, nodeId: string, status: 'running' | 'success' | 'error', logs?: string[], data?: any }) => void) => () => void;
    };

    // --- 其他 (partial) ---
    [key: string]: any;
  };
}